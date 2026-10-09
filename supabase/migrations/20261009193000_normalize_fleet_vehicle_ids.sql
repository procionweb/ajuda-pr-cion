-- Corrige identificadores herdados sem excluir registros ou históricos.
create or replace function public.normalize_fleet_vehicle_ids(value jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare result jsonb; item record; replacement text;
begin
  if jsonb_typeof(value) = 'array' then
    select coalesce(jsonb_agg(public.normalize_fleet_vehicle_ids(e) order by n),'[]'::jsonb)
    into result from jsonb_array_elements(value) with ordinality as a(e,n);
    return result;
  elsif jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for item in select key,val from jsonb_each(value) as a(key,val) loop
      if item.key in ('vehicleId','vehicle_id') or (item.key='id' and value ? 'model' and value ? 'plate') then
        replacement := case item.val #>> '{}'
          when 'corolla' then 'gol-g4' when 'tracker' then 'celta'
          when 'onix' then 'mobi' when 'strada' then 'saveiro-g5' else null end;
      else replacement := null;
      end if;
      result := result || jsonb_build_object(item.key, case when replacement is not null then to_jsonb(replacement) else public.normalize_fleet_vehicle_ids(item.val) end);
    end loop;
    return result;
  end if;
  return value;
end;
$$;

create or replace function public.normalize_fleet_state_on_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.scope in ('fleet_core','fleet_entries') then
    new.payload := public.normalize_fleet_vehicle_ids(new.payload);
  end if;
  return new;
end;
$$;
drop trigger if exists normalize_fleet_state_ids on public.fleet_app_state;
create trigger normalize_fleet_state_ids before insert or update of payload on public.fleet_app_state
for each row execute function public.normalize_fleet_state_on_write();

create or replace function public.normalize_calendar_vehicle_on_write()
returns trigger language plpgsql set search_path = public as $$
begin
  new.app_metadata := public.normalize_fleet_vehicle_ids(new.app_metadata);
  return new;
end;
$$;
drop trigger if exists normalize_calendar_vehicle_ids on public.calendar_events;
create trigger normalize_calendar_vehicle_ids before insert or update of app_metadata on public.calendar_events
for each row execute function public.normalize_calendar_vehicle_on_write();

update public.fleet_app_state set payload=public.normalize_fleet_vehicle_ids(payload),updated_at=now()
where scope in ('fleet_core','fleet_entries') and payload is distinct from public.normalize_fleet_vehicle_ids(payload);
update public.calendar_events set app_metadata=public.normalize_fleet_vehicle_ids(app_metadata)
where app_metadata is distinct from public.normalize_fleet_vehicle_ids(app_metadata);
