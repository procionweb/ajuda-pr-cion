create table if not exists public.ticket_diagnosis_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol text,
  subject text not null default '',
  description text not null default '',
  module text not null default '',
  diagnosis jsonb not null,
  confidence text not null check (confidence in ('baixa', 'media', 'alta')),
  feedback text check (feedback in ('resolved', 'not_resolved')),
  feedback_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ticket_diagnosis_runs_ticket_idx
  on public.ticket_diagnosis_runs (ticket_id, created_at desc);

create index if not exists ticket_diagnosis_runs_feedback_idx
  on public.ticket_diagnosis_runs (feedback, feedback_at desc)
  where feedback is not null;

alter table public.ticket_diagnosis_runs enable row level security;

drop policy if exists "Authenticated users can read diagnosis runs" on public.ticket_diagnosis_runs;
create policy "Authenticated users can read diagnosis runs"
  on public.ticket_diagnosis_runs for select
  to authenticated
  using (true);

drop policy if exists "Users can update own diagnosis feedback" on public.ticket_diagnosis_runs;
create policy "Users can update own diagnosis feedback"
  on public.ticket_diagnosis_runs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

