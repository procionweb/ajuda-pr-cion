create or replace function public.review_hadron_occurrence(p_occurrence_id bigint)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_occurrence public.hadron_occurrences%rowtype;
  v_operator text;
  v_department text;
  v_reviewed_at timestamptz := now();
begin
  select
    upper(trim(coalesce(c.operator_acronym, u.raw_user_meta_data ->> 'operator', ''))),
    lower(trim(coalesce(c.clb_departamento, u.raw_user_meta_data ->> 'departamento', '')))
  into v_operator, v_department
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  where u.id = auth.uid()
  limit 1;

  if coalesce(v_operator, '') = '' then
    raise exception 'Não foi possível identificar o operador atual.';
  end if;

  select * into v_occurrence
  from public.hadron_occurrences
  where id = p_occurrence_id
  for update;

  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  if v_occurrence.kind <> 'ocorrencia' then
    raise exception 'Apenas ocorrências podem ser revisadas.';
  end if;
  if upper(trim(coalesce(v_occurrence.reporter, ''))) <> v_operator and v_department <> 'admin' then
    raise exception 'Apenas quem abriu a ocorrência, ou um administrador, pode informar a revisão.';
  end if;
  if v_occurrence.solved_at is null then
    raise exception 'A ocorrência ainda não possui solução para revisar.';
  end if;
  if v_occurrence.reviewed_at is not null then
    raise exception 'Esta ocorrência já foi revisada.';
  end if;

  update public.hadron_occurrences
  set reviewed_at = v_reviewed_at,
      modified_by = v_operator,
      source_modified_at = v_reviewed_at
  where id = p_occurrence_id;

  return v_reviewed_at;
end;
$$;

revoke all on function public.review_hadron_occurrence(bigint) from public;
grant execute on function public.review_hadron_occurrence(bigint) to authenticated;
