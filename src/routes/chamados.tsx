import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  saveChamadosSnapshot,
  readChamadosSnapshot,
  clearChamadosSnapshot,
} from "@/lib/return-to-ticket";
import { setChamadosFiltersCache } from "@/lib/return-to-ticket";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Clock3,
  Filter,
  FolderKanban,
  Headphones,
  History,
  Layers,
  LockKeyhole,
  MessageSquarePlus,
  MoreVertical,
  PhoneCall,
  Search,
  SlidersHorizontal,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppShell } from "@/components/portal/AppShell";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  dailyTicketAnalytics,
  ticketStatuses,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support-tickets-data";

const ticketPriorities: TicketPriority[] = ["Alta", "Media", "Baixa"];
import { useOperatorAcronyms } from "@/lib/collaborators-store";
import { useTickets, useTicketHistory, ticketsStore } from "@/lib/tickets-store";
import { FileText } from "lucide-react";
import { getModuleIcon } from "@/lib/ticket-icons";
import { ModuleKnowledgeLink } from "@/lib/module-link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TicketDetailSheet } from "@/components/tickets/TicketDetailSheet";
import { TicketHistoryModal } from "@/components/tickets/TicketHistoryModal";

import {
  currentMonthKey,
  isMonthKey,
  isTicketMonthView,
  monthRange,
  ticketMatchesMonthView,
} from "@/lib/tickets-month";
import { z } from "zod";

const chamadosSearchSchema = z.object({
  status: z.string().catch("").optional(),
  today: z.coerce.number().catch(0).optional(),
  ticket: z.string().catch("").optional(),
  mes: z.string().catch("").optional(),
  prioridade: z.string().catch("").optional(),
  visao: z.string().catch("").optional(),
  busca: z.string().catch("").optional(),
});


export const Route = createFileRoute("/chamados")({
  head: () => ({
    meta: [
      { title: "Chamados — CRM Prócion" },
      {
        name: "description",
        content:
          "CRM de suporte da Prócion com chamados, filtros operacionais e analytics de atendimento.",
      },
    ],
  }),
  validateSearch: chamadosSearchSchema,
  component: ChamadosRouteShell,
});


// Soft/translucent status badges. Green reserved for Finalizado only.
const statusTone: Record<TicketStatus, string> = {
  Atrasado: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  "Em Aberto": "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  Ocupado: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  "Em andamento": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  "Aguardando cliente": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  "Com especialista": "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  Agendamento: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  Finalizado: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  Cancelado: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
};

// Colored dot inside the status badge.
const statusDotTone: Record<TicketStatus, string> = {
  Atrasado: "bg-red-500",
  "Em Aberto": "bg-rose-500",
  Ocupado: "bg-amber-500",
  "Em andamento": "bg-blue-500",
  "Aguardando cliente": "bg-emerald-500",
  "Com especialista": "bg-rose-500",
  Agendamento: "bg-orange-500",
  Finalizado: "bg-emerald-500",
  Cancelado: "bg-slate-400",
};

// Left border stripe color per status (matches badge).
const statusBorderTone: Record<TicketStatus, string> = {
  Atrasado: "border-l-red-500",
  "Em Aberto": "border-l-rose-500",
  Ocupado: "border-l-amber-500",
  "Em andamento": "border-l-blue-500",
  "Aguardando cliente": "border-l-emerald-500",
  "Com especialista": "border-l-rose-500",
  Agendamento: "border-l-orange-500",
  Finalizado: "border-l-emerald-500",
  Cancelado: "border-l-slate-400 dark:border-l-slate-500",
};

// Soft/translucent priority badges. Baixa uses slate — NOT green.
const priorityTone: Record<TicketPriority, string> = {
  Alta: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  Media: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  Baixa: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
};

const statusRowTint: Record<TicketStatus, string> = {
  Atrasado: "bg-rose-50/85 hover:bg-rose-100/90 dark:bg-rose-500/[0.12] dark:hover:bg-rose-500/[0.18]",
  "Em Aberto": "bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-500/[0.10] dark:hover:bg-rose-500/[0.16]",
  Ocupado: "bg-orange-50/80 hover:bg-orange-100/90 dark:bg-orange-500/[0.12] dark:hover:bg-orange-500/[0.18]",
  "Em andamento": "bg-sky-50/85 hover:bg-sky-100/90 dark:bg-sky-500/[0.12] dark:hover:bg-sky-500/[0.18]",
  "Aguardando cliente": "bg-emerald-50/85 hover:bg-emerald-100/90 dark:bg-emerald-500/[0.12] dark:hover:bg-emerald-500/[0.18]",
  "Com especialista": "bg-rose-50/75 hover:bg-rose-100/85 dark:bg-rose-500/[0.11] dark:hover:bg-rose-500/[0.17]",
  Agendamento: "bg-amber-50/85 hover:bg-amber-100/90 dark:bg-amber-500/[0.12] dark:hover:bg-amber-500/[0.18]",
  Finalizado: "bg-emerald-50/85 hover:bg-emerald-100/90 dark:bg-emerald-500/[0.12] dark:hover:bg-emerald-500/[0.18]",
  Cancelado: "bg-slate-50 hover:bg-slate-100 dark:bg-slate-500/[0.08] dark:hover:bg-slate-500/[0.13]",
};

