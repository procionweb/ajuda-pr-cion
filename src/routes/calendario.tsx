import { useMemo, useState, useEffect, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  KeyRound,
  Laptop,
  Link2,
  Lock,
  MapPin,
  Plus,
  SlidersHorizontal,
  Undo2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { cn } from "@/lib/utils";
import {
  useUsages,
  createUsageForAppointment,
  getUsageByAppointment,
  cancelReservationByEvent,
} from "@/lib/fleet-store";
import { fleetActions } from "@/lib/fleet-action-store";
import { listCrmCalendarEvents } from "@/lib/calendar-api";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { EventDetailsModal } from "@/components/calendar/EventDetailsModal";
import {
  useLocalEvents,
  addLocalEvent,
  updateLocalEvent,
  isLocalEvent,
} from "@/lib/local-events-store";
import { useOperatorAcronyms } from "@/lib/collaborators-store";
import {
  TYPE_ICON,
  EVENT_TONE_LABEL,
  EVENT_TONE_STYLES,
  getEventTone,
  type CalendarEvent,
  type EventStatus,
  type EventType,
} from "@/lib/calendar-events";

const preventOutsideClose = (event: Event) => event.preventDefault();

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [{ title: "Calendário - Portal Prócion" }] }),
  loader: () => listCrmCalendarEvents(),
  component: CalendarPage,
});

const initialEvents: CalendarEvent[] = [
  {
    id: 1,
    date: "2026-07-02",
    time: "08:00",
    end: "09:30",
    type: "Visita presencial",
    origin: "Comercial",
    operator: "PRCGIN",
    title: "Visita técnica",
    client: "ICF · INCOFAP",
    needsDisplacement: true,
    address: "Av. Central, 720, Campinas/SP",
  },
  {
    id: 2,
    date: "2026-07-03",
    time: "09:00",
    end: "10:00",
    type: "Reunião remota",
    origin: "Suporte",
    operator: "PRCROG",
    title: "Acompanhamento",
    client: "CPB · CAMPO BELO ALIMENTOS",
  },
  {
    id: 3,
    date: "2026-07-06",
    time: "08:30",
    end: "11:00",
    type: "Visita presencial",
    origin: "Comercial",
    operator: "PRCJAC",
    title: "Implantação",
    client: "EIN · EUROIND",
    needsDisplacement: true,
    address: "Av. Industrial, 1500, Sorocaba/SP",
  },
  {
    id: 4,
    date: "2026-07-08",
    time: "13:30",
    end: "15:00",
    type: "Visita presencial",
    origin: "Suporte",
    operator: "PRCREN",
    title: "Treinamento",
    client: "FRU · FRUTAVO",
    needsDisplacement: false,
  },
  {
    id: 5,
    date: "2026-07-10",
    time: "14:00",
    end: "15:00",
    type: "Reunião remota",
    origin: "Suporte",
    operator: "PRCROG",
    title: "Revisão de processo",
    client: "AVC · CENTER GLASS",
  },
  {
    id: 6,
    date: "2026-07-13",
    time: "08:30",
    end: "10:30",
    type: "Visita presencial",
    origin: "Comercial",
    operator: "PRCJAC",
    title: "Visita comercial",
    client: "USB · US BRASIL",
    needsDisplacement: true,
    address: "Av. Paulista, 1000, São Paulo/SP",
  },
  {
    id: 7,
    date: "2026-07-14",
    time: "14:00",
    end: "15:00",
    type: "Reunião na Prócion",
    origin: "Administração",
    operator: "PRCROG",
    title: "Reunião da equipe",
  },
  {
    id: 8,
    date: "2026-07-15",
    time: "14:00",
    end: "15:00",
    type: "Pessoal",
    origin: "Administração",
    operator: "PRCREN",
    title: "Médico",
  },
  {
    id: 9,
    date: "2026-07-17",
    time: "08:30",
    end: "10:00",
    type: "Visita presencial",
    origin: "Suporte",
    operator: "PRCGIN",
    title: "Validação final",
    client: "ICF · INCOFAP",
    needsDisplacement: true,
    address: "Av. Central, 720, Campinas/SP",
  },
  {
    id: 10,
    date: "2026-07-17",
    time: "14:00",
    end: "15:00",
    type: "Reunião remota",
    origin: "Suporte",
    operator: "PRCSUZ",
    title: "Retorno de chamado",
    client: "MIT · MINERAÇÃO ITAPORANGA",
  },
  {
    id: 11,
    date: "2026-07-21",
    time: "14:00",
    end: "16:00",
    type: "Visita presencial",
    origin: "Comercial",
    operator: "PRCJAC",
    title: "Apresentação",
    client: "NUT · NUTRIVET BRASIL",
    needsDisplacement: true,
    address: "Rod. Anhanguera, km 90, Jundiaí/SP",
  },
  {
    id: 12,
    date: "2026-07-24",
    time: "14:00",
    end: "15:00",
    type: "Reunião na Prócion",
    origin: "Administração",
    operator: "PRCGGC",
    title: "Planejamento mensal",
  },
];

