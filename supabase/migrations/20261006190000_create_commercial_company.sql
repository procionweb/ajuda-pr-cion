-- Adiciona contatos sem modificar empresas já cadastradas.
create or replace function public.company_leads_create(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  document text := nullif(regexp_replace(coalesce(p_payload->>'cnpj', ''), '[^0-9]', '', 'g'), '');
  contact jsonb;
  phones jsonb := coalesce(p_payload->'phones', '[]'::jsonb);
  emails jsonb := coalesce(p_payload->'emails', '[]'::jsonb);
  actor text := coalesce(nullif(public.current_portal_operator(), ''), 'PRCREN');
begin
  if nullif(trim(p_payload->>'name'), '') is null or nullif(trim(p_payload->>'city'), '') is null
     or coalesce(p_payload->>'state', '') !~ '^[A-Z]{2}$' then
    raise exception 'Preencha nome, cidade e UF.';
  end if;
  if document is not null and length(document) <> 14 then
    raise exception 'Informe o CNPJ completo, com 14 dígitos.';
  end if;
  if coalesce(p_payload->>'postal_code', '') <> '' and length(regexp_replace(p_payload->>'postal_code', '[^0-9]', '', 'g')) <> 8 then
    raise exception 'Informe o CEP completo.';
  end if;
  if coalesce(p_payload->>'priority', '') not in ('Baixa', 'Média', 'Alta') then
    raise exception 'Selecione uma prioridade válida.';
  end if;
  if (coalesce(p_payload->>'terminals', '') <> '' and p_payload->>'terminals' !~ '^[0-9]+$')
     or (coalesce(p_payload->>'companies', '') <> '' and p_payload->>'companies' !~ '^[0-9]+$') then
    raise exception 'Terminais e empresas devem ser números inteiros positivos ou zero.';
  end if;
  if jsonb_typeof(phones) <> 'array' or jsonb_typeof(emails) <> 'array' then raise exception 'Contatos inválidos.'; end if;
  for contact in select value from jsonb_array_elements(phones) loop
    if length(regexp_replace(coalesce(contact->>'value', ''), '[^0-9]', '', 'g')) not in (10, 11) then
      raise exception 'Preencha os telefones completos, incluindo o DDD.';
    end if;
  end loop;
  for contact in select value from jsonb_array_elements(emails) loop
    if coalesce(contact->>'value', '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Informe e-mails válidos.';
    end if;
  end loop;
  insert into public.company_leads (
    cnpj, legal_name, trade_name, search_alias, company_size, city, state,
    postal_code, address, neighborhood, stage, source, assigned_to,
    last_modified_by, commercial_data, raw_payload
  ) values (
    document, coalesce(nullif(trim(p_payload->>'legal_name'), ''), trim(p_payload->>'name')),
    coalesce(nullif(trim(p_payload->>'trade_name'), ''), trim(p_payload->>'name')),
    concat_ws(' ', nullif(trim(p_payload->>'acronym'), ''), trim(p_payload->>'name')),
    nullif(p_payload->>'size', ''), trim(p_payload->>'city'), p_payload->>'state',
    nullif(p_payload->>'postal_code', ''), concat_ws(', ', nullif(p_payload->>'address', ''), nullif(p_payload->>'number', ''), nullif(p_payload->>'complement', '')),
    nullif(p_payload->>'neighborhood', ''), 'prospeccao', 'crm-manual', actor, actor,
    p_payload - 'phones' - 'emails',
    p_payload || jsonb_build_object(
      'phone', phones->0->>'value', 'phone_secondary', phones->1->>'value',
      'email', emails->0->>'value', 'website', nullif(p_payload->>'website', ''),
      'enriched_phones', coalesce((select jsonb_agg(jsonb_build_object('phone', value->>'value', 'contact', value->>'contact', 'source', 'crm-manual', 'source_url', '')) from jsonb_array_elements(phones)), '[]'::jsonb),
      'enriched_emails', coalesce((select jsonb_agg(jsonb_build_object('email', value->>'value', 'contact', value->>'contact', 'source', 'crm-manual', 'source_url', '')) from jsonb_array_elements(emails)), '[]'::jsonb)
    )
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.company_leads_create(jsonb) from public;
grant execute on function public.company_leads_create(jsonb) to anon, authenticated;
