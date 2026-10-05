create or replace function public.get_crm_client_companies_by_ids(ids text[])
returns table (id uuid, acronym varchar, name text, legal_name text, trade_name text, document varchar, city text, state char)
language sql stable security definer set search_path = public as $$
  select client.id, client.acronym, coalesce(company.trade_name, company.legal_name, client.name), coalesce(company.legal_name, client.legal_name), coalesce(company.trade_name, company.legal_name, client.trade_name), company.document::varchar, coalesce(company.city, client.city), coalesce(company.state, client.state)
  from public.client_companies company join public.clients client on client.id = company.client_id
  where company.id::text = any(ids) or client.id::text = any(ids);
$$;
revoke all on function public.get_crm_client_companies_by_ids(text[]) from public, anon;
grant execute on function public.get_crm_client_companies_by_ids(text[]) to authenticated;
