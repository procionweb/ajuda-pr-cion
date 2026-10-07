import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  const views = (
    await db.query(
      "select relname,relkind from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relname=any($1)",
      [["auth_usuarios", "auth_contratos", "auth_aplicativos", "mob_dispositivos", "auth_logs"]],
    )
  ).rows;
  assert.equal(views.length, 4);
  assert.ok(views.every((view) => view.relkind === "v"));
  const links = (
    await db.query(
      "select count(*)::int as broken from public.tab_cli_params p where p.auth_usuario_id is not null and not exists(select 1 from public.auth_usuarios u where u.id=p.auth_usuario_id)",
    )
  ).rows[0];
  assert.equal(links.broken, 0);
  const grants = (
    await db.query(
      "select has_schema_privilege('authenticated','crm_mysql','USAGE') as staff,has_schema_privilege('anon','crm_mysql','USAGE') as anonymous",
    )
  ).rows[0];
  assert.equal(grants.staff, false);
  assert.equal(grants.anonymous, false);
  const staff = (
    await db.query(
      "select u.id,u.email,u.raw_app_meta_data from auth.users u join public.profiles p on p.id=u.id where p.active and p.role='admin' order by u.id limit 1",
    )
  ).rows[0];
  assert.ok(staff, "É necessária uma identidade administrativa para verificar os RPCs.");
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({
      sub: staff.id,
      email: staff.email,
      role: "authenticated",
      app_metadata: staff.raw_app_meta_data,
    }),
  ]);
  await db.query("set local role authenticated");
  const result = (
    await db.query(
      "select public.resolve_portal_login_email($1) as login,jsonb_array_length(public.configuration_devices_list()) as devices,jsonb_array_length(public.configuration_contracts_list()) as contracts,jsonb_array_length(public.configuration_applications_list()) as apps",
      [staff.email],
    )
  ).rows[0];
  assert.ok(result.login);
  assert.ok(result.devices > 0);
  assert.ok(result.contracts > 0);
  assert.ok(result.apps > 0);
  console.log("Conexão ao vivo, login, listas, permissões e vínculos verificados.");
  console.log({ devices: result.devices, contracts: result.contracts, apps: result.apps });
  await db.query("rollback");
} catch (error) {
  await db.query("rollback");
  console.error(
    "Verificação falhou:",
    error instanceof assert.AssertionError ? error.message : "Falha na conexão ou no RPC.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
