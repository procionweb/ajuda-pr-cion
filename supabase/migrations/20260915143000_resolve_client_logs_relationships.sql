create or replace function public.get_crm_client_logs(client_acronym text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
  target_client_id uuid;
begin
  allowed := public.is_admin_department_collaborator() or public.is_auth_s_admin();

  if not allowed then
    return jsonb_build_object(
      'authorized', false,
      'logs', '[]'::jsonb,
      'external_logs', '[]'::jsonb
    );
  end if;

  select client.id into target_client_id
  from public.clients client
  where upper(client.acronym) = upper(get_crm_client_logs.client_acronym)
  limit 1;

  return jsonb_build_object(
    'authorized', true,
    'logs', coalesce((
      select jsonb_agg(to_jsonb(log_row) order by log_row.crm_created_at desc nulls last)
      from (
        select hadron_log.*
        from public.tab_hadron_logs hadron_log
        where hadron_log.client_id = target_client_id
           or upper(hadron_log.client_acronym) = upper(get_crm_client_logs.client_acronym)
           or exists (
             select 1 from public.client_terminals terminal
             where terminal.client_id = target_client_id
               and nullif(trim(terminal.serial_number), '') = nullif(trim(hadron_log.serial_number), '')
           )
        order by hadron_log.crm_created_at desc nulls last
        limit 200
      ) log_row
    ), '[]'::jsonb),
    'external_logs', coalesce((
      select jsonb_agg(to_jsonb(log_row) order by log_row.crm_created_at desc nulls last)
      from (
        select external_log.*
        from public.auth_logs external_log
        where external_log.client_id = target_client_id
           or upper(external_log.client_acronym) = upper(get_crm_client_logs.client_acronym)
           or exists (
             select 1 from public.auth_usuarios auth_user
             where (auth_user.id = external_log.auth_usuario_id
                    or auth_user.legacy_id = external_log.auth_usuario_legacy_id)
               and (auth_user.client_id = target_client_id
                    or upper(auth_user.client_acronym) = upper(get_crm_client_logs.client_acronym))
           )
        order by external_log.crm_created_at desc nulls last
        limit 200
      ) log_row
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_crm_client_logs(text) from public;
grant execute on function public.get_crm_client_logs(text) to authenticated;
