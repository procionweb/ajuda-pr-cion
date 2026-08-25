import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  Boxes,
  Calculator,
  ShoppingCart,
  Truck,
  Wrench,
  MinusCircle,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Cable,
  CalendarDays,
  Check,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  Cpu,
  Database,
  FileText,
  Filter,
  FolderOpen,
  Globe2,
  RefreshCw,
  Search,
  Save,
  HardDrive,
  KeyRound,
  MessageCircle,
  Monitor,
  Mail,
  MapPin,
  Landmark,
  LockKeyhole,
  Eye,
  History,
  Phone,
  Printer,
  ShieldCheck,
  ScrollText,
  Server,
  Smartphone,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import {
  formatVersionDate,
  getClientErpVersionStatus,
  isErpVersionOutdated,
  latestErpAlterationDate,
} from "@/lib/erp-versions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listClients, searchClientsByCompanies } from "@/lib/clients-api";
import type {
  ClientCompany,
  ClientContact,
  ClientEvent,
  ClientHadronUser,
  ClientHadronInfo,
  ClientInternet,
  ClientLogs,
  ClientModule,
  ClientParameter,
  ClientTerminal,
  ClientTicket,
  ClientTicketActivity,
} from "@/lib/clients-api";
import { normalizeCityUf } from "@/lib/br-city";
import { supabase } from "@/lib/supabase";
import hadronIconUrl from "@/assets/menu-hadron-solid.png";

export function HadronMenuIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block bg-current", className)}
      style={{
        WebkitMask: `url(${hadronIconUrl}) center / contain no-repeat`,
        mask: `url(${hadronIconUrl}) center / contain no-repeat`,
      }}
    />
  );
}

function HadronDetail({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

import bankSantander from "@/assets/banks/santander.svg";
import bankBradesco from "@/assets/banks/bradesco.svg";
import bankItau from "@/assets/banks/itau.svg";
import bankBrasil from "@/assets/banks/banco-do-brasil.svg";
import bankCaixa from "@/assets/banks/caixa.svg";
import bankSicredi from "@/assets/banks/sicredi.svg";
import bankSicoob from "@/assets/banks/sicoob.svg";
import bankInter from "@/assets/banks/inter.svg";
import bankSafra from "@/assets/banks/safra.svg";
import bankBanrisul from "@/assets/banks/banrisul.svg";
import bankNubank from "@/assets/banks/nubank.svg";

const BANK_MARKS: Array<{ match: RegExp; label: string; src: string }> = [
  { match: /santander/, label: "Santander", src: bankSantander },
  { match: /bradesco/, label: "Bradesco", src: bankBradesco },
  { match: /ita[uú]|unibanco/, label: "Itaú", src: bankItau },
  { match: /(banco\s*do\s*brasil|\bbb\b)/, label: "Banco do Brasil", src: bankBrasil },
  { match: /(caixa|\bcef\b)/, label: "Caixa", src: bankCaixa },
  { match: /sicredi/, label: "Sicredi", src: bankSicredi },
  { match: /sicoob/, label: "Sicoob", src: bankSicoob },
  { match: /(banco\s*inter|\binter\b)/, label: "Inter", src: bankInter },
  { match: /safra/, label: "Safra", src: bankSafra },
  { match: /banrisul/, label: "Banrisul", src: bankBanrisul },
  { match: /(nubank|\bnu\b)/, label: "Nubank", src: bankNubank },
];

function BankMark({ name }: { name: string }) {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const mark = BANK_MARKS.find((item) => item.match.test(normalized));

  if (!mark) {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background">
        <Landmark aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">
      <img src={mark.src} alt={mark.label} loading="lazy" className="h-5 w-5 object-contain" />
    </span>
  );
}

function ConfigInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { CompanyLeadsTab } from "@/components/clients/CompanyLeadsTab";
import { addLocalEvent, useLocalEventsForClient } from "@/lib/local-events-store";

const clientesSearchSchema = z.object({
  grupo: z.string().catch("").optional(),
  origem: z.string().catch("").optional(),
  q: z.string().catch("").optional(),
  campo: z.string().catch("").optional(),
  sigla: z.string().catch("").optional(),
  status: z.string().catch("").optional(),
});

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes - Portal Procion" }] }),
  validateSearch: clientesSearchSchema,
  loader: async () => {
    try {
      return { clients: await listClients(), loadFailed: false };
    } catch (error) {
      console.error("Não foi possível carregar clientes do Supabase", error);
      return { clients: [] as ClientRow[], loadFailed: true };
    }
  },
  component: ClientsPage,
});

export type ClientRow = {
  id: string;
  registered: string; // dd/MM/yyyy
  acronym: string;
  group: string;
  name: string; // apelido / nome curto
  razaoSocial: string;
  fantasia: string;
  segment: string; // ramo
  size: string; // porte
  version: string;
  versionDate: string; // data da versão (release)
  versionUpdatedAt: string; // data/hora em que a versão foi instalada no cliente
  updated: string;
  updatedAt: string; // última alteração do cadastro no CRM
  city: string; // "Cidade - UF"
  uf: string;
  cep: string;
  cnpj: string;
  status: "Ativo" | "Inativo";
  sourcePayload?: Record<string, unknown>;
};

export const clientRows: ClientRow[] = [
  {
    id: "avc",
    registered: "06/05/2026",
    acronym: "AVC",
    group: "ASC",
    name: "CENTER GLASS",
    razaoSocial: "CENTER GLASS ACESSORIOS AUTOMOBILISTICOS LTDA",
    fantasia: "CENTER GLASS CATANDUVA",
    segment: "Comercio",
    size: "Pequeno",
    version: "2.0",
    versionDate: "02/07/2026",
    versionUpdatedAt: "14/07/2026 09:02",
    updated: "15/06/2026 09:58",
    updatedAt: "17/07/2026 10:17",
    city: "Catanduva - SP",
    uf: "SP",
    cep: "15805-254",
    cnpj: "66.613.387/0001-60",
    status: "Ativo",
  },
  {
    id: "mit",
    registered: "12/03/2019",
    acronym: "MIT",
    group: "",
    name: "MINERACAO ITAPORANGA",
    razaoSocial: "MINERACAO ITAPORANGA LTDA",
    fantasia: "MIT MINERADORA",
    segment: "Industria",
    size: "Medio",
    version: "2.0",
    versionDate: "02/07/2026",
    versionUpdatedAt: "10/07/2026 15:41",
    updated: "08/07/2026 08:24",
    updatedAt: "16/07/2026 14:22",
    city: "Curitiba - PR",
    uf: "PR",
    cep: "80010-010",
    cnpj: "18.447.221/0001-40",
    status: "Ativo",
  },
  {
    id: "mrg",
    registered: "18/09/2020",
    acronym: "MRG",
    group: "",
    name: "MERCEARIA GOMES",
    razaoSocial: "MERCEARIA E SACOLAO GOMES",
    fantasia: "SACOLAO GOMES",
    segment: "Comercio",
    size: "Pequeno",
    version: "1.9",
    versionDate: "18/06/2026",
    versionUpdatedAt: "25/06/2026 10:12",
    updated: "08/07/2026 08:17",
    updatedAt: "15/07/2026 09:05",
    city: "Belo Horizonte - MG",
    uf: "MG",
    cep: "30130-010",
    cnpj: "31.095.640/0001-12",
    status: "Ativo",
  },
  {
    id: "epb",
    registered: "04/11/2022",
    acronym: "EPB",
    group: "",
    name: "EPAPER BOX",
    razaoSocial: "EPAPER BOX EMBALAGENS LTDA",
    fantasia: "EPAPER BOX",
    segment: "Industria",
    size: "Medio",
    version: "2.0",
    versionDate: "02/07/2026",
    versionUpdatedAt: "09/07/2026 18:30",
    updated: "08/07/2026 08:40",
    updatedAt: "17/07/2026 08:47",
    city: "São Paulo - SP",
    uf: "SP",
    cep: "01310-100",
    cnpj: "47.510.982/0001-73",
    status: "Ativo",
  },
];

const modules = [
  "Faturamento",
  "Compras",
  "Contas a Receber",
  "Contas a Pagar",
  "Estoque",
  "Ordens de Serviço",
  "Frente de Loja",
];
const unavailableModules = [
  "Folha de Pgto",
  "Livros Fiscais - SPED",
  "Contabilidade",
  "Ativo Imobilizado",
  "Transportes",
  "Mobile",
  "Integracoes Hadron Web",
  "Fluxo de Caixa",
];
const terminals = [
  ["05", "181.225.157.89", "P:/PROGEST/", "02/07/2026", "09/07/2026 09:14"],
  ["02", "177.21.58.91", "P:/PROGEST/", "02/07/2026", "06/07/2026 10:57"],
  ["03", "177.21.58.91", "P:/PROGEST/", "02/07/2026", "06/07/2026 10:50"],
  ["50", "177.21.58.91", "P:/PROGEST/", "11/05/2026", "27/05/2026 18:14"],
  ["01", "177.21.58.91", "P:/PROGEST/", "11/05/2026", "26/05/2026 11:29"],
];

type StatusFilter =
  | "Todos"
  | "Ativo"
  | "Inativo"
  | "Pendente"
  | "Bloqueado"
  | "Aviso do Cliente"
  | "Mensagem no Hádron";

const QUICK_STATUS_OPTIONS: StatusFilter[] = [
  "Inativo",
  "Ativo",
  "Pendente",
  "Bloqueado",
  "Aviso do Cliente",
  "Mensagem no Hádron",
  "Todos",
];

type Filters = {
  sigla: string;
  siglaGrupo: string;
  nome: string;
  razaoSocial: string;
  fantasia: string;
  porte: string; // "" = todos
  ramo: string;
  cep: string;
  cidade: string;
  uf: string;
  cnpj: string;
  status: StatusFilter;
  dateStart?: Date;
  dateEnd?: Date;
};

const emptyFilters: Filters = {
  sigla: "",
  siglaGrupo: "",
  nome: "",
  razaoSocial: "",
  fantasia: "",
  porte: "",
  ramo: "",
  cep: "",
  cidade: "",
  uf: "",
  cnpj: "",
  status: "Todos",
  dateStart: undefined,
  dateEnd: undefined,
};

function normalize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function digits(v: string) {
  return v.replace(/\D+/g, "");
}

function parseBRDate(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function countActive(f: Filters): number {
  let n = 0;
  if (f.sigla.trim()) n++;
  if (f.siglaGrupo.trim()) n++;
  if (f.nome.trim()) n++;
  if (f.razaoSocial.trim()) n++;
  if (f.fantasia.trim()) n++;
  if (f.porte) n++;
  if (f.ramo) n++;
  if (f.cep.trim()) n++;
  if (f.cidade.trim()) n++;
  if (f.uf) n++;
  if (f.cnpj.trim()) n++;
  // Status é controlado na barra rápida; não conta como filtro avançado.
  if (f.dateStart || f.dateEnd) n++;
  return n;
}

// Cache de filtros preservado ao navegar entre lista e ficha detalhada.
let lastFilters: Filters = { ...emptyFilters };

const PAGE_SIZE = 50;

function formatCep(v: string): string {
  const d = v.replace(/\D+/g, "");
  if (d.length !== 8) return v.trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatCnpjDisplay(v: string): { text: string; incomplete: boolean; raw: string } {
  const raw = String(v ?? "");
  const d = raw.replace(/\D+/g, "");
  if (d.length === 14) {
    return {
      text: d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
      incomplete: false,
      raw,
    };
  }
  return { text: "CNPJ incompleto", incomplete: true, raw };
}

type CnpjInfo = { text: string; incomplete: boolean; raw: string; missing?: boolean };

const cnpjResolveCache = new Map<string, CnpjInfo>();
const cnpjResolvePending = new Map<string, Promise<CnpjInfo>>();

function formatCnpjDigits(d: string) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

async function resolveClientCnpj(client: ClientRow, initial: CnpjInfo): Promise<CnpjInfo> {
  const key = client.acronym || client.id;
  const cached = cnpjResolveCache.get(key);
  if (cached) return cached;
  const pending = cnpjResolvePending.get(key);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_crm_client", {
        client_acronym: client.acronym,
      });
      if (error) throw error;
      const candidates: unknown[] = [];
      const clientDoc = (data as { client?: { document?: unknown } } | null)?.client?.document;
      if (clientDoc) candidates.push(clientDoc);
      const companies =
        (data as { companies?: Array<{ document?: unknown }> } | null)?.companies || [];
      for (const co of companies) if (co?.document) candidates.push(co.document);
      for (const raw of candidates) {
        const d = String(raw ?? "").replace(/\D+/g, "");
        if (d.length === 14) {
          const result: CnpjInfo = {
            text: formatCnpjDigits(d),
            incomplete: false,
            raw: String(raw),
          };
          cnpjResolveCache.set(key, result);
          return result;
        }
      }
    } catch {
      /* silencioso; mostraremos "CNPJ não informado" */
    }
    const result: CnpjInfo = {
      text: "CNPJ não informado",
      incomplete: true,
      missing: true,
      raw: initial.raw,
    };
    cnpjResolveCache.set(key, result);
    return result;
  })();
  cnpjResolvePending.set(key, promise);
  try {
    return await promise;
  } finally {
    cnpjResolvePending.delete(key);
  }
}

