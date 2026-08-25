import { useCallback, useSyncExternalStore } from "react";
import { supportTickets, type SupportTicket, type TicketStatus } from "./support-tickets-data";
import { currentUser } from "./mock-data";
import { ticketsApi } from "./tickets-api";

export type TicketEventKind =
  | "created"
  | "attached"
  | "assumed"
  | "attend"
  | "status"
  | "message"
  | "note"
  | "solution"
  | "closed"
  | "scheduled"
  | "forwarded";

export type TicketEvent = {
  id: string;
  kind: TicketEventKind;
  when: string;
  actor: string;
  actorType: "cliente" | "suporte" | "sistema";
  description: string;
  attachment?: {
    name: string;
    type: string;
    dataUrl: string;
  };
};

export type PastAttendance = {
  id: string;
  title: string;
  status: TicketStatus;
  module: string;
  priority: SupportTicket["priority"];
  operator: string;
  date: string;
  protocol: string;
  description: string;
  contact: string;
  closedAt?: string | null;
  attendanceStartedAt?: string | null;
  attendanceElapsedSeconds?: number;
};

export type ClosurePayload = {
  solution: string;
  type:
    | "Não definido"
    | "Dúvida"
    | "Configuração"
    | "Atualização do Hádron"
    | "Problema Hádron"
    | "Problema Externo"
    | "Treinamento"
    | "Solicitação/Sugestão"
    | "Outros";
  hadronOption: string;
  permission: "Público" | "Clientes" | "Empresa";
  relatedArticles: string[];
  relatedForms: string[];
  addToClientHistory: boolean;
  generateKbArticle: boolean;
};

export type InternalNote = {
  id: string;
  operator: string;
  createdAt: string;
  text: string;
};

export type CreateTicketInput = {
  priority: SupportTicket["priority"];
  clientCode: string;
  clientName: string;
  contact: string;
  contactPhone?: string | null;
  subject: string;
  module: string;
  source: SupportTicket["source"];
  description: string;
  /** Sigla real do colaborador responsável (obrigatória na abertura). */
  owner: string;
  /** ID real do colaborador responsável. */
  ownerId?: string | null;
  companyId?: string | null;
  companyNumber?: number | null;
  companyName?: string;
  companyDocument?: string;
};

let tickets: SupportTicket[] = supportTickets.map((t) => ({ ...t }));
const events: Record<string, TicketEvent[]> = {};
const history: Record<string, PastAttendance[]> = {};
const internalNotes: Record<string, InternalNote[]> = {};

const EMPTY_EVENTS: TicketEvent[] = [];
const EMPTY_HISTORY: PastAttendance[] = [];
const EMPTY_NOTES: InternalNote[] = [];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let hydrationPromise: Promise<void> | null = null;

function groupSnapshot<T extends { ticketId: string }>(rows: T[]) {
  return rows.reduce<Record<string, Omit<T, "ticketId">[]>>((result, row) => {
    const { ticketId, ...value } = row;
    (result[ticketId] ??= []).push(value);
    return result;
  }, {});
}

async function hydrateFromSupabase() {
  try {
    let snapshot = await ticketsApi.load();
    if (!snapshot.tickets.length) {
      await ticketsApi.seed(supportTickets);
      snapshot = await ticketsApi.load();
    }
    if (!snapshot.tickets.length) return;

    Object.assign(events, groupSnapshot(snapshot.events));
    Object.assign(internalNotes, groupSnapshot(snapshot.notes));
    tickets = snapshot.tickets;
    tickets.forEach(ensureSeed);
    tickets = tickets.map((ticket) => restoreAttendanceTiming(ticket, events[ticket.id] ?? []));
    emit();
  } catch (error) {
    console.error("[tickets-store] Não foi possível carregar os chamados do Supabase.", error);
  }
}

function ensureHydrated() {
  hydrationPromise ??= hydrateFromSupabase();
  return hydrationPromise;
}

