create or replace function public.move_all_kanban_cards(
  source_column_id uuid, destination_column_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  source_board_id uuid;
  destination_board_id uuid;
  moved_count integer;
begin
  select board_id into source_board_id from public.kanban_columns
  where id = source_column_id and not archived;
  select board_id into destination_board_id from public.kanban_columns
  where id = destination_column_id and not archived;
  if source_board_id is null or destination_board_id is null or source_board_id <> destination_board_id then
    raise exception 'Invalid list destination';
  end if;
  if source_column_id = destination_column_id then return 0; end if;
  perform pg_advisory_xact_lock(hashtext(source_board_id::text));

  with destination_end as (
    select coalesce(max(position), -1) as last_position
    from public.kanban_cards where column_id = destination_column_id
  ), source_cards as (
    select id, row_number() over (order by position, id) as ordinal
    from public.kanban_cards where column_id = source_column_id and not archived
  )
  update public.kanban_cards card
  set column_id = destination_column_id,
      position = destination_end.last_position + source_cards.ordinal,
      updated_at = now()
  from source_cards, destination_end
  where card.id = source_cards.id;

  get diagnostics moved_count = row_count;
  return moved_count;
end;
$$;

create or replace function public.sort_kanban_column_cards(target_column_id uuid, sort_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
begin
  if sort_mode not in ('created_newest', 'created_oldest', 'name') then
    raise exception 'Invalid sort mode';
  end if;
  select board_id into target_board_id from public.kanban_columns
  where id = target_column_id and not archived;
  if target_board_id is null then raise exception 'List not found'; end if;
  perform pg_advisory_xact_lock(hashtext(target_board_id::text));

  with ordered as (
    select id, row_number() over (
      order by
        case when sort_mode = 'created_newest' then created_at end desc nulls last,
        case when sort_mode = 'created_oldest' then created_at end asc nulls last,
        case when sort_mode = 'name' then lower(title) end asc nulls last,
        id
    ) - 1 as next_position
    from public.kanban_cards
    where column_id = target_column_id and not archived
  )
  update public.kanban_cards card
  set position = ordered.next_position, updated_at = now()
  from ordered where card.id = ordered.id;
end;
$$;

revoke all on function public.move_all_kanban_cards(uuid, uuid) from public;
grant execute on function public.move_all_kanban_cards(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.sort_kanban_column_cards(uuid, text) from public;
grant execute on function public.sort_kanban_column_cards(uuid, text) to anon, authenticated, service_role;
