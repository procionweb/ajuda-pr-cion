create or replace function public.configuration_companies_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(company_row) order by company_row.legal_name, company_row.company_number),
    '[]'::jsonb
  )
  from (
    select
      company.id,
      company.legacy_key,
      company.client_id,
      client.acronym as client_acronym,
      company.company_number,
      company.legal_name,
      company.trade_name,
      company.document,
      company.state_registration,
      company.municipal_registration,
      company.cnae,
      company.industry,
      company.size,
      company.tax_regime,
      company.address,
      company.city,
      company.state,
      company.postal_code,
      company.responsible_name,
      company.accountant_name,
      company.accountant_phone,
      company.accountant_email,
      company.active,
      company.updated_at
    from public.client_companies as company
    join public.clients as client on client.id = company.client_id
  ) as company_row;
$$;

revoke all on function public.configuration_companies_list() from public;
grant execute on function public.configuration_companies_list() to anon, authenticated;
