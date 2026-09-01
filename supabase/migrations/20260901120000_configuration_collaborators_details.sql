alter table public.tab_colaboradores
  add column if not exists phone text,
  add column if not exists personal_mobile text,
  add column if not exists business_mobile text,
  add column if not exists birth_date date,
  add column if not exists cpf text,
  add column if not exists pis text,
  add column if not exists work_card text,
  add column if not exists admitted_at date,
  add column if not exists driver_license_type text,
  add column if not exists driver_license_expires_at date,
  add column if not exists company_legacy_id text,
  add column if not exists source_created_at timestamptz,
  add column if not exists source_updated_at timestamptz;

drop function if exists public.list_colaboradores();

create function public.list_colaboradores()
returns table (
  id uuid,
  legacy_id text,
  full_name text,
  first_name text,
  last_name text,
  email text,
  department text,
  job_title text,
  operator_acronym text,
  operator_code text,
  active boolean,
  terminated_at date,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    collaborator.id,
    collaborator.legacy_id,
    collaborator.full_name,
    collaborator.first_name,
    collaborator.last_name,
    collaborator.email,
    collaborator.clb_departamento,
    collaborator.job_title,
    collaborator.operator_acronym,
    collaborator.operator_code,
    collaborator.active,
    collaborator.terminated_at,
    coalesce(collaborator.source_created_at, collaborator.created_at),
    coalesce(collaborator.source_updated_at, collaborator.updated_at)
  from public.tab_colaboradores collaborator
  order by coalesce(collaborator.full_name, collaborator.email) asc;
$$;

grant execute on function public.list_colaboradores() to anon, authenticated, service_role;

create or replace function public.configuration_collaborator_get(collaborator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not (
    public.is_auth_s_admin() or public.is_admin_department_collaborator()
  ) then
    raise exception 'Acesso não autorizado.';
  end if;

  select jsonb_build_object(
    'id', collaborator.id,
    'legacy_id', collaborator.legacy_id,
    'first_name', collaborator.first_name,
    'last_name', collaborator.last_name,
    'full_name', collaborator.full_name,
    'email', collaborator.email,
    'department', collaborator.clb_departamento,
    'job_title', collaborator.job_title,
    'operator_acronym', collaborator.operator_acronym,
    'operator_code', collaborator.operator_code,
    'active', collaborator.active,
    'phone', collaborator.phone,
    'personal_mobile', collaborator.personal_mobile,
    'business_mobile', collaborator.business_mobile,
    'birth_date', collaborator.birth_date,
    'cpf', collaborator.cpf,
    'pis', collaborator.pis,
    'work_card', collaborator.work_card,
    'admitted_at', collaborator.admitted_at,
    'terminated_at', collaborator.terminated_at,
    'driver_license_type', collaborator.driver_license_type,
    'driver_license_expires_at', collaborator.driver_license_expires_at,
    'company_legacy_id', collaborator.company_legacy_id,
    'company_name', 'Prócion Informática Ltda',
    'created_at', coalesce(collaborator.source_created_at, collaborator.created_at),
    'updated_at', coalesce(collaborator.source_updated_at, collaborator.updated_at)
  ) into result
  from public.tab_colaboradores collaborator
  where collaborator.id = collaborator_id;

  if result is null then
    raise exception 'Colaborador não encontrado.';
  end if;
  return result;
end;
$$;

create or replace function public.configuration_collaborator_save(
  collaborator_id uuid,
  collaborator_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (
    public.is_auth_s_admin() or public.is_admin_department_collaborator()
  ) then
    raise exception 'Acesso não autorizado.';
  end if;

  update public.tab_colaboradores
  set first_name = nullif(trim(collaborator_payload ->> 'first_name'), ''),
      last_name = nullif(trim(collaborator_payload ->> 'last_name'), ''),
      full_name = nullif(trim(concat_ws(' ', collaborator_payload ->> 'first_name', collaborator_payload ->> 'last_name')), ''),
      operator_acronym = upper(nullif(trim(collaborator_payload ->> 'operator_acronym'), '')),
      operator_code = nullif(trim(collaborator_payload ->> 'operator_code'), ''),
      active = coalesce((collaborator_payload ->> 'active')::boolean, active),
      clb_departamento = nullif(trim(collaborator_payload ->> 'department'), ''),
      job_title = nullif(trim(collaborator_payload ->> 'job_title'), ''),
      email = lower(nullif(trim(collaborator_payload ->> 'email'), '')),
      phone = nullif(trim(collaborator_payload ->> 'phone'), ''),
      personal_mobile = nullif(trim(collaborator_payload ->> 'personal_mobile'), ''),
      business_mobile = nullif(trim(collaborator_payload ->> 'business_mobile'), ''),
      birth_date = nullif(collaborator_payload ->> 'birth_date', '')::date,
      cpf = nullif(trim(collaborator_payload ->> 'cpf'), ''),
      pis = nullif(trim(collaborator_payload ->> 'pis'), ''),
      work_card = nullif(trim(collaborator_payload ->> 'work_card'), ''),
      admitted_at = nullif(collaborator_payload ->> 'admitted_at', '')::date,
      terminated_at = nullif(collaborator_payload ->> 'terminated_at', '')::date,
      driver_license_type = nullif(trim(collaborator_payload ->> 'driver_license_type'), ''),
      driver_license_expires_at = nullif(collaborator_payload ->> 'driver_license_expires_at', '')::date,
      updated_at = now()
  where id = collaborator_id;

  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
end;
$$;

create or replace function public.configuration_collaborator_deactivate(collaborator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (
    public.is_auth_s_admin() or public.is_admin_department_collaborator()
  ) then
    raise exception 'Acesso não autorizado.';
  end if;

  update public.tab_colaboradores
     set active = false,
         terminated_at = coalesce(terminated_at, current_date),
         updated_at = now()
   where id = collaborator_id;

  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
end;
$$;

revoke all on function public.configuration_collaborator_get(uuid) from public;
revoke all on function public.configuration_collaborator_save(uuid, jsonb) from public;
revoke all on function public.configuration_collaborator_deactivate(uuid) from public;
grant execute on function public.configuration_collaborator_get(uuid) to authenticated;
grant execute on function public.configuration_collaborator_save(uuid, jsonb) to authenticated;
grant execute on function public.configuration_collaborator_deactivate(uuid) to authenticated;

notify pgrst, 'reload schema';
