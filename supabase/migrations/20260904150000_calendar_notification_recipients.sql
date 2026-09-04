create or replace function public.get_crm_calendar_events()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      coalesce(event.app_metadata, '{}'::jsonb) || jsonb_build_object(
        'id', event.id,
        'date', to_char(event.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
        'time', to_char(event.starts_at at time zone 'America/Sao_Paulo', 'HH24:MI'),
        'end', to_char(event.ends_at at time zone 'America/Sao_Paulo', 'HH24:MI'),
        'kind', event.kind,
        'origin', event.legacy_origin,
        'operator', coalesce(event.legacy_operator, responsible.operator_code),
        'responsible', coalesce(event.legacy_operator, responsible.operator_code),
        'creatorOperator', creator.operator_code,
        'reminderEnabled', event.reminder_enabled,
        'title', event.title,
        'client', case when client.id is null then event.app_metadata->>'client'
          else client.acronym || ' · ' || coalesce(client.trade_name, client.legal_name) end,
        'clientId', event.client_id,
        'ticketId', coalesce(event.ticket_id::text, event.app_metadata->>'ticketId'),
        'protocol', coalesce(event.app_metadata->>'protocol', ticket.protocol),
        'status', event.status,
        'description', event.description,
        'guests', event.legacy_guests,
        'vehicleId', event.legacy_vehicle_id,
        'editable', event.legacy_id is null
      )
      order by event.starts_at, event.title
    ),
    '[]'::jsonb
  )
  from public.calendar_events event
  left join public.clients client on client.id = event.client_id
  left join public.tickets ticket on ticket.id = event.ticket_id
  left join public.profiles responsible on responsible.id = event.responsible_id
  left join public.profiles creator on creator.id = event.created_by;
$$;

grant execute on function public.get_crm_calendar_events() to anon, authenticated;
