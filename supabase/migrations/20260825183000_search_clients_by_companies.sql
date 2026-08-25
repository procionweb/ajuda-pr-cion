create or replace function public.search_crm_client_companies(
  search_term text,
  result_limit integer default 200
)
returns table (
  id uuid,
  legacy_id text,
  acronym varchar,
  group_acronym varchar,
  name text,
  legal_name text,
  trade_name text,
  document varchar,
  industry text,
  size text,
  city text,
  state char,
  postal_code varchar,
  active boolean,
  crm_created_at timestamptz,
  crm_updated_at timestamptz,
  version text,
  version_released_at date,
  setup_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    client.id,
    client.legacy_id,
    client.acronym,
    client.group_acronym,
    coalesce(company.trade_name, company.legal_name, client.name),
    coalesce(company.legal_name, client.legal_name),
    coalesce(company.trade_name, company.legal_name, client.trade_name),
    company.document::varchar,
    coalesce(company.industry, client.industry),
    coalesce(company.size, client.size),
    coalesce(company.city, client.city),
    coalesce(company.state, client.state),
    coalesce(company.postal_code, client.postal_code)::varchar,
    company.active and client.active,
    client.crm_created_at,
    greatest(client.crm_updated_at, company.updated_at),
    client.version,
    client.version_released_at,
    client.setup_at
  from public.client_companies company
  join public.clients client on client.id = company.client_id
  where nullif(trim(search_term), '') is not null
    and concat_ws(
      ' ',
      company.legal_name,
      company.trade_name,
      company.document,
      company.city,
      company.state,
      company.postal_code,
      company.address,
      company.responsible_name,
      client.acronym,
      client.group_acronym
    ) ilike '%' || trim(search_term) || '%'
  order by company.legal_name nulls last, company.trade_name nulls last
  limit least(greatest(result_limit, 1), 500);
$$;

revoke all on function public.search_crm_client_companies(text, integer) from public;
grant execute on function public.search_crm_client_companies(text, integer) to anon, authenticated;
