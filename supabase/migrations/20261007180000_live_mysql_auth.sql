-- Live MySQL data; credentials are provisioned separately into Vault.
create extension if not exists wrappers with schema extensions;
create schema if not exists crm_mysql;
revoke all on schema crm_mysql from public, anon, authenticated;
create foreign data wrapper crm_mysql_fdw handler extensions.mysql_fdw_handler validator extensions.mysql_fdw_validator;
do $server$ declare secret_id uuid;begin select id into secret_id from vault.secrets where name='crm_auth_mysql_connection';if secret_id is null then raise exception 'Provision crm_auth_mysql_connection in Vault before migrating';end if;execute format('create server crm_auth_mysql foreign data wrapper crm_mysql_fdw options(conn_string_id %L)',secret_id::text);end $server$;

create foreign data wrapper crm_tls_fdw handler extensions.redis_fdw_handler validator extensions.redis_fdw_validator;
create server crm_tls_initializer foreign data wrapper crm_tls_fdw options(conn_url 'redis://127.0.0.1:1');
create foreign table crm_mysql.tls_bootstrap(key text,value text) server crm_tls_initializer options(src_type 'hash',src_key 'bootstrap');
create function crm_mysql.ensure_tls() returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- Planning initializes Rustls in this backend. Never execute this Redis scan.
  execute 'explain select * from crm_mysql.tls_bootstrap';
end $$;
create table crm_mysql.identities(source_table text not null,legacy_id text not null,id uuid not null,primary key(source_table,legacy_id),unique(source_table,id));
insert into crm_mysql.identities select 'auth_usuarios',legacy_id,id from public.auth_usuarios where legacy_id ~ '^[0-9]+$';
insert into crm_mysql.identities select 'auth_contratos',legacy_id,id from public.auth_contratos where legacy_id ~ '^[0-9]+$';
insert into crm_mysql.identities select 'auth_aplicativos',legacy_id,id from public.auth_aplicativos where legacy_id ~ '^[0-9]+$';
insert into crm_mysql.identities select 'mob_dispositivos',legacy_id,id from public.mob_dispositivos where legacy_id ~ '^[0-9]+$';
insert into crm_mysql.identities select 'auth_logs',legacy_id,id from public.auth_logs where legacy_id ~ '^[0-9]+$';
create function crm_mysql.identity(p_table text,p_legacy text) returns uuid language sql stable security definer set search_path=pg_catalog as $$
select coalesce((select id from crm_mysql.identities where source_table=p_table and legacy_id=p_legacy),md5(p_table||':'||p_legacy)::uuid) $$;
create function crm_mysql.date_value(value text) returns timestamptz language sql immutable set timezone='UTC' as $$ select case when value is null or value like '0000-%' or value='' then null else value::timestamptz end $$;
create function crm_mysql.json_value(value text) returns jsonb language plpgsql immutable as $$ begin return value::jsonb; exception when invalid_text_representation then return to_jsonb(value); end $$;
create foreign table crm_mysql.source_auth_usuarios(payload text) server crm_auth_mysql options(table '(SELECT JSON_OBJECT(''id'',`id`,''aus_nome'',`aus_nome`,''aus_email'',`aus_email`,''aus_operador'',`aus_operador`,''aus_perfil'',`aus_perfil`,''aus_ativo'',`aus_ativo`,''tab_clientes_cli_sigla'',`tab_clientes_cli_sigla`,''aus_status'',`aus_status`,''aus_cod_hadron'',`aus_cod_hadron`,''aus_codrep'',`aus_codrep`,''created'',`created`,''modified'',`modified`) AS payload FROM `auth_usuarios`)');
create foreign table crm_mysql.source_auth_contratos(payload text) server crm_auth_mysql options(table '(SELECT JSON_OBJECT(''id_con'',`id_con`,''con_cliente_sigla'',`con_cliente_sigla`,''con_chave'',`con_chave`,''con_descricao'',`con_descricao`,''con_logotipo'',`con_logotipo`,''con_status'',`con_status`,''con_qtd_dispositivos'',`con_qtd_dispositivos`,''con_mobile_url'',`con_mobile_url`,''con_dominio_url'',`con_dominio_url`,''con_host_db'',`con_host_db`,''con_username_db'',`con_username_db`,''con_database_db'',`con_database_db`,''con_web_apps'',`con_web_apps`,''con_siglas_multi'',`con_siglas_multi`,''con_migrado'',`con_migrado`,''con_hadron_go'',`con_hadron_go`,''con_operador_mod'',`con_operador_mod`,''created'',`created`,''modified'',`modified`) AS payload FROM `auth_contratos`)');
create foreign table crm_mysql.source_auth_aplicativos(payload text) server crm_auth_mysql options(table '(SELECT JSON_OBJECT(''id_app'',`id_app`,''app_type'',`app_type`,''app_build_version'',`app_build_version`,''app_db_version'',`app_db_version`,''app_description'',`app_description`,''app_image'',`app_image`,''created'',`created`,''modified'',`modified`) AS payload FROM `auth_aplicativos`)');
create foreign table crm_mysql.source_mob_dispositivos(payload text) server crm_auth_mysql options(table '(SELECT JSON_OBJECT(''id_dis'',d.`id_dis`,''auth_contratos_id_con'',d.`auth_contratos_id_con`,''dis_uuid'',d.`dis_uuid`,''dis_utilizador'',d.`dis_utilizador`,''dis_codrep'',d.`dis_codrep`,''dis_tipo'',d.`dis_tipo`,''dis_sistema'',d.`dis_sistema`,''dis_status'',d.`dis_status`,''dis_ult_verificacao'',d.`dis_ult_verificacao`,''dis_app_type'',d.`dis_app_type`,''dis_build_version'',d.`dis_build_version`,''dis_db_version'',d.`dis_db_version`,''created'',d.`created`,''modified'',d.`modified`,''_client_acronym'',c.con_cliente_sigla) AS payload FROM `mob_dispositivos` d LEFT JOIN auth_contratos c ON c.id_con=d.auth_contratos_id_con)');
create function crm_mysql.scan(p_table text) returns setof jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_table not in ('auth_usuarios','auth_contratos','auth_aplicativos','mob_dispositivos') then raise exception 'Unsupported source'; end if;
  perform crm_mysql.ensure_tls();
  return query execute format('select payload::jsonb from crm_mysql.source_%I',p_table);
