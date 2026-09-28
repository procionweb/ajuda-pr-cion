create or replace function public.save_kanban_card_payload_v2(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  saved_id uuid;
begin
  result := public.save_kanban_card_payload(payload);
  saved_id := (result ->> 'id')::uuid;

  update public.kanban_cards
     set source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object(
       'priorityLabel', coalesce(payload ->> 'priority', 'Média'),
       'relatedArticles', coalesce(payload -> 'relatedArticles', '[]'::jsonb),
       'relatedVersions', coalesce(payload -> 'relatedVersions', '[]'::jsonb),
       'tagColors', coalesce(payload -> 'tagColors', '{}'::jsonb),
       'startDate', coalesce(payload ->> 'startDate', ''),
       'dueTime', coalesce(payload ->> 'dueTime', ''),
       'recurrence', coalesce(payload ->> 'recurrence', 'never'),
       'reminder', coalesce(payload ->> 'reminder', 'none')
     )
   where id = saved_id;

  return result;
end;
$$;

create or replace function public.load_kanban_board_payload_v2(target_board_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  board_payload jsonb;
  updated_cards jsonb;
begin
  board_payload := public.load_kanban_board_payload(target_board_id);

  select coalesce(jsonb_agg(
    card || jsonb_build_object(
      'priority', coalesce(nullif(c.source_payload ->> 'priorityLabel', ''), card ->> 'priority')
    ) order by item.position
  ), '[]'::jsonb)
    into updated_cards
    from jsonb_array_elements(coalesce(board_payload -> 'cards', '[]'::jsonb)) with ordinality as item(card, position)
    left join public.kanban_cards c on c.id = (card ->> 'id')::uuid;

  return jsonb_set(board_payload, '{cards}', updated_cards);
end;
$$;

revoke all on function public.save_kanban_card_payload_v2(jsonb) from public;
grant execute on function public.save_kanban_card_payload_v2(jsonb) to anon, authenticated, service_role;
revoke all on function public.load_kanban_board_payload_v2(uuid) from public;
grant execute on function public.load_kanban_board_payload_v2(uuid) to anon, authenticated, service_role;

-- Restore the card created with Crítica before the old saver dropped that value.
update public.kanban_cards
   set source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object('priorityLabel', 'Crítica')
 where id = 'e0894785-fa17-4b4e-b5c4-35a6d69649a3'::uuid
   and title = 'Erro emissão NF'
   and priority is null
   and coalesce(source_payload ->> 'priorityLabel', '') = '';

-- This newly created card recorded Guilherme's actions with the former hard-coded user ID.
update public.kanban_cards
   set source_payload = jsonb_set(source_payload, '{activity}', (
     select jsonb_agg(
       case when entry ->> 'authorId' = 'u-ar'
         then entry || jsonb_build_object(
           'authorId', '62e5626d-4652-4bd8-b35c-c0bae27c074a',
           'authorName', 'Guilherme',
           'authorOperator', 'PRCGGC'
         )
         else entry
       end order by activity.position
     )
     from jsonb_array_elements(source_payload -> 'activity') with ordinality as activity(entry, position)
   ))
 where id = 'e0894785-fa17-4b4e-b5c4-35a6d69649a3'::uuid
   and title = 'Erro emissão NF'
   and jsonb_typeof(source_payload -> 'activity') = 'array';
