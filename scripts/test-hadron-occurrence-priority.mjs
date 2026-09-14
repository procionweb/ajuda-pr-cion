import assert from "node:assert/strict";
import pg from "pg";

const client = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await client.connect();
try {
  const staff = await client.query("select id from public.profiles where active and role in ('admin','support','specialist') limit 1");
  await client.query("begin");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)",[staff.rows[0].id]);
  await client.query("set local role authenticated");
  const created = await client.query("select public.create_hadron_occurrence('test','ocorrencia','Teste temporario','TEST','base-teste',null,2::smallint) as id");
  const id = created.rows[0].id;
  assert.equal((await client.query("select priority from public.hadron_occurrences where id=$1",[id])).rows[0].priority,2);
  await client.query("select public.set_hadron_occurrence_priority($1,0::smallint)",[id]);
  assert.equal((await client.query("select priority from public.hadron_occurrences where id=$1",[id])).rows[0].priority,0);
  const legacy = await client.query("select public.create_hadron_occurrence('test','ocorrencia','Teste temporario','TEST','base-teste',null) as id");
  assert.equal((await client.query("select priority from public.hadron_occurrences where id=$1",[legacy.rows[0].id])).rows[0].priority,1);
  await client.query("savepoint invalid_priority");
  await assert.rejects(client.query("select public.set_hadron_occurrence_priority($1,9::smallint)",[id]));
  await client.query("rollback to savepoint invalid_priority");
  await client.query("select set_config('request.jwt.claim.sub','',true)");
  await assert.rejects(client.query("select public.set_hadron_occurrence_priority($1,1::smallint)",[id]));
  console.log("PASS: create with priority, default, update, invalid value and unauthorized access; rolled back.");
} finally {
  await client.query("rollback");
  await client.end();
}