const typeOptions = [
  "Todos",
  "Visita presencial",
  "Reunião remota",
  "Reunião na Prócion",
  "Pessoal",
] as const;
const originOptions = ["Todas", "Administração", "Suporte", "Comercial"] as const;
const statusOptions = ["Todos", "Agendado", "Em andamento", "Concluído", "Cancelado"] as const;
const monthOptions = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Filters = {
  query: string;
  type: string;
  origin: string;
  operator: string;
  client: string;
  status: string;
  dateStart?: Date;
  dateEnd?: Date;
};

const emptyFilters: Filters = {
  query: "",
  type: "Todos",
  origin: "Todas",
  operator: "Todos",
  client: "",
  status: "Todos",
  dateStart: undefined,
  dateEnd: undefined,
};

const typeStyles: Record<EventType, { dot: string; soft: string; text: string; icon: typeof Car }> =
  {
    "Visita presencial": {
      dot: "bg-emerald-500",
      soft: "bg-emerald-500/10",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: Car,
    },
    "Reunião remota": {
      dot: "bg-sky-500",
      soft: "bg-sky-500/10",
      text: "text-sky-700 dark:text-sky-300",
      icon: Laptop,
    },
    "Reunião na Prócion": {
      dot: "bg-violet-500",
      soft: "bg-violet-500/10",
      text: "text-violet-700 dark:text-violet-300",
      icon: UsersRound,
    },
    Pessoal: {
      dot: "bg-amber-500",
      soft: "bg-amber-500/12",
      text: "text-amber-700 dark:text-amber-300",
      icon: UserRound,
    },
  };

