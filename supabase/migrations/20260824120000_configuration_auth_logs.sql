create or replace function public.configuration_auth_logs_list(
  search_filter text default null,
  operator_filter text default null,
  acronym_filter text default null,
  from_filter timestamptz default null,
  to_filter timestamptz default null,
  page_limit integer default 25,
  page_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      l.id,
      l.controller,
      l.action,
      l.client_acronym,
      l.url,
      l.info,
      l.operator,
      host(l.ip_address) as ip_address,
      l.device,
      l.crm_created_at
    from public.auth_logs l
    where (nullif(trim(operator_filter), '') is null or upper(coalesce(l.operator, '')) = upper(trim(operator_filter)))
      and (nullif(trim(acronym_filter), '') is null or upper(coalesce(l.client_acronym, '')) like '%' || upper(trim(acronym_filter)) || '%')
      and (from_filter is null or l.crm_created_at >= from_filter)
      and (to_filter is null or l.crm_created_at <= to_filter)
      and (
        nullif(trim(search_filter), '') is null
        or concat_ws(' ', l.controller, l.action, l.client_acronym, l.url, l.info, l.operator, l.device, host(l.ip_address))
          ilike '%' || trim(search_filter) || '%'
      )
  ), paged as (
    select *
    from filtered
    order by crm_created_at desc nulls last, id desc
    limit least(greatest(coalesce(page_limit, 25), 1), 100)
    offset greatest(coalesce(page_offset, 0), 0)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p) order by p.crm_created_at desc nulls last, p.id desc) from paged p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'operators', coalesce((
      select jsonb_agg(o.operator order by o.operator)
      from (select distinct operator from public.auth_logs where nullif(trim(operator), '') is not null) o
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.configuration_auth_logs_list(text, text, text, timestamptz, timestamptz, integer, integer) to anon, authenticated;
