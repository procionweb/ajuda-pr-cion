import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { TicketHistoryList } from "./TicketHistoryList";
import { PastAttendanceDetailModal } from "./PastAttendanceDetailModal";
import {
  getTicketsByClient,
  ticketToPastAttendance,
} from "@/lib/tickets-store";
import type { PastAttendance } from "@/lib/tickets-store";
import type { SupportTicket } from "@/lib/support-tickets-data";

type ClientInfo = {
  acronym: string;
  razaoSocial: string;
  status?: string;
};

export function ClientTicketsHistoryModal({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ClientInfo;
}) {
  const [selected, setSelected] = useState<PastAttendance | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const { items, ticketMap } = useMemo(() => {
    const tickets = getTicketsByClient(client.acronym).sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
    const map = new Map<string, SupportTicket>();
    tickets.forEach((t) => map.set(t.id, t));
    return { items: tickets.map(ticketToPastAttendance), ticketMap: map };
  }, [client.acronym]);

  const handleSelect = (item: PastAttendance) => {
    setSelected(item);
    setSelectedTicket(ticketMap.get(item.id) ?? null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        className="flex w-[calc(100vw-2rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">
          Histórico de chamados de {client.razaoSocial}
        </DialogTitle>

        <DetailModalHeader
          icon={History}
          title={client.razaoSocial || client.fantasia || client.acronym}
          onClose={() => onOpenChange(false)}
          chips={
            client.status ? (
              <Badge className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                {client.status}
              </Badge>
            ) : null
          }
          meta={
            <span className="inline-flex items-center gap-1">
              <span className="truncate text-foreground">Histórico de chamados</span>
              <span aria-hidden className="text-border">·</span>
              <span className="font-semibold text-primary">{client.acronym}</span>
            </span>
          }
        />

        <div className="min-h-0 overflow-y-auto bg-card px-4 py-5 md:px-6">
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="text-[13px] font-medium text-foreground">Chamados</span>
            <span className="text-[12px] font-medium text-muted-foreground">
              ({items.length})
            </span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-[12.5px] text-muted-foreground">
              Nenhum chamado encontrado para este cliente
            </div>
          ) : (
            <TicketHistoryList items={items} onSelect={handleSelect} timeline />
          )}
        </div>
      </DialogContent>

      <PastAttendanceDetailModal
        open={selected !== null}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setSelectedTicket(null);
          }
        }}
        attendance={selected}
        ticket={selectedTicket}
      />
    </Dialog>
  );
}
