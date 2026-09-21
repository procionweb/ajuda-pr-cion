do $migration$
declare
  function_sql text;
  guard_start integer;
  guard_end integer;
  location_guard constant text := $guard$
  if company_name_value is null and cnpj_value is null then
    if state_value is null then
      raise exception 'Informe uma UF para pesquisar leads.';
    end if;
    where_text := format('lead.state = %L', state_value);
  else
    where_text := 'true';
    if city_value is not null and state_value is not null then
      where_text := where_text || format(' and lead.state = %L', state_value);
    end if;
  end if;

  if city_value is not null then
    where_text := where_text || format(
      ' and public.normalize_company_search(lead.city) = public.normalize_company_search(%L)',
      city_value
    );
  end if;
$guard$;
begin
  select pg_get_functiondef(
    'public.company_leads_search(jsonb,text,text,integer,integer)'::regprocedure
  ) into function_sql;

  guard_start := position('if company_name_value is null and cnpj_value is null then' in function_sql);
  guard_end := position('opened_from := ' in function_sql);
  if guard_start = 0 or guard_end <= guard_start then
    raise exception 'Não foi possível localizar a regra de localização de company_leads_search.';
  end if;

  execute left(function_sql, guard_start - 1)
    || location_guard
    || substr(function_sql, guard_end);
end
$migration$;
