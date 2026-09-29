create or replace function public.dedupe_kanban_membership_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.title in (
    'Você foi adicionado a uma área', 'Você foi removido de uma área',
    'Você foi adicionado a um quadro', 'Você foi removido de um quadro'
  ) and exists (
    select 1 from public.notifications previous
    where previous.profile_id = new.profile_id
      and previous.title = new.title
      and previous.body is not distinct from new.body
      and previous.created_at > now() - interval '10 seconds'
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists dedupe_kanban_membership_notification on public.notifications;
create trigger dedupe_kanban_membership_notification before insert on public.notifications
for each row execute function public.dedupe_kanban_membership_notification();

create or replace function public.notify_kanban_board_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  board_name text;
  board_owner uuid;
  member_id uuid;
  action_name text;
  board_uuid uuid;
begin
  board_uuid := case when tg_op = 'INSERT' then new.board_id else old.board_id end;
  member_id := case when tg_op = 'INSERT' then new.profile_id else old.profile_id end;
  action_name := case when tg_op = 'INSERT' then 'adicionado' else 'removido' end;
  select name, owner_id into board_name, board_owner from public.kanban_boards where id = board_uuid;
  if board_name is null or (tg_op = 'INSERT' and member_id = board_owner) then
    return null;
  end if;
  insert into public.notifications(profile_id, title, body, link)
  values (member_id, 'Você foi ' || action_name || ' de um quadro', board_name, '/kanban/' || board_uuid);
  return null;
end;
$$;

drop trigger if exists notify_kanban_board_membership on public.kanban_board_members;
create trigger notify_kanban_board_membership after insert or delete on public.kanban_board_members
for each row execute function public.notify_kanban_board_membership();

create or replace function public.notify_kanban_workspace_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  workspace_name text;
  workspace_owner uuid;
  member_id uuid;
  action_name text;
  workspace_uuid uuid;
begin
  workspace_uuid := case when tg_op = 'INSERT' then new.workspace_id else old.workspace_id end;
  member_id := case when tg_op = 'INSERT' then new.profile_id else old.profile_id end;
  action_name := case when tg_op = 'INSERT' then 'adicionado' else 'removido' end;
  select name, owner_id into workspace_name, workspace_owner from public.kanban_workspaces where id = workspace_uuid;
  if workspace_name is null or (tg_op = 'INSERT' and member_id = workspace_owner) then
    return null;
  end if;
  insert into public.notifications(profile_id, title, body, link)
  values (member_id, 'Você foi ' || action_name || ' de uma área', workspace_name, '/kanban');
  return null;
end;
$$;

drop trigger if exists notify_kanban_workspace_membership on public.kanban_workspace_members;
create trigger notify_kanban_workspace_membership after insert or delete on public.kanban_workspace_members
for each row execute function public.notify_kanban_workspace_membership();
