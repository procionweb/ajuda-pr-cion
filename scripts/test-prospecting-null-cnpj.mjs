import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import assert from "node:assert/strict";
import pg from "pg";
const source = fs.readFileSync("src/components/clients/CompanyLeadsTab.tsx", "utf8");
const fragment = source.slice(
  source.indexOf("const formatCnpj ="),
  source.indexOf("const formatPhone ="),
);
const exports = {};
vm.runInNewContext(
  ts.transpile(fragment + "\nexports.formatCnpj = formatCnpj;", { module: ts.ModuleKind.CommonJS }),
  { exports },
);
const format = exports.formatCnpj;
assert.equal(format(null), "—");
assert.equal(format(undefined), "—");
assert.equal(format(""), "—");
assert.equal(format("12345678000190"), "12.345.678/0001-90");
if (process.env.DATABASE_URL) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin read only");
    const result = (
      await db.query(
        "select company_leads_search($1::jsonb,$2::text,$3::text,$4::integer,$5::integer) data",
        [JSON.stringify({ city: "Catanduva", state: "SP" }), "opened_at", "desc", 50, 300],
      )
    ).rows[0].data;
    assert(result.rows.length);
    for (const lead of result.rows) assert.doesNotThrow(() => format(lead.cnpj));
    console.log(
      "Página 7 de Catanduva:",
      result.rows.length,
      "registros renderizáveis, incluindo",
      result.rows.filter((r) => r.cnpj == null).length,
      "sem CNPJ.",
    );
    await db.query("rollback");
  } finally {
    await db.end();
  }
}
console.log("Regressão de CNPJ nulo, vazio e máscara válida passou.");
