import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Fuel, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import {
  getUsageById,
  getVehicleById,
  registerDeparture,
  formatFleetDateTime,
  getVehicleFuelState,
} from "@/lib/fleet-store";

import { fleetActions } from "@/lib/fleet-action-store";
import { SmartTextarea } from "@/components/ui/smart-text";

const preventClose = (e: Event) => e.preventDefault();
const FUEL_OPTIONS = ["Cheio", "3/4", "1/2", "1/4", "Reserva"] as const;

export function RegisterDepartureModal({
  usageId,
  vehicleId,
}: {
  usageId: string;
  vehicleId: string;
}) {
  const usage = getUsageById(usageId);
  const vehicle = getVehicleById(vehicleId);
  const [mileage, setMileage] = useState(vehicle?.currentMileage?.toString() ?? "");
  const [fuel, setFuel] = useState(vehicle?.fuelLevel ?? "1/2");
  const [notes, setNotes] = useState("");

  if (!usage || !vehicle) return null;
  const fuelState = getVehicleFuelState(vehicle);

  const submit = () => {
    const km = Number(mileage);
    if (!km || Number.isNaN(km)) return toast.error("Informe a KM de saída.");
    if (km < vehicle.currentMileage)
      return toast.error("KM de saída não pode ser menor que a KM atual do veículo.");
    registerDeparture(usageId, {
      vehicleId,
      departureMileage: km,
      fuelAtDeparture: fuel,
      departureNotes: notes.trim() || undefined,
    });
    toast.success(`Saída registrada — ${vehicle.model}`);
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
        <DialogTitle className="sr-only">Registrar saída do veículo</DialogTitle>
        <DetailModalHeader
          icon={KeyRound}
          title="Registrar saída do veículo"
          protocol={`${vehicle.model} · ${vehicle.plate}`}
          onClose={() => fleetActions.close()}
        />

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {fuelState.isReserve && (
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-[12px]">
                <b>Veículo na reserva.</b>
                <p>
                  Estimativa: {fuelState.liters.toFixed(1)} L e autonomia aproximada de{" "}
                  {fuelState.estimatedRangeKm} km. Providencie o abastecimento.
                </p>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px]">
            <p>
              <b>Operador:</b> {usage.operatorId}
            </p>
            <p>
              <b>Destino:</b> {usage.destination}
            </p>
            {usage.scheduledStartAt && (
              <p>
                <b>Saída prevista:</b> {formatFleetDateTime(usage.scheduledStartAt)}
              </p>
            )}
            {usage.expectedReturnAt && (
              <p>
                <b>Devolução prevista:</b> {formatFleetDateTime(usage.expectedReturnAt)}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-[12.5px] font-medium">KM de saída *</Label>
              <Input
                inputMode="numeric"
                value={mileage}
                onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))}
                placeholder={vehicle.currentMileage.toString()}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                KM atual do veículo: {vehicle.currentMileage.toLocaleString("pt-BR")} km
              </p>
            </div>
            <div>
              <Label className="mb-1.5 block text-[12.5px] font-medium">Combustível *</Label>
              <div className="relative">
                <Fuel className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={fuel}
                  onChange={(e) => setFuel(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-background pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                >
                  {FUEL_OPTIONS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-[12.5px] font-medium">Observações</Label>
            <SmartTextarea
              value={notes}
              onValueChange={setNotes}
              rows={3}
              className="resize-none"
              placeholder="Condições do veículo, materiais que estão sendo levados, etc."
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
            <KeyRound className="mr-1.5 h-4 w-4" />
            Confirmar saída
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
