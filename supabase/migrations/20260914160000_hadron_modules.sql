begin;
create table public.hadron_modules (
  id text primary key check (id ~ '^[0-9]+$'),
  nome text not null check (length(trim(nome)) > 0)
);
create table public.hadron_submodules (
  id text not null check (id ~ '^[0-9]+$'),
  id_modulo text not null references public.hadron_modules(id),
  nome text not null check (length(trim(nome)) > 0),
  primary key (id_modulo, id)
);
alter table public.hadron_modules enable row level security;
alter table public.hadron_submodules enable row level security;
create policy hadron_modules_staff on public.hadron_modules for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy hadron_submodules_staff on public.hadron_submodules for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, insert, update on public.hadron_modules, public.hadron_submodules to authenticated;
commit;
