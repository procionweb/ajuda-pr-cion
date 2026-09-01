import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

loadEnv(path.resolve(".env.local"));
loadEnv(path.resolve(".env"));

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const jsonDir = path.join(process.env.USERPROFILE || "", "Downloads", "json");
const companiesFile = option("--companies", path.join(jsonDir, "empresas.json"));
const historyFile = option("--history", path.join(jsonDir, "con_historicos.json"));

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");

function rows(file) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return json.find((item) => item.type === "table")?.data || [];
}

const companies = rows(companiesFile);
const histories = rows(historyFile);
const text = (value) => String(value ?? "").trim() || null;
const iso = (value) => {
  const clean = text(value);
  return clean && !clean.startsWith("0000-00-00") ? clean : null;
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
});

const migration = fs.readFileSync(
  path.resolve("supabase/migrations/20260901150000_configuration_companies_and_contact_history.sql"),
  "utf8",
);
await pool.query(migration);

for (const company of companies) {
  await pool.query(
    `insert into public.configuration_companies
      (legacy_id, document, legal_name, address, address_number, address_complement,
       neighborhood, postal_code, city, state, email, phone, responsible_name,
       responsible_phone, crm_created_at, crm_updated_at, source_payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     on conflict (legacy_id) do update set
       document=excluded.document, legal_name=excluded.legal_name, address=excluded.address,
       address_number=excluded.address_number, address_complement=excluded.address_complement,
       neighborhood=excluded.neighborhood, postal_code=excluded.postal_code,
       city=excluded.city, state=excluded.state, email=excluded.email, phone=excluded.phone,
       responsible_name=excluded.responsible_name, responsible_phone=excluded.responsible_phone,
       crm_created_at=excluded.crm_created_at, crm_updated_at=excluded.crm_updated_at,
       source_payload=excluded.source_payload, updated_at=now()`,
    [
      company.emp_id,
      text(company.emp_cnpj),
      text(company.emp_razao_social) || `Empresa ${company.emp_id}`,
      text(company.emp_logradouro),
      text(company.emp_numero),
      text(company.emp_complemento),
      text(company.emp_bairro),
      text(company.emp_cep),
      text(company.emp_cidade),
      text(company.emp_uf),
      text(company.emp_email),
      text(company.emp_fone_fax),
      text(company.emp_responsavel),
      text(company.emp_fone_responsavel),
      iso(company.created),
      iso(company.modified),
      JSON.stringify(company),
    ],
  );
}

for (let offset = 0; offset < histories.length; offset += 500) {
  const chunk = histories.slice(offset, offset + 500);
  const values = [];
  const placeholders = chunk.map((history, rowIndex) => {
    values.push(
      history.id,
      history.contatos_id,
      text(history.agendamentos_id),
      text(history.cvs_modules_id),
      text(history.cvs_submodules_id),
      text(history.status_contato),
      text(history.tipo),
      text(history.hora),
      iso(history.retorno),
      text(history.assunto),
      text(history.observacao),
      text(history.operador),
      text(history.con_status_status),
      text(history.status_inativo),
      text(history.cvs_modules_nome),
      text(history.cvs_submodules_nome),
      iso(history.created),
      iso(history.modified),
      JSON.stringify(history),
    );
    const start = rowIndex * 19;
    return `(${Array.from({ length: 19 }, (_, index) => `$${start + index + 1}`).join(",")})`;
  });

  await pool.query(
    `insert into public.commercial_contact_history
      (legacy_id, contact_legacy_id, appointment_legacy_id, module_legacy_id,
       submodule_legacy_id, contact_status, history_type, event_time, return_date,
       subject, observation_html, operator_code, status_code, inactive_status,
       module_name, submodule_name, crm_created_at, crm_updated_at, source_payload)
     values ${placeholders.join(",")}
     on conflict (legacy_id) do update set
       contact_legacy_id=excluded.contact_legacy_id,
       appointment_legacy_id=excluded.appointment_legacy_id,
       module_legacy_id=excluded.module_legacy_id,
       submodule_legacy_id=excluded.submodule_legacy_id,
       contact_status=excluded.contact_status, history_type=excluded.history_type,
       event_time=excluded.event_time, return_date=excluded.return_date,
       subject=excluded.subject, observation_html=excluded.observation_html,
       operator_code=excluded.operator_code, status_code=excluded.status_code,
       inactive_status=excluded.inactive_status, module_name=excluded.module_name,
       submodule_name=excluded.submodule_name, crm_created_at=excluded.crm_created_at,
       crm_updated_at=excluded.crm_updated_at, source_payload=excluded.source_payload,
       updated_at=now()`,
    values,
  );
}

const counts = await pool.query(`select
  (select count(*)::int from public.configuration_companies) as companies,
  (select count(*)::int from public.commercial_contact_history) as histories`);
console.log(JSON.stringify({ source: { companies: companies.length, histories: histories.length }, database: counts.rows[0] }, null, 2));
await pool.end();
