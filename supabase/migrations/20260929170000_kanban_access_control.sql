create or replace function public.can_access_kanban_workspace(target_id uuid, require_admin boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin')
    or exists (
      select 1 from public.kanban_workspaces w
      where w.id = target_id and (
        w.owner_id = auth.uid()
        or exists (select 1 from public.kanban_workspace_members m
          where m.workspace_id = w.id and m.profile_id = auth.uid()
          and (not require_admin or m.role = 'admin'))
        or (not require_admin and w.visibility = 'company')
      )
    );
$$;

create or replace function public.can_access_kanban_board(target_id uuid, require_admin boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin')
    or exists (
      select 1 from public.kanban_boards b
      where b.id = target_id and (
        b.owner_id = auth.uid()
        or (b.workspace_id is not null and public.can_access_kanban_workspace(b.workspace_id, true))
        or (
          not require_admin
          and (b.workspace_id is null or public.can_access_kanban_workspace(b.workspace_id))
          and (b.visibility <> 'private' or exists (
            select 1 from public.kanban_board_members m
            where m.board_id = b.id and m.profile_id = auth.uid()
          ))
        )
        or exists (select 1 from public.kanban_board_members m
          where m.board_id = b.id and m.profile_id = auth.uid() and m.role = 'admin'
          and (b.workspace_id is null or public.can_access_kanban_workspace(b.workspace_id)))
      )
    );
$$;

drop policy if exists kanban_workspaces_staff on public.kanban_workspaces;
create policy kanban_workspaces_visible on public.kanban_workspaces for select to authenticated
  using (public.can_access_kanban_workspace(id));
create policy kanban_workspaces_managed on public.kanban_workspaces for update to authenticated
  using (public.can_access_kanban_workspace(id, true)) with check (public.can_access_kanban_workspace(id, true));

drop policy if exists kanban_workspace_members_staff on public.kanban_workspace_members;
create policy kanban_workspace_members_visible on public.kanban_workspace_members for select to authenticated
  using (public.can_access_kanban_workspace(workspace_id));
create policy kanban_workspace_members_managed on public.kanban_workspace_members for all to authenticated
  using (public.can_access_kanban_workspace(workspace_id, true))
  with check (public.can_access_kanban_workspace(workspace_id, true));

drop policy if exists boards_staff on public.kanban_boards;
create policy kanban_boards_visible on public.kanban_boards for select to authenticated
  using (public.can_access_kanban_board(id));
create policy kanban_boards_managed on public.kanban_boards for update to authenticated
  using (public.can_access_kanban_board(id, true)) with check (public.can_access_kanban_board(id, true));
create policy kanban_boards_deleted on public.kanban_boards for delete to authenticated
  using (public.can_access_kanban_board(id, true));

drop policy if exists columns_staff on public.kanban_columns;
create policy kanban_columns_visible on public.kanban_columns for select to authenticated
  using (public.can_access_kanban_board(board_id));
create policy kanban_columns_changed on public.kanban_columns for all to authenticated
  using (public.can_access_kanban_board(board_id)) with check (public.can_access_kanban_board(board_id));

drop policy if exists cards_staff on public.kanban_cards;
create policy kanban_cards_visible on public.kanban_cards for select to authenticated
  using (exists (select 1 from public.kanban_columns col where col.id = column_id
    and public.can_access_kanban_board(col.board_id)));
create policy kanban_cards_inserted on public.kanban_cards for insert to authenticated
  with check (exists (select 1 from public.kanban_columns col where col.id = column_id
    and public.can_access_kanban_board(col.board_id)));
create policy kanban_cards_updated on public.kanban_cards for update to authenticated
  using (exists (select 1 from public.kanban_columns col where col.id = column_id
    and public.can_access_kanban_board(col.board_id)))
  with check (exists (select 1 from public.kanban_columns col where col.id = column_id
    and public.can_access_kanban_board(col.board_id)));
create policy kanban_cards_deleted on public.kanban_cards for delete to authenticated
  using (exists (select 1 from public.kanban_columns col where col.id = column_id
    and public.can_access_kanban_board(col.board_id, true)));

alter table public.kanban_board_members enable row level security;
create policy kanban_board_members_visible on public.kanban_board_members for select to authenticated
  using (public.can_access_kanban_board(board_id));
create policy kanban_board_members_managed on public.kanban_board_members for all to authenticated
  using (public.can_access_kanban_board(board_id, true))
  with check (public.can_access_kanban_board(board_id, true));

alter table public.kanban_card_members enable row level security;
create policy kanban_card_members_visible on public.kanban_card_members for select to authenticated
  using (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and public.can_access_kanban_board(col.board_id)));
create policy kanban_card_members_managed on public.kanban_card_members for all to authenticated
  using (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and (card.created_by = auth.uid() or public.can_access_kanban_board(col.board_id, true))))
  with check (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and (card.created_by = auth.uid() or public.can_access_kanban_board(col.board_id, true))));

