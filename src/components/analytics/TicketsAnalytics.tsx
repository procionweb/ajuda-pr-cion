import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
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
  Building2,
  BookOpenText,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Headphones,
  Layers,
  MessageSquarePlus,
  PhoneCall,
  Trophy,
  UsersRound,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ticketStatuses, type SupportTicket, type TicketStatus } from "@/lib/support-tickets-data";
import { useTickets } from "@/lib/tickets-store";
import { AnalyticsOverview } from "./AnalyticsOverview";
import { computeAttendanceTime, computeSla, formatElapsedTime } from "@/lib/ticket-sla";
import {
  addMonths,
  buildMonthSeries,
  computeMonthMetrics,
  currentMonthKey,
  formatPercentChange,
  isMonthKey,
  lastMonthKeys,
  monthLabel,
  percentChange,
  type MonthSeriesPoint,
} from "@/lib/tickets-month";

const sourceLabels = {
  Telefone: "Telefone",
  "Portal do cliente": "Portal",
  WhatsApp: "WhatsApp",
  Email: "Email",
};

function analyticsModuleLabel(module: string) {
  return /controle\s+de\s+estoques?/i.test(module) ? "ESTOQUE" : module.trim() || "Não informado";
}

// ============= Analytics dashboard components (Chamados) =============

export type IndicatorCardLink = {
  to: string;
  search?: Record<string, unknown>;
};

function RevenueStyleCards({
  cards,
  links,
}: {
  cards: {
    tag: string;
    title: string;
    value: number;
    change: string | null;
    positive: boolean;
    helper: string;
    tone: string;
    arrow: string;
    bars: number[];
  }[];
  links?: (IndicatorCardLink | undefined)[];
}) {
  return (
    <div className="analytics-kpis grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card, idx) => {
        const link = links?.[idx];
        const maxBar = Math.max(...card.bars, 1);
        const cardEl = (
          <Card
            className={cn(
              "analytics-kpi relative flex h-full min-h-[152px] overflow-hidden rounded-[28px] border-0 bg-[#f6f7f9] pl-[74px] shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:bg-[#20263d]",
              link &&
                "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-[104px] overflow-hidden rounded-l-[28px] bg-gradient-to-b",
                card.tone,
              )}
            >
              <span
                className={cn(
                  "absolute right-[-26px] top-1/2 h-[74px] w-[74px] -translate-y-1/2 rotate-45 shadow-[10px_10px_18px_rgba(0,0,0,0.12)]",
                  card.arrow,
                )}
                aria-hidden="true"
              />
              <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[17px] font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                {card.tag}
              </span>
            </div>

            <div className="relative z-10 flex h-full w-full min-h-[152px] flex-col justify-between rounded-l-[28px] bg-[#f6f7f9] px-6 py-5 dark:bg-[#20263d]">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{card.title}</p>
                <p className="mt-2 text-[20px] font-bold leading-none tracking-tight text-foreground">
                  {card.value} chamados
                </p>
              </div>
              <div
                className="grid items-end gap-3"
                style={{ gridTemplateColumns: "minmax(0, 1fr) 56px" }}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {card.change && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-1 text-[13px] font-semibold",
                        card.positive
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-rose-100 text-rose-600",
                      )}
                    >
                      {card.change}
                    </span>
                  )}
                  <span
                    className="min-w-0 flex-1 text-[13px] leading-tight text-muted-foreground"
                    style={{
                      whiteSpace: "normal",
                      overflow: "visible",
                      textOverflow: "clip",
                    }}
                  >
                    {card.helper}
                  </span>
                </div>
                <div
                  className="ml-auto flex items-end justify-end gap-[3px] opacity-80"
                  style={{ width: 56, height: 40 }}
                  aria-hidden="true"
                >
                  {card.bars.map((height, index) => (
                    <span
                      key={index}
                      className="w-[6px] rounded-t bg-[#cfc6f4]"
                      style={{ height: Math.max(3, Math.round((height / maxBar) * 40)) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        );

        if (link) {
          return (
            <Link
              key={card.tag}
              to={link.to}
              search={link.search as never}
              className="block h-full rounded-[28px] focus:outline-none"
            >
              {cardEl}
            </Link>
          );
        }

        return (
          <div key={card.tag} className="h-full">
            {cardEl}
          </div>
        );
      })}
    </div>
  );
}

