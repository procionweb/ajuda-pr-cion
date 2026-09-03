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
  with filtered as (
    select
      history.legacy_id as id,
      history.contact_legacy_id as contact_id,
      history.history_type,
      history.crm_created_at,
      history.return_date,
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
    where (coalesce(p_search, '') = '' or concat_ws(' ', company.legal_name, history.observation_html, history.operator_code, company.city) ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or history.status_code = p_status)
      and (coalesce(p_history_type, '') = '' or history.history_type = p_history_type)
      and (p_from is null or history.crm_created_at::date >= p_from)
      and (p_to is null or history.crm_created_at::date <= p_to)
  ), page_rows as (
    select *, count(*) over () as total_count
    from filtered
    order by crm_created_at desc nulls last, id::bigint desc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', coalesce(max(total_count), 0),
    'rows', coalesce(jsonb_agg(to_jsonb(page_rows) - 'total_count'), '[]'::jsonb)
  )
  from page_rows;
$$;

revoke all on function public.commercial_activities_list(text, text, text, date, date, integer, integer) from public;
grant execute on function public.commercial_activities_list(text, text, text, date, date, integer, integer) to anon, authenticated;

create or replace function public.company_lead_cities()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(city order by city), '[]'::jsonb)
  from (
    select distinct trim(company_leads.city) as city
    from public.company_leads
    where nullif(trim(company_leads.city), '') is not null
  ) cities;
$$;

revoke all on function public.company_lead_cities() from public;
grant execute on function public.company_lead_cities() to anon, authenticated;
