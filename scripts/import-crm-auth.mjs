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

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
const files = {
  users: option("--users", path.join(downloads, "auth_usuarios.json")),
  logs: option("--logs", path.join(downloads, "auth_logs.json")),
};

function tableRows(file) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const table = Array.isArray(json) ? json.find((item) => item.type === "table") : null;
  return table?.data || [];
}

const text = (value) => String(value ?? "").trim();
const iso = (value) => {
  const clean = text(value);
  return !clean || clean.startsWith("0000-00-00") ? null : clean;
};
const active = (value) => ["1", "true", "ativo", "active"].includes(text(value).toLowerCase());
const jsonValue = (value) => {
  const clean = text(value);
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch {
    return { raw: clean };
  }
};
const ip = (value) => {
  const clean = text(value);
  return clean && /^[0-9a-f:.]+$/i.test(clean) ? clean : null;
};

const userRows = tableRows(files.users);
const logRows = tableRows(files.logs);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
});

let usersImported = 0;
let usersLinked = 0;
let logsImported = 0;
let logsLinkedToUsers = 0;
let logsLinkedToClients = 0;

try {
  const sourceMode = await pool.query(
    "select relkind from pg_class where oid=to_regclass('public.auth_usuarios')",
  );
  if (sourceMode.rows[0]?.relkind === "v") {
    throw new Error("Esta base usa MySQL ao vivo. A importação de cópias locais está desativada.");
  }

  const migration = path.resolve("supabase/migrations/20260724203000_auth_users_logs.sql");
  await pool.query(fs.readFileSync(migration, "utf8"));
  await pool.query("begin");

  const clients = await pool.query("select id, acronym from public.clients");
  const clientByAcronym = new Map(
    clients.rows.map((client) => [text(client.acronym).toUpperCase(), client.id]),
  );

  for (const row of userRows) {
    const legacyId = text(row.id);
    if (!legacyId) continue;
    const acronym = text(row.tab_clientes_cli_sigla).toUpperCase();
    const clientId = clientByAcronym.get(acronym) || null;
    await pool.query(
      `insert into public.auth_usuarios
        (legacy_id, client_id, client_acronym, name, email, operator, hadron_code,
         representative_code, profile, status, active, crm_created_at, crm_updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (legacy_id) do update set
         client_id=excluded.client_id, client_acronym=excluded.client_acronym,
         name=excluded.name, email=excluded.email, operator=excluded.operator,
         hadron_code=excluded.hadron_code, representative_code=excluded.representative_code,
         profile=excluded.profile, status=excluded.status, active=excluded.active,
         crm_created_at=excluded.crm_created_at, crm_updated_at=excluded.crm_updated_at,
         updated_at=now()`,
      [
        legacyId,
        clientId,
        acronym || null,
        text(row.aus_nome) || null,
        text(row.aus_email) || null,
        text(row.aus_operador) || null,
        text(row.aus_cod_hadron) || null,
        text(row.aus_codrep) || null,
        text(row.aus_perfil) || null,
        text(row.aus_status) || null,
        active(row.aus_ativo),
        iso(row.created),
        iso(row.modified),
      ],
    );
    usersImported += 1;
    if (clientId) usersLinked += 1;
  }

  const importedUsers = await pool.query("select id, legacy_id from public.auth_usuarios");
  const userByLegacyId = new Map(importedUsers.rows.map((user) => [text(user.legacy_id), user.id]));

  for (const row of logRows) {
    const legacyId = text(row.id);
    if (!legacyId) continue;
    const userLegacyId = text(row.auth_usuarios_id);
    const userId = userByLegacyId.get(userLegacyId) || null;
    const acronym = text(row.log_cli_sigla).toUpperCase();
    const clientId = clientByAcronym.get(acronym) || null;
    await pool.query(
      `insert into public.auth_logs
        (legacy_id, auth_usuario_id, auth_usuario_legacy_id, client_id, client_acronym,
         action, controller, operator, agent, device, ip_address, url, info, params,
         crm_created_at, crm_updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       on conflict (legacy_id) do update set
         auth_usuario_id=excluded.auth_usuario_id,
         auth_usuario_legacy_id=excluded.auth_usuario_legacy_id,
         client_id=excluded.client_id, client_acronym=excluded.client_acronym,
         action=excluded.action, controller=excluded.controller, operator=excluded.operator,
         agent=excluded.agent, device=excluded.device, ip_address=excluded.ip_address,
         url=excluded.url, info=excluded.info, params=excluded.params,
         crm_created_at=excluded.crm_created_at, crm_updated_at=excluded.crm_updated_at,
         updated_at=now()`,
      [
        legacyId,
        userId,
        userLegacyId || null,
        clientId,
        acronym || null,
        text(row.log_action) || null,
        text(row.log_controller) || null,
        text(row.log_operador) || null,
        text(row.log_agent) || null,
        text(row.log_device) || null,
        ip(row.log_ip),
        text(row.log_url) || null,
        text(row.log_info) || null,
        JSON.stringify(jsonValue(row.log_params)),
        iso(row.created),
        iso(row.modified),
      ],
    );
    logsImported += 1;
    if (userId) logsLinkedToUsers += 1;
    if (clientId) logsLinkedToClients += 1;
  }

  await pool.query("commit");
  console.log(
    JSON.stringify({
      usersImported,
      usersLinked,
      logsImported,
      logsLinkedToUsers,
      logsLinkedToClients,
    }),
  );
} catch (error) {
  await pool.query("rollback").catch(() => {});
  throw error;
} finally {
  await pool.end();
}
