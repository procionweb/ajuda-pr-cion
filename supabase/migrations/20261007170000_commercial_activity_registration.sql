create table public.company_lead_activities (
 id uuid primary key, lead_id uuid not null references public.company_leads(id),
 type text not null check(type in ('1','2','3','5','6','10')),
 description text not null check(length(trim(description))>0),
 occurred_at timestamptz not null, return_at timestamptz,
 status text not null check(status in ('pendente','concluido','cancelado')),
 priority text not null check(priority in ('baixa','media','alta')),
 actor text not null, created_at timestamptz not null default now(), completed_at timestamptz
);
create index company_lead_activities_lead_idx on public.company_lead_activities(lead_id,occurred_at desc);
create index company_lead_activities_return_idx on public.company_lead_activities(return_at) where status='pendente';
alter table public.company_lead_activities enable row level security;
revoke all on public.company_lead_activities from anon,authenticated;
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
 insert into public.company_lead_activities(id,lead_id,type,description,occurred_at,return_at,status,priority,actor)
 values(p_id,p_lead,p_payload->>'type',trim(p_payload->>'description'),occurred,due,
 case when due is null then 'concluido' else 'pendente' end,coalesce(nullif(p_payload->>'priority',''),'media'),actor);
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
create or replace function public.company_lead_activity_finish(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_status not in ('concluido','cancelado') then raise exception 'Situação inválida.'; end if;
 update public.company_lead_activities set status=p_status,completed_at=now() where id=p_id and status='pendente';
end $$;
create or replace function public.company_lead_activities_get(p_lead uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(a) order by occurred_at desc),'[]') from public.company_lead_activities a where lead_id=p_lead;
$$;
revoke all on function public.company_lead_activity_save(uuid,uuid,jsonb),public.company_lead_activity_finish(uuid,text),public.company_lead_activities_get(uuid) from public;
grant execute on function public.company_lead_activity_save(uuid,uuid,jsonb),public.company_lead_activity_finish(uuid,text),public.company_lead_activities_get(uuid) to anon,authenticated;

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
      history.crm_created_at,
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
      a.priority,a.lead_id::text,a.type,a.occurred_at,a.return_at,null,a.description,a.actor,l.stage,
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
    order by crm_created_at desc nulls last, id desc
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

