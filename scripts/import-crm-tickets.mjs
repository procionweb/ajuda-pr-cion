import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

function repairText(value) {
  let result = String(value ?? "");
  for (let pass = 0; pass < 2 && /[ÃÂ]/.test(result); pass += 1) {
    const repaired = Buffer.from(result, "latin1").toString("utf8");
    if (repaired.includes("\uFFFD")) break;
    result = repaired;
  }
  return result.trim();
}

function splitSqlValues(input) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  let escaped = false;
  let depth = 0;

  const pushValue = () => {
    const raw = value.trim();
    row.push(raw.toUpperCase() === "NULL" ? null : repairText(raw));
    value = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (escaped) {
        const escapes = { n: "\n", r: "\r", t: "\t", 0: "\0" };
        value += escapes[char] ?? char;
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "'" && input[index + 1] === "'") {
        value += "'";
        index += 1;
      } else if (char === "'") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "'") quoted = true;
    else if (char === "(") {
      if (depth > 0) value += char;
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        pushValue();
        rows.push(row);
        row = [];
      } else value += char;
    } else if (char === "," && depth === 1) {
      pushValue();
    } else if (depth > 0) {
      value += char;
    }
  }
  return rows;
}

function parseMysqlDump(file, table) {
  const sql = fs.readFileSync(file, "utf8");
  const marker = new RegExp(`INSERT INTO \\\`${table}\\\`\\s*\\(([^;]+?)\\)\\s*VALUES\\s*`, "g");
  const rows = [];
  for (const match of sql.matchAll(marker)) {
    const columns = [...match[1].matchAll(/`([^`]+)`/g)].map((item) => item[1]);
    const start = (match.index || 0) + match[0].length;
    let quoted = false;
    let escaped = false;
    let end = start;
    for (; end < sql.length; end += 1) {
      const char = sql[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === "'" && sql[end + 1] === "'") end += 1;
        else if (char === "'") quoted = false;
      } else if (char === "'") quoted = true;
      else if (char === ";") break;
    }
    for (const values of splitSqlValues(sql.slice(start, end))) {
      if (values.length !== columns.length) {
        throw new Error(
          `${table}: linha com ${values.length} valores; esperado ${columns.length}.`,
        );
      }
      rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
    }
  }
  return rows;
}

function parsePhpMyAdminJson(file, table) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(payload)) throw new Error(`${table}: exportacao JSON invalida.`);
  const entry = payload.find((item) => item?.type === "table" && item?.name === table);
  if (!entry || !Array.isArray(entry.data)) {
    throw new Error(`${table}: tabela nao encontrada na exportacao JSON.`);
  }
  return entry.data;
}

function parseExport(file, table) {
  return path.extname(file).toLowerCase() === ".json"
    ? parsePhpMyAdminJson(file, table)
    : parseMysqlDump(file, table);
}

const text = (value) => String(value ?? "").trim();
const timestamp = (value) => {
  const clean = text(value);
  return !clean || clean.startsWith("0000-00-00") ? null : `${clean.replace(" ", "T")}-03:00`;
};
const chunks = (items, size = 250) => {
  const output = [];
  for (let index = 0; index < items.length; index += size)
    output.push(items.slice(index, index + size));
  return output;
};
const ticketStatus = (value) =>
  ({
    open: "open",
    occupied: "occupied",
    in_progress: "in_progress",
    waiting_client: "waiting_client",
    specialist: "with_specialist",
    with_specialist: "with_specialist",
    scheduled: "scheduled",
    finished: "finished",
    closed: "finished",
    cancelled: "cancelled",
    overdue: "overdue",
  })[text(value).toLowerCase()] || "open";
const priority = (value) => {
  const code = Number(value);
  return code >= 2 ? "high" : code === 1 ? "medium" : "low";
};

loadEnv(path.resolve(".env.local"));
loadEnv(path.resolve(".env"));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");

const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
const ticketsFile = argument("--tickets", path.join(downloads, "sac_tickets.sql"));
const messagesFile = argument("--messages", path.join(downloads, "sac_ticket_messages.sql"));
const replaceExisting = args.includes("--replace");
const ticketRows = parseExport(ticketsFile, "sac_tickets");
const messageRows = parseExport(messagesFile, "sac_ticket_messages");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

try {
  for (const migration of [
    "supabase/migrations/20260727150000_crm_ticket_import.sql",
    "supabase/migrations/20260727153000_ticket_legacy_dates.sql",
  ]) {
    await pool.query(fs.readFileSync(path.resolve(migration), "utf8"));
  }
  await pool.query("begin");

  if (replaceExisting) {
    await pool.query("delete from public.ticket_events");
    await pool.query("delete from public.ticket_messages");
    await pool.query("delete from public.tickets");
  }

  const [clients, modules, submodules, profiles] = await Promise.all([
    pool.query("select id, legacy_id, upper(acronym) acronym from public.clients"),
    pool.query("select id, legacy_id from public.modules"),
    pool.query("select id, legacy_id, module_id from public.submodules"),
    pool.query("select id, upper(operator_code) operator_code from public.profiles"),
  ]);
  const clientsByLegacy = new Map(clients.rows.map((row) => [text(row.legacy_id), row.id]));
  const clientsByAcronym = new Map(clients.rows.map((row) => [text(row.acronym), row.id]));
  const modulesByLegacy = new Map(modules.rows.map((row) => [text(row.legacy_id), row.id]));
  const submodulesByLegacy = new Map(
    submodules.rows.map((row) => [`${row.module_id}:${text(row.legacy_id)}`, row.id]),
  );
  const profilesByOperator = new Map(profiles.rows.map((row) => [text(row.operator_code), row.id]));

  let skippedTickets = 0;
  const mappedTickets = ticketRows
    .map((row) => {
      const clientId =
        clientsByLegacy.get(text(row.tab_clientes_cli_id)) ||
        clientsByAcronym.get(text(row.sac_cli_sigla).toUpperCase());
      if (!clientId) {
        skippedTickets += 1;
        return null;
      }
      const moduleId = modulesByLegacy.get(text(row.cvs_modules_id)) || null;
      const operator = text(row.sac_operador_atual || row.sac_operador).toUpperCase();
      return {
        legacy_id: text(row.id),
        protocol: text(row.sac_numero) || `LEGACY-${row.id}`,
        client_id: clientId,
        module_id: moduleId,
        submodule_id: submodulesByLegacy.get(`${moduleId}:${text(row.cvs_submodules_id)}`) || null,
        subject: text(row.sac_assunto) || "Chamado sem assunto",
        description: text(row.sac_assunto),
        status: ticketStatus(row.sac_status),
        priority: priority(row.sac_prioridade),
        attendant_id: profilesByOperator.get(operator) || null,
        owner_id: profilesByOperator.get(operator) || null,
        client_code: text(row.sac_cli_sigla).toUpperCase(),
        client_name: text(row.sac_cliente_nome),
        contact_name: text(row.sac_usuario_nome),
        module_label: text(row.sac_module_nome),
        attendant_code: text(row.sac_operador).toUpperCase(),
        owner_code: operator,
        finished_at: ticketStatus(row.sac_status) === "finished" ? timestamp(row.modified) : null,
        legacy_created_at: timestamp(row.created),
        legacy_updated_at: timestamp(row.modified || row.created),
        created_at: timestamp(row.created),
        updated_at: timestamp(row.modified || row.created),
        source_payload: row,
      };
    })
    .filter(Boolean);
  const ticketsByLegacy = new Map(mappedTickets.map((row) => [row.legacy_id, row]));
  const tickets = [
    ...new Map(
      Array.from(ticketsByLegacy.values()).map((row) => [row.protocol, row]),
    ).values(),
  ];
  const ticketProtocolByLegacy = new Map(tickets.map((row) => [row.legacy_id, row.protocol]));
  const ticketConflictClause = replaceExisting
    ? "on conflict do nothing"
    : `on conflict (protocol) do update set
         legacy_id=excluded.legacy_id, client_id=excluded.client_id, module_id=excluded.module_id,
         submodule_id=excluded.submodule_id, subject=excluded.subject,
         description=excluded.description, status=excluded.status, priority=excluded.priority,
         attendant_id=excluded.attendant_id, owner_id=excluded.owner_id,
         client_code=excluded.client_code, client_name=excluded.client_name,
         contact_name=excluded.contact_name, module_label=excluded.module_label,
         attendant_code=excluded.attendant_code, owner_code=excluded.owner_code,
         finished_at=excluded.finished_at,
         legacy_created_at=excluded.legacy_created_at,
         legacy_updated_at=excluded.legacy_updated_at, created_at=excluded.created_at,
         updated_at=excluded.updated_at, source_payload=excluded.source_payload`;

  for (const batch of chunks(tickets)) {
    await pool.query(
      `insert into public.tickets (
         legacy_id, protocol, client_id, module_id, submodule_id, subject, description,
         status, priority, channel, attendant_id, owner_id, client_code, client_name,
         contact_name, module_label, attendant_code, owner_code, finished_at,
         legacy_created_at, legacy_updated_at, created_at, updated_at, source_payload
       )
       select x.legacy_id, x.protocol, x.client_id::uuid, x.module_id::uuid,
         x.submodule_id::uuid, x.subject, x.description, x.status::public.ticket_status,
         x.priority::public.priority_level, 'phone'::public.ticket_channel,
         x.attendant_id::uuid, x.owner_id::uuid, x.client_code, x.client_name,
         x.contact_name, x.module_label, x.attendant_code, x.owner_code,
         x.finished_at::timestamptz, x.legacy_created_at::timestamptz,
         x.legacy_updated_at::timestamptz, x.created_at::timestamptz,
         x.updated_at::timestamptz, x.source_payload
       from jsonb_to_recordset($1::jsonb) as x(
         legacy_id text, protocol text, client_id text, module_id text, submodule_id text,
         subject text, description text, status text, priority text, attendant_id text,
         owner_id text, client_code text, client_name text, contact_name text,
         module_label text, attendant_code text, owner_code text, finished_at text,
         legacy_created_at text, legacy_updated_at text, created_at text,
         updated_at text, source_payload jsonb
       )
       ${ticketConflictClause}`,
      [JSON.stringify(batch)],
    );
  }

  const importedTickets = await pool.query(
    "select id, protocol from public.tickets where protocol = any($1::text[])",
    [tickets.map((row) => row.protocol)],
  );
  const ticketsByProtocol = new Map(
    importedTickets.rows.map((row) => [text(row.protocol), row.id]),
  );
  let skippedMessages = 0;
  const messages = messageRows
    .map((row) => {
      const ticketId = ticketsByProtocol.get(ticketProtocolByLegacy.get(text(row.sac_tickets_id)));
      if (!ticketId) {
        skippedMessages += 1;
        return null;
      }
      const operator = text(row.stm_operador).toUpperCase();
      return {
        legacy_id: text(row.id),
        ticket_id: ticketId,
        sender_id: profilesByOperator.get(operator) || null,
        sender_code: operator,
        sender_name: text(row.stm_nome || row.stm_operador),
        author_type: row.auth_usuarios_id ? "support" : "client",
        body: text(row.stm_mensagem) || text(row.stm_opcao_nome) || "Atividade sem descricao",
        internal: text(row.stm_permissao) !== "1",
        created_at: timestamp(row.created),
        edited_at:
          timestamp(row.modified) !== timestamp(row.created) ? timestamp(row.modified) : null,
        event_type: text(row.stm_tipo) || "message",
        title: text(row.stm_opcao_nome) || text(row.stm_tipo) || "Atividade",
        status: text(row.stm_status),
        source_payload: row,
      };
    })
    .filter(Boolean);

  for (const batch of chunks(messages)) {
    await pool.query(
      `insert into public.ticket_messages (
         legacy_id, ticket_id, sender_id, sender_code, sender_name, author_type,
         body, internal, created_at, edited_at, source_payload
       )
       select x.legacy_id, x.ticket_id::uuid, x.sender_id::uuid, x.sender_code,
         x.sender_name, x.author_type, x.body, x.internal, x.created_at::timestamptz,
         x.edited_at::timestamptz, x.source_payload
       from jsonb_to_recordset($1::jsonb) as x(
         legacy_id text, ticket_id text, sender_id text, sender_code text,
         sender_name text, author_type text, body text, internal boolean,
         created_at text, edited_at text, source_payload jsonb
       )
       on conflict (legacy_id) where legacy_id is not null do update set
         ticket_id=excluded.ticket_id, sender_id=excluded.sender_id,
         sender_code=excluded.sender_code, sender_name=excluded.sender_name,
         author_type=excluded.author_type, body=excluded.body, internal=excluded.internal,
         created_at=excluded.created_at, edited_at=excluded.edited_at,
         source_payload=excluded.source_payload`,
      [JSON.stringify(batch)],
    );

    await pool.query(
      `insert into public.ticket_events (
         legacy_id, ticket_id, event_type, title, description, metadata,
         actor_id, actor_code, actor_type, occurred_at, source_payload
       )
       select 'message:' || x.legacy_id, x.ticket_id::uuid, x.event_type,
         x.title, x.body, jsonb_build_object('status', x.status),
         x.sender_id::uuid, x.sender_code, x.author_type,
         x.created_at::timestamptz, x.source_payload
       from jsonb_to_recordset($1::jsonb) as x(
         legacy_id text, ticket_id text, sender_id text, sender_code text,
         author_type text, body text, event_type text, title text, status text,
         created_at text, source_payload jsonb
       )
       on conflict (legacy_id) where legacy_id is not null do update set
         ticket_id=excluded.ticket_id, event_type=excluded.event_type,
         title=excluded.title, description=excluded.description,
         metadata=excluded.metadata, actor_id=excluded.actor_id,
         actor_code=excluded.actor_code, actor_type=excluded.actor_type,
         occurred_at=excluded.occurred_at, source_payload=excluded.source_payload`,
      [JSON.stringify(batch)],
    );
  }

  await pool.query("commit");
  console.log(
    JSON.stringify(
      {
        sourceTickets: ticketRows.length,
        importedTickets: tickets.length,
        skippedTickets,
        sourceMessages: messageRows.length,
        importedMessages: messages.length,
        importedEvents: messages.length,
        skippedMessages,
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
