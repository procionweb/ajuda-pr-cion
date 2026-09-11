import fs from "node:fs";
import process from "node:process";
import pg from "pg";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Informe o caminho de cvs_occurrences.json.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const payload = JSON.parse(fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
const source = payload.find((entry) => entry.type === "table" && entry.name === "cvs_occurrences");
if (!source || !Array.isArray(source.data)) throw new Error("Tabela cvs_occurrences não encontrada.");

function text(value) {
  return value === null || value === undefined ? null : String(value).trim() || null;
}

function legacyDate(value) {
  const normalized = text(value);
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T00:00:00-03:00`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace(" ", "T")}-03:00`;
  }
  return normalized;
}

function plainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

const rows = source.data.map((row) => ({
  id: Number(row.id),
  option_legacy_id: text(row.cvs_options_id),
  kind: text(row.tipo) || "ocorrencia",
  occurrence_html: String(row.ocorrencia || ""),
  occurrence_text: plainText(row.ocorrencia),
  reporter: text(row.usuario_ocorrencia),
  occurred_at: legacyDate(row.data_ocorrencia),
  solution_html: String(row.solucao || ""),
  solution_text: plainText(row.solucao),
  solver: text(row.usuario_solucao),
  solved_at: legacyDate(row.data_solucao),
  reviewed_at: legacyDate(row.data_revisao),
  approved_at: legacyDate(row.data_aprovado),
  modified_by: text(row.usuario_modificado),
  operating_system: text(row.sist_operacional),
  test_base: text(row.base_testes),
  version_legacy_id: text(row.cvs_versions_id),
  parent_occurrence_id: text(row.cvs_occurrences_id),
  cobol_error: text(row.cobol_error),
  status: text(row.status),
  hadron_at: legacyDate(row.data_hadron),
  base_address: text(row.endereco_base),
  source_created_at: legacyDate(row.created),
  source_modified_at: legacyDate(row.modified),
  imported_at: new Date().toISOString(),
}));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  for (let start = 0; start < rows.length; start += 500) {
    const batch = rows.slice(start, start + 500);
    await client.query(
      `insert into public.hadron_occurrences
       select * from jsonb_populate_recordset(null::public.hadron_occurrences, $1::jsonb)
       on conflict (id) do update set
         option_legacy_id = excluded.option_legacy_id, kind = excluded.kind,
         occurrence_html = excluded.occurrence_html, occurrence_text = excluded.occurrence_text,
         reporter = excluded.reporter, occurred_at = excluded.occurred_at,
         solution_html = excluded.solution_html, solution_text = excluded.solution_text,
         solver = excluded.solver, solved_at = excluded.solved_at,
         reviewed_at = excluded.reviewed_at, approved_at = excluded.approved_at,
         modified_by = excluded.modified_by, operating_system = excluded.operating_system,
         test_base = excluded.test_base, version_legacy_id = excluded.version_legacy_id,
         parent_occurrence_id = excluded.parent_occurrence_id, cobol_error = excluded.cobol_error,
         status = excluded.status, hadron_at = excluded.hadron_at,
         base_address = excluded.base_address, source_created_at = excluded.source_created_at,
         source_modified_at = excluded.source_modified_at, imported_at = now()`,
      [JSON.stringify(batch)],
    );
  }
  await client.query("commit");
  console.log(`Ocorrências importadas: ${rows.length}.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
