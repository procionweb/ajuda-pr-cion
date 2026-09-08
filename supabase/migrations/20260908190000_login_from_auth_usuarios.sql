create or replace function public.resolve_portal_login_email(login_value text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(portal_user.email)
  from public.auth_usuarios legacy_user
  join auth.users portal_user
    on lower(trim(portal_user.email)) = lower(trim(legacy_user.email))
  where legacy_user.active
    and upper(trim(coalesce(legacy_user.client_acronym, ''))) = 'PRC'
    and (
      lower(trim(legacy_user.email)) = lower(trim(login_value))
      or upper(trim(legacy_user.operator)) = upper(trim(login_value))
    )
    and lower(trim(coalesce(legacy_user.profile, ''))) in (
      's_admin', 'admin', 'tester', 'manager', 'logistics',
      'supervisor', 'marketing', 'prc'
    )
  limit 1
$$;

revoke all on function public.resolve_portal_login_email(text) from public;
grant execute on function public.resolve_portal_login_email(text) to anon, authenticated;