let eventCounter = 0;
const nextEventId = () => `evt-${Date.now().toString(36)}-${++eventCounter}`;

const nowIso = () => new Date().toISOString();

function attendancePatch(
  ticket: SupportTicket | undefined,
  nextStatus: TicketStatus,
  at = nowIso(),
): Partial<SupportTicket> {
  if (!ticket) return {};
  const accumulated = Math.max(0, Number(ticket.attendanceElapsedSeconds) || 0);
  const runningSince = ticket.attendanceRunningSince
    ? new Date(ticket.attendanceRunningSince).getTime()
    : Number.NaN;
  const atTime = new Date(at).getTime();
  const elapsedNow =
    Number.isFinite(runningSince) && Number.isFinite(atTime)
      ? Math.max(0, Math.round((atTime - runningSince) / 1000))
      : 0;

  if (nextStatus === "Ocupado") {
    return {
      attendanceStartedAt: ticket.attendanceStartedAt ?? at,
      attendanceRunningSince: ticket.attendanceRunningSince ?? at,
      attendanceElapsedSeconds: accumulated,
    };
  }

  if (ticket.attendanceRunningSince) {
    return {
      attendanceRunningSince: null,
      attendanceElapsedSeconds: accumulated + elapsedNow,
    };
  }
  return {};
}

function restoreAttendanceTiming(
  ticket: SupportTicket,
  ticketEvents: TicketEvent[],
): SupportTicket {
  const ordered = [...ticketEvents].sort((a, b) => a.when.localeCompare(b.when));
  const closedEvent = [...ordered]
    .reverse()
    .find(
      (event) =>
        event.kind === "closed" ||
        (event.kind === "status" &&
          /finaliz|conclu|encerr|fechad|resolvid/i.test(event.description)),
    );
  const closedAt =
    ticket.closedAt ??
    closedEvent?.when ??
    (ticket.status === "Finalizado" ? ticket.updatedAt : null);

  if (ticket.attendanceStartedAt) return { ...ticket, closedAt };

  let startedAt: string | null = null;
  let runningSince: string | null = null;
  let elapsedSeconds = 0;

  for (const event of ordered) {
    if (event.kind === "attend") {
      startedAt ??= event.when;
      runningSince ??= event.when;
      continue;
    }
    const statusKeepsRunning =
      event.kind === "status" && event.description.toLowerCase().includes('"ocupado"');
    const pausesAttendance =
      event.kind === "closed" ||
      event.kind === "forwarded" ||
      event.kind === "scheduled" ||
      (event.kind === "status" && !statusKeepsRunning);
    if (pausesAttendance && runningSince) {
      elapsedSeconds += Math.max(
        0,
        Math.round((new Date(event.when).getTime() - new Date(runningSince).getTime()) / 1000),
      );
      runningSince = null;
    }
  }

  if (!startedAt) return { ...ticket, closedAt };
  if (ticket.status !== "Ocupado" && runningSince) {
    const boundary = closedAt ?? ticket.updatedAt;
    elapsedSeconds += Math.max(
      0,
      Math.round((new Date(boundary).getTime() - new Date(runningSince).getTime()) / 1000),
    );
    runningSince = null;
  }
  return {
    ...ticket,
    attendanceStartedAt: startedAt,
    attendanceRunningSince: runningSince,
    attendanceElapsedSeconds: elapsedSeconds,
    closedAt,
  };
}

function nextTicketSequence() {
  const sequences = tickets
    .map((ticket) => Number(ticket.protocol.replace(/\D/g, "")))
    .filter(Number.isFinite);
  return Math.max(1780000000, ...sequences) + 1;
}

