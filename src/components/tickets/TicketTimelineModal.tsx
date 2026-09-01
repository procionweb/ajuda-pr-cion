import { Clock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import type { SupportTicket } from "@/lib/support-tickets-data";
import type { TicketEvent } from "@/lib/tickets-store";
import { TicketTimelineList } from "./TicketTimelineList";

export function TicketTimelineModal({
  open,
  onOpenChange,
  ticket,
  events,
  onEventSelect,
  onEventCancel,
  onEventReport,
  getScheduledEventStatus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: SupportTicket;
  events: TicketEvent[];
  onEventSelect?: (event: TicketEvent) => void;
  onEventCancel?: (event: TicketEvent) => void;
  onEventReport?: (event: TicketEvent) => void;
  getScheduledEventStatus?: (event: TicketEvent) => "active" | "completed" | "cancelled";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:w-[calc(100vw-2rem)] md:w-[760px] lg:w-[860px] [&>button]:hidden">
        <DialogTitle className="sr-only">
          Timeline completa do chamado {ticket.protocol}
        </DialogTitle>

        <DetailModalHeader
          icon={Clock}
          title={ticket.clientName || "Cliente não vinculado"}
          protocol={ticket.protocol}
          onClose={() => onOpenChange(false)}
          meta={
            <>
              <span className="truncate text-foreground">Timeline completa</span>
              <span aria-hidden className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-primary">{ticket.clientCode || "—"}</span>
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
              <span className="truncate text-muted-foreground">{ticket.subject}</span>
            </>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto bg-card px-4 py-7 sm:px-7 md:px-10">
          <TicketTimelineList
            events={events}
            variant="full"
            onEventSelect={onEventSelect}
            onEventCancel={onEventCancel}
            onEventReport={onEventReport}
            getScheduledEventStatus={getScheduledEventStatus}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
