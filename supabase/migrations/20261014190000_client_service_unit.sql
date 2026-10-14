-- Atendimento vem de empresas.emp_cidade da unidade associada ao cliente.
-- Uma consulta ao MySQL, filtrada por cliente antes da normalização.
create or replace function crm_mysql.client_bundle(p_acronym text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare condition text:=crm_mysql.literal(p_acronym); query_sql text;
begin
 query_sql:='SELECT JSON_OBJECT('||'''users'',(SELECT JSON_ARRAYAGG(row_payload) FROM (SELECT JSON_OBJECT(''id'',`id`,''aus_nome'',`aus_nome`,''aus_email'',`aus_email`,''aus_operador'',`aus_operador`,''aus_perfil'',`aus_perfil`,''aus_ativo'',`aus_ativo`,''tab_clientes_cli_sigla'',`tab_clientes_cli_sigla`,''aus_status'',`aus_status`,''aus_cod_hadron'',`aus_cod_hadron`,''aus_codrep'',`aus_codrep`,''created'',`created`,''modified'',`modified`) AS row_payload FROM `auth_usuarios` WHERE tab_clientes_cli_sigla='||condition||') scoped)'||','||'''contracts'',(SELECT JSON_ARRAYAGG(row_payload) FROM (SELECT JSON_OBJECT(''id_con'',`id_con`,''con_cliente_sigla'',`con_cliente_sigla`,''con_chave'',`con_chave`,''con_descricao'',`con_descricao`,''con_logotipo'',`con_logotipo`,''con_status'',`con_status`,''con_qtd_dispositivos'',`con_qtd_dispositivos`,''con_mobile_url'',`con_mobile_url`,''con_dominio_url'',`con_dominio_url`,''con_host_db'',`con_host_db`,''con_username_db'',`con_username_db`,''con_database_db'',`con_database_db`,''con_web_apps'',`con_web_apps`,''con_siglas_multi'',`con_siglas_multi`,''con_migrado'',`con_migrado`,''con_hadron_go'',`con_hadron_go`,''con_operador_mod'',`con_operador_mod`,''created'',`created`,''modified'',`modified`) AS row_payload FROM `auth_contratos` WHERE con_cliente_sigla='||condition||') scoped)'||','||'''devices'',(SELECT JSON_ARRAYAGG(row_payload) FROM (SELECT JSON_OBJECT(''id_dis'',d.`id_dis`,''auth_contratos_id_con'',d.`auth_contratos_id_con`,''dis_uuid'',d.`dis_uuid`,''dis_utilizador'',d.`dis_utilizador`,''dis_codrep'',d.`dis_codrep`,''dis_tipo'',d.`dis_tipo`,''dis_sistema'',d.`dis_sistema`,''dis_status'',d.`dis_status`,''dis_ult_verificacao'',d.`dis_ult_verificacao`,''dis_app_type'',d.`dis_app_type`,''dis_build_version'',d.`dis_build_version`,''dis_db_version'',d.`dis_db_version`,''created'',d.`created`,''modified'',d.`modified`,''_client_acronym'',c.con_cliente_sigla) AS row_payload FROM `mob_dispositivos` d LEFT JOIN auth_contratos c ON c.id_con=d.auth_contratos_id_con WHERE c.con_cliente_sigla='||condition||') scoped)'||','||'''apps'',(SELECT JSON_ARRAYAGG(row_payload) FROM (SELECT JSON_OBJECT(''id_app'',`id_app`,''app_type'',`app_type`,''app_build_version'',`app_build_version`,''app_db_version'',`app_db_version`,''app_description'',`app_description`,''app_image'',`app_image`,''created'',`created`,''modified'',`modified`) AS row_payload FROM `auth_aplicativos`) scoped)'||',''serviceCompanies'',(SELECT JSON_ARRAYAGG(JSON_OBJECT(''id'',emp_id,''city'',emp_cidade)) FROM procionw_prcsac.empresas)) AS payload';
 return crm_mysql.query(query_sql);
end $$;
revoke all on function crm_mysql.client_bundle(text) from public,anon,authenticated;

