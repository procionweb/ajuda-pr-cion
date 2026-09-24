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
    'attendant', coalesce(nullif(trim(t.attendant_code), ''), 'Sem atendente'),
    'owner', coalesce(nullif(trim(t.owner_code), ''), 'Sem responsável'),
    'clientCode', coalesce(nullif(trim(t.client_code), ''), c.acronym, 'Não informado'),
    'clientName', coalesce(
      nullif(trim(t.client_name), ''),
      nullif(trim(c.trade_name), ''),
      nullif(trim(c.legal_name), ''),
      c.acronym,
      'Não informado'
    ),
    'contact', coalesce(nullif(trim(t.contact_name), ''), cc.name, 'Não informado'),
    'subject', t.subject,
    'module', coalesce(nullif(trim(t.module_label), ''), m.name, 'Não informado'),
    'source', public.support_channel_from_db(t.channel),
    'lockedBy', nullif(trim(t.locked_by_code), ''),
    'description', t.description
  ) order by coalesce(t.legacy_created_at, t.created_at) desc), '[]'::jsonb)
  from public.tickets t
  left join public.clients c on c.id = t.client_id
  left join public.client_contacts cc on cc.id = t.contact_id
  left join public.modules m on m.id = t.module_id;
$$;

revoke all on function public.support_load_tickets() from public;
grant execute on function public.support_load_tickets() to anon, authenticated;
