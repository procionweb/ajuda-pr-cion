alter table public.crm_catalog_records add constraint crm_catalog_payload_identity check (
  (entity = 'checklist' and jsonb_typeof(payload) = 'array' and payload->>0 = record_id)
  or (entity <> 'checklist' and jsonb_typeof(payload) = 'object' and payload->>'id' = record_id)
);
create unique index crm_catalog_serial_number_unique on public.crm_catalog_records ((payload->>'numero_serie'))
  where entity = 'serials' and not deleted;
create unique index crm_catalog_version_date_unique on public.crm_catalog_records ((payload->>'versao'),(payload->>'data_versao'))
  where entity = 'versions' and not deleted;
notify pgrst, 'reload schema';
