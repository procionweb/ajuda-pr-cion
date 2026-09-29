create or replace function public.delete_kanban_card_as_admin(target_card_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target_board_id uuid;
  allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select col.board_id into target_board_id
  from public.kanban_cards card
  join public.kanban_columns col on col.id = card.column_id
  where card.id = target_card_id;
  if target_board_id is null then return false; end if;

  select exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.active and profile.role = 'admin'
  ) or exists (
    select 1 from public.kanban_board_members member
    where member.board_id = target_board_id and member.profile_id = auth.uid() and member.role = 'admin'
  ) or exists (
    select 1 from public.kanban_boards board
    where board.id = target_board_id and board.owner_id = auth.uid()
  ) into allowed;

  if not allowed then
    raise exception 'Only administrators may delete cards' using errcode = '42501';
  end if;

  delete from public.kanban_cards where id = target_card_id;
  return true;
end;
$$;

revoke all on function public.delete_kanban_card_as_admin(uuid) from public, anon;
grant execute on function public.delete_kanban_card_as_admin(uuid) to authenticated;