end $$;
create function crm_mysql.normalize(p_table text,r jsonb) returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
<<normalizer>>
declare v jsonb; legacy text; client uuid; acronym text; contract jsonb;
begin
 if p_table='auth_usuarios' then
 legacy:=r->>'id'; acronym:=r->>'tab_clientes_cli_sigla';
 v:=jsonb_build_object('name',r->>'aus_nome','email',r->>'aus_email','operator',r->>'aus_operador','hadron_code',r->>'aus_cod_hadron','representative_code',r->>'aus_codrep','profile',r->>'aus_perfil','status',r->>'aus_status','active',coalesce((r->>'aus_ativo')::int=1,false),'client_acronym',acronym);
 elsif p_table='auth_contratos' then
 legacy:=r->>'id_con'; acronym:=r->>'con_cliente_sigla';
 v:=jsonb_build_object('name',r->>'con_descricao','web_url',coalesce(nullif(r->>'con_mobile_url',''),r->>'con_dominio_url'),'database_name',r->>'con_database_db','server_host',r->>'con_host_db','contract_key',r->>'con_chave','status',r->>'con_status','active',coalesce((r->>'con_status')::int=1,false),'source_payload',(r-'con_chave')||jsonb_build_object('con_web_apps',coalesce(nullif(r->>'con_web_apps',''),'[]')));
 elsif p_table='auth_aplicativos' then
 legacy:=r->>'id_app';
 v:=jsonb_build_object('name',r->>'app_description','app_type',r->>'app_type','version',r->>'app_build_version','status','Ativo','active',true,'source_payload',r);
 elsif p_table='mob_dispositivos' then
 legacy:=r->>'id_dis';
 acronym:=r->>'_client_acronym';
 v:=jsonb_build_object('auth_contratos_id_con',r->>'auth_contratos_id_con','contrato_id',crm_mysql.identity('auth_contratos',r->>'auth_contratos_id_con'),'device_uuid',r->>'dis_uuid','utilizador',r->>'dis_utilizador','codrep',r->>'dis_codrep','tipo',r->>'dis_tipo','sistema',r->>'dis_sistema','status',r->>'dis_status','active',coalesce((r->>'dis_status')::int not in (0,9),true),'app_type',r->>'dis_app_type','build_version',r->>'dis_build_version','db_version',r->>'dis_db_version','last_checked_at',crm_mysql.date_value(r->>'dis_ult_verificacao'),'source_payload',r);
 else raise exception 'Unsupported source'; end if;
 select id into client from public.clients where upper(trim(public.clients.acronym))=upper(trim(normalizer.acronym)) order by id limit 1;
 return v||jsonb_build_object('id',crm_mysql.identity(p_table,legacy),'legacy_id',legacy,'client_id',client,'crm_created_at',crm_mysql.date_value(r->>'created'),'crm_updated_at',crm_mysql.date_value(r->>'modified'),'created_at',coalesce(crm_mysql.date_value(r->>'created'),now()),'updated_at',coalesce(crm_mysql.date_value(r->>'modified'),now()));
