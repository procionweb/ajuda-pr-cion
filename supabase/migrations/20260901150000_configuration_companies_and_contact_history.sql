create table if not exists public.configuration_companies (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique,
  document text,
  legal_name text not null,
  address text,
  address_number text,
  address_complement text,
  neighborhood text,
  postal_code text,
  city text,
  state text,
  email text,
  phone text,
  responsible_name text,
  responsible_phone text,
  crm_created_at timestamptz,
  crm_updated_at timestamptz,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_contact_history (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique,
  contact_legacy_id text not null,
  appointment_legacy_id text,
  module_legacy_id text,
  submodule_legacy_id text,
  contact_status text,
  history_type text,
  event_time time,
  return_date date,
  subject text,
  observation_html text,
  operator_code text,
  status_code text,
  inactive_status text,
  module_name text,
  submodule_name text,
  crm_created_at timestamptz,
  crm_updated_at timestamptz,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_contact_history_contact_idx
  on public.commercial_contact_history (contact_legacy_id, crm_created_at desc);

alter table public.configuration_companies enable row level security;
alter table public.commercial_contact_history enable row level security;

revoke all on public.configuration_companies from anon, authenticated;
revoke all on public.commercial_contact_history from anon, authenticated;

create or replace function public.configuration_companies_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(company_row) order by company_row.legal_name),
    '[]'::jsonb
  )
  from (
    select
      company.id,
      company.legacy_id as legacy_key,
      null::uuid as client_id,
      null::text as client_acronym,
      company.legacy_id::integer as company_number,
      company.legal_name,
      null::text as trade_name,
      company.document,
      null::text as state_registration,
      null::text as municipal_registration,
      null::text as cnae,
      null::text as industry,
      null::text as size,
      null::text as tax_regime,
      concat_ws(', ', nullif(company.address, ''), nullif(company.address_number, ''), nullif(company.neighborhood, '')) as address,
      company.city,
      upper(company.state) as state,
      company.postal_code,
      company.responsible_name,
      null::text as accountant_name,
      null::text as accountant_phone,
      company.email as accountant_email,
      true as active,
      company.updated_at
    from public.configuration_companies as company
  ) as company_row;
$$;

revoke all on function public.configuration_companies_list() from public;
grant execute on function public.configuration_companies_list() to anon, authenticated;

