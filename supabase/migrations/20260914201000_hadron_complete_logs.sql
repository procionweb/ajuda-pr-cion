create or replace function public.list_hadron_option_logs(p_option_id text, p_limit integer default 2147483647)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(log_row) order by log_row.crm_created_at desc, log_row.id desc), '[]'::jsonb)
  from (
    select logs.id, logs.controller, logs.action, logs.client_acronym,
      logs.url, logs.info, logs.operator, host(logs.ip_address) as ip_address,
      logs.device, logs.crm_created_at
    from public.auth_logs logs
    where logs.controller = 'CvsOptions'
      and public.is_staff()
      and (logs.params @> jsonb_build_array(trim(p_option_id))
        or logs.params #>> '{}' = trim(p_option_id)
        or exists (select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(logs.params) = 'array' then logs.params else '[]'::jsonb end
        ) item where item = trim(p_option_id)))
    order by logs.crm_created_at desc, logs.id desc
    limit greatest(1, coalesce(p_limit, 2147483647))
  ) log_row;
$$;
revoke all on function public.list_hadron_option_logs(text, integer) from public;
grant execute on function public.list_hadron_option_logs(text, integer) to authenticated;
