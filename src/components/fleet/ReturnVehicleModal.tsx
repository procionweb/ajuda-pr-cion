import { useState } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { getUsageById, getVehicleById, registerReturn } from "@/lib/fleet-store";
import { fleetActions } from "@/lib/fleet-action-store";
import { SmartTextarea } from "@/components/ui/smart-text";

const preventClose = (e: Event) => e.preventDefault();

export function ReturnVehicleModal({ usageId }: { usageId: string }) {
  const usage = getUsageById(usageId);
  const vehicle = getVehicleById(usage?.vehicleId);
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");

  if (!usage || !vehicle) return null;

  const distance =
    mileage && usage.departureMileage
      ? Math.max(0, Number(mileage) - usage.departureMileage)
      : undefined;

  const submit = () => {
    const km = Number(mileage);
    if (!km || Number.isNaN(km)) return toast.error("Informe a KM final.");
    if (usage.departureMileage && km < usage.departureMileage)
      return toast.error("KM final não pode ser menor que a KM de saída.");
    registerReturn(usageId, {
      returnMileage: km,
      fuelAtReturn: vehicle.fuelLevel,
      returnNotes: notes.trim() || undefined,
    });
    toast.success("Devolução registrada com sucesso.");
    fleetActions.close();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && fleetActions.close()}>
      <DialogContent
        onPointerDownOutside={preventClose}
        onInteractOutside={preventClose}
        onEscapeKeyDown={preventClose}
        className="flex w-[calc(100vw-2rem)] max-w-[620px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 [&>button]:hidden [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer"
      >
        <DialogTitle className="sr-only">Registrar devolução do veículo</DialogTitle>
        <DetailModalHeader
          icon={Undo2}
          title="Registrar devolução"
          protocol={`${vehicle.model} · ${vehicle.plate}`}
          onClose={() => fleetActions.close()}
        />

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px]">
            <p>
              <b>Operador:</b> {usage.operatorId}
            </p>
            <p>
              <b>Destino:</b> {usage.destination}
            </p>
            <p>
              <b>Saída:</b>{" "}
              {usage.departureAt ? new Date(usage.departureAt).toLocaleString("pt-BR") : "—"}
              {" · "}
              <b>KM saída:</b> {usage.departureMileage?.toLocaleString("pt-BR") ?? "—"} km
              {" · "}
              <b>Combustível:</b> {usage.fuelAtDeparture ?? "—"}
            </p>
          </div>

          <div>
            <div>
              <Label className="mb-1.5 block text-[12.5px] font-medium">KM final *</Label>
              <Input
                inputMode="numeric"
                value={mileage}
                onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))}
                placeholder={usage.departureMileage?.toString() ?? "0"}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                KM percorridos:{" "}
                <span className="text-foreground">
                  {distance !== undefined ? `${distance.toLocaleString("pt-BR")} km` : "—"}
                </span>
              </p>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-[12.5px] font-medium">
              Observações da devolução
            </Label>
            <SmartTextarea
              value={notes}
              onValueChange={setNotes}
              rows={3}
              className="resize-none"
              placeholder="Condições, ocorrências, avarias..."
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-4 py-2.5">
          <Button variant="outline" onClick={() => fleetActions.close()} className="cursor-pointer">
            Cancelar
          </Button>
          <Button
            onClick={submit}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
          >
            <Undo2 className="mr-1.5 h-4 w-4" />
            Confirmar devolução
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
