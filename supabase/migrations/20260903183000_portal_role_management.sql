create or replace function public.list_portal_user_roles()
returns table (collaborator_id uuid, portal_role text, has_login boolean)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_auth_s_admin() then
    raise exception 'Apenas s_admin pode consultar os perfis do portal.';
  end if;
  return query
  select collaborator.id,
         coalesce(portal_user.raw_app_meta_data ->> 'perfil', 'none'),
         portal_user.id is not null
  from public.tab_colaboradores collaborator
  left join auth.users portal_user on portal_user.id = collaborator.profile_id;
end;
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
  if not public.is_auth_s_admin() then
    raise exception 'Apenas s_admin pode alterar perfis do portal.';
  end if;
  if normalized_role not in ('s_admin', 'admin', 'prc', 'none') then
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
        || jsonb_build_object('perfil', normalized_role),
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
end;
$$;

revoke all on function public.list_portal_user_roles() from public;
revoke all on function public.set_portal_user_role(uuid, text) from public;
grant execute on function public.list_portal_user_roles() to authenticated;
grant execute on function public.set_portal_user_role(uuid, text) to authenticated;
