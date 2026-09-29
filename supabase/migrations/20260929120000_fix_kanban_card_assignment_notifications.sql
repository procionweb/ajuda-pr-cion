create or replace function public.notify_kanban_card_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  member_key text;
  member_id uuid;
  board_id uuid;
  added boolean;
begin
  select column_record.board_id into board_id
  from public.kanban_columns column_record
  where column_record.id = case when tg_op = 'INSERT' then new.column_id else old.column_id end;
  if board_id is null then return null; end if;

  for member_key in
    select distinct value #>> '{}'
    from jsonb_array_elements(
      case when tg_op = 'INSERT' then coalesce(new.member_legacy_ids, '[]'::jsonb)
      else coalesce(new.member_legacy_ids, '[]'::jsonb) || coalesce(old.member_legacy_ids, '[]'::jsonb) end
    ) value
    where jsonb_typeof(value) = 'string'
  loop
    added := coalesce(new.member_legacy_ids, '[]'::jsonb) ? member_key;
    if tg_op = 'UPDATE' and added = (coalesce(old.member_legacy_ids, '[]'::jsonb) ? member_key) then
      continue;
    end if;

    select profile.id into member_id
    from public.profiles profile
    where profile.id::text = member_key or profile.operator_code = member_key
    limit 1;
    if member_id is null then continue; end if;

    insert into public.notifications(profile_id, title, body, link)
    values (
      member_id,
      case when added then 'Você foi adicionado a um cartão' else 'Você foi removido de um cartão' end,
      new.title,
      '/kanban/' || board_id
    );
  end loop;
  return null;
end;
$$;
