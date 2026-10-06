-- Contatos comerciais podem ainda não ter CNPJ. Valores existentes são preservados.
alter table public.company_leads alter column cnpj drop not null;
