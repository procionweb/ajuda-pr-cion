drop policy if exists hadron_occurrences_authenticated_update on public.hadron_occurrences;
create policy hadron_occurrences_authenticated_update
  on public.hadron_occurrences for update to authenticated
  using (true)
  with check (true);
