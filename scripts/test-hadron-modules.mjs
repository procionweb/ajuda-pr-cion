import assert from "node:assert/strict";
import pg from "pg";

const client = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await client.connect();
try {
  const staff = await client.query("select id from public.profiles where active and role in ('admin','support','specialist') limit 1");
  assert.ok(staff.rows.length, "No active staff profile");
  await client.query("begin");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [staff.rows[0].id]);
  await client.query("set local role authenticated");
  assert.equal((await client.query("select * from public.hadron_modules")).rowCount, 14);
  assert.equal((await client.query("update public.hadron_modules set nome=nome where id='1' returning id")).rowCount, 1);
  await client.query("insert into public.hadron_submodules(id,id_modulo,nome) values ('999999','1','Teste temporario')");
  assert.equal((await client.query("update public.hadron_submodules set nome='Teste editado' where id='999999' and id_modulo='1' returning nome")).rows[0].nome, "Teste editado");
  await client.query("rollback");
  await client.query("begin");
  await client.query("set local role authenticated");
  assert.equal((await client.query("select * from public.hadron_modules")).rowCount, 0);
  assert.equal((await client.query("update public.hadron_modules set nome=nome where id='1' returning id")).rowCount, 0);
  console.log("PASS: staff load/update/insert; unauthenticated access denied; test changes rolled back.");
} finally {
  await client.query("rollback");
  await client.end();
}
