-- Serialize bookings per room so simultaneous saves cannot reserve the same interval.
create or replace function public.prevent_calendar_room_conflict()
returns trigger language plpgsql security definer set search_path=public as $$
declare normalized_room text;
begin
  normalized_room := lower(trim(coalesce(new.room,'')));
  if new.kind <> 'procion_meeting' or normalized_room='' or new.status in ('cancelled','completed') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('crm-room:'||normalized_room,0));
  if exists (
    select 1 from public.calendar_events e
    where e.id<>new.id and e.kind='procion_meeting' and e.status not in ('cancelled','completed')
      and lower(trim(coalesce(e.room,'')))=normalized_room
      and e.starts_at<new.ends_at and e.ends_at>new.starts_at
  ) then
    raise exception using errcode='23P01',message='Sala indisponível no horário selecionado. Escolha outra sala ou horário.';
  end if;
  return new;
end; $$;
revoke all on function public.prevent_calendar_room_conflict() from public,anon,authenticated;
drop trigger if exists prevent_calendar_room_conflict on public.calendar_events;
create trigger prevent_calendar_room_conflict
before insert or update of room,kind,starts_at,ends_at,status on public.calendar_events
for each row execute function public.prevent_calendar_room_conflict();
