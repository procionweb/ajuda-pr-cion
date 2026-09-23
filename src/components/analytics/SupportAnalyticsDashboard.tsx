import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Flame,
  Hourglass,
  BellOff,
  X,
} from "lucide-react";
import { useTickets, useTicketsHydrationState } from "@/lib/tickets-store";
import { SLA_TARGET_HOURS } from "@/lib/ticket-sla";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type AnalyticsFilters,
  type AnalyticsTicket,
  dayKey,
  delta,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercentage,
  groupCount,
  inDateRange,
  localHour,
  matchesDimensions,
  mean,
  median,
  normalizeTicket,
  weekdayIndex,
} from "./analytics-data";

const COLORS = ["#078db8", "#22a572", "#ec8c24", "#d94c65", "#7762bd", "#63758a"];
const STATUS_COLORS: Record<string, string> = {
  Finalizado: "#1bb978",
  "Em Aberto": "#f13b58",
  Ocupado: "#f3a21d",
  "Em andamento": "#168fbe",
  "Com especialista": "#8d69c7",
  Atrasado: "#dd2345",
  "Aguardando cliente": "#f59e0b",
};
const DAY = 86_400_000;
const closedStatus = (t: AnalyticsTicket) => t.closedNow && t.status !== "Cancelado";
const yearMonth = (ms: number) => dayKey(ms).slice(0, 7);
const empty = (
  <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período</p>
);
const metricStyle: Record<string, { tag: string; band: string }> = {
  "Chamados abertos": { tag: "ABR", band: "bg-[#ffa320]" },
  "SLA cumprido": { tag: "SLA", band: "bg-[#ff4052]" },
  "Primeira resposta": { tag: "1ª", band: "bg-[#1996bb]" },
  "Tempo médio de resolução": { tag: "TMR", band: "bg-[#9168c9]" },
  Finalizados: { tag: "FIN", band: "bg-[#20b980]" },
  "Clientes afetados": { tag: "CLI", band: "bg-[#587bad]" },
};

