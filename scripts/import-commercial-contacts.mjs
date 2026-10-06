import fs from 'node:fs';
import pg from 'pg';

const file = process.argv[2];
if (!file) throw new Error('Informe o arquivo contatos.json.');
const rows = JSON.parse(fs.readFileSync(file, 'utf8')).find(item => item.type === 'table' && item.name === 'contatos')?.data;
if (!Array.isArray(rows)) throw new Error('Tabela contatos não encontrada.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("set statement_timeout = '10min'");
  const inputCnpjs = [...new Set(rows.map(row => String(row.contato_cnpj || '').replace(/\D/g, '')).filter(value => value.length === 14))];
  const inputNames = [...new Set(rows.flatMap(row => [row.razao_social, row.nome_fantasia, row.nome]).filter(Boolean).map(value => value.toLowerCase()))];
  const existing = (await db.query("select id,cnpj,legal_name,trade_name,city,raw_payload->>'legacy_contact_id' as legacy_contact_id from public.company_leads where cnpj = any($1::text[]) or lower(legal_name) = any($2::text[]) or lower(trade_name) = any($2::text[])", [inputCnpjs, inputNames])).rows;
  console.log(JSON.stringify({ matchedExisting: existing.length }));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const names = new Set(existing.flatMap(row => [row.legal_name, row.trade_name].filter(Boolean).map(name => `${normalize(name)}|${normalize(row.city)}`)));
  const ids = new Set(existing.map(row => row.legacy_contact_id).filter(Boolean).map(String));
  const cnpjs = new Set(existing.map(row => String(row.cnpj || '').replace(/\D/g, '')).filter(Boolean));
  let inserted = 0, duplicate = 0, missingCnpj = 0;
  await db.query('begin');
  await db.query('alter table public.company_leads alter column cnpj drop not null');
  const stages = { 0: 'prospeccao', 5: 'relacionamento', 10: 'demonstracao', 20: 'proposta', 30: 'negociacao', 60: 'negocio_fechado', 90: 'sem_interesse' };
  const pending = [];
  for (const row of rows) {
    const name = row.razao_social || row.nome_fantasia || row.nome;
    const cnpj = String(row.contato_cnpj || '').replace(/\D/g, '');
    const key = `${normalize(name)}|${normalize(row.cidade)}`;
    if (!name || ids.has(String(row.id)) || names.has(key) || (cnpj && cnpjs.has(cnpj))) { duplicate++; continue; }
    const payload = { ...row, legacy_contact_id: String(row.id), import_source: 'contatos.json' };
    if (!(String(row.con_status_status) in stages)) throw new Error('Status desconhecido: ' + row.con_status_status);
    pending.push({cnpj: cnpj.length === 14 ? cnpj : null, legal_name: name, trade_name: row.nome_fantasia || row.nome, city: row.cidade || '', state: row.uf || '', postal_code: row.cep, neighborhood: row.bairro, address: [row.endereco,row.numero,row.complemento].filter(Boolean).join(', '), company_size: row.porte, stage: stages[row.con_status_status], source: 'crm-import', raw_payload: payload});
    names.add(key); ids.add(String(row.id)); if (cnpj.length === 14) cnpjs.add(cnpj);
  }
  const insertedIds = [];
  for (let offset = 0; offset < pending.length; offset += 250) {
    const result = await db.query(`insert into public.company_leads (cnpj,legal_name,trade_name,city,state,postal_code,neighborhood,address,company_size,stage,source,raw_payload)
      select cnpj,legal_name,trade_name,city,state,postal_code,neighborhood,address,company_size,stage,source,raw_payload from jsonb_populate_recordset(null::public.company_leads, $1::jsonb) on conflict do nothing returning id`, [JSON.stringify(pending.slice(offset, offset + 250))]);
    inserted += result.rowCount; duplicate += Math.min(250, pending.length-offset)-result.rowCount;
    insertedIds.push(...result.rows.map(row => row.id));
    console.log(JSON.stringify({ processed: Math.min(offset+250,pending.length), pending: pending.length }));
  }
  const verified = (await db.query('select stage,count(*)::int as count from public.company_leads where id = any($1::uuid[]) group by stage', [insertedIds])).rows;
  if (verified.reduce((sum,row) => sum+row.count,0) !== inserted) throw new Error('Contagem de verificação divergente.');
  await db.query('commit');
  console.log(JSON.stringify({ total: rows.length, inserted, duplicate, missingCnpj, verified }));
} catch (error) { await db.query('rollback'); throw error; }
finally { await db.end(); }