function dateKey(year: number, month: number, day: number) {
  const value = new Date(year, month, day);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function CalendarPage() {
  const importedEvents = Route.useLoaderData();
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const localEvents = useLocalEvents();
  const [events, setEvents] = useState<CalendarEvent[]>(importedEvents);
  const allEvents = useMemo(() => {
    const merged = new Map<string, CalendarEvent>();
    events.forEach((event) => merged.set(String(event.id), event));
    localEvents.forEach((event) => merged.set(String(event.id), event));
    return Array.from(merged.values());
  }, [events, localEvents]);
  const [createOpen, setCreateOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [calendarNow, setCalendarNow] = useState(() => new Date());

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const operatorOptions = ["Todos", ...useOperatorAcronyms()];

  useEffect(() => {
    if (filtersOpen) setDraft(filters);
  }, [filtersOpen, filters]);

  useEffect(() => {
    const timer = window.setInterval(() => setCalendarNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    return allEvents.filter((event) => {
      const status = event.status ?? "Agendado";
      if (filters.type !== "Todos" && event.type !== filters.type) return false;
      if (filters.origin !== "Todas" && event.origin !== filters.origin) return false;
      if (filters.operator !== "Todos" && event.operator !== filters.operator) return false;
      if (filters.status !== "Todos" && status !== filters.status) return false;
      if (filters.client.trim()) {
        const c = (event.client || "").toLowerCase();
        if (!c.includes(filters.client.trim().toLowerCase())) return false;
      }
      if (filters.query.trim()) {
        const haystack = `${event.title} ${event.client || ""} ${event.operator}`.toLowerCase();
        if (!haystack.includes(filters.query.trim().toLowerCase())) return false;
      }
      if (filters.dateStart) {
        const d = new Date(`${event.date}T00:00:00`);
        const s = new Date(filters.dateStart);
        s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
      if (filters.dateEnd) {
        const d = new Date(`${event.date}T00:00:00`);
        const e = new Date(filters.dateEnd);
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
      return true;
    });
  }, [allEvents, filters]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.query.trim()) n++;
    if (filters.type !== "Todos") n++;
    if (filters.origin !== "Todas") n++;
    if (filters.operator !== "Todos") n++;
    if (filters.client.trim()) n++;
    if (filters.status !== "Todos") n++;
    if (filters.dateStart) n++;
    if (filters.dateEnd) n++;
    return n;
  }, [filters]);

  const removeFilter = (k: keyof Filters) =>
    setFilters((p) => ({ ...p, [k]: emptyFilters[k] }) as Filters);

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.query.trim())
    chips.push({
      key: "query",
      label: `Busca: "${filters.query}"`,
      onRemove: () => removeFilter("query"),
    });
  if (filters.type !== "Todos")
    chips.push({
      key: "type",
      label: `Tipo: ${filters.type}`,
      onRemove: () => removeFilter("type"),
    });
  if (filters.origin !== "Todas")
    chips.push({
      key: "origin",
      label: `Origem: ${filters.origin}`,
      onRemove: () => removeFilter("origin"),
    });
  if (filters.operator !== "Todos")
    chips.push({
      key: "operator",
      label: `Operador: ${filters.operator}`,
      onRemove: () => removeFilter("operator"),
    });
  if (filters.client.trim())
    chips.push({
      key: "client",
      label: `Cliente: ${filters.client}`,
      onRemove: () => removeFilter("client"),
    });
  if (filters.status !== "Todos")
    chips.push({
      key: "status",
      label: `Status: ${filters.status}`,
      onRemove: () => removeFilter("status"),
    });
  if (filters.dateStart)
    chips.push({
      key: "dateStart",
      label: `De: ${format(filters.dateStart, "dd/MM/yyyy")}`,
      onRemove: () => removeFilter("dateStart"),
    });
  if (filters.dateEnd)
    chips.push({
      key: "dateEnd",
      label: `Até: ${format(filters.dateEnd, "dd/MM/yyyy")}`,
      onRemove: () => removeFilter("dateEnd"),
    });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    cursor,
  );
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = index - firstWeekday + 1;
    if (value < 1)
      return {
        day: previousMonthDays + value,
        current: false,
        key: dateKey(year, month - 1, previousMonthDays + value),
      };
    if (value > daysInMonth)
      return {
        day: value - daysInMonth,
        current: false,
        key: dateKey(year, month + 1, value - daysInMonth),
      };
    return { day: value, current: true, key: dateKey(year, month, value) };
  });
  const selectedEvents = filtered
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    setSelectedDate(dateKey(next.getFullYear(), next.getMonth(), 1));
  };

  const selectCalendarMonth = (nextMonth: number) => {
    const next = new Date(year, nextMonth, 1);
    setCursor(next);
    setSelectedDate(dateKey(next.getFullYear(), next.getMonth(), 1));
  };

  const selectCalendarYear = (nextYear: number) => {
    const next = new Date(nextYear, month, 1);
    setCursor(next);
    setSelectedDate(dateKey(next.getFullYear(), next.getMonth(), 1));
  };

  const availableYears = Array.from(
    new Set([today.getFullYear(), year, ...allEvents.map((event) => Number(event.date.slice(0, 4)))]),
  )
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  const detailIsLocal = detailEvent
    ? isLocalEvent(detailEvent.id) || Boolean(detailEvent.editable)
    : false;
  const detailTone = detailEvent ? getEventTone(detailEvent) : null;

  const persistEvent = (event: CalendarEvent) => {
    if (isLocalEvent(event.id) || event.editable) updateLocalEvent(event.id, event);
    else addLocalEvent(event);
    setDetailEvent(event);
  };

  const handleCancelEvent = (event: CalendarEvent) => {
    persistEvent({ ...event, status: "Cancelado" });
    cancelReservationByEvent(event.id);
    setDetailEvent(null);
    toast.success("Agendamento cancelado");
  };

  const handleSaveReport = (event: CalendarEvent, completed: boolean) => {
    persistEvent(event);
    if (completed || event.report?.completed) {
      cancelReservationByEvent(event.id);
      setDetailEvent(null);
      toast.success("Relatório salvo e agendamento concluído");
      return;
    }
    toast.success("Relatório salvo");
  };

  const handlePickupFromDetail = (event: CalendarEvent) => {
    const usage =
      getUsageByAppointment(event.id) ??
      createUsageForAppointment({
        appointmentId: event.id,
        operatorId: event.responsible ?? event.operator,
        vehicleId: event.vehicleId,
        client: event.client,
        destination: event.address
          ? `${event.client ?? ""} — ${event.address}`.trim().replace(/^—\s+/, "")
          : (event.client ?? event.title),
        scheduledStartAt: `${event.date}T${event.time}:00`,
        expectedReturnAt: `${event.date}T${event.end}:00`,
      });
    setDetailEvent(null);
    fleetActions.openPickup(usage.id);
  };

  return (
    <AppShell>
      <PageHeader
        title="Calendário"
        description="Visitas, reuniões e compromissos da equipe em um só lugar."
        breadcrumbs={[{ label: "Calendário" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAgendaOpen(true)}
              className="h-10 cursor-pointer gap-2 rounded-lg px-4 text-sm font-medium"
            >
              <CalendarDays className="h-4 w-4" />
              Agenda
            </Button>
            <Button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="h-10 cursor-pointer gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-md hover:bg-blue-700"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px] font-semibold">
                  {activeCount}
                </span>
              )}
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
              <Plus className="mr-1.5 h-4 w-4" />
              Novo evento
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <FieldSelect
          label="Tipo"
          value={filters.type}
          onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
          options={typeOptions.map((option) => ({ value: option, label: option }))}
        />
        <FieldSelect
          label="Origem"
          value={filters.origin}
          onChange={(value) => setFilters((current) => ({ ...current, origin: value }))}
          options={originOptions.map((option) => ({ value: option, label: option }))}
        />
        <FieldSelect
          label="Operador"
          value={filters.operator}
          onChange={(value) => setFilters((current) => ({ ...current, operator: value }))}
          options={operatorOptions.map((option) => ({ value: option, label: option }))}
        />
        <FieldSelect
          label="Status"
          value={filters.status}
          onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          options={statusOptions.map((option) => ({ value: option, label: option }))}
        />
        <FieldSelect
          label="Mês"
          value={String(month)}
          onChange={(value) => selectCalendarMonth(Number(value))}
          options={monthOptions.map((label, value) => ({ value: String(value), label }))}
        />
        <FieldSelect
          label="Ano"
          value={String(year)}
          onChange={(value) => selectCalendarYear(Number(value))}
          options={availableYears.map((value) => ({ value: String(value), label: String(value) }))}
        />
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setFilters(emptyFilters)}
            className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Limpar todos
          </button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => moveMonth(-1)}
              className="cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => moveMonth(1)}
              className="cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="capitalize text-lg font-medium">{monthTitle}</h2>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(EVENT_TONE_STYLES) as (keyof typeof EVENT_TONE_STYLES)[]).map((tone) => (
              <span key={tone} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", EVENT_TONE_STYLES[tone].dot)} />
                {EVENT_TONE_LABEL[tone]}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-border bg-muted/20">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayEvents = filtered
              .filter((event) => event.date === cell.key)
              .sort((a, b) => a.time.localeCompare(b.time));
            const selected = selectedDate === cell.key;
            const isToday = cell.key === todayKey;
            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => {
                  setSelectedDate(cell.key);
                  setAgendaOpen(true);
                }}
                className={cn(
                  "group min-h-[118px] cursor-pointer border-b border-r border-border p-2 text-left align-top transition-colors hover:bg-primary/[0.035]",
                  !cell.current && "bg-muted/15 text-muted-foreground/45",
                  selected && "bg-primary/[0.06] ring-1 ring-inset ring-primary/25",
                )}
              >
                <span
                  className={cn(
                    "mb-1.5 grid h-7 w-7 place-items-center rounded-full text-xs",
                    isToday && "bg-primary text-primary-foreground",
                    selected && !isToday && "bg-primary/10 text-primary",
                  )}
                >
                  {cell.day}
                </span>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <CalendarEventPill key={event.id} event={event} now={calendarNow} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="block pl-1 text-[10px] text-primary">
                      +{dayEvents.length - 3} eventos
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Sheet open={agendaOpen} onOpenChange={setAgendaOpen}>
        <SheetContent side="right" className="flex w-[90vw] flex-col gap-0 p-0 sm:max-w-[420px]">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-base font-medium">
              {new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }).format(new Date(`${selectedDate}T12:00:00`))}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
            <section className="flex h-full flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Agenda do dia</p>
                <Badge variant="secondary">{selectedEvents.length}</Badge>
              </div>
              <div className="space-y-3">
                {selectedEvents.length ? (
                  selectedEvents.map((event) => (
                    <AgendaItem
                      key={event.id}
                      event={event}
                      now={calendarNow}
                      onOpen={setDetailEvent}
                    />
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
                    <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/45" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Nenhum compromisso neste dia.
                    </p>
                    <Button
                      variant="link"
                      onClick={() => setCreateOpen(true)}
                      className="mt-1 cursor-pointer"
                    >
                      Adicionar evento
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDate={selectedDate}
        existingEvents={allEvents}
        onCreate={(event) => {
          addLocalEvent(event);
          setSelectedDate(event.date);
          toast.success("Evento adicionado ao calendário");
        }}
      />

      {editingEvent && (
        <CreateEventDialog
          key={`edit-${editingEvent.id}`}
          open
          onOpenChange={(next) => {
            if (!next) setEditingEvent(null);
          }}
          initialDate={editingEvent.date}
          existingEvents={allEvents}
          editingEvent={editingEvent}
          onCreate={(payload) => {
            updateLocalEvent(editingEvent.id, payload);
            setSelectedDate(payload.date);
            setEditingEvent(null);
            toast.success("Agendamento atualizado");
          }}
        />
      )}

      <EventDetailsModal
        event={detailEvent}
        open={Boolean(detailEvent)}
        onOpenChange={(next) => {
          if (!next) setDetailEvent(null);
        }}
        canEdit={detailIsLocal && detailTone !== "cancelled" && detailTone !== "done"}
        canCancel={detailTone !== "cancelled" && detailTone !== "done"}
        onEdit={(event) => {
          setDetailEvent(null);
          setEditingEvent(event);
        }}
        onCancelEvent={handleCancelEvent}
        onSaveReport={handleSaveReport}
        onPickupVehicle={handlePickupFromDetail}
      />

      <FiltersPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        draft={draft}
        setDraft={setDraft}
        onApply={() => {
          setFilters(draft);
          setFiltersOpen(false);
        }}
        onClear={() => setDraft(emptyFilters)}
      />
    </AppShell>
  );
}

function FiltersPanel({
  open,
  onOpenChange,
  draft,
  setDraft,
  onApply,
  onClear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: Filters;
  setDraft: React.Dispatch<React.SetStateAction<Filters>>;
  onApply: () => void;
  onClear: () => void;
}) {
  const update = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const operators = ["Todos", ...useOperatorAcronyms()];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg font-semibold">Filtros do calendário</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <FieldText
              label="Pesquisa geral"
              value={draft.query}
              onChange={(v) => update("query", v)}
              placeholder="Cliente, compromisso, local ou operador"
            />
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect
                label="Tipo"
                value={draft.type}
                onChange={(v) => update("type", v)}
                options={typeOptions.map((o) => ({ value: o, label: o }))}
              />
              <FieldSelect
                label="Origem"
                value={draft.origin}
                onChange={(v) => update("origin", v)}
                options={originOptions.map((o) => ({ value: o, label: o }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect
                label="Operador"
                value={draft.operator}
                onChange={(v) => update("operator", v)}
                options={operators.map((o) => ({ value: o, label: o }))}
              />
              <FieldSelect
                label="Status"
                value={draft.status}
                onChange={(v) => update("status", v)}
                options={statusOptions.map((o) => ({ value: o, label: o }))}
              />
            </div>
            <FieldText
              label="Cliente"
              value={draft.client}
              onChange={(v) => update("client", v)}
              placeholder="Sigla ou razão social"
            />
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Período
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
            className="h-10 cursor-pointer rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700"
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CalendarEventPill({ event, now }: { event: CalendarEvent; now: Date }) {
  const tone = getEventTone(event, now);
  const toneStyle = EVENT_TONE_STYLES[tone];
  const Icon = typeStyles[event.type].icon;
  const operator = event.operator?.trim() ? event.operator : "SEM OPERADOR";
  const label = event.client || event.title;
  return (
    <span
      title={`${EVENT_TONE_LABEL[tone]} · ${event.type} · ${event.time} ${operator} - ${label}`}
      className={cn(
        "flex items-center gap-2 overflow-hidden rounded px-2 py-1 text-[10px]",
        toneStyle.solid,
      )}
    >
      <span className="shrink-0 tabular-nums">{event.time}</span>
      <Icon className="h-3 w-3 shrink-0" aria-label={event.type} />
      <span className="truncate">
        <span className="font-medium">{operator}</span>
        <span> - {label}</span>
      </span>
    </span>
  );
}

function AgendaItem({
  event,
  now,
  onOpen,
}: {
  event: CalendarEvent;
  now: Date;
  onOpen: (e: CalendarEvent) => void;
}) {
  const tone = getEventTone(event, now);
  const toneStyle = EVENT_TONE_STYLES[tone];
  const Icon = typeStyles[event.type].icon;
  // Reactively read usage tied to this appointment
  const usages = useUsages();
  const usage = usages.find((u) => u.appointmentId === event.id && u.status !== "cancelado");

  const needsFleet = event.type === "Visita presencial" && event.needsDisplacement === true;

  const openPickup = () => {
    const target =
      usage ??
      createUsageForAppointment({
        appointmentId: event.id,
        operatorId: event.operator,
        client: event.client,
        destination: event.address
          ? `${event.client ?? ""} — ${event.address}`.trim().replace(/^—\s+/, "")
          : (event.client ?? event.title),
        scheduledStartAt: `${event.date}T${event.time}:00`,
        expectedReturnAt: `${event.date}T${event.end}:00`,
      });
    fleetActions.openPickup(target.id);
  };
  const openReturn = () => {
    if (usage) fleetActions.openReturn(usage.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(event);
        }
      }}
      className={cn(
        "cursor-pointer rounded-md border border-l-[3px] border-border p-3 text-left transition-colors hover:border-primary/25 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        tone === "done" && "border-l-emerald-500",
        tone === "cancelled" && "border-l-rose-500",
        tone === "upcoming" && "border-l-orange-500",
        tone === "other" && "border-l-sky-500",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-md",
            toneStyle.soft,
            toneStyle.text,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{event.title}</p>
            <span className="text-xs text-muted-foreground">{event.time}</span>
          </div>
          {event.client && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.client}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{event.operator}</span>
            <span>{event.type}</span>
            <span className={toneStyle.text}>{EVENT_TONE_LABEL[tone]}</span>
          </div>

          {needsFleet && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(!usage || usage.status === "aguardando_retirada") && (
                <Button
                  size="sm"
                  className="h-8 cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPickup();
                  }}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Retirar veículo
                </Button>
              )}
              {usage?.status === "em_deslocamento" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReturn();
                  }}
                >
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  Devolver veículo
                </Button>
              )}
              {usage?.status === "devolvido" && (
                <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400">
                  Veículo devolvido
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create event dialog
// ---------------------------------------------------------------------------

// Reference unused-but-desired symbol for future integration
void getUsageByAppointment;
