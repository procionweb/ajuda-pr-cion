alter table public.company_lead_activities add column ends_at timestamptz;
create or replace function public.sync_contact_activity_calendar() returns trigger language plpgsql security definer set search_path=public as $$
declare l public.company_leads; finish_at timestamptz; kind_label text;
begin
 if new.type not in ('3','5','6') then return new; end if;
 if tg_op='INSERT' then
 select * into l from public.company_leads where id=new.lead_id;
 finish_at:=coalesce(new.ends_at,new.occurred_at+interval '1 hour');
 if finish_at<=new.occurred_at then raise exception 'O término deve ser posterior ao início.'; end if;
 if (finish_at at time zone 'America/Sao_Paulo')::date<>(new.occurred_at at time zone 'America/Sao_Paulo')::date then raise exception 'Informe início e término no mesmo dia.'; end if;
 kind_label:=case new.type when '3' then 'Visita presencial' when '5' then 'Reunião na Prócion' else 'Reunião remota' end;
 perform public.save_crm_calendar_event(jsonb_build_object('id',new.id,'type',kind_label,'origin','Comercial','operator',new.actor,'responsible',new.actor,'client',coalesce(nullif(l.trade_name,''),l.legal_name),'title',kind_label||' - '||coalesce(nullif(l.trade_name,''),l.legal_name),'description',new.description,'leadId',new.lead_id,'date',to_char(new.occurred_at at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'time',to_char(new.occurred_at at time zone 'America/Sao_Paulo','HH24:MI'),'end',to_char(finish_at at time zone 'America/Sao_Paulo','HH24:MI'),'status',case new.status when 'cancelado' then 'Cancelado' when 'concluido' then 'Concluído' else 'Agendado' end));
 else
 update public.calendar_events set status=case new.status when 'concluido' then 'completed' when 'cancelado' then 'cancelled' else 'scheduled' end,legacy_status=case new.status when 'concluido' then 'completed' when 'cancelado' then 'cancelled' else 'scheduled' end,updated_at=now() where id=new.id and status is distinct from case new.status when 'concluido' then 'completed' when 'cancelado' then 'cancelled' else 'scheduled' end;
 end if;
 return new;
end $$;
create or replace function public.prepare_contact_appointment() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.type in ('3','5','6') and new.occurred_at>now() then new.status:='pendente'; end if;
 return new;
end $$;
create trigger prepare_contact_appointment before insert on public.company_lead_activities for each row execute function public.prepare_contact_appointment();
create trigger sync_contact_activity_calendar after insert or update of status on public.company_lead_activities for each row execute function public.sync_contact_activity_calendar();
create or replace function public.sync_calendar_contact_activity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.company_lead_activities set status=case new.status when 'completed' then 'concluido' when 'cancelled' then 'cancelado' else 'pendente' end,occurred_at=new.starts_at,ends_at=new.ends_at,completed_at=case when new.status in ('completed','cancelled') then now() else null end where id=new.id and (status is distinct from case new.status when 'completed' then 'concluido' when 'cancelled' then 'cancelado' else 'pendente' end or occurred_at is distinct from new.starts_at or ends_at is distinct from new.ends_at);
 return new;
end $$;
create trigger sync_calendar_contact_activity after update of status,starts_at,ends_at on public.calendar_events for each row execute function public.sync_calendar_contact_activity();
revoke all on function public.sync_contact_activity_calendar(),public.prepare_contact_appointment(),public.sync_calendar_contact_activity() from public;
create or replace function public.company_lead_activity_save(p_id uuid,p_lead uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare l public.company_leads; a public.company_lead_activities; occurred timestamptz; due timestamptz;
 actor text := coalesce(nullif(public.current_portal_operator(),''),nullif(p_payload->>'actor',''),'PRCREN');
 key text; count_value integer; first_at text;
begin
 select * into l from public.company_leads where id=p_lead for update;
 if l.id is null then raise exception 'Contato não encontrado.'; end if;
 select * into a from public.company_lead_activities where id=p_id;
 if a.id is not null then
   if a.lead_id<>p_lead then raise exception 'Atividade pertence a outro contato.'; end if;
   return a.id;
 end if;
 if coalesce(p_payload->>'type','') not in ('1','2','3','5','6','10') then raise exception 'Selecione o tipo da atividade.'; end if;
 if nullif(trim(p_payload->>'description'),'') is null then raise exception 'Descreva a atividade realizada.'; end if;
 occurred := (p_payload->>'occurred_at')::timestamptz;
 if occurred is null then raise exception 'Informe a data da atividade.'; end if;
 due := nullif(p_payload->>'return_at','')::timestamptz;
 if due is not null and due<occurred then raise exception 'O retorno deve ser posterior à atividade.'; end if;
 insert into public.company_lead_activities(id,lead_id,type,description,occurred_at,return_at,status,priority,actor,ends_at)
 values(p_id,p_lead,p_payload->>'type',trim(p_payload->>'description'),occurred,due,
 case when due is null then 'concluido' else 'pendente' end,coalesce(nullif(p_payload->>'priority',''),'media'),actor,nullif(p_payload->>'ends_at','')::timestamptz);
 key := case p_payload->>'type' when '1' then 'calls_count' when '2' then 'emails_count' when '10' then 'requests_count' else null end;
 if key is not null then
   count_value := case when coalesce(l.commercial_data->>key,'') ~ '^\d+$' then (l.commercial_data->>key)::integer else 0 end;
   l.commercial_data := coalesce(l.commercial_data,'{}') || jsonb_build_object(key,count_value+1);
 end if;
 first_at := l.commercial_data->>'first_contact_at';
 if nullif(first_at,'') is null then l.commercial_data := coalesce(l.commercial_data,'{}') || jsonb_build_object('first_contact_at',occurred); end if;
 update public.company_leads set commercial_data=l.commercial_data,
 stage=case when p_payload->>'stage' in ('novo','prospeccao','relacionamento','proposta','negociacao','demonstracao') then p_payload->>'stage' else stage end,
 last_modified_by=actor,updated_at=now() where id=p_lead;
 return p_id;
end $$;
create or replace function public.commercial_activities_list(
  p_search text default '',
  p_status text default '',
  p_history_type text default '',
  p_from date default null,
  p_to date default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with all_rows as (
    select
      history.legacy_id as id, null::uuid as lead_id, null::text as activity_status, null::text as priority,
      history.contact_legacy_id as contact_id,
      history.history_type,
      history.crm_created_at, history.crm_created_at as registered_at,
      (history.return_date + coalesce(history.event_time,'00:00'::time)) at time zone 'America/Sao_Paulo' as return_date,
      history.subject,
      history.observation_html,
      history.operator_code,
      history.status_code,
      company.legal_name as company,
      company.city,
      company.state
    from public.commercial_contact_history history
    left join public.configuration_companies company
      on company.legacy_id = history.contact_legacy_id
    union all
    select a.id::text,a.lead_id,
      case when a.status='pendente' and a.return_at<now() then 'atrasado' when a.status='pendente' then 'agendado' else a.status end,
      a.priority,a.lead_id::text,a.type,a.occurred_at,a.created_at,a.return_at,null,a.description,a.actor,l.stage,
      coalesce(nullif(l.commercial_data->>'name',''),l.trade_name,l.legal_name),l.city,l.state
    from public.company_lead_activities a join public.company_leads l on l.id=a.lead_id
  ), filtered as (
    select * from all_rows
    where (coalesce(p_search, '') = '' or concat_ws(' ', company, observation_html, operator_code, city) ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or (status_code = p_status or activity_status = p_status))
      and (coalesce(p_history_type, '') = '' or history_type = p_history_type)
      and (p_from is null or crm_created_at::date >= p_from)
      and (p_to is null or crm_created_at::date <= p_to)
  ), page_rows as (
    select *, count(*) over () as total_count
    from filtered
    order by registered_at desc nulls last, id desc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce(jsonb_agg(to_jsonb(page_rows) - 'total_count'), '[]'::jsonb)
  )
  from page_rows;
$$;

revoke all on function public.commercial_activities_list(text, text, text, date, date, integer, integer) from public;
grant execute on function public.commercial_activities_list(text, text, text, date, date, integer, integer) to anon, authenticated;

do $$ declare a public.company_lead_activities; l public.company_leads; k text; begin for a in select * from public.company_lead_activities where type in ('3','5','6') and not exists(select 1 from public.calendar_events e where e.id=company_lead_activities.id) loop select * into l from public.company_leads where id=a.lead_id; k:=case a.type when '3' then 'Visita presencial' when '5' then 'Reunião na Prócion' else 'Reunião remota' end; perform public.save_crm_calendar_event(jsonb_build_object('id',a.id,'type',k,'origin','Comercial','operator',a.actor,'client',coalesce(l.trade_name,l.legal_name),'title',k||' - '||coalesce(l.trade_name,l.legal_name),'description',a.description,'leadId',a.lead_id,'date',to_char(a.occurred_at at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'time',to_char(a.occurred_at at time zone 'America/Sao_Paulo','HH24:MI'),'end',to_char((a.occurred_at at time zone 'America/Sao_Paulo')+interval '1 hour','HH24:MI'),'status',case when a.status='cancelado' then 'Cancelado' when a.occurred_at>now() or a.status='pendente' then 'Agendado' else 'Concluído' end)); if a.occurred_at>now() and a.status='concluido' then update public.company_lead_activities set status='pendente' where id=a.id; end if; end loop; end $$;
