import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CalendarDays,
  Columns3,
  Eye,
  MapPinned,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  companyLeadsApi,
  type CompanyLead,
  type CompanyLeadFilters,
  type CompanyLeadDetails,
  type CompanyLeadSort,
  type CompanyLeadStage,
} from "@/lib/company-leads-api";
import { cn } from "@/lib/utils";

const initialFilters: CompanyLeadFilters = {
  city: "",
  state: "SP",
  openedWithinDays: 90,
  cnae: "",
  cnaeDescription: "",
  companyName: "",
  cnpj: "",
  companySize: "",
  taxRegime: "",
  registrationStatus: "",
  stage: "",
  minScore: "",
  openedFrom: "",
  openedTo: "",
  hasPhone: false,
  hasEmail: false,
  onlyMei: false,
  onlySimples: false,
};

const PAGE_SIZE = 50;
const COLUMNS_STORAGE_KEY = "procion:company-leads:columns";
const SEARCH_STORAGE_KEY = "procion:company-leads:search-state:v1";

type PersistedSearchState = {
  filters: CompanyLeadFilters;
  appliedFilters: CompanyLeadFilters;
  page: number;
  sort: CompanyLeadSort;
  direction: "asc" | "desc";
  hasSearched: boolean;
};

const stageLabels: Record<CompanyLeadStage, string> = {
  novo: "Novo",
  prospeccao: "Prospecção",
  relacionamento: "Relacionamento",
  proposta: "Proposta",
  negociacao: "Negociação",
  demonstracao: "Demonstração",
  negocio_fechado: "Negócio Fechado",
  sem_interesse: "Sem Interesse",
};

type ColumnKey =
  | "company"
  | "cnpj"
  | "opened_at"
  | "registration_status"
  | "city"
  | "address"
  | "cnae"
  | "cnae_description"
  | "company_size"
  | "legal_nature"
  | "phone"
  | "email"
  | "mei"
  | "simples"
  | "score"
  | "stage"
  | "source";

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  sort?: CompanyLeadSort;
  className?: string;
};

const columnDefinitions: ColumnDefinition[] = [
  { key: "company", label: "Empresa", sort: "company", className: "min-w-[220px] max-w-[280px]" },
  { key: "cnpj", label: "CNPJ", sort: "cnpj", className: "whitespace-nowrap" },
  {
    key: "opened_at",
    label: "Data de abertura",
    sort: "opened_at",
    className: "whitespace-nowrap",
  },
  {
    key: "registration_status",
    label: "Situação cadastral",
    sort: "registration_status",
    className: "whitespace-nowrap",
  },
  { key: "city", label: "Cidade/UF", sort: "city", className: "whitespace-nowrap" },
  { key: "address", label: "Endereço", className: "max-w-[200px]" },
  { key: "cnae", label: "CNAE", sort: "cnae", className: "whitespace-nowrap" },
  { key: "cnae_description", label: "Descrição do CNAE", className: "max-w-[220px]" },
  { key: "company_size", label: "Porte", sort: "company_size", className: "whitespace-nowrap" },
  { key: "legal_nature", label: "Natureza jurídica", className: "max-w-[180px]" },
  { key: "phone", label: "Telefone", sort: "phone", className: "whitespace-nowrap" },
  { key: "email", label: "E-mail", className: "max-w-[180px]" },
  { key: "mei", label: "MEI", className: "whitespace-nowrap" },
  { key: "simples", label: "Simples Nacional", className: "whitespace-nowrap" },
  { key: "score", label: "Score", sort: "score", className: "whitespace-nowrap" },
  { key: "stage", label: "Etapa", sort: "stage", className: "whitespace-nowrap" },
  { key: "source", label: "Fonte", className: "max-w-[160px]" },
];

const defaultColumns: ColumnKey[] = [
  "company",
  "cnpj",
  "opened_at",
  "city",
  "cnae",
  "company_size",
  "phone",
  "score",
  "stage",
];

const companySizeOptions = [
  { value: "Microempresa", label: "Microempresa" },
  { value: "Empresa de pequeno porte", label: "Empresa de pequeno porte" },
  { value: "Demais", label: "Demais portes (médio/grande)" },
];

