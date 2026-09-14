create or replace function public.get_hadron_overview()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'general', coalesce((select jsonb_agg(to_jsonb(t)) from (select * from public.hadron_occurrences order by occurred_at desc nulls last, id desc limit 12) t), '[]'::jsonb),
    'review', coalesce((select jsonb_agg(to_jsonb(t)) from (select * from public.hadron_occurrences where kind='ocorrencia' and solved_at is not null and reviewed_at is null order by solved_at desc, id desc limit 12) t), '[]'::jsonb),
    'options', coalesce((select jsonb_agg(to_jsonb(t)) from (select option_legacy_id, count(*) as count from public.hadron_occurrences where kind='ocorrencia' and solved_at is null and reviewed_at is null group by option_legacy_id) t), '[]'::jsonb),
    'operators', coalesce((select jsonb_agg(to_jsonb(t)) from (select reporter, count(*) as count from public.hadron_occurrences where kind='ocorrencia' and solved_at is null and reviewed_at is null group by reporter order by count(*) desc limit 6) t), '[]'::jsonb),
    'total', (select count(*) from public.hadron_occurrences),
    'reviewTotal', (select count(*) from public.hadron_occurrences where kind='ocorrencia' and solved_at is not null and reviewed_at is null)
  );
$$;
revoke all on function public.get_hadron_overview() from public;
grant execute on function public.get_hadron_overview() to authenticated;
