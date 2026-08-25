import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = (
  process.env.CNPJ_BASE_URL || "https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos"
).replace(/\/$/, "");
const FORCE = process.argv.includes("--force");

if (!DATABASE_URL) throw new Error("Defina DATABASE_URL.");

async function latestCompetence() {
  const response = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Falha ao consultar competências: HTTP ${response.status}.`);
  const html = await response.text();
  const available = [...html.matchAll(/href=["'](\d{4}-\d{2}-\d{2})\/?["']/gi)]
    .map((match) => match[1])
    .sort();
  const competence = available.at(-1);
  if (!competence) throw new Error("Nenhuma competência encontrada no repositório.");
  return competence;
}

function runImporter(competence) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/import-receita-company-leads.mjs"], {
      cwd: path.resolve("."),
      env: { ...process.env, CNPJ_COMPETENCE: competence },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Importador encerrado com ${signal ? `sinal ${signal}` : `código ${code}`}.`));
    });
  });
}

const competence = await latestCompetence();
async function connectDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const database = new pg.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    database.on("error", (error) =>
      console.warn(`Conexão de controle interrompida: ${error.message}.`),
    );
    try {
      await database.connect();
      return database;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
  throw lastError;
}

let client = await connectDatabase();

let runId;
try {
  const current = await client.query(
    `select max(raw_payload->>'competence') as competence from public.company_leads`,
  );
  const importedCompetence = current.rows[0]?.competence || null;
  if (!FORCE && importedCompetence && importedCompetence >= competence) {
    console.log(`Competência ${competence} já importada. Nenhuma atualização necessária.`);
    process.exitCode = 0;
  } else {
    const inserted = await client.query(
      `insert into public.company_lead_sync_runs (competence, status, source_url)
       values ($1, 'running', $2)
       returning id`,
      [competence, `${BASE_URL}/${competence}/`],
    );
    runId = inserted.rows[0].id;
    console.log(`Iniciando atualização da competência ${competence}.`);
    await client.end();
    client = null;
    await runImporter(competence);
    client = await connectDatabase();
    const totals = await client.query(
      `select count(*)::bigint as leads,
              count(*) filter (where coalesce((raw_payload->>'simple')::boolean, false))::bigint as simples,
              count(*) filter (where coalesce((raw_payload->>'mei')::boolean, false))::bigint as mei
         from public.company_leads
        where raw_payload->>'competence' = $1`,
      [competence],
    );
    await client.query(
      `update public.company_lead_sync_runs
          set status = 'completed', finished_at = now(), statistics = $2::jsonb
        where id = $1`,
      [runId, JSON.stringify(totals.rows[0])],
    );
    console.log(`Competência ${competence} atualizada com sucesso.`);
  }
} catch (error) {
  if (runId) {
    if (!client) client = await connectDatabase();
    await client.query(
      `update public.company_lead_sync_runs
          set status = 'failed', finished_at = now(), error_message = left($2, 2000)
        where id = $1`,
      [runId, error instanceof Error ? error.message : String(error)],
    );
  }
  throw error;
} finally {
  if (client) await client.end();
}
