import fs from 'node:fs';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';
const sql=fs.readFileSync('supabase/migrations/20261014130000_separate_client_company_forms.sql','utf8').replace(/^\uFEFF/,'');const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const originalQuery=db.query.bind(db);db.query=(text,values)=>originalQuery(text,values?.map(v=>Array.isArray(v)?JSON.stringify(v):v));let clientId;
try {
 await db.query('begin');await db.query(sql);
 // Isolar completamente a escrita do contrato: tabela local temporária na transação,
 // substituindo a tabela estrangeira. Nenhum contrato MySQL real é alterado no teste.
 await db.query('drop foreign table crm_mysql.client_edit_contracts');
 await db.query('create table crm_mysql.client_edit_contracts(id_con bigint primary key,con_cliente_sigla text,con_chave text,con_descricao text,con_status smallint,con_web_apps text,con_operador_mod text,created timestamp,modified timestamp)');
 const admin=(await db.query("select id from auth.users where raw_app_meta_data->>'perfil'='s_admin' limit 1")).rows[0].id;await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin]);
 const marker='BOT'+randomUUID().replaceAll('-','').slice(0,7);
 clientId=(await db.query("insert into clients(acronym,name,legal_name,source_payload) values($1::text,$1::text,$1::text,'{\"empresa_id_emp\":\"1\",\"cli_obs\":\"Atividades\"}') returning id",[marker])).rows[0].id;
 const other=(await db.query("insert into clients(acronym,name,legal_name) values($1::text,$1::text,$1::text) returning id",[marker.slice(0,9)+'X'])).rows[0].id;
 const company=(await db.query("insert into client_companies(client_id,legacy_key,legal_name,source_payload) values($1,$2,'Empresa bot','{\"tcl_modulos\":\"{\\\"1\\\":\\\"\\\"}\",\"tcl_boleto_dados\":\"[]\"}') returning id",[clientId,marker])).rows[0].id;
 const deleted=(await db.query("insert into client_contacts(client_id,name,phone) values($1,'Excluir','11999999999') returning id",[clientId])).rows[0].id;
 const retained=(await db.query("insert into client_contacts(client_id,name,phone,email) values($1,'Contato','11888888888','fixture@example.invalid') returning id",[clientId])).rows[0].id;
 const foreign=(await db.query("insert into client_contacts(client_id,name,email) values($1,'Outro','other@example.invalid') returning id",[other])).rows[0].id;
 await db.query("insert into crm_mysql.client_edit_contracts(id_con,con_cliente_sigla,con_chave,con_web_apps,con_status) values(1,$1,'FIX123','[\"MOB\"]',1),(99,'OTHER_FIXTURE','FIX456','[\"WEB\"]',1)",[marker]);
 const read=(await db.query('select get_crm_client_edit_data_v2($1,$2) data',[marker,company])).rows[0].data;assert.deepEqual(read.webApps,['MOB']);assert.equal(read.applications.length,5);assert(!JSON.stringify(read).includes('FIX123'));
 assert(!('webApps' in (await db.query('select get_crm_client_edit_data_v2($1,null) data',[marker])).rows[0].data));
 const added=randomUUID();await db.query('select save_crm_client_edit_v2($1,null,$2,$3,$4,null)',[marker,{name:'Cliente ajustado',legal_name:'Razão do cliente'},{empresa_id_emp:'25',cli_obs:'Novas atividades'},[{id:deleted,_delete:true},{id:retained,name:'Contato alterado',phone:'',email:'fixture@example.invalid'},{id:added,name:'Novo',phone:'11777777777'}]]);
 assert.equal((await db.query('select 1 from client_contacts where id=$1',[deleted])).rowCount,0);assert.equal((await db.query('select email from client_contacts where id=$1',[retained])).rows[0].email,'fixture@example.invalid');assert.equal((await db.query('select client_id from client_contacts where id=$1',[added])).rows[0].client_id,clientId);
 assert.equal((await db.query('select source_payload from clients where id=$1',[clientId])).rows[0].source_payload.empresa_id_emp,'25');
 await db.query('select save_crm_client_edit_v2($1,$2,$3,$4,null,$5)',[marker,company,{legal_name:'Empresa ajustada'},{tcl_responsavel:'{"cli_res_nome":"Responsável","cli_res_rg":"123"}',tcl_contador:'{"cli_ctd_nome":"Escritório"}'},['WEB','EXE']]);
 assert.deepEqual(JSON.parse((await db.query('select con_web_apps from crm_mysql.client_edit_contracts where id_con=1')).rows[0].con_web_apps),['WEB','EXE']);assert.equal((await db.query('select con_web_apps from crm_mysql.client_edit_contracts where id_con=99')).rows[0].con_web_apps,'["WEB"]');
 assert.equal((await db.query('select source_payload from client_companies where id=$1',[company])).rows[0].source_payload.tcl_modulos,'{"1":""}');
 await db.query('savepoint foreign_contact');await assert.rejects(db.query('select save_crm_client_edit_v2($1,null,$2,$3,$4,null)',[marker,{name:'Incorreto'},{},[{id:foreign,_delete:true}]]));await db.query('rollback to savepoint foreign_contact');assert.equal((await db.query('select name from clients where id=$1',[clientId])).rows[0].name,'Cliente ajustado');
 await db.query('savepoint invalid_app');await assert.rejects(db.query('select save_crm_client_edit_v2($1,$2,$3,$4,null,$5)',[marker,company,{}, {},['INVALID']]));await db.query('rollback to savepoint invalid_app');
 await db.query('delete from crm_mysql.client_edit_contracts where id_con=1');await db.query('select save_crm_client_edit_v2($1,$2,$3,$4,null,$5)',[marker,company,{}, {},['MOB']]);assert.equal((await db.query('select length(con_chave)::int length from crm_mysql.client_edit_contracts where con_cliente_sigla=$1',[marker])).rows[0].length,6);
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.query('savepoint unauthorized');await assert.rejects(db.query('select get_crm_client_edit_data_v2($1,$2)',[marker,company]),e=>e.code==='42501');await db.query('rollback to savepoint unauthorized');
 await db.query('rollback');assert.equal((await db.query('select 1 from clients where id=$1',[clientId])).rowCount,0);
 console.log('Formulários separados, unidade, atividades, contatos, aplicações web, preservação e permissões passaram. Escrita remota simulada; dados revertidos.');
 if(process.argv.includes('--apply')){await db.query('begin');await db.query(sql);await db.query('commit');console.log('Migração aplicada sem alterar dados de clientes ou contratos.');}
} catch(e){await db.query('rollback');throw e;} finally{await db.end();}