const taxRegimeLabels: Record<string, string> = {
  "0": "Simples Nacional",
  "1": "Lucro Presumido",
  "2": "Lucro Real",
  "3": "MEI",
  "4": "Lucro Arbitrado",
  "5": "Imune ou Isenta",
};

const taxRegimeDisplayLabels: Record<string, string> = {
  "0": "Simples Nacional",
  "1": "Lucro Presumido",
  "2": "Lucro Real",
  "3": "MEI",
  "4": "Lucro Arbitrado",
  "5": "Imune ou Isenta",
};

const formatTaxRegime = (value: string | null, simples = false, mei = false) => {
  if (value && taxRegimeDisplayLabels[value]) return taxRegimeDisplayLabels[value];
  if (mei) return "MEI";
  if (simples) return "Simples Nacional";
  return "Não optante pelo Simples; Real ou Presumido não divulgado";
};

const registrationStatusOptions = ["ATIVA", "BAIXADA", "SUSPENSA", "INAPTA"];

const scoreTone = (score: number) =>
  score >= 10
    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
    : score >= 7
      ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
      : "bg-muted text-muted-foreground";

const formatCnpj = (value: string) =>
  value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

const formatPhone = (value: string | null) => {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return value;
};

const isLikelyPrimaryPartner = (qualification: string | null) =>
  /titular|sócio-administrador|administrador|presidente|diretor/i.test(qualification || "");

