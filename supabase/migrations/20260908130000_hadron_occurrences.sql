create table if not exists public.hadron_occurrences (
  id bigint primary key,
  option_legacy_id text not null,
  kind text not null default 'ocorrencia',
  occurrence_html text not null default '',
  occurrence_text text not null default '',
  reporter text,
  occurred_at timestamptz,
  solution_html text not null default '',
  solution_text text not null default '',
  solver text,
  solved_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  modified_by text,
  operating_system text,
  test_base text,
  version_legacy_id text,
  parent_occurrence_id text,
  cobol_error text,
  status text,
  hadron_at timestamptz,
  base_address text,
  source_created_at timestamptz,
  source_modified_at timestamptz,
  imported_at timestamptz not null default now()
);

alter table public.hadron_occurrences enable row level security;

drop policy if exists "Authenticated users can read Hadron occurrences" on public.hadron_occurrences;
create policy "Authenticated users can read Hadron occurrences"
  on public.hadron_occurrences for select to authenticated using (true);

create index if not exists hadron_occurrences_option_idx
  on public.hadron_occurrences (option_legacy_id, occurred_at desc);
create index if not exists hadron_occurrences_kind_idx
  on public.hadron_occurrences (kind, occurred_at desc);
create index if not exists hadron_occurrences_reporter_idx
  on public.hadron_occurrences (reporter, occurred_at desc);
create index if not exists hadron_occurrences_status_idx
  on public.hadron_occurrences (status, occurred_at desc);

create or replace function public.get_hadron_occurrence_counts()
returns table (option_legacy_id text, occurrence_count bigint)
language sql stable security definer set search_path = public
as $$
  select occurrence.option_legacy_id, count(*)
  from public.hadron_occurrences occurrence
  group by occurrence.option_legacy_id;
$$;

grant execute on function public.get_hadron_occurrence_counts() to authenticated;

create or replace function public.get_hadron_occurrence_operators()
returns table (operator text)
language sql stable security definer set search_path = public
as $$
  select distinct value
  from (
    select reporter as value from public.hadron_occurrences
    union
    select solver as value from public.hadron_occurrences
  ) operators
  where value is not null and trim(value) <> ''
  order by value;
$$;

grant execute on function public.get_hadron_occurrence_operators() to authenticated;
