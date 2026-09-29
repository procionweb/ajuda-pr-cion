create or replace function public.notify_kanban_card_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  member_key text;
  member_id uuid;
  board_id uuid;
begin
  select column_record.board_id into board_id
  from public.kanban_columns column_record where column_record.id = new.column_id;
  if board_id is null then return null; end if;

  for member_key in
    select distinct value #>> '{}'
    from jsonb_array_elements(coalesce(new.member_legacy_ids, '[]'::jsonb)) value
    where jsonb_typeof(value) = 'string'
  loop
    if tg_op = 'UPDATE' and coalesce(old.member_legacy_ids, '[]'::jsonb) ? member_key then
      continue;
    end if;

    select profile.id into member_id
    from public.profiles profile
    where profile.id::text = member_key or profile.operator_code = member_key
    limit 1;
    if member_id is null or member_id = auth.uid() then continue; end if;

    insert into public.notifications(profile_id, title, body, link)
    values (member_id, 'Você foi adicionado a um cartão', new.title, '/kanban/' || board_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists notify_kanban_card_assignment on public.kanban_cards;
create trigger notify_kanban_card_assignment
after insert or update of member_legacy_ids on public.kanban_cards
for each row execute function public.notify_kanban_card_assignment();
