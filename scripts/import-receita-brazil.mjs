import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

const baseUrl = (
  process.env.CNPJ_BASE_URL || "https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos"
).replace(/\/$/, "");
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const requested = process.argv.find((arg) => arg.startsWith("--states="))?.slice(9);
const selectedStates = requested ? [...new Set(requested.toUpperCase().split(","))] : states;
if (!selectedStates.length || selectedStates.some((state) => !states.includes(state))) {
  throw new Error("Use --states=UF,UF com UFs válidas.");
}
if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL.");
const force = process.argv.includes("--force");

async function latestCompetence() {
  if (process.env.CNPJ_COMPETENCE) return process.env.CNPJ_COMPETENCE;
  const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Falha ao consultar competências: HTTP ${response.status}.`);
  const html = await response.text();
  const competence = [...html.matchAll(/href=["'](\d{4}-\d{2}-\d{2})\/?["']/gi)]
    .map((match) => match[1])
    .sort()
    .at(-1);
  if (!competence) throw new Error("Nenhuma competência encontrada.");
  return competence;
}

async function databaseQuery(query, values = []) {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    return await client.query(query, values);
  } finally {
    await client.end();
  }
}

function importState(state, competence) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CNPJ_COMPETENCE: competence };
    delete env.CNPJ_OPENED_FROM;
    delete env.CNPJ_OPENED_TO;
    delete env.CNPJ_TARGET_CITIES;
    const child = spawn(
      process.execPath,
      [
        path.resolve("scripts/import-receita-company-leads.mjs"),
        `--state=${state}`,
        "--insert-only",
        "--skip-partners",
      ],
      { cwd: path.resolve("."), env, stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Importação de ${state} terminou com código ${code}.`)),
    );
  });
}

const competence = await latestCompetence();
for (const state of selectedStates) {
  const sourceUrl = `${baseUrl}/${competence}/?state=${state}`;
  const completed = await databaseQuery(
    `select 1 from public.company_lead_sync_runs
      where competence = $1 and source_url = $2 and status = 'completed' limit 1`,
    [competence, sourceUrl],
  );
  if (completed.rowCount && !force) {
    console.log(`${state}: competência ${competence} já concluída.`);
    continue;
  }
  const before = await databaseQuery(
    `select count(*)::bigint as count from public.company_leads where state = $1`,
    [state],
  );
  const run = await databaseQuery(
    `insert into public.company_lead_sync_runs (competence, status, source_url)
     values ($1, 'running', $2) returning id`,
    [competence, sourceUrl],
  );
  const runId = run.rows[0].id;
  try {
    console.log(`${state}: iniciando importação de ${competence}.`);
    await importState(state, competence);
    const after = await databaseQuery(
      `select count(*)::bigint as count from public.company_leads where state = $1`,
      [state],
    );
    const inserted = Number(after.rows[0].count) - Number(before.rows[0].count);
    await databaseQuery(
      `update public.company_lead_sync_runs
       set status = 'completed', finished_at = now(), statistics = $2::jsonb where id = $1`,
      [
        runId,
        JSON.stringify({
          state,
          before: Number(before.rows[0].count),
          inserted,
          after: Number(after.rows[0].count),
        }),
      ],
    );
    console.log(`${state}: ${inserted.toLocaleString("pt-BR")} novos CNPJs.`);
  } catch (error) {
    await databaseQuery(
      `update public.company_lead_sync_runs
       set status = 'failed', finished_at = now(), error_message = left($2, 2000) where id = $1`,
      [runId, error instanceof Error ? error.message : String(error)],
    );
    throw error;
  }
}