function addMinutes(iso: string, minutes: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

const PAST_TITLES = [
  "NOTA DEVOLUÇÃO",
  "CONFERÊNCIA DE ESTOQUE",
  "AJUSTE FINANCEIRO",
  "ORÇAMENTO NÃO IMPRIME",
  "CADASTRO DE PRODUTO",
  "IMPOSTO DIVERGENTE",
  "SPED FISCAL",
];
const PAST_MODULES = [
  "VENDAS -- NOTAS FISCAIS / NFE",
  "ESTOQUE -- MOVIMENTAÇÃO",
  "FINANCEIRO -- CONTAS A PAGAR",
  "BASICO -- TERCEIROS",
  "FISCAL -- APURAÇÃO",
];
const PAST_OPERATORS = ["PRCSUZ", "PRCROG", "PRCMAR", "PRCLCZ", "PRCPED"];

function seedHistory(ticket: SupportTicket): PastAttendance[] {
  const h = hashString(ticket.clientCode + ticket.id);
  const count = 2 + (h % 3);
  const arr: PastAttendance[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = (h + i * 7) % PAST_TITLES.length;
    const dateBase = new Date(ticket.openedAt);
    dateBase.setDate(dateBase.getDate() - (7 + i * 11 + (h % 9)));
    arr.push({
      id: `${ticket.id}-past-${i}`,
      title: PAST_TITLES[idx],
      status: "Finalizado",
      module: PAST_MODULES[(h + i) % PAST_MODULES.length],
      priority: (["Baixa", "Media", "Alta"] as const)[(h + i) % 3],
      operator: PAST_OPERATORS[(h + i * 3) % PAST_OPERATORS.length],
      date: dateBase.toISOString(),
      protocol: `PRC-${1780000000 + ((h + i * 137) % 9999999)}`,
      description: "Atendimento anterior deste cliente relacionado ao módulo.",
      contact: ticket.contact || "Não informado",
    });
  }
  return arr;
}

function seedEvents(ticket: SupportTicket): TicketEvent[] {
  const base: TicketEvent[] = [
    {
      id: nextEventId(),
      kind: "created",
      when: ticket.openedAt,
      actor: ticket.contact,
      actorType: "cliente",
      description: `Chamado aberto via ${ticket.source}.`,
    },
    {
      id: nextEventId(),
      kind: "attached",
      when: addMinutes(ticket.openedAt, 6),
      actor: ticket.contact,
      actorType: "cliente",
      description: "Cliente anexou print do erro e log da operação.",
    },
    {
      id: nextEventId(),
      kind: "assumed",
      when: addMinutes(ticket.openedAt, 14),
      actor: ticket.attendant,
      actorType: "suporte",
      description: `Chamado assumido por ${ticket.attendant}.`,
    },
    {
      id: nextEventId(),
      kind: "status",
      when: addMinutes(ticket.openedAt, 32),
      actor: ticket.owner,
      actorType: "sistema",
      description: `Status alterado para "${ticket.status}".`,
    },
    {
      id: nextEventId(),
      kind: "message",
      when: ticket.updatedAt,
      actor: ticket.owner,
      actorType: "suporte",
      description: "Retorno enviado ao cliente com orientação inicial.",
    },
  ];
  if (ticket.status === "Finalizado") {
    base.push({
      id: nextEventId(),
      kind: "closed",
      when: ticket.updatedAt,
      actor: ticket.owner,
      actorType: "suporte",
      description: "Chamado encerrado após confirmação do cliente.",
    });
  }
  return base;
}

function ensureSeed(ticket: SupportTicket) {
  if (!events[ticket.id]) events[ticket.id] = seedEvents(ticket);
  if (!history[ticket.id]) history[ticket.id] = seedHistory(ticket);
}

// Seed everything up-front so listing works.
tickets.forEach(ensureSeed);

function updateTicket(id: string, patch: Partial<SupportTicket>) {
  tickets = tickets.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t));
}

function pushEvent(id: string, event: Omit<TicketEvent, "id">) {
  events[id] = [...(events[id] ?? []), { ...event, id: nextEventId() }];
}

const operator = () => currentUser.operator ?? "PRC???";

