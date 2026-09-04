create table if not exists public.hadron_occurrence_reviews (
  id uuid primary key default gen_random_uuid(),
  occurrence_id text not null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewer_operator text not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (occurrence_id, reviewer_id)
);

alter table public.hadron_occurrence_reviews enable row level security;

create policy "Users can read their Hadron reviews" on public.hadron_occurrence_reviews
  for select to authenticated using (reviewer_id = auth.uid());
create policy "Users can create their Hadron reviews" on public.hadron_occurrence_reviews
  for insert to authenticated with check (reviewer_id = auth.uid());
create policy "Users can update their Hadron reviews" on public.hadron_occurrence_reviews
  for update to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

create index if not exists hadron_occurrence_reviews_reviewer_idx
  on public.hadron_occurrence_reviews (reviewer_id, reviewed_at desc);
