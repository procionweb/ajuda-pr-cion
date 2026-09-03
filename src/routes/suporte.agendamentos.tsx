import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Filter, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { DateRangeFilter } from "@/components/portal/DateRangeFilter";
import { SupportAppointmentDetailsModal } from "@/components/calendar/SupportAppointmentDetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listCrmCalendarEvents } from "@/lib/calendar-api";
import {
  EVENT_TONE_STYLES,
  TYPE_ICON,
  getEventTone,
  type CalendarEvent,
  type EventStatus,
  type EventType,
} from "@/lib/calendar-events";
import { useLocalEvents } from "@/lib/local-events-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/suporte/agendamentos")({
  head: () => ({ meta: [{ title: "Agendamentos Suporte - Portal Prócion" }] }),
  loader: () => listCrmCalendarEvents(),
  component: SupportAppointmentsPage,
});

const PAGE_SIZE = 25;
const eventTypes: EventType[] = [
  "Visita presencial",
  "Reunião remota",
  "Reunião na Prócion",
  "Pessoal",
];
const eventStatuses: EventStatus[] = ["Agendado", "Concluído", "Cancelado"];

function SupportAppointmentsPage() {
  const persistedEvents = Route.useLoaderData();
  const localEvents = useLocalEvents();
  const [operator, setOperator] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const events = useMemo(() => {
    const merged = new Map<string, CalendarEvent>();
    persistedEvents.forEach((event) => merged.set(String(event.id), event));
    localEvents.forEach((event) => merged.set(String(event.id), event));
    return [...merged.values()]
      .filter((event) => event.origin === "Suporte" || event.origin === "Administração")
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  }, [localEvents, persistedEvents]);

  const operators = useMemo(
    () =>
      [
        ...new Set(events.map((event) => event.responsible || event.operator).filter(Boolean)),
      ].sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query);
    return events.filter((event) => {
      const responsible = event.responsible || event.operator;
      if (operator && responsible !== operator) return false;
      if (status && (event.status || "Agendado") !== status) return false;
      if (type && event.type !== type) return false;
      if (from && event.date < from) return false;
      if (to && event.date > to) return false;
      const searchable = `${event.protocol || ""} ${event.title} ${event.client || ""} ${responsible} ${event.description || ""}`;
      return !normalizedQuery || normalize(searchable).includes(normalizedQuery);
    });
  }, [events, from, operator, query, status, to, type]);

  useEffect(() => setPage(0), [from, operator, query, status, to, type]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Agendamentos Suporte"
        description="Visitas, reuniões e compromissos do suporte criados no calendário ou nos chamados."
        breadcrumbs={[{ label: "Suporte" }, { label: "Agendamentos" }]}
        actions={
          <Button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="w-full gap-2 sm:w-auto xl:hidden"
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        }
      />

      <section className="mb-5 hidden gap-3 xl:grid xl:grid-cols-[180px_minmax(220px,1fr)_170px_190px_220px_auto]">
        <select
          value={operator}
          onChange={(event) => setOperator(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os operadores</option>
          {operators.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar chamado, título ou cliente"
            className="h-9 rounded-lg pl-9"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os status</option>
          {eventStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os tipos</option>
          {eventTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <DateRangeFilter
          from={from}
          to={to}
          onChange={(start, end) => {
            setFrom(start);
            setTo(end);
          }}
        />
        <Button className="h-9 rounded-lg" onClick={() => setPage(0)}>
          Buscar
        </Button>
      </section>

      <div className="space-y-2 xl:hidden">
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
            Nenhum agendamento de suporte encontrado.
          </div>
        ) : (
          rows.map((event) => (
            <AppointmentCard
              key={String(event.id)}
              event={event}
              onOpen={() => setSelectedEvent(event)}
            />
          ))
        )}
      </div>
      <div className="hidden overflow-hidden rounded-lg border bg-card xl:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-[13px] text-foreground">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[32%]" />
              <col className="w-[19%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-normal">ID do chamado</th>
                <th className="px-4 py-3 font-normal">Título</th>
                <th className="px-4 py-3 font-normal">Tipo / Status</th>
                <th className="px-4 py-3 font-normal">Responsável</th>
                <th className="px-4 py-3 font-normal">Dia</th>
                <th className="px-4 py-3 font-normal">Horário</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-52 text-center text-muted-foreground">
                    Nenhum agendamento de suporte encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((event) => (
                  <AppointmentRow
                    key={String(event.id)}
                    event={event}
                    onOpen={() => setSelectedEvent(event)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3">
        <ListPaginationFooter
          page={page}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          noun="agendamentos"
          onPageChange={setPage}
        />
      </div>

      <SupportAppointmentDetailsModal
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
      <AppointmentFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        operators={operators}
        operator={operator}
        setOperator={setOperator}
        query={query}
        setQuery={setQuery}
        status={status}
        setStatus={setStatus}
        type={type}
        setType={setType}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
      />
    </AppShell>
  );
}

function AppointmentCard({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const Icon = TYPE_ICON[event.type];
  const toneStyle = EVENT_TONE_STYLES[getEventTone(event)];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border bg-card p-4 text-left shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground">{event.client || event.title}</p>
          {event.client && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{event.title}</p>
          )}
        </div>
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
          <Icon className="h-3.5 w-3.5" />
          {event.type}
        </span>
        <span
          className={cn(
            "rounded px-2 py-1 text-[11px] font-medium",
            toneStyle.soft,
            toneStyle.text,
          )}
        >
          {event.status || "Agendado"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Responsável</dt>
          <dd className="mt-0.5 text-foreground">
            {event.responsible || event.operator || "Não informado"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Chamado</dt>
          <dd className="mt-0.5 text-foreground">{event.protocol || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dia</dt>
          <dd className="mt-0.5 text-foreground">{formatDate(event.date)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Horário</dt>
          <dd className="mt-0.5 whitespace-nowrap text-foreground">
            {event.time} - {event.end}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function AppointmentFiltersSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: string[];
  operator: string;
  setOperator: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
}) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Filtros de agendamentos</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.query}
              onChange={(e) => props.setQuery(e.target.value)}
              placeholder="Chamado, título ou cliente"
              className="h-9 rounded-lg pl-9"
            />
          </label>
          <select
            value={props.operator}
            onChange={(e) => props.setOperator(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos os operadores</option>
            {props.operators.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={props.status}
            onChange={(e) => props.setStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos os status</option>
            {eventStatuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={props.type}
            onChange={(e) => props.setType(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos os tipos</option>
            {eventTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Período</label>
            <DateRangeFilter
              from={props.from}
              to={props.to}
              onChange={(start, end) => {
                props.setFrom(start);
                props.setTo(end);
              }}
            />
          </div>
        </div>
        <div className="border-t p-4">
          <Button className="w-full" onClick={() => props.onOpenChange(false)}>
            Aplicar filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AppointmentRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const Icon = TYPE_ICON[event.type];
  const toneStyle = EVENT_TONE_STYLES[getEventTone(event)];
  const responsible = event.responsible || event.operator || "Não informado";
  return (
    <tr className="transition-colors hover:bg-muted/25">
      <td className="px-4 py-3 font-normal text-muted-foreground">{event.protocol || "—"}</td>
      <td className="px-4 py-3">
        <p className="font-normal leading-snug text-foreground">{event.client || event.title}</p>
        {event.client && (
          <p className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">
            {event.title}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
            <Icon className="h-3.5 w-3.5" />
            {event.type}
          </span>
          <span
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium",
              toneStyle.soft,
              toneStyle.text,
            )}
          >
            {event.status || "Agendado"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-normal text-foreground">{responsible}</td>
      <td className="px-4 py-3 font-normal tabular-nums text-foreground">
        {formatDate(event.date)}
      </td>
      <td className="px-4 py-3 font-normal tabular-nums text-foreground">
        {event.time} - {event.end}
      </td>
      <td className="px-3 py-3">
        <Button type="button" variant="ghost" size="icon" onClick={onOpen} title="Ver agendamento">
          <ClipboardList className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value;
}
const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
