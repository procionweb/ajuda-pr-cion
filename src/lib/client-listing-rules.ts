import moduleOptions from "@/data/client-company-modules.json";
export const companyModuleOptions = moduleOptions;
export type ListingCompany = {
  id: string;
  legal_name: string;
  trade_name: string;
  document: string;
  industry: string;
  size: string;
  city: string;
  state: string;
  postal_code: string;
  company_number: number | null;
  active: boolean;
  modules: unknown;
  billing: unknown;
};
export type ListingContext = {
  id: string;
  acronym: string;
  source: Record<string, unknown>;
  companies: ListingCompany[];
  commercialId?: string;
};
export type ExtraClientFilters = {
  periods?: Record<string, { start?: string; end?: string }>;
  hasBoletos?: string;
  billing?: string;
  companyModules?: string[];
};
export const clientDatePeriods = [
  ["created", "Criação"],
  ["modified", "Atualização"],
  ["cli_inicio_nfe", "Início de emissão NFE"],
  ["setup", "Setup"],
  ["version", "Versão"],
  ["cli_data_cadastro", "Cadastro"],
] as const;
export const industryLabel = (value: unknown) =>
  ({ "1": "Comércio", "2": "Serviços", "3": "Serviços", "4": "Indústria" })[String(value)] ||
  (String(value ?? "").trim() && String(value) !== "0" ? String(value) : "Ramo não preenchido");
export const sizeLabel = (value: unknown) =>
  ({ P: "Pequeno", M: "Médio", G: "Grande" })[String(value)] || String(value ?? "");
export const normal = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const numbers = (value: unknown) => String(value ?? "").replace(/\D/g, "");
export function parsedLegacy(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
export function moduleCodes(value: unknown): string[] {
  const parsed = parsedLegacy(value);
  if (Array.isArray(parsed)) return parsed.map(String);
  if (parsed && typeof parsed === "object") return Object.keys(parsed);
  return String(parsed ?? "")
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function hasBilling(value: unknown) {
  const p = parsedLegacy(value);
  return Array.isArray(p)
    ? p.length > 0
    : p && typeof p === "object"
      ? Object.keys(p).length > 0
      : Boolean(String(p ?? "").trim());
}
export function isoDay(value: unknown) {
  const s = String(value ?? "");
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}
export function matchesPeriod(value: unknown, period?: { start?: string; end?: string }) {
  if (!period?.start && !period?.end) return true;
  const d = isoDay(value);
  return Boolean(d && (!period.start || d >= period.start) && (!period.end || d <= period.end));
}
export function matchesCompany(
  company: ListingCompany,
  f: {
    razaoSocial: string;
    fantasia: string;
    porte: string;
    ramo: string;
    cep: string;
    cidade: string;
    uf: string;
    cnpj: string;
  } & ExtraClientFilters,
) {
  if (f.razaoSocial && !normal(company.legal_name).includes(normal(f.razaoSocial))) return false;
  if (f.fantasia && !normal(company.trade_name).includes(normal(f.fantasia))) return false;
  if (f.porte && sizeLabel(company.size) !== f.porte) return false;
  if (f.ramo && industryLabel(company.industry) !== f.ramo) return false;
  if (f.cep && !numbers(company.postal_code).includes(numbers(f.cep))) return false;
  if (f.cidade && !normal(company.city).includes(normal(f.cidade))) return false;
  if (f.uf && company.state !== f.uf) return false;
  if (f.cnpj && !numbers(company.document).includes(numbers(f.cnpj))) return false;
  if (f.hasBoletos && hasBilling(company.billing) !== (f.hasBoletos === "yes")) return false;
  if (
    f.billing &&
    !normal(JSON.stringify(parsedLegacy(company.billing))).includes(normal(f.billing))
  )
    return false;
  if (
    f.companyModules?.length &&
    !f.companyModules.some((code) => moduleCodes(company.modules).includes(code))
  )
    return false;
  return true;
}

export function clientStatusLabel(value: unknown, fallback: string) {
  return (
    { "0": "Inativo", "1": "Ativo", "2": "Pendente", "9": "Bloqueado" }[String(value ?? "")] ||
    fallback
  );
}
