import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { ticketsStore } from "@/lib/tickets-store";
import type { SupportTicket } from "@/lib/support-tickets-data";

export function ManualTicketTimelineModal({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: SupportTicket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setSubject("");
      setDescription("");
    }
  }, [open, ticket.id]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await ticketsStore.addManualTimeline(ticket.id, { subject, description });
      toast.success("Registro adicionado à timeline", { description: ticket.protocol });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="ticket-action-modal flex w-[calc(100vw-2rem)] max-w-2xl max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Adicionar registro à timeline</DialogTitle>
        <DetailModalHeader
          icon={MessageSquarePlus}
          title="Adicionar à timeline"
          protocol={ticket.protocol}
          meta={ticket.clientName}
        />
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Este registro será adicionado ao chamado atual.
          </p>
          <div>
            <Label htmlFor="manual-ticket-subject">Assunto</Label>
            <Input
              id="manual-ticket-subject"
              className="mt-1"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="manual-ticket-description">Descrição</Label>
            <Textarea
              id="manual-ticket-description"
              className="mt-1 min-h-40"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter showClose={false} className="ticket-action-footer border-t px-5 py-3">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={
              saving || !subject.trim() || !description.trim() || ticket.status === "Finalizado"
            }
            onClick={() => void save()}
          >
            {saving ? "Salvando..." : "Adicionar à timeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
