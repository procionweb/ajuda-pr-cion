import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import pg from "pg";

const root = process.cwd();
const cache = new Map();
function loadModule(filename) {
  if (!path.extname(filename)) filename += ".ts";
  if (cache.has(filename)) return cache.get(filename);
  if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (specifier) => {
    const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    return loadModule(target);
  } }, { filename });
  return module.exports;
}
const from = (name) => loadModule(path.join(root, "src/lib", name));
const parameters = loadModule(path.join(root, "src/data/cvs-parameters.json")).find((entry) => entry.type === "table").data;
const displayDate = (value) => `${value.slice(0, 10).split("-").reverse().join("/")} ${value.slice(11, 16)}`;
const decode = (value) => value.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const catalogs = {
  options: from("hadron-options").hadronOptions,
  releases: from("hadron-releases").hadronReleases,
  articles: from("cvs-catalogs-imported").cvsArticles,
  checklist: from("hadron-checklist").hadronChecklist,
  serials: from("hadron-serials").hadronSerials,
  versions: from("erp-versions").erpVersions,
  parameters: parameters.map((row) => ({
    id: row.id, option: row.cvs_options_opcao || "", form: row.cvs_options_formulario || "",
    title: row.par_title, description: row.par_description, message: row.par_text,
    legends: Object.values(JSON.parse(row.par_options_data)).map((item) => ({ title: decode(item.par_tlt), caption: decode(item.par_leg) }))
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { numeric: true })),
    createdAt: displayDate(row.created), updatedAt: displayDate(row.modified),
  })),
};
const templateSource = ts.createSourceFile("templates.ts", fs.readFileSync(path.join(root, "src/lib/kanban-templates.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const templateDeclaration = templateSource.statements.filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations]).find((declaration) => declaration.name.getText(templateSource) === "defaultTemplates");
catalogs.kanban_templates = vm.runInNewContext(ts.transpileModule(`const templates = ${templateDeclaration.initializer.getText(templateSource)}; templates;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
console.log(Object.fromEntries(Object.entries(catalogs).map(([key, rows]) => [key, rows.length])));
if (!process.argv.includes("--apply")) process.exit(0);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  const { rows: existing } = await client.query("select to_regclass('public.crm_catalog_records') as name, to_regprocedure('public.import_crm_catalog_records(text,jsonb)') as importer");
  if (!existing[0].name || !existing[0].importer) throw new Error("Apply the Supabase migrations before seeding the CRM catalogs.");
  for (const [entity, rows] of Object.entries(catalogs)) {
    for (let offset = 0; offset < rows.length; offset += 100) {
      const records = rows.slice(offset, offset + 100).map((payload) => ({ id: String(Array.isArray(payload) ? payload[0] : payload.id), payload }));
      await client.query(`insert into public.crm_catalog_records(entity,record_id,payload)
        select $1, item->>'id', item->'payload' from jsonb_array_elements($2::jsonb) item
        on conflict(entity,record_id) do nothing`, [entity, JSON.stringify(records)]);
    }
  }
  await client.query("commit");
  console.log("Catalogs migrated without overwriting existing records.");
} catch (error) { await client.query("rollback"); throw error; }
finally { await client.end(); }
