create or replace function public.get_current_portal_access()
returns table (portal_profile text, collaborator_department text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(u.raw_app_meta_data ->> 'perfil', au.profile, 'prc') as portal_profile,
    c.clb_departamento as collaborator_department
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  left join public.auth_usuarios au
    on lower(trim(au.email)) = lower(trim(u.email))
    or upper(trim(au.operator)) = upper(trim(u.raw_user_meta_data ->> 'operator'))
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.list_portal_user_roles()
returns table (collaborator_id uuid, portal_role text, has_login boolean)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if coalesce(
    (select raw_app_meta_data ->> 'perfil' in ('s_admin', 'admin')
     from auth.users where id = auth.uid()),
    false
  ) is not true then
    raise exception 'Apenas administradores podem consultar os perfis do portal.';
  end if;
  return query
  select collaborator.id,
         coalesce(portal_user.raw_app_meta_data ->> 'perfil', 'none'),
         portal_user.id is not null
  from public.tab_colaboradores collaborator
  left join auth.users portal_user on portal_user.id = collaborator.profile_id;
end
$$;

create or replace function public.set_portal_user_role(collaborator_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  collaborator public.tab_colaboradores%rowtype;
  normalized_role text := lower(trim(coalesce(new_role, 'none')));
begin
  if not exists (
    select 1 from public.tab_colaboradores current_collaborator
    where current_collaborator.profile_id = auth.uid()
      and current_collaborator.clb_departamento = 'admin'
  ) then
    raise exception 'Apenas o departamento administrativo pode alterar perfis do portal.';
  end if;
  if normalized_role not in (
    's_admin', 'admin', 'tester', 'manager', 'logistics',
    'supervisor', 'marketing', 'prc', 'none'
  ) then
    raise exception 'Perfil de acesso inválido.';
  end if;

  select * into collaborator from public.tab_colaboradores where id = collaborator_id;
  if collaborator.id is null then raise exception 'Colaborador não encontrado.'; end if;
  if collaborator.profile_id is null then
    raise exception 'Este colaborador ainda não possui uma conta de acesso provisionada.';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('perfil', normalized_role),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'perfil', normalized_role,
          'departamento', collaborator.clb_departamento
        ),
      banned_until = case when normalized_role = 'none' then now() + interval '100 years' else null end,
      updated_at = now()
  where id = collaborator.profile_id;

  update public.profiles
  set role = case when normalized_role = 's_admin' then 'admin'::public.user_role
                  else 'support'::public.user_role end,
      active = normalized_role <> 'none',
      updated_at = now()
  where id = collaborator.profile_id;

  update public.auth_usuarios
  set profile = normalized_role, updated_at = now()
  where lower(trim(email)) = lower(trim(collaborator.email));
end
$$;

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
    and portal_user.raw_app_meta_data ->> 'perfil' in (
      's_admin', 'admin', 'tester', 'manager', 'logistics',
      'supervisor', 'marketing', 'prc'
    )
  limit 1
$$;

revoke all on function public.get_current_portal_access() from public;
grant execute on function public.get_current_portal_access() to authenticated;
revoke all on function public.list_portal_user_roles() from public;
grant execute on function public.list_portal_user_roles() to authenticated;
revoke all on function public.set_portal_user_role(uuid, text) from public;
grant execute on function public.set_portal_user_role(uuid, text) to authenticated;
revoke all on function public.resolve_portal_login_email(text) from public;
grant execute on function public.resolve_portal_login_email(text) to anon, authenticated;