export function TicketsIndicatorCards({
  month,
  tickets,
  filtered = false,
}: {
  month?: string;
  tickets?: SupportTicket[];
  filtered?: boolean;
} = {}) {
  const allTickets = useTickets();
  const supportTickets = tickets ?? allTickets;
  const monthKey = isMonthKey(month) ? month : currentMonthKey();

  const { cards, links } = useMemo(() => {
    const previousKey = addMonths(monthKey, -1);
    const current = filtered
      ? {
          open: supportTickets.filter((ticket) =>
            [
              "Atrasado",
              "Em Aberto",
              "Ocupado",
              "Em andamento",
              "Aguardando cliente",
              "Com especialista",
              "Agendamento",
            ].includes(ticket.status),
          ).length,
          inProgress: supportTickets.filter((ticket) =>
            [
              "Ocupado",
              "Em andamento",
              "Aguardando cliente",
              "Com especialista",
              "Agendamento",
            ].includes(ticket.status),
          ).length,
          overdue: supportTickets.filter((ticket) => ticket.status === "Atrasado").length,
          finished: supportTickets.filter((ticket) => ticket.status === "Finalizado").length,
          total: supportTickets.length,
        }
      : computeMonthMetrics(supportTickets, monthKey);
    const previous = computeMonthMetrics(supportTickets, previousKey);
    const series = buildMonthSeries(supportTickets, lastMonthKeys(monthKey, 5));
    const monthName = monthLabel(monthKey);

    const build = (
      tag: string,
      title: string,
      value: number,
      previousValue: number,
      helper: string,
      tone: string,
      arrow: string,
      bars: number[],
      higherIsBetter: boolean,
    ) => {
      const delta = percentChange(value, previousValue);
      return {
        tag,
        title,
        value,
        change: filtered ? null : formatPercentChange(delta),
        positive: delta === null ? true : higherIsBetter ? delta >= 0 : delta <= 0,
        helper,
        tone,
        arrow,
        bars,
      };
    };

    return {
      cards: [
        build(
          "ABR",
          "Chamados Abertos",
          current.open,
          previous.open,
          filtered ? "Abertos no período" : `Abertos em ${monthName}`,
          "from-[#ff9d00] to-[#ffb13b]",
          "bg-[#e28a00]",
          series.map((p: MonthSeriesPoint) => p.opened),
          true,
        ),
        build(
          "AND",
          "Em Atendimento",
          current.inProgress,
          previous.inProgress,
          filtered ? "Em atendimento no período" : `Em atendimento no mês`,
          "from-[#0b97c4] to-[#36b9df]",
          "bg-[#087fa6]",
          series.map((p: MonthSeriesPoint) => p.opened),
          true,
        ),
        build(
          "SLA",
          "Chamados Atrasados",
          current.overdue,
          previous.overdue,
          filtered ? "Fora do SLA no período" : "Fora do SLA no mês",
          "from-[#ff1f25] to-[#ff4a50]",
          "bg-[#d80f15]",
          series.map((p: MonthSeriesPoint) => p.overdue),
          false,
        ),
        build(
          "FIN",
          filtered ? "Chamados Finalizados" : "Finalizados no Mês",
          current.finished,
          previous.finished,
          filtered ? "Concluídos no período" : "Concluídos pela equipe no mês",
          "from-[#18b978] to-[#36d695]",
          "bg-[#10955f]",
          series.map((p: MonthSeriesPoint) => p.finished),
          true,
        ),
      ],
      links: [
        { to: "/chamados", search: { visao: "open", mes: monthKey } },
        { to: "/chamados", search: { visao: "in-progress", mes: monthKey } },
        { to: "/chamados", search: { visao: "overdue", mes: monthKey } },
        { to: "/chamados", search: { visao: "finished", mes: monthKey } },
      ] as IndicatorCardLink[],
    };
  }, [supportTickets, monthKey, filtered]);

  return <RevenueStyleCards cards={cards} links={links} />;
}

type AgentPerformance = {
  operator: string;
  handled: number;
  finished: number;
  seconds: number;
  companies: Map<string, number>;
};

function ticketCompany(ticket: SupportTicket) {
  return (
    ticket.clientCode?.trim() ||
    ticket.clientName?.trim() ||
    ticket.companyName?.trim() ||
    "Não informado"
  );
}

