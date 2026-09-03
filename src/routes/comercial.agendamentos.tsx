import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ClipboardList, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { EventDetailsModal } from "@/components/calendar/EventDetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/comercial/agendamentos")({
  head: () => ({ meta: [{ title: "Agendamentos Comercial - Portal Prócion" }] }),
  loader: () => listCrmCalendarEvents(),
  component: CommercialAppointmentsPage,
});

const PAGE_SIZE = 25;
const eventTypes: EventType[] = [
  "Visita presencial",
  "Reunião remota",
  "Reunião na Prócion",
  "Pessoal",
];
const eventStatuses: EventStatus[] = ["Agendado", "Concluído", "Cancelado"];

function CommercialAppointmentsPage() {
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

  const events = useMemo(() => {
    const merged = new Map<string, CalendarEvent>();
    persistedEvents.forEach((event) => merged.set(String(event.id), event));
    localEvents.forEach((event) => merged.set(String(event.id), event));
    return [...merged.values()]
      .filter((event) => event.origin === "Comercial")
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
      if (
        normalizedQuery &&
        !normalize(
          `${event.title} ${event.client || ""} ${responsible} ${event.description || ""}`,
        ).includes(normalizedQuery)
      )
        return false;
      return true;
    });
  }, [events, from, operator, query, status, to, type]);

  useEffect(() => setPage(0), [from, operator, query, status, to, type]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Agendamentos Comercial"
        description="Visitas, reuniões e compromissos da equipe comercial."
        breadcrumbs={[{ label: "Comercial" }, { label: "Agendamentos" }]}
      />

      <section className="mb-5 grid gap-3 xl:grid-cols-[190px_minmax(240px,1fr)_180px_200px_155px_155px_auto]">
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
            placeholder="Pesquisa"
            className="h-10 pl-9"
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
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="h-10"
          aria-label="Data inicial"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="h-10"
          aria-label="Data final"
        />
        <Button className="h-10" onClick={() => setPage(0)}>
          Buscar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-[13px] text-foreground">
            <colgroup>
              <col className="w-[45%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[3%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 text-[11px] uppercase text-muted-foreground">
              <tr>
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
                  <td colSpan={6} className="h-52 text-center text-muted-foreground">
                    Nenhum agendamento comercial encontrado.
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

      <EventDetailsModal
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
        hideFooterActions
      />
    </AppShell>
  );
}

function AppointmentRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const Icon = TYPE_ICON[event.type];
  const toneStyle = EVENT_TONE_STYLES[getEventTone(event)];
  const responsible = event.responsible || event.operator || "Não informado";
  return (
    <tr className="transition-colors hover:bg-muted/25">
      <td className="px-4 py-3">
        <p className="font-normal leading-snug text-foreground">
          {event.type.replace(" presencial", "")} - {event.client || event.title}
        </p>
        {event.client && (
          <p className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">
            {event.title}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary bg-primary/10">
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
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
