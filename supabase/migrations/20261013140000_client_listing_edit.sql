-- Informações adicionais restritas a usuários autenticados.
create or replace function public.get_crm_client_listing_context()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('acronym',c.acronym,'id',c.id,
 'source',jsonb_build_object('created',coalesce(c.crm_created_at::text,c.source_payload->>'created'),'modified',coalesce(c.crm_updated_at::text,c.source_payload->>'modified'),'cli_data_cadastro',c.source_payload->>'cli_data_cadastro','cli_inicio_nfe',c.source_payload->>'cli_inicio_nfe','cli_status',c.source_payload->>'cli_status','cli_aviso',c.source_payload->>'cli_aviso','cli_msg_hadron',c.source_payload->>'cli_msg_hadron'),
 'companies',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'legal_name',e.legal_name,'trade_name',e.trade_name,'document',e.document,'industry',e.industry,'size',e.size,'city',e.city,'state',e.state,'postal_code',e.postal_code,'company_number',e.company_number,'active',e.active,'modules',e.source_payload->'tcl_modulos','billing',e.source_payload->'tcl_boleto_dados') order by e.company_number,e.id) from client_companies e where e.client_id=c.id),'[]'::jsonb),
 'commercialId',(select l.id from company_leads l where l.cnpj in (nullif(c.document,''),nullif(regexp_replace(c.document,'[^0-9]','','g'),'')) order by l.updated_at desc limit 1)
 ) order by c.acronym),'[]'::jsonb) from clients c);
end;
$$;
revoke all on function public.get_crm_client_listing_context() from public,anon;
grant execute on function public.get_crm_client_listing_context() to authenticated;

create or replace function public.can_edit_crm_clients()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.get_current_portal_access() where portal_profile='s_admin' or collaborator_department in ('admin','commercial'));
$$;
revoke all on function public.can_edit_crm_clients() from public;
grant execute on function public.can_edit_crm_clients() to authenticated;

create or replace function public.get_crm_client_edit_data(p_acronym text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c clients;
begin
 if not public.can_edit_crm_clients() then raise exception 'Sem permissão para editar clientes.' using errcode='42501'; end if;
 select * into c from clients where upper(acronym)=upper(trim(p_acronym));
 if not found then raise exception 'Cliente não encontrado.'; end if;
 return jsonb_build_object('client',to_jsonb(c),'companies',coalesce((select jsonb_agg(to_jsonb(e) order by company_number,id) from client_companies e where client_id=c.id),'[]'::jsonb),'contacts',coalesce((select jsonb_agg(to_jsonb(e) order by name,id) from client_contacts e where client_id=c.id),'[]'::jsonb));
end;
$$;
revoke all on function public.get_crm_client_edit_data(text) from public;
grant execute on function public.get_crm_client_edit_data(text) to authenticated;

create table if not exists public.crm_client_edit_audit(id uuid primary key default gen_random_uuid(),client_id uuid not null,company_id uuid,actor_id uuid,occurred_at timestamptz not null default now(),before_data jsonb not null,after_data jsonb not null);
alter table public.crm_client_edit_audit enable row level security;

create or replace function public.save_crm_client_edit(p_acronym text,p_company_id uuid,p_patch jsonb,p_source_patch jsonb default '{}'::jsonb,p_contacts jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare c clients; e client_companies; next_client clients; next_company client_companies; item jsonb; before_json jsonb; after_json jsonb;
begin
 if not public.can_edit_crm_clients() then raise exception 'Sem permissão para editar clientes.' using errcode='42501'; end if;
 select * into c from clients where upper(acronym)=upper(trim(p_acronym)) for update;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 if jsonb_typeof(p_patch)<>'object' or jsonb_typeof(p_source_patch)<>'object' then raise exception 'Dados inválidos.'; end if;
 if p_company_id is null then
   before_json:=to_jsonb(c);
   next_client:=jsonb_populate_record(c,p_patch-'id'-'acronym'-'legacy_id'-'source_payload');
   if nullif(trim(next_client.name),'') is null or nullif(trim(next_client.legal_name),'') is null then raise exception 'Preencha nome e razão social.'; end if;
   update clients set name=next_client.name,legal_name=next_client.legal_name,trade_name=next_client.trade_name,group_acronym=next_client.group_acronym,
     document=next_client.document,industry=next_client.industry,size=next_client.size,city=next_client.city,state=next_client.state,postal_code=next_client.postal_code,
     address=next_client.address,address_number=next_client.address_number,address_complement=next_client.address_complement,neighborhood=next_client.neighborhood,
     primary_operator=next_client.primary_operator,secondary_operator=next_client.secondary_operator,website=next_client.website,state_registration=next_client.state_registration,
     municipal_registration=next_client.municipal_registration,cnae=next_client.cnae,tax_regime=next_client.tax_regime,active=next_client.active,
     source_payload=c.source_payload||p_source_patch,crm_updated_at=now() where id=c.id returning to_jsonb(clients.*) into after_json;
   if p_contacts is not null then
     if jsonb_typeof(p_contacts)<>'array' then raise exception 'Contatos inválidos.'; end if;
     for item in select value from jsonb_array_elements(p_contacts) loop
       update client_contacts set name=coalesce(nullif(trim(item->>'name'),''),name),department=item->>'department',email=item->>'email',phone=item->>'phone',mobile=item->>'mobile',whatsapp=item->>'whatsapp',updated_at=now() where id=(item->>'id')::uuid and client_id=c.id;
       if not found then raise exception 'Contato não pertence a este cliente.'; end if;
     end loop;
   end if;
 else
   select * into e from client_companies where id=p_company_id and client_id=c.id for update;
   if not found then raise exception 'Empresa não pertence a este cliente.'; end if;
   before_json:=to_jsonb(e);
   next_company:=jsonb_populate_record(e,p_patch-'id'-'client_id'-'legacy_key'-'source_payload');
   if nullif(trim(next_company.legal_name),'') is null then raise exception 'Preencha a razão social.'; end if;
   update client_companies set legal_name=next_company.legal_name,trade_name=next_company.trade_name,document=next_company.document,
     state_registration=next_company.state_registration,municipal_registration=next_company.municipal_registration,cnae=next_company.cnae,
     industry=next_company.industry,size=next_company.size,tax_regime=next_company.tax_regime,address=next_company.address,city=next_company.city,state=next_company.state,postal_code=next_company.postal_code,
     responsible_name=next_company.responsible_name,responsible_document=next_company.responsible_document,accountant_name=next_company.accountant_name,accountant_phone=next_company.accountant_phone,accountant_email=next_company.accountant_email,
     source_payload=e.source_payload||p_source_patch,updated_at=now() where id=e.id returning to_jsonb(client_companies.*) into after_json;
 end if;
 insert into crm_client_edit_audit(client_id,company_id,actor_id,before_data,after_data) values(c.id,p_company_id,auth.uid(),before_json,after_json);
end;
$$;
revoke all on function public.save_crm_client_edit(text,uuid,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_crm_client_edit(text,uuid,jsonb,jsonb,jsonb) to authenticated;
