import { useSyncExternalStore } from "react";
import type { KanbanCard } from "./kanban-data";
import { saveKanbanCard, deleteKanbanCard } from "./kanban-api";
import { toast } from "sonner";
import { currentUser } from "./mock-data";

const EMPTY_CARDS: KanbanCard[] = [];
let cards: KanbanCard[] = EMPTY_CARDS;
const listeners = new Set<() => void>();
const cardSaveQueues = new Map<string, Promise<unknown>>();

function queueCardSave(card: KanbanCard) {
  const previous = cardSaveQueues.get(card.id) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(() => persistKanbanCard(card));
  cardSaveQueues.set(card.id, pending);
  void pending.then(
    () => {
      if (cardSaveQueues.get(card.id) === pending) cardSaveQueues.delete(card.id);
    },
    () => {
      if (cardSaveQueues.get(card.id) === pending) cardSaveQueues.delete(card.id);
    },
  );
  return pending;
}

const emit = () => {
  listeners.forEach((l) => l());
};

export function moveCardInList(
  current: KanbanCard[],
  cardId: string,
  columnId: string,
  beforeCardId?: string,
): KanbanCard[] {
  const originalIndex = current.findIndex((card) => card.id === cardId);
  if (originalIndex < 0) return current;
  const remaining = current.filter((card) => card.id !== cardId);
  const beforeIndex = beforeCardId
    ? remaining.findIndex((card) => card.id === beforeCardId && card.columnId === columnId)
    : -1;
  let insertIndex = beforeIndex;
  if (insertIndex < 0) {
    let lastIndex = -1;
    for (let index = remaining.length - 1; index >= 0; index--) {
      if (remaining[index].columnId === columnId) {
        lastIndex = index;
        break;
      }
    }
    insertIndex = lastIndex < 0 ? remaining.length : lastIndex + 1;
  }
  if (current[originalIndex].columnId === columnId && originalIndex === insertIndex) {
    return current;
  }
  const next = [...remaining];
  next.splice(insertIndex, 0, {
    ...current[originalIndex],
    columnId,
    archived: false,
  });
  return next;
}

export const persistKanbanCard = (card: KanbanCard) =>
  saveKanbanCard({
    data: {
      id: /^[0-9a-f-]{36}$/i.test(card.id) ? card.id : undefined,
      columnId: card.columnId,
      title: card.title,
      description: card.description ?? card.summary,
      priority: card.priority,
      dueDate:
        card.dueDate && card.dueTime ? `${card.dueDate}T${card.dueTime}:00-03:00` : card.dueDate,
      dueTime: card.dueTime,
      startDate: card.startDate,
      recurrence: card.recurrence,
      reminder: card.reminder,
      archived: Boolean(card.archived),
      tags: card.tags,
      tagColors: card.tagColors,
      memberIds: [...new Set([card.assigneeId, ...(card.participants ?? [])].filter(Boolean))],
      client: card.client,
      module: card.module,
      type: card.type,
      summary: card.summary,
      checklist: card.checklist,
      commentsList: card.commentsList,
      attachmentsList: card.attachmentsList,
      activity: card.activity,
      relatedArticles: card.relatedArticles,
      relatedVersions: card.relatedVersions,
    },
  });

