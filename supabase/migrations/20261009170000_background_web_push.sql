-- All persisted CRM notices enter a server queue; no open browser is required.
create table if not exists public.crm_push_config (
  singleton boolean primary key default true check (singleton),
  public_key text not null, private_key text not null, dispatch_token text not null,
  dispatch_url text not null
);
alter table public.crm_push_config enable row level security;
revoke all on public.crm_push_config from anon, authenticated;
create table if not exists public.crm_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth_key text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.crm_push_subscriptions enable row level security;
revoke all on public.crm_push_subscriptions from anon, authenticated;
create table if not exists public.crm_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.crm_push_subscriptions(id) on delete cascade,
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_id uuid, leased_until timestamptz, delivered_at timestamptz,
  unique(notification_id, subscription_id)
);
alter table public.crm_push_deliveries enable row level security;
revoke all on public.crm_push_deliveries from anon, authenticated;
create index if not exists crm_push_pending_idx on public.crm_push_deliveries(next_attempt_at) where delivered_at is null;
alter table public.notifications add column if not exists source_key text;
create unique index if not exists crm_notification_source_idx on public.notifications(profile_id,source_key) where source_key is not null;

create or replace function public.get_crm_push_public_key() returns text
language sql stable security definer set search_path=public as $$
  select public_key from public.crm_push_config where singleton;
$$;
create or replace function public.register_crm_push_subscription(p_subscription jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare registered_id uuid; endpoint_value text := p_subscription->>'endpoint';
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if endpoint_value !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)/'
     or length(endpoint_value)>4096 or coalesce(p_subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{80,100}$'
     or coalesce(p_subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{20,30}$' then
    raise exception 'Invalid push subscription';
  end if;
  -- A shared browser is reassigned to the signed-in account, never to both accounts.
  delete from public.crm_push_deliveries where subscription_id in (
    select id from public.crm_push_subscriptions where endpoint=endpoint_value and profile_id<>auth.uid()
  );
  insert into public.crm_push_subscriptions(profile_id,endpoint,p256dh,auth_key)
  values(auth.uid(),endpoint_value,p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth')
  on conflict(endpoint) do update set profile_id=excluded.profile_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key,updated_at=now()
  returning id into registered_id;
  return registered_id;
end; $$;
create or replace function public.unregister_crm_push_subscription(p_endpoint text) returns void
language sql security definer set search_path=public as $$
  delete from public.crm_push_subscriptions where endpoint=p_endpoint and profile_id=auth.uid();
$$;
revoke all on function public.register_crm_push_subscription(jsonb),public.unregister_crm_push_subscription(text) from public,anon;
grant execute on function public.register_crm_push_subscription(jsonb),public.unregister_crm_push_subscription(text) to authenticated;
grant execute on function public.get_crm_push_public_key() to anon,authenticated;

create or replace function public.queue_crm_push_notification() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.crm_push_deliveries(notification_id,subscription_id)
  select new.id,id from public.crm_push_subscriptions where profile_id=new.profile_id
  on conflict do nothing;
  return new;
end; $$;
drop trigger if exists queue_crm_push_notification on public.notifications;
create trigger queue_crm_push_notification after insert on public.notifications for each row execute function public.queue_crm_push_notification();

create or replace function public.claim_crm_push_deliveries(p_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare config public.crm_push_config%rowtype; jobs jsonb;
begin
  select * into config from public.crm_push_config where singleton;
  if config.dispatch_token is null or p_token is distinct from config.dispatch_token then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  with candidates as (
    select d.id from public.crm_push_deliveries d
    join public.notifications n on n.id=d.notification_id
    join public.crm_push_subscriptions s on s.id=d.subscription_id
    where d.delivered_at is null and d.attempts<5 and d.next_attempt_at<=now()
      and (d.leased_until is null or d.leased_until<now())
      and n.created_at>now()-interval '1 day' and n.profile_id=s.profile_id
    order by d.next_attempt_at limit 20 for update of d skip locked
  ), claimed as (
    update public.crm_push_deliveries d set attempts=d.attempts+1, lease_id=gen_random_uuid(),leased_until=now()+interval '2 minutes'
    from candidates where d.id=candidates.id returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'leaseId',d.lease_id,'subscription',jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key)),
    'payload',jsonb_build_object('title',n.title,'body',coalesce(n.body,''),'tag','crm:'||n.id,'href',coalesce(n.link,'/'))
  )),'[]'::jsonb) into jobs from claimed d
  join public.notifications n on n.id=d.notification_id join public.crm_push_subscriptions s on s.id=d.subscription_id;
  return jsonb_build_object('publicKey',config.public_key,'privateKey',config.private_key,'jobs',jobs);
end; $$;
create or replace function public.finish_crm_push_delivery(p_token text,p_id uuid,p_lease_id uuid,p_status integer) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.crm_push_config where singleton and dispatch_token=p_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  if p_status in (404,410) then
    delete from public.crm_push_subscriptions where id in (
      select subscription_id from public.crm_push_deliveries where id=p_id and lease_id=p_lease_id
    );
  else
    update public.crm_push_deliveries set delivered_at=case when p_status between 200 and 299 then now() else null end,
      next_attempt_at=now()+make_interval(mins=>least(attempts*2,10)),leased_until=null,lease_id=null
    where id=p_id and lease_id=p_lease_id;
  end if;
