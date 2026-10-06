create table if not exists public.company_lead_change_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.company_leads(id) on delete cascade,
  actor text not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists company_lead_change_history_lead_idx
on public.company_lead_change_history (lead_id, created_at, id);
alter table public.company_lead_change_history enable row level security;
revoke all on public.company_lead_change_history from anon, authenticated;

create or replace function public.company_lead_audit_snapshot(lead public.company_leads)
returns jsonb language sql immutable set search_path = public as $$
  select (jsonb_build_object(
    'trade_name', lead.trade_name, 'company_size', lead.company_size,
    'phone', lead.raw_payload->>'phone', 'email', lead.raw_payload->>'email',
    'website', lead.raw_payload->>'website', 'address', lead.address,
    'postal_code', lead.postal_code, 'neighborhood', lead.neighborhood,
    'city', lead.city, 'state', lead.state
  ) || coalesce(lead.commercial_data, '{}'::jsonb)) - 'sector' - 'number' - 'complement'
  || jsonb_build_object(
    'stage', lead.stage, 'registration_status', lead.registration_status,
    'branch', coalesce(lead.commercial_data->>'branch', lead.commercial_data->>'sector'),
    'address_number', coalesce(lead.commercial_data->>'address_number', lead.commercial_data->>'number'),
    'address_complement', coalesce(lead.commercial_data->>'address_complement', lead.commercial_data->>'complement'),
    'conversion_status', lead.conversion_status, 'conversion_data', lead.conversion_data,
    'inactivation_reason', lead.inactivation_reason
  );
$$;
create or replace function public.record_company_lead_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  previous jsonb := public.company_lead_audit_snapshot(old);
  current_data jsonb := public.company_lead_audit_snapshot(new);
  changed jsonb;
begin
  select jsonb_object_agg(key, jsonb_build_object('old', previous->key, 'new', value)) into changed
  from jsonb_each(current_data)
  where coalesce(previous->>key, '') is distinct from coalesce(value #>> '{}', '');
  if changed is not null then
    insert into public.company_lead_change_history (lead_id,actor,changes)
    values (new.id,coalesce(nullif(public.current_portal_operator(),''),nullif(new.last_modified_by,''),'PRCREN'),changed);
  end if;
  return new;
end;
$$;
drop trigger if exists company_lead_record_changes on public.company_leads;
create trigger company_lead_record_changes after update on public.company_leads
for each row execute function public.record_company_lead_changes();

create or replace function public.company_lead_history(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(history) order by history.created_at, history.id),'[]'::jsonb)
  from public.company_lead_change_history history where history.lead_id=p_id;
$$;
revoke all on function public.company_lead_history(uuid) from public;
grant execute on function public.company_lead_history(uuid) to anon, authenticated;
