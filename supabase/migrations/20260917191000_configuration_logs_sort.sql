create or replace function public.configuration_auth_logs_list(
  search_filter text default null,
  operator_filter text default null,
  acronym_filter text default null,
  from_filter timestamptz default null,
  to_filter timestamptz default null,
  page_limit integer default 25,
  page_offset integer default 0,
  sort_by text default 'created_at',
  sort_direction text default 'desc'
)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with filtered as (
    select l.id, l.controller, l.action, l.client_acronym, l.url, l.info, l.operator,
      coalesce(host(l.ip_address), substring(concat_ws(' ', l.info, l.url, l.device) from '(?:[0-9]{1,3}\.){3}[0-9]{1,3}')) as ip_address,
      l.device, l.crm_created_at
    from public.auth_logs l
    where (nullif(trim(operator_filter), '') is null or upper(coalesce(l.operator, '')) = upper(trim(operator_filter)))
      and (nullif(trim(acronym_filter), '') is null or upper(coalesce(l.client_acronym, '')) like '%' || upper(trim(acronym_filter)) || '%')
      and (from_filter is null or l.crm_created_at >= from_filter)
      and (to_filter is null or l.crm_created_at <= to_filter)
      and (nullif(trim(search_filter), '') is null or concat_ws(' ', l.controller, l.action, l.client_acronym, l.url, l.info, l.operator, l.device, host(l.ip_address)) ilike '%' || trim(search_filter) || '%')
  ), paged as (
    select * from filtered
    order by
      case when sort_by = 'operator' and sort_direction = 'asc' then operator end asc nulls last,
      case when sort_by = 'operator' and sort_direction = 'desc' then operator end desc nulls last,
      case when sort_by = 'acronym' and sort_direction = 'asc' then client_acronym end asc nulls last,
      case when sort_by = 'acronym' and sort_direction = 'desc' then client_acronym end desc nulls last,
      case when sort_by = 'controller' and sort_direction = 'asc' then controller end asc nulls last,
      case when sort_by = 'controller' and sort_direction = 'desc' then controller end desc nulls last,
      case when sort_by = 'created_at' and sort_direction = 'asc' then crm_created_at end asc nulls last,
      case when sort_by = 'created_at' and sort_direction = 'desc' then crm_created_at end desc nulls last,
      crm_created_at desc nulls last, id desc
    limit least(greatest(coalesce(page_limit, 25), 1), 100)
    offset greatest(coalesce(page_offset, 0), 0)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p)) from paged p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'operators', coalesce((select jsonb_agg(o.operator order by o.operator) from (select distinct operator from public.auth_logs where nullif(trim(operator), '') is not null) o), '[]'::jsonb)
  );
$$;

grant execute on function public.configuration_auth_logs_list(text, text, text, timestamptz, timestamptz, integer, integer, text, text) to anon, authenticated;