const formatDate = (value: string | null) => {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const formatCurrency = (value: number | null) =>
  value == null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const googleMapsAddressUrl = (
  lead: Pick<CompanyLead, "address" | "neighborhood" | "city" | "state" | "postal_code">,
) => {
  const address = [lead.address, lead.neighborhood, lead.city, lead.state, lead.postal_code]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

const openedLabels: Record<number, string> = {
  0: "Qualquer data",
  30: "Últimos 30 dias",
  90: "Últimos 90 dias",
  180: "Últimos 180 dias",
  365: "Último ano",
};

function loadColumns(): ColumnKey[] {
  if (typeof window === "undefined") return defaultColumns;
  try {
    const stored = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!stored) return defaultColumns;
    const parsed = JSON.parse(stored) as ColumnKey[];
    const valid = parsed.filter((key) => columnDefinitions.some((column) => column.key === key));
    return valid.length ? valid : defaultColumns;
  } catch {
    return defaultColumns;
  }
}

function loadSearchState(): PersistedSearchState {
  const fallback: PersistedSearchState = {
    filters: initialFilters,
    appliedFilters: initialFilters,
    page: 0,
    sort: "opened_at",
    direction: "desc",
    hasSearched: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(SEARCH_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<PersistedSearchState>;
    return {
      ...fallback,
      ...parsed,
      filters: { ...initialFilters, ...parsed.filters },
      appliedFilters: { ...initialFilters, ...parsed.appliedFilters },
    };
  } catch {
    return fallback;
  }
}

export function CompanyLeadsTab() {
  const [restoredSearch] = useState(loadSearchState);
  const restoredSearchStarted = useRef(false);
  const [filters, setFilters] = useState(restoredSearch.filters);
  const [appliedFilters, setAppliedFilters] = useState(restoredSearch.appliedFilters);
  const [leads, setLeads] = useState<CompanyLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(restoredSearch.hasSearched);
  const [total, setTotal] = useState(0);
  const [totalCapped, setTotalCapped] = useState(false);
  const [page, setPage] = useState(restoredSearch.page);
  const [sort, setSort] = useState<CompanyLeadSort>(restoredSearch.sort);
  const [direction, setDirection] = useState<"asc" | "desc">(restoredSearch.direction);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(defaultColumns);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CompanyLeadDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [enrichingContacts, setEnrichingContacts] = useState(false);

  useEffect(() => {
    setVisibleColumns(loadColumns());
  }, []);

  const persistColumns = (next: ColumnKey[]) => {
    setVisibleColumns(next);
    try {
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* preferência opcional */
    }
  };

  const runSearch = async (
    nextPage: number,
    nextFilters: CompanyLeadFilters,
    nextSort: CompanyLeadSort,
    nextDirection: "asc" | "desc",
  ) => {
    const hasDirectSearch = Boolean(nextFilters.companyName?.trim() || nextFilters.cnpj?.trim());
    if (!hasDirectSearch && (!nextFilters.city.trim() || nextFilters.state.trim().length !== 2)) {
      toast.error("Informe a cidade e uma UF válida.");
      return;
    }
    setSearching(true);
    setLoading(true);
    try {
      const result = await companyLeadsApi.list({
        filters: nextFilters,
        sort: nextSort,
        direction: nextDirection,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      });
      setLeads(result.leads);
      setTotal(result.total);
      setTotalCapped(result.totalCapped);
      setPage(nextPage);
      setAppliedFilters(nextFilters);
      setSort(nextSort);
      setDirection(nextDirection);
      setHasSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao procurar empresas.");
    } finally {
      setSearching(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (restoredSearchStarted.current) return;
    restoredSearchStarted.current = true;
    if (restoredSearch.hasSearched) {
      void runSearch(
        restoredSearch.page,
        restoredSearch.appliedFilters,
        restoredSearch.sort,
        restoredSearch.direction,
      );
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SEARCH_STORAGE_KEY,
        JSON.stringify({ filters, appliedFilters, page, sort, direction, hasSearched }),
      );
    } catch {
      /* armazenamento local indisponível */
    }
  }, [filters, appliedFilters, page, sort, direction, hasSearched]);

  const searchLeads = (nextPage = 0) => {
    const nextFilters =
      filters.companyName?.trim() || filters.cnpj?.trim()
        ? { ...filters, openedWithinDays: 0, openedFrom: "", openedTo: "" }
        : filters;
    if (nextFilters !== filters) setFilters(nextFilters);
    void runSearch(nextPage, nextFilters, sort, direction);
  };

  const clearSearchFilters = () => {
    const clearedFilters = {
      ...initialFilters,
      city: filters.city,
      state: filters.state,
    };
    setFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
    setLeads([]);
    setTotal(0);
    setTotalCapped(false);
    setPage(0);
    setSort("opened_at");
    setDirection("desc");
    setHasSearched(false);
    try {
      window.localStorage.removeItem(SEARCH_STORAGE_KEY);
    } catch {
      /* armazenamento local indisponível */
    }
  };

  const toggleSort = (column: CompanyLeadSort) => {
    if (!hasSearched) return;
    const nextDirection: "asc" | "desc" =
      sort === column
        ? direction === "asc"
          ? "desc"
          : "asc"
        : column === "company"
          ? "asc"
          : "desc";
    void runSearch(0, appliedFilters, column, nextDirection);
  };

  const removeFilter = (patch: Partial<CompanyLeadFilters>) => {
    const nextFilters = { ...appliedFilters, ...patch };
    setFilters((current) => ({ ...current, ...patch }));
    if (hasSearched) void runSearch(0, nextFilters, sort, direction);
    else setAppliedFilters(nextFilters);
  };

  const updateStage = async (lead: CompanyLead, stage: CompanyLeadStage) => {
    const previous = leads;
    setLeads((items) => items.map((item) => (item.id === lead.id ? { ...item, stage } : item)));
    try {
      await companyLeadsApi.updateStage(lead.id, stage);
    } catch (error) {
      setLeads(previous);
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o lead.");
    }
  };

  const openDetails = async (lead: CompanyLead) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setSelectedLead(null);
    try {
      setSelectedLead(await companyLeadsApi.details(lead.id));
    } catch (error) {
      setDetailsOpen(false);
      toast.error(
        error instanceof Error ? error.message : "Não foi possível carregar os detalhes.",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const enrichSelectedLead = async () => {
    if (!selectedLead || enrichingContacts) return;
    setEnrichingContacts(true);
    try {
      const result = await companyLeadsApi.enrichContacts(selectedLead.id);
      setSelectedLead(result.lead);
      const total = result.statistics.phones + result.statistics.emails;
      toast.success(
        result.cached
          ? "Os contatos desta empresa já foram verificados nas últimas 24 horas."
          : total
            ? `${total} contato(s) adicional(is) encontrado(s).`
            : "Busca concluída. Nenhum contato adicional foi encontrado.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível buscar contatos.");
    } finally {
      setEnrichingContacts(false);
    }
  };

  const inProgress = useMemo(
    () => leads.filter((lead) => !["novo", "sem_interesse"].includes(lead.stage)).length,
    [leads],
  );

  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string; clear: Partial<CompanyLeadFilters> }> = [];
    const source = appliedFilters;
    if (source.openedWithinDays)
      items.push({
        key: "openedWithinDays",
        label: `Abertura: ${openedLabels[source.openedWithinDays] ?? `${source.openedWithinDays} dias`}`,
        clear: { openedWithinDays: 0 },
      });
    if (source.openedFrom)
      items.push({
        key: "openedFrom",
        label: `Aberta a partir de ${formatDate(source.openedFrom)}`,
        clear: { openedFrom: "" },
      });
    if (source.openedTo)
      items.push({
        key: "openedTo",
        label: `Aberta até ${formatDate(source.openedTo)}`,
        clear: { openedTo: "" },
      });
    if (source.cnae)
      items.push({ key: "cnae", label: `CNAE: ${source.cnae}`, clear: { cnae: "" } });
    if (source.companyName)
      items.push({
        key: "companyName",
        label: `Nome: ${source.companyName}`,
        clear: { companyName: "" },
      });
    if (source.cnpj)
      items.push({ key: "cnpj", label: `CNPJ: ${source.cnpj}`, clear: { cnpj: "" } });
    if (source.cnaeDescription)
      items.push({
        key: "cnaeDescription",
        label: `Descrição do CNAE: ${source.cnaeDescription}`,
        clear: { cnaeDescription: "" },
      });
    if (source.companySize)
      items.push({
        key: "companySize",
        label: `Porte: ${companySizeOptions.find((option) => option.value === source.companySize)?.label ?? source.companySize}`,
        clear: { companySize: "" },
      });
    if (source.taxRegime)
      items.push({
        key: "taxRegime",
        label: `Regime: ${taxRegimeLabels[source.taxRegime] ?? source.taxRegime}`,
        clear: { taxRegime: "" },
      });
    if (source.registrationStatus)
      items.push({
        key: "registrationStatus",
        label: `Situação: ${source.registrationStatus}`,
        clear: { registrationStatus: "" },
      });
    if (source.stage)
      items.push({
        key: "stage",
        label: `Etapa: ${stageLabels[source.stage as CompanyLeadStage] ?? source.stage}`,
        clear: { stage: "" },
      });
    if (source.minScore)
      items.push({
        key: "minScore",
        label: `Score mínimo: ${source.minScore}`,
        clear: { minScore: "" },
      });
    if (source.hasPhone)
      items.push({ key: "hasPhone", label: "Com telefone", clear: { hasPhone: false } });
    if (source.hasEmail)
      items.push({ key: "hasEmail", label: "Com e-mail", clear: { hasEmail: false } });
    if (source.onlyMei)
      items.push({ key: "onlyMei", label: "Somente MEI", clear: { onlyMei: false } });
    if (source.onlySimples)
      items.push({
        key: "onlySimples",
        label: "Somente Simples Nacional",
        clear: { onlySimples: false },
      });
    return items;
  }, [appliedFilters]);

  const columns = useMemo(
    () => columnDefinitions.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns],
  );

  const cellTitle = (column: ColumnDefinition, lead: CompanyLead) => {
    switch (column.key) {
      case "company":
        return [lead.trade_name, lead.legal_name].filter(Boolean).join(" — ");
      case "address":
        return lead.address || undefined;
      case "cnae_description":
        return lead.cnae_description || undefined;
      case "legal_nature":
        return lead.legal_nature || undefined;
      case "email":
        return lead.email || undefined;
      case "source":
        return lead.source;
      default:
        return undefined;
    }
  };

  const renderCell = (column: ColumnDefinition, lead: CompanyLead) => {
    switch (column.key) {
      case "company":
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="truncate font-medium">{lead.trade_name || lead.legal_name}</div>
              {lead.is_client && (
                <Badge className="shrink-0 bg-sky-500/12 text-sky-700 dark:text-sky-300">
                  Cliente atual
                </Badge>
              )}
            </div>
            {lead.trade_name && (
              <div className="truncate text-xs text-muted-foreground">{lead.legal_name}</div>
            )}
            {lead.search_alias &&
              ![lead.trade_name, lead.legal_name]
                .filter(Boolean)
                .some((name) => lead.search_alias?.toLowerCase().includes(name!.toLowerCase())) && (
                <div className="truncate text-xs text-primary">Cadastro: {lead.search_alias}</div>
              )}
          </>
        );
      case "cnpj":
        return <span className="whitespace-nowrap">{formatCnpj(lead.cnpj)}</span>;
      case "opened_at":
        return (
          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {formatDate(lead.opened_at)}
          </div>
        );
      case "registration_status":
        return (
          <span className="whitespace-nowrap text-emerald-600">{lead.registration_status}</span>
        );
      case "city":
        return (
          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {lead.city} - {lead.state}
          </div>
        );
      case "address":
        return <div className="truncate text-xs text-muted-foreground">{lead.address || "—"}</div>;
      case "cnae":
        return <span className="whitespace-nowrap">{lead.cnae_code || "—"}</span>;
      case "cnae_description": {
        const secondaryMatch = lead.matched_cnaes?.find((item) => item.code !== lead.cnae_code);
        return (
          <div className="space-y-0.5 text-xs">
            <div className="truncate">{lead.cnae_description || "—"}</div>
            {secondaryMatch && (
              <div className="truncate text-primary">Secundário: {secondaryMatch.description}</div>
            )}
          </div>
        );
      }
      case "company_size":
        return <span className="whitespace-nowrap">{lead.company_size || "—"}</span>;
      case "legal_nature":
        return <div className="truncate text-xs">{lead.legal_nature || "—"}</div>;
      case "phone":
        return <span className="whitespace-nowrap">{formatPhone(lead.phone)}</span>;
      case "email":
        return <div className="truncate lowercase">{lead.email?.toLowerCase() || "—"}</div>;

      case "mei":
        return lead.mei ? (
          <Badge className="bg-primary/10 text-primary">MEI</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      case "simples":
        return lead.simples ? (
          <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">Sim</Badge>
        ) : (
          <span className="text-muted-foreground">Não</span>
        );
      case "score":
        return (
          <Badge className={cn("font-semibold", scoreTone(lead.relevance_score))}>
            {lead.relevance_score}
          </Badge>
        );
      case "stage":
        return (
          <Select
            value={lead.stage}
            onValueChange={(value) => void updateStage(lead, value as CompanyLeadStage)}
          >
            <SelectTrigger
              className="h-7 min-w-[132px] cursor-pointer px-2 text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent onClick={(event) => event.stopPropagation()}>
              {Object.entries(stageLabels).map(([value, label]) => (
                <SelectItem key={value} value={value} className="cursor-pointer text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "source":
        return <div className="truncate text-xs text-muted-foreground">{lead.source}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (searching) return;
          searchLeads(0);
        }}
      >
        <label className="min-w-[220px] flex-[1.4] space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Cidade</span>
          <Input
            value={filters.city}
            onChange={(event) => setFilters((value) => ({ ...value, city: event.target.value }))}
            placeholder="Ex.: São Carlos"
          />
        </label>
        <label className="w-[90px] space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">UF</span>
          <Input
            value={filters.state}
            maxLength={2}
            onChange={(event) =>
              setFilters((value) => ({ ...value, state: event.target.value.toUpperCase() }))
            }
            className="uppercase"
          />
        </label>
        <label className="min-w-[170px] flex-1 space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Abertura</span>
          <select
            value={filters.openedWithinDays}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                openedWithinDays: Number(event.target.value),
              }))
            }
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={0}>Qualquer data</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 180 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </label>
        <label className="min-w-[150px] flex-1 space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">CNAE</span>
          <Input
            value={filters.cnae}
            onChange={(event) => setFilters((value) => ({ ...value, cnae: event.target.value }))}
            placeholder="Código do CNAE"
          />
        </label>

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2"
              title="Filtros adicionais"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {chips.length > 0 && (
                <Badge className="ml-1 bg-primary/10 px-1.5 text-primary">{chips.length}</Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[min(760px,calc(100vh-32px))] max-w-2xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
              <DialogTitle>Filtros de prospecção</DialogTitle>
              <DialogDescription>
                Refine a consulta por cadastro, empresa, atividade e contato.
              </DialogDescription>
            </DialogHeader>
            <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Situação cadastral
                  </span>
                  <Select
                    value={filters.registrationStatus || "all"}
                    onValueChange={(registrationStatus) =>
                      setFilters((value) => ({
                        ...value,
                        registrationStatus: registrationStatus === "all" ? "" : registrationStatus,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {registrationStatusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filters.taxRegime && !["0", "3"].includes(filters.taxRegime) && (
                    <span className="block text-[11px] leading-4 text-muted-foreground">
                      Dados da publicação anual da Receita Federal, exercício 2022.
                    </span>
                  )}
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Porte</span>
                  <Select
                    value={filters.companySize || "all"}
                    onValueChange={(companySize) =>
                      setFilters((value) => ({
                        ...value,
                        companySize: companySize === "all" ? "" : companySize,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {companySizeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Regime tributário
                  </span>
                  <Select
                    value={filters.taxRegime || "all"}
                    onValueChange={(selectedTaxRegime) => {
                      const taxRegime = selectedTaxRegime === "all" ? "" : selectedTaxRegime;
                      setFilters((value) => ({
                        ...value,
                        taxRegime,
                        ...(taxRegime ? { openedWithinDays: 0, openedFrom: "", openedTo: "" } : {}),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(taxRegimeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Etapa do lead</span>
                  <Select
                    value={filters.stage || "all"}
                    onValueChange={(stage) =>
                      setFilters((value) => ({
                        ...value,
                        stage: stage === "all" ? "" : stage,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {Object.entries(stageLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">CNAE</span>
                  <Input
                    value={filters.cnae}
                    onChange={(event) =>
                      setFilters((value) => ({ ...value, cnae: event.target.value }))
                    }
                    placeholder="Código do CNAE"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Nome da empresa</span>
                  <Input
                    value={filters.companyName ?? ""}
                    onChange={(event) =>
                      setFilters((value) => ({ ...value, companyName: event.target.value }))
                    }
                    placeholder="Razão social ou nome fantasia"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">CNPJ</span>
                  <Input
                    inputMode="numeric"
                    value={filters.cnpj ?? ""}
                    onChange={(event) =>
                      setFilters((value) => ({ ...value, cnpj: event.target.value }))
                    }
                    placeholder="Digite o CNPJ completo ou parcial"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Descrição do CNAE
                  </span>
                  <Input
                    value={filters.cnaeDescription ?? ""}
                    onChange={(event) =>
                      setFilters((value) => ({ ...value, cnaeDescription: event.target.value }))
                    }
                    placeholder="Ex.: bovinos, comércio varejista"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Score mínimo</span>
                  <Input
                    type="number"
                    min={0}
                    value={filters.minScore}
                    onChange={(event) =>
                      setFilters((value) => ({ ...value, minScore: event.target.value }))
                    }
                    placeholder="Ex.: 8"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Aberta de</span>
                    <Input
                      type="date"
                      value={filters.openedFrom}
                      onChange={(event) =>
                        setFilters((value) => ({ ...value, openedFrom: event.target.value }))
                      }
                      className="cursor-pointer"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Aberta até</span>
                    <Input
                      type="date"
                      value={filters.openedTo}
                      onChange={(event) =>
                        setFilters((value) => ({ ...value, openedTo: event.target.value }))
                      }
                      className="cursor-pointer"
                    />
                  </label>
                </div>
                <Separator className="sm:col-span-2" />
                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                  {(
                    [
                      ["hasPhone", "Com telefone"],
                      ["hasEmail", "Com e-mail"],
                      ["onlyMei", "Somente MEI"],
                      ["onlySimples", "Somente Simples Nacional"],
                    ] as Array<[keyof CompanyLeadFilters, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(filters[key])}
                        onCheckedChange={(checked) =>
                          setFilters((value) => ({ ...value, [key]: checked === true }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-4">
              <Button
                type="button"
                variant="ghost"
                onClick={clearSearchFilters}
              >
                Limpar filtros
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setFiltersOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setFiltersOpen(false);
                    searchLeads(0);
                  }}
                >
                  Aplicar filtros
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 gap-2" title="Escolher colunas">
              <Columns3 className="h-4 w-4" />
              Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            avoidCollisions
            className="flex max-h-[calc(100vh-120px)] w-[min(260px,calc(100vw-32px))] flex-col p-0"
          >
            <div className="shrink-0 border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold">Colunas visíveis</p>
            </div>
            <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-1 p-3">
                {columnDefinitions.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={visibleColumns.includes(column.key)}
                      onCheckedChange={(checked) =>
                        persistColumns(
                          checked === true
                            ? columnDefinitions
                                .map((item) => item.key)
                                .filter((key) => visibleColumns.includes(key) || key === column.key)
                            : visibleColumns.filter((key) => key !== column.key),
                        )
                      }
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button type="submit" disabled={searching} title="Procurar empresas" className="h-9 gap-2">
          {searching ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Procurar empresas
        </Button>
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
            >
              {chip.label}
              <button
                type="button"
                title={`Remover filtro ${chip.label}`}
                onClick={() => removeFilter(chip.clear)}
                className="grid h-4 w-4 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-y border-border py-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <strong>{totalCapped ? "Mais de 5.000" : total.toLocaleString("pt-BR")}</strong> leads
          encontrados
        </span>
        <span className="inline-flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-600" />
          <strong>{inProgress}</strong> em andamento
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table
            className={cn(
              "w-full min-w-[980px] table-auto",
              columns.length > 10 ? "text-[11px]" : "text-xs",
            )}
          >
            <thead className="bg-muted/35 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-20 px-2.5 py-2">
                  <span className="sr-only">Ações</span>
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn("px-2.5 py-2 font-medium whitespace-nowrap", column.className)}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.sort as CompanyLeadSort)}
                        title={`Ordenar por ${column.label}`}
                        className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground"
                      >
                        {column.label}
                        {sort === column.sort ? (
                          direction === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading &&
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-primary/[0.03]">
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Ver detalhes da empresa"
                          onClick={() => void openDetails(lead)}
                          className="h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button asChild type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <a
                            href={googleMapsAddressUrl(lead)}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir endereço no Google Maps"
                            aria-label={`Abrir endereço de ${lead.trade_name || lead.legal_name} no Google Maps`}
                          >
                            <MapPinned className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        title={cellTitle(column, lead)}
                        className={cn("px-2.5 py-1.5 align-middle", column.className)}
                      >
                        {renderCell(column, lead)}
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && leads.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-6 py-14 text-center text-muted-foreground"
                  >
                    {hasSearched
                      ? "Nenhum lead encontrado com os filtros aplicados."
                      : "Informe cidade e UF para procurar novas empresas."}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-6 py-14 text-center text-muted-foreground"
                  >
                    <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando leads…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {total > 0 && (
        <ListPaginationFooter
          page={page}
          pageCount={Math.ceil(total / PAGE_SIZE)}
          pageSize={PAGE_SIZE}
          total={total}
          noun="leads"
          loading={searching}
          onPageChange={(nextPage) =>
            void runSearch(nextPage, appliedFilters, sort, direction)
          }
        />
      )}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 [&>button]:z-20">
          <DialogHeader className="relative z-10 shrink-0 border-b border-border bg-card px-6 py-5 pr-12">
            <DialogTitle>
              {selectedLead?.trade_name || selectedLead?.legal_name || "Detalhes do lead"}
            </DialogTitle>
            <DialogDescription>
              {selectedLead
                ? `${selectedLead.legal_name} · ${formatCnpj(selectedLead.cnpj)}`
                : "Carregando dados da Receita Federal..."}
            </DialogDescription>
          </DialogHeader>
          <div className="hide-scrollbar min-h-0 overflow-y-auto overscroll-contain">
            {detailsLoading ? (
              <div className="grid min-h-52 place-items-center text-muted-foreground">
                <LoaderCircle className="h-6 w-6 animate-spin" />
              </div>
            ) : selectedLead ? (
              <div className="space-y-6 px-6 py-6">
                {selectedLead.is_client && (
                  <Badge className="bg-sky-500/12 text-sky-700 dark:text-sky-300">
                    Cliente atual da Prócion CRM
                  </Badge>
                )}
                <section>
                  <h3 className="mb-3 text-sm font-semibold">Empresa</h3>
                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Razão social", selectedLead.legal_name || "Não informado"],
                      ["Nome fantasia", selectedLead.trade_name || "Não informado"],
                      ["Matriz/filial", selectedLead.branch_type || "Não informado"],
                      ["Porte", selectedLead.company_size || "Não informado"],
                      [
                        "Regime tributário",
                        formatTaxRegime(
                          selectedLead.tax_regime,
                          selectedLead.simples,
                          selectedLead.mei,
                        ),
                      ],
                      [
                        "Fonte do regime",
                        selectedLead.tax_regime || selectedLead.simples || selectedLead.mei
                          ? "Receita Federal"
                          : "Receita Federal - cadastro mensal",
                      ],
                      ...(selectedLead.tax_regime_year
                        ? [["Exercício fiscal", selectedLead.tax_regime_year]]
                        : []),
                      ["Capital social", formatCurrency(selectedLead.capital_social)],
                      ["Natureza jurídica", selectedLead.legal_nature || "Não informado"],
                      [
                        "Qualificação do responsável",
                        selectedLead.responsible_qualification || "Não informado",
                      ],
                      ["Situação especial", selectedLead.special_status || "Nenhuma"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-xs uppercase text-muted-foreground">{label}</div>
                        <div className="mt-1 text-sm">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <Separator />
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Localização e contato</h3>
                  </div>
                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="text-xs uppercase text-muted-foreground">Endereço</div>
                      <div className="mt-1 text-sm">{selectedLead.address || "Não informado"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Bairro</div>
                      <div className="mt-1 text-sm">
                        {selectedLead.neighborhood || "Não informado"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Cidade / UF</div>
                      <div className="mt-1 text-sm">
                        {selectedLead.city} - {selectedLead.state}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">CEP</div>
                      <div className="mt-1 text-sm">
                        {selectedLead.postal_code || "Não informado"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">
                        Telefone principal
                      </div>
                      <div className="mt-1 text-sm">
                        {formatPhone(selectedLead.phone) !== "—"
                          ? formatPhone(selectedLead.phone)
                          : "Não informado"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">
                        Telefone adicional
                      </div>
                      <div className="mt-1 text-sm">
                        {formatPhone(selectedLead.phone_secondary) !== "—"
                          ? formatPhone(selectedLead.phone_secondary)
                          : "Não informado"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">E-mail</div>
                      <div className="mt-1 break-all text-sm lowercase">
                        {selectedLead.email || "Não informado"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Site</div>
                      <div className="mt-1 text-sm">{selectedLead.website || "Não informado"}</div>
                    </div>
                  </div>
                </section>
                <Separator />
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Atividade</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={enrichingContacts}
                      onClick={() => void enrichSelectedLead()}
                    >
                      <RefreshCw className={cn("h-4 w-4", enrichingContacts && "animate-spin")} />
                      {enrichingContacts ? "Buscando..." : "Buscar novos contatos"}
                    </Button>
                  </div>
                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="text-xs uppercase text-muted-foreground">CNAE principal</div>
                      <div className="mt-1 text-sm">
                        {selectedLead.cnae_code || "Não informado"} ·{" "}
                        {selectedLead.cnae_description || "Sem descrição"}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs uppercase text-muted-foreground">
                        CNAEs secundários
                      </div>
                      <div className="mt-1 text-sm">
                        {selectedLead.secondary_cnaes?.join(", ") || "Nenhum informado"}
                      </div>
                    </div>
                  </div>
                </section>
                <Separator />
                <section>
                  <h3 className="mb-3 text-sm font-semibold">Simples Nacional e MEI</h3>
                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Simples</div>
                      <div className="mt-1 text-sm">
                        {selectedLead.simples ? "Optante" : "Não optante"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">
                        Opção pelo Simples
                      </div>
                      <div className="mt-1 text-sm">{formatDate(selectedLead.simple_opted_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">MEI</div>
                      <div className="mt-1 text-sm">
                        {selectedLead.mei ? "Optante" : "Não optante"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Opção pelo MEI</div>
                      <div className="mt-1 text-sm">{formatDate(selectedLead.mei_opted_at)}</div>
                    </div>
                  </div>
                </section>
                <Separator />
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Quadro societário ({selectedLead.partners.length})
                    </h3>
                  </div>
                  {selectedLead.partners.length ? (
                    <div className="divide-y divide-border rounded-md border border-border">
                      {selectedLead.partners.map((partner, index) => (
                        <div
                          key={partner.id}
                          className="grid gap-1 px-4 py-3 sm:grid-cols-[1.4fr_1fr_auto]"
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {partner.name}
                            {index === 0 && isLikelyPrimaryPartner(partner.qualification) && (
                              <Badge variant="secondary">Responsável provável</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {partner.qualification || partner.type}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Entrada: {formatDate(partner.joined_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum sócio informado na base importada.
                    </p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
