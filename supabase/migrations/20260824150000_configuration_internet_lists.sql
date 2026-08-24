create or replace function public.configuration_contracts_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(contract_row) order by contract_row.crm_updated_at desc nulls last), '[]'::jsonb)
  from (
    select
      contract.id,
      contract.legacy_id,
      contract.client_id,
      contract.contract_key,
      contract.name,
      contract.status,
      contract.active,
      contract.crm_created_at,
      contract.crm_updated_at,
      contract.source_payload,
      coalesce(client.acronym, contract.source_payload ->> 'con_cliente_sigla', '') as acronym
    from public.auth_contratos as contract
    left join public.clients as client on client.id = contract.client_id
  ) as contract_row;
$$;

create or replace function public.configuration_devices_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(device_row) order by device_row.last_checked_at desc nulls last), '[]'::jsonb)
  from (
    select
      device.id,
      device.legacy_id,
      device.auth_contratos_id_con,
      device.client_id,
      device.device_uuid,
      device.utilizador,
      device.codrep,
      device.tipo,
      device.sistema,
      device.status,
      device.active,
      device.build_version,
      device.db_version,
      device.last_checked_at,
      device.crm_created_at,
      device.crm_updated_at,
      coalesce(client.acronym, '') as client_acronym
    from public.mob_dispositivos as device
    left join public.clients as client on client.id = device.client_id
  ) as device_row;
$$;

create or replace function public.configuration_applications_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(application_row) order by application_row.name, application_row.legacy_id),
    '[]'::jsonb
  )
  from (
    select
      application.id,
      application.legacy_id,
      application.name,
      application.app_type,
      coalesce(application.source_payload ->> 'app_build_version', application.version) as build_version,
      application.source_payload ->> 'app_db_version' as db_version,
      application.source_payload ->> 'app_image' as image_name,
      application.status,
      application.active,
      application.crm_created_at,
      application.crm_updated_at
    from public.auth_aplicativos as application
  ) as application_row;
$$;

revoke all on function public.configuration_contracts_list() from public;
revoke all on function public.configuration_devices_list() from public;
revoke all on function public.configuration_applications_list() from public;
grant execute on function public.configuration_contracts_list() to anon, authenticated;
grant execute on function public.configuration_devices_list() to anon, authenticated;
grant execute on function public.configuration_applications_list() to anon, authenticated;