end $$;
create table crm_mysql.portal_logs as select * from public.auth_logs where legacy_id !~ '^[0-9]+$';
do $$ declare fk record; begin for fk in select conrelid::regclass as rel,conname from pg_constraint where contype='f' and confrelid in ('public.auth_usuarios'::regclass,'public.auth_contratos'::regclass) loop execute format('alter table %s drop constraint %I',fk.rel,fk.conname); end loop; end $$;
drop table public.auth_logs;
drop table public.auth_aplicativos;
drop table public.mob_dispositivos;
drop table public.auth_contratos;
drop table public.auth_usuarios;
create type crm_mysql.row_auth_usuarios as (id uuid,legacy_id text,client_id uuid,client_acronym text,name text,email text,operator text,hadron_code text,representative_code text,profile text,status text,active boolean,crm_created_at timestamp with time zone,crm_updated_at timestamp with time zone,created_at timestamp with time zone,updated_at timestamp with time zone);
create view public.auth_usuarios as select normalized.* from crm_mysql.scan('auth_usuarios') r cross join lateral jsonb_populate_record(null::crm_mysql.row_auth_usuarios,crm_mysql.normalize('auth_usuarios',r)) normalized;
revoke all on public.auth_usuarios from public,anon,authenticated;
create type crm_mysql.row_auth_contratos as (id uuid,legacy_id text,client_id uuid,client_legacy_id text,name text,web_url text,database_name text,server_host text,status text,active boolean,starts_at date,expires_at date,crm_created_at timestamp with time zone,crm_updated_at timestamp with time zone,source_payload jsonb,created_at timestamp with time zone,updated_at timestamp with time zone,contract_key text);
create view public.auth_contratos as select normalized.* from crm_mysql.scan('auth_contratos') r cross join lateral jsonb_populate_record(null::crm_mysql.row_auth_contratos,crm_mysql.normalize('auth_contratos',r)) normalized;
revoke all on public.auth_contratos from public,anon,authenticated;
create type crm_mysql.row_auth_aplicativos as (id uuid,legacy_id text,auth_contratos_id_con text,contrato_id uuid,client_id uuid,name text,app_type text,version text,status text,active boolean,crm_created_at timestamp with time zone,crm_updated_at timestamp with time zone,source_payload jsonb,created_at timestamp with time zone,updated_at timestamp with time zone);
create view public.auth_aplicativos as select normalized.* from crm_mysql.scan('auth_aplicativos') r cross join lateral jsonb_populate_record(null::crm_mysql.row_auth_aplicativos,crm_mysql.normalize('auth_aplicativos',r)) normalized;
revoke all on public.auth_aplicativos from public,anon,authenticated;
create type crm_mysql.row_mob_dispositivos as (id uuid,legacy_id text,auth_contratos_id_con text,contrato_id uuid,client_id uuid,device_uuid text,utilizador text,codrep text,tipo text,sistema text,status text,active boolean,app_type text,build_version text,db_version text,last_checked_at timestamp with time zone,crm_created_at timestamp with time zone,crm_updated_at timestamp with time zone,source_payload jsonb,created_at timestamp with time zone,updated_at timestamp with time zone);
create view public.mob_dispositivos as select normalized.* from crm_mysql.scan('mob_dispositivos') r cross join lateral jsonb_populate_record(null::crm_mysql.row_mob_dispositivos,crm_mysql.normalize('mob_dispositivos',r)) normalized;
revoke all on public.mob_dispositivos from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.current_portal_operator()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(
    nullif(upper(trim(collaborator.operator_acronym)), ''),
    nullif(upper(trim(profile.operator_code)), ''),
    nullif(upper(trim(auth_user.operator)), ''),
    'PRCREN'
  )
  from auth.users portal_user
  left join public.tab_colaboradores collaborator
    on collaborator.profile_id = portal_user.id
  left join public.profiles profile
    on profile.id = portal_user.id
  left join public.auth_usuarios auth_user
    on lower(trim(auth_user.email)) = lower(trim(portal_user.email))
  where portal_user.id = auth.uid()
  limit 1