end; $$;
revoke all on function public.claim_crm_push_deliveries(text),public.finish_crm_push_delivery(text,uuid,uuid,integer) from public;
grant execute on function public.claim_crm_push_deliveries(text),public.finish_crm_push_delivery(text,uuid,uuid,integer) to anon,authenticated;

-- Same recipients and 30-minute reminder window as the CRM, now evaluated on the server.
create or replace function public.generate_crm_calendar_reminders() returns void
language sql security definer set search_path=public as $$
  insert into public.notifications(profile_id,title,body,link,source_key)
  select distinct p.id,
    case when e.starts_at<=now() then 'Agendamento em andamento'
      when e.legacy_vehicle_id is not null then 'Retire o veículo da visita' else 'Agendamento próximo' end,
    to_char(e.starts_at at time zone 'America/Sao_Paulo','HH24:MI')||' · '||e.title,
    '/calendario?evento='||e.id,
    'calendar:'||e.id||':'||extract(epoch from e.starts_at)::text
  from public.calendar_events e join public.profiles p on p.active and (
    p.id=e.responsible_id or p.id=e.created_by
    or upper(p.operator_code)=upper(e.legacy_operator)
    or exists(select 1 from jsonb_array_elements(coalesce(e.app_metadata->'guestList','[]'::jsonb)) g
      where g->>'id'=p.id::text or upper(g->>'acronym')=upper(p.operator_code) or lower(g->>'email')=lower(p.email))
    or exists(select 1 from regexp_split_to_table(coalesce(e.legacy_guests,''),'[,;]') g
      where upper(trim(g))=upper(p.operator_code) or upper(trim(g)) like upper(p.operator_code)||' - %')
  )
  where e.reminder_enabled and e.status in ('scheduled','in_progress')
    and exists(select 1 from public.crm_push_subscriptions s where s.profile_id=p.id)
    and e.starts_at<=now()+interval '30 minutes' and e.ends_at>=now()
  on conflict(profile_id,source_key) where source_key is not null do nothing;
$$;
revoke all on function public.generate_crm_calendar_reminders() from public,anon,authenticated;

-- Card activity already displayed by the board bell also becomes a persisted notice.
create or replace function public.notify_crm_kanban_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare entry jsonb; board uuid;
begin
  select board_id into board from public.kanban_columns where id=new.column_id;
  for entry in select value from jsonb_array_elements(coalesce(new.source_payload->'activity','[]'::jsonb)) loop
    if coalesce(entry->>'id','')='' or exists(
      select 1 from jsonb_array_elements(coalesce(old.source_payload->'activity','[]'::jsonb)) previous where previous->>'id'=entry->>'id'
    ) then continue; end if;
    insert into public.notifications(profile_id,title,body,link,source_key)
    select distinct p.id,'Atividade no Kanban',new.title||' · '||coalesce(entry->>'text','Atualização no cartão'),
      '/kanban/'||board||'?card='||new.id,'kanban-activity:'||new.id||':'||(entry->>'id')
    from public.profiles p where p.active
      and p.id is distinct from auth.uid()
      and upper(coalesce(p.operator_code,''))<>upper(coalesce(entry->>'authorOperator','__unknown__'))
      and exists(select 1 from public.kanban_boards b where b.id=board and (b.owner_id=p.id
        or exists(select 1 from public.kanban_board_members m where m.board_id=b.id and m.profile_id=p.id)))
    on conflict(profile_id,source_key) where source_key is not null do nothing;
  end loop;
  return new;
end; $$;
drop trigger if exists notify_crm_kanban_activity on public.kanban_cards;
create trigger notify_crm_kanban_activity after update of source_payload on public.kanban_cards for each row execute function public.notify_crm_kanban_activity();

create or replace function public.dispatch_crm_push() returns void
language plpgsql security definer set search_path=public,extensions as $$
declare config public.crm_push_config%rowtype;
begin
  perform public.generate_crm_calendar_reminders();
  select * into config from public.crm_push_config where singleton;
  if config.dispatch_token is not null and exists(select 1 from public.crm_push_deliveries where delivered_at is null and attempts<5 and next_attempt_at<=now()) then
    perform net.http_post(url:=config.dispatch_url,headers:='{"Content-Type":"application/json"}'::jsonb,
      body:=jsonb_build_object('token',config.dispatch_token),timeout_milliseconds:=15000);
  end if;
  delete from public.crm_push_deliveries d using public.notifications n where d.notification_id=n.id and n.created_at<now()-interval '7 days';
end; $$;
revoke all on function public.dispatch_crm_push() from public,anon,authenticated;
select cron.schedule('crm-background-push','* * * * *','select public.dispatch_crm_push();');

create or replace function public.test_crm_push_notification() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if exists(select 1 from public.notifications where profile_id=auth.uid() and title='Notificações do CRM ativadas' and created_at>now()-interval '1 minute') then return; end if;
  insert into public.notifications(profile_id,title,body,link)
  values(auth.uid(),'Notificações do CRM ativadas','Este dispositivo pode receber avisos mesmo com a aba do CRM fechada.','/');
end; $$;
revoke all on function public.test_crm_push_notification() from public,anon;
grant execute on function public.test_crm_push_notification() to authenticated;
