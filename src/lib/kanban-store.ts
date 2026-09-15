import { useSyncExternalStore } from "react";
import type { KanbanCard } from "./kanban-data";
import { saveKanbanCard, deleteKanbanCard } from "./kanban-api";
import { toast } from "sonner";

const EMPTY_CARDS: KanbanCard[] = [];
let cards: KanbanCard[] = EMPTY_CARDS;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

const persistCard = (card: KanbanCard) =>
  saveKanbanCard({
    data: {
      id: card.id || undefined,
      columnId: card.columnId,
      title: card.title,
      description: card.description ?? card.summary,
      priority: card.priority,
      dueDate: card.dueDate,
      archived: Boolean(card.archived),
      tags: card.tags,
      memberIds: card.participants?.length ? card.participants : [card.assigneeId],
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
    void persistCard(withId)
      .then(({ id }) => {
        cards = cards.map((item) => (item.id === withId.id ? { ...item, id } : item));
        emit();
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
    cards = cards.map((c) => (c.id === card.id ? card : c));
    emit();
    void persistCard(card).catch(() => {
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