export const TRANSFER_BLOCKED_MESSAGE = "Não é possível transferir um chamado ocupado.";
export const TRANSFER_BLOCKED_OCUPADO_MESSAGE = "Não é possível transferir um chamado ocupado.";
export const TRANSFER_BLOCKED_FINALIZADO_MESSAGE =
  "Não é possível transferir um chamado finalizado.";

/** Normaliza texto removendo acentos e caixa para comparação de status. */
function normalizeStatus(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const OCUPADO_STATUSES = new Set(["ocupado"]);
const FINALIZADO_STATUSES = new Set([
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
]);

/**
 * Retorna a mensagem de bloqueio quando o chamado não pode ser transferido,
 * ou `null` quando a transferência é permitida.
 */
export function getTransferBlockReason(ticket: SupportTicket | null | undefined): string | null {
  if (!ticket) return TRANSFER_BLOCKED_OCUPADO_MESSAGE;
  const status = normalizeStatus(ticket.status ?? "");
  if (OCUPADO_STATUSES.has(status)) return TRANSFER_BLOCKED_OCUPADO_MESSAGE;
  if (FINALIZADO_STATUSES.has(status)) return TRANSFER_BLOCKED_FINALIZADO_MESSAGE;
  return null;
}

/** Um chamado só não pode ser transferido quando estiver "Ocupado" ou finalizado. */
export function canTransferTicket(ticket: SupportTicket | null | undefined): boolean {
  return getTransferBlockReason(ticket) === null;
}

function persistUpdate(
  id: string,
  patch: Partial<SupportTicket>,
  event?: Omit<TicketEvent, "id" | "when" | "attachment"> & { metadata?: unknown },
) {
  void ticketsApi.update(id, patch, event).catch((error) => {
    console.error(`[tickets-store] Falha ao persistir o chamado ${id}.`, error);
  });
}

export const ticketsStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    void ensureHydrated();
    return () => {
      listeners.delete(l);
    };
  },
  getTickets: () => tickets,
  getEvents: (id: string) => events[id] ?? EMPTY_EVENTS,
  getHistory: (id: string) => history[id] ?? EMPTY_HISTORY,
  getInternalNotes: (id: string) => internalNotes[id] ?? EMPTY_NOTES,

  createTicket(input: CreateTicketInput) {
    const when = nowIso();
    const sequence = nextTicketSequence();
    const ticket: SupportTicket = {
      id: `ticket-${Date.now().toString(36)}-${++eventCounter}`,
      protocol: `PRC-${sequence}`,
      status: "Em Aberto",
      priority: input.priority,
      openedAt: when,
      updatedAt: when,
      attendant: input.owner.trim() || operator(),
      owner: input.owner.trim(),
      ownerId: input.ownerId ?? null,
      clientCode: input.clientCode.trim().toUpperCase(),
      clientName: input.clientName.trim(),
      contact: input.contact.trim(),
      contactPhone: input.contactPhone?.trim() || null,
      subject: input.subject.trim(),
      module: input.module.trim(),
      source: input.source,
      description: input.description.trim(),
      companyId: input.companyId ?? null,
      companyNumber: input.companyNumber ?? null,
      companyName: input.companyName?.trim() || undefined,
      companyDocument: input.companyDocument?.trim() || undefined,
    };

    tickets = [ticket, ...tickets];
    events[ticket.id] = [
      {
        id: nextEventId(),
        kind: "created",
        when,
        actor: input.contact.trim(),
        actorType: "cliente",
        description: `Chamado aberto via ${input.source}. ${input.description.trim()}`.trim(),
      },
    ];
    history[ticket.id] = [];
    emit();
    void ticketsApi
      .create({
        ...ticket,
        eventDescription: events[ticket.id][0].description,
      })
      .catch((error) => {
        console.error("[tickets-store] Falha ao criar o chamado no Supabase.", error);
      });
    return ticket;
  },

  addAttachment(id: string, attachment: NonNullable<TicketEvent["attachment"]>) {
    const op = operator();
    const event: TicketEvent = {
      id: nextEventId(),
      kind: "attached",
      when: nowIso(),
      actor: op,
      actorType: "suporte",
      description: attachment.name,
      attachment,
    };
    pushEvent(id, event);
    emit();
    persistUpdate(
      id,
      {},
      {
        kind: "attached",
        actor: op,
        actorType: "suporte",
        description: attachment.name,
        metadata: { attachment },
      },
    );
  },

  assumeTicket(id: string) {
    const op = operator();
    updateTicket(id, { owner: op, lockedBy: undefined });
    pushEvent(id, {
      kind: "assumed",
      when: nowIso(),
      actor: op,
      actorType: "suporte",
      description: `Chamado assumido por ${op}.`,
    });
    emit();
    persistUpdate(
      id,
      { owner: op, lockedBy: undefined },
      {
        kind: "assumed",
        actor: op,
        actorType: "suporte",
        description: `Chamado assumido por ${op}.`,
      },
    );
  },

  attendTicket(id: string) {
    const op = operator();
    const existing = tickets.find((ticket) => ticket.id === id);
    if (!existing || existing.attendanceStartedAt) return;
    const description = `${op} iniciou atendimento.`;
    const patch: Partial<SupportTicket> = {
      owner: op,
      status: "Ocupado",
      lockedBy: op,
      ...attendancePatch(existing, "Ocupado"),
    };
    updateTicket(id, patch);
    pushEvent(id, {
      kind: "attend",
      when: nowIso(),
      actor: op,
      actorType: "suporte",
      description,
    });
    emit();
    persistUpdate(id, patch, {
      kind: "attend",
      actor: op,
      actorType: "suporte",
      description,
    });
  },

  updateTicketStatus(id: string, status: TicketStatus) {
    const op = operator();
    const existing = tickets.find((t) => t.id === id);
    // Ao finalizar pelo seletor de status, congela o SLA na hora exata.
    const at = nowIso();
    const patch: Partial<SupportTicket> = {
      status,
      ...attendancePatch(existing, status, at),
      ...(status === "Finalizado" ? { closedAt: existing?.closedAt ?? at } : {}),
    };
    updateTicket(id, patch);
    pushEvent(id, {
      kind: "status",
      when: nowIso(),
      actor: op,
      actorType: "suporte",
      description: `Status alterado para "${status}" por ${op}.`,
    });
    emit();
    persistUpdate(
      id,
      patch,

      {
        kind: "status",
        actor: op,
        actorType: "suporte",
        description: `Status alterado para "${status}" por ${op}.`,
      },
    );
  },

  closeTicket(id: string, payload: ClosurePayload) {
    const op = operator();
    const existing = tickets.find((t) => t.id === id);
    // Nunca redefine uma finalização já registrada.
    const closedAt = existing?.closedAt ?? nowIso();
    const patch: Partial<SupportTicket> = {
      status: "Finalizado",
      lockedBy: undefined,
      closedAt,
      ...attendancePatch(existing, "Finalizado", closedAt),
    };
    updateTicket(id, patch);
    pushEvent(id, {
      kind: "closed",
      when: closedAt,
      actor: op,
      actorType: "suporte",
      description: `Chamado finalizado por ${op} — ${payload.type}. ${payload.solution}`.trim(),
    });
    emit();
    persistUpdate(id, patch, {
      kind: "closed",
      actor: op,
      actorType: "suporte",
      description: `Chamado finalizado por ${op} — ${payload.type}. ${payload.solution}`.trim(),
    });
  },

  addInternalNote(id: string, note: string) {
    const op = operator();
    const when = nowIso();
    const entry: InternalNote = {
      id: `note-${Date.now().toString(36)}-${++eventCounter}`,
      operator: op,
      createdAt: when,
      text: note,
    };
    internalNotes[id] = [entry, ...(internalNotes[id] ?? [])];
    updateTicket(id, {});
    emit();
    void ticketsApi
      .addMessage(id, {
        text: note,
        internal: true,
        senderCode: op,
        name: op,
        author: "suporte",
      })
      .catch((error) => {
        console.error(`[tickets-store] Falha ao salvar nota do chamado ${id}.`, error);
      });
  },

  scheduleEvent(
    id: string,
    input: {
      date: string;
      startTime: string;
      endTime: string;
      type: string;
      responsible: string;
      guests?: string;
      vehicle?: string;
      module: string;
      submodule: string;
      description?: string;
      reminder?: boolean;
    },
  ) {
    const current = tickets.find((ticket) => ticket.id === id);
    if (current?.status === "Finalizado") return;
    const op = operator();
    pushEvent(id, {
      kind: "scheduled",
      when: nowIso(),
      actor: op,
      actorType: "suporte",
      description:
        `Evento agendado para ${input.date}, das ${input.startTime} às ${input.endTime} — ${input.type}. ` +
        `Responsável: ${input.responsible}. Módulo: ${input.module} / ${input.submodule}.` +
        (input.guests ? ` Convidados: ${input.guests}.` : "") +
        (input.vehicle ? ` Veículo: ${input.vehicle}.` : "") +
        (input.reminder ? " Lembrete ativo." : "") +
        (input.description ? ` ${input.description}` : ""),
    });
    const existing = tickets.find((ticket) => ticket.id === id);
    const patch: Partial<SupportTicket> = {
      status: "Agendamento",
      owner: input.responsible,
      ...attendancePatch(existing, "Agendamento"),
    };
    updateTicket(id, patch);
    emit();
    persistUpdate(id, patch, {
      kind: "scheduled",
      actor: op,
      actorType: "suporte",
      description:
        `Evento agendado para ${input.date}, das ${input.startTime} às ${input.endTime} — ${input.type}. ` +
        `Responsável: ${input.responsible}. Módulo: ${input.module} / ${input.submodule}.`,
    });
  },

  forwardToSpecialist(
    id: string,
    input: {
      waitingArea: string;
      reason: string;
      permission: string;
      priority: SupportTicket["priority"];
      type: string;
      module: string;
      submodule: string;
      hadronOption: string;
      relatedArticles: string[];
      relatedForms: string[];
    },
  ) {
    const current = tickets.find((ticket) => ticket.id === id);
    if (current?.status === "Finalizado") return;
    const op = operator();
    const existing = tickets.find((ticket) => ticket.id === id);
    const patch: Partial<SupportTicket> = {
      status: "Com especialista",
      priority: input.priority,
      lockedBy: undefined,
      ...attendancePatch(existing, "Com especialista"),
    };
    updateTicket(id, patch);
    pushEvent(id, {
      kind: "forwarded",
      when: nowIso(),
      actor: op,
      actorType: "suporte",
      description:
        `Encaminhado para a fila de especialistas — ${input.waitingArea}. ` +
        `Tipo: ${input.type}. Módulo: ${input.module} / ${input.submodule}. Permissão: ${input.permission}. ` +
        (input.hadronOption ? `Opção Hádron: ${input.hadronOption}. ` : "") +
        (input.relatedArticles.length ? `Artigos: ${input.relatedArticles.join(", ")}. ` : "") +
        (input.relatedForms.length
          ? `Opções/Formulários: ${input.relatedForms.join(", ")}. `
          : "") +
        `Mensagem: ${input.reason}`,
    });
    emit();
    persistUpdate(id, patch, {
      kind: "forwarded",
      actor: op,
      actorType: "suporte",
      description: `Encaminhado para especialistas — ${input.waitingArea}. ${input.reason}`,
    });
  },

  transferTicket(
    id: string,
    input: {
      toOperator: string;
      type: "Transferir" | "Encaminhar" | "Devolver para fila";
      message: string;
      priority: SupportTicket["priority"];
      permission: string;
      hadronOption: string;
      relatedArticles: string[];
      relatedForms: string[];
    },
  ) {
    const current = tickets.find((t) => t.id === id) ?? null;
    const blockReason = getTransferBlockReason(current);
    if (blockReason) {
      throw new Error(blockReason);
    }
    const from = operator();
    const nextStatus: TicketStatus =
      input.type === "Devolver para fila" ? "Em Aberto" : "Em andamento";
    const nextOwner = input.type === "Devolver para fila" ? "Sem responsável" : input.toOperator;
    updateTicket(id, {
      owner: nextOwner,
      status: nextStatus,
      priority: input.priority,
      lockedBy: undefined,
    });
    pushEvent(id, {
      kind: "forwarded",
      when: nowIso(),
      actor: from,
      actorType: "suporte",
      description:
        `${input.type} — de ${from} para ${nextOwner}. ` +
        `Prioridade: ${input.priority}. Permissão: ${input.permission}.` +
        (input.hadronOption ? ` Opção Hádron: ${input.hadronOption}.` : "") +
        (input.relatedArticles.length ? ` Artigos: ${input.relatedArticles.join(", ")}.` : "") +
        (input.relatedForms.length
          ? ` Opções/Formulários: ${input.relatedForms.join(", ")}.`
          : "") +
        ` Mensagem: ${input.message}`,
    });
    emit();
    persistUpdate(
      id,
      {
        owner: nextOwner,
        status: nextStatus,
        priority: input.priority,
        lockedBy: undefined,
      },
      {
        kind: "forwarded",
        actor: from,
        actorType: "suporte",
        description: `${input.type} — de ${from} para ${nextOwner}. ${input.message}`,
      },
    );
  },

  addNote(id: string, note: string) {
    this.addInternalNote(id, note);
  },
};