function Panel({
  title,
  detail,
  children,
  className = "",
  action,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`min-w-0 rounded-[14px] border border-border/60 bg-white p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)] dark:bg-[#20263d] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  sub,
  change,
  featured = false,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  featured?: boolean;
}) {
  const style = metricStyle[label];
  if (featured && style)
    return (
      <div className="relative flex min-h-[148px] min-w-0 overflow-hidden rounded-[22px] bg-white shadow-[0_12px_30px_rgba(25,29,51,0.08)] dark:bg-[#20263d]">
        <div
          className={`relative flex w-[65px] shrink-0 items-center justify-center overflow-hidden ${style.band}`}
        >
          <span
            className="absolute -right-5 top-1/2 h-12 w-12 -translate-y-1/2 rotate-45 bg-black/10"
            aria-hidden="true"
          />
          <span className="relative text-sm font-extrabold text-white">{style.tag}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between px-5 py-4">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
            <p
              className="mt-2 truncate text-[23px] font-bold tabular-nums text-foreground"
              title={value}
            >
              {value}
            </p>
          </div>
          <div className="flex min-h-7 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {change !== undefined && change !== null && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${change > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
              >
                {change > 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {formatPercentage(Math.abs(change))}
              </span>
            )}
            <span className="min-w-0 leading-tight">{sub}</span>
          </div>
        </div>
      </div>
    );
  return (
    <div className="min-w-0 rounded-[12px] border border-border/60 bg-white p-4 shadow-[0_8px_20px_rgba(25,29,51,0.05)] dark:bg-[#20263d]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <div className="mt-1 flex min-h-5 items-center gap-1 text-xs text-muted-foreground">
        {change !== undefined && change !== null && (
          <span
            className={`inline-flex items-center font-medium ${change > 0 ? "text-rose-600" : "text-emerald-600"}`}
          >
            {change > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatPercentage(Math.abs(change))}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}
function AlertTag({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[12px] border border-border/60 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(25,29,51,0.05)] dark:bg-[#20263d]">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground" title={label}>
          {label}
        </p>
        <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
          {formatNumber(value)}
        </p>
      </div>
    </div>
  );
}
type OperatorSummary = {
  name: string;
  count: number;
  done: number;
  active: number;
  rate: number | null;
  resolution: number | null;
};
function OperatorRow({ operator, onSelect }: { operator: OperatorSummary; onSelect: () => void }) {
  return (
    <div className="grid grid-cols-[minmax(120px,1.5fr)_repeat(3,minmax(55px,0.65fr))] items-center gap-3 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[minmax(140px,1.5fr)_repeat(4,minmax(60px,0.65fr))]">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e5f5fb] text-sm font-bold text-[#008eb8]">
          {operator.name.charAt(0).toUpperCase()}
        </span>
        <span
          className="truncate text-sm font-semibold text-foreground hover:text-primary"
          title={operator.name}
        >
          {operator.name}
        </span>
      </button>
      <div className="text-center">
        <span className="block text-[10px] text-muted-foreground">Recebidos</span>
        <strong className="text-sm tabular-nums">{formatNumber(operator.count)}</strong>
      </div>
      <div className="text-center">
        <span className="block text-[10px] text-muted-foreground">Finalizados</span>
        <strong className="text-sm tabular-nums text-emerald-600">
          {formatNumber(operator.done)}
        </strong>
      </div>
      <div className="text-center">
        <span className="block text-[10px] text-muted-foreground">Abertos</span>
        <strong className="text-sm tabular-nums text-amber-600">
          {formatNumber(operator.active)}
        </strong>
      </div>
      <div className="hidden text-center sm:block">
        <span className="block text-[10px] text-muted-foreground">Resolução</span>
        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700">
          {formatPercentage(operator.rate)}
        </span>
      </div>
    </div>
  );
}
function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="min-w-[145px] flex-1 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-white px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-[#20263d]"
      >
        <option value="">Todos</option>
        {values.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {formatNumber(item.value)}
        </p>
      ))}
    </div>
  );
}
const tooltip = <Tooltip content={<ChartTooltip />} />;

function buildEvolution(rows: AnalyticsTicket[], from: string, to: string) {
  if (!rows.length) return [];
  const earliest = Math.min(...rows.map((t) => t.opened));
  const latest = Math.max(Date.now(), ...rows.map((t) => t.opened));
  const start = from
    ? Math.max(earliest, Date.parse(`${from}T00:00:00-03:00`))
    : Math.max(earliest, latest - 89 * DAY);
  const end = to ? Math.min(latest, Date.parse(`${to}T23:59:59-03:00`)) : latest;
  const days = Math.max(1, (end - start) / DAY);
  const bucket = days <= 31 ? "day" : days <= 120 ? "week" : "month";
  const key = (ms: number) =>
    bucket === "month"
      ? yearMonth(ms)
      : bucket === "week"
        ? dayKey(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY)
        : dayKey(ms);
  const map = new Map<
    string,
    { name: string; Abertos: number; Finalizados: number; Backlog: number }
  >();
  const cursor = new Date(start);
  const stop = new Date(end);
  while (cursor <= stop) {
    const name = key(cursor.getTime());
    if (!map.has(name)) map.set(name, { name, Abertos: 0, Finalizados: 0, Backlog: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const t of rows) {
    if (t.opened >= start && t.opened <= end) {
      const item = map.get(key(t.opened));
      if (item) item.Abertos++;
    }
    if (t.closed && t.closed >= start && t.closed <= end) {
      const item = map.get(key(t.closed));
      if (item) item.Finalizados++;
    }
  }
  let backlog = rows.reduce(
    (n, t) => n + (t.opened < start && (!t.closed || t.closed >= start) ? 1 : 0),
    0,
  );
  for (const point of map.values()) {
    backlog += point.Abertos - point.Finalizados;
    point.Backlog = Math.max(0, backlog);
  }
  return [...map.values()];
}

export function SupportAnalyticsDashboard({ from, to }: { from: string; to: string }) {
  const tickets = useTickets();
  const hydration = useTicketsHydrationState();
  const [filters, setFilters] = useState<Omit<AnalyticsFilters, "from" | "to">>({
    company: "",
    owner: "",
    module: "",
    priority: "",
    status: "",
    source: "",
  });
  const [companySearch, setCompanySearch] = useState("");
  const [operatorsOpen, setOperatorsOpen] = useState(false);
  const [companyLimit, setCompanyLimit] = useState(50);
  const [companySort, setCompanySort] = useState<"total" | "open" | "critical" | "late" | "name">(
    "total",
  );
  const [topLimit, setTopLimit] = useState(5);
  const [selectedAge, setSelectedAge] = useState("");
  const all = useMemo(
    () => tickets.map(normalizeTicket).filter((t): t is AnalyticsTicket => t !== null),
    [tickets],
  );
  const dimensions = useMemo(() => {
    const unique = (select: (t: AnalyticsTicket) => string) =>
      [...new Set(all.map(select))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((value) => ({ value, label: value }));
    const companies = new Map<string, string>();
    for (const t of all) companies.set(t.companyId, t.company);
    return {
      companies: [...companies]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      owners: unique((t) => t.owner),
      modules: unique((t) => t.module),
      priorities: unique((t) => t.priority),
      statuses: unique((t) => t.status),
      sources: unique((t) => t.source),
    };
  }, [all]);
  const scoped = useMemo(
    () => all.filter((t) => matchesDimensions(t, { ...filters, from, to })),
    [all, filters, from, to],
  );
  const period = useMemo(
    () => scoped.filter((t) => inDateRange(t.opened, from, to)),
    [scoped, from, to],
  );
  const now = Date.now();
  const open = period.filter((t) => !t.closedNow);
  const finished = scoped.filter(
    (t) => closedStatus(t) && t.closed !== null && inDateRange(t.closed, from, to),
  );
  const resolution = finished.flatMap((t) =>
    t.closed && t.closed >= t.opened ? [t.closed - t.opened] : [],
  );
  const response = period.flatMap((t) =>
    t.started && t.started >= t.opened ? [t.started - t.opened] : [],
  );
  const slaEligible = finished.filter((t) => t.started !== null && t.started >= t.opened);
  const slaMet = slaEligible.filter(
    (t) => t.started! - t.opened <= SLA_TARGET_HOURS * 3_600_000,
  ).length;
  const slaRate = slaEligible.length ? (slaMet / slaEligible.length) * 100 : null;
  const hasClosureData = finished.some((t) => t.closed !== null);
  const distinctClients = new Set(period.map((t) => t.companyId)).size;
  const overdue = open.filter((t) => t.status === "Atrasado" || (t.due !== null && t.due < now));
  const critical = open.filter((t) => t.priority === "Alta");
  const idle = open.filter((t) => now - t.updated > DAY);
  const stale = open.filter((t) => now - t.opened > 3 * DAY);
  const previous = useMemo(() => {
    if (!from || !to) return null;
    const length =
      Math.round(
        (Date.parse(`${to}T12:00:00-03:00`) - Date.parse(`${from}T12:00:00-03:00`)) / DAY,
      ) + 1;
    if (!Number.isFinite(length) || length < 1) return null;
    const start = dayKey(Date.parse(`${from}T12:00:00-03:00`) - length * DAY);
    const end = dayKey(Date.parse(`${from}T12:00:00-03:00`) - DAY);
    return scoped.filter((t) => inDateRange(t.opened, start, end));
  }, [scoped, from, to]);
  const prevClients = previous ? new Set(previous.map((t) => t.companyId)).size : 0;
  const evolution = useMemo(() => buildEvolution(scoped, from, to), [scoped, from, to]);
  const ages = ["0–4h", "4–8h", "8–24h", "1–3d", "3–7d", "+7d"];
  const ageIndex = (t: AnalyticsTicket) => {
    const hours = (now - t.opened) / 3_600_000;
    return hours < 4 ? 0 : hours < 8 ? 1 : hours < 24 ? 2 : hours < 72 ? 3 : hours < 168 ? 4 : 5;
  };
  const ageData = ages.map((name, i) => ({
    name,
    count: open.filter((t) => ageIndex(t) === i).length,
  }));
  const displayOpen = selectedAge ? open.filter((t) => ages[ageIndex(t)] === selectedAge) : open;
  const ownerBuckets = new Map<string, AnalyticsTicket[]>();
  const companyBuckets = new Map<string, AnalyticsTicket[]>();
  for (const ticket of period) {
    if (!ownerBuckets.has(ticket.owner)) ownerBuckets.set(ticket.owner, []);
    ownerBuckets.get(ticket.owner)!.push(ticket);
    if (!companyBuckets.has(ticket.companyId)) companyBuckets.set(ticket.companyId, []);
    companyBuckets.get(ticket.companyId)!.push(ticket);
  }
  const byOwner = [...ownerBuckets]
    .map(([name, rows]) => {
      const count = rows.length;
      const done = rows.filter(closedStatus);
      const active = rows.filter((t) => !t.closedNow);
      return {
        name,
        count,
        done: done.length,
        active: active.length,
        rate: count ? (done.length / count) * 100 : null,
        resolution: mean(
          done.flatMap((t) => (t.closed && t.closed >= t.opened ? [t.closed - t.opened] : [])),
        ),
      };
    })
    .sort((a, b) => b.count - a.count);
  const currentLoad = groupCount(
    period.filter((t) => !t.closedNow),
    (t) => t.owner,
  );
  const avgLoad = mean(currentLoad.map((x) => x.count));
  const byCompany = [...companyBuckets]
    .map(([id, rows]) => {
      const count = rows.length;
      return {
        id,
        name: rows[0]?.company || id,
        count,
        open: rows.filter((t) => !t.closedNow).length,
        critical: rows.filter((t) => !t.closedNow && t.priority === "Alta").length,
        late: rows.filter(
          (t) => !t.closedNow && (t.status === "Atrasado" || (t.due !== null && t.due < now)),
        ).length,
        last: Math.max(...rows.map((t) => t.opened)),
        module: groupCount(rows, (t) => t.module)[0]?.name || "-",
      };
    })
    .sort((a, b) => b.count - a.count);
  const companyRows = byCompany
    .filter((row) =>
      row.name.toLocaleLowerCase("pt-BR").includes(companySearch.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      companySort === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : companySort === "total"
          ? b.count - a.count
          : b[companySort] - a[companySort],
    );
  const modules = groupCount(period, (t) => t.module).slice(0, 12);
  const sources = groupCount(period, (t) => t.source);
  const statuses = groupCount(period, (t) => t.status);
  const weekdayCounts = Array(7).fill(0) as number[];
  const hourCounts = Array(24).fill(0) as number[];
  for (const ticket of period) {
    const weekday = weekdayIndex(ticket.opened);
    const hour = localHour(ticket.opened);
    if (weekday >= 0) weekdayCounts[weekday]++;
    if (hour >= 0 && hour < 24) hourCounts[hour]++;
  }
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((name, i) => ({
    name,
    count: weekdayCounts[i],
  }));
  const hours = Array.from({ length: 24 }, (_, i) => ({
    name: `${String(i).padStart(2, "0")}h`,
    count: hourCounts[i],
  })).filter((x) => x.count > 0);
  const totalSources = sources.reduce((n, x) => n + x.count, 0);
  const filterBy = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));

  if (hydration === "loading")
    return (
      <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
        Carregando chamados...
      </div>
    );
  if (hydration === "error")
    return (
      <div
        role="alert"
        className="rounded-lg border border-rose-200 p-10 text-center text-sm text-rose-700"
      >
        Não foi possível carregar os dados dos chamados.
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2 rounded-[14px] border border-border/60 bg-white p-4 shadow-[0_8px_20px_rgba(25,29,51,0.04)] dark:bg-[#20263d]">
        <FilterSelect
          label="Empresa"
          value={filters.company}
          values={dimensions.companies}
          onChange={(v) => filterBy("company", v)}
        />
        <FilterSelect
          label="Operador"
          value={filters.owner}
          values={dimensions.owners}
          onChange={(v) => filterBy("owner", v)}
        />
        <FilterSelect
          label="Módulo"
          value={filters.module}
          values={dimensions.modules}
          onChange={(v) => filterBy("module", v)}
        />
        <FilterSelect
          label="Prioridade"
          value={filters.priority}
          values={dimensions.priorities}
          onChange={(v) => filterBy("priority", v)}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          values={dimensions.statuses}
          onChange={(v) => filterBy("status", v)}
        />
        <FilterSelect
          label="Origem"
          value={filters.source}
          values={dimensions.sources}
          onChange={(v) => filterBy("source", v)}
        />
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={() =>
              setFilters({
                company: "",
                owner: "",
                module: "",
                priority: "",
                status: "",
                source: "",
              })
            }
            className="h-9 px-2 text-sm text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
      {!period.length && !finished.length ? (
        empty
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Metric
              featured
              label="Chamados abertos"
              value={formatNumber(open.length)}
              sub="Abertos no período"
              change={
                previous
                  ? delta(open.length, previous.filter((t) => !t.closedNow).length)
                  : undefined
              }
            />
            <Metric
              featured
              label="SLA cumprido"
              value={formatPercentage(slaRate)}
              sub={
                slaEligible.length
                  ? `${formatNumber(slaEligible.length)} concluídos com início registrado`
                  : "Sem início de atendimento registrado"
              }
            />
            <Metric
              featured
              label="Primeira resposta"
              value={formatDuration(mean(response))}
              sub={
                response.length
                  ? `${formatNumber(response.length)} chamados com início registrado`
                  : "Sem início de atendimento registrado"
              }
            />
            <Metric
              featured
              label="Tempo médio de resolução"
              value={formatDuration(mean(resolution))}
              sub={
                hasClosureData
                  ? `${formatNumber(resolution.length)} chamados com encerramento`
                  : "Sem data de encerramento"
              }
            />
            <Metric
              featured
              label="Finalizados"
              value={formatNumber(finished.length)}
              sub="Encerrados no período"
            />
            <Metric
              featured
              label="Clientes afetados"
              value={formatNumber(distinctClients)}
              sub="Empresas diferentes"
              change={previous ? delta(distinctClients, prevClients) : undefined}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AlertTag
              icon={Flame}
              label="Alta prioridade em aberto"
              value={critical.length}
              tone="bg-rose-50 text-rose-600"
            />
            <AlertTag
              icon={AlertTriangle}
              label="Atraso registrado"
              value={overdue.length}
              tone="bg-amber-50 text-amber-600"
            />
            <AlertTag
              icon={Hourglass}
              label="Abertos há mais de 3 dias"
              value={stale.length}
              tone="bg-violet-50 text-violet-600"
            />
            <AlertTag
              icon={BellOff}
              label="Sem movimentação há 24h"
              value={idle.length}
              tone="bg-sky-50 text-sky-600"
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Panel
              title="Evolução dos chamados"
              detail="Aberturas, encerramentos e backlog por dia, semana ou mês"
            >
              <div className="h-72">
                {evolution.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6edf2" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis tick={{ fontSize: 11 }} />
                      {tooltip}
                      <Area
                        type="monotone"
                        dataKey="Abertos"
                        stroke={COLORS[0]}
                        fill={COLORS[0]}
                        fillOpacity={0.12}
                      />
                      <Area
                        type="monotone"
                        dataKey="Finalizados"
                        stroke={COLORS[1]}
                        fill={COLORS[1]}
                        fillOpacity={0.1}
                      />
                      <Area
                        type="monotone"
                        dataKey="Backlog"
                        stroke={COLORS[3]}
                        fill={COLORS[3]}
                        fillOpacity={0.06}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  empty
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                {[
                  ["Abertos", COLORS[0]],
                  ["Finalizados", COLORS[1]],
                  ["Backlog", COLORS[3]],
                ].map(([name, color]) => (
                  <span key={name} className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Backlog = chamados abertos até o período menos encerrados até cada data.
              </p>
            </Panel>
            <Panel title="Backlog por idade" detail="Idade dos chamados ainda não concluídos">
              <div className="space-y-2">
                {ageData.map((x) => (
                  <button
                    type="button"
                    key={x.name}
                    onClick={() => setSelectedAge((v) => (v === x.name ? "" : x.name))}
                    className={`flex w-full items-center gap-3 rounded-md p-1.5 text-sm hover:bg-muted ${selectedAge === x.name ? "bg-muted" : ""}`}
                  >
                    <span className="w-14 text-left text-muted-foreground">{x.name}</span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${open.length ? (x.count / open.length) * 100 : 0}%` }}
                      />
                    </span>
                    <strong className="w-12 text-right tabular-nums">
                      {formatNumber(x.count)}
                    </strong>
                  </button>
                ))}
              </div>
              {selectedAge && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatNumber(displayOpen.length)} chamados em {selectedAge}. Clique na faixa para
                  limpar.
                </p>
              )}
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Desempenho de SLA"
              detail="A maioria dos chamados importados não registra o início do atendimento nem um prazo individual"
            >
              {slaEligible.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Dentro da meta</p>
                    <strong>{formatNumber(slaMet)}</strong>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fora da meta</p>
                    <strong>{formatNumber(slaEligible.length - slaMet)}</strong>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cumprimento</p>
                    <strong>{formatPercentage(slaRate)}</strong>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-5">
                <AlertTriangle className="h-9 w-9 text-amber-500" />
                <div>
                  <p className="text-xl font-semibold">
                    {formatNumber(overdue.length)} com atraso registrado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Não equivale a violações confirmadas de SLA.
                  </p>
                </div>
              </div>
            </Panel>
            <Panel
              title="Tempos de atendimento"
              detail="Primeira resposta: abertura até início; resolução: abertura até encerramento"
            >
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Média da 1ª resposta" value={formatDuration(mean(response))} />
                <Metric label="Mediana da 1ª resposta" value={formatDuration(median(response))} />
                <Metric label="Média de resolução" value={formatDuration(mean(resolution))} />
                <Metric label="Mediana de resolução" value={formatDuration(median(resolution))} />
              </div>
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Performance dos operadores"
              detail="Volume e resolução por responsável no período"
              action={
                <button
                  type="button"
                  onClick={() => setOperatorsOpen(true)}
                  className="shrink-0 rounded-lg bg-[#e5f5fb] px-3 py-1.5 text-xs font-semibold text-[#008eb8] hover:bg-[#d5edf7]"
                >
                  Ver todos
                </button>
              }
            >
              <div>
                {byOwner.slice(0, 4).map((x) => (
                  <OperatorRow
                    key={x.name}
                    operator={x}
                    onSelect={() => filterBy("owner", x.name)}
                  />
                ))}
              </div>
              {!byOwner.length && empty}
            </Panel>
            <Panel
              title="Carga da equipe no período"
              detail="Chamados ainda abertos por responsável, comparados com a média da equipe"
            >
              <div className="max-h-80 space-y-2 overflow-auto">
                {currentLoad.map((x) => (
                  <div key={x.name} className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => filterBy("owner", x.name)}
                      className="w-24 truncate text-left text-primary hover:underline"
                    >
                      {x.name}
                    </button>
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(x.count / Math.max(1, currentLoad[0]?.count)) * 100}%`,
                          background: avgLoad !== null && x.count > avgLoad ? COLORS[3] : COLORS[0],
                        }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums">{x.count}</span>
                  </div>
                ))}
              </div>
              {!currentLoad.length && empty}
              <p className="mt-3 text-xs text-muted-foreground">
                Média: {avgLoad === null ? "-" : formatNumber(Math.round(avgLoad))} por operador.
                Cor de destaque indica carga acima da média, não limite de capacidade.
              </p>
            </Panel>
          </div>
          <Panel
            title="Saúde dos clientes"
            detail="Atenção: chamado de alta prioridade ou atraso registrado; demais: normal"
          >
            <input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Buscar empresa"
              className="mb-3 h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
            />
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className="sticky top-0 bg-background text-muted-foreground">
                  <tr>
                    {(
                      [
                        ["name", "Empresa"],
                        ["total", "Chamados"],
                        ["open", "Abertos"],
                        ["critical", "Alta prioridade"],
                        ["late", "Atrasados"],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key}>
                        <button
                          type="button"
                          onClick={() => setCompanySort(key)}
                          className="py-2 hover:text-primary"
                        >
                          {label}
                        </button>
                      </th>
                    ))}
                    <th>Situação</th>
                    <th>Último chamado</th>
                  </tr>
                </thead>
                <tbody>
                  {companyRows.slice(0, companyLimit).map((x) => (
                    <tr key={x.id} className="border-t border-border">
                      <td>
                        <button
                          type="button"
                          className="max-w-[250px] truncate py-2 text-left font-medium text-primary hover:underline"
                          onClick={() => filterBy("company", x.id)}
                          title={x.name}
                        >
                          {x.name}
                        </button>
                      </td>
                      <td>{x.count}</td>
                      <td>{x.open}</td>
                      <td>{x.critical}</td>
                      <td>{x.late}</td>
                      <td className={x.critical || x.late ? "text-rose-600" : "text-emerald-600"}>
                        {x.critical || x.late ? "Atenção" : "Normal"}
                      </td>
                      <td>{formatDate(x.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {companyRows.length > companyLimit && (
              <button
                type="button"
                className="mt-3 text-xs font-medium text-primary hover:underline"
                onClick={() => setCompanyLimit((limit) => limit + 50)}
              >
                Mostrar mais empresas ({formatNumber(companyRows.length - companyLimit)} restantes)
              </button>
            )}
          </Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Empresas com mais chamados"
              detail="Volume de chamados abertos no período"
            >
              <div className="mb-3 flex gap-1">
                {[5, 10, 20].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setTopLimit(n)}
                    className={`rounded-md px-2 py-1 text-xs ${topLimit === n ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {byCompany.slice(0, topLimit).map((x) => (
                  <button
                    type="button"
                    key={x.id}
                    onClick={() => filterBy("company", x.id)}
                    title={`${x.name}: ${x.count} chamados; ${x.open} abertos; módulo principal ${x.module}`}
                    className="flex w-full items-center gap-2 text-xs"
                  >
                    <span className="w-32 truncate text-left text-primary">{x.name}</span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(x.count / Math.max(1, byCompany[0]?.count)) * 100}%` }}
                      />
                    </span>
                    <strong className="w-10 text-right">{x.count}</strong>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel
              title="Mapa de problemas do ERP"
              detail="Módulos presentes no cadastro dos chamados"
            >
              <div className="space-y-2">
                {modules.map((x) => (
                  <button
                    type="button"
                    key={x.name}
                    onClick={() => filterBy("module", x.name)}
                    className="flex w-full items-center gap-2 text-xs"
                  >
                    <span className="w-28 truncate text-left text-primary" title={x.name}>
                      {x.name}
                    </span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${(x.count / Math.max(1, modules[0]?.count)) * 100}%` }}
                      />
                    </span>
                    <strong className="w-12 text-right">{formatNumber(x.count)}</strong>
                    <span className="w-12 text-right text-muted-foreground">
                      {formatPercentage((x.count / period.length) * 100)}
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Origem dos chamados" detail="Canais presentes nos dados">
              <div className="flex flex-wrap items-center gap-5">
                {sources.length ? (
                  <div className="h-48 w-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sources}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={82}
                          stroke="none"
                        >
                          {sources.map((x, i) => (
                            <Cell key={x.name} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        {tooltip}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  empty
                )}
                <div className="min-w-40 flex-1 space-y-2">
                  {sources.map((x, i) => (
                    <button
                      type="button"
                      key={x.name}
                      onClick={() => filterBy("source", x.name)}
                      className="flex w-full justify-between gap-2 text-xs hover:text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        {x.name}
                      </span>
                      <span>
                        {formatNumber(x.count)} · {formatPercentage((x.count / totalSources) * 100)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel
              title="Chamados por status"
              detail="Situação atual dos chamados abertos no período"
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statuses}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={61}
                        outerRadius={91}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {statuses.map((x) => (
                          <Cell key={x.name} fill={STATUS_COLORS[x.name] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      {tooltip}
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {formatNumber(period.length)}
                    </span>
                    <span className="text-xs text-muted-foreground">chamados</span>
                  </div>
                </div>
                <div className="w-full min-w-0 space-y-1.5">
                  {statuses.map((x) => (
                    <button
                      type="button"
                      key={x.name}
                      onClick={() => filterBy("status", x.name)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: STATUS_COLORS[x.name] ?? "#94a3b8" }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {x.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                        {formatNumber(x.count)}
                      </span>
                      <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground">
                        {formatPercentage((x.count / period.length) * 100)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Horários de maior movimento" detail="Hora local de abertura dos chamados">
              <div className="h-56">
                {hours.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hours}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6edf2" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      {tooltip}
                      <Bar dataKey="count" name="Chamados" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  empty
                )}
              </div>
            </Panel>
            <Panel title="Chamados por dia da semana" detail="Dia local de abertura">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdays}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6edf2" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    {tooltip}
                    <Bar dataKey="count" name="Chamados" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            Primeira resposta, SLA cumprido, reabertura, FCR, satisfação, categoria e versão não são
            exibidos sem registros suficientes no endpoint.
          </p>
        </>
      )}
      <Dialog open={operatorsOpen} onOpenChange={setOperatorsOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>Performance dos operadores</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto px-1">
            {byOwner.map((operator) => (
              <div key={operator.name}>
                <OperatorRow
                  operator={operator}
                  onSelect={() => {
                    filterBy("owner", operator.name);
                    setOperatorsOpen(false);
                  }}
                />
                <p className="-mt-2 mb-2 pl-11 text-[11px] text-muted-foreground">
                  Tempo médio de resolução: {formatDuration(operator.resolution)}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