alter table public.kanban_checklist_items enable row level security;
create policy kanban_checklist_visible on public.kanban_checklist_items for select to authenticated
  using (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and public.can_access_kanban_board(col.board_id)));
alter table public.kanban_comments enable row level security;
create policy kanban_comments_visible on public.kanban_comments for select to authenticated
  using (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and public.can_access_kanban_board(col.board_id)));
drop policy if exists kanban_card_attachments_staff on public.kanban_card_attachments;
create policy kanban_card_attachments_visible on public.kanban_card_attachments for select to authenticated
  using (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and public.can_access_kanban_board(col.board_id)));
drop policy if exists kanban_card_trello_members_staff on public.kanban_card_trello_members;
create policy kanban_card_trello_members_visible on public.kanban_card_trello_members for select to authenticated
  using (exists (select 1 from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
    where card.id = card_id and public.can_access_kanban_board(col.board_id)));

create or replace function public.guard_kanban_card_members()
returns trigger language plpgsql set search_path = public as $$
declare target_board_id uuid;
begin
  if tg_op = 'UPDATE' and new.member_legacy_ids is not distinct from old.member_legacy_ids then return new; end if;
  if auth.uid() is null and current_setting('request.jwt.claim.role', true) = 'service_role' then return new; end if;
  select board_id into target_board_id from public.kanban_columns where id = new.column_id;
  if tg_op = 'UPDATE' and old.created_by = auth.uid() then return new; end if;
  if tg_op = 'INSERT' and auth.uid() is not null then return new; end if;
  if not public.can_access_kanban_board(target_board_id, true) then
    raise exception 'Only an administrator or card creator can change card members' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_kanban_card_members on public.kanban_cards;
create trigger guard_kanban_card_members before insert or update on public.kanban_cards
  for each row execute function public.guard_kanban_card_members();

alter function public.save_kanban_card_payload_v2(jsonb) rename to save_kanban_card_payload_v2_unchecked;
revoke all on function public.save_kanban_card_payload_v2_unchecked(jsonb) from public, anon, authenticated;
revoke all on function public.save_kanban_card_payload(jsonb) from public, anon, authenticated;

