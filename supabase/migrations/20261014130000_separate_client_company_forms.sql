-- Formulários distintos do CRM antigo e contatos independentes por canal.
create foreign table if not exists crm_mysql.client_edit_contracts (
 id_con bigint,con_cliente_sigla text,con_chave text,con_descricao text,con_status smallint,con_web_apps text,con_operador_mod text,created timestamp,modified timestamp
) server crm_auth_mysql options(table 'auth_contratos',rowid_column 'id_con');
revoke all on crm_mysql.client_edit_contracts from public,anon,authenticated;

create or replace function public.get_crm_client_edit_data_v2(p_acronym text,p_company_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; flags text; apps jsonb;
begin
 result:=public.get_crm_client_edit_data(p_acronym);
 if p_company_id is null then return result; end if;
 if not exists(select 1 from client_companies where id=p_company_id and client_id=(result->'client'->>'id')::uuid) then raise exception 'Empresa não pertence a este cliente.'; end if;
 select con_web_apps into flags from crm_mysql.client_edit_contracts where upper(con_cliente_sigla)=upper(trim(p_acronym)) order by (con_status=1) desc,id_con desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('type',a.app_type,'name',a.name) order by case a.app_type when 'MOB' then 1 when 'WEB' then 2 when 'B2C' then 3 when 'B2B' then 4 else 5 end),'[]'::jsonb) into apps from (select distinct app_type,name from auth_aplicativos) a;
 return result||jsonb_build_object('webApps',case when coalesce(flags,'')='' then '[]'::jsonb else flags::jsonb end,'applications',apps);
end;
$$;
revoke all on function public.get_crm_client_edit_data_v2(text,uuid) from public,anon;
grant execute on function public.get_crm_client_edit_data_v2(text,uuid) to authenticated;

create or replace function public.save_crm_client_edit_v2(p_acronym text,p_company_id uuid,p_patch jsonb,p_source_patch jsonb default '{}'::jsonb,p_contacts jsonb default null,p_web_apps jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare c clients; item jsonb; cid uuid; owner_id uuid; existing bigint; operator_code text; new_id bigint; new_key text;
begin
 if not public.can_edit_crm_clients() then raise exception 'Sem permissão para editar clientes.' using errcode='42501'; end if;
 select * into c from clients where upper(acronym)=upper(trim(p_acronym)) for update;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 if p_web_apps is not null then
   if p_company_id is null then raise exception 'Aplicações web pertencem ao formulário da empresa.'; end if;
   if jsonb_typeof(p_web_apps)<>'array' then raise exception 'Aplicações inválidas.'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_web_apps) code where not exists(select 1 from auth_aplicativos a where a.app_type=code)) then raise exception 'Aplicação web inválida.'; end if;
 end if;
 perform public.save_crm_client_edit(p_acronym,p_company_id,p_patch,p_source_patch,null);
 if p_contacts is not null then
   if p_company_id is not null or jsonb_typeof(p_contacts)<>'array' then raise exception 'Contatos pertencem ao formulário do cliente.'; end if;
   for item in select value from jsonb_array_elements(p_contacts) loop
     cid:=(item->>'id')::uuid;
     select client_id into owner_id from client_contacts where id=cid;
     if found and owner_id<>c.id then raise exception 'Contato não pertence a este cliente.'; end if;
     if coalesce((item->>'_delete')::boolean,false) then
       delete from client_contacts where id=cid and client_id=c.id;
     elsif nullif(trim(concat_ws('',item->>'phone',item->>'mobile',item->>'whatsapp',item->>'email')),'') is not null then
       insert into client_contacts(id,client_id,name,department,email,phone,mobile,whatsapp)
       values(cid,c.id,coalesce(nullif(trim(item->>'name'),''),'Sem contato'),item->>'department',item->>'email',item->>'phone',item->>'mobile',item->>'whatsapp')
       on conflict(id) do update set name=excluded.name,department=excluded.department,email=excluded.email,phone=excluded.phone,mobile=excluded.mobile,whatsapp=excluded.whatsapp,updated_at=now() where client_contacts.client_id=c.id;
       if not found then raise exception 'Contato não pertence a este cliente.'; end if;
     end if;
   end loop;
 end if;
 if p_web_apps is not null then
   select coalesce(operator_acronym,'PRC') into operator_code from get_current_portal_access();
   select id_con into existing from crm_mysql.client_edit_contracts where upper(con_cliente_sigla)=upper(c.acronym) order by (con_status=1) desc,id_con desc limit 1;
   if existing is null then
     perform pg_advisory_xact_lock(hashtextextended('crm-client-contract-insert',0));
     select coalesce(max(id_con),0)+1 into new_id from crm_mysql.client_edit_contracts;
     loop
       select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',1+(get_byte(decode(replace(gen_random_uuid()::text,'-',''),'hex'),i)%36),1),'') into new_key from generate_series(0,5) i;
       exit when not exists(select 1 from crm_mysql.client_edit_contracts where con_chave=new_key);
     end loop;
     insert into crm_mysql.client_edit_contracts(id_con,con_cliente_sigla,con_chave,con_descricao,con_status,con_web_apps,con_operador_mod,created,modified)
     values(new_id,c.acronym,new_key,c.name,1,p_web_apps::text,operator_code,now(),now());
   else
     update crm_mysql.client_edit_contracts set con_web_apps=p_web_apps::text,con_operador_mod=operator_code,modified=now() where id_con=existing;
   end if;
   insert into crm_client_edit_audit(client_id,company_id,actor_id,before_data,after_data)
   values(c.id,p_company_id,auth.uid(),jsonb_build_object('contract_id',existing),jsonb_build_object('web_apps',p_web_apps));
 end if;
end;
$$;
revoke all on function public.save_crm_client_edit_v2(text,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_crm_client_edit_v2(text,uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;
