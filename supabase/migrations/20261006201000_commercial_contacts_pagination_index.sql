-- Mantém a paginação comercial rápida sem incluir toda a base de prospecção.
create index if not exists company_leads_commercial_contacts_page_idx
on public.company_leads (discovered_at desc, id)
where stage <> 'novo' or source in ('crm-manual', 'crm-import');