function withChangeHistory(previous: KanbanCard | undefined, next: KanbanCard): KanbanCard {
  if (!previous || (next.activity?.length ?? 0) > (previous.activity?.length ?? 0)) return next;
  const changes: string[] = [];
  if (previous.columnId !== next.columnId) changes.push("Cartão movido de lista");
  if (previous.archived !== next.archived)
    changes.push(next.archived ? "Cartão arquivado" : "Cartão restaurado");
  if (previous.title !== next.title) changes.push("Título alterado");
  if (previous.summary !== next.summary) changes.push("Resumo alterado");
  if (previous.description !== next.description) changes.push("Descrição alterada");
  if (previous.client !== next.client) changes.push(`Cliente alterado para "${next.client}"`);
  if (previous.module !== next.module) changes.push(`Módulo alterado para "${next.module}"`);
  if (previous.type !== next.type) changes.push(`Tipo alterado para "${next.type}"`);
  if (previous.priority !== next.priority)
    changes.push(`Prioridade alterada para "${next.priority}"`);
  if (previous.dueDate !== next.dueDate)
    changes.push(`Prazo alterado para "${next.dueDate || "sem prazo"}"`);
  if (previous.assigneeId !== next.assigneeId) changes.push("Responsável alterado");
  if (JSON.stringify(previous.participants ?? []) !== JSON.stringify(next.participants ?? []))
    changes.push("Participantes atualizados");
  const oldTags = new Set(previous.tags ?? []);
  const newTags = new Set(next.tags ?? []);
  for (const tag of newTags) if (!oldTags.has(tag)) changes.push(`Etiqueta adicionada: "${tag}"`);
  for (const tag of oldTags) if (!newTags.has(tag)) changes.push(`Etiqueta removida: "${tag}"`);
  const oldChecklist = new Map((previous.checklist ?? []).map((item) => [item.id, item]));
  for (const item of next.checklist ?? []) {
    const before = oldChecklist.get(item.id);
    if (!before) changes.push(`Item de checklist adicionado: "${item.text}"`);
    if (before && before.done !== item.done)
      changes.push(`Checklist "${item.text}" marcado como ${item.done ? "concluído" : "pendente"}`);
    if (before && before.text !== item.text)
      changes.push(`Item de checklist renomeado para "${item.text}"`);
  }
  for (const item of previous.checklist ?? []) {
    if (!(next.checklist ?? []).some((current) => current.id === item.id))
      changes.push(`Item de checklist removido: "${item.text}"`);
  }
  if (JSON.stringify(previous.relatedArticles ?? []) !== JSON.stringify(next.relatedArticles ?? []))
    changes.push("Artigos relacionados atualizados");
  if (JSON.stringify(previous.relatedVersions ?? []) !== JSON.stringify(next.relatedVersions ?? []))
    changes.push("Versões relacionadas atualizadas");
  if (JSON.stringify(previous.attachmentsList ?? []) !== JSON.stringify(next.attachmentsList ?? []))
    changes.push("Anexos atualizados");
  if (JSON.stringify(previous.commentsList ?? []) !== JSON.stringify(next.commentsList ?? []))
    changes.push("Comentários atualizados");
  if (!changes.length) return next;
  const at = new Date().toISOString();
  return {
    ...next,
    activity: [
      ...(next.activity ?? []),
      ...changes.map((text) => ({
        id: crypto.randomUUID(),
        at,
        text,
        authorName: currentUser.name,
        authorOperator: currentUser.operator,
      })),
    ],
  };
}

export const kanbanStore = {
  getSnapshot: () => cards,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  hydrate: (nextCards: KanbanCard[]) => {
    cards = nextCards;
    emit();
  },
  setCards: (updater: (prev: KanbanCard[]) => KanbanCard[]) => {
    cards = updater(cards);
    emit();
  },
  addCard: (card: KanbanCard) => {
    const nextId =
      "PRC-" + (Math.max(0, ...cards.map((c) => parseInt(c.id.replace(/\D/g, ""), 10) || 0)) + 1);
    const withId = card.id ? card : { ...card, id: nextId };
    cards = [...cards, withId];
    emit();
    void persistKanbanCard(withId)
      .then(({ id }) => {
        cards = cards.map((item) => (item.id === withId.id ? { ...item, id } : item));
        emit();
        window.dispatchEvent(new Event("procion:kanban-card-saved"));
      })
      .catch(() => {
        cards = cards.filter((item) => item.id !== withId.id);
        emit();
        toast.error("Não foi possível salvar o cartão");
      });
    return withId;
  },
  updateCard: (card: KanbanCard) => {
    const previous = cards.find((item) => item.id === card.id);
    const updated = withChangeHistory(previous, card);
    cards = cards.map((c) => (c.id === card.id ? updated : c));
    emit();
    void queueCardSave(updated)
      .then(() => {
        window.dispatchEvent(new Event("procion:kanban-card-saved"));
      })
      .catch(() => {
        if (previous) cards = cards.map((item) => (item.id === card.id ? previous : item));
        emit();
        toast.error("Não foi possível salvar as alterações do cartão");
      });
  },
  deleteCard: (id: string) => {
    const previous = cards;
    cards = cards.filter((c) => c.id !== id);
    emit();
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      void deleteKanbanCard({ data: { id } }).catch(() => {
        cards = previous;
        emit();
        toast.error("Não foi possível excluir o cartão");
      });
    }
  },
};

export function useKanbanCards() {
  return useSyncExternalStore(kanbanStore.subscribe, kanbanStore.getSnapshot, () => EMPTY_CARDS);
}
