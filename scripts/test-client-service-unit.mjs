import fs from "node:fs";
import pg from "pg";
import assert from "node:assert/strict";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  await db.query(
    fs.readFileSync("supabase/migrations/20261014190000_client_service_unit.sql", "utf8"),
  );
  const units = (
    await db.query(
      "select crm_mysql.query('SELECT JSON_OBJECT(''rows'',(SELECT JSON_ARRAYAGG(JSON_OBJECT(''id'',emp_id,''city'',emp_cidade)) FROM procionw_prcsac.empresas)) AS payload') data",
    )
  ).rows[0].data.rows;
  for (const unit of units) {
    const selected = (
      await db.query(
        "select acronym,city from clients where coalesce(nullif(source_payload->>'empresa_id_emp',''),'1')=$1 limit 1",
        [String(unit.id)],
      )
    ).rows[0];
    if (!selected) continue;
    const loaded = (await db.query("select get_crm_client($1) data", [selected.acronym])).rows[0]
      .data;
    assert.equal(loaded.client.service_unit, unit.city);
    assert.equal(loaded.client.city, selected.city);
    assert.deepEqual(loaded.loadIssues, []);
    console.log("Atendimento conferido na tabela empresas, unidade " + unit.id);
  }
  await db.query("rollback");
  if (process.argv.includes("--apply")) {
    await db.query(
      fs.readFileSync("supabase/migrations/20261014190000_client_service_unit.sql", "utf8"),
    );
    console.log("Migração aplicada sem alterar cadastros.");
  }
} catch (e) {
  await db.query("rollback");
  console.log(e.message?.slice(0, 150));
  process.exitCode = 1;
} finally {
  await db.end();
}
