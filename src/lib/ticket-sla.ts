import type { SupportTicket, TicketStatus } from "./support-tickets-data";

/** Metas máximas de espera até o início do atendimento, por prioridade. */
export const SLA_TARGET_HOURS = 0.5;
export const SLA_TARGET_MINUTES_BY_PRIORITY: Record<SupportTicket["priority"], number> = {
  Alta: 15,
  Media: 30,
  Baixa: 60,
};

export function getTicketSlaTargetMinutes(ticket: Pick<SupportTicket, "priority">) {
  return SLA_TARGET_MINUTES_BY_PRIORITY[ticket.priority] ?? SLA_TARGET_HOURS * 60;
}

export type SlaTone = "ok" | "warn" | "late";

export type SlaResult = {
  /** Percentual consumido da meta (0-100). */
  pct: number;
  tone: SlaTone;
  /** Horas decorridas arredondadas (compatível com a exibição atual). */
  hours: number;
  /** Minutos decorridos, usados na apresentação do SLA de espera. */
  minutes: number;
  /** Horas decorridas com precisão, para relatórios/indicadores. */
  exactHours: number;
  /** Instante usado como limite do cálculo. */
  boundaryAt: string;
  /** `true` quando o contador está parado (chamado finalizado/cancelado). */
  stopped: boolean;
};

export type AttendanceTimeResult = {
  seconds: number;
  running: boolean;
  started: boolean;
};

/** Normaliza texto removendo acentos e caixa. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const TERMINAL_STATUSES = new Set([
  "finalizado",
  "finalizada",
  "concluido",
  "concluida",
  "fechado",
  "fechada",
  "encerrado",
  "encerrada",
  "resolvido",
  "resolvida",
  "cancelado",
  "cancelada",
]);

/** Um chamado encerrado não deve mais acumular tempo de SLA. */
export function isTicketClosed(status: TicketStatus | string | null | undefined): boolean {
  return TERMINAL_STATUSES.has(normalize(status ?? ""));
}

/**
 * Instante em que o contador de SLA parou.
 * Usa a data/hora exata de finalização quando registrada; caso o chamado seja
 * histórico e não possua o carimbo, cai para a última atualização conhecida.
 * Nunca redefine o valor já existente.
 */
export function getSlaBoundary(
  ticket: SupportTicket,
  now = Date.now(),
): { at: string; stopped: boolean } {
  if (ticket.attendanceStartedAt) {
    return { at: ticket.attendanceStartedAt, stopped: true };
  }
  if (isTicketClosed(ticket.status)) {
    const closed = ticket.closedAt ?? ticket.updatedAt ?? ticket.openedAt;
    return { at: closed, stopped: true };
  }
  return { at: new Date(now).toISOString(), stopped: false };
}

/** Tempo efetivamente trabalhado, desconsiderando períodos de espera. */
export function computeAttendanceTime(
  ticket: SupportTicket,
  now = Date.now(),
): AttendanceTimeResult {
  const accumulated = Math.max(0, Number(ticket.attendanceElapsedSeconds) || 0);
  const runningSince = ticket.attendanceRunningSince
    ? new Date(ticket.attendanceRunningSince).getTime()
    : Number.NaN;
  const running = Number.isFinite(runningSince) && ticket.status === "Ocupado";
  const currentSeconds = running ? Math.max(0, (now - runningSince) / 1000) : 0;

  return {
    seconds: Math.round(accumulated + currentSeconds),
    running,
    started: Boolean(ticket.attendanceStartedAt),
  };
}

export function formatElapsedTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

/**
 * Calcula o SLA do chamado. Para chamados abertos o comportamento é o atual
 * (aberto → agora); para finalizados o cálculo fica congelado entre a abertura
 * e a data/hora de finalização.
 */
export function computeSla(ticket: SupportTicket, now = Date.now()): SlaResult {
  const openedAt = new Date(ticket.openedAt).getTime();
  const boundary = getSlaBoundary(ticket, now);
  const boundaryTime = new Date(boundary.at).getTime();
  const safeBoundary = Number.isFinite(boundaryTime) ? boundaryTime : Date.now();
  const exactHours = Math.max(0, (safeBoundary - openedAt) / 36e5);
  const targetHours = getTicketSlaTargetMinutes(ticket) / 60;
  const rawPct =
    ticket.status === "Atrasado" ? 100 : Math.min(100, (exactHours / targetHours) * 100);
  const pct = Math.round(rawPct);
  let tone: SlaTone = "ok";
  if (ticket.status === "Atrasado" || pct >= 90) tone = "late";
  else if (pct >= 60) tone = "warn";
  return {
    pct,
    tone,
    hours: Math.round(exactHours),
    minutes: Math.round(exactHours * 60),
    exactHours,
    boundaryAt: boundary.at,
    stopped: boundary.stopped,
  };
}
