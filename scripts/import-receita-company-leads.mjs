import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import readline from "node:readline";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import pg from "pg";
import unzipper from "unzipper";
import { TARGET_CITY_NAMES, TARGET_CITIES, normalizeCity } from "./company-leads-cities.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const SOURCE_DIR = process.env.CNPJ_SOURCE_DIR ? path.resolve(process.env.CNPJ_SOURCE_DIR) : null;
const BASE_URL = (
  process.env.CNPJ_BASE_URL || "https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos"
).replace(/\/$/, "");
let competence = process.env.CNPJ_COMPETENCE || "";
const CACHE_DIR = path.resolve(process.env.CNPJ_CACHE_DIR || ".cache/cnpj");
const BATCH_SIZE = Math.min(1000, Math.max(100, Number(process.env.CNPJ_IMPORT_BATCH || 1000)));
const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_PARTNERS = process.argv.includes("--skip-partners");
const EXPANSION_ONLY = process.argv.includes("--expansion-only");
const EXPAND_RADIUS = EXPANSION_ONLY || process.argv.includes("--expand-radius");
const TARGET_CITY_FILTER = new Set(
  String(process.env.CNPJ_TARGET_CITIES || "")
    .split(",")
    .map(normalizeCity)
    .filter(Boolean),
);
const EXPANSION_DAYS = Math.max(1, Number(process.env.CNPJ_EXPANSION_DAYS || 30));
const EXPANSION_CUTOFF = new Date(Date.now() - EXPANSION_DAYS * 86400000)
  .toISOString()
  .slice(0, 10);

if (!DATABASE_URL && !DRY_RUN) {
  throw new Error("Defina DATABASE_URL ou execute com --dry-run.");
}
const normalize = (value) => String(value ?? "").trim();
const nullable = (value) => normalize(value) || null;
const digits = (value) => normalize(value).replace(/\D/g, "");
const isoDate = (value) => {
  const raw = digits(value);
  if (!/^\d{8}$/.test(raw) || raw === "00000000") return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

async function listZipFiles(directory) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listZipFiles(absolute) : [absolute];
    }),
  );
  return nested.flat().filter((file) => file.toLowerCase().endsWith(".zip"));
}

