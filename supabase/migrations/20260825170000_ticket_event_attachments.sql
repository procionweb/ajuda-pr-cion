do $migration$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.support_load()'::regprocedure) into function_sql;
  function_sql := replace(
    function_sql,
    $find$'description', coalesce(e.description, e.title)$find$,
    $replace$'description', coalesce(e.description, e.title),
        'attachment', e.metadata->'attachment'$replace$
  );
  execute function_sql;
end
$migration$;

grant execute on function public.support_load() to anon, authenticated;
