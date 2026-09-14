import assert from "node:assert/strict";
import pg from "pg";

const client = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await client.connect();
try {
  await client.query("begin");
  const staff = await client.query("select id from public.profiles where active and role in ('admin','support','specialist') limit 1");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)",[staff.rows[0].id]);
  await client.query("set local role authenticated");
  const data = (await client.query("select public.get_hadron_overview() as data")).rows[0].data;
  const recent = await client.query("select id from public.hadron_occurrences order by occurred_at desc nulls last,id desc limit 12");
  assert.deepEqual(data.general.map((row) => String(row.id)),recent.rows.map((row) => String(row.id)));
  for (const row of data.review) assert.ok(row.solved_at && !row.reviewed_at);
  for (const option of data.options) {
    const count = await client.query("select count(*) from public.hadron_occurrences where option_legacy_id=$1 and kind='ocorrencia' and solved_at is null and reviewed_at is null",[option.option_legacy_id]);
    assert.equal(Number(option.count),Number(count.rows[0].count));
  }
  const sample = data.general[0];
  assert.ok(Object.hasOwn(sample,"occurrence_html") && Object.hasOwn(sample,"solution_html"));
  console.log("PASS: exact occurrence IDs, real option counts, pending reviews and original rich content.");
} finally {
  await client.query("rollback");
  await client.end();
}
