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
const emailKey = (value) => clean(value).toLowerCase();
const operatorKey = (value) => clean(value).toUpperCase();
const allowedProfiles = new Set([
  "s_admin",
  "admin",
  "tester",
  "manager",
  "logistics",
  "supervisor",
  "marketing",
  "prc",
]);

loadEnv(path.resolve(".env.local"));
loadEnv(path.resolve(".env"));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const sourceFile =
  process.argv[2] || path.join(process.env.USERPROFILE || "", "Downloads", "json", "auth_usuarios.json");
const sourceRows = tableRows(sourceFile);
const sourceById = new Map(sourceRows.map((row) => [clean(row.id), row]));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let created = 0;
let updated = 0;
let missingHash = 0;

try {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows: users } = await client.query(`
      select legacy_id, email, operator, name, profile
      from public.auth_usuarios
      where active and upper(trim(coalesce(client_acronym, ''))) = 'PRC'
      order by legacy_id
    `);
    const { rows: collaborators } = await client.query(`
      select id, email, operator_acronym, clb_departamento
      from public.tab_colaboradores
    `);
    const collaboratorByOperator = new Map(
      collaborators.filter((row) => operatorKey(row.operator_acronym)).map((row) => [operatorKey(row.operator_acronym), row]),
    );
    const collaboratorByEmail = new Map(
      collaborators.filter((row) => emailKey(row.email)).map((row) => [emailKey(row.email), row]),
    );

    for (const user of users) {
      const email = emailKey(user.email);
      const operator = operatorKey(user.operator);
      if (!email || !operator) continue;

      const source = sourceById.get(clean(user.legacy_id));
      const passwordHash = clean(source?.aus_senha).replace(/^\$2y\$/, () => "$2a$");
      if (!/^\$2[ab]\$/.test(passwordHash)) {
        missingHash += 1;
        continue;
      }

      const profileValue = clean(user.profile).toLowerCase();
      const profile = allowedProfiles.has(profileValue) ? profileValue : "prc";
      const collaborator = collaboratorByOperator.get(operator) || collaboratorByEmail.get(email);
      const department = clean(collaborator?.clb_departamento) || "support";
      const fullName = clean(user.name) || operator;
      const existing = await client.query(
        `select u.id
         from auth.users u
         left join public.profiles p on p.id = u.id
         where lower(u.email) = $1 or upper(trim(p.operator_code)) = $2
         order by case when lower(u.email) = $1 then 0 else 1 end
         limit 1`,
        [email, operator],
      );

      let userId;
      if (existing.rowCount) {
        userId = existing.rows[0].id;
        await client.query(
          `update auth.users
           set encrypted_password = $2,
               email = $7,
               raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                 || jsonb_build_object('perfil', $3::text),
               raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                 || jsonb_build_object(
                   'full_name', $4::text,
                   'operator', $5::text,
                   'perfil', $3::text,
                   'departamento', $6::text
                 ),
               banned_until = null,
               updated_at = now()
           where id = $1`,
          [userId, passwordHash, profile, fullName, operator, department, email],
        );
        await client.query(
          `update auth.identities
           set provider_id=$2,
               identity_data=coalesce(identity_data, '{}'::jsonb)
                 || jsonb_build_object('email',$2::text,'email_verified',true),
               updated_at=now()
           where user_id=$1 and provider='email'`,
          [userId, email],
        );
        updated += 1;
      } else {
        userId = crypto.randomUUID();
        await client.query(
          `insert into auth.users
            (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
             confirmation_token, recovery_token, email_change_token_new, email_change,
             raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
             phone_change, phone_change_token, email_change_token_current,
             reauthentication_token, is_sso_user, is_anonymous)
           values
            ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
             $2, $3, now(), '', '', '', '',
             jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'perfil',$4::text),
             jsonb_build_object(
               'full_name',$5::text,'operator',$6::text,'perfil',$4::text,
               'departamento',$7::text
             ), now(), now(), '', '', '', '', false, false)`,
          [userId, email, passwordHash, profile, fullName, operator, department],
        );
        await client.query(
          `insert into auth.identities
            (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
           values ($1::text, $1::uuid,
             jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',true),
             'email', now(), now(), now())`,
          [userId, email],
        );
        created += 1;
      }

      await client.query(
        `insert into public.profiles (id, operator_code, full_name, email, role, active)
         values ($1, $2, $3, $4, $5::public.user_role, true)
         on conflict (id) do update set
           operator_code=excluded.operator_code, full_name=excluded.full_name,
           email=excluded.email, role=excluded.role, active=true, updated_at=now()`,
        [userId, operator, fullName, email, profile === "s_admin" ? "admin" : "support"],
      );
      if (collaborator) {
        await client.query(
          "update public.tab_colaboradores set profile_id=$1, updated_at=now() where id=$2",
          [userId, collaborator.id],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({ created, updated, missingHash }));
} finally {
  await pool.end();
}
