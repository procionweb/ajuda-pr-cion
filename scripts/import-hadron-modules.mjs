import fs from "node:fs";
import pg from "pg";

const rows = (file) =>
  JSON.parse(fs.readFileSync(file, "utf8")).find((entry) => entry.type === "table").data;
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");
await client.connect();
try {
  const exists = await client.query("select to_regclass('public.hadron_modules') as table_name");
  if (!exists.rows[0].table_name)
    await client.query(
      fs.readFileSync("supabase/migrations/20260914160000_hadron_modules.sql", "utf8"),
    );
  await client.query("begin");
  for (const module of rows("src/data/cvs_modules.json")) {
    await client.query(
      "insert into public.hadron_modules(id,nome) values ($1,$2) on conflict do nothing",
      [module.id, module.nome],
    );
  }
  for (const sub of rows("src/data/cvs_submodules.json")) {
    await client.query(
      "insert into public.hadron_submodules(id,id_modulo,nome) values ($1,$2,$3) on conflict do nothing",
      [sub.id, sub.id_modulo, sub.nome],
    );
  }
  await client.query("commit");
  console.log(
    (
      await client.query(
        "select (select count(*) from public.hadron_modules) as modules, (select count(*) from public.hadron_submodules) as submodules",
      )
    ).rows[0],
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
