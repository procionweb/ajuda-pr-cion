create sequence if not exists public.hadron_occurrence_id_seq;

select setval(
  'public.hadron_occurrence_id_seq',
  greatest(coalesce((select max(id) from public.hadron_occurrences), 0) + 1, 1),
  false
);

alter table public.hadron_occurrences
  alter column id set default nextval('public.hadron_occurrence_id_seq');

create or replace function public.create_hadron_occurrence(
  p_option_legacy_id text,
  p_kind text,
  p_occurrence text,
  p_operator text,
  p_base_address text,
  p_version_legacy_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_operator text;
begin
  v_operator := upper(trim(coalesce(p_operator, '')));
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  if trim(coalesce(p_option_legacy_id, '')) = '' then raise exception 'Opção não informada.'; end if;
  if trim(coalesce(p_occurrence, '')) = '' then raise exception 'Descreva a ocorrência.'; end if;
  if trim(coalesce(p_base_address, '')) = '' then raise exception 'Informe o cliente ou caminho da base.'; end if;

  insert into public.hadron_occurrences (
    option_legacy_id, kind, occurrence_text, reporter, occurred_at, status,
    modified_by, version_legacy_id, base_address, test_base,
    source_created_at, source_modified_at
  ) values (
    trim(p_option_legacy_id), lower(trim(coalesce(p_kind, 'ocorrencia'))),
    trim(p_occurrence), v_operator, now(),
    case when lower(trim(coalesce(p_kind, 'ocorrencia'))) = 'ocorrencia' then '4' else null end,
    v_operator,
    nullif(trim(coalesce(p_version_legacy_id, '')), ''), trim(p_base_address),
    trim(p_base_address), now(), now()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_hadron_occurrence(text, text, text, text, text, text) from public;
grant execute on function public.create_hadron_occurrence(text, text, text, text, text, text) to authenticated;