create function public.save_kanban_card_payload_v2(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_board_id uuid; existing_board_id uuid; card_creator uuid; existing_members jsonb;
begin
  select board_id into target_board_id from public.kanban_columns where id = (payload ->> 'columnId')::uuid;
  if target_board_id is null or not public.can_access_kanban_board(target_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  if nullif(payload ->> 'id', '') is not null then
    select col.board_id, card.created_by, card.member_legacy_ids
      into existing_board_id, card_creator, existing_members
      from public.kanban_cards card join public.kanban_columns col on col.id = card.column_id
      where card.id = (payload ->> 'id')::uuid;
    if existing_board_id is not null then
      if existing_board_id <> target_board_id and not public.can_access_kanban_board(existing_board_id) then
        raise exception 'Source board access denied' using errcode = '42501';
      end if;
      if coalesce(payload -> 'memberIds', '[]'::jsonb) is distinct from coalesce(existing_members, '[]'::jsonb)
         and card_creator is distinct from auth.uid()
         and not public.can_access_kanban_board(target_board_id, true) then
        raise exception 'Only an administrator or card creator can change card members' using errcode = '42501';
      end if;
    end if;
  end if;
  return public.save_kanban_card_payload_v2_unchecked(payload);
end;
$$;
revoke all on function public.save_kanban_card_payload_v2(jsonb) from public, anon;
grant execute on function public.save_kanban_card_payload_v2(jsonb) to authenticated;

alter function public.load_kanban_board_payload_v2(uuid) rename to load_kanban_board_payload_v2_unchecked;
revoke all on function public.load_kanban_board_payload_v2_unchecked(uuid) from public, anon, authenticated;
revoke all on function public.load_kanban_board_payload(uuid) from public, anon, authenticated;
create function public.load_kanban_board_payload_v2(target_board_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare board_payload jsonb; cards_with_creator jsonb;
begin
  if not public.can_access_kanban_board(target_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  board_payload := public.load_kanban_board_payload_v2_unchecked(target_board_id);
  select coalesce(jsonb_agg(item.card || jsonb_build_object('createdBy', stored.created_by) order by item.position), '[]'::jsonb)
    into cards_with_creator
    from jsonb_array_elements(coalesce(board_payload -> 'cards', '[]'::jsonb)) with ordinality as item(card, position)
    left join public.kanban_cards stored on stored.id = (item.card ->> 'id')::uuid;
  return jsonb_set(board_payload, '{cards}', cards_with_creator);
end;
$$;
revoke all on function public.load_kanban_board_payload_v2(uuid) from public, anon;
grant execute on function public.load_kanban_board_payload_v2(uuid) to authenticated;

create or replace function public.get_kanban_workspaces()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'name', w.name, 'slug', w.slug, 'description', w.description,
    'website', w.website, 'logoUrl', w.logo_url, 'visibility', w.visibility,
    'settings', w.settings,
    'membershipRole', case when w.owner_id = auth.uid() then 'admin' else coalesce(
      (select m.role from public.kanban_workspace_members m where m.workspace_id = w.id and m.profile_id = auth.uid()), 'member') end,
    'membersCount', (select count(*) from public.kanban_workspace_members m where m.workspace_id = w.id)
  ) order by w.created_at), '[]'::jsonb)
  from public.kanban_workspaces w where public.can_access_kanban_workspace(w.id);
$$;
revoke all on function public.get_kanban_workspaces() from public, anon;
grant execute on function public.get_kanban_workspaces() to authenticated;

create or replace function public.update_kanban_workspace(
  workspace_id uuid, workspace_name text, workspace_slug text, workspace_description text,
  workspace_website text, workspace_visibility text, workspace_settings jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_kanban_workspace(workspace_id, true) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  update public.kanban_workspaces set name = trim(workspace_name), slug = trim(workspace_slug),
    description = coalesce(trim(workspace_description), ''), website = coalesce(trim(workspace_website), ''),
    visibility = case when workspace_visibility = 'company' then 'company' else 'private' end,
    settings = coalesce(workspace_settings, settings), updated_at = now()
  where id = workspace_id;
end;
$$;
revoke all on function public.update_kanban_workspace(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.update_kanban_workspace(uuid, text, text, text, text, text, jsonb) to authenticated;

alter function public.copy_kanban_column_payload(uuid, text) rename to copy_kanban_column_payload_unchecked;
revoke all on function public.copy_kanban_column_payload_unchecked(uuid, text) from public, anon, authenticated;
create function public.copy_kanban_column_payload(source_column_id uuid, new_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target_board_id uuid;
begin
  select board_id into target_board_id from public.kanban_columns where id = source_column_id;
  if not public.can_access_kanban_board(target_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  return public.copy_kanban_column_payload_unchecked(source_column_id, new_name);
end;
$$;
revoke all on function public.copy_kanban_column_payload(uuid, text) from public, anon;
grant execute on function public.copy_kanban_column_payload(uuid, text) to authenticated;

alter function public.move_kanban_column_payload(uuid, uuid, integer) rename to move_kanban_column_payload_unchecked;
revoke all on function public.move_kanban_column_payload_unchecked(uuid, uuid, integer) from public, anon, authenticated;
create function public.move_kanban_column_payload(source_column_id uuid, destination_board_id uuid, destination_position integer)
returns void language plpgsql security definer set search_path = public as $$
declare source_board_id uuid;
begin
  select board_id into source_board_id from public.kanban_columns where id = source_column_id;
  if not public.can_access_kanban_board(source_board_id) or not public.can_access_kanban_board(destination_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  perform public.move_kanban_column_payload_unchecked(source_column_id, destination_board_id, destination_position);
end;
$$;
revoke all on function public.move_kanban_column_payload(uuid, uuid, integer) from public, anon;
grant execute on function public.move_kanban_column_payload(uuid, uuid, integer) to authenticated;

alter function public.move_all_kanban_cards(uuid, uuid) rename to move_all_kanban_cards_unchecked;
revoke all on function public.move_all_kanban_cards_unchecked(uuid, uuid) from public, anon, authenticated;
create function public.move_all_kanban_cards(source_column_id uuid, destination_column_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare source_board_id uuid; destination_board_id uuid;
begin
  select board_id into source_board_id from public.kanban_columns where id = source_column_id;
  select board_id into destination_board_id from public.kanban_columns where id = destination_column_id;
  if not public.can_access_kanban_board(source_board_id) or not public.can_access_kanban_board(destination_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  return public.move_all_kanban_cards_unchecked(source_column_id, destination_column_id);
end;
$$;
revoke all on function public.move_all_kanban_cards(uuid, uuid) from public, anon;
grant execute on function public.move_all_kanban_cards(uuid, uuid) to authenticated;

alter function public.sort_kanban_column_cards(uuid, text) rename to sort_kanban_column_cards_unchecked;
revoke all on function public.sort_kanban_column_cards_unchecked(uuid, text) from public, anon, authenticated;
create function public.sort_kanban_column_cards(target_column_id uuid, sort_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare target_board_id uuid;
begin
  select board_id into target_board_id from public.kanban_columns where id = target_column_id;
  if not public.can_access_kanban_board(target_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  perform public.sort_kanban_column_cards_unchecked(target_column_id, sort_mode);
end;
$$;
revoke all on function public.sort_kanban_column_cards(uuid, text) from public, anon;
grant execute on function public.sort_kanban_column_cards(uuid, text) to authenticated;
