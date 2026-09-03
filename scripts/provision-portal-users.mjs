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

function tableRows(file) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  return (Array.isArray(json) ? json.find((item) => item.type === "table")?.data : json) || [];
}

const clean = (value) => String(value ?? "").trim();
const normalizedEmail = (value) => clean(value).toLowerCase();
const normalizedOperator = (value) => clean(value).toUpperCase();

loadEnv(path.resolve(".env.local"));
loadEnv(path.resolve(".env"));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const downloads = path.join(process.env.USERPROFILE || "", "Downloads", "json");
const collaboratorsFile = process.argv[2] || path.join(downloads, "tab_colaboradores (1).json");
const usersFile = process.argv[3] || path.join(downloads, "auth_usuarios.json");
const collaborators = tableRows(collaboratorsFile);
const legacyUsers = tableRows(usersFile);
const legacyByEmail = new Map(
  legacyUsers
    .filter((row) => normalizedEmail(row.aus_email))
    .map((row) => [normalizedEmail(row.aus_email), row]),
);
const legacyByOperator = new Map(
  legacyUsers
    .filter((row) => normalizedOperator(row.aus_operador))
    .map((row) => [normalizedOperator(row.aus_operador), row]),
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let created = 0;
let skipped = 0;
let missingPassword = 0;

try {
  await pool.query("begin");
  for (const collaborator of collaborators) {
    if (clean(collaborator.clb_st) !== "1") continue;
    const email = normalizedEmail(collaborator.clb_email);
    const operator = normalizedOperator(collaborator.clb_operador);
    const password = clean(collaborator.clb_senha_login);
    const legacy = legacyByEmail.get(email) || legacyByOperator.get(operator);
    const portalRole = clean(legacy?.aus_perfil).toLowerCase();

    if (!email || !["s_admin", "prc"].includes(portalRole)) {
      skipped += 1;
      continue;
    }
    if (!password) {
      missingPassword += 1;
      continue;
    }

    const existing = await pool.query("select id from auth.users where lower(email) = $1 limit 1", [
      email,
    ]);
    if (existing.rowCount) {
      skipped += 1;
      continue;
    }

    const userId = crypto.randomUUID();
    const fullName = [clean(collaborator.clb_nome), clean(collaborator.clb_sobrenome)]
      .filter(Boolean)
      .join(" ");
    await pool.query(
      `insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         confirmation_token, recovery_token, email_change_token_new, email_change,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         phone_change, phone_change_token, email_change_token_current,
         reauthentication_token, is_sso_user, is_anonymous)
       values
        ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
         crypt($3, gen_salt('bf', 10)), now(), '', '', '', '',
         jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'perfil',$4::text),
         jsonb_build_object('full_name',$5::text,'operator',$6::text,'perfil',$4::text), now(), now(),
         '', '', '', '', false, false)`,
      [userId, email, password, portalRole, fullName, operator],
    );
    await pool.query(
      `insert into auth.identities
        (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values ($1::text, $1::uuid, jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',true),
               'email', now(), now(), now())`,
      [userId, email],
    );
    await pool.query(
      `insert into public.profiles (id, operator_code, full_name, email, role, active)
       values ($1, $2, $3, $4, $5::public.user_role, true)
       on conflict (id) do update set operator_code=excluded.operator_code,
         full_name=excluded.full_name, email=excluded.email, role=excluded.role, active=true`,
      [
        userId,
        operator,
        fullName || operator,
        email,
        portalRole === "s_admin" ? "admin" : "support",
      ],
    );
    await pool.query(
      `update public.tab_colaboradores set profile_id=$1, updated_at=now()
       where legacy_id=$2`,
      [userId, clean(collaborator.clb_id)],
    );
    created += 1;
  }
  await pool.query("commit");
  console.log(JSON.stringify({ created, skipped, missingPassword }));
} catch (error) {
  await pool.query("rollback").catch(() => {});
  throw error;
} finally {
  await pool.end();
}