async function download(url, destination) {
  if (fs.existsSync(destination)) return destination;
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  const downloadedBytes = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  const response = await fetch(url, {
    headers: downloadedBytes ? { range: `bytes=${downloadedBytes}-` } : undefined,
    signal: AbortSignal.timeout(7_200_000),
  });
  if (response.status === 416 && downloadedBytes) {
    await fs.promises.rename(partial, destination);
    return destination;
  }
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}.`);
  }
  const canResume = downloadedBytes > 0 && response.status === 206;
  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(partial, { flags: canResume ? "a" : "w" }),
  );
  await fs.promises.rename(partial, destination);
  return destination;
}

async function remoteFiles() {
  if (!competence) {
    const rootResponse = await fetch(`${BASE_URL}/`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!rootResponse.ok) {
      throw new Error(`Não foi possível consultar as competências: HTTP ${rootResponse.status}.`);
    }
    const rootHtml = await rootResponse.text();
    const available = [...rootHtml.matchAll(/href=["'](\d{4}-\d{2}-\d{2})\/?["']/gi)]
      .map((match) => match[1])
      .sort();
    competence = available.at(-1) || "";
    if (!competence) throw new Error("Nenhuma competência foi encontrada no repositório.");
  }

  const directoryUrl = `${BASE_URL}/${competence}/`;
  const response = await fetch(directoryUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`A competência ${competence} não está acessível: HTTP ${response.status}.`);
  }
  const html = await response.text();
  const names = [...html.matchAll(/href=["']([^"']+\.zip)["']/gi)]
    .map((match) => decodeURIComponent(match[1].split("/").pop()))
    .filter(Boolean);
  if (!names.length) throw new Error(`Nenhum ZIP encontrado em ${directoryUrl}.`);
  const wanted = names.filter((name) =>
    /(Estabelecimentos|Empresas|Municipios|Cnaes|Naturezas|Simples|Socios|Qualificacoes|Paises)/i.test(
      name,
    ),
  );
  const downloaded = [];
  for (const [index, name] of wanted.entries()) {
    console.log(`Baixando arquivo ${index + 1}/${wanted.length}: ${name}`);
    downloaded.push(
      await download(
        new URL(name, directoryUrl).toString(),
        path.join(CACHE_DIR, competence, name),
      ),
    );
  }
  return downloaded;
}

async function sourceFiles() {
  const files = SOURCE_DIR ? await listZipFiles(SOURCE_DIR) : await remoteFiles();
  const grouped = {
    establishments: files.filter((file) => /Estabelecimentos/i.test(path.basename(file))),
    companies: files.filter((file) => /Empresas/i.test(path.basename(file))),
    municipalities: files.filter((file) => /Municipios/i.test(path.basename(file))),
    cnaes: files.filter((file) => /Cnaes/i.test(path.basename(file))),
    legalNatures: files.filter((file) => /Naturezas/i.test(path.basename(file))),
    simple: files.filter((file) => /Simples/i.test(path.basename(file))),
    partners: files.filter((file) => /Socios/i.test(path.basename(file))),
    qualifications: files.filter((file) => /Qualificacoes/i.test(path.basename(file))),
    countries: files.filter((file) => /Paises/i.test(path.basename(file))),
  };
  for (const required of ["establishments", "companies", "municipalities", "cnaes"]) {
    if (!grouped[required].length) throw new Error(`Arquivo obrigatório ausente: ${required}.`);
  }
  return grouped;
}

async function forEachZipLine(zipPath, handler) {
  const archive = fs.createReadStream(zipPath).pipe(unzipper.Parse({ forceStream: true }));
  for await (const entry of archive) {
    if (entry.type !== "File") {
      entry.autodrain();
      continue;
    }
    entry.setEncoding("latin1");
    const lines = readline.createInterface({ input: entry, crlfDelay: Infinity });
    for await (const line of lines) {
      if (line) await handler(parseCsvLine(line));
    }
  }
}

async function loadLookup(files) {
  const result = new Map();
  for (const file of files) {
    await forEachZipLine(file, (row) => {
      if (row[0]) result.set(normalize(row[0]), normalize(row[1]));
    });
  }
  return result;
}

function scoreLead(lead) {
  let score = 4;
  if (lead.opened_at) {
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(`${lead.opened_at}T12:00:00Z`).getTime()) / 86400000),
    );
    if (days <= 30) score += 5;
    else if (days <= 90) score += 4;
    else if (days <= 180) score += 3;
    else if (days <= 365) score += 1;
  }
  if (lead.cnae_code) score += 2;
  if (lead.trade_name) score += 1;
  if (["01", "03"].includes(lead.raw_payload.company_size_code)) score += 2;
  return score;
}

function splitBatches(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function upsertBatch(client, rows) {
  const columns = [
    "cnpj",
    "legal_name",
    "trade_name",
    "opened_at",
    "registration_status",
    "status_updated_at",
    "cnae_code",
    "cnae_description",
    "company_size",
    "legal_nature",
    "city",
    "state",
    "postal_code",
    "neighborhood",
    "address",
    "source",
    "source_url",
    "relevance_score",
    "last_seen_at",
    "raw_payload",
    "company_root",
    "branch_type",
    "secondary_cnaes",
    "phone_secondary",
    "fax",
    "capital_social",
    "responsible_qualification",
    "special_status",
    "special_status_at",
    "simple_opted_at",
    "simple_excluded_at",
    "mei_opted_at",
    "mei_excluded_at",
    "search_alias",
    "existing_client_id",
    "existing_client_company_id",
  ];
  const payload = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column] ?? null])),
  );
  await client.query(
    `insert into public.company_leads (${columns.join(",")})
     select ${columns.map((column) => `incoming.${column}`).join(",")}
       from jsonb_populate_recordset(null::public.company_leads, $1::jsonb) incoming
     on conflict (cnpj) do update set
       legal_name = excluded.legal_name,
       trade_name = excluded.trade_name,
       opened_at = excluded.opened_at,
       registration_status = excluded.registration_status,
       status_updated_at = excluded.status_updated_at,
       cnae_code = excluded.cnae_code,
       cnae_description = excluded.cnae_description,
       company_size = excluded.company_size,
       legal_nature = excluded.legal_nature,
       city = excluded.city,
       state = excluded.state,
       postal_code = excluded.postal_code,
       neighborhood = excluded.neighborhood,
       address = excluded.address,
       source = excluded.source,
       source_url = excluded.source_url,
       relevance_score = excluded.relevance_score,
       last_seen_at = excluded.last_seen_at,
      raw_payload = excluded.raw_payload,
       company_root = excluded.company_root,
       branch_type = excluded.branch_type,
       secondary_cnaes = excluded.secondary_cnaes,
       phone_secondary = excluded.phone_secondary,
       fax = excluded.fax,
       capital_social = excluded.capital_social,
       responsible_qualification = excluded.responsible_qualification,
       special_status = excluded.special_status,
       special_status_at = excluded.special_status_at,
       simple_opted_at = excluded.simple_opted_at,
       simple_excluded_at = excluded.simple_excluded_at,
       mei_opted_at = excluded.mei_opted_at,
       mei_excluded_at = excluded.mei_excluded_at,
       search_alias = coalesce(excluded.search_alias, public.company_leads.search_alias),
       existing_client_id = coalesce(excluded.existing_client_id, public.company_leads.existing_client_id),
       existing_client_company_id = coalesce(excluded.existing_client_company_id, public.company_leads.existing_client_company_id),
       updated_at = now()`,
    [JSON.stringify(payload)],
  );
}

const files = await sourceFiles();
console.log(`Fonte: ${SOURCE_DIR || `${BASE_URL}/${competence}`}`);
console.log(`Municípios-alvo: ${TARGET_CITIES.length}`);

const municipalityLookup = await loadLookup(files.municipalities);
const cnaeLookup = await loadLookup(files.cnaes);
const legalNatureLookup = files.legalNatures.length
  ? await loadLookup(files.legalNatures)
  : new Map();
const qualificationLookup = files.qualifications.length
  ? await loadLookup(files.qualifications)
  : new Map();
const countryLookup = files.countries.length ? await loadLookup(files.countries) : new Map();
const targetMunicipalities = new Map();
for (const [rfbCode, name] of municipalityLookup) {
  const targets = TARGET_CITY_NAMES.get(normalizeCity(name));
  if (targets?.length) targetMunicipalities.set(rfbCode, targets);
}
const foundTargetCities = new Set(
  [...targetMunicipalities.values()].flatMap((targets) => targets.map(({ ibgeCode }) => ibgeCode)),
);
if (foundTargetCities.size !== TARGET_CITIES.length) {
  const missing = TARGET_CITIES.filter(([ibgeCode]) => !foundTargetCities.has(ibgeCode)).map(
    ([, name]) => name,
  );
  console.warn(`Municípios não encontrados na tabela da Receita: ${missing.join(", ")}.`);
}

const establishments = [];
const companyRoots = new Set();
let scannedEstablishments = 0;
for (const file of files.establishments) {
  await forEachZipLine(file, (row) => {
    scannedEstablishments += 1;
    const municipality = targetMunicipalities
      .get(normalize(row[20]))
      ?.find((target) => target.state === normalize(row[19]));
    if (!municipality || normalize(row[5]) !== "02") return;
    if (TARGET_CITY_FILTER.size && !TARGET_CITY_FILTER.has(normalizeCity(municipality.name)))
      return;
    const openedAt = isoDate(row[10]);
    if (!EXPAND_RADIUS && municipality.distanceKm > 80) return;
    if (EXPANSION_ONLY && municipality.distanceKm <= 80) return;
    // Mantém o histórico do núcleo e limita a expansão a leads comerciais recentes.
    if (municipality.distanceKm > 80 && (!openedAt || openedAt < EXPANSION_CUTOFF)) return;
    const root = digits(row[0]).padStart(8, "0");
    const order = digits(row[1]).padStart(4, "0");
    const verifier = digits(row[2]).padStart(2, "0");
    companyRoots.add(root);
    establishments.push({
      root,
      cnpj: `${root}${order}${verifier}`,
      tradeName: nullable(row[4]),
      branchType: normalize(row[3]) === "1" ? "Matriz" : "Filial",
      statusUpdatedAt: isoDate(row[6]),
      openedAt,
      cnaeCode: digits(row[11]) || null,
      secondaryCnaes: normalize(row[12]).split(",").map(digits).filter(Boolean),
      street: [nullable(row[13]), nullable(row[14])].filter(Boolean).join(" ") || null,
      number: nullable(row[15]),
      complement: nullable(row[16]),
      neighborhood: nullable(row[17]),
      postalCode: digits(row[18]) || null,
      state: normalize(row[19]),
      municipality,
      phone: [digits(row[21]), digits(row[22])].filter(Boolean).join(""),
      phoneSecondary: [digits(row[23]), digits(row[24])].filter(Boolean).join(""),
      fax: [digits(row[25]), digits(row[26])].filter(Boolean).join(""),
      email: nullable(row[27]),
      specialStatus: nullable(row[28]),
      specialStatusAt: isoDate(row[29]),
    });
  });
  console.log(`Estabelecimentos filtrados: ${establishments.length}`);
}

const companies = new Map();
for (const file of files.companies) {
  await forEachZipLine(file, (row) => {
    const root = digits(row[0]).padStart(8, "0");
    if (!companyRoots.has(root)) return;
    companies.set(root, {
      legalName: normalize(row[1]),
      legalNatureCode: normalize(row[2]),
      responsibleQualificationCode: normalize(row[3]),
      capitalSocial: Number(normalize(row[4]).replace(",", ".")) || null,
      companySizeCode: normalize(row[5]),
    });
  });
}

const simple = new Map();
for (const file of files.simple) {
  await forEachZipLine(file, (row) => {
    const root = digits(row[0]).padStart(8, "0");
    if (!companyRoots.has(root)) return;
    simple.set(root, {
      simple: normalize(row[1]) === "S",
      simpleOptedAt: isoDate(row[2]),
      simpleExcludedAt: isoDate(row[3]),
      mei: normalize(row[4]) === "S",
      meiOptedAt: isoDate(row[5]),
      meiExcludedAt: isoDate(row[6]),
    });
  });
}

const sizeNames = new Map([
  ["00", "Não informado"],
  ["01", "Microempresa"],
  ["03", "Empresa de pequeno porte"],
  ["05", "Demais"],
]);
const now = new Date().toISOString();
const leads = establishments.flatMap((establishment) => {
  const company = companies.get(establishment.root);
  if (!company?.legalName) return [];
  const taxOptions = simple.get(establishment.root) || { simple: false, mei: false };
  const rawPayload = {
    ibge_city_code: establishment.municipality.ibgeCode,
    rfb_city_code: [...targetMunicipalities].find(([, cities]) =>
      cities.some((city) => city.ibgeCode === establishment.municipality.ibgeCode),
    )?.[0],
    company_size_code: company.companySizeCode,
    simple: taxOptions.simple,
    mei: taxOptions.mei,
    phone: establishment.phone || null,
    email: establishment.email,
    competence: competence || null,
  };
  const lead = {
    cnpj: establishment.cnpj,
    legal_name: company.legalName,
    trade_name: establishment.tradeName,
    opened_at: establishment.openedAt,
    registration_status: "ATIVA",
    status_updated_at: establishment.statusUpdatedAt,
    cnae_code: establishment.cnaeCode,
    cnae_description: cnaeLookup.get(establishment.cnaeCode) || null,
    company_size: sizeNames.get(company.companySizeCode) || "Não informado",
    legal_nature: legalNatureLookup.get(company.legalNatureCode) || company.legalNatureCode || null,
    city: establishment.municipality.name,
    state: establishment.state,
    postal_code: establishment.postalCode,
    neighborhood: establishment.neighborhood,
    address:
      [establishment.street, establishment.number, establishment.complement]
        .filter(Boolean)
        .join(", ") || null,
    source: "receita-federal-dados-abertos",
    source_url:
      "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/dados-abertos/cadastros",
    last_seen_at: now,
    raw_payload: rawPayload,
    company_root: establishment.root,
    branch_type: establishment.branchType,
    secondary_cnaes: establishment.secondaryCnaes,
    phone_secondary: establishment.phoneSecondary || null,
    fax: establishment.fax || null,
    capital_social: company.capitalSocial,
    responsible_qualification:
      qualificationLookup.get(company.responsibleQualificationCode) ||
      company.responsibleQualificationCode ||
      null,
    special_status: establishment.specialStatus,
    special_status_at: establishment.specialStatusAt,
    simple_opted_at: taxOptions.simpleOptedAt || null,
    simple_excluded_at: taxOptions.simpleExcludedAt || null,
    mei_opted_at: taxOptions.meiOptedAt || null,
    mei_excluded_at: taxOptions.meiExcludedAt || null,
  };
  return [{ ...lead, relevance_score: scoreLead(lead) }];
});

console.log(`Registros nacionais lidos: ${scannedEstablishments.toLocaleString("pt-BR")}`);
console.log(`Leads ativos preparados: ${leads.length.toLocaleString("pt-BR")}`);
if (DRY_RUN) process.exit(0);

async function connectDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const database = new pg.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    database.on("error", (error) => {
      console.warn(`Conexão com o banco interrompida: ${error.message}. Reconectando no próximo lote.`);
    });
    try {
      await database.connect();
      await database.query("set default_transaction_read_only = off");
      await database.query("set transaction_read_only = off");
      return database;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
  throw lastError;
}

let client = await connectDatabase();
async function withReconnect(operation, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(client);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      try {
        await client.end();
      } catch {
        // A conexão já pode ter sido encerrada pelo servidor.
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      client = await connectDatabase();
    }
  }
  throw lastError;
}
try {
  const clientAliases = await withReconnect((database) => database.query(
    `select id, client_id,
            regexp_replace(coalesce(document, ''), '\\D', '', 'g') cnpj,
            nullif(trim(concat_ws(' ', legal_name, trade_name)), '') search_alias
       from public.client_companies`,
  ));
  const aliasesByCnpj = new Map(
    clientAliases.rows
      .filter(({ cnpj }) => cnpj)
      .map(({ cnpj, search_alias, client_id, id }) => [
        cnpj,
        { searchAlias: search_alias, clientId: client_id, companyId: id },
      ]),
  );
  for (const lead of leads) {
    const clientMatch = aliasesByCnpj.get(lead.cnpj);
    lead.search_alias = clientMatch?.searchAlias || null;
    lead.existing_client_id = clientMatch?.clientId || null;
    lead.existing_client_company_id = clientMatch?.companyId || null;
  }

  const cnaeRows = [...cnaeLookup.entries()].map(([code, description]) => ({ code, description }));
  for (const batch of splitBatches(cnaeRows, BATCH_SIZE)) {
    const values = [];
    const placeholders = batch.map(({ code, description }, index) => {
      values.push(code, description);
      return `($${index * 2 + 1}, $${index * 2 + 2})`;
    });
    await withReconnect((database) => database.query(
      `insert into public.cnae_labels (cnae_code, cnae_description)
       values ${placeholders.join(",")}
       on conflict (cnae_code) do update
       set cnae_description = excluded.cnae_description`,
      values,
    ));
  }

  for (const [index, batch] of splitBatches(leads, BATCH_SIZE).entries()) {
    await withReconnect((database) => upsertBatch(database, batch));
    console.log(
      `Gravando empresas: ${Math.min((index + 1) * BATCH_SIZE, leads.length)}/${leads.length}`,
    );
  }
  if (files.partners.length && !SKIP_PARTNERS) {
    let importedPartners = 0;
    for (const file of files.partners) {
      const partnerBatch = [];
      const flushPartners = async () => {
        if (!partnerBatch.length) return;
        const uniquePartners = [
          ...new Map(partnerBatch.map((partner) => [partner.sourceKey, partner])).values(),
        ];
        const values = [];
        const placeholders = uniquePartners.map((partner, rowIndex) => {
          const start = rowIndex * 7;
          values.push(
            partner.companyRoot,
            partner.sourceKey,
            partner.name,
            partner.type,
            partner.qualification,
            partner.joinedAt,
            partner.country,
          );
          return `(${Array.from({ length: 7 }, (_, index) => `$${start + index + 1}`).join(",")})`;
        });
        await withReconnect((database) => database.query(
          `insert into public.company_lead_partners
            (company_root, source_key, partner_name, partner_type, qualification, joined_at, country)
           values ${placeholders.join(",")}
           on conflict (source_key) do update set
             partner_name = excluded.partner_name,
             partner_type = excluded.partner_type,
             qualification = excluded.qualification,
             joined_at = excluded.joined_at,
             country = excluded.country,
             updated_at = now()`,
          values,
        ));
        importedPartners += uniquePartners.length;
        partnerBatch.length = 0;
      };
      await forEachZipLine(file, async (row) => {
        const companyRoot = digits(row[0]).padStart(8, "0");
        if (!companyRoots.has(companyRoot)) return;
        const name = normalize(row[2]);
        if (!name) return;
        const type =
          { 1: "Pessoa jurídica", 2: "Pessoa física", 3: "Estrangeiro" }[normalize(row[1])] ||
          "Não informado";
        const qualificationCode = normalize(row[4]);
        const sourceKey = crypto
          .createHash("sha256")
          .update(
            [companyRoot, normalize(row[1]), name, qualificationCode, normalize(row[5])].join("|"),
          )
          .digest("hex");
        partnerBatch.push({
          companyRoot,
          sourceKey,
          name,
          type,
          qualification: qualificationLookup.get(qualificationCode) || qualificationCode || null,
          joinedAt: isoDate(row[5]),
          country: countryLookup.get(normalize(row[6])) || null,
        });
        if (partnerBatch.length >= BATCH_SIZE) await flushPartners();
      });
      await flushPartners();
      console.log(`Sócios criados/atualizados: ${importedPartners.toLocaleString("pt-BR")}`);
    }
  }
  console.log(`Empresas criadas/atualizadas: ${leads.length}`);
} finally {
  await client.end();
}
