import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

loadEnv(path.resolve(".env.local"));
loadEnv(path.resolve(".env"));

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const sourceFile =
  fileIndex >= 0
    ? args[fileIndex + 1]
    : path.join(process.env.USERPROFILE || "", "Downloads", "tab_colaboradores.json");

if (!fs.existsSync(sourceFile)) {
  throw new Error(`Arquivo nao encontrado: ${sourceFile}`);
}

function tableRows(file) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const table = Array.isArray(json) ? json.find((item) => item.type === "table") : null;
  return table?.data || (Array.isArray(json) ? json : []);
}

const text = (value) => String(value ?? "").trim();
const nullable = (value) => text(value) || null;
const date = (value) => {
  const raw = text(value);
  if (!raw || raw === "0000-00-00" || raw.startsWith("1111-")) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};
const timestamp = (value) => {
  const raw = text(value);
  if (!raw || raw.startsWith("0000-")) return null;
  const parsed = new Date(raw.replace(" ", "T") + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? "" : "-03:00"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const rows = tableRows(sourceFile);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let imported = 0;
let active = 0;
let admins = 0;
let activeAdmins = 0;
let linkedProfiles = 0;

try {
  await pool.query("begin");

  for (const row of rows) {
    const legacyId = text(row.clb_id);
    if (!legacyId) continue;

    const email = text(row.clb_email).toLowerCase();
    const department = text(row.clb_departamento).toLowerCase();
    const isActive = text(row.clb_st) === "1";

    const result = await pool.query(
      `insert into public.tab_colaboradores
        (legacy_id, profile_id, first_name, last_name, full_name, email,
         clb_departamento, job_title, operator_acronym, operator_code, active,
         phone, personal_mobile, business_mobile, birth_date, cpf, pis, work_card,
         admitted_at, terminated_at, driver_license_type, driver_license_expires_at,
         company_legacy_id, source_created_at, source_updated_at)
       values (
         $1,
         (select profile.id from public.profiles profile
          where lower(profile.email) = $2 limit 1),
         $3::text, $4::text, nullif(trim(concat_ws(' ', $3::text, $4::text)), ''), nullif($2, ''),
         nullif($5, ''), $6, $7, $8, $9,
         $10, $11, $12, $13::date, $14, $15, $16, $17::date, $18::date,
         $19, $20::date, $21, $22::timestamptz, $23::timestamptz
       )
       on conflict (legacy_id) do update set
         profile_id = coalesce(excluded.profile_id, tab_colaboradores.profile_id),
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         full_name = excluded.full_name,
         email = excluded.email,
         clb_departamento = excluded.clb_departamento,
         job_title = excluded.job_title,
         operator_acronym = excluded.operator_acronym,
         operator_code = excluded.operator_code,
         active = excluded.active,
         phone = excluded.phone,
         personal_mobile = excluded.personal_mobile,
         business_mobile = excluded.business_mobile,
         birth_date = excluded.birth_date,
         cpf = excluded.cpf,
         pis = excluded.pis,
         work_card = excluded.work_card,
         admitted_at = excluded.admitted_at,
         terminated_at = excluded.terminated_at,
         driver_license_type = excluded.driver_license_type,
         driver_license_expires_at = excluded.driver_license_expires_at,
         company_legacy_id = excluded.company_legacy_id,
         source_created_at = excluded.source_created_at,
         source_updated_at = excluded.source_updated_at,
         updated_at = now()
       returning profile_id`,
      [
        legacyId,
        email,
        nullable(row.clb_nome),
        nullable(row.clb_sobrenome),
        department,
        nullable(row.clb_funcao),
        nullable(row.clb_operador),
        nullable(row.clb_cod_ope),
        isActive,
        nullable(row.clb_fone),
        nullable(row.clb_celular_p),
        nullable(row.clb_celular_c),
        date(row.clb_dt_nascimento),
        nullable(row.clb_cpf),
        nullable(row.clb_pis),
        nullable(row.clb_carteira),
        date(row.clb_admissao),
        date(row.clb_rescisao),
        nullable(row.clb_tipo_cnh),
        date(row.clb_vencimento_cnh),
        nullable(row.empresas_id),
        timestamp(row.created),
        timestamp(row.modified),
      ],
    );

    imported += 1;
    if (isActive) active += 1;
    if (department === "admin") admins += 1;
    if (department === "admin" && isActive) activeAdmins += 1;
    if (result.rows[0]?.profile_id) linkedProfiles += 1;
  }

  await pool.query("commit");

  const totals = await pool.query(
    `select
       count(*)::int as collaborators,
       count(*) filter (where active)::int as active_collaborators,
       count(*) filter (where lower(clb_departamento) = 'admin')::int as admins,
       count(*) filter (
         where active and lower(clb_departamento) = 'admin'
       )::int as active_admins
     from public.tab_colaboradores`,
  );

  console.log(
    JSON.stringify(
      {
        imported,
        active,
        admins,
        activeAdmins,
        linkedProfiles,
        database: totals.rows[0],
        source: path.basename(sourceFile),
        sensitiveFieldsImported: "CPF, PIS e dados de contato; senhas excluídas",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await pool.query("rollback").catch(() => {});
  throw error;
} finally {
  await pool.end();
}
