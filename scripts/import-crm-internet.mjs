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

const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
const files = {
  devices: option("--devices", path.join(downloads, "mob_dispositivos.json")),
  contracts: option("--contracts", path.join(downloads, "auth_contratos.json")),
  applications: option("--applications", path.join(downloads, "auth_aplicativos.json")),
};

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");

function tableRows(file) {
  if (!fs.existsSync(file)) return [];
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const table = Array.isArray(json) ? json.find((item) => item.type === "table") : null;
  return table?.data || (Array.isArray(json) ? json : []);
}

const text = (value) => String(value ?? "").trim();
const firstText = (row, keys) => {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return "";
};
const iso = (value) => {
  const clean = text(value);
  if (!clean || clean === "0000-00-00" || clean.startsWith("0000-00-00")) return null;
  return clean;
};
const boolStatus = (value, fallback = true) => {
  const clean = text(value).toLowerCase();
  if (!clean) return fallback;
  if (["1", "a", "ativo", "active", "sim", "true"].includes(clean)) return true;
  if (["0", "i", "inativo", "inactive", "cancelado", "false"].includes(clean)) return false;
  return fallback;
};
const legacyActiveStatus = (value, fallback = false) => {
  const clean = text(value).toLowerCase();
  if (!clean) return fallback;
  if (clean === "1") return true;
  if (["0", "9"].includes(clean)) return false;
  return boolStatus(clean, fallback);
};
const safePayload = (row) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !/(senha|password|token|secret|chave|key|gcm|salt)/i.test(key),
    ),
  );

const contractRows = tableRows(files.contracts);
const applicationRows = tableRows(files.applications);
const deviceRows = tableRows(files.devices).filter((row) => text(row.id_dis));
if (!contractRows.length && !applicationRows.length && !deviceRows.length) {
  throw new Error("Nenhum registro valido de internet encontrado.");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
});

const migrationFiles = [
  "20260724143000_client_internet.sql",
  "20260724161000_client_devices_tab.sql",
];

let contractsImported = 0;
let applicationsImported = 0;
let devicesImported = 0;
let devicesLinked = 0;

