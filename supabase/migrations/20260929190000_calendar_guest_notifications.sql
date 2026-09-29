create or replace function public.notify_calendar_event_guests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  guest jsonb;
  guest_profile_id uuid;
  event_link text;
  event_body text;
begin
  event_link := '/calendario?evento=' || new.id::text;
  event_body := new.title || ' · ' ||
    to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  for guest in
    select value
    from jsonb_array_elements(coalesce(new.app_metadata -> 'guestList', '[]'::jsonb))
  loop
    if tg_op = 'UPDATE' and exists (
      select 1
      from jsonb_array_elements(coalesce(old.app_metadata -> 'guestList', '[]'::jsonb)) previous
      where nullif(previous ->> 'id', '') = nullif(guest ->> 'id', '')
         or upper(nullif(previous ->> 'acronym', '')) = upper(nullif(guest ->> 'acronym', ''))
         or lower(nullif(previous ->> 'email', '')) = lower(nullif(guest ->> 'email', ''))
    ) then
      continue;
    end if;

    guest_profile_id := null;
    select profile.id
      into guest_profile_id
      from public.profiles profile
     where profile.id::text = nullif(guest ->> 'id', '')
        or upper(profile.operator_code) = upper(nullif(guest ->> 'acronym', ''))
        or lower(profile.email) = lower(nullif(guest ->> 'email', ''))
     order by (profile.id::text = nullif(guest ->> 'id', '')) desc
     limit 1;

    if guest_profile_id is null or guest_profile_id = auth.uid() then
      continue;
    end if;

    if not exists (
      select 1
      from public.notifications notification
      where notification.profile_id = guest_profile_id
        and notification.title = 'Você foi adicionado a um agendamento'
        and notification.link = event_link
        and notification.created_at > now() - interval '1 minute'
    ) then
      insert into public.notifications(profile_id, title, body, link)
      values (
        guest_profile_id,
        'Você foi adicionado a um agendamento',
        event_body,
        event_link
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_calendar_event_guests on public.calendar_events;
create trigger notify_calendar_event_guests
after insert or update of app_metadata on public.calendar_events
for each row execute function public.notify_calendar_event_guests();
