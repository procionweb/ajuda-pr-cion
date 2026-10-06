-- Conversion happens in the same transaction as the finalization RPC.
alter table public.company_leads add column if not exists converted_client_id uuid references public.clients(id);

create or replace function public.convert_finalized_company_lead()
returns trigger language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  p jsonb := coalesce(new.conversion_data, '{}'::jsonb);
  doc text := regexp_replace(coalesce(p->>'cnpj', new.cnpj), '[^0-9]', '', 'g');
  sigla text := upper(trim(p->>'acronym'));
  client_id uuid;
  company_id uuid;
  existing_count integer;
  created_client boolean := false;
begin
  if coalesce(new.conversion_status, '') <> 'finalizado' or new.converted_client_id is not null then return new; end if;
  if length(doc) <> 14 or nullif(trim(p->>'nickname'), '') is null or
     nullif(trim(p->>'legal_name'), '') is null or nullif(trim(p->>'city'), '') is null or
     coalesce(upper(p->>'state'), '') !~ '^[A-Z]{2}$' then
    raise exception 'Preencha nome, CNPJ, razão social, cidade e UF para finalizar.';
  end if;
  if nullif(sigla, '') is null then raise exception 'Informe a sigla do cliente para finalizar.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(doc, 0));
  select count(*), (array_agg(id))[1] into existing_count, client_id
    from public.clients where regexp_replace(document, '[^0-9]', '', 'g') = doc;
  if existing_count > 1 then raise exception 'Há mais de um cliente com este CNPJ. Confira o cadastro existente.'; end if;
  if client_id is null then
    select count(distinct c.client_id), (array_agg(c.client_id))[1] into existing_count, client_id
      from public.client_companies c where regexp_replace(c.document, '[^0-9]', '', 'g') = doc;
    if existing_count > 1 then raise exception 'Este CNPJ está vinculado a mais de um cliente.'; end if;
  end if;
  if client_id is null then
    if exists(select 1 from public.clients where upper(acronym) = sigla) then
      raise exception 'Esta sigla já pertence a outro cliente. Escolha outra sigla.';
    end if;
    insert into public.clients(acronym, group_acronym, name, legal_name, trade_name, document,
      industry, size, city, state, postal_code, active, crm_created_at, address, address_number,
      neighborhood, address_complement, primary_operator, secondary_operator, website,
      state_registration, municipal_registration, cnae, tax_regime, source_payload)
    values(sigla, nullif(upper(p->>'group_acronym'), ''), p->>'nickname', p->>'legal_name',
      nullif(p->>'trade_name', ''), doc, p->>'branch', p->>'company_size', p->>'city', upper(p->>'state'),
      p->>'postal_code', true, now(), p->>'address', p->>'address_number', p->>'neighborhood',
      p->>'address_complement', p->>'hadron_responsible_1', p->>'hadron_responsible_2', p->>'website',
      p->>'state_registration', p->>'city_registration', p->>'cnae', p->>'tax_regime',
      p || jsonb_build_object('company_lead_id', new.id)) returning id into client_id;
    created_client := true;
  end if;
  select c.id into company_id from public.client_companies c
    where c.client_id = client_id and regexp_replace(c.document, '[^0-9]', '', 'g') = doc limit 1;
  if company_id is null then
    insert into public.client_companies(client_id, legacy_key, company_number, legal_name, trade_name,
      document, state_registration, municipal_registration, cnae, industry, size, tax_regime,
      address, city, state, postal_code, responsible_name, responsible_document,
      accountant_name, accountant_phone, accountant_email, source_payload)
    values(client_id, 'lead:' || new.id, 1, p->>'legal_name', p->>'trade_name', doc,
      p->>'state_registration', p->>'city_registration', p->>'cnae', p->>'branch', p->>'company_size',
      p->>'tax_regime', p->>'address', p->>'city', upper(p->>'state'), p->>'postal_code',
      coalesce(nullif(p->>'responsible_name', ''), p->>'admin_name'), p->>'responsible_cpf',
      p->>'accountant_name', p->>'accountant_phone', p->>'accountant_email', p)
    returning id into company_id;
  end if;
  if nullif(p->>'accountant_id', '') is not null then
    insert into public.crm_accountant_clients(accountant_id, client_company_id)
      values((p->>'accountant_id')::uuid, company_id::text) on conflict do nothing;
  end if;
  if created_client and (nullif(p->>'email', '') is not null or nullif(p->>'phone', '') is not null) then
    insert into public.client_contacts(client_id, legacy_key, name, email, phone, source_payload)
    values(client_id, 'lead:' || new.id, coalesce(nullif(p->>'admin_name', ''), p->>'nickname'),
      nullif(p->>'email', ''), nullif(p->>'phone', ''), p);
  end if;
  update public.company_leads set converted_client_id = client_id where id = new.id;
  return new;
end;
$$;
revoke all on function public.convert_finalized_company_lead() from public, anon, authenticated;
drop trigger if exists convert_finalized_company_lead on public.company_leads;
create trigger convert_finalized_company_lead after update of conversion_status, conversion_data
on public.company_leads for each row execute function public.convert_finalized_company_lead();
