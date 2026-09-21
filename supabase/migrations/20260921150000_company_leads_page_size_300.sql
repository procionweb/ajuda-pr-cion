do $migration$
declare
  function_sql text;
  previous_limit constant text := 'limit_value integer := least(greatest(coalesce(p_limit, 50), 1), 100);';
  new_limit constant text := 'limit_value integer := least(greatest(coalesce(p_limit, 50), 1), 300);';
begin
  select pg_get_functiondef(
    'public.company_leads_search(jsonb,text,text,integer,integer)'::regprocedure
  ) into function_sql;

  if position(previous_limit in function_sql) > 0 then
    execute replace(function_sql, previous_limit, new_limit);
  elsif position(new_limit in function_sql) = 0 then
    raise exception 'Não foi possível localizar o limite de company_leads_search.';
  end if;
end
$migration$;
