create table if not exists public.crm_accountants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  office text,
  document text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.crm_accountant_clients (
  accountant_id uuid not null references public.crm_accountants(id) on delete cascade,
  client_company_id text not null,
  created_at timestamptz not null default now(),
  primary key (accountant_id, client_company_id)
);
alter table public.crm_accountants enable row level security;
alter table public.crm_accountant_clients enable row level security;
create policy crm_accountants_read on public.crm_accountants for select to authenticated using (true);
create policy crm_accountants_write on public.crm_accountants for all to authenticated using (public.is_auth_s_admin()) with check (public.is_auth_s_admin());
create policy crm_accountant_clients_read on public.crm_accountant_clients for select to authenticated using (true);
create policy crm_accountant_clients_write on public.crm_accountant_clients for all to authenticated using (public.is_auth_s_admin()) with check (public.is_auth_s_admin());
