import fs from "node:fs";
import pg from "pg";

const apply = process.argv.includes("--apply");
const allowUnverified = process.argv.includes("--allow-unverified-certificate");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
let connectionUrl = process.env.MYSQL_CONNECTION_URL;
if (!connectionUrl && process.env.MYSQL_CONFIG_FILE) {
  const config = JSON.parse(fs.readFileSync(process.env.MYSQL_CONFIG_FILE, "utf8"));
  const url = new URL(`mysql://${config.host}:${config.port || 3306}/${config.database}`);
  url.username = config.user;
  url.password = config.password;
  connectionUrl = url.toString();
}
if (!connectionUrl)
  throw new Error("Configure MYSQL_CONNECTION_URL ou MYSQL_CONFIG_FILE fora do Git.");
const url = new URL(connectionUrl);
if (url.protocol !== "mysql:") throw new Error("A conexão precisa usar mysql://.");
url.searchParams.set("require_ssl", "true");
url.searchParams.set("verify_ca", String(!allowUnverified));
url.searchParams.set("verify_identity", String(!allowUnverified));

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext('crm-live-mysql-migration'))");
  const existing = (
    await db.query("select id from vault.secrets where name='crm_auth_mysql_connection'")
  ).rows[0];
  if (existing) await db.query("select vault.update_secret($1,$2)", [existing.id, url.toString()]);
  else
    await db.query("select vault.create_secret($1,'crm_auth_mysql_connection')", [url.toString()]);
  const installed = (await db.query("select to_regclass('crm_mysql.identities') as source")).rows[0]
    .source;
  if (!installed) {
    await db.query(
      fs.readFileSync(
        new URL("../supabase/migrations/20261007180000_live_mysql_auth.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  for (const source of [
    "auth_usuarios",
    "auth_contratos",
    "auth_aplicativos",
    "mob_dispositivos",
  ]) {
    const total = (await db.query(`select count(*)::int as total from public.${source}`)).rows[0]
      .total;
    if (!total) throw new Error(`A fonte ${source} retornou vazia; alteração revertida.`);
    console.log(`${source}: ${total} registros ao vivo`);
  }
  const page = (await db.query("select crm_mysql.log_page('{\"limit\":6}') as payload")).rows[0]
    .payload;
  if (!Array.isArray(page.rows) || page.rows.length > 6)
    throw new Error("Paginação de logs inválida.");
  console.log(`Logs: ${page.rows.length} registros na página; total ${page.total}.`);
  if (apply) {
    if (
      (await db.query("select to_regclass('supabase_migrations.schema_migrations') as registry"))
        .rows[0].registry
    ) {
      await db.query(
        "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3) on conflict(version) do nothing",
        [
          "20261007180000",
          "live_mysql_auth",
          [
            fs.readFileSync(
              new URL("../supabase/migrations/20261007180000_live_mysql_auth.sql", import.meta.url),
              "utf8",
            ),
          ],
        ],
      );
    }
    await db.query("commit");
    console.log(
      "Integração ativada. Cópias substituídas por views ao vivo; auth_logs consultada por RPC paginada.",
    );
  } else {
    await db.query("rollback");
    console.log("Validação concluída e revertida. Use --apply para ativar.");
  }
  console.log(
    `TLS obrigatório; validação do certificado: ${allowUnverified ? "desativada explicitamente" : "ativada"}.`,
  );
} catch {
  await db.query("rollback");
  // Driver errors can include connection details. Never log raw connection URLs.
  console.error(
    "A integração não foi aplicada. Verifique TLS, permissões e compatibilidade da migração.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
