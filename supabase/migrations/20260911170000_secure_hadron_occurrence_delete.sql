drop policy if exists hadron_occurrences_authenticated_delete on public.hadron_occurrences;

create or replace function public.delete_hadron_occurrence(p_occurrence_id bigint)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_department text;
  v_occurrence public.hadron_occurrences%rowtype;
begin
  select lower(trim(coalesce(c.clb_departamento, u.raw_user_meta_data ->> 'departamento', '')))
  into v_department
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  where u.id = auth.uid()
  limit 1;

  if coalesce(v_department, '') not in ('admin', 'development') then
    raise exception 'Apenas Administração ou Desenvolvimento pode remover ocorrências.';
  end if;

  select * into v_occurrence
  from public.hadron_occurrences
  where id = p_occurrence_id
  for update;

  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  if v_occurrence.reviewed_at is not null then raise exception 'Uma ocorrência revisada não pode ser removida.'; end if;
  if v_occurrence.approved_at is not null then raise exception 'Uma ocorrência aprovada não pode ser removida.'; end if;

  delete from public.hadron_occurrences where id = p_occurrence_id;
end;
$$;

revoke all on function public.delete_hadron_occurrence(bigint) from public;
grant execute on function public.delete_hadron_occurrence(bigint) to authenticated;
