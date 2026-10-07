import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { activityTypes } from "@/lib/commercial-activities";
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function CommercialActivityDialog({
  leadId,
  actor,
  onSaved,
}: {
  leadId: string;
  actor: string;
  onSaved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "1",
    description: "",
    occurred_at: localNow(),
    return_at: "",
    priority: "media",
    stage: "",
  });
  const [requestId, setRequestId] = useState("");
  const set = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.description.trim()) {
      toast.error("Descreva a atividade.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc(
        "company_lead_activity_save" as never,
        {
          p_id: requestId,
          p_lead: leadId,
          p_payload: {
            ...form,
            actor,
            occurred_at: new Date(form.occurred_at).toISOString(),
            return_at: form.return_at ? new Date(form.return_at).toISOString() : null,
          },
        } as never,
      );
      if (error) throw error;
      setOpen(false);
      toast.success("Atividade registrada.");
      await onSaved();
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível registrar a atividade.",
      );
    } finally {
      setSaving(false);
    }
  }
  const selectClass =
    "mt-1 h-11 w-full cursor-pointer rounded-xl border bg-background px-3 text-sm";
  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setForm({
            type: "1",
            description: "",
            occurred_at: localNow(),
            return_at: "",
            priority: "media",
            stage: "",
          });
          setRequestId(crypto.randomUUID());
          setOpen(true);
        }}
      >
        <Plus className="mr-2 size-4" />
        Registrar atividade
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar atividade comercial</DialogTitle>
            <DialogDescription>
              Registre a ação realizada neste contato e, se necessário, agende um retorno.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="activity-type">Tipo *</Label>
                <select
                  id="activity-type"
                  className={selectClass}
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  {activityTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="activity-priority">Prioridade</Label>
                <select
                  id="activity-priority"
                  className={selectClass}
                  value={form.priority}
                  onChange={(e) => set("priority", e.target.value)}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <Label htmlFor="activity-date">Data da atividade *</Label>
                <Input
                  id="activity-date"
                  type="datetime-local"
                  required
                  value={form.occurred_at}
                  onChange={(e) => set("occurred_at", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="activity-return">Retorno (opcional)</Label>
                <Input
                  id="activity-return"
                  type="datetime-local"
                  value={form.return_at}
                  onChange={(e) => set("return_at", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="activity-stage">Etapa após a atividade (opcional)</Label>
              <select
                id="activity-stage"
                className={selectClass}
                value={form.stage}
                onChange={(e) => set("stage", e.target.value)}
              >
                <option value="">Manter etapa atual</option>
                {[
                  ["novo", "Novo"],
                  ["prospeccao", "Prospecção"],
                  ["relacionamento", "Relacionamento"],
                  ["proposta", "Proposta"],
                  ["negociacao", "Negociação"],
                  ["demonstracao", "Demonstração"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="activity-description">Atividade realizada *</Label>
              <Textarea
                id="activity-description"
                required
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Descreva o que foi conversado e os próximos passos..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sem retorno, a atividade fica concluída. Com retorno, ela entra no acompanhamento.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Registrar atividade"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
