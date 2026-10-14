import fs from "node:fs";
import pg from "pg";
import assert from "node:assert/strict";
const sql = fs.readFileSync(
  "supabase/migrations/20261014180000_filtered_client_details.sql",
  "utf8",
);
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
await db.connect();
try {
  await db.query("begin");
  await db.query("set local statement_timeout='15s'");
  const clients = (
    await db.query(
      "select acronym from clients where acronym in ('TMG','MAG','MGC') order by acronym",
    )
  ).rows;
  assert(clients.length >= 2, "São necessários dois clientes existentes para comparar a consulta.");
  const before = [];
  for (const { acronym } of clients)
    before.push((await db.query("select get_crm_client($1) data", [acronym])).rows[0].data);
  await db.query(sql);
  for (let i = 0; i < clients.length; i++) {
    const start = Date.now();
    const after = (await db.query("select get_crm_client($1) data", [clients[i].acronym])).rows[0]
      .data;
    assert.equal(after.loadIssues.length, 0, "Consulta remota deve concluir");
    delete after.loadIssues;
    delete before[i].loadIssues;
    assert(
      JSON.stringify(after) === JSON.stringify(before[i]),
      "Os dados antigos e novos devem coincidir",
    );
    console.log("Dados completos preservados: " + (Date.now() - start) + "ms");
  }
  assert.equal(
    (await db.query("select get_crm_client($1) data", ["__missing_crm_fixture__"])).rows[0].data,
    null,
  );
  await db.query("savepoint unavailable");
  await db.query(
    "create or replace function crm_mysql.client_bundle(p_acronym text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$ begin raise exception 'Simulated remote timeout' using errcode='57014'; end $$",
  );
  const partial = (await db.query("select get_crm_client($1) data", [clients[0].acronym])).rows[0]
    .data;
  assert.equal(partial.client.id, before[0].client.id);
  assert.deepEqual(partial.companies, before[0].companies);
  assert.equal(partial.loadIssues.length, 1);
  await db.query("rollback to savepoint unavailable");
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','crm_mysql.client_bundle(text)','execute') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await db.query("rollback");
  console.log(
    "Equivalência, consulta ausente, falha remota isolada e permissões passaram. Transação revertida.",
  );
  if (process.argv.includes("--apply")) {
    await db.query(sql);
    console.log("Migração aplicada sem alterar cadastros.");
  }
} catch {
  await db.query("rollback");
  console.error("Falhou a validação da consulta de clientes.");
  process.exitCode = 1;
} finally {
  await db.end();
}
