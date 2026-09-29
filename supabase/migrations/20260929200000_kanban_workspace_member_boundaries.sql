create or replace function public.validate_kanban_workspace_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = new.owner_id
      and profile.active = true
      and profile.role in ('admin', 's_admin')
  ) then
    raise exception 'Somente administradores gerais podem criar areas do Kanban.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_kanban_workspace_owner_admin on public.kanban_workspaces;
create trigger validate_kanban_workspace_owner_admin
before insert on public.kanban_workspaces
for each row execute function public.validate_kanban_workspace_owner_admin();

create or replace function public.validate_kanban_board_member_in_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  select board.workspace_id
    into target_workspace_id
    from public.kanban_boards board
   where board.id = new.board_id;

  if target_workspace_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.kanban_workspaces workspace
    where workspace.id = target_workspace_id
      and (
        workspace.owner_id = new.profile_id
        or exists (
          select 1
          from public.kanban_workspace_members member
          where member.workspace_id = target_workspace_id
            and member.profile_id = new.profile_id
        )
      )
  ) then
    raise exception 'O membro precisa pertencer a area antes de ser adicionado ao quadro.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_kanban_board_member_in_workspace on public.kanban_board_members;
create trigger validate_kanban_board_member_in_workspace
before insert or update of board_id, profile_id on public.kanban_board_members
for each row execute function public.validate_kanban_board_member_in_workspace();