const priorityTint: Record<TicketPriority, string> = {
  Alta: "bg-rose-100/80 dark:bg-rose-500/[0.14]",
  Media: "bg-amber-100/80 dark:bg-amber-500/[0.14]",
  Baixa: "bg-slate-100/70 dark:bg-slate-500/[0.10]",
};

// Green row tint reserved for finalized/resolved status.
const finalizedRowTint =
  "bg-emerald-100/70 hover:bg-emerald-200/70 dark:bg-emerald-500/[0.12] dark:hover:bg-emerald-500/[0.18]";

function rowTintFor(ticket: SupportTicket) {
  return statusRowTint[ticket.status];
}

const chartConfig = {
  opened: { label: "Abertos", color: "var(--color-primary)" },
  finished: { label: "Finalizados", color: "var(--color-success)" },
  overdue: { label: "Atrasados", color: "var(--color-destructive)" },
  backlog: { label: "Backlog", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const sourceLabels = {
  Telefone: "Telefone",
  "Portal do cliente": "Portal",
  WhatsApp: "WhatsApp",
  Email: "Email",
};

type Filters = {
  status: string;
  priority: string;
  query: string;
  sigla: string;
  operatorType: "Todos" | "Atendente" | "Responsável";
  operator: string;
  dateType: "Registro" | "Atualizado";
  dateStart?: Date;
  dateEnd?: Date;
};

const initialFilters: Filters = {
  status: "Todos",
  priority: "Todas",
  query: "",
  sigla: "",
  operatorType: "Todos",
  operator: "Todos",
  dateType: "Registro",
  dateStart: new Date(new Date().setHours(0, 0, 0, 0)),
  dateEnd: new Date(new Date().setHours(23, 59, 59, 999)),
};

function monthFilters(monthKey: string): Filters {
  const { start, end } = monthRange(monthKey);
  return { ...initialFilters, dateStart: start, dateEnd: end };
}

function normalizeFilterText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function DateRangeFilter({
  start,
  end,
  onChange,
}: {
  start?: Date;
  end?: Date;
  onChange: (range: { start?: Date; end?: Date }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    start || end ? { from: start, to: end } : undefined,
  );

  useEffect(() => {
    setDraft(start || end ? { from: start, to: end } : undefined);
  }, [start, end]);

  const label = (() => {
    if (start && end) {
      return `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`;
    }
    if (start) return `A partir de ${format(start, "dd/MM/yyyy")}`;
    if (end) return `Até ${format(end, "dd/MM/yyyy")}`;
    return "dd/mm/aaaa - dd/mm/aaaa";
  })();

  const apply = () => {
    let from = draft?.from;
    let to = draft?.to;
    if (from && to && from > to) [from, to] = [to, from];
    onChange({ start: from, end: to });
    setOpen(false);
  };

  const clear = () => {
    setDraft(undefined);
    onChange({ start: undefined, end: undefined });
    setOpen(false);
  };

  const isPlaceholder = !start && !end;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-[220px] shrink-0 cursor-pointer items-center gap-2 truncate rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none transition focus:ring-2 focus:ring-ring",
            isPlaceholder && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={draft}
          onSelect={(range) => {
            setDraft(range);
            let from = range?.from;
            let to = range?.to;
            if (from && to && from > to) [from, to] = [to, from];
            onChange({ start: from, end: to });
          }}
          locale={ptBR}
          initialFocus
          className={cn("pointer-events-auto p-3")}
        />
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={clear}
          >
            Limpar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={apply}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}



function countAdvancedActive(f: Filters): number {
  let n = 0;
  if (f.status !== "Todos") n += 1;
  if (f.priority !== "Todas") n += 1;
  if (f.operatorType !== "Todos") n += 1;
  if (f.dateType !== "Registro") n += 1;
  if (f.dateStart || f.dateEnd) n += 1;
  return n;
}

function hasAnyActive(f: Filters): boolean {
  return (
    countAdvancedActive(f) > 0 ||
    f.query.trim() !== "" ||
    f.sigla.trim() !== "" ||
    f.operator !== "Todos"
  );
}

function QuickFiltersBar({
  filters,
  setFilters,
  tickets,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  tickets: SupportTicket[];
}) {
  const ticketOperators = useOperatorAcronyms();
  const [queryDraft, setQueryDraft] = useState(filters.query);

  // Debounce: apply query typing after 250ms of inactivity.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((p) => (p.query === queryDraft ? p : { ...p, query: queryDraft }));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [queryDraft, setFilters]);

  // Keep local input in sync when external clears/resets occur.
  useEffect(() => {
    if (filters.query !== queryDraft) setQueryDraft(filters.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query]);

  const siglas = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => t.clientCode && set.add(t.clientCode.toUpperCase()));
    return Array.from(set).sort();
  }, [tickets]);

  const anyActive = hasAnyActive(filters);

  const clearAll = () => {
    setQueryDraft("");
    setFilters({
      ...initialFilters,
      dateStart: undefined,
      dateEnd: undefined,
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
      {/* Pesquisa avançada — um pouco maior */}
      <div className="relative min-w-[180px] flex-[2] lg:flex-[2]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          type="search"
          placeholder="Pesquisa avançada"
          title="Buscar por protocolo, cliente, contato, assunto ou módulo"
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Sigla */}
      <div className="min-w-[90px] flex-1">
        <input
          list="quick-siglas"
          value={filters.sigla}
          onChange={(e) =>
            setFilters((p) => ({ ...p, sigla: e.target.value.toUpperCase() }))
          }
          type="text"
          placeholder="Sigla"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
        />
        <datalist id="quick-siglas">
          {siglas.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {/* Operador */}
      <div className="min-w-[110px] flex-1">
        <input
          list="quick-operators"
          value={filters.operator === "Todos" ? "" : filters.operator}
          onChange={(e) => {
            const v = e.target.value.trim();
            setFilters((p) => ({ ...p, operator: v === "" ? "Todos" : v.toUpperCase() }));
          }}
          type="text"
          placeholder="Operador"
          className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
        />
        <datalist id="quick-operators">
          {ticketOperators.map((op) => (
            <option key={op} value={op} />
          ))}
        </datalist>
      </div>




      {/* Período */}
      <div className="min-w-[180px] flex-[1.4]">
        <DateRangeFilter
          start={filters.dateStart}
          end={filters.dateEnd}
          onChange={(range) =>
            setFilters((p) => ({ ...p, dateStart: range.start, dateEnd: range.end }))
          }
        />
      </div>


      {/* Limpar */}
      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="h-9 shrink-0 cursor-pointer rounded-lg px-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}



function ChamadosRouteShell() {

  const location = useLocation();
  if (location.pathname !== "/chamados") {
    return <Outlet />;
  }

  return <TicketsPage />;
}

function TicketsPage() {
  const ticketOperators = useOperatorAcronyms();
  const search = Route.useSearch();
  const supportTickets = useTickets();
  const initialMonthKey = isMonthKey(search.mes) ? search.mes : currentMonthKey();
  const [filters, setFilters] = useState<Filters>(() => {
    const snapshot = search.ticket ? readChamadosSnapshot() : null;
    if (snapshot && snapshot.ticketId === search.ticket && snapshot.filters) {
      try {
        const raw = snapshot.filters as Record<string, unknown>;
        const rehydrated: Filters = {
          ...monthFilters(initialMonthKey),
          ...(raw as Partial<Filters>),
          dateStart:
            typeof raw.dateStart === "string" ? new Date(raw.dateStart) : undefined,
          dateEnd:
            typeof raw.dateEnd === "string" ? new Date(raw.dateEnd) : undefined,
        };
        return rehydrated;
      } catch {
        // fallback below
      }
    }
    const base = search.mes || search.status || search.prioridade || search.busca
      ? monthFilters(initialMonthKey)
      : { ...initialFilters };
    if (search.status) base.status = search.status;
    if (search.prioridade) base.priority = search.prioridade;
    if (search.busca) base.query = search.busca;
    return base;
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyTicketId, setHistoryTicketId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Reabre o chamado a partir do parâmetro ?ticket= e limpa o parâmetro após uso.
  const navigateHere = useNavigate({ from: Route.fullPath });
  useEffect(() => {
    if (!search.ticket) return;
    const target = supportTickets.find((t) => t.id === search.ticket);
    if (!target) return;
    setSelectedTicketId(target.id);
    setDetailOpen(true);
    const snapshot = readChamadosSnapshot();
    if (snapshot && snapshot.ticketId === search.ticket && typeof snapshot.scrollY === "number") {
      const y = snapshot.scrollY;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
    }
    clearChamadosSnapshot();
    navigateHere({
      search: {
        status: search.status,
        mes: search.mes,
        prioridade: search.prioridade,
        visao: search.visao,
        busca: search.busca,
      },
      replace: true,
    });
  }, [
    search.ticket,
    supportTickets,
    navigateHere,
    search.status,
    search.mes,
    search.prioridade,
    search.visao,
    search.busca,
  ]);


  const openTicketDetail = (ticket: SupportTicket) => {
    setSelectedTicketId(ticket.id);
    setDetailOpen(true);
  };

  const openTicketHistory = (ticket: SupportTicket) => {
    setHistoryTicketId(ticket.id);
    setHistoryOpen(true);
  };

  // Mantém o cache dos filtros para que qualquer link (módulo / cliente) possa
  // criar uma snapshot ao sair da tela, sem precisar de props extras.
  useEffect(() => {
    const serializable = {
      ...filters,
      dateStart: filters.dateStart ? filters.dateStart.toISOString() : undefined,
      dateEnd: filters.dateEnd ? filters.dateEnd.toISOString() : undefined,
    };
    setChamadosFiltersCache(serializable);
  }, [filters]);




  const monthView = isTicketMonthView(search.visao) ? search.visao : null;

  const filteredTickets = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const sigla = filters.sigla.trim().toLowerCase();
    return supportTickets.filter((ticket) => {
      if (
        monthView &&
        !ticketMatchesMonthView(ticket, initialMonthKey, monthView)
      ) {
        return false;
      }
      if (filters.status !== "Todos" && ticket.status !== filters.status) return false;
      if (filters.priority !== "Todas" && ticket.priority !== filters.priority) return false;
      if (sigla && !ticket.clientCode.toLowerCase().includes(sigla)) return false;
      if (filters.operator !== "Todos") {
        const op = normalizeFilterText(filters.operator);
        const operatorType = normalizeFilterText(filters.operatorType);
        const attendant = normalizeFilterText(ticket.attendant);
        const owner = normalizeFilterText(ticket.owner);
        if (operatorType === "atendente" && attendant !== op) return false;
        if (operatorType.startsWith("respons") && owner !== op) return false;
        if (operatorType === "todos" && attendant !== op && owner !== op) return false;
      }
      if (!monthView && (filters.dateStart || filters.dateEnd)) {
        const raw = filters.dateType === "Registro" ? ticket.openedAt : ticket.updatedAt;
        const d = new Date(raw);
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
      if (!query) return true;
      return [
        ticket.protocol,
        ticket.clientCode,
        ticket.clientName,
        ticket.contact,
        ticket.subject,
        ticket.module,
        ticket.owner,
        ticket.attendant,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filters, supportTickets, monthView, initialMonthKey]);




  const advancedActiveCount = countAdvancedActive(filters);

  return (
    <AppShell>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: "Chamados" }]} />
          <h1 className="text-lg font-medium tracking-tight text-foreground">Chamados</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            CRM de suporte para acompanhar abertura, atendimento, atrasos e produtividade dos chamados.
          </p>
        </div>

        <div className="flex w-[160px] shrink-0 flex-col items-stretch gap-1.5">
          <Button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative h-9 w-full cursor-pointer justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-md hover:bg-blue-700"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {advancedActiveCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/95 px-1.5 text-[11px] font-semibold text-blue-700">
                {advancedActiveCount}
              </span>
            )}
          </Button>

          <Link
            to="/chamados/novo"
            search={() => ({ cliente: undefined, empresa: undefined })}
            aria-label="Novo chamado"
            className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Novo chamado
          </Link>

          <Badge variant="secondary" className="self-center rounded-full">
            CRM lado suporte
          </Badge>
        </div>
      </div>






      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle className="text-lg font-semibold">Filtros de chamados</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Busca
                </p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={filters.query}
                    onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
                    type="search"
                    placeholder="Cliente, protocolo ou assunto"
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Sigla do cliente
                </p>
                <input
                  value={filters.sigla}
                  onChange={(e) => setFilters((p) => ({ ...p, sigla: e.target.value.toUpperCase() }))}
                  type="text"
                  placeholder="Ex.: MIT"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["Todos", ...ticketStatuses] as string[]).map((status) => {
                    const active = filters.status === status;
                    return (
                      <label
                        key={status}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                          active
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name="filter-status"
                          className="h-4 w-4 cursor-pointer accent-primary"
                          checked={active}
                          onChange={() => setFilters((p) => ({ ...p, status }))}
                        />
                        <span className="truncate">{status}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Prioridade
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["Todas", ...ticketPriorities] as string[]).map((priority) => {
                    const active = filters.priority === priority;
                    return (
                      <label
                        key={priority}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                          active
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name="filter-priority"
                          className="h-4 w-4 cursor-pointer accent-primary"
                          checked={active}
                          onChange={() => setFilters((p) => ({ ...p, priority }))}
                        />
                        <span>{priority}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo operador
                  </p>
                  <select
                    value={filters.operatorType}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, operatorType: e.target.value as Filters["operatorType"] }))
                    }
                    className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Atendente">Atendente</option>
                    <option value="Responsável">Responsável</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Operador
                  </p>
                  <select
                    value={filters.operator}
                    onChange={(e) => setFilters((p) => ({ ...p, operator: e.target.value }))}
                    className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Todos">Todos</option>
                    {ticketOperators.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tipo data
                </p>
                <select
                  value={filters.dateType}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, dateType: e.target.value as Filters["dateType"] }))
                  }
                  className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Registro">Registro</option>
                  <option value="Atualizado">Atualizado</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Período
                </p>
                <DateRangeFilter
                  start={filters.dateStart}
                  end={filters.dateEnd}
                  onChange={(range) =>
                    setFilters((p) => ({ ...p, dateStart: range.start, dateEnd: range.end }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="h-10 cursor-pointer rounded-lg text-sm"
              onClick={() => setFilters({ ...initialFilters, dateStart: undefined, dateEnd: undefined })}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Limpar
            </Button>
            <Button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="h-10 cursor-pointer rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Aplicar filtros
            </Button>
          </div>
        </SheetContent>
      </Sheet>




      <div className="mb-3 flex flex-wrap items-center gap-3 xl:flex-nowrap">
        <div className="min-w-0 shrink-0">
          <p className="text-base font-bold text-foreground">Fila de suporte</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filteredTickets.length} chamado(s) exibidos com os filtros atuais.
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="relative min-w-[180px] flex-[2]">
            <span className="sr-only">Pesquisa avancada</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Pesquisa avancada"
              className="h-9 w-full min-w-0 rounded-lg border border-border bg-background pl-9 pr-3 text-[13px] outline-none transition focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="min-w-[100px] flex-1">
            <span className="sr-only">Sigla do cliente</span>
            <input
              type="text"
              value={filters.sigla}
              onChange={(event) =>
                setFilters((current) => ({ ...current, sigla: event.target.value.toUpperCase() }))
              }
              placeholder="SIGLA"
              className="h-9 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-[13px] uppercase outline-none transition focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="min-w-[130px] flex-1">
            <span className="sr-only">Status do chamado</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className={cn(
                "h-9 w-full min-w-0 cursor-pointer rounded-lg border border-border bg-background px-3 text-[13px] outline-none transition focus:ring-2 focus:ring-ring",
                filters.status === "Todos" && "text-muted-foreground",
              )}
            >
              <option value="Todos">STATUS</option>
              {ticketStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[130px] flex-1">
            <span className="sr-only">Operador</span>
            <select
              value={filters.operator}
              onChange={(event) => setFilters((current) => ({ ...current, operator: event.target.value }))}
              className={cn(
                "h-9 w-full min-w-0 cursor-pointer rounded-lg border border-border bg-background px-3 text-[13px] outline-none transition focus:ring-2 focus:ring-ring",
                filters.operator === "Todos" && "text-muted-foreground",
              )}
            >
              <option value="Todos">OPERADOR</option>
              {ticketOperators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </label>




          <div className="min-w-[200px] flex-[1.4]">
            <DateRangeFilter
              start={filters.dateStart}
              end={filters.dateEnd}
              onChange={(range) =>
                setFilters((current) => ({
                  ...current,
                  dateStart: range.start,
                  dateEnd: range.end,
                }))
              }
            />
          </div>


        </div>
      </div>

      <div className="min-h-[560px]">
        {filteredTickets.length === 0 ? (
          <div className="grid min-h-[560px] place-items-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <div>
              <p className="text-sm font-semibold text-foreground">Nenhum chamado encontrado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ajuste os filtros para exibir chamados nesta fila.
              </p>
            </div>
          </div>
        ) : (
          <TicketsListView
            tickets={filteredTickets}
            onOpen={openTicketDetail}
            onHistory={openTicketHistory}
          />
        )}
      </div>

      <TicketDetailSheet
        ticketId={selectedTicketId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <HistoryModalHost
        ticketId={historyTicketId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        tickets={supportTickets}
      />
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  trend: string;
  icon: typeof Headphones;
  tone: string;
}) {
  return (
    <Card className="rounded-[14px] border-0 bg-card p-5 shadow-[0_10px_28px_rgba(25,29,51,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
        </div>
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

const sourceIcons: Record<SupportTicket["source"], typeof PhoneCall> = {
  Telefone: PhoneCall,
  "Portal do cliente": MessageSquarePlus,
  WhatsApp: MessageSquarePlus,
  Email: MessageSquarePlus,
};


function TicketCard({
  ticket,
  onOpen,
  onHistory,
}: {
  ticket: SupportTicket;
  onOpen?: (ticket: SupportTicket) => void;
  onHistory?: (ticket: SupportTicket) => void;
}) {
  
  const SourceIcon = sourceIcons[ticket.source] ?? PhoneCall;

  const handleAssume = (e: React.MouseEvent) => {
    e.stopPropagation();
    ticketsStore.assumeTicket(ticket.id);
    toast.success(`Chamado ${ticket.protocol} assumido.`);
  };

  return (
    <Card className={cn("flex min-w-0 flex-col gap-4 rounded-[16px] border border-border/70 bg-card p-4 shadow-[0_10px_28px_rgba(25,29,51,0.05)] transition hover:shadow-[0_14px_32px_rgba(25,29,51,0.09)] sm:p-5", ticket.status === "Finalizado" ? finalizedRowTint : priorityTint[ticket.priority])}>
      {/* Top: icon + title + client / protocol + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {(() => {
            const ModuleIcon = getModuleIcon(ticket.module, ticket.source, ticket.subject);
            return (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <ModuleIcon className="h-5 w-5" />
              </div>
            );
          })()}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-snug text-foreground">
              {ticket.subject}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              <span className="font-semibold text-foreground">{ticket.clientCode || "—"}</span>
              {" · "}
              {ticket.clientName || "Cliente não vinculado"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[10.5px] font-medium text-muted-foreground">
            {ticket.protocol}
          </span>
          <Badge
            className={cn(
              "whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
              statusTone[ticket.status],
            )}
          >
            {ticket.status}
          </Badge>
        </div>
      </div>

      {/* Middle: info grid */}
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
        <InfoRow icon={UserRound} label="Contato" value={ticket.contact} />
        <InfoRow
          icon={Layers}
          label="Módulo"
          value={<ModuleKnowledgeLink module={ticket.module} />}
        />
        <InfoRow icon={Headphones} label="Atendente" value={ticket.attendant} />
        <InfoRow icon={UserPlus} label="Responsável" value={ticket.owner} />
        <InfoRow
          icon={CalendarClock}
          label="Registro"
          value={formatDateTime(ticket.openedAt)}
        />
        <InfoRow
          icon={Clock3}
          label="Atualizado"
          value={formatDateTime(ticket.updatedAt)}
        />
      </dl>


      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip className={priorityTone[ticket.priority]}>
          <AlertTriangle className="h-3 w-3" />
          {ticket.priority}
        </Chip>
        <Chip className="bg-primary/10 text-primary">
          <SourceIcon className="h-3 w-3" />
          {sourceLabels[ticket.source]}
        </Chip>
        <ModuleKnowledgeLink
          module={ticket.module}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <FolderKanban className="h-3 w-3" />
          {ticket.module}
        </ModuleKnowledgeLink>
        {ticket.lockedBy && (
          <Chip className="bg-warning/15 text-warning-foreground">
            <LockKeyhole className="h-3 w-3" />
            {ticket.lockedBy}
          </Chip>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <Button
          size="sm"
          onClick={() => onOpen?.(ticket)}
          className="h-8 cursor-pointer rounded-lg px-3 text-[12px] shadow-[0_6px_14px_rgba(11,151,196,0.18)]"
        >
          Abrir
          <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAssume}
            className="h-8 cursor-pointer rounded-lg px-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            Assumir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onHistory?.(ticket);
            }}
            className="h-8 cursor-pointer rounded-lg px-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <History className="mr-1 h-3.5 w-3.5" />
            Histórico
          </Button>
        </div>
      </div>
    </Card>
  );
}

type SortKey =
  | "status"
  | "priority"
  | "cliente"
  | "contato"
  | "assunto"
  | "modulo"
  | "atendente"
  | "responsavel"
  | "registro"
  | "atualizado";
type SortDir = "asc" | "desc";

const priorityOrder: Record<TicketPriority, number> = { Alta: 0, Media: 1, Baixa: 2 };
const statusOrder = Object.fromEntries(
  ticketStatuses.map((s, i) => [s, i]),
) as Record<TicketStatus, number>;

function compareTickets(a: SupportTicket, b: SupportTicket, key: SortKey): number {
  switch (key) {
    case "status":
      return statusOrder[a.status] - statusOrder[b.status];
    case "priority":
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    case "cliente":
      return (
        a.clientCode.localeCompare(b.clientCode) ||
        a.clientName.localeCompare(b.clientName)
      );
    case "contato":
      return a.contact.localeCompare(b.contact);
    case "assunto":
      return a.subject.localeCompare(b.subject);
    case "modulo":
      return a.module.localeCompare(b.module);
    case "atendente":
      return a.attendant.localeCompare(b.attendant);
    case "responsavel":
      return a.owner.localeCompare(b.owner);
    case "registro":
      return new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime();
    case "atualizado":
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  }
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Arrow = active ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "cursor-pointer select-none px-2 py-2.5 font-semibold transition hover:text-foreground",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Arrow
          className={cn(
            "h-3 w-3 transition-opacity",
            active ? "opacity-90 text-foreground" : "opacity-50",
          )}
        />
      </span>
    </th>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Arrow = active ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-left font-semibold transition hover:text-foreground"
    >
      {label}
      <Arrow
        className={cn(
          "h-3 w-3 transition-opacity",
          active ? "opacity-90 text-foreground" : "opacity-50",
        )}
      />
    </button>
  );
}




function pagesRange(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i += 1) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (current > 3) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function SortableGridHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Arrow = active ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className="flex min-w-0 cursor-pointer select-none items-center gap-1 text-left text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
    >
      <span className="truncate">{label}</span>
      <Arrow
        className={cn(
          "h-3 w-3 shrink-0 transition-opacity",
          active ? "opacity-90 text-foreground" : "opacity-50",
        )}
      />
    </button>
  );
}

function PagBtn({
  children,
  onClick,
  disabled,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md border px-2 text-[11.5px] font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:bg-muted",
        disabled && "cursor-not-allowed opacity-40 hover:bg-background",
      )}
    >
      {children}
    </button>
  );
}

function PaginationBar({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  start,
  end,
  total,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  start: number;
  end: number;
  total: number;
}) {
  const pages = pagesRange(page, totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-[12px] text-muted-foreground shadow-[0_6px_16px_rgba(25,29,51,0.04)]">
      <div>
        Mostrando <strong className="text-foreground">{start}</strong> a{" "}
        <strong className="text-foreground">{end}</strong> de{" "}
        <strong className="text-foreground">{total}</strong> chamados
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Itens por página</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 cursor-pointer rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:ring-2 focus:ring-ring"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <PagBtn
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            label="Primeira página"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </PagBtn>
          <PagBtn
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </PagBtn>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <PagBtn key={p} onClick={() => onPageChange(p)} active={p === page}>
                {p}
              </PagBtn>
            ),
          )}
          <PagBtn
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            label="Próxima página"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </PagBtn>
          <PagBtn
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            label="Última página"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </PagBtn>
        </div>
      </div>
    </div>
  );
}

