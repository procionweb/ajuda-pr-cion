import { useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { KanbanCard } from "@/lib/kanban-data";

type BoardEvent = {
  id: string;
  card: KanbanCard;
  text: string;
  at: string;
  author: string;
};

export function BoardNotifications({
  boardId,
  cards,
  onOpenCard,
}: {
  boardId: string;
  cards: KanbanCard[];
  onOpenCard: (card: KanbanCard) => void;
}) {
  const compactScreen = useIsMobileOrTablet();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const storageKey = `procion.kanban.notifications.${boardId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setReadIds(Array.isArray(saved) ? saved : []);
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  const events = useMemo(
    () =>
      cards
        .flatMap((card) =>
          (card.activity ?? []).map((entry): BoardEvent => ({
            id: `${card.id}:${entry.id}`,
            card,
            text: entry.text,
            at: entry.at,
            author: entry.authorName || entry.authorOperator || "Membro",
          })),
        )
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, 30),
    [cards],
  );
  const unread = events.filter((event) => !readIds.includes(event.id)).length;

  const markRead = (ids: string[]) => {
    const next = [...new Set([...readIds, ...ids])];
    setReadIds(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Abrir notificações"
          title="Notificações do quadro"
          className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={8} collisionPadding={12} avoidCollisions={!compactScreen} className="app-scrollbar max-h-[min(420px,var(--radix-popover-content-available-height))] w-[min(380px,calc(100vw-24px))] overflow-y-auto overscroll-contain touch-pan-y p-0">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-popover px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações do quadro</p>
            <p className="text-xs text-muted-foreground">{unread} não lidas</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={!unread}
            onClick={() => markRead(events.map((event) => event.id))}
          >
            <Check className="mr-1 h-4 w-4" /> Marcar todas
          </Button>
        </div>
        <div className="min-w-0">
          {events.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma atividade registrada.
            </p>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                type="button"
                className="flex w-full cursor-pointer gap-3 border-b px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => {
                  markRead([event.id]);
                  setOpen(false);
                  onOpenCard(event.card);
                }}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${readIds.includes(event.id) ? "bg-transparent" : "bg-sky-500"}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{event.text}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {event.card.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {event.author} · {new Date(event.at).toLocaleString("pt-BR")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
