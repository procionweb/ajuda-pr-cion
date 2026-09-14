begin;
alter table public.hadron_occurrences add column if not exists priority smallint not null default 1 check (priority between 0 and 2);
drop function if exists public.create_hadron_occurrence(text, text, text, text, text, text);
create or replace function public.create_hadron_occurrence(
  p_option_legacy_id text,
  p_kind text,
  p_occurrence text,
  p_operator text,
  p_base_address text,
  p_version_legacy_id text default null,
  p_priority smallint default 1
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
    source_created_at, source_modified_at, priority
  ) values (
    trim(p_option_legacy_id), lower(trim(coalesce(p_kind, 'ocorrencia'))),
    trim(p_occurrence), v_operator, now(),
    case when lower(trim(coalesce(p_kind, 'ocorrencia'))) = 'ocorrencia' then '4' else null end,
    v_operator,
    nullif(trim(coalesce(p_version_legacy_id, '')), ''), trim(p_base_address),
    trim(p_base_address), now(), now(), p_priority
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_hadron_occurrence(text, text, text, text, text, text, smallint) from public;
grant execute on function public.create_hadron_occurrence(text, text, text, text, text, text, smallint) to authenticated;


create or replace function public.set_hadron_occurrence_priority(p_id bigint, p_priority smallint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Acesso restrito à equipe interna.'; end if;
  if p_priority is null or p_priority not between 0 and 2 then raise exception 'Prioridade inválida.'; end if;
  update public.hadron_occurrences set priority=p_priority where id=p_id;
  if not found then raise exception 'Ocorrência não encontrada.'; end if;
end;
$$;
revoke all on function public.set_hadron_occurrence_priority(bigint,smallint) from public;
grant execute on function public.set_hadron_occurrence_priority(bigint,smallint) to authenticated;
commit;
