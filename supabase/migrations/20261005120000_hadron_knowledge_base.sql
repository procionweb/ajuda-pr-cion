create table if not exists public.hadron_knowledge_options (
  id uuid primary key default gen_random_uuid(),
  option_number text not null,
  option_name text,
  module text,
  purpose text,
  fields jsonb not null default '[]'::jsonb,
  procedures jsonb not null default '[]'::jsonb,
  common_errors jsonb not null default '[]'::jsonb,
  related_options jsonb not null default '[]'::jsonb,
  compatible_versions jsonb not null default '[]'::jsonb,
  source_file text not null,
  source_hash text,
  source_path text,
  raw_strings jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  validation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_number, source_file)
);

create index if not exists hadron_knowledge_options_number_idx
  on public.hadron_knowledge_options (option_number);
create index if not exists hadron_knowledge_options_review_idx
  on public.hadron_knowledge_options (review_status, updated_at desc);

alter table public.hadron_knowledge_options enable row level security;

drop policy if exists hadron_knowledge_options_read on public.hadron_knowledge_options;
create policy hadron_knowledge_options_read on public.hadron_knowledge_options
  for select to authenticated
  using (true);

drop policy if exists hadron_knowledge_options_admin_insert on public.hadron_knowledge_options;
create policy hadron_knowledge_options_admin_insert on public.hadron_knowledge_options
  for insert to authenticated
  with check (public.is_auth_s_admin());

drop policy if exists hadron_knowledge_options_admin_update on public.hadron_knowledge_options;
create policy hadron_knowledge_options_admin_update on public.hadron_knowledge_options
  for update to authenticated
  using (public.is_auth_s_admin())
  with check (public.is_auth_s_admin());

drop policy if exists hadron_knowledge_options_admin_delete on public.hadron_knowledge_options;
create policy hadron_knowledge_options_admin_delete on public.hadron_knowledge_options
  for delete to authenticated
  using (public.is_auth_s_admin());
