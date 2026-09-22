import type { SupportTicket } from "@/lib/support-tickets-data";
import { isTicketClosed } from "@/lib/ticket-sla";

export type AnalyticsTicket = {
  id: string;
  opened: number;
  updated: number;
  closed: number | null;
  started: number | null;
  due: number | null;
  status: string;
  priority: string;
  owner: string;
  company: string;
  companyId: string;
  module: string;
  source: string;
  closedNow: boolean;
};

export type AnalyticsFilters = {
  from: string;
  to: string;
  company: string;
  owner: string;
  module: string;
  priority: string;
  status: string;
  source: string;
};

const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export const formatNumber = (value: number) => number.format(value);
export const formatPercentage = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "-" : `${decimal.format(value)}%`;
export function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "-";
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
export const formatDate = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(ms);
export const formatDateTime = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(ms);
const dayKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayKey = (ms: number) => {
  const parts = Object.fromEntries(
    dayKeyFormatter.formatToParts(ms).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});
const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  hourCycle: "h23",
});
export const weekdayIndex = (ms: number) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayFormatter.format(ms));
export const localHour = (ms: number) => Number(hourFormatter.format(ms));

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeTicket(ticket: SupportTicket): AnalyticsTicket | null {
  const opened = timestamp(ticket.openedAt);
  if (opened === null) return null;
  const closedNow = isTicketClosed(ticket.status);
  return {
    id: ticket.id,
    opened,
    updated: timestamp(ticket.updatedAt) ?? opened,
    closed: timestamp(ticket.closedAt),
    started: timestamp(ticket.attendanceStartedAt),
    due: timestamp(ticket.slaDueAt),
    status: ticket.status || "Não informado",
    priority: ticket.priority || "Não informado",
    owner: ticket.owner?.trim() || "Sem responsável",
    company: ticket.clientName?.trim() || ticket.clientCode?.trim() || "Não informado",
    companyId: ticket.companyId || ticket.clientCode || ticket.clientName || ticket.id,
    module: ticket.module?.trim() || "Não informado",
    source: ticket.source || "Não informado",
    closedNow,
  };
}

export function rangeBounds(from: string, to: string) {
  // Date-only filter values denote Sao Paulo calendar days; compare against formatted local keys.
  return from && to && from > to ? [to, from] : [from, to];
}

export function inDateRange(ms: number, from: string, to: string) {
  const key = dayKey(ms);
  const [start, end] = rangeBounds(from, to);
  return (!start || key >= start) && (!end || key <= end);
}

export function matchesDimensions(t: AnalyticsTicket, f: AnalyticsFilters) {
  return (
    (!f.company || t.companyId === f.company) &&
    (!f.owner || t.owner === f.owner) &&
    (!f.module || t.module === f.module) &&
    (!f.priority || t.priority === f.priority) &&
    (!f.status || t.status === f.status) &&
    (!f.source || t.source === f.source)
  );
}

export function groupCount(rows: AnalyticsTicket[], key: (row: AnalyticsTicket) => string) {
  const result = new Map<string, number>();
  for (const row of rows) result.set(key(row), (result.get(key(row)) ?? 0) + 1);
  return [...result]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

export function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function delta(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
