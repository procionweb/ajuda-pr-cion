import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import webpush from 'web-push';

// Every database change, including cron configuration, is rolled back.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('begin');
  await db.query(fs.readFileSync('supabase/migrations/20261009170000_background_web_push.sql', 'utf8'));
  const keys = webpush.generateVAPIDKeys(); const token = 'a'.repeat(64);
  await db.query('insert into public.crm_push_config(singleton,public_key,private_key,dispatch_token,dispatch_url) values(true,$1,$2,$3,$4) on conflict(singleton) do update set public_key=excluded.public_key,private_key=excluded.private_key,dispatch_token=excluded.dispatch_token', [keys.publicKey,keys.privateKey,token,'https://ajuda-pr-cion.vercel.app/api/notifications/dispatch']);
  const profiles = (await db.query('select id from public.profiles where active limit 2')).rows;
  assert.equal(profiles.length, 2);
  const [a,b] = profiles.map(p => p.id);
  const endpoint = 'https://fcm.googleapis.com/fcm/send/crm-rollback-test';
  const sub = { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [a]);
  await db.query('set local role authenticated');
  await db.query('select public.register_crm_push_subscription($1)', [sub]);
  await db.query('savepoint private_access');
  await assert.rejects(db.query('select private_key from public.crm_push_config'), e => e.code === '42501');
  await db.query('rollback to savepoint private_access');
  await db.query('savepoint invalid_endpoint');
  await assert.rejects(db.query('select public.register_crm_push_subscription($1)', [{...sub,endpoint:'https://evil.test/internal'}]));
  await db.query('rollback to savepoint invalid_endpoint');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [b]);
  await db.query('select public.register_crm_push_subscription($1)', [sub]);
  await db.query('reset role');
  assert.equal((await db.query('select profile_id from public.crm_push_subscriptions where endpoint=$1',[endpoint])).rows[0].profile_id,b);
  const notice = (await db.query("insert into public.notifications(profile_id,title,body,link) values($1,'Push rollback test','Test','/calendario') returning id",[b])).rows[0].id;
  await db.query('savepoint invalid_token');
  await assert.rejects(db.query('select public.claim_crm_push_deliveries($1)', ['invalid']),e => e.code === '42501');
  await db.query('rollback to savepoint invalid_token');
  const batch = (await db.query('select public.claim_crm_push_deliveries($1) as batch',[token])).rows[0].batch;
  const job = batch.jobs.find(j => j.payload.tag === 'crm:'+notice); assert(job);
  const simultaneous = (await db.query('select public.claim_crm_push_deliveries($1) as batch',[token])).rows[0].batch;
  assert(!simultaneous.jobs.some(j => j.id === job.id));
  await db.query('select public.finish_crm_push_delivery($1,$2,$3,503)',[token,job.id,job.leaseId]);
  const pending = (await db.query('select delivered_at,next_attempt_at>now() as delayed from public.crm_push_deliveries where id=$1',[job.id])).rows[0];
  assert.equal(pending.delivered_at,null); assert(pending.delayed);
  await db.query('update public.crm_push_deliveries set next_attempt_at=now() where id=$1',[job.id]);
  const again = (await db.query('select public.claim_crm_push_deliveries($1) as batch',[token])).rows[0].batch.jobs.find(j => j.id===job.id);
  assert(again); assert.notEqual(again.leaseId,job.leaseId);
  await db.query('select public.finish_crm_push_delivery($1,$2,$3,201)',[token,again.id,again.leaseId]);
  assert((await db.query('select delivered_at from public.crm_push_deliveries where id=$1',[job.id])).rows[0].delivered_at);
  const kind = (await db.query('select kind from public.calendar_events limit 1')).rows[0].kind;
  const event = (await db.query("insert into public.calendar_events(title,kind,starts_at,ends_at,responsible_id,created_by,status,reminder_enabled) values('Push reminder rollback',$1,now()+interval '10 minutes',now()+interval '20 minutes',$2,$3,'scheduled',true) returning id",[kind,b,a])).rows[0].id;
  await db.query('select public.generate_crm_calendar_reminders()');
  await db.query('select public.generate_crm_calendar_reminders()');
  assert.equal(Number((await db.query('select count(*) from public.notifications where source_key like $1',['calendar:'+event+':%'])).rows[0].count),1);
  await db.query('select public.finish_crm_push_delivery($1,$2,$3,410)',[token,again.id,again.leaseId]);
  assert.equal(Number((await db.query('select count(*) from public.crm_push_subscriptions where endpoint=$1',[endpoint])).rows[0].count),1);
  await db.query("insert into public.notifications(profile_id,title,body) values($1,'Endpoint expirado rollback','Test')",[b]);
  const expired = (await db.query('select public.claim_crm_push_deliveries($1) as batch',[token])).rows[0].batch.jobs.find(j => j.subscription.endpoint === endpoint);
  assert(expired);
  await db.query('select public.finish_crm_push_delivery($1,$2,$3,410)',[token,expired.id,expired.leaseId]);
  assert.equal(Number((await db.query('select count(*) from public.crm_push_subscriptions where endpoint=$1',[endpoint])).rows[0].count),0);
  const card = (await db.query('select id,source_payload from public.kanban_cards limit 1')).rows[0];
  if (card) {
    const payload = { ...card.source_payload, activity: [...(card.source_payload?.activity ?? []), { id: 'push-rollback-activity', text: 'Atividade de teste', authorOperator: '__test__', at: new Date().toISOString() }] };
    await db.query('update public.kanban_cards set source_payload=$1 where id=$2',[payload,card.id]);
    await db.query('update public.kanban_cards set source_payload=$1 where id=$2',[payload,card.id]);
    const duplicates = (await db.query('select profile_id,count(*) from public.notifications where source_key=$1 group by profile_id having count(*)>1',['kanban-activity:'+card.id+':push-rollback-activity'])).rows;
    assert.equal(duplicates.length,0);
  }
  console.log('Push SQL: isolamento, endpoints, leases, retry, confirmação e lembrete sem duplicação passaram. Tudo revertido.');
} finally { await db.query('rollback'); await db.end(); }
