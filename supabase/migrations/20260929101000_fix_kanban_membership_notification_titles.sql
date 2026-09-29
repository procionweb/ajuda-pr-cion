create or replace function public.notify_kanban_board_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  board_name text;
  board_owner uuid;
  member_id uuid;
  notification_title text;
  board_uuid uuid;
begin
  board_uuid := case when tg_op = 'INSERT' then new.board_id else old.board_id end;
  member_id := case when tg_op = 'INSERT' then new.profile_id else old.profile_id end;
  notification_title := case when tg_op = 'INSERT'
    then 'Você foi adicionado a um quadro' else 'Você foi removido de um quadro' end;
  select name, owner_id into board_name, board_owner from public.kanban_boards where id = board_uuid;
  if board_name is null or (tg_op = 'INSERT' and member_id = board_owner) then
    return null;
  end if;
  insert into public.notifications(profile_id, title, body, link)
  values (member_id, notification_title, board_name, '/kanban/' || board_uuid);
  return null;
end;
$$;

create or replace function public.notify_kanban_workspace_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  workspace_name text;
  workspace_owner uuid;
  member_id uuid;
  notification_title text;
  workspace_uuid uuid;
begin
  workspace_uuid := case when tg_op = 'INSERT' then new.workspace_id else old.workspace_id end;
  member_id := case when tg_op = 'INSERT' then new.profile_id else old.profile_id end;
  notification_title := case when tg_op = 'INSERT'
    then 'Você foi adicionado a uma área' else 'Você foi removido de uma área' end;
  select name, owner_id into workspace_name, workspace_owner from public.kanban_workspaces where id = workspace_uuid;
  if workspace_name is null or (tg_op = 'INSERT' and member_id = workspace_owner) then
    return null;
  end if;
  insert into public.notifications(profile_id, title, body, link)
  values (member_id, notification_title, workspace_name, '/kanban');
  return null;
end;
$$;
