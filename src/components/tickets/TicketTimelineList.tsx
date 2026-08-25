import { useMemo } from "react";
import {
  CalendarClock,
  Ban,
  CheckCircle2,
  FileText,
  MessageSquare,
  Paperclip,
  PlayCircle,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type { TicketEvent } from "@/lib/tickets-store";

export const timelineEventPresentation: Record<
  TicketEvent["kind"],
  { label: string; color: string; softColor: string; icon: typeof FileText }
> = {
  created: {
    label: "Chamado criado",
    color: "#8b5bd6",
    softColor: "rgba(139, 91, 214, 0.24)",
    icon: MessageSquare,
  },
  attached: {
    label: "Arquivo anexado",
    color: "#f59b45",
    softColor: "rgba(245, 155, 69, 0.24)",
    icon: Paperclip,
  },
  assumed: {
    label: "Chamado assumido",
    color: "#47b985",
    softColor: "rgba(71, 185, 133, 0.24)",
    icon: UserPlus,
  },
  attend: {
    label: "Atendimento iniciado",
    color: "#38a6d9",
    softColor: "rgba(56, 166, 217, 0.24)",
    icon: PlayCircle,
  },
  status: {
    label: "Status alterado",
    color: "#e04d87",
    softColor: "rgba(224, 77, 135, 0.24)",
    icon: ShieldCheck,
  },
  message: {
    label: "Retorno enviado",
    color: "#5877d8",
    softColor: "rgba(88, 119, 216, 0.24)",
    icon: Send,
  },
  note: {
    label: "Nota interna",
    color: "#d79531",
    softColor: "rgba(215, 149, 49, 0.24)",
    icon: FileText,
  },
  solution: {
    label: "Solução aplicada",
    color: "#20ad74",
    softColor: "rgba(32, 173, 116, 0.24)",
    icon: Sparkles,
  },
  closed: {
    label: "Chamado encerrado",
    color: "#20ad74",
    softColor: "rgba(32, 173, 116, 0.24)",
    icon: CheckCircle2,
  },
  scheduled: {
    label: "Evento agendado",
    color: "#d79531",
    softColor: "rgba(215, 149, 49, 0.24)",
    icon: CalendarClock,
  },
  forwarded: {
    label: "Enviado a especialista",
    color: "#1f9860",
    softColor: "rgba(31, 152, 96, 0.24)",
    icon: UserCheck,
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Variant = "full" | "compact";

export function TicketTimelineList({
  events,
  variant = "full",
  limit,
  emptyLabel = "Nenhum evento registrado ainda.",
  onEventSelect,
  onEventCancel,
  onEventReport,
  getScheduledEventStatus,
}: {
  events: TicketEvent[];
  variant?: Variant;
  limit?: number;
  emptyLabel?: string;
  onEventSelect?: (event: TicketEvent) => void;
  onEventCancel?: (event: TicketEvent) => void;
  onEventReport?: (event: TicketEvent) => void;
  getScheduledEventStatus?: (event: TicketEvent) => "active" | "completed" | "cancelled";
}) {
  const sorted = useMemo(() => {
    // Ordena por data/hora real decrescente (mais recente primeiro).
    // Em caso de horários iguais, preserva a ordem original dos eventos
    // usando um sort estável baseado no índice original.
    const indexed = events.map((event, index) => ({ event, index }));
    indexed.sort((a, b) => {
      const diff = new Date(b.event.when).getTime() - new Date(a.event.when).getTime();
      if (diff !== 0) return diff;
      return a.index - b.index;
    });
    const arr = indexed.map((item) => item.event);
    return typeof limit === "number" ? arr.slice(0, limit) : arr;
  }, [events, limit]);

  if (sorted.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">{emptyLabel}</p>;
  }

  const isCompact = variant === "compact";

  // Sizing tokens per variant
  const rowMinH = isCompact ? "min-h-[92px]" : "min-h-[132px]";
  const colTemplate = isCompact
    ? "grid-cols-[60px_minmax(0,1fr)] gap-3"
    : "grid-cols-[76px_minmax(0,1fr)] gap-4 sm:grid-cols-[94px_minmax(0,1fr)] sm:gap-6";
  const ringSize = isCompact
    ? "h-[58px] w-[58px] border-[5px]"
    : "h-[76px] w-[76px] border-[7px] sm:h-[88px] sm:w-[88px]";
  const iconWrap = isCompact
    ? "mt-[13px] h-8 w-8"
    : "mt-[19px] h-10 w-10 sm:mt-[22px] sm:h-11 sm:w-11";
  const iconSize = isCompact ? "h-4 w-4" : "h-5 w-5";
  const connectorLeft = isCompact ? "left-[29px]" : "left-[37px] sm:left-[47px]";
  const connectorTop = isCompact
    ? "top-[52px] h-[calc(100%-32px)]"
    : "top-[66px] h-[calc(100%-42px)]";
  const topDot = isCompact ? "h-2 w-2" : "h-2.5 w-2.5";
  const bottomDotTop = isCompact ? "top-[54px]" : "top-[72px] sm:top-[84px]";
  const dateBadge = isCompact
    ? "min-w-[96px] px-2.5 py-0.5 text-[10.5px]"
    : "min-w-[112px] px-3 py-1 text-[11px]";
  const titleSize = isCompact ? "text-[11px]" : "text-[12px]";
  const descSize = isCompact ? "text-[12px] leading-[18px]" : "text-[13px] leading-5";
  const metaSize = isCompact ? "text-[10.5px]" : "text-[11.5px]";
  const timeSize = isCompact ? "text-[10.5px]" : "text-[11px]";
  const articlePad = isCompact ? "pb-5 pt-0.5" : "pb-8 pt-1";
  const maxW = isCompact ? "max-w-full" : "max-w-[720px]";

  return (
    <ol className={`mx-auto ${maxW}`}>
      {sorted.map((event, index) => {
        const presentation = timelineEventPresentation[event.kind];
        const Icon = presentation.icon;
        const isLast = index === sorted.length - 1;
        const isSelectable = event.kind === "scheduled" && Boolean(onEventSelect);
        const scheduledStatus =
          event.kind === "scheduled" ? (getScheduledEventStatus?.(event) ?? "active") : "active";
        const isScheduledActive = scheduledStatus === "active";

        return (
          <li
            key={event.id}
            className={`relative grid ${rowMinH} ${colTemplate} ${isSelectable ? "cursor-pointer rounded-lg transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
            role={isSelectable ? "button" : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            title={isSelectable ? "Abrir detalhes do agendamento" : undefined}
            onClick={isSelectable ? () => onEventSelect?.(event) : undefined}
            onKeyDown={
              isSelectable
                ? (keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                      keyboardEvent.preventDefault();
                      onEventSelect?.(event);
                    }
                  }
                : undefined
            }
          >
            {!isLast && (
              <span
                aria-hidden
                className={`absolute ${connectorLeft} ${connectorTop} w-[3px] -translate-x-1/2 rounded-full`}
                style={{ backgroundColor: presentation.softColor }}
              />
            )}

            <div className="relative flex justify-center pt-1">
              <span
                aria-hidden
                className={`absolute top-0 rounded-full ${ringSize}`}
                style={{ borderColor: presentation.softColor }}
              />
              <span
                aria-hidden
                className={`absolute left-1/2 top-[6px] -translate-x-1/2 rounded-full ${topDot}`}
                style={{ backgroundColor: presentation.color }}
              />
              <span
                className={`relative grid place-items-center rounded-full text-white shadow-sm ${iconWrap}`}
                style={{ backgroundColor: presentation.color }}
              >
                <Icon className={iconSize} />
              </span>
              <span
                aria-hidden
                className={`absolute left-1/2 -translate-x-1/2 rounded-full ${bottomDotTop} h-2 w-2`}
                style={{ backgroundColor: presentation.color }}
              />
            </div>

            <article className={`min-w-0 ${articlePad}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center rounded-full font-medium text-white shadow-sm ${dateBadge}`}
                  style={{ backgroundColor: presentation.color }}
                >
                  {formatDate(event.when)}
                </span>
                <span className={`${timeSize} text-muted-foreground`}>
                  {formatTime(event.when)}
                </span>
              </div>

              <h3
                className={`mt-2 ${titleSize} font-semibold uppercase tracking-normal`}
                style={{ color: presentation.color }}
              >
                {event.kind === "attend" && /retomou atendimento/i.test(event.description)
                  ? "Atendimento retomado"
                  : presentation.label}
              </h3>
              {/<[a-z][\s\S]*>/i.test(event.description) ? (
                <div
                  className={`rte-content mt-1 ${descSize} text-foreground break-words`}
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              ) : (
                <p className={`mt-1 ${descSize} text-foreground break-words`}>
                  {event.description}
                </p>
              )}
              <p className={`mt-1 ${metaSize} text-muted-foreground`}>
                {event.actor} · {event.actorType}
              </p>
              {event.attachment?.dataUrl && (
                <a
                  href={event.attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block max-w-[760px]"
                >
                  <img
                    src={event.attachment.dataUrl}
                    alt={event.attachment.name}
                    className="max-h-[420px] w-auto max-w-full rounded-lg border border-border object-contain"
                  />
                </a>
              )}
              {isSelectable && (
                <div className={`mt-2 flex flex-wrap items-center gap-3 ${metaSize}`}>
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 font-medium text-primary hover:underline"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onEventSelect?.(event);
                    }}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Ver agendamento
                  </button>
                  {isScheduledActive && onEventCancel && (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 font-medium text-rose-600 hover:underline dark:text-rose-400"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventCancel(event);
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  )}
                  {isScheduledActive && onEventReport && (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 font-medium text-primary hover:underline"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventReport(event);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Relatório
                    </button>
                  )}
                  {!isScheduledActive && (
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        scheduledStatus === "completed"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {scheduledStatus === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Ban className="h-3.5 w-3.5" />
                      )}
                      {scheduledStatus === "completed" ? "Concluído" : "Cancelado"}
                    </span>
                  )}
                </div>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
