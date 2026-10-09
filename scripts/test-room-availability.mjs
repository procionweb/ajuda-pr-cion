import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const exported = {};
vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/room-availability.ts','utf8'), { module: ts.ModuleKind.CommonJS }), { exports: exported });
const event = { id: 'one', date: '2099-01-01', time: '09:00', end: '12:00', room: 'Sala Diretoria', type: 'Reunião na Prócion', status: 'Agendado' };
const query = { events: [event], room: event.room, date: event.date, startTime: '10:00', endTime: '11:00' };
assert(exported.findRoomConflict(query));
assert(exported.findRoomConflict({ ...query, startTime: '08:00', endTime: '10:00' }));
assert(exported.findRoomConflict({ ...query, startTime: '11:00', endTime: '13:00' }));
assert(!exported.findRoomConflict({ ...query, startTime: '12:00', endTime: '13:00' }));
assert(!exported.findRoomConflict({ ...query, room: 'Auditório' }));
assert(!exported.findRoomConflict({ ...query, date: '2099-01-02' }));
assert(!exported.findRoomConflict({ ...query, ignoreEventId: event.id }));
for (const status of ['Cancelado','Concluído']) assert(!exported.findRoomConflict({ ...query, events: [{ ...event,status }] }));
assert(!exported.findRoomConflict({ ...query, events: [{ ...event,type: 'Reunião remota' }] }));
console.log('Salas frontend: sobreposição, limites, edição, outra sala/data e cancelamento passaram.');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada para testar a proteção do banco.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('begin');
  await db.query(fs.readFileSync('supabase/migrations/20261009180000_calendar_room_conflicts.sql','utf8'));
  const room = 'Sala teste '+randomUUID();
  const insert = async (start, end, overrides = {}) => (await db.query(
    "insert into public.calendar_events(title,kind,room,starts_at,ends_at,status) values('Room rollback test','procion_meeting',$1,$2,$3,$4) returning id",
    [overrides.room ?? room, overrides.date ? overrides.date+'T'+start+':00Z' : '2099-01-01T'+start+':00Z', overrides.date ? overrides.date+'T'+end+':00Z' : '2099-01-01T'+end+':00Z', overrides.status ?? 'scheduled'],
  )).rows[0].id;
  const reject = async action => {
    await db.query('savepoint room_conflict');
    await assert.rejects(action(), e => e.code === '23P01');
    await db.query('rollback to savepoint room_conflict');
  };
  const first = await insert('09:00','12:00');
  await reject(() => insert('09:00','12:00'));
  await reject(() => insert('10:00','11:00'));
  await reject(() => insert('08:00','10:00'));
  await reject(() => insert('11:00','13:00'));
  await insert('12:00','13:00');
  const other = await insert('10:00','11:00', { room: room+' outra' });
  await reject(() => db.query('update public.calendar_events set room=$1 where id=$2',[room,other]));
  await insert('10:00','11:00', { date: '2099-01-02' });
  await insert('10:00','11:00', { status: 'cancelled' });
  await insert('10:00','11:00', { status: 'completed' });
  await db.query('update public.calendar_events set room=room where id=$1',[first]);
  await db.query("update public.calendar_events set status='cancelled' where id=$1",[first]);
  await insert('10:00','11:00');
  console.log('Salas banco: criação, edição, sobreposições, limite de término e liberação passaram. Todos os registros e a migration foram revertidos.');
} finally { await db.query('rollback'); await db.end(); }
