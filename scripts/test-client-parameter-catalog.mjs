import fs from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  await db.query(
    fs.readFileSync("supabase/migrations/20261014210000_client_parameter_catalog.sql", "utf8"),
  );
  const sample = (
    await db.query(
      "select c.acronym from clients c join tab_cli_params p on p.client_id=c.id order by p.cvs_parameter_legacy_id limit 1",
    )
  ).rows[0];
  assert(sample);
  const rows = (await db.query("select get_crm_client_params($1) data", [sample.acronym])).rows[0]
    .data;
  assert(rows.length);
  for (const row of rows) {
    const catalog = (
      await db.query(
        "select payload from crm_catalog_records where entity='parameters' and record_id=$1 and not deleted",
        [row.parameter_legacy_id],
      )
    ).rows[0]?.payload;
    if (catalog) {
      assert.equal(row.title, catalog.title);
      assert.equal(row.description, catalog.description);
      assert.equal(row.text, catalog.message);
    }
  }
  const icms = (
    await db.query(
      "select payload from crm_catalog_records where entity='parameters' and record_id='1'",
    )
  ).rows[0].payload;
  assert.match(icms.message, /DECLARA/i);
  console.log(
    "Parâmetros conferidos: título, descrição, texto integral e declaração; " +
      rows.length +
      " registros.",
  );
  await db.query("rollback");
  if (process.argv.includes("--apply")) {
    await db.query(
      fs.readFileSync("supabase/migrations/20261014210000_client_parameter_catalog.sql", "utf8"),
    );
    console.log("Função atualizada sem alterar cadastros.");
  }
} catch (e) {
  await db.query("rollback");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
