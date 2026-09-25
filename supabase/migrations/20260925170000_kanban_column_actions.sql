create or replace function public.copy_kanban_column_payload(source_column_id uuid, new_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
  new_column_id uuid;
  source_card record;
  new_card_id uuid;
begin
  if nullif(trim(new_name), '') is null then
    raise exception 'List name is required';
  end if;

  select c.board_id into target_board_id from public.kanban_columns c where c.id = source_column_id and not c.archived;
  if target_board_id is null then raise exception 'List not found'; end if;
  perform pg_advisory_xact_lock(hashtext(target_board_id::text));

  insert into public.kanban_columns (board_id, name, position, color)
  select target_board_id, trim(new_name),
    (select coalesce(max(position), -1) + 1 from public.kanban_columns where board_id = target_board_id), color
  from public.kanban_columns where id = source_column_id
  returning id into new_column_id;

  for source_card in
    select * from public.kanban_cards where column_id = source_column_id and not archived order by position
  loop
    insert into public.kanban_cards (
      column_id, title, description, priority, due_at, position, archived,
      labels, member_legacy_ids, cover, source_payload
    ) values (
      new_column_id, source_card.title, source_card.description, source_card.priority,
      source_card.due_at, source_card.position, false, source_card.labels,
      source_card.member_legacy_ids, source_card.cover, source_card.source_payload
    ) returning id into new_card_id;

    insert into public.kanban_checklist_items (card_id, title, completed, position, checklist_title)
    select new_card_id, title, completed, position, checklist_title
    from public.kanban_checklist_items where card_id = source_card.id;
  end loop;

  return new_column_id;
end;
$$;

create or replace function public.move_kanban_column_payload(
  source_column_id uuid, destination_board_id uuid, destination_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_board_id uuid;
  ordered_ids uuid[];
  archived_ids uuid[];
  safe_position integer;
begin
  select board_id into source_board_id from public.kanban_columns
  where id = source_column_id and not archived;
  if source_board_id is null then raise exception 'List not found'; end if;
  if not exists (select 1 from public.kanban_boards where id = destination_board_id and not archived) then
    raise exception 'Destination board not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(least(source_board_id, destination_board_id)::text));
  if source_board_id <> destination_board_id then
    perform pg_advisory_xact_lock(hashtext(greatest(source_board_id, destination_board_id)::text));
  end if;

  select coalesce(array_agg(id order by position), '{}'::uuid[]) into ordered_ids
  from public.kanban_columns
  where board_id = destination_board_id and not archived and id <> source_column_id;
  select coalesce(array_agg(id order by position), '{}'::uuid[]) into archived_ids
  from public.kanban_columns where board_id = destination_board_id and archived;
  safe_position := least(greatest(coalesce(destination_position, 1), 1), cardinality(ordered_ids) + 1);
  ordered_ids := ordered_ids[1:safe_position - 1] || array[source_column_id] ||
    ordered_ids[safe_position:cardinality(ordered_ids)] || archived_ids;

  if source_board_id <> destination_board_id then
    update public.kanban_columns set board_id = destination_board_id, position = -2000000
    where id = source_column_id;
  end if;

  update public.kanban_columns c set position = -1000000 - numbered.ordinality
  from (
    select id, row_number() over (order by position, id) as ordinality
    from public.kanban_columns where board_id = destination_board_id
  ) numbered
  where c.id = numbered.id;

  update public.kanban_columns c set position = ordered.ordinality - 1
  from unnest(ordered_ids) with ordinality as ordered(id, ordinality)
  where c.id = ordered.id;
end;
$$;

revoke all on function public.copy_kanban_column_payload(uuid, text) from public;
grant execute on function public.copy_kanban_column_payload(uuid, text) to anon, authenticated, service_role;
revoke all on function public.move_kanban_column_payload(uuid, uuid, integer) from public;
grant execute on function public.move_kanban_column_payload(uuid, uuid, integer) to anon, authenticated, service_role;
