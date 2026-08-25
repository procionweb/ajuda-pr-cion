import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { CalendarEvent } from "@/lib/calendar-events";
import { listCrmCalendarEvents, saveCrmCalendarEvent } from "@/lib/calendar-api";
import {
  createReservation,
  createUsageForAppointment,
  getReservationsSnapshot,
  getUsageByAppointment,
  removeFleetRecordsForAppointments,
} from "@/lib/fleet-store";
import { ticketsStore } from "@/lib/tickets-store";

const STORAGE_KEY = "procion.local-calendar-events.v2";
const CHANGE_EVENT = "procion:calendar-events-changed";
const TEST_EVENTS_CLEANUP_KEY = "procion.test-events-cleanup.2026-08-11-v2";

const EMPTY: CalendarEvent[] = [];

let cache: CalendarEvent[] | null = null;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function read(): CalendarEvent[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const events = Array.isArray(parsed)
      ? (parsed.filter((item) => item && typeof item === "object") as CalendarEvent[])
      : EMPTY;

    if (!window.localStorage.getItem(TEST_EVENTS_CLEANUP_KEY)) {
      const testEventIds = events.map((event) => event.id);
      cache = [];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      removeFleetRecordsForAppointments(testEventIds);
      window.localStorage.setItem(TEST_EVENTS_CLEANUP_KEY, new Date().toISOString());
      return cache;
    }

    cache = events;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: CalendarEvent[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* armazenamento indisponível: mantém apenas em memória */
  }
  listeners.forEach((listener) => listener());
}

function syncFleetReservation(event: CalendarEvent) {
  if (
    !event.vehicleId ||
    !event.needsDisplacement ||
    (event.status && event.status !== "Agendado")
  ) {
    return;
  }

  const scheduledStartAt = `${event.date}T${event.time}:00`;
  const expectedReturnAt = `${event.date}T${event.end}:00`;
  const destination = event.address
    ? `${event.client ?? event.title} - ${event.address}`
    : (event.client ?? event.title);

  if (!getUsageByAppointment(event.id)) {
    createUsageForAppointment({
      appointmentId: event.id,
      operatorId: event.responsible ?? event.operator,
      vehicleId: event.vehicleId,
      client: event.client,
      destination,
      scheduledStartAt,
      expectedReturnAt,
    });
  }

  const hasReservation = getReservationsSnapshot().some(
    (reservation) =>
      String(reservation.eventId) === String(event.id) && reservation.status === "pre_agendado",
  );
  if (!hasReservation) {
    createReservation({
      vehicleId: event.vehicleId,
      operatorId: event.responsible ?? event.operator ?? "",
      startAt: scheduledStartAt,
      endAt: expectedReturnAt,
      eventId: event.id,
      customerId: event.clientId,
      destination,
    });
  }
}

export function addLocalEvent(event: Omit<CalendarEvent, "id"> & { id?: string | number }) {
  const created: CalendarEvent = {
    ...event,
    id: event.id ?? crypto.randomUUID(),
    status: event.status ?? "Agendado",
    editable: true,
  };
  write([...read(), created]);
  void saveCrmCalendarEvent(created).catch((error) => {
    write(read().filter((item) => String(item.id) !== String(created.id)));
    console.error("[calendar] Nao foi possivel salvar o agendamento no Supabase.", error);
    toast.error("Nao foi possivel salvar o agendamento no banco.");
  });

  if (created.needsDisplacement && !getUsageByAppointment(created.id)) {
    const destination = created.address
      ? `${created.client ?? created.title} - ${created.address}`
      : (created.client ?? created.title);

    const scheduledStartAt = `${created.date}T${created.time}:00`;
    const expectedReturnAt = `${created.date}T${created.end}:00`;

    createUsageForAppointment({
      appointmentId: created.id,
      operatorId: created.responsible ?? created.operator,
      vehicleId: created.vehicleId,
      client: created.client,
      destination,
      scheduledStartAt,
      expectedReturnAt,
    });

    // Pré-reserva na Frota usando a data/horário reais do evento (nunca a data de criação).
    if (created.vehicleId) {
      createReservation({
        vehicleId: created.vehicleId,
        operatorId: created.responsible ?? created.operator ?? "",
        startAt: scheduledStartAt,
        endAt: expectedReturnAt,
        eventId: created.id,
        customerId: created.clientId,
        destination,
      });
    }
  }

  return created;
}

/** Atualiza um evento local existente (não afeta eventos vindos do CRM). */
export function updateLocalEvent(
  id: string | number,
  patch: Partial<CalendarEvent>,
): CalendarEvent | null {
  const current = read();
  const index = current.findIndex((event) => String(event.id) === String(id));
  const base = index >= 0 ? current[index] : ({ ...patch, id } as CalendarEvent);
  const updated = { ...base, ...patch, id, editable: true };
  const next = [...current];
  if (index >= 0) next[index] = updated;
  else next.push(updated);
  write(next);
  if (updated.ticketId && updated.status === "Concluído") {
    const linkedTicket = ticketsStore
      .getTickets()
      .find((ticket) => String(ticket.id) === String(updated.ticketId));
    if (linkedTicket && linkedTicket.status !== "Finalizado") {
      ticketsStore.updateTicketStatus(linkedTicket.id, "Finalizado");
    }
  }
  void saveCrmCalendarEvent(updated).catch((error) => {
    write(current);
    console.error("[calendar] Nao foi possivel atualizar o agendamento no Supabase.", error);
    toast.error("Nao foi possivel atualizar o agendamento no banco.");
  });
  return updated;
}

function hydratePersistedEvents() {
  if (typeof window === "undefined" || hydrationPromise) return;
  hydrationPromise = listCrmCalendarEvents()
    .then((events) => {
      const persisted = events.filter((event) => event.editable);
      const persistedIds = new Set(persisted.map((event) => String(event.id)));
      const removedIds = read()
        .filter((event) => !persistedIds.has(String(event.id)))
        .map((event) => event.id);

      if (removedIds.length) removeFleetRecordsForAppointments(removedIds);
      write(persisted);
      persisted.forEach(syncFleetReservation);
    })
    .catch((error) => {
      console.error("[calendar] Nao foi possivel carregar os agendamentos salvos.", error);
    });
}

/** Indica se o evento é local (editável/cancelável pelo usuário). */
export function isLocalEvent(id: string | number): boolean {
  return read().some((event) => String(event.id) === String(id));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  const onLocalChange = () => {
    cache = null;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
  };
}

export function useLocalEvents(): CalendarEvent[] {
  const events = useSyncExternalStore(subscribe, read, () => EMPTY);
  useEffect(() => {
    hydratePersistedEvents();
  }, []);
  return events;
}

export function useLocalEventsForClient(clientId?: string): CalendarEvent[] {
  const all = useLocalEvents();
  if (!clientId) return EMPTY;
  return all.filter((event) => event.clientId === clientId);
}
