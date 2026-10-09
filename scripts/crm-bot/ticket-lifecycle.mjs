import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const marker = `CRM_BOT_${randomUUID()}`;
const acronym = `BT${randomUUID().replaceAll('-', '').slice(0,8)}`;
let clientId;
try {
  await db.query('begin');
  clientId = (await db.query('insert into clients(acronym,legal_name,trade_name) values($1,$2,$2) returning id', [acronym, marker])).rows[0].id;
  const ticketId = randomUUID();
  await db.query('select support_create_ticket($1::jsonb)', [JSON.stringify({ id: ticketId, protocol: marker, subject: marker, clientCode: acronym, clientName: marker, description: 'Teste automático descartável', priority: 'Baixa' })]);
  let ticket = (await db.query('select * from tickets where legacy_id=$1', [ticketId])).rows[0];
  assert.equal(ticket.client_id, clientId);
  assert.equal(ticket.subject, marker);
  await db.query('select support_update_ticket($1,$2::jsonb,$3::jsonb)', [ticketId, JSON.stringify({ priority: 'Alta' }), JSON.stringify({ kind: 'manual', title: marker, description: 'Timeline manual de teste', metadata: { permission: 'Clientes' } })]);
  assert((await db.query('select 1 from ticket_events where ticket_id=$1 and title=$2', [ticket.id, marker])).rowCount === 1);
  await db.query('select support_update_ticket($1,$2::jsonb,null)', [ticketId, JSON.stringify({ status: 'Finalizado' })]);
  ticket = (await db.query('select * from tickets where legacy_id=$1', [ticketId])).rows[0];
  assert(ticket.finished_at, 'Finalização deve preencher data');
} finally {
  // PostgreSQL também reverte a transação se o processo cair e a conexão fechar.
  await db.query('rollback');
  if (clientId) assert.equal((await db.query('select 1 from clients where id=$1', [clientId])).rowCount, 0);
  assert.equal((await db.query('select 1 from tickets where protocol=$1', [marker])).rowCount, 0);
  await db.end();
}
console.log('Chamado: criar, adicionar timeline, alterar prioridade e finalizar. Dados removidos por rollback e ausência confirmada.');
