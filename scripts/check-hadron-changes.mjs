import pg from "pg";
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
try {
  await c.query("begin");
  const { rows } = await c.query(
    "select id from public.profiles where role in ('admin','support','specialist') limit 1",
  );
  if (!rows.length) throw new Error("No staff profile");
  await c.query("select set_config('request.jwt.claim.sub',$1,true)", [rows[0].id]);
  await c.query("set local role authenticated");
  await c.query("select public.process_hadron_checklist($1,$2,$3)", [
    "test-rollback",
    1,
    JSON.stringify([{ check_id: "test", checked: true }]),
  ]);
  await c.query("select public.process_hadron_checklist($1,$2,$3)", [
    "test-rollback",
    2,
    JSON.stringify([{ check_id: "test", checked: false }]),
  ]);
  const { rows: checks } = await c.query(
    "select check1,check2 from public.hadron_option_check_values where option_id='test-rollback'",
  );
  if (checks[0]?.check1 !== true || checks[0]?.check2 !== false)
    throw new Error("Checklist persistence failed");
  await c.query("select public.list_hadron_option_logs($1,$2)", ["1", 2147483647]);
  console.log("Checklist persistence and log query verified; test rolled back.");
} finally {
  await c.query("rollback");
  await c.end();
}