function ClientCnpjCell({ client }: { client: ClientRow }) {
  const initial = useMemo(() => formatCnpjDisplay(client.cnpj), [client.cnpj]);
  const [info, setInfo] = useState<CnpjInfo>(() =>
    initial.incomplete ? (cnpjResolveCache.get(client.acronym || client.id) ?? initial) : initial,
  );

  useEffect(() => {
    if (!initial.incomplete) {
      setInfo(initial);
      return;
    }
    const cached = cnpjResolveCache.get(client.acronym || client.id);
    if (cached) {
      setInfo(cached);
      return;
    }
    let cancelled = false;
    resolveClientCnpj(client, initial).then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, [client, initial]);

  if (info.incomplete) {
    return (
      <span
        className="text-[12px] italic text-muted-foreground/80"
        title={info.raw ? `Valor original: ${info.raw}` : "CNPJ não informado"}
      >
        {info.missing ? "CNPJ não informado" : initial.raw ? "…" : "CNPJ não informado"}
      </span>
    );
  }
  return <span title={info.raw}>{info.text}</span>;
}

type SortKey = "registered" | "acronym" | "name" | "version" | "city" | "cnpj" | "status";

const ptCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function compareByKey(a: ClientRow, b: ClientRow, key: SortKey): number {
  switch (key) {
    case "registered":
      return parseBRDate(a.registered).getTime() - parseBRDate(b.registered).getTime();
    case "acronym":
      return ptCollator.compare(a.acronym, b.acronym);
    case "name":
      return ptCollator.compare(a.razaoSocial || a.name, b.razaoSocial || b.name);
    case "version":
      return ptCollator.compare(a.version, b.version);
    case "city":
      return ptCollator.compare(a.city, b.city);
    case "cnpj": {
      const na = Number(digits(a.cnpj)) || 0;
      const nb = Number(digits(b.cnpj)) || 0;
      return na - nb;
    }
    case "status":
      return ptCollator.compare(a.status, b.status);
    default:
      return 0;
  }
}

function ClientVersionCell({ client }: { client: ClientRow }) {
  const status = getClientErpVersionStatus(client.version, client.versionDate);
  const warningClass =
    "rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300";

  return (
    <td className="whitespace-nowrap px-4 py-4">
      <div className="inline-flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5 text-[11px] font-normal">
          <span className={cn((status.isMissing || status.isLegacy) && warningClass)}>
            {status.isMissing ? status.displayVersion : `Versão: ${status.displayVersion}`}
          </span>
          {!status.isMissing && client.versionDate && (
            <span
              className={cn(status.isOutdated && warningClass)}
              title={
                status.isOutdated
                  ? `Versão anterior à alteração mínima de ${formatVersionDate(latestErpAlterationDate)}`
                  : undefined
              }
            >
              ({client.versionDate})
            </span>
          )}
        </div>
        {client.versionUpdatedAt && (
          <div className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
            <span>{client.versionUpdatedAt}</span>
            <RefreshCw className="h-3 w-3" />
          </div>
        )}
      </div>
    </td>
  );
}

function ClientsPage() {
  const loaderData = Route.useLoaderData() as { clients: ClientRow[]; loadFailed?: boolean };
  const [clients, setClients] = useState<ClientRow[]>(loaderData.clients);
  const [clientsLoading, setClientsLoading] = useState(Boolean(loaderData.loadFailed));
  const [companySearchResults, setCompanySearchResults] = useState<ClientRow[] | null>(null);
  const { grupo, origem, q, sigla: siglaParam, status: statusParam } = Route.useSearch();
  const navigate = useNavigate();
  const grupoParam = (grupo ?? "").trim().toUpperCase();
  const initialStatus = (QUICK_STATUS_OPTIONS as string[]).includes(statusParam ?? "")
    ? (statusParam as StatusFilter)
    : "Todos";
  const [filters, setFilters] = useState<Filters>(() =>
    grupoParam
      ? { ...emptyFilters, siglaGrupo: grupoParam, status: initialStatus }
      : { ...lastFilters, status: initialStatus },
  );
  const [quickQuery, setQuickQuery] = useState(() => q ?? "");
  const [quickDraft, setQuickDraft] = useState(() => q ?? "");
  const [quickAcronym, setQuickAcronym] = useState(() => siglaParam ?? "");
  const [draft, setDraft] = useState<Filters>(() => filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"clientes" | "prospeccao">("clientes");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>({
    key: "registered",
    dir: "desc",
  });

  useEffect(() => {
    if (!loaderData.loadFailed) return;
    let cancelled = false;
    setClientsLoading(true);
    listClients()
      .then((rows) => {
        if (!cancelled) setClients(rows);
      })
      .catch((error) => {
        console.error("Não foi possível recarregar clientes no navegador", error);
        if (!cancelled) toast.error("Não foi possível carregar os clientes. Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loaderData.loadFailed]);

  useEffect(() => {
    lastFilters = filters;
    setPage(1);
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [quickQuery, quickAcronym]);

  useEffect(() => {
    const term = quickQuery.trim();
    if (!term) {
      setCompanySearchResults(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setClientsLoading(true);
      searchClientsByCompanies(term)
        .then((rows) => {
          if (!cancelled) setCompanySearchResults(rows);
        })
        .catch((error) => {
          console.error("Não foi possível pesquisar em tab_cli_empresas", error);
          if (!cancelled) {
            setCompanySearchResults(null);
            toast.error("Não foi possível pesquisar nas empresas. Usando a lista de clientes.");
          }
        })
        .finally(() => {
          if (!cancelled) setClientsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [quickQuery]);

  // Sincroniza URL <-> filtro de grupo. Ao entrar via ?grupo=XXX, descarta qualquer
  // filtro anterior (sigla, busca etc.) para exibir todas as empresas do grupo.
  useEffect(() => {
    if (grupoParam) {
      setFilters((p) =>
        p.siglaGrupo.toUpperCase() === grupoParam &&
        !p.sigla &&
        !p.nome &&
        !p.razaoSocial &&
        !p.fantasia &&
        !p.porte &&
        !p.ramo &&
        !p.cep &&
        !p.cidade &&
        !p.uf &&
        !p.cnpj &&
        !p.dateStart &&
        !p.dateEnd
          ? p
          : { ...emptyFilters, siglaGrupo: grupoParam, status: p.status },
      );
    }
  }, [grupoParam]);

  // Mantém a URL em sinc com a pesquisa rápida, o grupo e o status.
  useEffect(() => {
    const current = filters.siglaGrupo.trim().toUpperCase();
    const next: Record<string, string> = {};
    if (current) next.grupo = current;
    if (current && origem) next.origem = origem;
    if (quickQuery.trim()) next.q = quickQuery.trim();
    if (quickAcronym.trim()) next.sigla = quickAcronym.trim();
    if (filters.status !== "Ativo") next.status = filters.status;
    const same =
      (next.grupo ?? "") === grupoParam &&
      (next.origem ?? "") === (origem ?? "") &&
      (next.q ?? "") === (q ?? "") &&
      (next.sigla ?? "") === (siglaParam ?? "") &&
      (next.status ?? "") === (statusParam ?? "");
    if (!same) {
      navigate({ to: "/clientes", search: next, replace: true });
    }
  }, [filters.siglaGrupo, filters.status, quickQuery, quickAcronym]);

  useEffect(() => {
    setPage(1);
  }, [sort]);

  useEffect(() => {
    if (filtersOpen) setDraft(filters);
  }, [filtersOpen, filters]);

  const filtered = useMemo(() => {
    const quick = quickQuery.trim();
    const quickNorm = normalize(quick);
    const quickDigits = digits(quick);
    const quickMatches = (c: ClientRow) => {
      if (!quick) return true;
      const textHit = [
        c.acronym,
        c.group,
        c.name,
        c.razaoSocial,
        c.fantasia,
        c.size,
        c.segment,
        c.city,
        c.uf,
      ].some((value) => normalize(value ?? "").includes(quickNorm));
      if (textHit) return true;
      if (!quickDigits) return false;
      return digits(c.cnpj).includes(quickDigits) || digits(c.cep).includes(quickDigits);
    };
    const acronymQuery = quickAcronym.trim();
    const searchSource = quick ? (companySearchResults ?? []) : clients;
    return searchSource.filter((c) => {
      if (acronymQuery && !normalize(c.acronym).includes(normalize(acronymQuery))) return false;
      if (!quickMatches(c)) return false;

      if (filters.sigla && !normalize(c.acronym).includes(normalize(filters.sigla))) return false;
      if (filters.siglaGrupo) {
        // Match tanto o group_acronym quanto a sigla do próprio cliente (raiz).
        const target = normalize(filters.siglaGrupo);
        const matchesGroup = normalize(c.group).includes(target);
        const matchesRoot = normalize(c.acronym) === target;
        if (!matchesGroup && !matchesRoot) return false;
      }
      if (filters.nome && !normalize(c.name).includes(normalize(filters.nome))) return false;
      if (filters.razaoSocial && !normalize(c.razaoSocial).includes(normalize(filters.razaoSocial)))
        return false;
      if (filters.fantasia && !normalize(c.fantasia).includes(normalize(filters.fantasia)))
        return false;
      if (filters.porte && c.size !== filters.porte) return false;
      if (filters.ramo && c.segment !== filters.ramo) return false;
      if (filters.cep && !digits(c.cep).includes(digits(filters.cep))) return false;
      if (filters.cidade && !normalize(c.city).includes(normalize(filters.cidade))) return false;
      if (filters.uf && c.uf !== filters.uf) return false;
      if (filters.cnpj && !digits(c.cnpj).includes(digits(filters.cnpj))) return false;
      if (filters.status !== "Todos" && c.status !== filters.status) return false;
      if (filters.dateStart || filters.dateEnd) {
        const d = parseBRDate(c.registered);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (filters.dateStart) {
          const s = filters.dateStart;
          const start = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
          if (day < start) return false;
        }
        if (filters.dateEnd) {
          const e = filters.dateEnd;
          const end = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
          if (day > end) return false;
        }
      }
      return true;
    });
  }, [clients, companySearchResults, filters, quickQuery, quickAcronym]);

  const sizes = useMemo(() => Array.from(new Set(clients.map((c) => c.size))).sort(), [clients]);
  const segments = useMemo(
    () => Array.from(new Set(clients.map((c) => c.segment))).sort(),
    [clients],
  );
  const ufs = useMemo(
    () =>
      Array.from(new Set(clients.map((c) => c.uf)))
        .filter(Boolean)
        .sort(),
    [clients],
  );

  const activeCount = countActive(filters);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = filtered.slice();
    const factor = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => compareByKey(a, b, sort.key) * factor);
    return arr;
  }, [filtered, sort]);

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const pageRows = sorted.slice(startIndex, endIndex);

  const removeChip = (key: keyof Filters) => {
    setFilters((p) => ({
      ...p,
      [key]: key === "status" ? "Todos" : key === "dateStart" || key === "dateEnd" ? undefined : "",
    }));
  };

  const clearDates = () => setFilters((p) => ({ ...p, dateStart: undefined, dateEnd: undefined }));

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (filters.sigla)
    chips.push({
      key: "sigla",
      label: `Sigla: ${filters.sigla}`,
      onRemove: () => removeChip("sigla"),
    });
  if (filters.siglaGrupo)
    chips.push({
      key: "siglaGrupo",
      label: `Grupo: ${filters.siglaGrupo}`,
      onRemove: () => removeChip("siglaGrupo"),
    });
  if (filters.nome)
    chips.push({ key: "nome", label: `Nome: ${filters.nome}`, onRemove: () => removeChip("nome") });
  if (filters.razaoSocial)
    chips.push({
      key: "razaoSocial",
      label: `Razão social: ${filters.razaoSocial}`,
      onRemove: () => removeChip("razaoSocial"),
    });
  if (filters.fantasia)
    chips.push({
      key: "fantasia",
      label: `Fantasia: ${filters.fantasia}`,
      onRemove: () => removeChip("fantasia"),
    });
  if (filters.porte)
    chips.push({
      key: "porte",
      label: `Porte: ${filters.porte}`,
      onRemove: () => removeChip("porte"),
    });
  if (filters.ramo)
    chips.push({ key: "ramo", label: `Ramo: ${filters.ramo}`, onRemove: () => removeChip("ramo") });
  if (filters.cep)
    chips.push({ key: "cep", label: `CEP: ${filters.cep}`, onRemove: () => removeChip("cep") });
  if (filters.cidade)
    chips.push({
      key: "cidade",
      label: `Cidade: ${filters.cidade}`,
      onRemove: () => removeChip("cidade"),
    });
  if (filters.uf)
    chips.push({ key: "uf", label: `UF: ${filters.uf}`, onRemove: () => removeChip("uf") });
  if (filters.cnpj)
    chips.push({ key: "cnpj", label: `CNPJ: ${filters.cnpj}`, onRemove: () => removeChip("cnpj") });
  if (filters.status !== "Todos")
    chips.push({
      key: "status",
      label: `Status: ${filters.status}`,
      onRemove: () => removeChip("status"),
    });
  if (filters.dateStart || filters.dateEnd) {
    const s = filters.dateStart ? format(filters.dateStart, "dd/MM/yyyy") : "…";
    const e = filters.dateEnd ? format(filters.dateEnd, "dd/MM/yyyy") : "…";
    chips.push({ key: "date", label: `Cadastro: ${s} – ${e}`, onRemove: clearDates });
  }

  return (
    <AppShell>
      {grupoParam && (
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (origem) {
                navigate({
                  to: "/clientes/$clienteId",
                  params: { clienteId: origem },
                  search: { tab: "cliente" },
                });
                return;
              }
              setFilters((previous) => ({ ...previous, siglaGrupo: "" }));
              navigate({ to: "/clientes", search: {}, replace: true });
            }}
            className="h-8 cursor-pointer rounded-lg"
            aria-label={origem ? "Voltar para o cliente" : "Voltar para Clientes"}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            {origem ? "Voltar para o cliente" : "Voltar para Clientes"}
          </Button>
        </div>
      )}

      <PageHeader
        title="Clientes"
        description="Cadastro, ambiente e relacionamento dos clientes."
        breadcrumbs={[{ label: "Clientes" }]}
      />

      {!grupoParam && (
        <div className="mb-5 flex items-center gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveSection("clientes")}
            className={cn(
              "relative h-10 cursor-pointer px-4 text-sm font-medium transition-colors",
              activeSection === "clientes"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Clientes
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("prospeccao")}
            className={cn(
              "relative h-10 cursor-pointer px-4 text-sm font-medium transition-colors",
              activeSection === "prospeccao"
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Prospecção
          </button>
        </div>
      )}

      {activeSection === "prospeccao" && !grupoParam ? (
        <CompanyLeadsTab />
      ) : (
        <>
          <div className="mb-3">
            <div className="mb-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="h-9 w-full cursor-pointer justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 sm:w-40"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {activeCount > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/95 px-1.5 text-[11px] font-semibold text-blue-700">
                    {activeCount}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Filtros:</span>

              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground"
                >
                  <span className="truncate">{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remover filtro ${chip.label}`}
                    className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <label className="relative block w-full min-w-0 sm:w-[200px]">
                <span className="sr-only">Pesquisar por sigla</span>
                <input
                  value={quickAcronym}
                  onChange={(event) => setQuickAcronym(event.target.value.toUpperCase())}
                  type="search"
                  placeholder="Sigla"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm uppercase outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="relative block min-w-[240px] flex-1">
                <span className="sr-only">Pesquisa geral</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={quickDraft}
                  onChange={(event) => {
                    setQuickDraft(event.target.value);
                    setQuickQuery(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setQuickQuery(quickDraft);
                  }}
                  type="search"
                  placeholder="Pesquisa geral"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="w-full sm:w-[170px]">
                <span className="sr-only">Status do cliente</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      status: event.target.value as StatusFilter,
                    }))
                  }
                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {QUICK_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {grupoParam && (
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-base font-medium">Clientes do grupo {grupoParam}</h2>
              <span className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
              </span>
            </div>
          )}

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
                  <tr>
                    {[
                      { label: "Cadastro", key: "registered" as SortKey },
                      { label: "Sigla", key: "acronym" as SortKey },
                      { label: "Nome / perfil", key: "name" as SortKey },
                      { label: "Versão / setup", key: "version" as SortKey },
                      { label: "Cidade / UF", key: "city" as SortKey },
                      { label: "CNPJ", key: "cnpj" as SortKey },
                      { label: "Status", key: "status" as SortKey },
                    ].map(({ label, key }) => {
                      const active = sort?.key === key;
                      const dir = active ? sort!.dir : null;
                      return (
                        <th
                          key={label}
                          onClick={() =>
                            setSort((prev) => {
                              if (!prev || prev.key !== key) return { key, dir: "asc" };
                              if (prev.dir === "asc") return { key, dir: "desc" };
                              return null;
                            })
                          }
                          aria-sort={
                            dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
                          }
                          className="cursor-pointer whitespace-nowrap px-2.5 py-3 text-left font-medium select-none hover:text-foreground transition-colors"
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {dir === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : dir === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() =>
                        navigate({
                          to: "/clientes/$clienteId",
                          params: { clienteId: client.id },
                        })
                      }
                      className="cursor-pointer transition-colors hover:bg-primary/[0.04]"
                    >
                      <td className="whitespace-nowrap px-2.5 py-4 text-muted-foreground">
                        {client.registered}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-4">
                        <div className="font-medium text-primary">{client.acronym}</div>
                        <div className="text-xs text-muted-foreground">
                          {client.group || "Sem grupo"}
                        </div>
                      </td>
                      <td className="min-w-[240px] px-2.5 py-4">
                        <div className="text-[12px] font-normal leading-[1.2] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                          {client.name}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-normal leading-[1.2] text-foreground/80">
                          {client.razaoSocial}
                        </div>
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {client.segment} - Porte: {client.size}
                        </div>
                      </td>
                      <ClientVersionCell client={client} />
                      <td className="whitespace-nowrap px-2.5 py-4">
                        <div className="flex flex-col items-start">
                          <span>{normalizeCityUf(client.city)}</span>
                          {client.cep && client.cep.replace(/\D+/g, "").length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatCep(client.cep)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-4 text-muted-foreground">
                        <ClientCnpjCell client={client} />
                      </td>
                      <td className="px-2.5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            className={cn(
                              client.status === "Ativo"
                                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
                            )}
                          >
                            {client.status}
                          </Badge>
                          <div className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                            <RefreshCw className="h-3 w-3 shrink-0" />
                            <span>{client.updatedAt}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {clientsLoading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        Carregando todos os clientes...
                      </td>
                    </tr>
                  )}

                  {!clientsLoading && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum cliente encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalItems > 0 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                start={startIndex + 1}
                end={endIndex}
                total={totalItems}
                onChange={setPage}
              />
            )}
          </Card>

          <FiltersPanel
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            draft={draft}
            setDraft={setDraft}
            sizes={sizes}
            segments={segments}
            ufs={ufs}
            onApply={() => {
              setFilters(draft);
              setFiltersOpen(false);
            }}
            onClear={() => setDraft(emptyFilters)}
          />
        </>
      )}
    </AppShell>
  );
}

function FiltersPanel({
  open,
  onOpenChange,
  draft,
  setDraft,
  sizes,
  segments,
  ufs,
  onApply,
  onClear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: Filters;
  setDraft: React.Dispatch<React.SetStateAction<Filters>>;
  sizes: string[];
  segments: string[];
  ufs: string[];
  onApply: () => void;
  onClear: () => void;
}) {
  const update = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg font-semibold">Filtros de clientes</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <FieldText
                label="Sigla"
                value={draft.sigla}
                onChange={(v) => update("sigla", v.toUpperCase())}
                placeholder="Ex.: AVC"
                uppercase
              />
              <FieldText
                label="Sigla do grupo"
                value={draft.siglaGrupo}
                onChange={(v) => update("siglaGrupo", v.toUpperCase())}
                placeholder="Ex.: ASC"
                uppercase
              />
            </div>

            <FieldText
              label="Nome (apelido)"
              value={draft.nome}
              onChange={(v) => update("nome", v)}
              placeholder="Nome curto"
            />
            <FieldText
              label="Razão social"
              value={draft.razaoSocial}
              onChange={(v) => update("razaoSocial", v)}
              placeholder="Razão social completa"
            />
            <FieldText
              label="Nome fantasia"
              value={draft.fantasia}
              onChange={(v) => update("fantasia", v)}
              placeholder="Nome fantasia"
            />

            <div className="grid grid-cols-2 gap-3">
              <FieldSelect
                label="Porte"
                value={draft.porte}
                onChange={(v) => update("porte", v)}
                options={[
                  { value: "", label: "Todos" },
                  ...sizes.map((s) => ({ value: s, label: s })),
                ]}
              />
              <FieldSelect
                label="Ramo"
                value={draft.ramo}
                onChange={(v) => update("ramo", v)}
                options={[
                  { value: "", label: "Todos" },
                  ...segments.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldText
                label="CEP"
                value={draft.cep}
                onChange={(v) => update("cep", v)}
                placeholder="00000-000"
              />
              <FieldSelect
                label="UF"
                value={draft.uf}
                onChange={(v) => update("uf", v)}
                options={[
                  { value: "", label: "Todas" },
                  ...ufs.map((u) => ({ value: u, label: u })),
                ]}
              />
            </div>

            <FieldText
              label="Cidade"
              value={draft.cidade}
              onChange={(v) => update("cidade", v)}
              placeholder="Cidade"
            />

            <FieldText
              label="CNPJ"
              value={draft.cnpj}
              onChange={(v) => update("cnpj", v)}
              placeholder="Com ou sem pontuação"
            />

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["Todos", "Ativo", "Inativo"] as StatusFilter[]).map((s) => {
                  const active = draft.status === s;
                  return (
                    <label
                      key={s}
                      className={cn(
                        "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                        active
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        name="client-status"
                        className="h-4 w-4 cursor-pointer accent-primary"
                        checked={active}
                        onChange={() => update("status", s)}
                      />
                      <span>{s}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Período de cadastro
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DateField
                  label="Data inicial"
                  value={draft.dateStart}
                  onChange={(d) => update("dateStart", d)}
                />
                <DateField
                  label="Data final"
                  value={draft.dateEnd}
                  onChange={(d) => update("dateEnd", d)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            className="h-10 cursor-pointer rounded-lg text-sm"
            onClick={onClear}
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Limpar filtros
          </Button>
          <Button
            type="button"
            onClick={onApply}
            className="h-10 cursor-pointer rounded-lg bg-blue-600 px-5 text-sm font-medium text-primary-foreground hover:bg-blue-700"
          >
            Aplicar filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  uppercase,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  uppercase?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
          uppercase && "uppercase",
        )}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Date;
  onChange: (d?: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-10 w-full cursor-pointer items-center gap-2 truncate rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{value ? format(value, "dd/MM/yyyy") : "dd/mm/aaaa"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
            locale={ptBR}
            initialFocus
            className={cn("pointer-events-auto p-3")}
          />
          <div className="flex items-center justify-end border-t border-border px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Limpar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
function Section({
  title,
  icon: Icon,
  children,
  className,
  titleClassName,
  accent = "primary",
  action,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  accent?: "primary" | "purple";
  action?: React.ReactNode;
}) {
  const isPurple = accent === "purple";
  return (
    <Card
      className={cn("p-5", isPurple && "border-border shadow-sm dark:border-border", className)}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className={cn("flex items-center gap-2 font-medium", titleClassName)}>
          {Icon ? (
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md",
                isPurple ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </Card>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function contactDescription(contact: ClientContact) {
  return [contact.name, contact.department].filter(Boolean).join(" / ") || "Sem identificacao";
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D+/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 13 && d.startsWith("55")) {
    const r = d.slice(2);
    return `+55 (${r.slice(0, 2)}) ${r.slice(2, 7)}-${r.slice(7)}`;
  }
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return raw.trim();
}

type ContactLine = {
  key: string;
  value: string;
  display: string;
  description: string;
  href: string;
  kind: "phone" | "email";
};

async function copyContactValue(item: ContactLine) {
  const text = item.value;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    toast.success(item.kind === "phone" ? "Telefone copiado" : "E-mail copiado");
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function buildContactLines(contacts: ClientContact[], kind: "phone" | "email"): ContactLine[] {
  const out: ContactLine[] = [];
  for (const c of contacts) {
    const description = [c.name, c.department].filter(Boolean).join(" / ").trim();
    const values: string[] = kind === "phone" ? [c.phone, c.mobile, c.whatsapp] : [c.email];
    const contactValues = new Set<string>();
    for (const raw of values) {
      const trimmed = (raw || "").trim();
      if (!trimmed) continue;
      const norm = kind === "email" ? trimmed.toLowerCase() : trimmed.replace(/\D+/g, "");
      if (!norm) continue;
      if (contactValues.has(norm)) continue;
      contactValues.add(norm);
      if (kind === "phone") {
        const digits = trimmed.replace(/\D+/g, "");
        out.push({
          key: `${c.id}-${digits || trimmed}`,
          value: formatPhoneBR(trimmed),
          display: formatPhoneBR(trimmed),
          description,
          href: `tel:${digits || trimmed}`,
          kind,
        });
      } else {
        const lower = trimmed.toLowerCase();
        out.push({
          key: `${c.id}-${lower}`,
          value: lower,
          display: lower,
          description,
          href: `mailto:${lower}`,
          kind,
        });
      }
    }
  }
  return out;
}

function ContactsCard({ contacts, client }: { contacts: ClientContact[]; client: ClientRow }) {
  const phones = useMemo(() => buildContactLines(contacts, "phone"), [contacts]);
  const emails = useMemo(() => buildContactLines(contacts, "email"), [contacts]);
  const total = phones.length + emails.length;
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-border bg-card p-5 shadow-sm dark:border-border dark:bg-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Phone className="h-4 w-4" />
          </span>
          Contatos
        </h3>
        <Badge
          variant="outline"
          className="h-6 rounded-full border-primary/25 bg-primary/10 px-2.5 text-[11px] font-medium text-primary"
        >
          {total} {total === 1 ? "contato" : "contatos"}
        </Badge>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contato cadastrado para este cliente.
        </p>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <ContactPreviewList
              title="Telefones"
              icon={Phone}
              items={phones.slice(0, 3)}
              emptyText="Nenhum telefone cadastrado."
            />
            <ContactPreviewList
              title="E-mails"
              icon={Mail}
              items={emails.slice(0, 3)}
              emptyText="Nenhum e-mail cadastrado."
            />
          </div>
          {total > 0 && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5 rounded-full border-primary/25 px-4 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setOpen(true)}
              >
                Ver todos os contatos
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <AllContactsDialog
            open={open}
            onOpenChange={setOpen}
            client={client}
            phones={phones}
            emails={emails}
          />
        </>
      )}
    </Card>
  );
}

function ContactPreviewList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: typeof Phone;
  items: ContactLine[];
  emptyText: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => void copyContactValue(item)}
                title={`Copiar ${item.kind === "phone" ? "telefone" : "e-mail"}`}
                aria-label={`Copiar ${item.kind === "phone" ? "telefone" : "e-mail"} ${item.display}`}
                className="group flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-normal text-foreground group-hover:underline">
                    {item.display}
                  </span>
                  {item.description && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ContactTab = "all" | "phone" | "email";

function AllContactsDialog({
  open,
  onOpenChange,
  client,
  phones,
  emails,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ClientRow;
  phones: ContactLine[];
  emails: ContactLine[];
}) {
  const [tab, setTab] = useState<ContactTab>("all");
  const [query, setQuery] = useState("");

  const sortItems = (list: ContactLine[]) =>
    [...list].sort((a, b) => {
      const ad = a.description.trim();
      const bd = b.description.trim();
      if (!ad && bd) return 1;
      if (ad && !bd) return -1;
      const cmp = ad.localeCompare(bd, "pt-BR", { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return a.display.localeCompare(b.display, "pt-BR", { sensitivity: "base" });
    });

  const filter = (list: ContactLine[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (it) =>
        it.display.toLowerCase().includes(q) ||
        it.value.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q),
    );
  };

  const sortedPhones = useMemo(() => filter(sortItems(phones)), [phones, query]);
  const sortedEmails = useMemo(() => filter(sortItems(emails)), [emails, query]);

  const showPhones = tab === "all" || tab === "phone";
  const showEmails = tab === "all" || tab === "email";
  const total = phones.length + emails.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden bg-card p-0">
        <DialogHeader className="border-b border-border p-5 text-left">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-medium">Contatos</DialogTitle>
              <p className="truncate text-xs text-muted-foreground">
                {client.acronym} · {client.fantasia || client.razaoSocial || client.name}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(
              [
                ["all", `Todos (${total})`],
                ["phone", `Telefones (${phones.length})`],
                ["email", `E-mails (${emails.length})`],
              ] as [ContactTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 font-medium transition",
                  tab === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por telefone, e-mail ou nome..."
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {sortedPhones.length + sortedEmails.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum contato encontrado.
            </p>
          ) : (
            <div className="space-y-6">
              {showPhones && sortedPhones.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Telefones ({sortedPhones.length})
                  </p>
                  <ContactGrid items={sortedPhones} icon={Phone} />
                </div>
              )}
              {showEmails && sortedEmails.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    E-mails ({sortedEmails.length})
                  </p>
                  <ContactGrid items={sortedEmails} icon={Mail} />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactGrid({ items, icon: Icon }: { items: ContactLine[]; icon: typeof Phone }) {
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            onClick={() => void copyContactValue(item)}
            title={`Copiar ${item.kind === "phone" ? "telefone" : "e-mail"}`}
            aria-label={`Copiar ${item.kind === "phone" ? "telefone" : "e-mail"} ${item.display}`}
            className="group flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-normal text-foreground group-hover:underline">
                {item.display}
              </span>
              {item.description && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {item.description}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ClientTab({
  client,
  contacts,
  companies,
  terminals: _terminals,
  tickets,
  events,
  activities,
  onOpenCompanies,
}: {
  client: ClientRow;
  contacts: ClientContact[];
  companies: ClientCompany[];
  terminals: ClientTerminal[];
  tickets: ClientTicket[];
  events: ClientEvent[];
  activities: ClientTicketActivity[];
  onOpenCompanies?: () => void;
}) {
  const clientLocalEvents = useLocalEventsForClient(client.id);
  const eventsWithLocal = useMemo(
    () => [...events, ...localToClientEvents(clientLocalEvents)],
    [events, clientLocalEvents],
  );

  const company = companies[0];
  const companyCityUf = normalizeCityUf(
    [company?.city || client.city, company?.state].filter(Boolean).join(" - "),
  );
  const companyCep = company?.postalCode || client.cep || "";
  const empresaFields: Array<[string, string]> = [
    ["Nome fantasia", company?.tradeName || client.fantasia || ""],
    ["CNPJ", company?.document || client.cnpj || ""],
    ["Inscrição estadual", company?.stateRegistration || ""],
    ["CNAE", company?.cnae || ""],
    ["Setor", company?.industry || client.segment || ""],
    ["Porte", company?.size || client.size || ""],
    ["Regime de apuração", company?.taxRegime || ""],
    ["Endereço", company?.address || ""],
    ["Cidade / UF", companyCityUf || ""],
    ["CEP", companyCep || ""],
  ];
  void onOpenCompanies;

  const responsibleFields: Array<[string, string]> = [
    ["Nome", company?.responsibleName || ""],
    ["CPF", company?.responsibleDocument || ""],
    ["RG", company?.responsibleRg || ""],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  const respAddressCityUf = normalizeCityUf(
    [company?.responsibleCity, company?.responsibleState].filter(Boolean).join(" - "),
  );
  const respStreetAndNumber = [company?.responsibleAddress, company?.responsibleNumber]
    .filter(Boolean)
    .join(", ");
  const respNeighborhoodOrComplement =
    company?.responsibleNeighborhood || company?.responsibleComplement || "";
  const addressFields: Array<[string, string]> = [
    ["Logradouro e número", respStreetAndNumber],
    ["Bairro / complemento", respNeighborhoodOrComplement],
    ["Cidade / UF", respAddressCityUf || ""],
    ["CEP", company?.responsiblePostalCode || ""],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  const accountingFields: Array<[string, string]> = [
    ["Escritório", company?.accountantOffice || ""],
    ["Contador responsável", company?.accountantName || ""],
    ["Telefone", company?.accountantPhone ? formatPhoneBR(company.accountantPhone) : ""],
    ["E-mail", company?.accountantEmail || ""],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  return (
    <div className="space-y-5">
      {/* Linha 1: Dados da empresa + Contatos */}
      <div className="grid gap-5 items-stretch lg:grid-cols-2">
        <Section title="Dados da empresa" icon={Building2}>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {empresaFields.map(([label, value]) => (
              <Field key={label} label={label} value={value || "Não informado"} />
            ))}
          </div>
        </Section>
        <ContactsCard contacts={contacts} client={client} />
      </div>

      {/* Linha 2: Empresas vinculadas (100%) */}
      <CompaniesSummaryCard companies={companies} />

      {/* Linha 3: Responsável e contabilidade (100%) */}
      <Section title="Responsável e contabilidade">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-border">
          <ResponsibleGroup title="Responsável" icon={CircleUserRound} fields={responsibleFields} />
          <ResponsibleGroup
            title="Endereço do responsável"
            icon={MapPin}
            fields={addressFields}
            className="lg:pl-6"
          />
          <ResponsibleGroup
            title="Contabilidade"
            icon={CircleDollarSign}
            fields={accountingFields}
            className="lg:pl-6"
            emailField="E-mail"
          />
        </div>
      </Section>

      {/* Linha 4: Próximo evento + Histórico + Atividade recente */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <ClientNextEvent client={client} events={eventsWithLocal} tickets={tickets} />
        <Section title="Agendamentos e atendimentos" icon={HardDrive}>
          <SupportRowsCompact tickets={tickets} events={eventsWithLocal} />
        </Section>
        <RecentActivityCard activities={activities} events={eventsWithLocal} />
      </div>
    </div>
  );
}

function ResponsibleGroup({
  title,
  icon: Icon,
  fields,
  className,
  emailField,
}: {
  title: string;
  icon: typeof Building2;
  fields: Array<[string, string]>;
  className?: string;
  emailField?: string;
}) {
  const wrapFields = new Set(["Logradouro e número", "Bairro / complemento"]);
  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>
      {fields.length ? (
        <dl className="space-y-2.5">
          {fields.map(([label, value]) => {
            const isEmail = emailField === label;
            const shouldWrap = isEmail || wrapFields.has(label);
            return (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] uppercase text-muted-foreground">{label}</dt>
                <dd
                  className={cn(
                    "mt-0.5 text-sm text-foreground",
                    shouldWrap ? "break-words [overflow-wrap:anywhere]" : "truncate",
                    isEmail && "line-clamp-2",
                  )}
                  title={value}
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Não informado</p>
      )}
    </div>
  );
}

function RecentActivityCard({
  activities,
  events,
}: {
  activities: ClientTicketActivity[];
  events: ClientEvent[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const items = [
    ...activities.map((activity) => ({
      id: `ticket-${activity.id}`,
      title: activity.title || activity.subject,
      detail: [activity.protocol, activity.actor, activity.occurredAt].filter(Boolean).join(" · "),
      timestamp: activity.occurredAtIso,
      ticketActivity: activity.eventType === "created",
    })),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      detail: [event.operator, event.startsAt].filter(Boolean).join(" · "),
      timestamp: event.startsAtIso,
      ticketActivity: false,
    })),
  ].sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
  const visibleItems = items.slice(0, 3);

  return (
    <Section title="Atividade recente" icon={Activity}>
      {items.length ? (
        <>
          <ul className="space-y-2.5">
            {visibleItems.map((item) => (
              <li key={item.id} className="flex min-w-0 items-start gap-2">
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    item.ticketActivity ? "bg-primary" : "bg-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {items.length > 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="mt-3 h-8 cursor-pointer px-3 text-xs text-primary"
            >
              Ver todos
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Atividade recente</DialogTitle>
              </DialogHeader>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex min-w-0 items-start gap-3 rounded-md border border-border p-3"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        item.ticketActivity ? "bg-primary" : "bg-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Sem atividade recente.</p>
      )}
    </Section>
  );
}

function CompaniesSummaryCard({
  companies,
  onOpen: _onOpen,
}: {
  companies: ClientCompany[];
  onOpen?: () => void;
}) {
  void _onOpen;
  const [openId, setOpenId] = useState<string | null>(null);
  const isPrincipal = (co: ClientCompany) => {
    if (co.groupPosition === "001") return true;
    const digits = (co.document || "").replace(/\D+/g, "");
    if (digits.length === 14 && digits.slice(8, 12) === "0001") return true;
    return co.companyNumber === 1;
  };
  return (
    <Section title={`Empresas vinculadas (${companies.length})`} icon={Server} accent="purple">
      {companies.length === 0 ? (
        <EmptyState text="Nenhuma empresa vinculada a este cliente." />
      ) : (
        <div className="space-y-2">
          {companies.map((company) => {
            const principal = isPrincipal(company);
            const title = company.legalName || company.tradeName || "Empresa";
            const number =
              company.groupPosition ||
              (company.companyNumber != null
                ? String(company.companyNumber).padStart(3, "0")
                : company.clientAcronym || "—");
            const expanded = openId === company.id;
            const details: Array<[string, string]> = [
              ["Nome fantasia", company.tradeName || ""],
              ["Razão social", company.legalName || ""],
              ["CNPJ", company.document || ""],
              ["Inscrição estadual", company.stateRegistration || ""],
              ["CNAE", company.cnae || ""],
              ["Setor", company.industry || ""],
              ["Porte", company.size || ""],
              ["Regime de apuração", company.taxRegime || ""],
              ["Endereço", company.address || ""],
              [
                "Cidade / UF",
                normalizeCityUf([company.city, company.state].filter(Boolean).join(" - ")) || "",
              ],
              ["CEP", company.postalCode || ""],
              ["Responsável", company.responsibleName || ""],
              ["CPF do responsável", company.responsibleDocument || ""],
              ["Escritório de contabilidade", company.accountantOffice || ""],
              ["Contador responsável", company.accountantName || ""],
              [
                "Telefone do contador",
                company.accountantPhone ? formatPhoneBR(company.accountantPhone) : "",
              ],
              ["E-mail do contador", company.accountantEmail || ""],
            ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;
            return (
              <div
                key={company.id}
                className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40 dark:border-border"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : company.id)}
                  aria-expanded={expanded}
                  className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Server className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-[11px] text-muted-foreground">{number}</span>
                    <span className="truncate text-sm font-medium text-foreground">{title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {company.document || "CNPJ não informado"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 rounded-full px-2 text-[10.5px] font-medium",
                        principal
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {principal ? "Principal" : "Filial"}
                    </Badge>
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      expanded ? "rotate-90" : "rotate-0",
                    )}
                  />
                </button>
                {expanded && (
                  <div className="border-t border-border bg-muted/10 px-4 py-4 dark:border-border">
                    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      {details.map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="truncate text-sm text-foreground" title={value}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function SupportRowsCompact({
  tickets,
  events,
}: {
  tickets: ClientTicket[];
  events: ClientEvent[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pastEvents = events.filter(
    (event) => event.startsAtIso && new Date(event.startsAtIso).getTime() < Date.now(),
  );
  if (!tickets.length && !pastEvents.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-primary/5 px-4 py-6 text-center dark:border-border dark:bg-transparent">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </span>
        <p className="text-xs text-muted-foreground">
          Nenhum agendamento ou atendimento registrado para este cliente.
        </p>
        <Button
          asChild
          size="sm"
          className="h-8 cursor-pointer rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Link to="/chamados/novo" search={() => ({ cliente: undefined, empresa: undefined })}>
            Novo chamado
          </Link>
        </Button>
      </div>
    );
  }
  const rows = [
    ...tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      title: ticket.subject,
      detail: [ticket.module, ticket.submodule].filter(Boolean).join(" · "),
      operator: ticket.operator,
      date: ticket.createdAt,
      timestamp: ticket.createdAtIso,
      type: "Atendimento",
    })),
    ...pastEvents.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      detail: plainText(event.description),
      operator: event.operator,
      date: event.startsAt,
      timestamp: event.startsAtIso,
      type: event.legacyTicketId ? "Atendimento agendado" : "Agendamento",
    })),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const visibleRows = rows.slice(0, 2);

  return (
    <>
      <ul className="space-y-2">
        {visibleRows.map((row) => (
          <li
            key={row.id}
            className="rounded-md border border-border bg-card px-3 py-2 dark:border-border"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[13px] font-medium text-foreground" title={row.title}>
                {row.title}
              </p>
              <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
                {row.type}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.detail || "—"}</p>
            <p className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{row.operator || "—"}</span>
              <span>{row.date}</span>
            </p>
          </li>
        ))}
      </ul>
      {rows.length > 2 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="mt-3 h-8 cursor-pointer px-3 text-xs text-primary"
        >
          Ver todos
        </Button>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendamentos e atendimentos</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-md border border-border bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
                    {row.type}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row.detail || "—"}</p>
                <p className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{row.operator || "—"}</span>
                  <span>{row.date}</span>
                </p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function localToClientEvents(
  localEvents: ReturnType<typeof useLocalEventsForClient>,
): ClientEvent[] {
  return localEvents.map((item) => ({
    id: String(item.id),
    title: item.title,
    description: item.description || "",
    kind: item.type,
    startsAt: `${item.date.split("-").reverse().join("/")} ${item.time}`,
    startsAtIso: `${item.date}T${item.time}:00`,
    endsAt: item.end,
    operator: item.operator || item.responsible || "",
    origin: item.origin,
    status: "scheduled",
    ticketProtocol: "",
    legacyTicketId: "",
  }));
}

function ClientNextEvent({
  client,
  events,
  tickets,
}: {
  client: ClientRow;
  events: ClientEvent[];
  tickets: ClientTicket[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const localEvents = useLocalEventsForClient(client.id);
  const event = events
    .filter(
      (item) => item.status === "scheduled" && new Date(item.startsAtIso).getTime() >= Date.now(),
    )
    .sort((left, right) => left.startsAtIso.localeCompare(right.startsAtIso))[0];
  const scheduledTicket = tickets.find((ticket) => ticket.status.toLowerCase() === "scheduled");
  const todayKey = new Date().toISOString().slice(0, 10);
  const clientLabel = [client.acronym, client.razaoSocial || client.name]
    .filter(Boolean)
    .join(" · ");

  const eventDialog = (
    <CreateEventDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      initialDate={todayKey}
      existingEvents={localEvents}
      lockedClient={{ id: client.id, label: clientLabel }}
      onCreate={(created) => {
        addLocalEvent(created);
        toast.success("Evento adicionado ao calendário");
      }}
    />
  );

  return (
    <Section title="Próximo evento" icon={CalendarDays} accent="purple">
      {event ? (
        <div className="rounded-md border border-border p-4 dark:border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{event.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[event.startsAt, event.operator].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-600">Agendado</Badge>
          </div>
          {event.ticketProtocol && (
            <p className="mt-3 text-xs text-muted-foreground">
              Chamado relacionado: {event.ticketProtocol}
            </p>
          )}
        </div>
      ) : scheduledTicket ? (
        <div className="rounded-md border border-border p-4 dark:border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{scheduledTicket.subject}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[scheduledTicket.protocol, scheduledTicket.operator].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-600">Agendado</Badge>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Atualizado em {scheduledTicket.updatedAt || scheduledTicket.createdAt}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-primary/5 px-4 py-6 text-center dark:border-border dark:bg-transparent">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <p className="text-xs text-muted-foreground">Nenhum evento agendado para este cliente.</p>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-8 cursor-pointer rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Novo evento
          </Button>
        </div>
      )}
      {eventDialog}
    </Section>
  );
}

function SupportRows({ tickets }: { tickets: ClientTicket[] }) {
  if (!tickets.length) return <EmptyState text="Nenhum chamado encontrado para este cliente." />;
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="grid items-center gap-3 px-4 py-2 sm:grid-cols-[1.4fr_1.2fr_.6fr_.5fr_.7fr_auto]"
        >
          <span className="text-[13px] font-normal">{ticket.subject}</span>
          <span className="text-[12px] text-muted-foreground">
            {[ticket.module, ticket.submodule].filter(Boolean).join(" - ")}
          </span>
          <span className="text-[12px]">{ticket.operator || "-"}</span>
          <span className="text-[12px]">{ticket.priority || "-"}</span>
          <span className="text-[12px]">{ticket.createdAt}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px] font-normal">
            Ver
          </Button>
        </div>
      ))}
    </div>
  );
}

export function HadronTab() {
  return (
    <>
      <Section title="Ambiente Hadron" icon={Database}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Serial" value="AVC - 00000000415 - 19723520" />
          <Field label="Responsável" value="PRCCRIS / PRCCRIS" />
          <Field label="Tempo de instalação" value="8 horas" />
          <Field label="Rede" value="5 terminais · Cabo" />
          <Field label="Boleto bancário" value="Não" />
          <Field label="Homologação conjunta NF-e" value="Não" />
        </div>
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Módulos adquiridos" icon={CheckCircle2}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {modules.map((m) => (
              <div key={m} className="flex items-center gap-2 px-1 py-1.5 text-sm">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{m}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Módulos não contratados" icon={Database}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {unavailableModules.map((m) => (
              <div
                key={m}
                className="flex items-center gap-2 px-1 py-1.5 text-sm text-muted-foreground"
              >
                <X className="h-4 w-4 shrink-0 text-red-500" />
                <span>{m}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Section title="Documentos fiscais" icon={HardDrive}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["NF-e", true],
            ["NFC-e", true],
            ["CT-e", false],
            ["NFS-e", false],
            ["MDF-e", false],
            ["SAT", false],
          ].map(([name, active]) => (
            <div
              key={name as string}
              className={cn(
                "rounded-md border p-3 text-center text-sm",
                active
                  ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-600"
                  : "border-border text-muted-foreground",
              )}
            >
              {name as string}
              <div className="mt-1 text-xs">{active ? "Habilitado" : "Não habilitado"}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

export function UsersTab() {
  return (
    <Section title="Usuários do portal" icon={UsersRound}>
      <DataTable
        headers={["Nome", "E-mail", "Operador", "Perfil", "Status", "Cadastro / atualização"]}
        rows={[
          [
            "MAURO",
            "MAURO@ESPACOBENTOCARLOS.COM.BR",
            "-",
            "Administrador",
            "Ativo",
            "06/05/2026 09:07",
          ],
        ]}
      />
    </Section>
  );
}
export function TerminalsTab() {
  return (
    <Section title="Terminais instalados" icon={Monitor}>
      <DataTable
        headers={["Terminal", "IP", "Pasta", "Data da versão", "Atualização", "Ações"]}
        rows={terminals.map((r) => [...r, "Ver log"])}
      />
    </Section>
  );
}
export function CompaniesTab() {
  const rows: Array<{ icon: typeof Monitor; label: string; value: string }> = [
    { icon: Building2, label: "Código / Empresa", value: "001 - CENTER GLASS ACESSORIOS" },
    { icon: FileText, label: "CNPJ", value: "66.613.387/0001-60" },
    { icon: Monitor, label: "Terminais", value: "3" },
    { icon: Server, label: "Filiais", value: "1" },
    { icon: Database, label: "Versão", value: "2026-07-02" },
    { icon: Cpu, label: "Sistema operacional", value: "Windows 7" },
    { icon: Cpu, label: "Versão do SO", value: "6.2" },
    { icon: FileText, label: "Emite NF-e", value: "Sim" },
    { icon: FileText, label: "Notas emitidas", value: "0" },
    { icon: Cpu, label: "Memoria usada / total", value: "0 / 2097151" },
    { icon: HardDrive, label: "Drive P", value: "P" },
    { icon: HardDrive, label: "Drive P usado / total", value: "6 / 312.4" },
    { icon: HardDrive, label: "Drive T", value: "C" },
    { icon: HardDrive, label: "Drive T usado / total", value: "57.1 / 237.4" },
    { icon: HardDrive, label: "Drive A", value: "P" },
    { icon: HardDrive, label: "Drive A usado / total", value: "6 / 312.4" },
    { icon: ShieldCheck, label: "Tipo de certificado", value: "P" },
    { icon: ShieldCheck, label: "Validade do certificado", value: "08/05/2027" },
    { icon: ShieldCheck, label: "Ambiente", value: "N" },
    { icon: RefreshCw, label: "Atualizado em", value: "17/07/2026 08:44:37" },
    { icon: CalendarDays, label: "Registrado em", value: "09/05/2026 08:44:38" },
  ];
  return (
    <Section title="Empresas vinculadas" icon={Server}>
      <div className="grid divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-y-0 sm:[&>*]:border-b sm:[&>*]:border-border lg:grid-cols-3">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.label}
              className="flex items-start gap-3 px-4 py-3 sm:border-r sm:border-border"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{r.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {r.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function HadronCompanyDetails({
  payload,
  terminalFallback = 0,
}: {
  payload: Record<string, unknown>;
  terminalFallback?: number;
}) {
  const text = (cliKey: string, companyKey = cliKey.replace(/^cli_/, "tcl_")) =>
    String(payload[companyKey] ?? payload[cliKey] ?? "").trim();
  const parseLegacyValue = (cliKey: string): unknown => {
    const companyKey = cliKey.replace(/^cli_/, "tcl_");
    const value = payload[companyKey] ?? payload[cliKey];
    if (value && typeof value === "object") return value;
    try {
      return JSON.parse(String(value || "[]"));
    } catch {
      return [];
    }
  };
  const legacyEntries = (value: unknown): Array<[string, string]> => {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => [item, ""]);
    }
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key.trim(), String(raw ?? "").trim()] as [string, string])
      .filter(([key]) => Boolean(key));
  };
  const normalizeKey = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const hasLegacySelection = (value: unknown, key: string) =>
    legacyEntries(value).some(([entryKey]) => normalizeKey(entryKey) === normalizeKey(key));

  const responsibles = [text("cli_operador_resp1"), text("cli_operador_resp2")]
    .filter(Boolean)
    .join("/");
  const fiscalDocuments = legacyEntries(parseLegacyValue("cli_docs_fiscais"));
  const fiscalDefinitions = [
    ["nfe", "NF-e", ["nfe"]],
    ["cte", "CT-e", ["cte"]],
    ["nfce", "NFC-e", ["nfce"]],
    ["nfse", "NFS-e", ["nfse"]],
    ["mdfe", "MDF-e", ["mdfe"]],
    ["sat", "SAT", ["ecfsat", "sat", "ecf"]],
    ["no", "Não utiliza", ["no", "nao", "naoutiliza", "nenhum"]],
  ] as const;
  const fiscalEntries = fiscalDefinitions.map(([key, label, aliases]) => {
    const match = fiscalDocuments.find(([entryKey]) =>
      aliases.includes(normalizeKey(entryKey) as never),
    );
    const rawDetail = match?.[1] ?? "";
    const detail =
      rawDetail && normalizeKey(rawDetail) !== normalizeKey(match?.[0] ?? "")
        ? rawDetail.replace(/^[.\s-]+$/, "")
        : "";
    return { key, label, active: Boolean(match), detail };
  });
  const importedData = parseLegacyValue("cli_import_dados");
  const importedDataOptions = [
    ["produtos", "Produtos"],
    ["terceiros", "Terceiros"],
    ["estoque", "Estoque"],
  ] as const;
  const networkValue = text("cli_config_rede").toLowerCase();
  const networkLabel =
    ({ cabo: "Cabo", wireless: "Wireless", wifi: "Wi-Fi", "wi-fi": "Wi-Fi", "0": "Não informada" }[
      networkValue
    ] ??
      text("cli_config_rede") ??
      "Não informada") ||
    "Não informada";
  const terminalCount = text("cli_nterminais") || String(terminalFallback);
  const bankEntries = legacyEntries(parseLegacyValue("cli_boleto_dados"))
    .filter(([name]) => name.replace(/[.\s-]/g, "").length > 0)
    .map(([name, detail]) => ({ name, detail: detail.replace(/^[.\s-]+$/, "") }));

  return (
    <div className="divide-y divide-border">
      <section className="py-6">
        <h4 className="mb-4 text-sm font-medium">Responsáveis</h4>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <HadronDetail icon={UsersRound}>
            <Field label="Responsáveis" value={responsibles || "Não informado"} />
          </HadronDetail>
          <HadronDetail icon={Clock3}>
            <Field label="Tempo de instalação" value={text("cli_tmp_mod") || "Não informado"} />
          </HadronDetail>
        </div>
      </section>

      <section className="py-6">
        <h4 className="mb-4 text-sm font-medium">Documentos fiscais</h4>
        <HadronDetail icon={Printer}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {fiscalEntries.map((entry) => (
              <span
                key={entry.key}
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm",
                  entry.active ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {entry.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                <span className={cn(entry.active && "font-medium")}>{entry.label}</span>
                {entry.detail ? (
                  <span className="text-xs text-muted-foreground">({entry.detail})</span>
                ) : null}
              </span>
            ))}
          </div>
        </HadronDetail>
        <p className="mt-5 text-xs text-muted-foreground">
          Homologação das NF-e em conjunto com o cliente e contador:{" "}
          <span className="font-medium text-foreground">
            {text("cli_homo_nfes") === "1" ? "SIM" : "NÃO"}
          </span>
        </p>
      </section>

      <section className="py-6">
        <h4 className="mb-4 text-sm font-medium">Configurações da rede</h4>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <HadronDetail icon={Monitor}>
            <Field label="Terminais" value={terminalCount || "Não informado"} />
          </HadronDetail>
          <HadronDetail icon={Cable}>
            <Field label="Configuração de rede" value={networkLabel} />
          </HadronDetail>
          <HadronDetail icon={Database}>
            <p className="text-xs uppercase text-muted-foreground">Importação de dados</p>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {importedDataOptions.map(([key, label]) => {
                const active = hasLegacySelection(importedData, key);
                return (
                  <span
                    key={key}
                    className={cn(
                      "flex items-center gap-1.5 text-sm",
                      active ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {label}
                  </span>
                );
              })}
            </div>
          </HadronDetail>
        </div>
      </section>

      <section className="py-6">
        <h4 className="mb-4 text-sm font-medium">Cobrança</h4>
        <HadronDetail icon={Landmark}>
          <Field label="Boleto bancário" value={bankEntries.length ? "SIM" : "NÃO"} />
        </HadronDetail>
        {bankEntries.length ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {bankEntries.map((bank) => (
              <span
                key={bank.name}
                title={[bank.name, bank.detail].filter(Boolean).join(" · ")}
                className="inline-flex max-w-full items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <BankMark name={bank.name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{bank.name}</span>
                  {bank.detail ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {bank.detail}
                    </span>
                  ) : null}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

const MODULE_ICON_RULES: Array<[RegExp, ComponentType<{ className?: string }>]> = [
  [/venda|pedido|pdv|orcament/i, ShoppingCart],
  [/fiscal|nota|nfe|sped|ecf/i, FileText],
  [/financ|caixa|banc|cobran|contas/i, CircleDollarSign],
  [/estoque|produto|invent/i, Boxes],
  [/compra|entrega|transport|frete|logist/i, Truck],
  [/contab|apurac|calculo/i, Calculator],
  [/web|portal|internet|integra/i, Globe2],
  [/impress|etiqueta/i, Printer],
  [/servi|manuten|ordem/i, Wrench],
  [/usuari|terceiro|cliente/i, UsersRound],
  [/relatorio|dados|base/i, Database],
];

function moduleIcon(name: string): ComponentType<{ className?: string }> {
  const found = MODULE_ICON_RULES.find(([re]) => re.test(name));
  return found ? found[1] : Server;
}

function ModuleColumn({
  title,
  items,
  contracted = false,
}: {
  title: string;
  items: ClientModule[];
  contracted?: boolean;
}) {
  const StatusIcon = contracted ? CheckCircle2 : MinusCircle;
  const accent = contracted ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <StatusIcon className={cn("h-4 w-4 shrink-0", accent)} />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Badge
          variant="secondary"
          className={cn(
            "ml-auto rounded-full px-2 py-0 text-[11px] font-medium",
            contracted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {items.length}
        </Badge>
      </div>
      {items.length ? (
        <ul className="divide-y divide-border/60">
          {items.map((item) => {
            const Icon = moduleIcon(item.name);
            return (
              <li key={item.id} className="flex items-center gap-2.5 px-4 py-2">
                <Icon className={cn("h-4 w-4 shrink-0", accent)} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.name}</span>
                {contracted ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum módulo nesta lista.</p>
      )}
    </div>
  );
}

export function ClientHadronTab({
  client,
  companies,
  modules,
  terminals,
}: {
  client: ClientRow;
  companies: ClientCompany[];
  modules: ClientModule[];
  terminals: ClientTerminal[];
}) {
  const [openCompanyId, setOpenCompanyId] = useState<string | null | undefined>(undefined);
  const contracted = modules.filter((item) => item.contracted);
  const unavailable = modules.filter((item) => !item.contracted);
  const payload = client.sourcePayload || {};
  const text = (key: string) => String(payload[key] ?? "").trim();
  const parseLegacyValue = (key: string): unknown => {
    const value = payload[key];
    if (value && typeof value === "object") {
      return value;
    }
    try {
      return JSON.parse(String(value || "[]"));
    } catch {
      return [];
    }
  };
  const hasLegacySelection = (value: unknown, ...keys: string[]) => {
    if (Array.isArray(value)) {
      return keys.some((key) => value.some((item) => String(item).toLowerCase() === key));
    }
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
  };
  const serial = [text("cli_serial1") || client.acronym, text("cli_serial2"), text("cli_serial3")]
    .filter(Boolean)
    .join(" - ");
  const responsibles = [text("cli_operador_resp1"), text("cli_operador_resp2")]
    .filter(Boolean)
    .join("/");
  const legacyEntries = (value: unknown): Array<[string, string]> => {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => [item, ""] as [string, string]);
    }
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [String(key).trim(), String(raw ?? "").trim()] as [string, string])
      .filter(([key]) => Boolean(key));
  };
  const normalizeKey = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const fiscalDocuments = legacyEntries(parseLegacyValue("cli_docs_fiscais"));
  const fiscalDefinitions = [
    ["nfe", "NF-e", ["nfe", "nf-e"]],
    ["cte", "CT-e", ["cte", "ct-e"]],
    ["nfce", "NFC-e", ["nfce", "nfc-e"]],
    ["nfse", "NFS-e", ["nfse", "nfs-e"]],
    ["mdfe", "MDF-e", ["mdfe", "mdf-e"]],
    ["sat", "SAT", ["ecfsat", "sat", "ecf"]],
    ["no", "Não utiliza", ["no", "nao", "naoutiliza", "nenhum"]],
  ] as const;
  const fiscalEntries = fiscalDefinitions.map(([key, label, aliases]) => {
    const match = fiscalDocuments.find(([entryKey]) =>
      (aliases as readonly string[]).includes(normalizeKey(entryKey)),
    );
    const rawDetail = match?.[1] ?? "";
    const detail =
      rawDetail && normalizeKey(rawDetail) !== normalizeKey(match?.[0] ?? "")
        ? rawDetail.replace(/^[.\s-]+$/, "")
        : "";
    return { key, label, active: Boolean(match), detail };
  });

  const importedData = parseLegacyValue("cli_import_dados");
  const importedDataOptions = [
    ["produtos", "Produtos"],
    ["terceiros", "Terceiros"],
    ["estoque", "Estoque"],
  ] as const;
  const yesNo = (value: string) => (value === "1" ? "SIM" : "NÃO");
  const networkLabel =
    (
      {
        cabo: "Cabo",
        wireless: "Wireless",
        wifi: "Wi-Fi",
        "wi-fi": "Wi-Fi",
        "0": "Não informada",
      } as Record<string, string>
    )[text("cli_config_rede").toLowerCase()] ||
    text("cli_config_rede") ||
    "Não informada";
  const terminalCount = text("cli_nterminais") || String(terminals.length);
  const bankEntries = legacyEntries(parseLegacyValue("cli_boleto_dados"))
    .filter(([name]) => name.replace(/[.\s-]/g, "").length > 0)
    .map(([name, detail]) => ({
      name,
      detail: detail.replace(/^[.\s-]+$/, ""),
    }));

  return (
    <Section title="Hádron" icon={HadronMenuIcon}>
      <div className="mb-5">
        <Field label="Serial" value={serial || "Não informado"} />
      </div>

      <div className="mb-3">
        <h4 className="text-sm font-medium">Módulos</h4>
      </div>

      {modules.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ModuleColumn title="Contratados" items={contracted} contracted />
          <ModuleColumn title="Não contratados" items={unavailable} />
        </div>
      ) : (
        <EmptyState text="Nenhum módulo cadastrado para este cliente." />
      )}

      <div className="hidden">
        <section className="py-6">
          <h4 className="mb-4 text-sm font-medium">Responsáveis</h4>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <HadronDetail icon={UsersRound}>
              <Field label="Responsáveis" value={responsibles || "Não informado"} />
            </HadronDetail>
            <HadronDetail icon={Clock3}>
              <Field label="Tempo de instalação" value={text("cli_tmp_mod") || "Não informado"} />
            </HadronDetail>
          </div>
        </section>

        <section className="py-6">
          <h4 className="mb-4 text-sm font-medium">Documentos fiscais</h4>
          <HadronDetail icon={Printer}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {fiscalEntries.map((entry) => (
                <span
                  key={entry.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm",
                    entry.active
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {entry.active ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 shrink-0" />
                  )}
                  <span className={cn(entry.active && "font-medium")}>{entry.label}</span>
                  {entry.detail ? (
                    <span className="text-xs text-muted-foreground">({entry.detail})</span>
                  ) : null}
                </span>
              ))}
            </div>
          </HadronDetail>
          <p className="mt-5 text-xs text-muted-foreground">
            Homologação das NF-e em conjunto com o cliente e contador:{" "}
            <span className="font-medium text-foreground">{yesNo(text("cli_homo_nfes"))}</span>
          </p>
        </section>

        <section className="py-6">
          <h4 className="mb-4 text-sm font-medium">Configurações da rede</h4>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <HadronDetail icon={Monitor}>
              <Field label="Terminais" value={terminalCount || "Não informado"} />
            </HadronDetail>
            <HadronDetail icon={Cable}>
              <Field label="Configuração de rede" value={networkLabel} />
            </HadronDetail>
            <HadronDetail icon={Database}>
              <p className="text-xs uppercase text-muted-foreground">Importação de dados</p>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
                {importedDataOptions.map(([key, label]) => {
                  const active = hasLegacySelection(importedData, key);
                  return (
                    <span
                      key={key}
                      className={cn(
                        "flex items-center gap-1.5 text-sm",
                        active ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {active ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 shrink-0" />
                      )}
                      {label}
                    </span>
                  );
                })}
              </div>
            </HadronDetail>
          </div>
        </section>

        <section className="py-6">
          <h4 className="mb-4 text-sm font-medium">Cobrança</h4>
          <HadronDetail icon={Landmark}>
            <Field label="Boleto bancário" value={bankEntries.length ? "SIM" : "NÃO"} />
          </HadronDetail>
          {bankEntries.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {bankEntries.map((bank) => (
                <span
                  key={bank.name}
                  title={[bank.name, bank.detail].filter(Boolean).join(" · ")}
                  className="inline-flex max-w-full items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                >
                  <BankMark name={bank.name} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{bank.name}</span>
                    {bank.detail ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {bank.detail}
                      </span>
                    ) : null}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-6 space-y-2 border-t border-border pt-6">
        {companies.length === 0 ? (
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Server className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-mono text-muted-foreground">001</span>
                <span className="truncate text-sm font-medium text-foreground">
                  {client.razaoSocial || client.fantasia || client.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {client.cnpj || "CNPJ não informado"}
                </span>
                <Badge
                  variant="outline"
                  className="h-5 rounded-full border-primary/30 bg-primary/10 px-2 text-[10.5px] font-medium text-primary"
                >
                  Principal
                </Badge>
              </span>
            </div>
            <div className="border-t border-border bg-muted/10 px-4">
              <HadronCompanyDetails
                payload={client.sourcePayload || {}}
                terminalFallback={terminals.length}
              />
            </div>
          </div>
        ) : null}

        {(() => {
          const isPrincipal = (co: ClientCompany) => {
            if (co.groupPosition === "001") return true;
            const digits = (co.document || "").replace(/\D+/g, "");
            if (digits.length === 14 && digits.slice(8, 12) === "0001") return true;
            return co.companyNumber === 1;
          };
          const defaultOpen = (companies.find(isPrincipal) ?? companies[0])?.id ?? null;
          const activeId = openCompanyId === undefined ? defaultOpen : openCompanyId;

          return companies.map((company) => {
            const principal = isPrincipal(company);
            const expanded = activeId === company.id;
            const number =
              company.groupPosition ||
              (company.companyNumber != null
                ? String(company.companyNumber).padStart(3, "0")
                : company.clientAcronym || "—");

            return (
              <div
                key={company.id}
                className="overflow-hidden rounded-md border border-border bg-background"
              >
                <button
                  type="button"
                  onClick={() => setOpenCompanyId(expanded ? null : company.id)}
                  aria-expanded={expanded}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Server className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-mono text-muted-foreground">{number}</span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {company.legalName || company.tradeName || "Empresa vinculada"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {company.document || "CNPJ não informado"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 rounded-full px-2 text-[10.5px] font-medium",
                        principal
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {principal ? "Principal" : "Filial"}
                    </Badge>
                  </span>
                  <ArrowDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      expanded ? "rotate-180" : "rotate-0",
                    )}
                  />
                </button>

                {expanded && (
                  <div className="border-t border-border bg-muted/10 px-4">
                    <HadronCompanyDetails payload={company.sourcePayload} />
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
    </Section>
  );
}

export function ClientUsersTab({ users }: { users: ClientHadronUser[] }) {
  return (
    <Section title={`Usuários do portal (${users.length})`} icon={UsersRound}>
      {users.length ? (
        <SortableDataTable<ClientHadronUser>
          rows={users}
          initialSort={{ key: "dates", dir: "desc" }}
          columns={[
            {
              key: "name",
              label: "Nome",
              value: (u) => u.name || "",
              render: (u) => u.name || "-",
            },
            {
              key: "email",
              label: "E-mail",
              value: (u) => u.email || "",
              render: (u) => u.email || "-",
            },
            {
              key: "operator",
              label: "Operador",
              value: (u) => u.operator || "",
              render: (u) => u.operator || "-",
            },
            {
              key: "role",
              label: "Perfil",
              value: (u) => u.role || "",
              render: (u) => u.role || "-",
            },
            {
              key: "status",
              label: "Situação",
              value: (u) => u.status || "",
              render: (u) => u.status || "-",
            },
            {
              key: "active",
              label: "Ativo",
              value: (u) => (u.active ? 1 : 0),
              render: (u) => (u.active ? "Sim" : "Não"),
            },
            {
              key: "dates",
              label: "Datas",
              value: (u) => parseBrDateValue(u.updatedAt || u.createdAt),
              render: (u) => (
                <span className="space-y-0.5 text-xs">
                  <span className="block">{u.createdAt || "-"}</span>
                  <span className="block">{u.updatedAt || "-"}</span>
                </span>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState text="Nenhum usuário vinculado a este cliente." />
      )}
    </Section>
  );
}

export function ClientTerminalsTab({ terminals }: { terminals: ClientTerminal[] }) {
  const versionCell = (versionDate: string) => {
    if (!versionDate) return "-";
    if (!isErpVersionOutdated(versionDate)) return versionDate;

    return (
      <span
        className="inline-flex rounded-sm bg-red-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-red-500"
        title={`Versão anterior à alteração mínima de ${formatVersionDate(latestErpAlterationDate)}`}
      >
        {versionDate}
      </span>
    );
  };

  return (
    <Section title={`Terminais instalados (${terminals.length})`} icon={Monitor}>
      {terminals.length ? (
        <SortableDataTable<ClientTerminal>
          rows={terminals}
          initialSort={{ key: "registeredAt", dir: "desc" }}
          columns={[
            {
              key: "terminal",
              label: "Terminal",
              value: (t) => (t.terminalNumber == null ? Number.NaN : Number(t.terminalNumber)),
              render: (t) => (t.terminalNumber == null ? "-" : String(t.terminalNumber)),
            },
            {
              key: "ip",
              label: "IP",
              value: (t) => t.ipAddress || "",
              render: (t) => t.ipAddress || "-",
            },
            {
              key: "path",
              label: "Pasta",
              value: (t) => t.installPath || "",
              render: (t) => t.installPath || "-",
            },
            {
              key: "registeredAt",
              label: "Último setup",
              value: (t) => parseBrDateValue(t.registeredAt),
              render: (t) => t.registeredAt || "-",
            },
            {
              key: "versionDate",
              label: "Última versão",
              value: (t) => parseBrDateValue(t.versionDate),
              render: (t) => versionCell(t.versionDate),
            },
            {
              key: "serial",
              label: "Nº de série",
              value: (t) => t.serialNumber || "",
              render: (t) => t.serialNumber || "-",
            },
          ]}
        />
      ) : (
        <EmptyState text="Nenhum terminal vinculado a este cliente." />
      )}
    </Section>
  );
}

export function ClientLogsTab({ logs }: { logs: ClientLogs["logs"] }) {
  return (
    <Section title={`Logs (${logs.length})`} icon={ScrollText}>
      {logs.length ? (
        <DataTable
          headers={["Data", "Terminal", "Nível", "Operação", "Operador", "Opção", "Usuário", "IP"]}
          rows={logs.map((log) => [
            log.occurredAt || "-",
            log.terminalCode || "-",
            log.level || "-",
            log.operation || "-",
            log.operatorCode || "-",
            [log.parentOption, log.childOption].filter(Boolean).join(" / ") || "-",
            log.userCode || "-",
            log.ipAddress || "-",
          ])}
        />
      ) : (
        <EmptyState text="Nenhum log do Hádron encontrado para este cliente." />
      )}
    </Section>
  );
}

export function ClientExternalLogsTab({ logs }: { logs: ClientLogs["externalLogs"] }) {
  return (
    <Section title={`Logs externos (${logs.length})`} icon={History}>
      {logs.length ? (
        <DataTable
          headers={["Data", "Ação", "Controlador", "Operador", "Dispositivo", "IP", "Informação"]}
          rows={logs.map((log) => [
            log.occurredAt || "-",
            log.action || "-",
            log.controller || "-",
            log.operator || "-",
            [log.agent, log.device].filter(Boolean).join(" / ") || "-",
            log.ipAddress || "-",
            <span className="block max-w-md truncate" title={log.info || log.url}>
              {log.info || log.url || "-"}
            </span>,
          ])}
        />
      ) : (
        <EmptyState text="Nenhum log externo encontrado para este cliente." />
      )}
    </Section>
  );
}

export function ClientParametersTab({ parameters }: { parameters: ClientParameter[] }) {
  const [selectedParameter, setSelectedParameter] = useState<ClientParameter | null>(null);
  const parameterTitle = (parameter: ClientParameter) =>
    parameter.parameterLegacyId === "2"
      ? "Automatização B2C de procedimento de Cadastro de Clientes (e-commerce)"
      : `Parâmetro ${parameter.parameterLegacyId || parameter.signature}`;

  return (
    <>
      <Section title="Parâmetros" icon={SlidersHorizontal}>
        {parameters.length ? (
          <DataTable
            headers={["Op.", "Assinado por", "Título/Descrição", "Datas", "Ações"]}
            rows={parameters.map((parameter) => [
              parameter.signature || "-",
              parameter.signedBy || parameter.operator || "Não informado",
              parameterTitle(parameter),
              <span className="space-y-0.5 text-xs">
                <span className="block">{parameter.createdAt || "-"}</span>
                <span className="block">{parameter.updatedAt || "-"}</span>
              </span>,
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                title="Visualizar parâmetro"
                aria-label={`Visualizar ${parameterTitle(parameter)}`}
                onClick={() => setSelectedParameter(parameter)}
              >
                <Eye className="h-4 w-4" />
              </Button>,
            ])}
          />
        ) : (
          <EmptyState text="Nenhum parâmetro encontrado para este cliente." />
        )}
      </Section>

      <Dialog
        open={selectedParameter !== null}
        onOpenChange={(open) => !open && setSelectedParameter(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          {selectedParameter && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Parâmetro
                  <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="border-b border-border pb-4">
                  <p className="text-sm font-medium">{selectedParameter.signature || "-"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedParameter.optionData || "Descrição não informada."}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">Web</p>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium">Texto</h4>
                  {selectedParameter.parameterLegacyId === "2" ? (
                    <div className="space-y-4 text-sm leading-6 text-muted-foreground">
                      <p>
                        Este parâmetro tem a função de estabelecer a forma de automatização na
                        operação do Cadastro de Clientes quando estes são manipulados externamente
                        através dos sites de e-commerce.
                      </p>
                      <p>
                        A definição da forma de automatização é de responsabilidade exclusiva da
                        empresa que utiliza o ERP Hádron, eximindo a Prócion por eventuais erros de
                        cadastro oriundos de digitação incorreta por parte do usuário do e-commerce.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {selectedParameter.optionData || "Texto não informado."}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const deviceTypeLabel: Record<string, string> = {
  M: "Mobile",
  S: "Servidor",
  T: "Terminal",
};

export function ClientDevicesTab({ internet }: { internet: ClientInternet }) {
  const devices = internet.devices.length
    ? internet.devices
    : internet.contracts.flatMap((contract) => contract.devices);

  type DeviceRow = (typeof devices)[number];

  return (
    <Section title={`Dispositivos (${devices.length})`} icon={Monitor}>
      {devices.length ? (
        <SortableDataTable<DeviceRow>
          rows={devices}
          dense
          minWidthClass="min-w-[900px]"
          initialSort={{ key: "lastChecked", dir: "desc" }}
          columns={[
            {
              key: "user",
              label: "Utilizador",
              value: (d) => d.user || "",
              render: (d) => d.user || "-",
            },
            {
              key: "type",
              label: "Tipo",
              value: (d) => deviceTypeLabel[d.type] || d.type || "",
              render: (d) => deviceTypeLabel[d.type] || d.type || "-",
            },
            {
              key: "system",
              label: "Sistema",
              value: (d) => d.system || "",
              render: (d) => d.system || "-",
            },
            {
              key: "app",
              label: "App",
              value: (d) => d.appType || "",
              render: (d) => d.appType || "-",
            },
            {
              key: "build",
              label: "Build",
              value: (d) => d.buildVersion || "",
              render: (d) => d.buildVersion || "-",
            },
            {
              key: "db",
              label: "Banco",
              value: (d) => d.dbVersion || "",
              render: (d) => d.dbVersion || "-",
            },
            {
              key: "status",
              label: "Status",
              value: (d) => (d.active ? "Ativo" : d.status || "Inativo"),
              render: (d) => (d.active ? "Ativo" : d.status || "Inativo"),
            },
            {
              key: "uuid",
              label: "UUID",
              value: (d) => d.deviceUuid || "",
              cellClassName: "font-mono text-[11.5px] leading-snug break-all whitespace-normal",
              render: (d) => d.deviceUuid || "-",
            },
            {
              key: "lastChecked",
              label: "Última verificação",
              value: (d) => parseBrDateValue(d.lastCheckedAt || d.updatedAt),
              cellClassName: "whitespace-nowrap",
              render: (d) => d.lastCheckedAt || d.updatedAt || "-",
            },
          ]}
        />
      ) : (
        <EmptyState text="Nenhum dispositivo vinculado aos contratos ativos." />
      )}
    </Section>
  );
}

const HADRON_APP_CATALOG: {
  key: string;
  label: string;
  contractTypes: string[];
  matches: (name: string, type: string) => boolean;
}[] = [
  {
    key: "mobile",
    label: "Hádron Mobile",
    contractTypes: ["MOB", "MOBILE"],
    matches: (n, t) => /mobile/i.test(n) || /mobile/i.test(t),
  },
  {
    key: "web",
    label: "Hádron Web",
    contractTypes: ["WEB"],
    matches: (n, t) => /web/i.test(n) || /web/i.test(t),
  },
  {
    key: "commerce",
    label: "Hádron Commerce",
    contractTypes: ["B2C", "COMMERCE"],
    matches: (n, t) => /commerce|e-?commerce|loja/i.test(n) || /commerce|b2c/i.test(t),
  },
  {
    key: "portal",
    label: "Hádron Portal B2B",
    contractTypes: ["B2B", "PORTAL"],
    matches: (n, t) => /portal|b2b/i.test(n) || /portal|b2b/i.test(t),
  },
];

export function ClientInternetTab({
  client,
  internet,
}: {
  client: ClientRow;
  internet: ClientInternet;
}) {
  const [configOpen, setConfigOpen] = useState(false);
  const contracts = internet.contracts;
  const webContract = contracts.find((c) => c.active) ?? contracts[0];
  const contractText = (contract: ClientInternet["contracts"][number], key: string) =>
    String(contract.sourcePayload[key] ?? "").trim();
  const contractApps = (contract: ClientInternet["contracts"][number]) => {
    const raw = contract.sourcePayload.con_web_apps;
    if (Array.isArray(raw)) return raw.map((item) => String(item).toUpperCase());
    try {
      const parsed = JSON.parse(String(raw || "[]"));
      return Array.isArray(parsed) ? parsed.map((item) => String(item).toUpperCase()) : [];
    } catch {
      return [];
    }
  };
  const selectedApps = contracts.flatMap(contractApps);
  const databaseUser = webContract
    ? contractText(webContract, "con_username_db") || contractText(webContract, "con_database_user")
    : "";
  const deviceLimit = webContract ? contractText(webContract, "con_qtd_dispositivos") : "";
  const webUrl =
    webContract?.webUrl ||
    (webContract && contractText(webContract, "con_mobile_url")) ||
    contracts.map((c) => c.webUrl || contractText(c, "con_mobile_url")).find(Boolean) ||
    "";

  const catalog = HADRON_APP_CATALOG.map((item) => {
    const match = internet.applications.find((app) => item.matches(app.name, app.appType));
    const selectedByContract = selectedApps.some((appType) => item.contractTypes.includes(appType));
    return {
      ...item,
      contracted: selectedByContract || !!(match && match.active),
      version: match?.version || "",
      updatedAt: match?.updatedAt || "",
      status: match?.status || "",
    };
  });
  const otherApps = internet.applications.filter(
    (app) => !HADRON_APP_CATALOG.some((item) => item.matches(app.name, app.appType)),
  );
  const initialConfig = {
    description:
      (webContract && contractText(webContract, "con_descricao")) ||
      client.fantasia ||
      client.razaoSocial ||
      client.name,
    acronym: (webContract && contractText(webContract, "con_cliente_sigla")) || client.acronym,
    contractKey: webContract?.contractKey || "",
    deviceLimit,
    webUrl,
    serverHost: webContract?.serverHost || "",
    databaseName: webContract?.databaseName || "",
    databaseUser,
    active: webContract?.active ?? false,
    modules: Object.fromEntries(catalog.map((app) => [app.key, app.contracted])),
  };
  const [config, setConfig] = useState(initialConfig);

  const updateConfig = <Key extends keyof typeof config>(key: Key, value: (typeof config)[Key]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const openConfiguration = () => {
    setConfig(initialConfig);
    setConfigOpen(true);
  };

  return (
    <div className="space-y-5">
      <Section title="Contrato Web" icon={Server}>
        {contracts.length ? (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const contractDevices = contract.devices.length
                ? contract.devices
                : internet.devices.filter((d) => d.contractLegacyId === contract.legacyId);
              const activeContractDevices = contractDevices.filter(
                (device) => device.active,
              ).length;
              const isActive = contract.active;
              const deviceLimit = contractText(contract, "con_qtd_dispositivos");
              const contractUrl =
                contract.webUrl ||
                contractText(contract, "con_mobile_url") ||
                contractText(contract, "con_dominio_url");
              return (
                <div
                  key={contract.id}
                  className="rounded-md border border-border bg-background p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {contract.name || "Contrato"}
                      </p>
                      {contract.updatedAt && (
                        <p className="text-[11px] text-muted-foreground">
                          Atualizado em {contract.updatedAt}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {isActive ? "Ativo" : contract.status || "Inativo"}
                    </Badge>
                  </div>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <HadronDetail icon={ShieldCheck}>
                      <Field
                        label="Status"
                        value={isActive ? "Ativo" : contract.status || "Inativo"}
                      />
                    </HadronDetail>
                    <HadronDetail icon={KeyRound}>
                      <Field
                        label="Chave do contrato"
                        value={contract.contractKey || "Não informada"}
                      />
                    </HadronDetail>
                    <HadronDetail icon={Smartphone}>
                      <Field
                        label="Dispositivos"
                        value={
                          deviceLimit
                            ? `${activeContractDevices}/${deviceLimit}`
                            : String(activeContractDevices)
                        }
                      />
                    </HadronDetail>
                    <HadronDetail icon={Globe2}>
                      <Field label="URL / Domínio" value={contractUrl || "Não informada"} />
                    </HadronDetail>
                    <HadronDetail icon={CalendarDays}>
                      <Field label="Início" value={contract.startsAt || "Não informado"} />
                    </HadronDetail>
                    <HadronDetail icon={Clock3}>
                      <Field label="Expira em" value={contract.expiresAt || "Não informado"} />
                    </HadronDetail>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nenhum contrato web encontrado." />
        )}
      </Section>

      <Section title="Hádron Web" icon={HadronMenuIcon}>
        {webUrl && (
          <div className="mb-4">
            <HadronDetail icon={Globe2}>
              <Field label="URL do Hádron Web" value={webUrl} />
            </HadronDetail>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.map((app) => (
            <div
              key={app.key}
              className={cn(
                "flex min-h-11 items-center gap-2 border-b border-border/70 py-2 text-sm",
                !app.contracted && "text-muted-foreground",
              )}
            >
              {app.contracted ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X className="h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={cn("truncate", app.contracted && "font-medium")}>{app.label}</p>
                {(app.version || app.updatedAt) && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[app.version, app.updatedAt].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {catalog.find((app) => app.key === "web")?.contracted && webUrl && (
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
            <HadronMenuIcon className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="mb-2 text-sm font-medium">Hádron Web</p>
              <Button size="sm" className="h-8 cursor-pointer" onClick={openConfiguration}>
                Configurar
              </Button>
            </div>
          </div>
        )}
        {otherApps.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Outras aplicações ({otherApps.length})
            </p>
            <DataTable
              headers={["Aplicativo", "Tipo", "Versão", "Situação", "Atualização"]}
              rows={otherApps.map((app) => [
                app.name || "-",
                app.appType || "-",
                app.version || "-",
                app.active ? "Contratada" : "Não contratada",
                app.updatedAt || "-",
              ])}
            />
          </div>
        )}
      </Section>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <HadronMenuIcon className="h-6 w-6" />
              </span>
              <span className="min-w-0 truncate">
                {client.acronym} - {client.razaoSocial || client.name}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-6 pb-7">
            <div>
              <h3 className="mb-5 border-b border-border bg-muted/60 px-4 py-3 text-sm font-medium">
                Dados do cliente
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <ConfigInput
                  label="Descrição"
                  value={config.description}
                  onChange={(value) => updateConfig("description", value)}
                />
                <div />
                <ConfigInput
                  label="Sigla"
                  value={config.acronym}
                  onChange={(value) => updateConfig("acronym", value.toUpperCase())}
                />
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Contrato
                  </span>
                  <Input value={config.contractKey || "Não informado"} readOnly />
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-3 border-b border-border bg-muted/60 px-4 py-3 text-sm font-medium">
                Módulos contratados
              </h3>
              <div className="grid gap-2 px-2 sm:grid-cols-2 lg:grid-cols-4">
                {catalog.map((app) => (
                  <label
                    key={app.key}
                    className="flex min-h-10 cursor-pointer items-center gap-2 py-2 text-sm"
                  >
                    <Checkbox
                      checked={config.modules[app.key] === true}
                      onCheckedChange={(checked) =>
                        updateConfig("modules", {
                          ...config.modules,
                          [app.key]: checked === true,
                        })
                      }
                    />
                    <span
                      className={!config.modules[app.key] ? "text-muted-foreground" : undefined}
                    >
                      {app.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-5 border-b border-border bg-muted/60 px-4 py-3 text-sm font-medium">
                Configurações
              </h3>
              <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                <HadronDetail icon={Smartphone}>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Quant. dispositivos
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={config.deviceLimit}
                      onChange={(event) => updateConfig("deviceLimit", event.target.value)}
                    />
                  </label>
                </HadronDetail>
                <HadronDetail icon={Globe2}>
                  <ConfigInput
                    label="URL RGBW"
                    value={config.webUrl}
                    onChange={(value) => updateConfig("webUrl", value)}
                  />
                </HadronDetail>
                <HadronDetail icon={Server}>
                  <ConfigInput
                    label="Host/server BD"
                    value={config.serverHost}
                    onChange={(value) => updateConfig("serverHost", value)}
                  />
                </HadronDetail>
                <HadronDetail icon={Database}>
                  <ConfigInput
                    label="Base de dados"
                    value={config.databaseName}
                    onChange={(value) => updateConfig("databaseName", value)}
                  />
                </HadronDetail>
                <HadronDetail icon={CircleUserRound}>
                  <ConfigInput
                    label="Usuário BD"
                    value={config.databaseUser}
                    onChange={(value) => updateConfig("databaseUser", value)}
                  />
                </HadronDetail>
                <HadronDetail icon={LockKeyhole}>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Senha BD
                    </span>
                    <Input
                      type="password"
                      value=""
                      readOnly
                      placeholder="Protegida no CRM original"
                      autoComplete="new-password"
                    />
                  </label>
                </HadronDetail>
              </div>
            </div>

            <div>
              <h3 className="mb-4 border-b border-border bg-muted/60 px-4 py-3 text-sm font-medium">
                Status
              </h3>
              <label className="flex w-fit cursor-pointer items-center gap-3">
                <Switch
                  checked={config.active}
                  onCheckedChange={(checked) => updateConfig("active", checked)}
                />
                <span className="text-sm font-medium">
                  {config.active ? "Ativado" : "Desativado"}
                </span>
              </label>
            </div>

            <div className="flex justify-end border-t border-border pt-5">
              <Button
                disabled
                title="Disponível após ativar a autenticação administrativa"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ClientCompaniesTab({
  client,
  companies,
  terminals,
}: {
  client: ClientRow;
  companies: ClientCompany[];
  terminals: ClientTerminal[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!companies.length)
    return (
      <Section title="Empresas vinculadas" icon={Server}>
        <EmptyState text="Nenhuma empresa vinculada a este cliente." />
      </Section>
    );

  const isPrincipal = (co: ClientCompany) => {
    if (co.groupPosition === "001") return true;
    const digits = (co.document || "").replace(/\D+/g, "");
    if (digits.length === 14 && digits.slice(8, 12) === "0001") return true;
    return co.companyNumber === 1;
  };

  return (
    <Section title={`Empresas vinculadas (${companies.length})`} icon={Server}>
      <div className="space-y-2">
        {companies.map((company) => {
          const companyTerminals = terminals.filter(
            (terminal) => terminal.companyNumber === company.companyNumber,
          );
          const terminal = companyTerminals[0];
          const principal = isPrincipal(company);
          const expanded = openId === company.id;
          const title = company.legalName || company.tradeName || "Empresa";
          const number =
            company.groupPosition ||
            (company.companyNumber != null
              ? String(company.companyNumber).padStart(3, "0")
              : company.clientAcronym || "—");
          const addressLine = [
            company.address,
            [normalizeCityUf([company.city, company.state].filter(Boolean).join(" - "))]
              .filter(Boolean)
              .join(""),
            company.postalCode,
          ]
            .filter(Boolean)
            .join(" · ");

          const rows: Array<[string, string]> = [
            ["Código da empresa", number],
            ["Razão social", company.legalName || "Não informada"],
            ["Nome fantasia", company.tradeName || "Não informado"],
            ["CNPJ", company.document || "Não informado"],
            ["Inscrição estadual", company.stateRegistration || "Não informada"],
            ["Endereço", company.address || "Não informado"],
            [
              "Cidade / UF",
              normalizeCityUf([company.city, company.state].filter(Boolean).join(" - ")) ||
                "Não informada",
            ],
            ["CEP", company.postalCode || "Não informado"],
            ["CNAE", company.cnae || "Não informado"],
            ["Setor", company.industry || "Não informado"],
            ["Porte", company.size || "Não informado"],
            ["Regime de apuração", company.taxRegime || "Não informado"],
            ["Responsável", company.responsibleName || "Não informado"],
            ["CPF do responsável", company.responsibleDocument || "Não informado"],
            ["Escritório de contabilidade", company.accountantOffice || "Não informado"],
            ["Contador responsável", company.accountantName || "Não informado"],
            ["Terminais", String(companyTerminals.length)],
            ["Versão", terminal?.version || client.version || "Não informada"],
            [
              "Sistema operacional",
              [terminal?.operatingSystem, terminal?.operatingSystemVersion]
                .filter(Boolean)
                .join(" ") || "Não informado",
            ],
            [
              "Emite NF-e",
              terminal?.emitsNfe == null ? "Não informado" : terminal.emitsNfe ? "Sim" : "Não",
            ],
            ["Notas emitidas", terminal ? String(terminal.notesIssued) : "Não informado"],
            ["Certificado", terminal?.certificateType || "Não informado"],
            ["Validade do certificado", terminal?.certificateExpiresAt || "Não informado"],
            ["Ambiente", terminal?.environment || "Não informado"],
            ["Atualizado em", terminal?.updatedAt || client.updated || "Não informado"],
          ];

          return (
            <div
              key={company.id}
              className="overflow-hidden rounded-md border border-border bg-background"
            >
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : company.id)}
                aria-expanded={expanded}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Server className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-mono text-muted-foreground">{number}</span>
                  <span className="truncate text-sm font-medium text-foreground">{title}</span>
                  <span className="text-xs text-muted-foreground">
                    {company.document || "CNPJ não informado"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 rounded-full px-2 text-[10.5px] font-medium",
                      principal
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {principal ? "Principal" : "Filial"}
                  </Badge>
                </span>
                <ArrowDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    expanded ? "rotate-180" : "rotate-0",
                  )}
                />
              </button>

              {expanded && (
                <div className="border-t border-border bg-muted/10 px-4 py-4">
                  {addressLine && (
                    <p className="mb-3 text-xs text-muted-foreground">{addressLine}</p>
                  )}
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="truncate text-sm text-foreground" title={value}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function ClientTechnicalCompaniesTab({
  client,
  terminals,
  hadronInfo,
}: {
  client: ClientRow;
  terminals: ClientTerminal[];
  hadronInfo: ClientHadronInfo[];
}) {
  const [expanded, setExpanded] = useState(true);
  const terminal = useMemo(
    () =>
      [...terminals].sort((left, right) => {
        const leftDate = new Date(left.registeredAt || left.updatedAt || 0).getTime();
        const rightDate = new Date(right.registeredAt || right.updatedAt || 0).getTime();
        return rightDate - leftDate;
      })[0],
    [terminals],
  );

  if (hadronInfo.length > 0) {
    return <ClientHadronInfoCards rows={hadronInfo} />;
  }

  if (!terminal) {
    return (
      <Section title="Empresas" icon={Server}>
        <EmptyState text="Nenhuma informação técnica encontrada para este cliente." />
      </Section>
    );
  }

  const formatTechnicalDate = (value: string, withTime = false) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return withTime ? value : formatVersionDate(value.slice(0, 10));
    }
    return format(parsed, withTime ? "dd/MM/yyyy, HH:mm" : "dd/MM/yyyy", { locale: ptBR });
  };

  const version = terminal.versionDate
    ? formatTechnicalDate(terminal.versionDate)
    : terminal.version;
  const operatingSystem = [terminal.operatingSystem, terminal.operatingSystemVersion]
    .filter(Boolean)
    .join(" ");
  const memory =
    terminal.memoryUsed || terminal.memoryTotal
      ? `${terminal.memoryUsed || "0"}/${terminal.memoryTotal || "0"}`
      : "";
  const drives = Array.isArray(terminal.drives) ? terminal.drives : [];
  type TerminalInfoRow = [string, string, ComponentType<{ className?: string }>];
  const rows: TerminalInfoRow[] = (
    [
      ["Terminal", terminal.terminalNumber != null ? String(terminal.terminalNumber) : "", Monitor],
      ["Filial", terminal.companyNumber != null ? String(terminal.companyNumber) : "1", Building2],
      ["Versão", version, CalendarDays],
      ["IP", terminal.ipAddress, Globe2],
      ["Pasta de instalação", terminal.installPath, FolderOpen],
      ["Número de série", terminal.serialNumber, KeyRound],
      ["Data do setup", formatTechnicalDate(terminal.registeredAt, true), Clock3],
      ["Sistema operacional", operatingSystem, Cpu],
      ["Memória usada/total", memory, Cpu],
      ["Certificado", terminal.certificateType, ShieldCheck],
      ["Validade do certificado", formatTechnicalDate(terminal.certificateExpiresAt), CalendarDays],
      ["Ambiente", terminal.environment, Server],
    ] as TerminalInfoRow[]
  ).filter((row) => Boolean(row[1]));

  return (
    <Section title="Empresas" icon={Server}>
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Server className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-sm font-mono text-muted-foreground">001</span>
            <span className="truncate text-sm font-medium text-foreground">
              {client.fantasia || client.name}
            </span>
          </span>
          <ArrowDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded ? "rotate-180" : "rotate-0",
            )}
          />
        </button>

        {expanded && (
          <div className="border-t border-border px-4 py-5">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(([label, value, Icon]) => (
                <div key={label} className="flex min-w-0 gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
                    <p className="break-words text-sm text-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {drives.length > 0 && (
              <div className="mt-5 border-t border-border pt-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <HardDrive className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Discos</p>
                    <p className="text-sm text-foreground">{drives.length} informado(s)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function ClientHadronInfoCards({ rows }: { rows: ClientHadronInfo[] }) {
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id || null);

  const status = (active: boolean) => (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        active ? "text-emerald-600" : "text-muted-foreground",
      )}
    >
      {active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {active ? "Sim" : "Não"}
    </span>
  );

  return (
    <Section title={`Empresas (${rows.length})`} icon={Server}>
      <div className="space-y-2">
        {rows.map((info, index) => {
          const expanded = openId === info.id;
          const companyNumber = String(info.companyNumber ?? index + 1).padStart(3, "0");
          const title =
            info.companyDescription.replace(/^\d+\s*-\s*/, "").trim() || `Empresa ${companyNumber}`;
          return (
            <div
              key={info.id}
              className="overflow-hidden rounded-md border border-border bg-background"
            >
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : info.id)}
                aria-expanded={expanded}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Server className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {companyNumber}
                  </span>
                  <span className="text-sm font-medium text-foreground">{title}</span>
                </span>
                <ArrowDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              {expanded && (
                <div className="border-t border-border px-4 py-5">
                  <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                    <TechnicalValue icon={Monitor} label="Terminal" value={info.terminalNumber} />
                    <TechnicalValue icon={Building2} label="Filial" value={info.branchNumber} />
                    <TechnicalValue icon={CalendarDays} label="Versão" value={info.versionDate} />
                    <TechnicalValue
                      icon={Cpu}
                      label="Sistema operacional"
                      value={info.operatingSystem}
                    />
                    <TechnicalValue
                      icon={Cpu}
                      label="Versão do sistema operacional"
                      value={info.operatingSystemVersion}
                    />
                    <TechnicalValue
                      icon={Printer}
                      label="Emite NF-e"
                      value={status(info.emitsNfe)}
                    />
                    <TechnicalValue
                      icon={FileText}
                      label="Notas emitidas"
                      value={info.notesIssued}
                    />
                    <TechnicalValue
                      icon={Cpu}
                      label="Memória usada/memória total"
                      value={`${info.memoryUsed || "0"}/${info.memoryTotal || "0"}`}
                    />
                    <TechnicalValue
                      icon={ShieldCheck}
                      label="Tipo de certificado"
                      value={info.certificateType}
                    />
                    <TechnicalValue
                      icon={CalendarDays}
                      label="Validade do certificado"
                      value={info.certificateExpiresAt}
                    />
                    <TechnicalValue icon={Server} label="Ambiente" value={info.environment} />
                    <TechnicalValue
                      icon={X}
                      label="Total incompatível"
                      value={info.totalIncompatible}
                    />
                    <TechnicalValue icon={RefreshCw} label="Atualizado em" value={info.updatedAt} />
                    <TechnicalValue icon={Clock3} label="Registrado em" value={info.registeredAt} />
                  </div>

                  {info.drives.length > 0 && (
                    <div className="mt-5 grid gap-3 border-t border-border pt-5 md:grid-cols-2 xl:grid-cols-3">
                      {info.drives.map((drive) => (
                        <div
                          key={`${drive.role}-${drive.name}`}
                          className="flex items-start gap-3 rounded-md border border-border px-3 py-3"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <HardDrive className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase text-muted-foreground">
                              Drive {drive.role}
                            </p>
                            <p className="text-sm font-medium text-foreground">{drive.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {drive.used ?? 0}/{drive.total ?? 0} usado/total
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function TechnicalValue({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
        <div className="break-words text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela com ordenação clicável nos cabeçalhos
// ---------------------------------------------------------------------------
type TableSortDir = "asc" | "desc";

export type SortableColumn<T> = {
  key: string;
  label: string;
  /** Valor usado na ordenação (string ou número). */
  value?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  cellClassName?: string;
};

/** Converte datas pt-BR ("dd/mm/aaaa hh:mm") em timestamp ordenável. */
export function parseBrDateValue(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return raw;
  const value = String(raw ?? "").trim();
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return Number.NaN;
  const [, d, m, y, hh = "0", mm = "0", ss = "0"] = match;
  return new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
  ).getTime();
}

function compareSortValues(a: string | number, b: string | number): number {
  if (typeof a === "number" || typeof b === "number") {
    const na = typeof a === "number" ? a : Number.NaN;
    const nb = typeof b === "number" ? b : Number.NaN;
    const aNaN = Number.isNaN(na);
    const bNaN = Number.isNaN(nb);
    if (aNaN && bNaN) return 0;
    if (aNaN) return 1;
    if (bNaN) return -1;
    return na - nb;
  }
  const sa = String(a ?? "");
  const sb = String(b ?? "");
  const empty = (v: string) => !v || v === "-";
  if (empty(sa) && empty(sb)) return 0;
  if (empty(sa)) return 1;
  if (empty(sb)) return -1;
  return sa.localeCompare(sb, "pt-BR", { sensitivity: "base", numeric: true });
}

function SortableDataTable<T>({
  columns,
  rows,
  initialSort,
  minWidthClass = "min-w-[760px]",
  dense = false,
}: {
  columns: SortableColumn<T>[];
  rows: T[];
  initialSort?: { key: string; dir: TableSortDir };
  minWidthClass?: string;
  dense?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: TableSortDir } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.value) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compareSortValues(column.value!(a), column.value!(b)) * factor);
  }, [rows, sort, columns]);

  const cellPad = dense ? "px-3 py-2.5" : "px-4 py-4";
  const bodyText = dense ? "text-[12.5px]" : "text-sm";

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={`w-full ${minWidthClass} ${bodyText}`}>
        <thead className="bg-muted/35 text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => {
              const sortable = !!column.value;
              const active = sort?.key === column.key;
              const dir = active ? sort!.dir : null;
              return (
                <th
                  key={column.key}
                  aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                  onClick={
                    sortable
                      ? () =>
                          setSort((prev) =>
                            prev && prev.key === column.key
                              ? { key: column.key, dir: prev.dir === "asc" ? "desc" : "asc" }
                              : { key: column.key, dir: "asc" },
                          )
                      : undefined
                  }
                  className={`${dense ? "px-3 py-2.5" : "px-4 py-3"} text-left font-medium select-none ${
                    sortable ? "cursor-pointer transition-colors hover:text-foreground" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {sortable &&
                      (dir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : dir === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      ))}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row, i) => (
            <tr key={i}>
              {columns.map((column) => (
                <td key={column.key} className={`${cellPad} ${column.cellClassName ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  start,
  end,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const go = (p: number) => onChange(Math.max(1, Math.min(totalPages, p)));
  const showEdges = totalPages > 7;
  const windowSize = 5;
  let from = Math.max(1, page - Math.floor(windowSize / 2));
  let to = Math.min(totalPages, from + windowSize - 1);
  from = Math.max(1, Math.min(from, to - windowSize + 1));
  const pages: number[] = [];
  for (let i = from; i <= to; i++) pages.push(i);

  const btnBase =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-xs font-medium cursor-pointer transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}</span> a{" "}
        <span className="font-medium text-foreground">{end}</span> de{" "}
        <span className="font-medium text-foreground">{total}</span> clientes
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {showEdges && (
          <button
            type="button"
            className={btnBase}
            onClick={() => go(1)}
            disabled={page === 1}
            aria-label="Primeira página"
          >
            «
          </button>
        )}
        <button
          type="button"
          className={btnBase}
          onClick={() => go(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              btnBase,
              p === page && "border-primary bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className={btnBase}
          onClick={() => go(page + 1)}
          disabled={page === totalPages}
          aria-label="Próxima página"
        >
          ›
        </button>
        {showEdges && (
          <button
            type="button"
            className={btnBase}
            onClick={() => go(totalPages)}
            disabled={page === totalPages}
            aria-label="Última página"
          >
            »
          </button>
        )}
      </div>
    </div>
  );
}
