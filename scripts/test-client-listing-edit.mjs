import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
const migration=fs.readFileSync('supabase/migrations/20261013140000_client_listing_edit.sql','utf8').replace(/^\uFEFF/,'');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try {
 await db.query('begin');await db.query(migration);
 assert.equal((await db.query("select has_function_privilege('anon','public.get_crm_client_listing_context()','EXECUTE') allowed")).rows[0].allowed,false);
 await db.query('savepoint anonymous');
 await assert.rejects(db.query('select get_crm_client_listing_context()'),e=>e.code==='42501');await db.query('rollback to savepoint anonymous');
 const admin=(await db.query("select id from auth.users where raw_app_meta_data->>'perfil'='s_admin' limit 1")).rows[0]?.id;
 assert(admin,'Conta de super admin necessária para testar a edição.');
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin]);
 const marker='BOT'+randomUUID().replaceAll('-','').slice(0,7);
 const client=(await db.query('insert into clients(acronym,name,legal_name,industry,source_payload) values($1::text,$1::text,$1::text,\'0\',\'{"keep":"unchanged"}\') returning id',[marker])).rows[0].id;
 const company=(await db.query("insert into client_companies(client_id,legacy_key,legal_name,source_payload) values($1,$2,'Empresa bot','{\"tcl_modulos\":\"{\\\"1\\\":\\\"\\\"}\",\"tcl_boleto_dados\":\"[]\",\"keep\":\"unchanged\"}') returning id",[client,marker])).rows[0].id;
 await db.query('select save_crm_client_edit($1,null,$2,$3,null)',[marker,{name:'Cliente alterado',legal_name:'Razão do cliente'},{cli_aviso:'Aviso bot'}]);
 assert.equal((await db.query('select legal_name from client_companies where id=$1',[company])).rows[0].legal_name,'Empresa bot');
 assert.equal((await db.query('select source_payload from clients where id=$1',[client])).rows[0].source_payload.keep,'unchanged');
 await db.query('select save_crm_client_edit($1,$2,$3,$4,null)',[marker,company,{legal_name:'Empresa alterada'},{tcl_modulos:'{"1":"","7":""}',tcl_boleto_dados:'["Registrado"]'}]);
 assert.equal((await db.query('select legal_name from clients where id=$1',[client])).rows[0].legal_name,'Razão do cliente');
 assert.equal((await db.query('select source_payload from client_companies where id=$1',[company])).rows[0].source_payload.keep,'unchanged');
 const context=(await db.query('select get_crm_client_listing_context() data')).rows[0].data.find(c=>c.acronym===marker);
 assert.equal(context.companies[0].legal_name,'Empresa alterada');assert.equal(context.source.cli_aviso,'Aviso bot');assert(!('keep' in context.source));
 assert.equal((await db.query('select count(*)::int count from crm_client_edit_audit where client_id=$1',[client])).rows[0].count,2);
 await db.query('savepoint foreign_company');
 await assert.rejects(db.query('select save_crm_client_edit($1,$2,$3,$4,null)',[marker,randomUUID(),{legal_name:'Wrong'},{}]));await db.query('rollback to savepoint foreign_company');
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.query('savepoint permission');await assert.rejects(db.query('select save_crm_client_edit($1,null,$2,$3,null)',[marker,{name:'No access'},{}]),e=>e.code==='42501');await db.query('rollback to savepoint permission');
 const restricted=(await db.query("select u.id from auth.users u left join tab_colaboradores c on c.profile_id=u.id where coalesce(u.raw_app_meta_data->>'perfil','prc')<>'s_admin' and coalesce(c.clb_departamento,'') not in ('admin','commercial') limit 1")).rows[0]?.id;
 if(restricted){await db.query("select set_config('request.jwt.claim.sub',$1,true)",[restricted]);await db.query('savepoint restricted');await assert.rejects(db.query('select get_crm_client_edit_data($1)',[marker]),e=>e.code==='42501');await db.query('rollback to savepoint restricted');}
 await db.query('rollback');
 assert.equal((await db.query('select 1 from clients where id=$1',[client])).rowCount,0);
 console.log('Filtros e edição: permissões, isolamento de cliente/empresa, preservação de dados e auditoria passaram. Registros revertidos.');
 if(process.argv.includes('--apply')){await db.query('begin');await db.query(migration);await db.query('commit');console.log('Migração aplicada.');}
} catch(e){await db.query('rollback');throw e;} finally {await db.end();}