$function$
;
CREATE OR REPLACE FUNCTION public.get_current_portal_access()
 RETURNS TABLE(portal_profile text, collaborator_department text, operator_acronym text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    coalesce(u.raw_app_meta_data ->> 'perfil', au.profile, 'prc'),
    c.clb_departamento,
    coalesce(
      nullif(upper(trim(c.operator_acronym)), ''),
      nullif(upper(trim(p.operator_code)), ''),
      nullif(upper(trim(au.operator)), ''),
      'PRCREN'
    )
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  left join public.profiles p on p.id = u.id
  left join public.auth_usuarios au
    on lower(trim(au.email)) = lower(trim(u.email))
  where u.id = auth.uid()
  limit 1
$function$
;
CREATE OR REPLACE FUNCTION public.record_hadron_option_log(p_option_id text, p_action text, p_info text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_id uuid := gen_random_uuid();
  v_operator text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  if trim(coalesce(p_option_id, '')) = '' then raise exception 'Opção não informada.'; end if;

  select upper(trim(coalesce(c.operator_acronym, u.raw_user_meta_data ->> 'operator', u.email, '')))
  into v_operator
  from auth.users u
  left join public.tab_colaboradores c on c.profile_id = u.id
  where u.id = auth.uid()
  limit 1;

  insert into crm_mysql.portal_logs (
    id, legacy_id, action, controller, operator, device, url, info, params,
    crm_created_at, crm_updated_at
  ) values (
    v_id, 'portal-' || v_id::text, trim(p_action), 'CvsOptions', v_operator, 'web',
    'iniciar-hadron/opcoes/' || trim(p_option_id), nullif(trim(coalesce(p_info, '')), ''),
    jsonb_build_array(trim(p_option_id)), now(), now()
  );

  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_auth_s_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'perfil', '')) = 's_admin'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'perfil', '')) = 's_admin'
    or exists (
      select 1
      from public.auth_usuarios legacy_user
      where legacy_user.active
        and lower(legacy_user.profile) = 's_admin'
        and lower(legacy_user.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$function$
;
CREATE OR REPLACE FUNCTION public.get_crm_client_params(client_acronym text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', client_param.id,
        'legacy_id', client_param.legacy_id,
        'parameter_legacy_id', client_param.cvs_parameter_legacy_id,
        'option_legacy_id', client_param.cvs_option_legacy_id,
        'signature', client_param.parameter_signature,
        'option_data', client_param.option_data,
        'auth_user_legacy_id', client_param.auth_usuario_legacy_id,
        'signed_by', coalesce(auth_user.name, auth_user.operator, auth_user.email),
        'operator', auth_user.operator,
        'created_at', client_param.crm_created_at,
        'updated_at', client_param.crm_updated_at
      )
      order by client_param.parameter_signature, client_param.legacy_id
    ),
    '[]'::jsonb
  )
  from public.clients client
  join public.tab_cli_params client_param on client_param.client_id = client.id
  left join public.auth_usuarios auth_user on auth_user.id = client_param.auth_usuario_id
  where upper(client.acronym) = upper($1);
