import { useMemo } from "react";
import { CalendarClock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { TicketTimelineList } from "@/components/tickets/TicketTimelineList";
import {
  EVENT_TONE_LABEL,
  EVENT_TONE_STYLES,
  TYPE_ICON,
  getEventTone,
  type CalendarEvent,
} from "@/lib/calendar-events";
import { useTicketEvents, useTickets, type TicketEvent } from "@/lib/tickets-store";
import { cn } from "@/lib/utils";

function protocolFromTitle(title: string) {
  return title.match(/(PRC-\d+)/i)?.[1]?.toUpperCase();
}

function eventInstant(event: CalendarEvent) {
  return new Date(`${event.date}T${event.time || "00:00"}:00-03:00`).toISOString();
}

function appointmentEvent(event: CalendarEvent): TicketEvent {
  const responsible = event.responsible || event.operator || "Não informado";
  return {
    id: `appointment-${event.id}`,
    kind: "scheduled",
    when: eventInstant(event),
    actor: responsible,
    actorType: "suporte",
    description: [
      event.title,
      event.description,
      `Agendado para ${formatDate(event.date)}, das ${event.time} às ${event.end}.`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function SupportAppointmentDetailsModal({
  event,
  open,
  onOpenChange,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tickets = useTickets();
  const protocol = event ? event.protocol || protocolFromTitle(event.title) : undefined;
  const ticket = useMemo(
    () =>
      event
        ? tickets.find(
            (item) => item.id === event.ticketId || (protocol && item.protocol === protocol),
          ) ?? null
        : null,
    [event, protocol, tickets],
  );
  const recordedEvents = useTicketEvents(ticket?.id);

  const timeline = useMemo(() => {
    if (!event) return [];
    const currentAppointment = appointmentEvent(event);
    const hasMatchingAppointment = recordedEvents.some(
      (item) =>
        item.kind === "scheduled" &&
        (item.description.includes(String(event.id)) || item.description.includes(event.title)),
    );
    return hasMatchingAppointment ? recordedEvents : [...recordedEvents, currentAppointment];
  }, [event, recordedEvents]);

  if (!event) return null;

  const Icon: LucideIcon = TYPE_ICON[event.type];
  const tone = getEventTone(event);
  const toneStyle = EVENT_TONE_STYLES[tone];
  const responsible = event.responsible || event.operator || "Não informado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-1rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:w-[calc(100vw-2rem)] [&>button]:hidden">
        <DialogTitle className="sr-only">Detalhes do agendamento</DialogTitle>
        <DetailModalHeader
          icon={Icon}
          title={event.client || ticket?.clientName || event.title}
          protocol={protocol || ticket?.protocol}
          onClose={() => onOpenChange(false)}
          chips={
            <>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {event.type}
              </Badge>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", toneStyle.soft, toneStyle.text)}>
                {EVENT_TONE_LABEL[tone]}
              </span>
            </>
          }
          meta={
            <>
              {(event.client || ticket?.clientName) && <span className="text-foreground">{event.title}</span>}
              <span>{formatDate(event.date)}</span>
              <span className="tabular-nums">{event.time} às {event.end}</span>
              <span className="font-medium text-foreground">{responsible}</span>
            </>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Timeline do agendamento</h3>
          </div>
          <TicketTimelineList
            events={timeline}
            variant="compact"
            emptyLabel="Nenhum histórico registrado para este agendamento."
          />
        </div>

        <DialogFooter className="border-t border-border bg-card px-5 py-3">
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