try {
  const sourceMode = await pool.query(
    "select relkind from pg_class where oid=to_regclass('public.auth_contratos')",
  );
  if (sourceMode.rows[0]?.relkind === "v") {
    throw new Error("Esta base usa MySQL ao vivo. A importação de cópias locais está desativada.");
  }

  for (const migrationFile of migrationFiles) {
    const migrationPath = path.resolve("supabase/migrations", migrationFile);
    if (fs.existsSync(migrationPath)) await pool.query(fs.readFileSync(migrationPath, "utf8"));
  }
  await pool.query("begin");

  const clients = await pool.query("select id, legacy_id, acronym from public.clients");
  const clientIds = new Map(clients.rows.map((client) => [String(client.legacy_id), client.id]));
  const clientIdsByAcronym = new Map(
    clients.rows.map((client) => [String(client.acronym).toUpperCase(), client.id]),
  );

  for (const row of contractRows) {
    const legacyId = firstText(row, ["id_con", "con_id", "id", "auth_contratos_id_con"]);
    if (!legacyId) continue;
    const clientLegacyId = firstText(row, [
      "tab_clientes_cli_id",
      "cli_id",
      "clientes_id",
      "auth_clientes_id",
      "cliente_id",
    ]);
    const acronym = firstText(row, [
      "con_cliente_sigla",
      "cli_sigla",
      "sigla",
      "con_sigla",
    ]).toUpperCase();
    const clientId = clientIds.get(clientLegacyId) || clientIdsByAcronym.get(acronym) || null;
    await pool.query(
      `
      insert into public.auth_contratos
        (legacy_id, contract_key, client_id, client_legacy_id, name, web_url, database_name,
         server_host, status, active, starts_at, expires_at, crm_created_at, crm_updated_at,
         source_payload)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      on conflict (legacy_id) do update set
        contract_key=excluded.contract_key,
        client_id=excluded.client_id,
        client_legacy_id=excluded.client_legacy_id,
        name=excluded.name,
        web_url=excluded.web_url,
        database_name=excluded.database_name,
        server_host=excluded.server_host,
        status=excluded.status,
        active=excluded.active,
        starts_at=excluded.starts_at,
        expires_at=excluded.expires_at,
        crm_created_at=excluded.crm_created_at,
        crm_updated_at=excluded.crm_updated_at,
        source_payload=excluded.source_payload,
        updated_at=now()
    `,
      [
        legacyId,
        firstText(row, ["con_chave", "con_key", "chave", "contract_key"]) || null,
        clientId,
        clientLegacyId || null,
        firstText(row, ["con_nome", "con_descricao", "descricao", "nome"]),
        firstText(row, [
          "con_mobile_url",
          "con_dominio_url",
          "con_url",
          "url",
          "web_url",
          "con_link",
        ]),
        firstText(row, ["con_database_db", "con_database", "database", "db", "banco"]),
        firstText(row, ["con_host_db", "con_host", "host", "server", "servidor"]),
        firstText(row, ["con_status", "status"]),
        legacyActiveStatus(firstText(row, ["con_status", "status", "ativo"]), false),
        iso(firstText(row, ["con_inicio", "data_inicio", "starts_at"])),
        iso(firstText(row, ["con_validade", "data_validade", "expires_at"])),
        iso(row.created),
        iso(row.modified),
        JSON.stringify(safePayload(row)),
      ],
    );
    contractsImported += 1;
  }

  const contracts = await pool.query("select id, legacy_id, client_id from public.auth_contratos");
  const contractByLegacyId = new Map(
    contracts.rows.map((contract) => [contract.legacy_id, contract]),
  );

  for (const row of applicationRows) {
    const legacyId = firstText(row, ["id_app", "app_id", "id"]);
    if (!legacyId) continue;
    const contractLegacyId = firstText(row, ["auth_contratos_id_con", "id_con", "contrato_id"]);
    const contract = contractByLegacyId.get(contractLegacyId);
    await pool.query(
      `
      insert into public.auth_aplicativos
        (legacy_id, auth_contratos_id_con, contrato_id, client_id, name, app_type, version,
         status, active, crm_created_at, crm_updated_at, source_payload)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      on conflict (legacy_id) do update set
        auth_contratos_id_con=excluded.auth_contratos_id_con,
        contrato_id=excluded.contrato_id,
        client_id=excluded.client_id,
        name=excluded.name,
        app_type=excluded.app_type,
        version=excluded.version,
        status=excluded.status,
        active=excluded.active,
        crm_created_at=excluded.crm_created_at,
        crm_updated_at=excluded.crm_updated_at,
        source_payload=excluded.source_payload,
        updated_at=now()
    `,
      [
        legacyId,
        contractLegacyId || null,
        contract?.id || null,
        contract?.client_id || null,
        firstText(row, ["app_description", "app_nome", "nome", "descricao"]),
        firstText(row, ["app_type", "tipo"]),
        firstText(row, ["app_build_version", "app_versao", "version", "versao"]),
        firstText(row, ["app_status", "status"]),
        boolStatus(firstText(row, ["app_status", "status", "ativo"]), true),
        iso(row.created),
        iso(row.modified),
        JSON.stringify(safePayload(row)),
      ],
    );
    applicationsImported += 1;
  }

  for (const row of deviceRows) {
    const contractLegacyId = text(row.auth_contratos_id_con);
    const contract = contractByLegacyId.get(contractLegacyId);
    await pool.query(
      `
      insert into public.mob_dispositivos
        (legacy_id, auth_contratos_id_con, contrato_id, client_id, device_uuid,
         utilizador, codrep, tipo, sistema, status, active, app_type, build_version,
         db_version, last_checked_at, crm_created_at, crm_updated_at, source_payload)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      on conflict (legacy_id) do update set
        auth_contratos_id_con=excluded.auth_contratos_id_con,
        contrato_id=excluded.contrato_id,
        client_id=excluded.client_id,
        device_uuid=excluded.device_uuid,
        utilizador=excluded.utilizador,
        codrep=excluded.codrep,
        tipo=excluded.tipo,
        sistema=excluded.sistema,
        status=excluded.status,
        active=excluded.active,
        app_type=excluded.app_type,
        build_version=excluded.build_version,
        db_version=excluded.db_version,
        last_checked_at=excluded.last_checked_at,
        crm_created_at=excluded.crm_created_at,
        crm_updated_at=excluded.crm_updated_at,
        source_payload=excluded.source_payload,
        updated_at=now()
    `,
      [
        text(row.id_dis),
        contractLegacyId,
        contract?.id || null,
        contract?.client_id || null,
        text(row.dis_uuid),
        text(row.dis_utilizador),
        text(row.dis_codrep),
        text(row.dis_tipo),
        text(row.dis_sistema),
        text(row.dis_status),
        text(row.dis_status) === "1",
        text(row.dis_app_type),
        text(row.dis_build_version),
        text(row.dis_db_version),
        iso(row.dis_ult_verificacao),
        iso(row.created),
        iso(row.modified),
        JSON.stringify(safePayload(row)),
      ],
    );
    devicesImported += 1;
    if (contract?.client_id) devicesLinked += 1;
  }

  await pool.query("commit");

  const counts = await pool.query(`select
    (select count(*)::int from public.auth_contratos) contracts,
    (select count(*)::int from public.auth_contratos where active) active_contracts,
    (select count(*)::int from public.auth_aplicativos) applications,
    (select count(*)::int from public.mob_dispositivos) devices,
    (select count(*)::int from public.mob_dispositivos where contrato_id is not null) linked_devices`);

  console.log(
    JSON.stringify(
      {
        imported: {
          contracts: contractsImported,
          applications: applicationsImported,
          devices: devicesImported,
          devicesLinked,
        },
        database: counts.rows[0],
        files: {
          contracts: fs.existsSync(files.contracts) ? path.basename(files.contracts) : null,
          applications: fs.existsSync(files.applications)
            ? path.basename(files.applications)
            : null,
          devices: path.basename(files.devices),
        },
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
