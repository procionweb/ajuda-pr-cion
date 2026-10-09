import { supabase } from "@/lib/supabase";
import { loadClients, getGroupMembers, resolveGroupCode } from "@/lib/clients-store";
import type { ClientRow } from "@/routes/clientes.index";

export type ClientContact = {
  id: string;
  name: string;
  value: string;
};

export type ClientCompanySummary = {
  id: string;
  companyNumber: number | null;
  legalName: string;
  tradeName: string;
  document: string;      // CNPJ formatado (00.000.000/0000-00) quando 14 dígitos
  documentRaw: string;   // apenas dígitos
  city: string;
  state: string;
  isPrincipal: boolean;
  clientId: string | null;    // id UUID do cliente ao qual a empresa pertence
  clientAcronym: string;      // sigla do cliente ao qual a empresa pertence
};

export type ClientContactsBundle = {
  clientId: string | null;
  emails: ClientContact[];
  phones: ClientContact[];
  companies: ClientCompanySummary[];
};

type RawContact = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean | null;
  deleted_at?: string | null;
};

type RawCompany = {
  id?: string | null;
  company_number?: number | null;
  legal_name?: string | null;
  trade_name?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
};

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

function isPhoneValid(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length >= 8 && digits.length <= 13;
}

function sortContacts(list: ClientContact[]): ClientContact[] {
  return [...list].sort(
    (a, b) => collator.compare(a.name, b.name) || collator.compare(a.value, b.value),
  );
}

