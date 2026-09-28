create or replace function public.get_my_kanban_task_progress()
returns table(completed bigint, total bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where lower(col.name) ~ '(conclu[ií]d|finalizad|feito|done)') as completed,
    count(*) as total
  from public.kanban_cards card
  join public.kanban_columns col on col.id = card.column_id
  join public.kanban_boards board on board.id = col.board_id
  join public.profiles profile on profile.id = auth.uid()
  where not card.archived and not col.archived and not board.archived
    and (
      card.member_legacy_ids ? profile.id::text
      or (profile.operator_code is not null and card.member_legacy_ids ? profile.operator_code)
      or exists (select 1 from public.kanban_card_members member
        where member.card_id = card.id and member.profile_id = profile.id)
    );
$$;

revoke all on function public.get_my_kanban_task_progress() from public;
grant execute on function public.get_my_kanban_task_progress() to authenticated;
