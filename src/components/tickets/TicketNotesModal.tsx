import { NotebookText, UserRound, CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import type { InternalNote } from "@/lib/tickets-store";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketNotesModal({
  open,
  onOpenChange,
  notes,
  protocol,
  clientName,
  clientCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notes: InternalNote[];
  protocol?: string;
  clientName?: string;
  clientCode?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 sm:w-[calc(100vw-2rem)] md:w-[560px] [&>button]:hidden">
        <DialogTitle className="sr-only">Notas internas {protocol ?? ""}</DialogTitle>

        <DetailModalHeader
          icon={NotebookText}
          title={clientName || "Cliente não vinculado"}
          protocol={protocol}
          onClose={() => onOpenChange(false)}
          meta={
            <span className="text-foreground">
              Nota interna{clientCode ? ` · ${clientCode}` : ""}
            </span>
          }
        />

        <div className="flex-1 overflow-y-auto bg-card px-5 py-4">
          {notes.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Nenhuma nota interna adicionada.
            </p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl border border-border bg-card p-3 shadow-[0_4px_12px_rgba(25,29,51,0.04)]"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <UserRound className="h-3 w-3" />
                      {n.operator}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                    {n.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-card px-5 py-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-lg"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
