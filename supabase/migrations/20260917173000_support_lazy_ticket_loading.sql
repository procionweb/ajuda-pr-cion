create or replace function public.support_load_tickets()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', coalesce(t.legacy_id, t.id::text),
    'protocol', t.protocol,
    'status', public.support_status_from_db(t.status),
    'priority', public.support_priority_from_db(t.priority),
    'openedAt', coalesce(t.legacy_created_at, t.created_at),
    'updatedAt', coalesce(t.legacy_updated_at, t.updated_at),
    'attendant', coalesce(t.attendant_code, 'Sem atendente'),
    'owner', coalesce(t.owner_code, 'Sem responsável'),
    'clientCode', coalesce(t.client_code, c.acronym),
    'clientName', coalesce(t.client_name, c.trade_name, c.legal_name),
    'contact', coalesce(t.contact_name, cc.name, 'Não informado'),
    'subject', t.subject,
    'module', coalesce(t.module_label, m.name, 'Não informado'),
    'source', public.support_channel_from_db(t.channel),
    'lockedBy', t.locked_by_code,
    'description', t.description
  ) order by coalesce(t.legacy_created_at, t.created_at) desc), '[]'::jsonb)
  from public.tickets t
  left join public.clients c on c.id = t.client_id
  left join public.client_contacts cc on cc.id = t.contact_id
  left join public.modules m on m.id = t.module_id;
$$;

create or replace function public.support_load_ticket_activity(ticket_key text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with selected_ticket as (
    select id, coalesce(legacy_id, id::text) as public_id
    from public.tickets
    where legacy_id = ticket_key or id::text = ticket_key
    limit 1
  )
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'ticketId', st.public_id,
        'kind', e.event_type,
        'when', e.occurred_at,
        'actor', coalesce(e.actor_code, 'Sistema'),
        'actorType', coalesce(e.actor_type, 'sistema'),
        'description', coalesce(e.description, e.title)
      ) order by e.occurred_at)
      from public.ticket_events e
      join selected_ticket st on st.id = e.ticket_id
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', msg.id,
        'ticketId', st.public_id,
        'operator', coalesce(msg.sender_code, msg.sender_name, 'Suporte'),
        'createdAt', msg.created_at,
        'text', msg.body
      ) order by msg.created_at desc)
      from public.ticket_messages msg
      join selected_ticket st on st.id = msg.ticket_id
      where msg.internal
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', msg.id,
        'ticketId', st.public_id,
        'author', coalesce(msg.author_type, 'suporte'),
        'name', coalesce(msg.sender_name, msg.sender_code, 'Suporte'),
        'text', msg.body,
        'at', msg.created_at
      ) order by msg.created_at)
      from public.ticket_messages msg
      join selected_ticket st on st.id = msg.ticket_id
      where not msg.internal
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.support_load_tickets() from public;
revoke all on function public.support_load_ticket_activity(text) from public;
grant execute on function public.support_load_tickets() to anon, authenticated;
grant execute on function public.support_load_ticket_activity(text) to anon, authenticated;
