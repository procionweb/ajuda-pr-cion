create or replace function public.get_hadron_occurrence_open_stats()
returns table (option_legacy_id text, occurrence_count bigint, first_occurrence timestamptz)
language sql stable security definer set search_path = public
as $$
  select occurrence.option_legacy_id, count(*), min(occurrence.occurred_at)
  from public.hadron_occurrences occurrence
  where occurrence.kind = 'ocorrencia'
    and occurrence.solved_at is null
  group by occurrence.option_legacy_id;
$$;

grant execute on function public.get_hadron_occurrence_open_stats() to authenticated;

