alter table public.crm_accountants
  add column if not exists responsible_name text,
  add column if not exists responsible_document text,
  add column if not exists responsible_rg text;
