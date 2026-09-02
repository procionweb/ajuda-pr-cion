import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/lib/calendar-events";

export type CrmCalendarEvent = CalendarEvent;

const typeLabels: Record<string, CrmCalendarEvent["type"]> = {
  visit: "Visita presencial",
  visita: "Visita presencial",
  "visita presencial": "Visita presencial",
  remote_meeting: "Reunião remota",
  "reunião remota": "Reunião remota",
  procion_meeting: "Reunião na Prócion",
  "reunião na prócion": "Reunião na Prócion",
  personal: "Pessoal",
  pessoal: "Pessoal",
};

function normalizeEventType(event: Record<string, unknown>): CrmCalendarEvent["type"] {
  const candidates = [event.legacy_type, event.type, event.kind];
  for (const value of candidates) {
    const normalized = String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
    if (typeLabels[normalized]) return typeLabels[normalized];
  }

  if (event.vehicleId || event.needsDisplacement === true) return "Visita presencial";
  return "Pessoal";
}
const originLabels: Record<string, CrmCalendarEvent["origin"]> = {
  admin: "Administração",
  administracao: "Administração",
  "administração": "Administração",
  support: "Suporte",
  suporte: "Suporte",
  commercial: "Comercial",
  comercial: "Comercial",
};
const statusLabels: Record<string, NonNullable<CrmCalendarEvent["status"]>> = {
  scheduled: "Agendado",
  in_progress: "Em andamento",
  "em andamento": "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export async function listCrmCalendarEvents(): Promise<CrmCalendarEvent[]> {
  const { data, error } = await supabase.rpc("get_crm_calendar_events");
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((event: Record<string, unknown>) => ({
    id: String(event.id || ""),
    date: String(event.date || ""),
    time: String(event.time || ""),
    end: String(event.end || ""),
    type: normalizeEventType(event),
    origin:
      originLabels[String(event.origin || "").trim().toLocaleLowerCase("pt-BR")] ||
      "Administração",
    operator: String(event.operator || ""),
    title: String(event.title || ""),
    client: event.client ? String(event.client) : undefined,
    status: statusLabels[String(event.status || "")] || "Agendado",
    description: event.description ? String(event.description) : undefined,
    guests: event.guests
      ? String(event.guests)
          .split(/[,;]+/)
          .map((guest) => guest.trim())
          .filter(Boolean)
      : undefined,
    clientId: event.clientId ? String(event.clientId) : undefined,
    ticketId: event.ticketId ? String(event.ticketId) : undefined,
    protocol: event.protocol ? String(event.protocol) : undefined,
    responsible: event.responsible ? String(event.responsible) : undefined,
    vehicleId: event.vehicleId ? String(event.vehicleId) : undefined,
    address: event.address ? String(event.address) : undefined,
    meetingLink: event.meetingLink ? String(event.meetingLink) : undefined,
    platform: event.platform ? String(event.platform) : undefined,
    room: event.room ? String(event.room) : undefined,
    cancellationReason: event.cancellationReason ? String(event.cancellationReason) : undefined,
    cancelledAt: event.cancelledAt ? String(event.cancelledAt) : undefined,
    report:
      event.report && typeof event.report === "object"
        ? (event.report as CalendarEvent["report"])
        : undefined,
    editable: Boolean(event.editable),
  }));
}

export async function saveCrmCalendarEvent(event: CalendarEvent): Promise<string> {
  const { data, error } = await supabase.rpc("save_crm_calendar_event", { p_event: event });
  if (error) throw error;
  return String(data);
}