function dedupe(list: ClientContact[]): ClientContact[] {
  const seen = new Set<string>();
  const out: ClientContact[] = [];
  for (const item of list) {
    const key = `${item.value.toLowerCase()}|${item.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function mapCompanies(
  raw: RawCompany[],
  ownerClientId: string | null,
  ownerAcronym: string,
): ClientCompanySummary[] {
  const list = raw
    .filter((c) => c && (c.id || c.document || c.legal_name || c.trade_name))
    .map<ClientCompanySummary>((c) => {
      const documentRaw = String(c.document ?? "").replace(/\D+/g, "");
      const isPrincipalByCnpj = documentRaw.length === 14 && documentRaw.slice(8, 12) === "0001";
      const isPrincipalByNumber = c.company_number === 1;
      return {
        id: String(c.id ?? documentRaw ?? Math.random()),
        companyNumber: typeof c.company_number === "number" ? c.company_number : null,
        legalName: String(c.legal_name ?? "").trim(),
        tradeName: String(c.trade_name ?? "").trim(),
        document: documentRaw ? formatCnpj(documentRaw) : String(c.document ?? ""),
        documentRaw,
        city: String(c.city ?? "").trim(),
        state: String(c.state ?? "").trim().toUpperCase(),
        isPrincipal: isPrincipalByCnpj || isPrincipalByNumber,
        clientId: ownerClientId,
        clientAcronym: ownerAcronym,
      };
    });

  if (list.length > 0 && !list.some((c) => c.isPrincipal)) {
    const min = list.reduce((acc, c) =>
      (c.companyNumber ?? Number.POSITIVE_INFINITY) < (acc.companyNumber ?? Number.POSITIVE_INFINITY) ? c : acc,
    list[0]);
    min.isPrincipal = true;
  }

  return list.sort((a, b) => {
    if (a.isPrincipal !== b.isPrincipal) return a.isPrincipal ? -1 : 1;
    const an = a.companyNumber ?? Number.POSITIVE_INFINITY;
    const bn = b.companyNumber ?? Number.POSITIVE_INFINITY;
    if (an !== bn) return an - bn;
    return collator.compare(a.tradeName || a.legalName, b.tradeName || b.legalName);
  });
}

export async function fetchClientContacts(acronym: string): Promise<ClientContactsBundle> {
  if (!acronym) return { clientId: null, emails: [], phones: [], companies: [] };
  const { data, error } = await supabase.rpc("get_crm_client", { client_acronym: acronym });
  if (error) throw error;

  const clientId = (data?.client?.id as string | undefined) ?? null;
  const raw: RawContact[] = Array.isArray(data?.contacts) ? (data.contacts as RawContact[]) : [];
  const rawCompanies: RawCompany[] = Array.isArray(data?.companies) ? (data.companies as RawCompany[]) : [];

  const emails: ClientContact[] = [];
  const phones: ClientContact[] = [];

  for (const c of raw) {
    if (!c || c.active === false || c.deleted_at) continue;
    const name = (c.name ?? "").trim() || "Contato";
    if (c.email) {
      const value = c.email.trim();
      if (value && isEmailValid(value)) emails.push({ id: String(c.id ?? value), name, value });
    }
    if (c.phone) {
      const value = c.phone.trim();
      if (value && isPhoneValid(value)) phones.push({ id: String(c.id ?? value), name, value });
    }
  }

  return {
    clientId,
    emails: sortContacts(dedupe(emails)),
    phones: sortContacts(dedupe(phones)),
    companies: mapCompanies(rawCompanies, clientId, acronym.trim().toUpperCase()),
  };
}

/**
 * Consolida todas as empresas/subempresas do GRUPO ao qual o cliente pertence.
 * - Se o cliente possui grupo, busca todos os membros do grupo em paralelo.
 * - Se o cliente é raiz de um grupo (outros clientes apontam para ele), idem.
 * - Se o cliente não pertence a nenhum grupo, retorna apenas o próprio bundle.
 * Deduplica por client_company_id ou por CNPJ+companyNumber.
 */
export async function fetchClientGroupCompanies(
  client: ClientRow,
): Promise<{
  emails: ClientContact[];
  phones: ClientContact[];
  companies: ClientCompanySummary[];
  clientId: string | null;
  groupCode: string | null;
}> {
  // Garante cache de clientes carregado para resolver membros do grupo.
  const [allClients, groupResult] = await Promise.all([
    loadClients().catch(() => [] as ClientRow[]),
    supabase.rpc("get_crm_client_group_companies", { client_acronym: client.acronym }),
  ]);
  const groupCode = resolveGroupCode(client, allClients);

  // Lista de siglas a consultar (sempre inclui o próprio cliente).
  const acronyms = new Set<string>();
  acronyms.add(client.acronym.trim().toUpperCase());
  if (groupCode) {
    for (const m of getGroupMembers(groupCode, allClients)) {
      acronyms.add(m.acronym.trim().toUpperCase());
    }
  }

  const bundles = await Promise.all(
    Array.from(acronyms).map((a) =>
      fetchClientContacts(a).catch((err) => {
        console.warn(`[client-contacts] falha ao carregar ${a}`, err);
        return { clientId: null, emails: [], phones: [], companies: [] } as ClientContactsBundle;
      }),
    ),
  );

  const selfBundle = bundles.find((b, i) =>
    Array.from(acronyms)[i] === client.acronym.trim().toUpperCase(),
  ) ?? bundles[0];

  // Dedup companies por id (client_company_id) → fallback: CNPJ|companyNumber|acronym.
  const seen = new Set<string>();
  const companies: ClientCompanySummary[] = [];
  for (const bundle of bundles) {
    for (const co of bundle.companies) {
      const key = co.id
        ? `id:${co.id}`
        : `cnpj:${co.documentRaw}|n:${co.companyNumber ?? ""}|a:${co.clientAcronym}`;
      if (seen.has(key)) continue;
      seen.add(key);
      companies.push(co);
    }
  }

  // A consulta do cadastro inclui também membros do grupo sem client_companies.
  // Esses registros não aparecem nos bundles individuais.
  if (groupResult.error) {
    console.warn("[client-contacts] falha ao carregar empresas do grupo", groupResult.error);
  } else if (Array.isArray(groupResult.data)) {
    const rowsByClient = new Map<string, RawCompany[]>();
    for (const raw of groupResult.data as (RawCompany & { client_acronym?: string })[]) {
      const acronym = String(raw.client_acronym || client.acronym).trim().toUpperCase();
      rowsByClient.set(acronym, [...(rowsByClient.get(acronym) ?? []), raw]);
    }
    for (const [acronym, rows] of rowsByClient) {
      const owner = allClients.find((item) => item.acronym.trim().toUpperCase() === acronym);
      const ownerId = owner?.id || (acronym === client.acronym.trim().toUpperCase() ? selfBundle?.clientId : null);
      for (const company of mapCompanies(rows, ownerId ?? null, acronym)) {
        if (seen.has("id:" + company.id)) continue;
        seen.add("id:" + company.id);
        companies.push(company);
      }
    }
  }

  // Ordena: principal primeiro, depois por sigla e company_number.
  companies.sort((a, b) => {
    if (a.isPrincipal !== b.isPrincipal) return a.isPrincipal ? -1 : 1;
    const ac = collator.compare(a.clientAcronym, b.clientAcronym);
    if (ac !== 0) return ac;
    const an = a.companyNumber ?? Number.POSITIVE_INFINITY;
    const bn = b.companyNumber ?? Number.POSITIVE_INFINITY;
    if (an !== bn) return an - bn;
    return collator.compare(a.tradeName || a.legalName, b.tradeName || b.legalName);
  });

  return {
    emails: selfBundle?.emails ?? [],
    phones: selfBundle?.phones ?? [],
    companies,
    clientId: selfBundle?.clientId ?? null,
    groupCode,
  };
}

export async function addClientContact(
  clientId: string,
  kind: "email" | "phone",
  value: string,
  name: string,
): Promise<ClientContact> {
  const trimmedValue = value.trim();
  const trimmedName = name.trim() || trimmedValue;
  if (kind === "email" && !isEmailValid(trimmedValue)) {
    throw new Error("E-mail inválido.");
  }
  if (kind === "phone" && !isPhoneValid(trimmedValue)) {
    throw new Error("Telefone inválido.");
  }
  const { data, error } = await supabase.rpc("add_client_contact", {
    p_client_id: clientId,
    p_kind: kind,
    p_value: trimmedValue,
    p_name: trimmedName,
  });
  if (error) throw error;
  const row = (data ?? {}) as RawContact;
  const displayValue = (kind === "email" ? row.email : row.phone) ?? trimmedValue;
  return {
    id: String(row.id ?? `${kind}-${Date.now()}`),
    name: (row.name ?? trimmedName) || "Contato",
    value: displayValue,
  };
}

export function formatPhoneDisplay(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    const rest = digits.slice(2);
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
  }
  return value;
}
