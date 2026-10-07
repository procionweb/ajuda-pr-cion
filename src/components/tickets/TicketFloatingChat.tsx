import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Minus, Paperclip, Send, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  sendTicketMessage,
  useTicketMessages,
  type TicketMessage,
} from "@/lib/ticket-messages-store";
import type { SupportTicket } from "@/lib/support-tickets-data";
import { CorrectionHint } from "@/components/ui/smart-text";
import { useSpellCorrection } from "@/lib/spellcheck";

const WIDTH = 380;
const HEIGHT = 500;
const MARGIN = 12;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({ msg }: { msg: TicketMessage }) {
  const isSupport = msg.author === "suporte";
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isSupport ? "flex-row-reverse" : "flex-row",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-medium",
          isSupport
            ? "bg-primary/15 text-primary"
            : "bg-[#efe6d7] text-[#7a5a1e] dark:bg-[#3a2f1c] dark:text-[#e0c78c]",
        )}
        aria-hidden
      >
        {initials(msg.name)}
      </span>
      <div className={cn("min-w-0 max-w-[78%]")}>
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed shadow-[0_1px_0_rgba(15,23,42,0.04)] break-words",
            isSupport
              ? "rounded-br-md bg-primary/12 text-foreground dark:bg-primary/20"
              : "rounded-bl-md bg-[#f7efe0] text-foreground dark:bg-[#2b2415]",
          )}
        >
          {msg.text}
        </div>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground",
            isSupport ? "justify-end" : "justify-start",
          )}
        >
          <span className="font-medium">{msg.name}</span>
          <span>·</span>
          <span>{formatTime(msg.at)}</span>
        </p>
      </div>
    </div>
  );
}

export function TicketFloatingChat({ ticket }: { ticket: SupportTicket }) {
  const messages = useTicketMessages(ticket.id);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState("");
  const [lastReadCount, setLastReadCount] = useState(messages.length);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dragging, setDragging] = useState(false);

  const winRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Detect mobile
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  // Reset when ticket changes
  useEffect(() => {
    setOpen(false);
    setMinimized(false);
    setPos(null);
    setDraft("");
    setLastReadCount(messages.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  const clamp = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: Math.max(MARGIN, Math.min(w - WIDTH - MARGIN, x)),
      y: Math.max(MARGIN, Math.min(h - HEIGHT - MARGIN, y)),
    };
  }, []);

  // Initial position on open (desktop)
  useLayoutEffect(() => {
    if (!open || isMobile || pos !== null) return;
    if (typeof window === "undefined") return;
    setPos(
      clamp(
        window.innerWidth - WIDTH - 24,
        window.innerHeight - HEIGHT - 24,
      ),
    );
  }, [open, isMobile, pos, clamp]);

  // Re-clamp on resize
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  // Auto scroll on new messages when visible
  useEffect(() => {
    if (!open || minimized) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, open, minimized]);

  // Mark read
  useEffect(() => {
    if (open && !minimized) setLastReadCount(messages.length);
  }, [open, minimized, messages.length]);

  const unread =
    !open || minimized
      ? messages
          .slice(lastReadCount)
          .filter((m) => m.author === "cliente").length
      : 0;

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobile || !pos) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setDragging(true);
  };
  const onHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = d.origX + (e.clientX - d.startX);
    const ny = d.origY + (e.clientY - d.startY);
    setPos(clamp(nx, ny));
  };
  const onHeaderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendTicketMessage(ticket.id, text);
    setDraft("");
  };

  const handleAttach = () => fileInputRef.current?.click();

  const showWindow = open;
  const showList = open && !minimized;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Increase z above Radix overlay/content */}
      {/* FAB */}
      <button
        data-ticket-floating-chat
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
          setMinimized(false);
        }}
        title="Abrir chat"
        aria-label="Abrir chat"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          zIndex: 9999,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
        className={cn(
          "max-xl:!bottom-4 max-xl:!right-4 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:brightness-110 cursor-pointer",
        )}
      >
        <MessageSquare
          style={{ width: 22, height: 22, cursor: "pointer", pointerEvents: "none" }}
          aria-hidden
        />
        {unread > 0 && (
          <span
            style={{ pointerEvents: "none" }}
            className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>


      {showWindow &&
        (isMobile ? (
          <div
            data-ticket-floating-chat
            style={{ pointerEvents: "auto" }}
            className="fixed inset-x-2 bottom-2 top-2 z-[110] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <ChatHeader
              ticket={ticket}
              onMinimize={() => setMinimized(true)}
              onClose={() => setOpen(false)}
              draggable={false}
            />
            {showList && (
              <>
                <div
                  ref={listRef}
                  className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-muted/20 px-3 py-4"
                >
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-[12px] text-muted-foreground">
                      Nenhuma mensagem ainda.
                    </p>
                  ) : (
                    messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                  )}
                </div>
                <Composer
                  draft={draft}
                  setDraft={setDraft}
                  onSubmit={submit}
                  onAttach={handleAttach}
                  fileInputRef={fileInputRef}
                />
              </>
            )}
          </div>
        ) : (
          <div
            data-ticket-floating-chat
            ref={winRef}
            style={{
              transform: pos
                ? `translate3d(${pos.x}px, ${pos.y}px, 0)`
                : "translate3d(-9999px, -9999px, 0)",
              width: WIDTH,
              height: minimized ? undefined : HEIGHT,
              willChange: dragging ? "transform" : undefined,
              pointerEvents: "auto",
            }}
            className={cn(
              "fixed left-0 top-0 z-[110] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
              dragging && "select-none",
            )}
          >
            <ChatHeader
              ticket={ticket}
              onMinimize={() => setMinimized((v) => !v)}
              onClose={() => setOpen(false)}
              draggable
              dragging={dragging}
              onPointerDown={onHeaderPointerDown}
              onPointerMove={onHeaderPointerMove}
              onPointerUp={onHeaderPointerUp}
              onPointerCancel={onHeaderPointerUp}
              minimized={minimized}
            />
            {showList && (
              <>
                <div
                  ref={listRef}
                  className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-muted/20 px-3 py-4"
                >
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-[12px] text-muted-foreground">
                      Nenhuma mensagem ainda.
                    </p>
                  ) : (
                    messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                  )}
                </div>
                <Composer
                  draft={draft}
                  setDraft={setDraft}
                  onSubmit={submit}
                  onAttach={handleAttach}
                  fileInputRef={fileInputRef}
                />
              </>
            )}
          </div>
        ))}
    </>,
    document.body,
  );
}

