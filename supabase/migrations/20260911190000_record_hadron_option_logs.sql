create or replace function public.record_hadron_option_log(
  p_option_id text,
  p_action text,
  p_info text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid := gen_random_uuid();
  v_operator text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  if trim(coalesce(p_option_id, '')) = '' then raise exception 'Opção não informada.'; end if;

  select upper(trim(coalesce(c.operator_acronym, u.raw_user_meta_data ->> 'operator', u.email, '')))
  into v_operator
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  where u.id = auth.uid()
  limit 1;

  insert into public.auth_logs (
    id, legacy_id, action, controller, operator, device, url, info, params,
    crm_created_at, crm_updated_at
  ) values (
    v_id, 'portal-' || v_id::text, trim(p_action), 'CvsOptions', v_operator, 'web',
    'iniciar-hadron/opcoes/' || trim(p_option_id), nullif(trim(coalesce(p_info, '')), ''),
    jsonb_build_array(trim(p_option_id)), now(), now()
  );

  return v_id;
end;
$$;

revoke all on function public.record_hadron_option_log(text, text, text) from public;
grant execute on function public.record_hadron_option_log(text, text, text) to authenticated;

create or replace function public.list_hadron_option_logs(
  p_option_id text,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(log_row) order by log_row.crm_created_at desc), '[]'::jsonb)
  from (
    select
      logs.id,
      logs.controller,
      logs.action,
      logs.client_acronym,
      logs.url,
      logs.info,
      logs.operator,
      host(logs.ip_address) as ip_address,
      logs.device,
      logs.crm_created_at
    from public.auth_logs logs
    where logs.controller = 'CvsOptions'
      and logs.params @> jsonb_build_array(trim(p_option_id))
    order by logs.crm_created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) log_row;
$$;

revoke all on function public.list_hadron_option_logs(text, integer) from public;
grant execute on function public.list_hadron_option_logs(text, integer) to authenticated;
