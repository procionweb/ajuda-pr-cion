create or replace function public.resolve_portal_login_email(login_value text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(collaborator.email)
  from public.tab_colaboradores collaborator
  join auth.users portal_user on portal_user.id = collaborator.profile_id
  where collaborator.active
    and (
      lower(trim(collaborator.email)) = lower(trim(login_value))
      or upper(trim(collaborator.operator_acronym)) = upper(trim(login_value))
    )
    and portal_user.raw_app_meta_data ->> 'perfil' in ('s_admin', 'prc')
  limit 1
$$;

revoke all on function public.resolve_portal_login_email(text) from public;
grant execute on function public.resolve_portal_login_email(text) to anon, authenticated;
