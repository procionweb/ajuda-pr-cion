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
const fileIndex = args.indexOf("--file");
const sourceFile =
  fileIndex >= 0
    ? args[fileIndex + 1]
    : path.join(process.env.USERPROFILE || "", "Downloads", "agendamentos.json");
const dump = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const rows = dump.find((item) => item.type === "table")?.data || [];

const text = (value) => String(value ?? "").trim();
const iso = (value) => {
  const clean = text(value);
  return !clean || clean.startsWith("0000-00-00") ? null : clean;
};
const eventKind = (value) => ({
  visita: "visit",
  remoto: "remote_meeting",
  reuniao: "procion_meeting",
}[text(value).toLowerCase()] || "personal");
const eventStatus = (value) => ({
  done: "completed",
  cancelled: "cancelled",
  open: "scheduled",
  in_progress: "scheduled",
  others: "scheduled",
}[text(value).toLowerCase()] || "scheduled");
const eventOrigin = (value) => ({
  admin: "admin",
  administracao: "admin",
  "administração": "admin",
  support: "support",
  suporte: "support",
  commercial: "commercial",
  comercial: "commercial",
}[text(value).toLocaleLowerCase("pt-BR")] || "admin");
const timestamp = (date, time) => {
  const day = text(date);
  const clock = text(time);
  if (!day || !clock) return null;
  return `${day}T${clock.length === 5 ? `${clock}:00` : clock}-03:00`;
};
const chunks = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

try {
  const migration = path.resolve(
    "supabase/migrations/20260724233000_calendar_legacy_import.sql",
  );
  await pool.query(fs.readFileSync(migration, "utf8"));
  await pool.query("begin");

  const clients = await pool.query("select id, legacy_id from public.clients");
  const clientByLegacyId = new Map(
    clients.rows.map((client) => [text(client.legacy_id), client.id]),
  );
  const tickets = await pool.query("select id, legacy_id from public.tickets");
  const ticketByLegacyId = new Map(
    tickets.rows.map((ticket) => [text(ticket.legacy_id), ticket.id]),
  );

  const events = rows.map((row) => {
    const startsAt = timestamp(row.data, row.hora_ini);
    let endsAt = timestamp(row.data, row.hora_fim);
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      endsAt = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
    }
    return {
      legacy_id: text(row.id),
      ticket_id: ticketByLegacyId.get(text(row.sac_tickets_id)) || null,
      client_id: clientByLegacyId.get(text(row.tab_clientes_cli_id)) || null,
      title: text(row.titulo) || "Agendamento",
      description: text(row.descricao) || null,
      kind: eventKind(row.tipo),
      starts_at: startsAt,
      ends_at: endsAt,
      status: eventStatus(row.status),
      legacy_operator: text(row.operador) || null,
      legacy_origin: eventOrigin(row.origem),
      legacy_type: text(row.tipo) || null,
      legacy_status: text(row.status) || null,
      legacy_contact_id: text(row.contatos_id) || null,
      legacy_ticket_id: text(row.sac_tickets_id) || null,
      legacy_vehicle_id: text(row.veiculos_vei_id) || null,
      legacy_guests: text(row.convidados) || null,
      created_at: iso(row.created),
      updated_at: iso(row.modified),
    };
  }).filter((event) => event.legacy_id && event.starts_at && event.ends_at);

  for (const batch of chunks(events, 500)) {
    await pool.query(
      `insert into public.calendar_events
        (legacy_id, ticket_id, client_id, title, description, kind, starts_at,
         ends_at, status, legacy_operator, legacy_origin, legacy_type,
         legacy_status, legacy_contact_id, legacy_ticket_id, legacy_vehicle_id,
         legacy_guests, created_at, updated_at)
       select x.legacy_id, x.ticket_id, x.client_id, x.title, x.description,
         x.kind::public.event_kind, x.starts_at, x.ends_at, x.status,
         x.legacy_operator, x.legacy_origin, x.legacy_type, x.legacy_status,
         x.legacy_contact_id, x.legacy_ticket_id, x.legacy_vehicle_id,
         x.legacy_guests, coalesce(x.created_at, now()), coalesce(x.updated_at, now())
       from jsonb_to_recordset($1::jsonb) as x(
         legacy_id text, ticket_id uuid, client_id uuid, title text,
         description text, kind text, starts_at timestamptz, ends_at timestamptz,
         status text, legacy_operator text, legacy_origin text, legacy_type text,
         legacy_status text, legacy_contact_id text, legacy_ticket_id text,
         legacy_vehicle_id text, legacy_guests text, created_at timestamptz,
         updated_at timestamptz
       )
       on conflict (legacy_id) where legacy_id is not null do update set
         ticket_id=excluded.ticket_id, client_id=excluded.client_id,
         title=excluded.title, description=excluded.description, kind=excluded.kind,
         starts_at=excluded.starts_at, ends_at=excluded.ends_at,
         status=excluded.status, legacy_operator=excluded.legacy_operator,
         legacy_origin=excluded.legacy_origin, legacy_type=excluded.legacy_type,
         legacy_status=excluded.legacy_status,
         legacy_contact_id=excluded.legacy_contact_id,
         legacy_ticket_id=excluded.legacy_ticket_id,
         legacy_vehicle_id=excluded.legacy_vehicle_id,
         legacy_guests=excluded.legacy_guests, updated_at=excluded.updated_at`,
      [JSON.stringify(batch)],
    );
  }

  await pool.query("commit");
  console.log(JSON.stringify({
    sourceRows: rows.length,
    imported: events.length,
    linkedToClients: events.filter((event) => event.client_id).length,
    linkedToTickets: events.filter((event) => event.ticket_id).length,
  }));
} catch (error) {
  await pool.query("rollback").catch(() => {});
  throw error;
} finally {
  await pool.end();
}