create or replace function public.get_crm_client(client_acronym text) returns jsonb
language plpgsql security definer set search_path=public as $function$
declare remote jsonb; result jsonb; target_acronym text; issues jsonb:='[]'::jsonb;
begin
 select c.acronym into target_acronym from public.clients c where lower(c.acronym)=lower(trim(client_acronym)) limit 1;
 if target_acronym is null then return null; end if;
 begin
   remote:=crm_mysql.client_bundle(target_acronym);
 exception when query_canceled or others then
   raise warning 'Client remote data failed [%]',SQLSTATE;
   remote:='{}'::jsonb;
   issues:='["Unidade de atendimento, Internet, dispositivos e usuários do Hádron"]'::jsonb;
 end;
 with auth_usuarios as materialized (select normalized.* from jsonb_array_elements(coalesce(nullif(remote->'users','null'::jsonb),'[]'::jsonb)) r cross join lateral jsonb_populate_record(null::crm_mysql.row_auth_usuarios,crm_mysql.normalize('auth_usuarios',r)) normalized),
auth_contratos as materialized (select normalized.* from jsonb_array_elements(coalesce(nullif(remote->'contracts','null'::jsonb),'[]'::jsonb)) r cross join lateral jsonb_populate_record(null::crm_mysql.row_auth_contratos,crm_mysql.normalize('auth_contratos',r)) normalized),
mob_dispositivos as materialized (select normalized.* from jsonb_array_elements(coalesce(nullif(remote->'devices','null'::jsonb),'[]'::jsonb)) r cross join lateral jsonb_populate_record(null::crm_mysql.row_mob_dispositivos,crm_mysql.normalize('mob_dispositivos',r)) normalized),
auth_aplicativos as materialized (select normalized.* from jsonb_array_elements(coalesce(nullif(remote->'apps','null'::jsonb),'[]'::jsonb)) r cross join lateral jsonb_populate_record(null::crm_mysql.row_auth_aplicativos,crm_mysql.normalize('auth_aplicativos',r)) normalized)
  select jsonb_build_object(
    'loadIssues',issues,
    'client', to_jsonb(c)||jsonb_build_object('service_unit',(select unit->>'city' from jsonb_array_elements(coalesce(nullif(remote->'serviceCompanies','null'::jsonb),'[]'::jsonb)) unit where unit->>'id'=coalesce(nullif(nullif(c.source_payload->>'empresa_id_emp',''),'0'),'1') limit 1)),
    'companies', coalesce((
      select jsonb_agg(to_jsonb(company) order by company.company_number, company.legal_name)
      from public.client_companies company
      where company.client_id = c.id
    ), '[]'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(to_jsonb(contact) order by contact.name, contact.email, contact.phone)
      from public.client_contacts contact
      where contact.client_id = c.id
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', auth_user.id,
          'legacy_id', auth_user.legacy_id,
          'name', auth_user.name,
          'email', auth_user.email,
          'operator', auth_user.operator,
          'hadron_code', auth_user.hadron_code,
          'representative_code', auth_user.representative_code,
          'role', auth_user.profile,
          'status', auth_user.status,
          'active', auth_user.active,
          'crm_created_at', auth_user.crm_created_at,
          'crm_updated_at', auth_user.crm_updated_at
        )
        order by auth_user.name, auth_user.email
      )
      from auth_usuarios auth_user
      where auth_user.client_id = c.id
    ), (
      select jsonb_agg(to_jsonb(client_user) order by client_user.name, client_user.email)
      from public.client_hadron_users client_user
      where client_user.client_id = c.id
    ), '[]'::jsonb),
    'terminals', coalesce((
      select jsonb_agg(to_jsonb(terminal) order by terminal.registered_at desc nulls last)
      from (
        select client_terminal.*
        from public.client_terminals client_terminal
        where client_terminal.client_id = c.id
        order by client_terminal.registered_at desc nulls last
        limit 50
      ) terminal
    ), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', module.id,
          'name', module.name,
          'contracted', client_module.contracted,
          'version', client_module.version
        )
        order by module.display_order nulls last, module.name
      )
      from public.client_modules client_module
      join public.modules module on module.id = client_module.module_id
      where client_module.client_id = c.id
    ), '[]'::jsonb),
    'internet', (
      with active_contracts as (
        select contract.*
        from auth_contratos contract
        where contract.client_id = c.id and contract.active
      ),
      active_devices as (
        select device.*
        from mob_dispositivos device
        join active_contracts contract on contract.id = device.contrato_id
      )
      select jsonb_build_object(
        'has_active_contract', exists(select 1 from active_contracts),
        'has_devices', exists(select 1 from active_devices),
        'devices', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', device.id,
              'legacy_id', device.legacy_id,
              'auth_contratos_id_con', device.auth_contratos_id_con,
              'device_uuid', device.device_uuid,
              'utilizador', device.utilizador,
              'codrep', device.codrep,
              'tipo', device.tipo,
              'sistema', device.sistema,
              'status', device.status,
              'active', device.active,
              'app_type', device.app_type,
              'build_version', device.build_version,
              'db_version', device.db_version,
              'last_checked_at', device.last_checked_at,
              'updated_at', device.crm_updated_at
            )
            order by device.crm_updated_at desc nulls last, device.utilizador
          )
          from active_devices device
        ), '[]'::jsonb),
        'contracts', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', contract.id,
              'legacy_id', contract.legacy_id,
              'contract_key', contract.contract_key,
              'name', contract.name,
              'web_url', contract.web_url,
              'database_name', contract.database_name,
              'server_host', contract.server_host,
              'status', contract.status,
              'active', contract.active,
              'starts_at', contract.starts_at,
              'expires_at', contract.expires_at,
              'updated_at', contract.crm_updated_at,
              'source_payload', contract.source_payload,
              'devices', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', device.id,
                    'legacy_id', device.legacy_id,
                    'auth_contratos_id_con', device.auth_contratos_id_con,
                    'device_uuid', device.device_uuid,
                    'utilizador', device.utilizador,
                    'codrep', device.codrep,
                    'tipo', device.tipo,
                    'sistema', device.sistema,
                    'status', device.status,
                    'active', device.active,
                    'app_type', device.app_type,
                    'build_version', device.build_version,
                    'db_version', device.db_version,
                    'last_checked_at', device.last_checked_at,
                    'updated_at', device.crm_updated_at
                  )
                  order by device.crm_updated_at desc nulls last, device.utilizador
                )
                from active_devices device
                where device.contrato_id = contract.id
              ), '[]'::jsonb)
            )
            order by contract.name, contract.legacy_id
          )
          from active_contracts contract
        ), '[]'::jsonb),
        'applications', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', app.id,
              'legacy_id', app.legacy_id,
              'contract_legacy_id', app.auth_contratos_id_con,
              'name', app.name,
              'app_type', app.app_type,
              'version', app.version,
              'status', app.status,
              'active', app.active,
              'updated_at', app.crm_updated_at
            )
            order by app.name, app.legacy_id
          )
          from auth_aplicativos app
          where app.client_id = c.id
             or exists (
               select 1
               from active_contracts contract
               where coalesce(contract.source_payload->>'con_web_apps', '[]')::jsonb ? app.app_type
             )
        ), '[]'::jsonb)
      )
    ),
    'tickets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ticket.id,
          'protocol', ticket.protocol,
          'subject', ticket.subject,
          'module', module.name,
          'submodule', submodule.name,
          'operator', coalesce(attendant.operator_code, owner.operator_code),
          'priority', ticket.priority,
          'status', ticket.status,
          'created_at', ticket.created_at
        )
        order by ticket.created_at desc
      )
      from (
        select ticket.*
        from public.tickets ticket
        where ticket.client_id = c.id
        order by ticket.created_at desc
        limit 20
      ) ticket
      left join public.modules module on module.id = ticket.module_id
      left join public.submodules submodule on submodule.id = ticket.submodule_id
      left join public.profiles attendant on attendant.id = ticket.attendant_id
      left join public.profiles owner on owner.id = ticket.owner_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'title', event.title,
          'starts_at', event.starts_at,
          'ends_at', event.ends_at,
          'operator', responsible.operator_code,
          'status', event.status,
          'ticket_protocol', ticket.protocol
        )
        order by event.starts_at desc
      )
      from (
        select event.*
        from public.calendar_events event
        where event.client_id = c.id
        order by event.starts_at desc
        limit 20
      ) event
      left join public.profiles responsible on responsible.id = event.responsible_id
      left join public.tickets ticket on ticket.id = event.ticket_id
    ), '[]'::jsonb)
  )
  into result from public.clients c
  where lower(c.acronym) = lower(client_acronym)
  limit 1;
 return result;
end $function$;
