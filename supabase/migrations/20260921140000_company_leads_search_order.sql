do $migration$
declare
  function_sql text;
  argument_marker constant text := 'matching_cnae_codes,' || E'\n    where_text,';
begin
  select pg_get_functiondef(
    'public.company_leads_search(jsonb,text,text,integer,integer)'::regprocedure
  ) into function_sql;

  if position('row_number() over (order by %s) as ordinality' in function_sql) = 0 then
    if position('row_number() over () as ordinality' in function_sql) = 0
       or position(argument_marker in function_sql) = 0 then
      raise exception 'Não foi possível localizar a ordenação de company_leads_search.';
    end if;

    function_sql := replace(function_sql,
      'row_number() over () as ordinality',
      'row_number() over (order by %s) as ordinality');
    function_sql := replace(function_sql,
      argument_marker,
      'matching_cnae_codes,' || E'\n    order_text,\n    where_text,');
  end if;

  function_sql := replace(function_sql,
    $old$when 'city' then 'lower(lead.city)'$old$,
    $new$when 'city' then 'public.normalize_company_search(lead.city)'$new$);
  function_sql := replace(function_sql,
    $old$when 'company' then 'lower(coalesce(nullif(lead.trade_name, ''''), lead.legal_name))'$old$,
    $new$when 'company' then 'public.normalize_company_search(coalesce(nullif(lead.trade_name, ''''), lead.legal_name))'$new$);
  execute function_sql;
end
$migration$;