function ChatHeader({
  ticket,
  onMinimize,
  onClose,
  draggable,
  dragging,
  minimized,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  ticket: SupportTicket;
  onMinimize: () => void;
  onClose: () => void;
  draggable: boolean;
  dragging?: boolean;
  minimized?: boolean;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={
        draggable
          ? { cursor: dragging ? "grabbing" : "grab", touchAction: "none" }
          : undefined
      }
      className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">
          {ticket.clientName || "Cliente não vinculado"}
        </p>
        <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          <span className="font-mono">{ticket.protocol}</span>
          <span aria-hidden>·</span>
          <span
            className="inline-flex items-center gap-1 text-success"
            title="Conectado"
          >
            <Wifi className="h-3 w-3" />
            Online
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1" data-no-drag>
        <button
          type="button"
          onClick={onMinimize}
          aria-label={minimized ? "Restaurar chat" : "Minimizar chat"}
          title={minimized ? "Restaurar chat" : "Minimizar chat"}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar chat"
          title="Fechar chat"
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  onSubmit,
  onAttach,
  fileInputRef,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: (e?: FormEvent) => void;
  onAttach: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const draftCorrection = useSpellCorrection({ value: draft, onChange: setDraft });
  return (
    <form
      onSubmit={onSubmit}
      className="flex shrink-0 items-end gap-2 border-t border-border bg-card px-3 py-2.5"
    >
      <input ref={fileInputRef} type="file" className="hidden" multiple />
      <button
        type="button"
        onClick={onAttach}
        aria-label="Anexar arquivo"
        title="Anexar arquivo"
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
      <textarea
        lang="pt-BR"
        spellCheck
        autoCorrect="on"
        autoCapitalize="sentences"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          draftCorrection.notifyTyping(e);
        }}
        onBlur={() => draftCorrection.runNow()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={1}
        placeholder="Digite uma mensagem..."
        className="min-h-[38px] max-h-32 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
      />
      <CorrectionHint correcting={draftCorrection.correcting} corrected={draftCorrection.corrected} onUndo={draftCorrection.undo} />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!draft.trim()}
        aria-label="Enviar mensagem"
        className="h-9 w-9 shrink-0 cursor-pointer rounded-xl"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
