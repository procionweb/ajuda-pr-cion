create index if not exists company_leads_state_opened_idx
  on public.company_leads (state, opened_at desc nulls last, id);

do $migration$
declare
  function_sql text;
  guard_start integer;
  guard_end integer;
  state_search_guard constant text := $guard$
  if company_name_value is null and cnpj_value is null then
    if state_value is null then
      raise exception 'Informe uma UF para pesquisar leads.';
    end if;

    where_text := format('lead.state = %L', state_value);
    if city_value is not null then
      where_text := where_text || format(
        ' and public.normalize_company_search(lead.city) = public.normalize_company_search(%L)',
        city_value
      );
    end if;
  else
    where_text := 'true';
  end if;
$guard$;
begin
  select pg_get_functiondef(
    'public.company_leads_search(jsonb,text,text,integer,integer)'::regprocedure
  ) into function_sql;

  guard_start := position('if company_name_value is null and cnpj_value is null then' in function_sql);
  guard_end := position('opened_from := ' in function_sql);
  if guard_start = 0 or guard_end <= guard_start then
    raise exception 'Não foi possível localizar a validação geográfica de company_leads_search.';
  end if;

  function_sql := left(function_sql, guard_start - 1)
    || state_search_guard
    || substr(function_sql, guard_end);
  function_sql := replace(function_sql,
    'where %s limit 5001) counted',
    'where %s) counted');
  function_sql := replace(function_sql,
    '''total_capped'', coalesce(total_count, 0) >= 5001',
    '''total_capped'', false');
  execute function_sql;
end
$migration$;
