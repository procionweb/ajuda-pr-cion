import { useState } from "react";
import { AlertTriangle, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createFleetEntry,
  type FleetOccurrenceKind,
  type FleetOccurrenceSeverity,
} from "@/lib/fleet-entry-store";
import { useOperatorAcronyms } from "@/lib/collaborators-store";

const KIND_LABELS: Record<FleetOccurrenceKind, string> = {
  colisao: "Colisão",
  multa: "Multa",
  avaria: "Avaria",
  pane: "Pane",
  outro: "Outro",
};

function localNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function OccurrenceDialog({
  vehicleId,
  open,
  onOpenChange,
}: {
  vehicleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const operators = useOperatorAcronyms();
  const [occurredAt, setOccurredAt] = useState(localNow);
  const [kind, setKind] = useState<FleetOccurrenceKind>("avaria");
  const [severity, setSeverity] = useState<FleetOccurrenceSeverity>("baixa");
  const [driver, setDriver] = useState("");
  const [location, setLocation] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");

  const reset = () => {
    setOccurredAt(localNow());
    setKind("avaria");
    setSeverity("baixa");
    setDriver("");
    setLocation("");
    setMileage("");
    setDescription("");
    setReference("");
    setAmount("");
  };

  const save = () => {
    if (!description.trim()) return toast.error("Descreva o que aconteceu.");
    createFleetEntry({
      type: "ocorrencia",
      vehicleId,
      occurredAt,
      title: KIND_LABELS[kind],
      notes: description.trim(),
      mileage: mileage ? Number(mileage) : undefined,
      amount:
        kind === "multa" && amount ? Number(amount.replace(".", "").replace(",", ".")) : undefined,
      driver: driver || undefined,
      location: location.trim() || undefined,
      occurrenceKind: kind,
      occurrenceSeverity: severity,
      occurrenceReference: reference.trim() || undefined,
    });
    toast.success("Ocorrência registrada com sucesso.");
    reset();
    onOpenChange(false);
  };
  const exportOccurrence = () => {
    const lines = [
      "OCORRÊNCIA DE FROTA",
      `Data: ${occurredAt}`,
      `Tipo: ${KIND_LABELS[kind]}`,
      `Gravidade: ${severity}`,
      `Condutor: ${driver || "Não informado"}`,
      `Local: ${location || "Não informado"}`,
      `Odômetro: ${mileage || "Não informado"}`,
      `Referência: ${reference || "Não informada"}`,
      "",
      description || "Descrição não informada",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocorrencia-${occurredAt.slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Registrar ocorrência
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2 [scrollbar-width:thin]">
          <Field label="Data e hora">
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
          <Field label="Tipo de ocorrência">
            <select
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as FleetOccurrenceKind)}
            >
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gravidade">
            <select
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as FleetOccurrenceSeverity)}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </Field>
          <Field label="Condutor">
            <select
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              <option value="">Selecione um PRC</option>
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Rodovia, rua ou cidade"
            />
          </Field>
          <Field label="Odômetro (km)">
            <Input
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label={kind === "multa" ? "Auto de infração" : "BO / referência (opcional)"}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          {kind === "multa" && (
            <Field label="Valor da multa (R$)">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Descrição do ocorrido">
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Informe o que aconteceu, danos percebidos e providências tomadas."
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" onClick={exportOccurrence} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={save} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar ocorrência
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
