import { supabase } from "./supabase";
import type { SupportTicket } from "./support-tickets-data";
import type { InternalNote, TicketEvent } from "./tickets-store";
import type { TicketMessage } from "./ticket-messages-store";

export type SupportSnapshot = {
  tickets: SupportTicket[];
  events: Array<TicketEvent & { ticketId: string }>;
  notes: Array<InternalNote & { ticketId: string }>;
  messages: Array<TicketMessage & { ticketId: string }>;
};

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const ticketsApi = {
  load() {
    return rpc<SupportSnapshot>("support_load");
  },
  seed(tickets: SupportTicket[]) {
    return rpc<{ seeded: boolean }>("support_seed_tickets", { payload: tickets });
  },
  create(payload: Record<string, unknown>) {
    return rpc<{ id: string }>("support_create_ticket", { payload });
  },
  update(
    ticketKey: string,
    patch: Partial<SupportTicket>,
    eventPayload?: Omit<TicketEvent, "id" | "when" | "attachment"> & {
      title?: string;
      metadata?: unknown;
    },
  ) {
    const normalizedPatch: Record<string, unknown> = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, "lockedBy") && patch.lockedBy === undefined) {
      normalizedPatch.lockedBy = null;
    }

    return rpc<{ ok: boolean }>("support_update_ticket", {
      ticket_key: ticketKey,
      patch: normalizedPatch,
      event_payload: eventPayload ?? null,
    });
  },
  addMessage(
    ticketKey: string,
    payload: {
      text: string;
      internal: boolean;
      senderCode?: string;
      name: string;
      author: "cliente" | "suporte";
    },
  ) {
    return rpc<{ id: string }>("support_add_message", {
      ticket_key: ticketKey,
      message_payload: payload,
    });
  },
};
