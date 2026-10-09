import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try {
 await db.query('begin');
 const before=(await db.query("select scope,payload from fleet_app_state where scope in ('fleet_core','fleet_entries') for update")).rows;
 const calendars=(await db.query('select id,app_metadata from calendar_events')).rows;
 const map={corolla:'gol-g4',tracker:'celta',onix:'mobi',strada:'saveiro-g5'};
 function normalize(v) { if(Array.isArray(v))return v.map(normalize); if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,((k==='vehicleId'||k==='vehicle_id'||(k==='id'&&'model'in v&&'plate'in v))&&map[x])||normalize(x)]));return v; }
 await db.query(fs.readFileSync('supabase/migrations/20261009193000_normalize_fleet_vehicle_ids.sql','utf8').replace(/^\uFEFF/,''));
 for(const row of before)assert.deepEqual((await db.query('select payload from fleet_app_state where scope=$1',[row.scope])).rows[0].payload,normalize(row.payload));
 const afterCalendar=new Map((await db.query('select id,app_metadata from calendar_events')).rows.map(r=>[r.id,r.app_metadata]));
 for(const row of calendars)assert.deepEqual(afterCalendar.get(row.id),normalize(row.app_metadata));
 const legacy={vehicles:[{id:'corolla',model:'Gol',plate:'TEST'}],usages:[{id:'usage-untouched',vehicleId:'corolla'}]};
 await db.query("update fleet_app_state set payload=$1 where scope='fleet_core'",[legacy]);
 assert.deepEqual((await db.query("select payload from fleet_app_state where scope='fleet_core'")).rows[0].payload,normalize(legacy));
 await db.query('rollback');
 console.log('Migração e proteção contra gravação antiga verificadas; histórico e demais campos preservados.');
 if(process.argv.includes('--apply')) {
   await db.query('begin');
   await db.query(fs.readFileSync('supabase/migrations/20261009193000_normalize_fleet_vehicle_ids.sql','utf8').replace(/^\uFEFF/,''));
   await db.query('commit');
   console.log('Correção aplicada ao banco.');
 }
} catch(e) {await db.query('rollback');throw e;} finally {await db.end();}