function TopAgentsCard({ tickets }: { tickets: SupportTicket[] }) {
  const [showAll, setShowAll] = useState(false);
  const allAgents = useMemo(() => {
    const map = new Map<string, AgentPerformance>();
    tickets.forEach((ticket) => {
      const key = ticket.owner?.trim() || ticket.attendant?.trim() || "Não informado";
      const current = map.get(key) ?? {
        operator: key,
        handled: 0,
        finished: 0,
        seconds: 0,
        companies: new Map<string, number>(),
      };
      current.handled += 1;
      if (ticket.status === "Finalizado") current.finished += 1;
      current.seconds += computeAttendanceTime(ticket).seconds;
      const company = ticketCompany(ticket);
      current.companies.set(company, (current.companies.get(company) ?? 0) + 1);
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.handled - a.handled);
  }, [tickets]);
  const agents = allAgents.slice(0, 4);

  return (
    <Card className="rounded-md border border-border/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:bg-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold tracking-tight text-foreground">
          Performance dos Operadores
        </h3>
        <Button
          type="button"
          variant="ghost"
          className="h-9 cursor-pointer px-3 text-xs font-semibold"
          onClick={() => setShowAll(true)}
        >
          Ver todos
        </Button>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => {
          const resolutionRate = agent.handled
            ? Math.round((agent.finished / agent.handled) * 100)
            : 0;
          const activeDots = Math.round((resolutionRate / 100) * 18);
          const avgResolutionTime = formatElapsedTime(
            agent.handled ? agent.seconds / agent.handled : 0,
          );
          const initial = agent.operator.charAt(0).toLocaleUpperCase("pt-BR") || "?";

          return (
            <div
              key={agent.operator}
              className="flex flex-col gap-3 rounded-md border border-border/80 bg-white px-4 py-3 dark:bg-background/30 lg:flex-row lg:items-center lg:gap-5"
            >
              <div className="flex min-w-0 items-center gap-3 lg:w-[200px]">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {agent.operator}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {agent.finished} finalizado{agent.finished === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="min-w-0 lg:w-[130px]">
                <p className="text-[11px] text-muted-foreground">Tempo médio</p>
                <p className="mt-0.5 text-[14px] font-bold text-foreground">{avgResolutionTime}</p>
              </div>

              <div className="min-w-0 lg:w-[120px]">
                <p className="text-[11px] text-muted-foreground">Atendimentos</p>
                <p className="mt-0.5 text-[14px] font-bold text-foreground">{agent.handled}</p>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">Taxa de resolução</p>
                  <p className="text-[13px] font-semibold text-foreground">{resolutionRate}%</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {Array.from({ length: 18 }).map((_, dotIndex) => (
                    <span
                      key={dotIndex}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        dotIndex < activeDots ? "bg-[#f26322]" : "bg-[#dfe3e8] dark:bg-muted",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="flex max-h-[86vh] max-w-4xl flex-col gap-0 overflow-hidden border border-border p-0 shadow-2xl sm:max-w-4xl sm:p-0">
          <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <UsersRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg text-foreground">
                  Performance dos operadores
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  Comparativo de atendimentos e taxa de resolução
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 border-b bg-muted/25 px-6 py-4 sm:grid-cols-3 sm:px-7">
            <div>
              <p className="text-[11px] text-muted-foreground">Operadores</p>
              <p className="text-lg font-bold">{allAgents.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Atendimentos</p>
              <p className="text-lg font-bold">
                {allAgents.reduce((sum, item) => sum + item.handled, 0)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Finalizados</p>
              <p className="text-lg font-bold">
                {allAgents.reduce((sum, item) => sum + item.finished, 0)}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/10 px-6 py-5 sm:px-7">
            <div className="grid gap-3 lg:grid-cols-2">
              {allAgents.map((agent) => {
                const resolutionRate = agent.handled
                  ? Math.round((agent.finished / agent.handled) * 100)
                  : 0;
                const topCompanies = Array.from(agent.companies.entries())
                  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
                  .slice(0, 3);
                return (
                  <article
                    key={agent.operator}
                    className="overflow-hidden rounded-md border bg-background shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4 border-b bg-muted/25 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                          {agent.operator.charAt(0).toLocaleUpperCase("pt-BR") || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{agent.operator}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {agent.finished} finalizados de {agent.handled} atendimentos
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {resolutionRate}%
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
                        Empresas mais atendidas
                      </p>
                      <div className="space-y-2">
                        {topCompanies.map(([company, total], index) => (
                          <div key={company} className="flex items-center gap-2 text-xs">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium" title={company}>
                              {company}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums">{total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4 sm:px-7">
            <Button type="button" variant="outline" onClick={() => setShowAll(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function isBusinessDay(date: Date) {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

function businessDaysEndingAt(date: Date, count: number) {
  const days: Date[] = [];
  let cursor = startOfDay(date);
  while (days.length < count) {
    if (isBusinessDay(cursor)) days.unshift(new Date(cursor));
    cursor = addDays(cursor, -1);
  }
  return days;
}

function businessDaysInRange(start: Date, end: Date) {
  const days: Date[] = [];
  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    if (isBusinessDay(cursor)) days.push(cursor);
  }
  return days;
}

function dateIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function StatisticsCard({
  tickets,
  rangeStart,
  rangeEnd,
}: {
  tickets: SupportTicket[];
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const daysScrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const [daySelection, setDaySelection] = useState<string | null>(null);
  const parsedRangeEnd = rangeEnd ? new Date(`${rangeEnd}T12:00:00`) : new Date();
  const today = startOfDay(Number.isFinite(parsedRangeEnd.getTime()) ? parsedRangeEnd : new Date());
  const parsedRangeStart = rangeStart ? new Date(`${rangeStart}T12:00:00`) : null;
  const validRangeStart =
    parsedRangeStart && Number.isFinite(parsedRangeStart.getTime())
      ? startOfDay(parsedRangeStart)
      : null;
  const periodStart = validRangeStart && validRangeStart > today ? today : validRangeStart;
  const periodEnd = validRangeStart && validRangeStart > today ? validRangeStart : today;
  const currentBusinessDays = periodStart
    ? businessDaysInRange(periodStart, periodEnd)
    : businessDaysEndingAt(today, 30);
  const previousBusinessDays = currentBusinessDays.length
    ? businessDaysEndingAt(addDays(currentBusinessDays[0], -1), currentBusinessDays.length)
    : [];
  const selectedDay =
    daySelection && currentBusinessDays.some((day) => dateIso(day) === daySelection)
      ? daySelection
      : null;
  const previousBusinessDay = selectedDay
    ? businessDaysEndingAt(addDays(new Date(`${selectedDay}T12:00:00`), -1), 1)[0]
    : null;
  const currentDays = new Set(selectedDay ? [selectedDay] : currentBusinessDays.map(dateIso));
  const previousDays = new Set(
    selectedDay && previousBusinessDay
      ? [dateIso(previousBusinessDay)]
      : previousBusinessDays.map(dateIso),
  );
  const statisticsDays = currentBusinessDays.map((date) => {
    return {
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      day: String(date.getDate()).padStart(2, "0"),
      weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
        .format(date)
        .replace(".", "")
        .toLocaleUpperCase("pt-BR"),
      active: dateIso(date) === selectedDay,
    };
  });
  const hourlyStats = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 7;
    let thisWeek = 0;
    let lastWeek = 0;
    tickets.forEach((ticket) => {
      const opened = new Date(ticket.openedAt);
      if (!Number.isFinite(opened.getTime()) || opened.getHours() !== hour) return;
      const openedIso = dateIso(opened);
      if (currentDays.has(openedIso)) thisWeek += 1;
      else if (previousDays.has(openedIso)) lastWeek += 1;
    });
    return { time: `${hour}h`, thisWeek, lastWeek };
  });
  const chartMax = Math.max(1, ...hourlyStats.flatMap((item) => [item.thisWeek, item.lastWeek]));
  const yMax = Math.max(4, Math.ceil(chartMax / 4) * 4);
  const stopDaysScroll = () => {
    if (scrollTimerRef.current !== null) window.clearInterval(scrollTimerRef.current);
    scrollTimerRef.current = null;
  };
  const startDaysScroll = (direction: -1 | 1) => {
    stopDaysScroll();
    daysScrollRef.current?.scrollBy({ left: direction * 42, behavior: "smooth" });
    scrollTimerRef.current = window.setInterval(() => {
      daysScrollRef.current?.scrollBy({ left: direction * 24, behavior: "auto" });
    }, 90);
  };
  return (
    <Card className="w-full max-w-full min-w-0 overflow-hidden rounded-[14px] border border-border/60 bg-white p-4 shadow-[0_10px_26px_rgba(25,29,51,0.06)] dark:bg-[#20263d] sm:p-5">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h3 className="text-base font-bold tracking-tight text-foreground">Estatísticas</h3>
        <span className="inline-flex h-9 items-center gap-2 rounded-md bg-muted/60 px-4 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4" />
          {selectedDay
            ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString("pt-BR")
            : periodStart
              ? "Dias úteis do período"
              : "Últimos 30 dias úteis"}
        </span>
      </div>

      <div className="relative mb-6 px-8">
        <button
          type="button"
          aria-label="Ver dias anteriores"
          onMouseEnter={() => startDaysScroll(-1)}
          onMouseLeave={stopDaysScroll}
          onClick={() => daysScrollRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
          className="absolute left-0 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full border bg-background shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={daysScrollRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {statisticsDays.map((item) => (
            <button
              key={item.iso}
              type="button"
              aria-label={`Mostrar estatísticas de ${item.day} ${item.weekday}`}
              aria-pressed={item.active}
              onClick={() => setDaySelection((current) => (current === item.iso ? null : item.iso))}
              className={cn(
                "grid h-[60px] w-[44px] shrink-0 cursor-pointer place-items-center rounded-md bg-muted/45 text-center transition",
                item.active && "bg-[#a779c7] text-white",
              )}
            >
              <span>
                <span className="block text-[14px] font-black leading-none">{item.day}</span>
                <span className={cn("mt-1 block text-[9px] font-bold", "text-current")}>
                  {item.weekday}
                </span>
                <span className="mx-auto mt-1.5 block h-1 w-1 rounded-full bg-[#b9d899]" />
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Ver próximos dias"
          onMouseEnter={() => startDaysScroll(1)}
          onMouseLeave={stopDaysScroll}
          onClick={() => daysScrollRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
          className="absolute right-0 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full border bg-background shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="h-[300px] w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={hourlyStats} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="statsPurple" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b082cf" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#8e62aa" stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(139,145,173,0.28)" />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#66708a" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[0, yMax]}
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#66708a" }}
              width={42}
            />
            <Tooltip
              contentStyle={{
                border: "0",
                borderRadius: 12,
                backgroundColor: "#182f4d",
                color: "#fff",
                boxShadow: "0 14px 30px rgba(0,0,0,0.24)",
                fontSize: 12,
              }}
              labelStyle={{ color: "#fff" }}
              itemStyle={{ color: "#fff" }}
            />
            <Bar
              dataKey="thisWeek"
              name={
                selectedDay
                  ? "Dia selecionado"
                  : periodStart
                    ? "Período selecionado"
                    : "Últimos 30 dias úteis"
              }
              fill="url(#statsPurple)"
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
            />
            <Line
              type="monotone"
              dataKey="lastWeek"
              name={selectedDay ? "Dia útil anterior" : "Período anterior"}
              stroke="#89c2b7"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 3, stroke: "#89c2b7", fill: "#ffffff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-8 text-xs font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#a779c7]" />{" "}
          {selectedDay
            ? "Dia selecionado"
            : periodStart
              ? "Período selecionado"
              : "Últimos 30 dias úteis"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-[#89c2b7]" />{" "}
          {selectedDay ? "Dia útil anterior" : "Período anterior"}
        </span>
      </div>
    </Card>
  );
}

function WeeklyBacklogCard({
  tickets,
  filtered = false,
}: {
  tickets: SupportTicket[];
  filtered?: boolean;
}) {
  const [showCompanies, setShowCompanies] = useState(false);
  const latestTicketDate = useMemo(
    () =>
      tickets.reduce((latest, ticket) => {
        const opened = new Date(ticket.openedAt).getTime();
        return Number.isFinite(opened) ? Math.max(latest, opened) : latest;
      }, Number.NEGATIVE_INFINITY),
    [tickets],
  );
  const weekStart = Number.isFinite(latestTicketDate)
    ? addDays(startOfDay(new Date(latestTicketDate)), -6).getTime()
    : Number.NEGATIVE_INFINITY;
  const weekEnd = Number.isFinite(latestTicketDate)
    ? addDays(startOfDay(new Date(latestTicketDate)), 1).getTime()
    : Number.POSITIVE_INFINITY;
  const weekLabel = Number.isFinite(latestTicketDate)
    ? new Date(latestTicketDate).toLocaleDateString("pt-BR")
    : "sem dados";
  const weeklyCompanies = useMemo(() => {
    const companies = new Map<
      string,
      { company: string; nfe: number; basic: number; others: number; modules: Map<string, number> }
    >();
    tickets.forEach((ticket) => {
      const opened = new Date(ticket.openedAt).getTime();
      if (!Number.isFinite(opened) || (!filtered && (opened < weekStart || opened >= weekEnd)))
        return;
      const company = ticketCompany(ticket);
      const current = companies.get(company) ?? {
        company,
        nfe: 0,
        basic: 0,
        others: 0,
        modules: new Map<string, number>(),
      };
      const module = ticket.module.toLocaleLowerCase("pt-BR");
      const moduleLabel = analyticsModuleLabel(ticket.module);
      current.modules.set(moduleLabel, (current.modules.get(moduleLabel) ?? 0) + 1);
      if (module.includes("nfe") || module.includes("nf-e")) current.nfe += 1;
      else if (
        module.includes("basico") ||
        module.includes("básico") ||
        module.includes("terceiro")
      )
        current.basic += 1;
      else current.others += 1;
      companies.set(company, current);
    });
    return Array.from(companies.values())
      .map((company) => ({
        ...company,
        total: company.nfe + company.basic + company.others,
        topModule:
          Array.from(company.modules.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "Não informado",
      }))
      .sort((a, b) => b.total - a.total);
  }, [tickets, filtered, weekStart, weekEnd]);
  const weeklyTopCompanies = weeklyCompanies.slice(0, 6);

  return (
    <Card className="rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Empresas que mais ligaram {filtered ? "no período" : "na última semana registrada"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filtered
              ? "Volume de chamados por empresa e tipo de problema."
              : `Sete dias encerrados em ${weekLabel}.`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 cursor-pointer px-3 text-xs font-semibold"
          onClick={() => setShowCompanies(true)}
        >
          Ver 30 empresas
        </Button>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyTopCompanies} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(139,145,173,0.18)" />
            <XAxis
              dataKey="company"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fontWeight: 600, fill: "#8b91ad" }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8b91ad" }}
              width={40}
            />
            <Tooltip
              formatter={(value, name) => [
                `${value} chamado${Number(value) === 1 ? "" : "s"}`,
                name,
              ]}
              contentStyle={{
                border: "0",
                borderRadius: 12,
                boxShadow: "0 14px 30px rgba(25,29,51,0.12)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="nfe" name="NF-e" fill="#8d6bd8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="basic" name="Básico / Terceiros" fill="#ff9f68" radius={[6, 6, 0, 0]} />
            <Bar dataKey="others" name="Demais módulos" fill="#ff5fc8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-5 text-xs font-semibold text-muted-foreground">
        <LegendDot color="#8d6bd8" label="NF-e" />
        <LegendDot color="#ff9f68" label="Básico / Terceiros" />
        <LegendDot color="#ff5fc8" label="Demais módulos" />
      </div>
      <Dialog open={showCompanies} onOpenChange={setShowCompanies}>
        <DialogContent className="flex max-h-[86vh] max-w-4xl flex-col gap-0 overflow-hidden border border-border p-0 shadow-2xl sm:max-w-4xl sm:p-0">
          <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg text-foreground">
                  Empresas que mais ligaram
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  As 30 empresas com maior volume de chamados e seu módulo principal
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b bg-muted/20 px-6 py-4 text-sm sm:px-7">
            <span>
              <strong className="mr-1 text-lg text-foreground">
                {Math.min(30, weeklyCompanies.length)}
              </strong>{" "}
              empresas
            </span>
            <span>
              <strong className="mr-1 text-lg text-foreground">
                {weeklyCompanies.slice(0, 30).reduce((sum, item) => sum + item.total, 0)}
              </strong>{" "}
              chamados
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 sm:px-7">
            {weeklyCompanies.slice(0, 30).map((company, index) => (
              <div
                key={company.company}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border/70 py-3 last:border-b-0 sm:grid-cols-[32px_minmax(0,1fr)_minmax(125px,0.5fr)_auto]"
              >
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-semibold text-foreground"
                    title={company.company}
                  >
                    {company.company}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(3, (company.total / (weeklyCompanies[0]?.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span
                  className="col-start-2 truncate text-xs text-muted-foreground sm:col-start-3"
                  title={company.topModule}
                >
                  {company.topModule}
                </span>
                <strong className="col-start-3 row-start-1 text-right text-sm tabular-nums text-foreground sm:col-start-4">
                  {company.total}
                </strong>
              </div>
            ))}
            {weeklyCompanies.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma empresa encontrada no período.
              </p>
            )}
          </div>
          <DialogFooter className="border-t px-6 py-4 sm:px-7">
            <Button type="button" variant="outline" onClick={() => setShowCompanies(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function SlaProfileCard({ tickets }: { tickets: SupportTicket[] }) {
  const now = Date.now();
  const today = startOfDay(new Date());
  const currentStart = addDays(today, -6).getTime();
  const previousStart = addDays(today, -13).getTime();
  const currentEnd = addDays(today, 1).getTime();
  const currentWeek = tickets.filter((ticket) => {
    const opened = new Date(ticket.openedAt).getTime();
    return opened >= currentStart && opened < currentEnd;
  });
  const previousWeek = tickets.filter((ticket) => {
    const opened = new Date(ticket.openedAt).getTime();
    return opened >= previousStart && opened < currentStart;
  });
  const finishedTickets = tickets.filter((ticket) => ticket.status === "Finalizado");
  const resolutionRate = tickets.length
    ? Math.round((finishedTickets.length / tickets.length) * 100)
    : 0;
  const portalTickets = tickets.filter((ticket) => ticket.source === "Portal do cliente").length;
  const attendanceTimes = tickets
    .map((ticket) => computeAttendanceTime(ticket, now).seconds)
    .filter(Boolean);
  const avgHandlingLabel = formatElapsedTime(
    attendanceTimes.length
      ? attendanceTimes.reduce((total, seconds) => total + seconds, 0) / attendanceTimes.length
      : 0,
  );
  const slaResults = tickets.map((ticket) => computeSla(ticket, now));
  const slaMedio = slaResults.length
    ? Math.round((slaResults.filter((result) => result.pct < 100).length / slaResults.length) * 100)
    : 0;
  const averageFirstResponse = (rows: SupportTicket[]) => {
    const values = rows.flatMap((ticket) => {
      if (!ticket.attendanceStartedAt) return [];
      const minutes =
        (new Date(ticket.attendanceStartedAt).getTime() - new Date(ticket.openedAt).getTime()) /
        60000;
      return Number.isFinite(minutes) && minutes >= 0 ? [minutes] : [];
    });
    return values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
  };
  const weeklyValue = (rows: SupportTicket[], predicate: (ticket: SupportTicket) => boolean) =>
    rows.filter(predicate).length;
  const deltaLabel = (current: number, previous: number, suffix = "") => {
    const delta = current - previous;
    return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
  };
  const currentFirstResponse = averageFirstResponse(currentWeek);
  const previousFirstResponse = averageFirstResponse(previousWeek);
  const currentInAttendance = weeklyValue(currentWeek, (ticket) =>
    ["Ocupado", "Em andamento", "Com especialista"].includes(ticket.status),
  );
  const previousInAttendance = weeklyValue(previousWeek, (ticket) =>
    ["Ocupado", "Em andamento", "Com especialista"].includes(ticket.status),
  );
  const currentWaiting = weeklyValue(
    currentWeek,
    (ticket) => ticket.status === "Aguardando cliente",
  );
  const previousWaiting = weeklyValue(
    previousWeek,
    (ticket) => ticket.status === "Aguardando cliente",
  );
  const currentLate = weeklyValue(currentWeek, (ticket) => computeSla(ticket, now).pct >= 100);
  const previousLate = weeklyValue(previousWeek, (ticket) => computeSla(ticket, now).pct >= 100);
  const weekIndicators = [
    {
      icon: Clock3,
      label: "Primeira resposta",
      value: `${currentFirstResponse} min`,
      delta: deltaLabel(currentFirstResponse, previousFirstResponse, " min"),
      tone: currentFirstResponse <= previousFirstResponse ? "text-[#20bf6b]" : "text-rose-500",
    },
    {
      icon: Headphones,
      label: "Em atendimento",
      value: String(currentInAttendance),
      delta: deltaLabel(currentInAttendance, previousInAttendance),
      tone: "text-muted-foreground",
    },
    {
      icon: UserRound,
      label: "Aguardando cliente",
      value: String(currentWaiting),
      delta: deltaLabel(currentWaiting, previousWaiting),
      tone: "text-muted-foreground",
    },
    {
      icon: AlertTriangle,
      label: "Fora do SLA",
      value: String(currentLate),
      delta: deltaLabel(currentLate, previousLate),
      tone: currentLate <= previousLate ? "text-[#20bf6b]" : "text-rose-500",
    },
  ];
  const slaSpark = Array.from({ length: 7 }, (_, index) => {
    const start = addDays(today, index - 6).getTime();
    const end = addDays(today, index - 5).getTime();
    const daily = tickets.filter((ticket) => {
      const opened = new Date(ticket.openedAt).getTime();
      return opened >= start && opened < end;
    });
    return daily.length
      ? Math.round(
          (daily.filter((ticket) => computeSla(ticket, now).pct < 100).length / daily.length) * 100,
        )
      : 0;
  });
  const sparkMax = Math.max(...slaSpark);
  const sparkMin = Math.min(...slaSpark);
  const sparkPoints = slaSpark
    .map((v, i) => {
      const x = (i / (slaSpark.length - 1)) * 100;
      const y = 100 - ((v - sparkMin) / Math.max(1, sparkMax - sparkMin)) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card className="rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)]">
      <div className="grid gap-6 md:grid-cols-[1fr_220px] md:items-center">
        <div>
          <h3 className="text-base font-bold text-foreground">Saúde do atendimento</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tempo médio, SLA e taxa de resolução consolidados.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <InfoPill icon={Clock3} label="Tempo médio" value={avgHandlingLabel} />
            <InfoPill icon={CheckCircle2} label="Resolução" value={`${resolutionRate}%`} />
            <InfoPill icon={UserRound} label="Portal" value={String(portalTickets)} />
          </div>
        </div>
        <Gauge value={slaMedio} />
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Indicadores da semana
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {weekIndicators.map(({ icon: Icon, label, value, delta, tone }) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-lg bg-muted/40 dark:bg-white/[0.03] px-3 py-2"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
                <span className={cn("text-[10px] font-medium tabular-nums", tone)}>{delta}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/40 dark:bg-white/[0.03] px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">Evolução do SLA</p>
            <p className="text-sm font-bold text-foreground">
              {slaMedio}%{" "}
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                dados dos chamados
              </span>
            </p>
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-24 shrink-0">
            <polyline
              fill="none"
              stroke="#0b97c4"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparkPoints}
            />
          </svg>
        </div>
      </div>
    </Card>
  );
}

function InfoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Headphones;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 82;
  const stroke = 20;
  const progress = Math.max(0, Math.min(1, value / 100));
  const circumference = Math.PI * r;
  const dash = circumference * progress;
  const angleDeg = -180 + 180 * progress;
  const needleLength = r - 6;
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = cx + needleLength * Math.cos(rad);
  const tipY = cy + needleLength * Math.sin(rad);

  return (
    <div className="mx-auto flex w-full max-w-[220px] flex-col items-center">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "2 / 1" }}>
        <svg
          viewBox={`0 0 ${size} ${size / 2 + 4}`}
          className="block h-auto w-full"
          aria-hidden="true"
        >
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="rgba(139,145,173,0.22)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#0b97c4"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
          <circle cx={cx} cy={cy} r={28} fill="rgba(11,151,196,0.14)" />
          <circle cx={cx} cy={cy} r={16} fill="#0b97c4" />
          <line
            x1={cx}
            y1={cy}
            x2={tipX}
            y2={tipY}
            stroke="#313866"
            strokeWidth={7}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={4} fill="#ffffff" />
        </svg>
      </div>
      <p className="mt-1 text-sm font-bold text-muted-foreground">
        SLA médio <span className="text-[#20bf6b]">{value}%</span>
      </p>
    </div>
  );
}

const statusChartColorMap: Record<string, string> = {
  "Em Aberto": "#f43f5e",
  "Em andamento": "#3b82f6",
  Ocupado: "#f59e0b",
  "Aguardando cliente": "#10b981",
  "Com especialista": "#8b5cf6",
  Agendamento: "#f97316",
  Finalizado: "#22c55e",
  Atrasado: "#ef4444",
  Cancelado: "#94a3b8",
};

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function polarAreaPath(
  cx: number,
  cy: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${cx} ${cy}`,
    "Z",
  ].join(" ");
}

function StatusCategoriesCard({ data }: { data: { status: TicketStatus; total: number }[] }) {
  const [activeStatus, setActiveStatus] = useState<TicketStatus | null>(null);
  const max = Math.max(1, ...data.map((item) => item.total));
  const totalAll = data.reduce((acc, item) => acc + item.total, 0) || 1;
  const cx = 140;
  const cy = 114;
  const minRadius = 72;
  const maxRadius = 108;
  const angleStep = 360 / Math.max(1, data.length);
  const gap = 1.5;
  const rotation = 0;

  const toggle = (status: TicketStatus) =>
    setActiveStatus((prev) => (prev === status ? null : status));

  return (
    <Card className="rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)]">
      <h3 className="text-base font-bold text-foreground">Chamados por status</h3>
      <p className="mt-1 text-xs text-muted-foreground">Distribuição atual do funil.</p>
      <div className="mt-4 flex h-[220px] items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 280 230"
          className="h-full w-full max-w-[280px]"
          role="img"
          aria-label="Chamados por status"
        >
          {data.map((item, index) => {
            const startAngle = rotation + index * angleStep + gap / 2;
            const endAngle = rotation + (index + 1) * angleStep - gap / 2;
            const normalized = item.total / max;
            const outerRadius = minRadius + (maxRadius - minRadius) * Math.max(0.22, normalized);
            const midAngle = (startAngle + endAngle) / 2;
            const isActive = activeStatus === item.status;
            const hasActive = activeStatus !== null;
            const baseOffset = item.total === max || index % 3 === 1 ? 7 : 0;
            const offset = isActive ? baseOffset + 8 : baseOffset;
            const exploded = polarPoint(0, 0, offset, midAngle);
            const color = statusChartColorMap[item.status] ?? "#94a3b8";

            return (
              <path
                key={item.status}
                d={polarAreaPath(
                  cx + exploded.x,
                  cy + exploded.y,
                  outerRadius,
                  startAngle,
                  endAngle,
                )}
                fill={color}
                stroke="hsl(var(--card))"
                strokeWidth="2"
                onClick={() => toggle(item.status)}
                style={{
                  cursor: "pointer",
                  opacity: hasActive && !isActive ? 0.35 : 1,
                  transition: "opacity 200ms, transform 200ms",
                }}
                className="hover:opacity-90"
              >
                <title>{`${item.status}: ${item.total} chamado${item.total === 1 ? "" : "s"}`}</title>
              </path>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-4 divide-y divide-border/60 sm:grid-cols-2 sm:gap-x-5 sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*]:border-border/60">
        {data.map((item) => {
          const color = statusChartColorMap[item.status] ?? "#94a3b8";
          const pct = (item.total / totalAll) * 100;
          const percentLabel =
            pct > 0 && pct < 0.01
              ? "<0,01%"
              : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
          const isActive = activeStatus === item.status;
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => toggle(item.status)}
              className={cn(
                "group flex flex-col gap-1.5 rounded-md px-2 py-2 text-left transition",
                "hover:bg-muted/40 dark:hover:bg-white/[0.03]",
                isActive && "bg-muted/60 dark:bg-white/[0.05]",
              )}
              style={{ cursor: "pointer" }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="min-w-0 flex-1 whitespace-nowrap text-[12px] font-medium text-foreground">
                  {item.status}
                </span>
                <span className="ml-auto text-[13px] font-medium tabular-nums text-foreground">
                  {item.total}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-[18px]">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/70 dark:bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, minWidth: item.total ? 2 : 0, background: color }}
                  />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {percentLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SourceModuleCard({
  sources,
  modules,
  tickets,
}: {
  sources: { source: string; label: string; total: number }[];
  modules: { label: string; total: number }[];
  tickets: SupportTicket[];
}) {
  const [showTopics, setShowTopics] = useState(false);
  const sourceMax = Math.max(1, ...sources.map((s) => s.total));
  const moduleMax = Math.max(1, ...modules.map((m) => m.total));
  const topSource = [...sources].sort((a, b) => b.total - a.total)[0];
  const topModule = modules[0];
  const hourCounts = new Map<number, number>();
  tickets.forEach((ticket) => {
    const date = new Date(ticket.openedAt);
    if (Number.isNaN(date.getTime())) return;
    hourCounts.set(date.getHours(), (hourCounts.get(date.getHours()) ?? 0) + 1);
  });
  const peakHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const sourcePct =
    tickets.length && topSource ? Math.round((topSource.total / tickets.length) * 100) : 0;
  const modulePct =
    tickets.length && topModule ? Math.round((topModule.total / tickets.length) * 100) : 0;
  const moduleTopics = useMemo(() => {
    const grouped = new Map<string, Map<string, { label: string; total: number }>>();
    tickets.forEach((ticket) => {
      const module = analyticsModuleLabel(ticket.module.split(" - ").pop() ?? ticket.module);
      const label = ticket.subject?.replace(/\s+/g, " ").trim() || "Assunto não informado";
      const key = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .toLocaleLowerCase("pt-BR");
      const topics = grouped.get(module) ?? new Map<string, { label: string; total: number }>();
      const current = topics.get(key) ?? { label, total: 0 };
      current.total += 1;
      topics.set(key, current);
      grouped.set(module, topics);
    });
    return Array.from(grouped.entries())
      .map(([module, topics]) => ({
        module,
        total: Array.from(topics.values()).reduce((sum, topic) => sum + topic.total, 0),
        topics: Array.from(topics.values())
          .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"))
          .slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total);
  }, [tickets]);
  return (
    <Card className="rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Origem & Módulo</h3>
          <p className="mt-1 text-xs text-muted-foreground">Canais e áreas mais acionadas.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 cursor-pointer gap-2 px-3 text-xs font-semibold"
          onClick={() => setShowTopics(true)}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Ver assuntos
        </Button>
      </div>

      <div className="mt-4">
        <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <PhoneCall className="h-3 w-3" /> Origem
        </p>
        <div className="space-y-2">
          {sources.map((item) => (
            <BarRow
              key={item.source}
              label={item.label}
              value={item.total}
              max={sourceMax}
              color="#0b97c4"
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3 w-3" /> Módulo
        </p>
        <div className="space-y-2">
          {modules.map((item) => (
            <BarRow
              key={item.label}
              label={item.label}
              value={item.total}
              max={moduleMax}
              color="#8d6bd8"
            />
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Resumo do período
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 divide-border/60 sm:grid-cols-4 sm:divide-x">
          {[
            { icon: PhoneCall, label: "Canal principal", value: topSource?.label ?? "—" },
            { icon: Layers, label: "Módulo mais acionado", value: topModule?.label ?? "—" },
            { icon: MessageSquarePlus, label: "Chamados", value: String(tickets.length) },
            {
              icon: CalendarClock,
              label: "Horário de pico",
              value: peakHour === undefined ? "—" : `${peakHour}h–${peakHour + 1}h`,
            },
          ].map(({ icon: Icon, label, value }, i) => (
            <div key={label} className={cn("flex flex-col gap-0.5", i > 0 && "sm:pl-3")}>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <span className="text-sm font-bold text-foreground">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-muted/40 dark:bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {topSource?.label ?? "Nenhum canal"} concentra {sourcePct}% dos chamados e{" "}
          {topModule?.label ?? "nenhum módulo"} representa {modulePct}% das solicitações.
        </p>
      </div>
      <Dialog open={showTopics} onOpenChange={setShowTopics}>
        <DialogContent className="flex max-h-[86vh] max-w-4xl flex-col gap-0 overflow-hidden border border-border p-0 shadow-2xl sm:max-w-4xl sm:p-0">
          <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <BookOpenText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg text-foreground">
                  Principais assuntos por módulo
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  Os três problemas mais registrados em cada módulo no período selecionado
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-muted/10 px-6 py-5 sm:px-7">
            <div className="grid gap-3 md:grid-cols-2">
              {moduleTopics.map((item) => (
                <article
                  key={item.module}
                  className="overflow-hidden rounded-md border bg-background shadow-sm"
                >
                  <header className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                    <span className="truncate text-sm font-bold">{item.module}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                      {item.total} chamados
                    </span>
                  </header>
                  <div className="space-y-2.5 px-4 py-3">
                    {item.topics.map((topic, index) => (
                      <div key={`${item.module}-${topic.label}`} className="flex items-start gap-2">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
                          {topic.label}
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums">
                          {topic.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4 sm:px-7">
            <Button type="button" variant="outline" onClick={() => setShowTopics(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3">
      <span className="truncate text-[12px] font-medium text-foreground">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-right text-[12px] font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

export function TicketsAnalyticsSection({ from = "", to = "" }: { from?: string; to?: string }) {
  const allTickets = useTickets();
  const supportTickets = useMemo(() => {
    if (!from && !to) return allTickets;
    let start = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    let end = to ? new Date(`${to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    if (from && to && start > end) [start, end] = [end, start];
    return allTickets.filter((ticket) => {
      const opened = new Date(ticket.openedAt).getTime();
      return Number.isFinite(opened) && opened >= start && opened <= end;
    });
  }, [allTickets, from, to]);
  const hasDateFilter = Boolean(from || to);

  const statusDistribution = ticketStatuses
    .filter((status) => status !== "Atrasado" && status !== "Cancelado")
    .map((status) => ({
      status,
      total: supportTickets.filter((ticket) => ticket.status === status).length,
    }))
    .filter((item) => item.total > 0);

  const sourceDistribution = (["Portal do cliente", "Telefone", "WhatsApp", "Email"] as const).map(
    (source) => ({
      source,
      label: sourceLabels[source],
      total: supportTickets.filter((ticket) => ticket.source === source).length,
    }),
  );

  const moduleMap = new Map<string, number>();
  supportTickets.forEach((ticket) => {
    const key = analyticsModuleLabel(ticket.module.split(" - ").pop() ?? ticket.module);
    moduleMap.set(key, (moduleMap.get(key) ?? 0) + 1);
  });
  const moduleDistribution = Array.from(moduleMap.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <section className="space-y-6">
      <TicketsIndicatorCards tickets={supportTickets} filtered={hasDateFilter} />

      <AnalyticsOverview tickets={supportTickets} rangeEnd={to || from} />

      <div className="analytics-detail-heading">
        <h2>Análise detalhada</h2>
        <span>Operadores, empresas e módulos</span>
      </div>

      <div
        id="analytics-detalhado"
        className="grid scroll-mt-24 grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.35fr]"
      >
        <TopAgentsCard tickets={supportTickets} />
        <StatisticsCard tickets={allTickets} rangeStart={from} rangeEnd={to} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WeeklyBacklogCard tickets={supportTickets} filtered={hasDateFilter} />
        <SlaProfileCard tickets={supportTickets} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatusCategoriesCard data={statusDistribution} />
        <SourceModuleCard
          sources={sourceDistribution}
          modules={moduleDistribution}
          tickets={supportTickets}
        />
      </div>
    </section>
  );
}
