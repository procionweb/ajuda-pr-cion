create table if not exists public.crm_catalog_records (
  entity text not null check (entity in ('options','releases','articles','checklist','parameters','serials','versions','kanban_templates')),
  record_id text not null,
  payload jsonb not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (entity, record_id)
);
alter table public.crm_catalog_records enable row level security;
create policy crm_catalog_staff_read on public.crm_catalog_records for select to authenticated
  using (public.is_staff());
grant select on public.crm_catalog_records to authenticated;

create table if not exists public.crm_catalog_audit (
  id bigint generated always as identity primary key,
  entity text not null,
  record_id text not null,
  before_value jsonb,
  after_value jsonb,
  deleted boolean not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.crm_catalog_audit enable row level security;
create policy crm_catalog_audit_staff_read on public.crm_catalog_audit for select to authenticated using (public.is_staff());
grant select on public.crm_catalog_audit to authenticated;

create or replace function public.save_crm_catalog_records(p_entity text, p_changes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; previous jsonb;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 then
    raise exception 'Alteracoes invalidas';
  end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    if coalesce(item->>'id','') = '' or item->'payload' is null then raise exception 'Registro invalido'; end if;
    select payload into previous from public.crm_catalog_records
      where entity = p_entity and record_id = item->>'id' for update;
    insert into public.crm_catalog_records(entity,record_id,payload,deleted,updated_by)
      values(p_entity,item->>'id',item->'payload',coalesce((item->>'deleted')::boolean,false),auth.uid())
      on conflict(entity,record_id) do update set payload=excluded.payload,deleted=excluded.deleted,
        updated_at=clock_timestamp(),updated_by=auth.uid();
    insert into public.crm_catalog_audit(entity,record_id,before_value,after_value,deleted,actor_id)
      values(p_entity,item->>'id',previous,item->'payload',coalesce((item->>'deleted')::boolean,false),auth.uid());
  end loop;
end $$;
revoke all on function public.save_crm_catalog_records(text,jsonb) from public;
grant execute on function public.save_crm_catalog_records(text,jsonb) to authenticated;
