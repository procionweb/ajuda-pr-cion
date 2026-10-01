alter table public.ticket_diagnosis_runs
  add column if not exists actual_solution text,
  add column if not exists finalized_at timestamptz,
  add column if not exists review_status text not null default 'awaiting_finalization'
    check (review_status in ('awaiting_finalization', 'pending', 'approved', 'rejected')),
  add column if not exists reviewed_solution text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists ticket_diagnosis_runs_review_idx
  on public.ticket_diagnosis_runs (review_status, finalized_at desc);

create or replace function public.support_update_ticket(
  ticket_key text,
  patch jsonb,
  event_payload jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  target_ticket uuid;
  finalization jsonb;
  final_solution text;
begin
  select id into target_ticket from public.tickets
  where legacy_id = ticket_key or id::text = ticket_key limit 1;
  if target_ticket is null then raise exception 'Chamado não encontrado'; end if;

  update public.tickets set
    status = case when patch ? 'status' then public.support_status_to_db(patch->>'status') else status end,
    priority = case when patch ? 'priority' then public.support_priority_to_db(patch->>'priority') else priority end,
    attendant_code = case when patch ? 'attendant' then patch->>'attendant' else attendant_code end,
    owner_code = case when patch ? 'owner' then patch->>'owner' else owner_code end,
    locked_by_code = case
      when patch ? 'lockedBy' and nullif(patch->>'lockedBy', '') is null then null
      when patch ? 'lockedBy' then patch->>'lockedBy'
      else locked_by_code
    end,
    finished_at = case
      when patch->>'status' = 'Finalizado' and finished_at is null
        then coalesce((patch->>'closedAt')::timestamptz, now())
      else finished_at
    end,
    updated_at = now()
  where id = target_ticket;

  if event_payload is not null then
    insert into public.ticket_events(
      ticket_id, event_type, title, description, actor_code, actor_type, metadata
    ) values (
      target_ticket,
      coalesce(event_payload->>'kind', 'status'),
      coalesce(event_payload->>'title', 'Chamado atualizado'),
      event_payload->>'description',
      coalesce(event_payload->>'actor', 'Sistema'),
      coalesce(event_payload->>'actorType', 'sistema'),
      coalesce(event_payload->'metadata', '{}'::jsonb)
    );

    finalization := event_payload->'metadata'->'finalization';
    if finalization is not null and jsonb_typeof(finalization) = 'object' then
      final_solution := nullif(finalization->>'solutionHtml', '');
      if final_solution is not null then
        insert into public.ticket_finalizations(
          ticket_id, closing_type, solution_html, visibility, finalized_by, finalized_at
        ) values (
          target_ticket,
          coalesce(nullif(finalization->>'closingType', ''), 'Não definido'),
          final_solution,
          coalesce(nullif(finalization->>'visibility', ''), 'Clientes'),
          auth.uid(),
          coalesce((patch->>'closedAt')::timestamptz, now())
        ) on conflict (ticket_id) do update set
          closing_type = excluded.closing_type,
          solution_html = excluded.solution_html,
          visibility = excluded.visibility;

        update public.ticket_diagnosis_runs set
          actual_solution = final_solution,
          finalized_at = coalesce((patch->>'closedAt')::timestamptz, now()),
          review_status = 'pending'
        where ticket_id in (ticket_key, target_ticket::text)
          and review_status = 'awaiting_finalization';
      end if;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.support_update_ticket(text, jsonb, jsonb) from public;
grant execute on function public.support_update_ticket(text, jsonb, jsonb) to anon, authenticated;
