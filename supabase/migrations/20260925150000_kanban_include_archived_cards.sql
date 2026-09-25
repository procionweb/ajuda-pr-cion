create or replace function public.load_kanban_board_payload(target_board_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'board', (
      select jsonb_build_object('id', b.id, 'name', b.name, 'description', coalesce(b.description, ''))
      from public.kanban_boards b
      where b.id = target_board_id and not b.archived
    ),
    'columns', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.name) order by c.position)
      from public.kanban_columns c
      where c.board_id = target_board_id and not c.archived
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'columnId', c.column_id,
          'title', c.title,
          'summary', coalesce(nullif(c.source_payload ->> 'summary', ''), split_part(coalesce(c.description, ''), E'\n', 1), 'Cartão importado do Trello'),
          'description', coalesce(c.description, ''),
          'client', coalesce(nullif(c.source_payload ->> 'client', ''), 'Interno'),
          'module', coalesce(nullif(c.source_payload ->> 'module', ''), 'Trello'),
          'priority', case c.priority when 'high' then 'Alta' when 'low' then 'Baixa' else 'Média' end,
          'type', coalesce(nullif(c.source_payload ->> 'type', ''), 'Melhoria'),
          'assigneeId', coalesce(c.member_legacy_ids ->> 0, ''),
          'participants', coalesce(c.member_legacy_ids, '[]'::jsonb),
          'dueDate', coalesce(case when coalesce(c.source_payload ->> 'dueTime', '') <> ''
            then to_char(c.due_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
            else to_char(c.due_at, 'YYYY-MM-DD') end, ''),
          'dueTime', coalesce(c.source_payload ->> 'dueTime', ''),
          'startDate', coalesce(c.source_payload ->> 'startDate', ''),
          'recurrence', coalesce(c.source_payload ->> 'recurrence', 'never'),
          'reminder', coalesce(c.source_payload ->> 'reminder', 'none'),
          'tagColors', coalesce((
            select jsonb_object_agg(label ->> 'name', case label ->> 'color'
              when 'green' then '#226e53' when 'yellow' then '#8c690a'
              when 'orange' then '#b8640d' when 'red' then '#b9352d'
              when 'purple' then '#773da2' when 'blue' then '#1f62b8'
              when 'sky' then '#0284c7' when 'pink' then '#be185d'
              else '#64748b' end)
            from jsonb_array_elements(coalesce(c.labels, '[]'::jsonb)) label
            where jsonb_typeof(label) = 'object' and label ? 'name'
          ), '{}'::jsonb) || coalesce(c.source_payload -> 'tagColors', '{}'::jsonb),
          'tags', coalesce((
            select jsonb_agg(case when jsonb_typeof(label) = 'string' then label #>> '{}' else coalesce(label ->> 'name', label ->> 'color') end)
            from jsonb_array_elements(coalesce(c.labels, '[]'::jsonb)) label
          ), '[]'::jsonb),
          'comments', coalesce(jsonb_array_length(c.source_payload -> 'commentsList'), 0),
          'attachments', coalesce(jsonb_array_length(c.source_payload -> 'attachmentsList'), 0),
          'archived', c.archived,
          'checklist', case
            when exists (select 1 from public.kanban_checklist_items i where i.card_id = c.id) then (
              select jsonb_agg(jsonb_build_object(
                'id', i.id,
                'text', i.title,
                'done', i.completed,
                'checklistTitle', coalesce(i.checklist_title, 'Checklist')
              ) order by i.position)
              from public.kanban_checklist_items i where i.card_id = c.id
            )
            else coalesce(c.source_payload -> 'checklist', '[]'::jsonb)
          end,
          'commentsList', coalesce(c.source_payload -> 'commentsList', '[]'::jsonb),
          'attachmentsList', coalesce(c.source_payload -> 'attachmentsList', '[]'::jsonb),
          'activity', coalesce(c.source_payload -> 'activity', '[]'::jsonb),
          'relatedArticles', coalesce(c.source_payload -> 'relatedArticles', '[]'::jsonb),
          'relatedVersions', coalesce(c.source_payload -> 'relatedVersions', '[]'::jsonb)
        ) order by c.position
      )
      from public.kanban_cards c
      join public.kanban_columns col on col.id = c.column_id
      where col.board_id = target_board_id and not col.archived
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.load_kanban_board_payload(uuid) from public;
grant execute on function public.load_kanban_board_payload(uuid) to anon, authenticated, service_role;
