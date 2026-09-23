alter table public.company_leads
  add column if not exists last_modified_by text;

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
    nullif(upper(trim(auth.jwt()->'user_metadata'->>'operator')), ''),
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

revoke all on function public.company_leads_update_stage(uuid, text, text) from public;
grant execute on function public.company_leads_update_stage(uuid, text, text) to anon, authenticated;

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
    nullif(upper(trim(auth.jwt()->'user_metadata'->>'operator')), ''),
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

revoke all on function public.company_leads_save_action(uuid, text, jsonb, boolean) from public;
grant execute on function public.company_leads_save_action(uuid, text, jsonb, boolean) to anon, authenticated;
