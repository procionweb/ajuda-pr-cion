create or replace function public.update_crm_accountant(p_id uuid,p_data jsonb,p_clients text[]) returns uuid language plpgsql security invoker set search_path=public as $$
begin
 update public.crm_accountants set name=p_data->>'name',office=p_data->>'office',document=p_data->>'document',phone=p_data->>'phone',email=p_data->>'email',notes=p_data->>'notes',responsible_name=p_data->>'responsible_name',responsible_document=p_data->>'responsible_document',responsible_rg=p_data->>'responsible_rg',address=p_data->>'address',number=p_data->>'number',complement=p_data->>'complement',neighborhood=p_data->>'neighborhood',city=p_data->>'city',state=p_data->>'state',postal_code=p_data->>'postal_code',updated_at=now() where id=p_id;
 if not found then raise exception 'Contador não encontrado ou sem permissão para editar.'; end if;
 delete from public.crm_accountant_clients where accountant_id=p_id and not(client_company_id=any(coalesce(p_clients,array[]::text[])));
 insert into public.crm_accountant_clients(accountant_id,client_company_id) select p_id,c from (select distinct unnest(coalesce(p_clients,array[]::text[])) as c) selected on conflict do nothing;
 return p_id;
end $$;
revoke all on function public.update_crm_accountant(uuid,jsonb,text[]) from public;
grant execute on function public.update_crm_accountant(uuid,jsonb,text[]) to authenticated;
