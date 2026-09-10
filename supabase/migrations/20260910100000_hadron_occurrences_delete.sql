drop policy if exists hadron_occurrences_authenticated_delete on public.hadron_occurrences;
create policy hadron_occurrences_authenticated_delete
  on public.hadron_occurrences for delete to authenticated
  using (true);
