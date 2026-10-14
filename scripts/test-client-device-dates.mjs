import fs from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  await db.query(
    fs.readFileSync("supabase/migrations/20261014200000_client_all_device_dates.sql", "utf8"),
  );
  const d = (await db.query("select get_crm_client($1) data", ["FKM"])).rows[0].data;
  const raw = (await db.query("select crm_mysql.client_bundle($1) data", ["FKM"])).rows[0].data
    .devices;
  assert.equal(d.internet.all_devices.length, raw.length);
  for (const row of d.internet.all_devices) {
    const source = raw.find((r) => String(r.id_dis) === row.legacy_id);
    assert(source);
    assert.equal(String(source._client_acronym).toUpperCase(), "FKM");
    assert.equal(row.tipo, source.dis_tipo);
    assert.equal(row.status, String(source.dis_status));
    assert.equal(!!row.created_at, !!source.created);
    assert(row.contract_key);
  }
  console.log(
    "Dispositivos completos conferidos no MySQL:",
    raw.length,
    "datas, tipo, status, contrato e isolamento do cliente.",
  );
  await db.query("rollback");
  if (process.argv.includes("--apply")) {
    await db.query(
      fs.readFileSync("supabase/migrations/20261014200000_client_all_device_dates.sql", "utf8"),
    );
    console.log("Migração aplicada sem alterar dispositivos.");
  }
} catch (e) {
  await db.query("rollback");
  console.error(e.message?.slice(0, 160));
  process.exitCode = 1;
} finally {
  await db.end();
}
