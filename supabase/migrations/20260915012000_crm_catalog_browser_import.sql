alter table public.crm_catalog_records drop constraint if exists crm_catalog_payload_identity;
alter table public.crm_catalog_records add constraint crm_catalog_payload_identity check (
  (entity = 'checklist' and jsonb_typeof(payload) = 'array' and coalesce(payload->>0,'') = record_id)
  or (entity <> 'checklist' and jsonb_typeof(payload) = 'object' and coalesce(payload->>'id','') = record_id)
);

create or replace function public.import_crm_catalog_records(p_entity text,p_changes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; existing public.crm_catalog_records;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 then raise exception 'Importacao invalida'; end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    select * into existing from public.crm_catalog_records where entity=p_entity and record_id=item->>'id' for update;
    if found then
      if existing.updated_by is not null or (existing.payload=item->'payload' and existing.deleted=coalesce((item->>'deleted')::boolean,false)) then continue; end if;
    else
      insert into public.crm_catalog_records(entity,record_id,payload)
        values(p_entity,item->>'id',item->'payload') on conflict do nothing;
      if not found then continue; end if;
    end if;
    perform public.save_crm_catalog_records(p_entity,jsonb_build_array(item));
  end loop;
end $$;
revoke all on function public.import_crm_catalog_records(text,jsonb) from public;
grant execute on function public.import_crm_catalog_records(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
