import fs from 'node:fs';
import pg from 'pg';
import webpush from 'web-push';
import { randomBytes } from 'node:crypto';

if (!process.argv.includes('--activate-production')) throw new Error('Use --activate-production somente após autorizar a ativação no banco real.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('begin');
  const migration = fs.readFileSync('supabase/migrations/20261009170000_background_web_push.sql', 'utf8');
  await db.query(migration);
  const existing = (await db.query('select singleton from public.crm_push_config where singleton')).rows[0];
  if (!existing) {
    const keys = webpush.generateVAPIDKeys();
    await db.query('insert into public.crm_push_config(singleton,public_key,private_key,dispatch_token,dispatch_url) values(true,$1,$2,$3,$4)', [
      keys.publicKey, keys.privateKey, randomBytes(32).toString('hex'),
      'https://ajuda-pr-cion.vercel.app/api/notifications/dispatch',
    ]);
  }
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3) on conflict(version) do nothing', [
    '20261009170000', 'background_web_push', [migration],
  ]);
  await db.query('commit');
  console.log('Push configurado: fila, permissões e envio a cada minuto. Chaves privadas preservadas no servidor.');
} catch (error) {
  await db.query('rollback');
  throw error;
} finally { await db.end(); }
