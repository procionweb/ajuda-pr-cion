import pg from "pg";
import { cvsOptions } from "../src/lib/cvs-catalogs-imported.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const priorities = cvsOptions
  .filter((option) => option.priority !== "")
  .map((option) => ({ id: option.id, priority: option.priority }));
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rowCount } = await client.query(
    `update public.crm_catalog_records as catalog
     set payload = jsonb_set(catalog.payload, '{priority}', to_jsonb(source.priority))
     from jsonb_to_recordset($1::jsonb) as source(id text, priority text)
     where catalog.entity = 'options'
       and catalog.record_id = source.id
       and nullif(trim(catalog.payload->>'priority'), '') is null`,
    [JSON.stringify(priorities)],
  );
  console.log(`Priorities filled: ${rowCount}`);
} finally {
  await client.end();
}
