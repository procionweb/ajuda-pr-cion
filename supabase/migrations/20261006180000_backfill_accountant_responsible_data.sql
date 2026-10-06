update public.crm_accountants accountant
set responsible_name = coalesce(nullif(accountant.responsible_name, ''), source.responsible_name),
    responsible_document = coalesce(nullif(accountant.responsible_document, ''), source.responsible_document),
    responsible_rg = coalesce(nullif(accountant.responsible_rg, ''), source.responsible_rg)
from (
  select distinct on (link.accountant_id)
    link.accountant_id,
    coalesce(payload -> 'tcl_responsavel' ->> 'tcl_res_nome', payload -> 'tcl_responsavel' ->> 'cli_res_nome', payload -> 'cli_responsavel' ->> 'cli_res_nome') as responsible_name,
    coalesce(payload -> 'tcl_responsavel' ->> 'tcl_res_cpf', payload -> 'tcl_responsavel' ->> 'cli_res_cpf', payload -> 'cli_responsavel' ->> 'cli_res_cpf') as responsible_document,
    coalesce(payload -> 'tcl_responsavel' ->> 'tcl_res_rg', payload -> 'tcl_responsavel' ->> 'cli_res_rg', payload -> 'cli_responsavel' ->> 'cli_res_rg') as responsible_rg
  from public.crm_accountant_clients link
  join public.client_companies company on company.id = link.client_company_id
  cross join lateral (select coalesce(company.source_payload, '{}'::jsonb) as payload) raw
  order by link.accountant_id, company.created_at nulls last
) source
where accountant.id = source.accountant_id;