// React hooks -----------------------------------------------------------------

export function useTickets(): SupportTicket[] {
  return useSyncExternalStore(
    ticketsStore.subscribe,
    ticketsStore.getTickets,
    ticketsStore.getTickets,
  );
}

export function useTicket(id: string | null | undefined): SupportTicket | null {
  const all = useTickets();
  if (!id) return null;
  return all.find((t) => t.id === id) ?? null;
}

export function useTicketNotes(id: string | null | undefined): InternalNote[] {
  const getSnap = useCallback(() => (id ? ticketsStore.getInternalNotes(id) : EMPTY_NOTES), [id]);
  return useSyncExternalStore(ticketsStore.subscribe, getSnap, getSnap);
}

export function useTicketEvents(id: string | null | undefined): TicketEvent[] {
  const getSnap = useCallback(() => (id ? ticketsStore.getEvents(id) : EMPTY_EVENTS), [id]);
  return useSyncExternalStore(ticketsStore.subscribe, getSnap, getSnap);
}

export function useTicketHistory(id: string | null | undefined): PastAttendance[] {
  const getSnap = useCallback(() => (id ? ticketsStore.getHistory(id) : EMPTY_HISTORY), [id]);
  return useSyncExternalStore(ticketsStore.subscribe, getSnap, getSnap);
}

/**
 * Retorna todos os chamados de um cliente pela sua sigla (clientCode).
 * TODO: substituir por chamada à API quando disponível.
 */
export function getTicketsByClient(clientCode: string): SupportTicket[] {
  const code = clientCode.trim().toUpperCase();
  if (!code) return [];
  return ticketsStore.getTickets().filter((t) => t.clientCode.toUpperCase() === code);
}

/** Converte um SupportTicket em PastAttendance para reuso da timeline. */
export function ticketToPastAttendance(t: SupportTicket): PastAttendance {
  return {
    id: t.id,
    title: t.subject,
    status: t.status,
    module: t.module,
    priority: t.priority,
    operator: t.owner,
    date: t.openedAt,
    protocol: t.protocol,
    description: t.description?.trim() || t.subject,
    contact: t.contact || "Não informado",
    closedAt: t.closedAt ?? null,
    attendanceStartedAt: t.attendanceStartedAt ?? null,
    attendanceElapsedSeconds: t.attendanceElapsedSeconds,
  };
}
