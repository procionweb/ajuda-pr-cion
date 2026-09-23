create or replace function public.current_portal_operator()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    nullif(upper(trim(collaborator.operator_acronym)), ''),
    nullif(upper(trim(profile.operator_code)), ''),
    nullif(upper(trim(auth_user.operator)), ''),
    'PRCREN'
  )
  from auth.users portal_user
  left join public.tab_colaboradores collaborator
    on collaborator.profile_id = portal_user.id
  left join public.profiles profile
    on profile.id = portal_user.id
  left join public.auth_usuarios auth_user
    on lower(trim(auth_user.email)) = lower(trim(portal_user.email))
  where portal_user.id = auth.uid()
  limit 1
$$;

revoke all on function public.current_portal_operator() from public;
grant execute on function public.current_portal_operator() to authenticated;

drop function if exists public.get_current_portal_access();

create or replace function public.get_current_portal_access()
returns table (
  portal_profile text,
  collaborator_department text,
  operator_acronym text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(u.raw_app_meta_data ->> 'perfil', au.profile, 'prc'),
    c.clb_departamento,
    coalesce(
      nullif(upper(trim(c.operator_acronym)), ''),
      nullif(upper(trim(p.operator_code)), ''),
      nullif(upper(trim(au.operator)), ''),
      'PRCREN'
    )
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  left join public.profiles p on p.id = u.id
  left join public.auth_usuarios au
    on lower(trim(au.email)) = lower(trim(u.email))
  where u.id = auth.uid()
  limit 1
$$;

revoke all on function public.get_current_portal_access() from public;
grant execute on function public.get_current_portal_access() to authenticated;

create or replace function public.company_leads_update_stage(
  p_id uuid,
  p_stage text,
  p_actor text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := coalesce(
    nullif(public.current_portal_operator(), ''),
    nullif(upper(trim(p_actor)), ''),
    'PRCREN'
  );
begin
  if p_stage not in (
    'novo', 'prospeccao', 'relacionamento', 'proposta', 'negociacao',
    'demonstracao', 'negocio_fechado', 'sem_interesse'
  ) then
    raise exception 'Etapa de prospecção inválida.';
  end if;

  update public.company_leads
  set stage = p_stage,
      last_modified_by = actor,
      updated_at = now()
  where id = p_id;
end;
$$;

create or replace function public.company_leads_save_action(
  p_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb,
  p_finalize boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_lead public.company_leads;
  actor text := coalesce(
    nullif(public.current_portal_operator(), ''),
    nullif(upper(trim(p_payload->>'_actor')), ''),
    'PRCREN'
  );
  clean_payload jsonb := coalesce(p_payload, '{}'::jsonb) - '_actor';
begin
  if p_action = 'edit' then
    update public.company_leads
    set commercial_data = coalesce(commercial_data, '{}'::jsonb) || clean_payload,
        stage = case when clean_payload->>'stage' in ('novo','prospeccao','relacionamento','proposta','negociacao','demonstracao','negocio_fechado','sem_interesse') then clean_payload->>'stage' else stage end,
        trade_name = coalesce(nullif(trim(clean_payload->>'trade_name'), ''), trade_name),
        raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'phone', nullif(trim(clean_payload->>'phone'), ''),
          'email', nullif(trim(clean_payload->>'email'), ''),
          'website', nullif(trim(clean_payload->>'website'), '')
        )),
        notes = nullif(trim(clean_payload->>'activities'), ''),
        last_modified_by = actor,
        updated_at = now()
    where id = p_id returning * into updated_lead;
  elsif p_action = 'inactivate' then
    if nullif(trim(clean_payload->>'reason'), '') is null then
      raise exception 'Informe o motivo da inativacao.';
    end if;
    update public.company_leads
    set registration_status = 'INATIVA',
        inactivation_reason = trim(clean_payload->>'reason'),
        inactivation_notes = nullif(trim(clean_payload->>'notes'), ''),
        inactivated_at = now(),
        last_modified_by = actor,
        updated_at = now()
    where id = p_id returning * into updated_lead;
  elsif p_action = 'close_deal' then
    update public.company_leads
    set conversion_data = clean_payload,
        conversion_status = case when p_finalize then 'finalizado' else 'rascunho' end,
        stage = case when p_finalize then 'negocio_fechado' else stage end,
        closed_at = case when p_finalize then now() else closed_at end,
        last_modified_by = actor,
        updated_at = now()
    where id = p_id returning * into updated_lead;
  else
    raise exception 'Acao comercial invalida.';
  end if;

  if updated_lead.id is null then raise exception 'Lead nao encontrado.'; end if;
  return public.company_lead_details(updated_lead.id);
end;
$$;

update public.company_leads
set last_modified_by = 'PRCREN'
where upper(trim(coalesce(last_modified_by, ''))) = 'PRCGGC';
