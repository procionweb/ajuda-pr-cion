-- Preserve proven imported company-owner data outside the accountant's own fields.
create table if not exists public.accountant_company_responsible_archive (
  accountant_id uuid primary key, previous_data jsonb not null, archived_at timestamptz not null default now()
);
alter table public.accountant_company_responsible_archive enable row level security;
revoke all on public.accountant_company_responsible_archive from anon, authenticated;
do $$
declare a record; r jsonb; snapshot jsonb; mapping jsonb := '{"responsible_name":"nome","responsible_document":"cpf","responsible_rg":"rg","address":"endereco","number":"numero","complement":"complemento","neighborhood":"bairro","city":"cidade","state":"uf","postal_code":"cep"}'; k text; suffix text; matches boolean;
begin
  for a in select acc.id, to_jsonb(acc) as fields, comp.source_payload
    from public.crm_accountants acc join public.crm_accountant_clients link on link.accountant_id=acc.id
    join public.client_companies comp on comp.id::text=link.client_company_id
    where acc.notes like 'Responsável: %'
    order by acc.id, comp.id
  loop
    r := coalesce(a.source_payload->'tcl_responsavel', a.source_payload->'cli_responsavel', '{}'::jsonb);
    if jsonb_typeof(r)='string' then begin r := (r#>>'{}')::jsonb; exception when others then continue; end; end if;
    if a.fields->>'notes' <> 'Responsável: ' || coalesce(r->>'cli_res_nome',r->>'tcl_res_nome','') then continue; end if;
    matches := true; snapshot := '{}'::jsonb;
    for k,suffix in select key,value from jsonb_each_text(mapping) loop
      snapshot := snapshot || jsonb_build_object(k,a.fields->k);
      if nullif(a.fields->>k,'') is not null and coalesce(a.fields->>k,'') <> coalesce(nullif(r->>('cli_res_' || suffix),''),r->>('tcl_res_' || suffix),'') then matches := false; end if;
    end loop;
    if matches then
      insert into public.accountant_company_responsible_archive(accountant_id,previous_data)
        values(a.id,snapshot || jsonb_build_object('notes',a.fields->'notes')) on conflict do nothing;
      update public.crm_accountants set responsible_name=null,responsible_document=null,responsible_rg=null,
        address=null,number=null,complement=null,neighborhood=null,city=null,state=null,postal_code=null,notes=null
        where id=a.id;
    end if;
  end loop;
end $$;
