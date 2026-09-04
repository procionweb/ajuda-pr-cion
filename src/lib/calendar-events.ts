import { Car, CalendarDays, Laptop, UsersRound } from "lucide-react";

export type EventType = "Visita presencial" | "Reunião remota" | "Reunião na Prócion" | "Pessoal";

export type EventStatus = "Agendado" | "Em andamento" | "Concluído" | "Cancelado";

export type EventReport = {
  permission: "Público" | "Clientes" | "Empresa";
  priority: "Baixa" | "Média" | "Alta";
  option: string;
  version: string;
  startedAt: string;
  endedAt: string;
  contact: string;
  notes: string;
  completedAt: string;
  completed: boolean;
};

export type CalendarEvent = {
  id: string | number;
  date: string;
  time: string;
  end: string;
  type: EventType;
  origin: "Administração" | "Suporte" | "Comercial";
  operator: string;
  title: string;
  /** Rótulo textual do cliente (sigla · razão social). */
  client?: string;
  /** ID real do cliente vinculado (quando criado a partir do cliente). */
  clientId?: string;
  status?: EventStatus;
  description?: string;
  /** Rótulos dos convidados (compatibilidade com registros antigos). */
  guests?: string[];
  /** Convidados vinculados ao colaborador importado (id, nome e e-mail). */
  guestList?: EventGuest[];
  needsDisplacement?: boolean;
  vehicleId?: string;
  address?: string;
  responsible?: string;
  creatorOperator?: string;
  reminderEnabled?: boolean;
  meetingLink?: string;
  platform?: string;
  room?: string;
  isPrivate?: boolean;
  /** Chamado vinculado (quando o evento nasceu de um chamado). */
  ticketId?: string;
  /** Protocolo do chamado vinculado. */
  protocol?: string;
  report?: EventReport;
  cancellationReason?: string;
  cancelledAt?: string;
  editable?: boolean;
};

/** Convidado do agendamento, sempre originado de tab_colaboradores. */
export type EventGuest = {
  id: string;
  name: string;
  email: string | null;
  acronym: string | null;
};

export const PLATFORM_OPTIONS = ["Google Meet", "Microsoft Teams", "Zoom", "AnyDesk"];
export const ROOM_OPTIONS = ["Sala Diretoria", "Sala Reuniões 1", "Auditório"];
export const PERSONAL_EVENT_OPTIONS = [
  "Médico",
  "Dentista",
  "Exame",
  "Assunto pessoal",
  "Compromisso particular",
];

export const TYPE_ICON: Record<EventType, typeof Car> = {
  "Visita presencial": Car,
  "Reunião remota": Laptop,
  "Reunião na Prócion": UsersRound,
  Pessoal: CalendarDays,
};

/** Tonalidade do evento derivada do status salvo + data/hora real. */
export type EventTone = "done" | "cancelled" | "upcoming" | "inProgress";

export const EVENT_TONE_LABEL: Record<EventTone, string> = {
  done: "Concluído",
  cancelled: "Cancelado",
  upcoming: "Agendado",
  inProgress: "Em andamento",
};

export const EVENT_TONE_STYLES: Record<
  EventTone,
  { dot: string; soft: string; text: string; solid: string }
> = {
  done: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/12",
    text: "text-emerald-700 dark:text-emerald-300",
    solid: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  },
  cancelled: {
    dot: "bg-rose-500",
    soft: "bg-rose-500/12",
    text: "text-rose-700 dark:text-rose-300",
    solid: "bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950",
  },
  upcoming: {
    dot: "bg-orange-500",
    soft: "bg-orange-500/12",
    text: "text-orange-700 dark:text-orange-300",
    solid: "bg-orange-600 text-white dark:bg-orange-500 dark:text-orange-950",
  },
  inProgress: {
    dot: "bg-sky-500",
    soft: "bg-sky-500/12",
    text: "text-sky-700 dark:text-sky-300",
    solid: "bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950",
  },
};

/** Converte a data e o horario locais do agendamento em um instante valido. */
export function eventStartInstant(
  event: Pick<CalendarEvent, "date" | "time">,
): Date | null {
  const clock = (event.time || "00:00").slice(0, 5);
  const parsed = new Date(`${event.date}T${clock}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Informa se o horario inicial do agendamento ja foi atingido. */
export function hasEventStarted(
  event: Pick<CalendarEvent, "date" | "time">,
  now: Date = new Date(),
): boolean {
  const instant = eventStartInstant(event);
  return Boolean(instant && instant.getTime() <= now.getTime());
}

function eventEndInstant(event: Pick<CalendarEvent, "date" | "time" | "end">): Date | null {
  const clock = (event.end || event.time || "00:00").slice(0, 5);
  const parsed = new Date(`${event.date}T${clock}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Regras de cor:
 * - Concluído → verde; Cancelado → vermelho.
 * - Agendado que ainda não aconteceu → laranja.
 * - Demais casos (ex.: agendado com data/hora já passada) → azul.
 * O status salvo sempre prevalece: data passada não conclui evento.
 */
export function getEventTone(
  event: Pick<CalendarEvent, "date" | "time" | "end" | "status" | "type">,
  now: Date = new Date(),
): EventTone {
  const status = event.status ?? "Agendado";
  if (status === "Concluído") return "done";
  if (status === "Cancelado") return "cancelled";
  const end = eventEndInstant(event);
  if (event.type === "Pessoal" && end && end.getTime() <= now.getTime()) return "done";
  const start = eventStartInstant(event);
  if (start && start.getTime() > now.getTime()) return "upcoming";
  return "inProgress";
}