function TicketsListView({
  tickets,
  onOpen,
  onHistory: _onHistory,
}: {
  tickets: SupportTicket[];
  onOpen: (ticket: SupportTicket) => void;
  onHistory: (ticket: SupportTicket) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "registro",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 when filters (i.e. ticket list) or page size change.
  useEffect(() => {
    setPage(1);
  }, [tickets, pageSize]);

  const sorted = useMemo(() => {
    const arr = [...tickets];
    arr.sort((a, b) => {
      const c = compareTickets(a, b, sort.key);
      return sort.dir === "asc" ? c : -c;
    });
    return arr;
  }, [tickets, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = sorted.slice(startIdx, startIdx + pageSize);
  const start = sorted.length === 0 ? 0 : startIdx + 1;
  const end = startIdx + pageItems.length;

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "registro" || key === "atualizado" ? "desc" : "asc" },
    );
  };

  return (
    <div className="space-y-3">
      {/* Desktop list */}
      <Card className="hidden rounded-2xl border border-border/60 bg-card p-3 shadow-[0_8px_22px_rgba(25,29,51,0.05)] lg:block">
        <div className="min-w-0">
          <div className="grid grid-cols-[160px_100px_minmax(0,1.2fr)_110px_minmax(0,1.55fr)_170px_100px_100px_24px] items-center gap-x-3 rounded-xl bg-muted/50 px-4 py-3">

            <SortableGridHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Prioridade" sortKey="priority" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Cliente" sortKey="cliente" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Contato" sortKey="contato" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Assunto" sortKey="assunto" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Atendente/Responsável" sortKey="atendente" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Registro" sortKey="registro" sort={sort} onSort={toggleSort} />
            <SortableGridHeader label="Atualizado" sortKey="atualizado" sort={sort} onSort={toggleSort} />
            <span aria-label="Abrir" />

          </div>


          <div className="my-2 divide-y divide-border/60">
            {pageItems.map((ticket) => {
              const ModuleIcon = getModuleIcon(ticket.module, ticket.source, ticket.subject);
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => onOpen(ticket)}
                  className="group relative grid min-h-[52px] w-full cursor-pointer grid-cols-[160px_100px_minmax(0,1.2fr)_110px_minmax(0,1.55fr)_170px_100px_100px_24px] items-center gap-x-3 bg-transparent px-4 py-2 text-left transition hover:bg-muted/30"
                >
                  <span
                    className={cn("pointer-events-none absolute bottom-1.5 left-0 top-1.5 w-1", statusDotTone[ticket.status])}
                    aria-hidden="true"
                  />

                  <div className="flex min-w-0 flex-col items-stretch gap-1 self-start pl-2 pt-1">
                    <Badge
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        statusTone[ticket.status],
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          statusDotTone[ticket.status],
                        )}
                      />
                      {ticket.status}
                    </Badge>
                    <span className="text-center font-mono text-[10px] leading-tight text-muted-foreground">
                      {ticket.protocol}
                    </span>
                  </div>


                  <div className="min-w-0 self-start pt-1">
                    <span
                      className={cn(
                        "inline-flex min-w-[86px] items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        priorityTone[ticket.priority],
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {ticket.priority}
                    </span>
                  </div>


                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] text-foreground">
                      {ticket.clientCode || "—"}
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {ticket.clientName || "Cliente não vinculado"}
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center">
                    <span className="truncate text-[12.5px] text-foreground">{ticket.contact}</span>
                  </div>

                  <div className="min-w-0 pr-3">
                    <div className="line-clamp-2 text-[13px] leading-snug text-foreground">
                      {ticket.subject}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground/80">
                      <ModuleIcon className="h-3 w-3 shrink-0 text-primary/70" />
                      <ModuleKnowledgeLink
                        module={ticket.module}
                        className="truncate"
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-[12.5px] text-foreground">
                        {ticket.attendant}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span className="truncate text-[11px] text-muted-foreground/80">
                        <span className="font-medium">Responsável:</span> {ticket.owner}
                      </span>


                    </div>
                  </div>



                  <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="whitespace-nowrap">{formatDateTime(ticket.openedAt)}</span>
                  </div>

                  <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="whitespace-nowrap">{formatDateTime(ticket.updatedAt)}</span>
                  </div>

                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      {/* Mobile stacked list */}
      <div className="space-y-2 lg:hidden">
        {pageItems.map((ticket) => (
          <Card
            key={ticket.id}
            onClick={() => onOpen(ticket)}
            className={cn(
              "cursor-pointer rounded-xl border border-border/60 border-l-[3px] bg-card p-3 shadow-[0_6px_16px_rgba(25,29,51,0.04)] transition hover:shadow-[0_10px_20px_rgba(25,29,51,0.08)]",
              ticket.status === "Finalizado" ? finalizedRowTint : priorityTint[ticket.priority],
              statusBorderTone[ticket.status],
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  statusTone[ticket.status],
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusDotTone[ticket.status])} />
                {ticket.status}
              </Badge>
              <span
                className={cn(
                  "inline-flex min-w-[80px] items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  priorityTone[ticket.priority],
                )}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {ticket.priority}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {ticket.protocol}
              </span>
            </div>
            <p className="mt-1.5 truncate text-[13px] font-semibold text-foreground">
              {ticket.subject}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{ticket.clientCode || "—"}</span> ·{" "}
              {ticket.clientName || "Cliente não vinculado"}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <div className="truncate">
                <span className="font-semibold text-foreground">Contato:</span> {ticket.contact}
              </div>
              <div className="truncate">
                <span className="font-semibold text-foreground">Atendente:</span>{" "}
                {ticket.attendant}
              </div>
              <div className="col-span-2 truncate">
                <span className="font-semibold text-foreground">Módulo:</span>{" "}
                <ModuleKnowledgeLink module={ticket.module} />
              </div>
              <div className="truncate">
                <span className="font-semibold text-foreground">Resp.:</span> {ticket.owner}
              </div>
              <div className="truncate">
                <span className="font-semibold text-foreground">Atual.:</span>{" "}
                {formatDateTime(ticket.updatedAt)}
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        start={start}
        end={end}
        total={sorted.length}
      />
    </div>
  );
}



function HistoryModalHost({
  ticketId,
  open,
  onOpenChange,
  tickets,
}: {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tickets: SupportTicket[];
}) {
  const historyItems = useTicketHistory(ticketId);
  const ticket = ticketId ? (tickets.find((t) => t.id === ticketId) ?? null) : null;
  return (
    <TicketHistoryModal
      open={open}
      onOpenChange={onOpenChange}
      ticket={ticket}
      historyItems={historyItems}
    />
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-[12px] font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}