$function$
;
CREATE OR REPLACE FUNCTION public.get_crm_client(client_acronym text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'client', to_jsonb(c),
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
      from public.auth_usuarios auth_user
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
        from public.auth_contratos contract
        where contract.client_id = c.id and contract.active
      ),
      active_devices as (
        select device.*
        from public.mob_dispositivos device
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
          from public.auth_aplicativos app
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
  from public.clients c
  where lower(c.acronym) = lower(client_acronym)
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.configuration_applications_list()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.configuration_devices_list()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.configuration_contracts_list()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.set_portal_user_role(collaborator_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  collaborator public.tab_colaboradores%rowtype;
  normalized_role text := lower(trim(coalesce(new_role, 'none')));
begin
  if not exists (
    select 1 from public.tab_colaboradores current_collaborator
    where current_collaborator.profile_id = auth.uid()
      and current_collaborator.clb_departamento = 'admin'
  ) then
    raise exception 'Apenas o departamento administrativo pode alterar perfis do portal.';
  end if;
  if normalized_role not in (
    's_admin', 'admin', 'tester', 'manager', 'logistics',
    'supervisor', 'marketing', 'prc', 'none'
  ) then
    raise exception 'Perfil de acesso inválido.';
  end if;

  select * into collaborator from public.tab_colaboradores where id = collaborator_id;
  if collaborator.id is null then raise exception 'Colaborador não encontrado.'; end if;
  if collaborator.profile_id is null then
    raise exception 'Este colaborador ainda não possui uma conta de acesso provisionada.';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('perfil', normalized_role),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'perfil', normalized_role,
          'departamento', collaborator.clb_departamento
        ),
      banned_until = case when normalized_role = 'none' then now() + interval '100 years' else null end,
      updated_at = now()
  where id = collaborator.profile_id;

  update public.profiles
  set role = case when normalized_role = 's_admin' then 'admin'::public.user_role
                  else 'support'::public.user_role end,
      active = normalized_role <> 'none',
      updated_at = now()
  where id = collaborator.profile_id;

  perform crm_mysql.ensure_tls();
  update crm_mysql.write_users set aus_perfil=normalized_role,modified=now() at time zone 'UTC' where lower(trim(aus_email))=lower(trim(collaborator.email));
end
$function$
;
CREATE OR REPLACE FUNCTION public.resolve_portal_login_email(login_value text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select lower(portal_user.email)
  from public.auth_usuarios legacy_user
  join auth.users portal_user
    on lower(trim(portal_user.email)) = lower(trim(legacy_user.email))
  where legacy_user.active
    and upper(trim(coalesce(legacy_user.client_acronym, ''))) = 'PRC'
    and (
      lower(trim(legacy_user.email)) = lower(trim(login_value))
      or upper(trim(legacy_user.operator)) = upper(trim(login_value))
    )
    and lower(trim(coalesce(legacy_user.profile, ''))) in (
      's_admin', 'admin', 'tester', 'manager', 'logistics',
      'supervisor', 'marketing', 'prc'
    )
  limit 1
$function$
;
create foreign table crm_mysql.write_users(id bigint,aus_nome text,aus_email text,aus_operador text,aus_perfil text,aus_ativo smallint,tab_clientes_cli_sigla text,aus_status text,aus_cod_hadron text,aus_codrep bigint,created timestamp,modified timestamp) server crm_auth_mysql options(table 'auth_usuarios',rowid_column 'id');
create foreign table crm_mysql.write_apps(id_app bigint,app_type text,app_build_version integer,app_db_version integer,app_description text,app_image text,created timestamp,modified timestamp) server crm_auth_mysql options(table 'auth_aplicativos',rowid_column 'id_app');
create function crm_mysql.require_staff() returns void language plpgsql security definer set search_path=pg_catalog as $$ begin if auth.uid() is null or not public.is_staff() then raise exception 'Acesso não autorizado.'; end if; end $$;
create or replace function public.configuration_application_save(application_id uuid,application_payload jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_name text:=nullif(trim(application_payload->>'name'),'');v_type text:=upper(nullif(trim(application_payload->>'app_type'),''));v_build integer:=(nullif(trim(application_payload->>'build_version'),''))::integer;v_db integer:=(nullif(trim(application_payload->>'db_version'),''))::integer;v_image text:=nullif(trim(application_payload->>'image_url'),'');v_legacy bigint;v_saved uuid;
begin
 perform crm_mysql.require_staff();
 if v_name is null then raise exception 'Informe a descrição do aplicativo.'; end if;
 if length(v_name)>100 or length(v_type)>3 or length(v_image)>100 then raise exception 'Descrição/imagem: até 100 caracteres; tipo: até 3 caracteres.'; end if;
 perform crm_mysql.ensure_tls();
 if application_id is null then
 insert into crm_mysql.write_apps(app_type,app_build_version,app_db_version,app_description,app_image,created,modified) values(v_type,v_build,v_db,v_name,v_image,now() at time zone 'UTC',now() at time zone 'UTC');
 select id into v_saved from public.auth_aplicativos where name=v_name and app_type is not distinct from v_type order by legacy_id::bigint desc limit 1;
 else
 select legacy_id::bigint into v_legacy from public.auth_aplicativos where id=application_id;
 if v_legacy is null then raise exception 'Aplicativo não encontrado.'; end if;
 update crm_mysql.write_apps set app_description=v_name,app_type=v_type,app_build_version=v_build,app_db_version=v_db,app_image=v_image,modified=now() at time zone 'UTC' where id_app=v_legacy;
 v_saved:=application_id;
 end if;
 return v_saved;
end $$;
create or replace function public.configuration_application_delete(application_id uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$ declare v_legacy bigint; begin
 perform crm_mysql.require_staff();
 select legacy_id::bigint into v_legacy from public.auth_aplicativos where id=application_id;
 if v_legacy is null then raise exception 'Aplicativo não encontrado.'; end if;
 perform crm_mysql.ensure_tls();
 delete from crm_mysql.write_apps where id_app=v_legacy;
end $$;
-- All remote SQL is assembled by private functions. Values use hexadecimal literals.
create function crm_mysql.literal(value text) returns text language sql immutable as $$ select case when value is null then 'NULL' when value='' then chr(39)||chr(39) else 'CONVERT(0x'||encode(convert_to(value,'UTF8'),'hex')||' USING utf8mb4)' end $$;
create function crm_mysql.query(p_sql text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_name text:='crm_result_'||replace(gen_random_uuid()::text,'-','');v_result jsonb;
begin
 if p_sql !~ '^SELECT ' then raise exception 'Read queries only'; end if;
 perform crm_mysql.ensure_tls();
 -- Initializing pg_temp does not expose this schema to API callers.
 create temp table if not exists crm_mysql_temp_init(id int) on commit drop;
 execute format('create foreign table pg_temp.%I(payload text) server crm_auth_mysql options(table %L)',v_name,'('||p_sql||')');
 execute format('select payload::jsonb from pg_temp.%I',v_name) into v_result;
 execute format('drop foreign table pg_temp.%I',v_name);
 return v_result;
end $$;
create function crm_mysql.normalize_log(r jsonb) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$ declare client uuid;begin
 select id into client from public.clients where upper(acronym)=upper(r->>'log_cli_sigla') order by id limit 1;
 return jsonb_build_object('id',crm_mysql.identity('auth_logs',r->>'id'),'legacy_id',r->>'id','auth_usuario_id',case when r->>'auth_usuarios_id' is not null then crm_mysql.identity('auth_usuarios',r->>'auth_usuarios_id') end,'auth_usuario_legacy_id',r->>'auth_usuarios_id','client_id',client,'client_acronym',r->>'log_cli_sigla','controller',r->>'log_controller','action',r->>'log_action','operator',r->>'log_operador','agent',r->>'log_agent','device',r->>'log_device','ip_address',r->>'log_ip','url',r->>'log_url','info',r->>'log_info','params',crm_mysql.json_value(r->>'log_params'),'crm_created_at',crm_mysql.date_value(r->>'created'),'crm_updated_at',crm_mysql.date_value(r->>'modified'));
end $$;


create foreign table crm_mysql.write_logs(id bigint,log_controller text,log_action text,log_params text,log_ip text,log_agent text,log_device text,log_url text,auth_usuarios_id bigint,log_cli_sigla text,log_operador text,log_info text,created timestamp,modified timestamp) server crm_auth_mysql options(table 'auth_logs',rowid_column 'id');
create or replace function public.record_hadron_option_log(p_option_id text,p_action text,p_info text default null) returns uuid language plpgsql security definer set search_path=pg_catalog as $log$
declare v_id uuid:=gen_random_uuid();v_operator text;v_user bigint;v_params text;v_remote jsonb;
begin
 perform crm_mysql.require_staff();
 if trim(coalesce(p_option_id,''))='' then raise exception 'Opção não informada.';end if;
 if length(trim(p_action))>45 then raise exception 'Ação deve ter até 45 caracteres.';end if;
 select upper(trim(coalesce(c.operator_acronym,u.raw_user_meta_data->>'operator',u.email,''))) into v_operator from auth.users u left join public.tab_colaboradores c on c.profile_id=u.id where u.id=auth.uid() limit 1;
 select legacy_id::bigint into v_user from public.auth_usuarios where lower(email)=lower(auth.jwt()->>'email') and legacy_id ~ '^[0-9]+$' limit 1;
 v_params:=jsonb_build_array(trim(p_option_id),v_id::text)::text;
 if length(v_params)>250 or length(v_operator)>15 then raise exception 'Opção/operador excede o tamanho aceito pelo CRM de origem.';end if;
 perform crm_mysql.ensure_tls();
 insert into crm_mysql.write_logs(log_controller,log_action,log_params,log_agent,log_device,log_url,auth_usuarios_id,log_cli_sigla,log_operador,log_info,created,modified)
 values('CvsOptions',trim(p_action),v_params,'Prcion CRM','web','iniciar-hadron/opcoes/'||trim(p_option_id),v_user,'PRC',v_operator,nullif(trim(coalesce(p_info,'')),''),now() at time zone 'UTC',now() at time zone 'UTC');
 v_remote:=crm_mysql.query('SELECT JSON_OBJECT(''id'',id) AS payload FROM auth_logs WHERE log_params='||crm_mysql.literal(v_params)||' ORDER BY id DESC LIMIT 1');
 if v_remote->>'id' is not null then insert into crm_mysql.identities(source_table,legacy_id,id) values('auth_logs',v_remote->>'id',v_id) on conflict(source_table,legacy_id) do nothing;end if;
 return v_id;
end $log$;

-- Paginated log queries run in MySQL, rather than streaming millions of rows into PostgreSQL.
create table crm_mysql.log_metadata(id boolean primary key default true check(id),controllers jsonb not null default '[]',operators jsonb not null default '[]',checked_at timestamptz);
insert into crm_mysql.log_metadata(id) values(true);
create function crm_mysql.log_page(options jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 clauses text[]:=array['1=1'];conditions text;sort_column text;sort_direction text;v_limit int:=least(greatest(coalesce((options->>'limit')::int,25),1),200);v_offset int:=greatest(coalesce((options->>'offset')::int,0),0);
 r jsonb;v_result jsonb;remote_result jsonb;v_rows jsonb;local_rows jsonb;local_count int;remote_offset int;remote_limit int;
 metadata crm_mysql.log_metadata%rowtype;fields text;query_sql text;user_ids text;
begin
 if nullif(trim(options->>'operator'),'') is not null then clauses:=array_append(clauses,'log_operador='||crm_mysql.literal(trim(options->>'operator')));end if;
 if nullif(trim(options->>'controller'),'') is not null then clauses:=array_append(clauses,'log_controller='||crm_mysql.literal(trim(options->>'controller')));end if;
 if nullif(trim(options->>'acronym'),'') is not null then
  if options->>'acronym_mode'='contains' then clauses:=array_append(clauses,'log_cli_sigla LIKE '||crm_mysql.literal('%'||trim(options->>'acronym')||'%'));
  else clauses:=array_append(clauses,'log_cli_sigla='||crm_mysql.literal(trim(options->>'acronym')));end if;
 end if;
 if nullif(options->>'from','') is not null then clauses:=array_append(clauses,'created >= '||crm_mysql.literal(to_char((options->>'from')::timestamptz at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')));end if;
 if nullif(options->>'to','') is not null then clauses:=array_append(clauses,'created <= '||crm_mysql.literal(to_char((options->>'to')::timestamptz at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')));end if;
 if nullif(trim(options->>'search'),'') is not null then clauses:=array_append(clauses,'CONCAT_WS('' '',log_controller,log_action,log_cli_sigla,log_url,log_info,log_operador,log_device,log_ip) LIKE '||crm_mysql.literal('%'||trim(options->>'search')||'%'));end if;
 if nullif(trim(options->>'option'),'') is not null then clauses:=array_append(clauses,'(log_params='||crm_mysql.literal(trim(options->>'option'))||' OR (JSON_VALID(log_params) AND JSON_CONTAINS(log_params,'||crm_mysql.literal(to_jsonb(trim(options->>'option'))::text)||')))');end if;
 conditions:=array_to_string(clauses,' AND ');
 if options->>'include_client_users'='true' and nullif(options->>'acronym','') is not null then
  select string_agg(legacy_id,',') into user_ids from public.auth_usuarios where upper(client_acronym)=upper(options->>'acronym') and legacy_id ~ '^[0-9]+$';
  if user_ids is not null then conditions:='('||conditions||' OR auth_usuarios_id IN ('||user_ids||'))';end if;
 end if;
 sort_column:=case options->>'sort' when 'operator' then 'log_operador' when 'acronym' then 'log_cli_sigla' when 'controller' then 'log_controller' else 'created' end;
 sort_direction:=case when options->>'direction'='asc' then 'ASC' else 'DESC' end;
 select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb),count(*) into local_rows,local_count from crm_mysql.portal_logs l
 where (nullif(trim(options->>'operator'),'') is null or upper(l.operator)=upper(trim(options->>'operator')))
 and (nullif(trim(options->>'controller'),'') is null or l.controller=trim(options->>'controller'))
 and (nullif(trim(options->>'acronym'),'') is null or (options->>'acronym_mode'='contains' and upper(l.client_acronym) like '%'||upper(trim(options->>'acronym'))||'%') or upper(l.client_acronym)=upper(trim(options->>'acronym')))
 and (nullif(options->>'from','') is null or l.crm_created_at >= (options->>'from')::timestamptz)
 and (nullif(options->>'to','') is null or l.crm_created_at <= (options->>'to')::timestamptz)
 and (nullif(trim(options->>'search'),'') is null or concat_ws(' ',l.controller,l.action,l.client_acronym,l.url,l.info,l.operator,l.device,host(l.ip_address)) ilike '%'||trim(options->>'search')||'%')
 and (nullif(trim(options->>'option'),'') is null or l.params @> jsonb_build_array(trim(options->>'option')) or l.params #>> '{}' = trim(options->>'option'));
 remote_offset:=greatest(v_offset-local_count,0);remote_limit:=v_limit+local_count;
 fields:='JSON_OBJECT(''id'',id,''log_controller'',log_controller,''log_action'',log_action,''log_params'',log_params,''log_ip'',log_ip,''log_agent'',log_agent,''log_device'',log_device,''log_url'',log_url,''auth_usuarios_id'',auth_usuarios_id,''log_cli_sigla'',log_cli_sigla,''log_operador'',log_operador,''log_info'',log_info,''created'',created,''modified'',modified)';
 query_sql:='SELECT JSON_OBJECT(''rows'',(SELECT JSON_ARRAYAGG(row_payload) FROM (SELECT '||fields||' AS row_payload FROM auth_logs WHERE '||conditions||' ORDER BY '||sort_column||' '||sort_direction||',id '||sort_direction||' LIMIT '||remote_limit||' OFFSET '||remote_offset||') AS paged),''total'',(SELECT COUNT(*) FROM auth_logs WHERE '||conditions||')) AS payload';
 remote_result:=crm_mysql.query(query_sql);
 select coalesce(jsonb_agg(crm_mysql.normalize_log(item)),'[]'::jsonb) into v_rows from jsonb_array_elements(coalesce(nullif(remote_result->'rows','null'::jsonb),'[]'::jsonb)) item;
 v_rows:=v_rows||local_rows;
 select coalesce(jsonb_agg(item),'[]'::jsonb) into v_rows from (
 select item from jsonb_array_elements(v_rows) item order by
 case when sort_column='log_operador' and sort_direction='ASC' then item->>'operator' end asc nulls last,
 case when sort_column='log_operador' and sort_direction='DESC' then item->>'operator' end desc nulls last,
 case when sort_column='log_cli_sigla' and sort_direction='ASC' then item->>'client_acronym' end asc nulls last,
 case when sort_column='log_cli_sigla' and sort_direction='DESC' then item->>'client_acronym' end desc nulls last,
 case when sort_column='log_controller' and sort_direction='ASC' then item->>'controller' end asc nulls last,
 case when sort_column='log_controller' and sort_direction='DESC' then item->>'controller' end desc nulls last,
 case when sort_column='created' and sort_direction='ASC' then (item->>'crm_created_at')::timestamptz end asc nulls last,
 case when sort_column='created' and sort_direction='DESC' then (item->>'crm_created_at')::timestamptz end desc nulls last,
 case when sort_direction='ASC' and item->>'legacy_id' ~ '^[0-9]+$' then (item->>'legacy_id')::numeric end asc,
 case when sort_direction='DESC' then (case when item->>'legacy_id' ~ '^[0-9]+$' then (item->>'legacy_id')::numeric end) end desc nulls first,item->>'id'
 limit v_limit offset (v_offset-remote_offset)
 ) page;
 select * into metadata from crm_mysql.log_metadata where id;
 if metadata.checked_at is null or metadata.checked_at < now()-interval '1 hour' then
  r:=crm_mysql.query('SELECT JSON_OBJECT(''controllers'',(SELECT JSON_ARRAYAGG(log_controller) FROM (SELECT DISTINCT log_controller FROM auth_logs WHERE log_controller IS NOT NULL) c),''operators'',(SELECT JSON_ARRAYAGG(log_operador) FROM (SELECT DISTINCT log_operador FROM auth_logs WHERE log_operador IS NOT NULL AND log_operador<>'''') o)) AS payload');
  update crm_mysql.log_metadata set controllers=coalesce(r->'controllers','[]'),operators=coalesce(r->'operators','[]'),checked_at=now() where id returning * into metadata;
 end if;
 return jsonb_build_object('rows',v_rows,'total',coalesce((remote_result->>'total')::bigint,0)+local_count,'controllers',metadata.controllers,'operators',metadata.operators);
end $$;
create or replace function public.list_auth_logs(search text default null,controller_filter text default null,acronym_filter text default null,page_limit integer default 6,page_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ begin
 perform crm_mysql.require_staff();
 return crm_mysql.log_page(jsonb_build_object('search',search,'controller',controller_filter,'acronym',acronym_filter,'limit',page_limit,'offset',page_offset));
end $$;
create or replace function public.configuration_auth_logs_list(search_filter text default null,operator_filter text default null,acronym_filter text default null,from_filter timestamptz default null,to_filter timestamptz default null,page_limit integer default 25,page_offset integer default 0,sort_by text default 'created_at',sort_direction text default 'desc') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ begin
 perform crm_mysql.require_staff();
 return crm_mysql.log_page(jsonb_build_object('search',search_filter,'operator',operator_filter,'acronym',acronym_filter,'acronym_mode','contains','from',from_filter,'to',to_filter,'limit',page_limit,'offset',page_offset,'sort',sort_by,'direction',sort_direction));
end $$;
create or replace function public.configuration_auth_logs_list(search_filter text default null,operator_filter text default null,acronym_filter text default null,from_filter timestamptz default null,to_filter timestamptz default null,page_limit integer default 25,page_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ begin
 perform crm_mysql.require_staff();
 return crm_mysql.log_page(jsonb_build_object('search',search_filter,'operator',operator_filter,'acronym',acronym_filter,'acronym_mode','contains','from',from_filter,'to',to_filter,'limit',page_limit,'offset',page_offset));
end $$;
create or replace function public.list_hadron_option_logs(p_option_id text,p_limit integer default 2147483647) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ begin
 perform crm_mysql.require_staff();
 return crm_mysql.log_page(jsonb_build_object('controller','CvsOptions','option',trim(p_option_id),'limit',least(coalesce(p_limit,100),100)))->'rows';
end $$;
create or replace function public.get_crm_client_logs(client_acronym text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ declare target_client_id uuid;local_logs jsonb;external_logs jsonb;begin
 if not (public.is_admin_department_collaborator() or public.is_auth_s_admin()) then return jsonb_build_object('authorized',false,'logs','[]'::jsonb,'external_logs','[]'::jsonb);end if;
 select id into target_client_id from public.clients where upper(acronym)=upper(client_acronym) order by id limit 1;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into local_logs from (select h.* from public.tab_hadron_logs h where h.client_id=target_client_id or upper(h.client_acronym)=upper(get_crm_client_logs.client_acronym) or exists(select 1 from public.client_terminals t where t.client_id=target_client_id and nullif(trim(t.serial_number),'')=nullif(trim(h.serial_number),'')) order by h.crm_created_at desc nulls last limit 200) r;
 external_logs:=crm_mysql.log_page(jsonb_build_object('acronym',client_acronym,'include_client_users',true,'limit',200))->'rows';
 return jsonb_build_object('authorized',true,'logs',local_logs,'external_logs',external_logs);
end $$;
revoke all on all tables in schema crm_mysql from public,anon,authenticated;
revoke all on all functions in schema crm_mysql from public,anon,authenticated;
revoke all on foreign server crm_auth_mysql from public,anon,authenticated;
revoke all on foreign server crm_tls_initializer from public,anon,authenticated;
notify pgrst,'reload schema';
