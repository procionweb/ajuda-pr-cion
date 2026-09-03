import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Wrench,
  CheckCircle2,
  History,
  Plus,
  AlertCircle,
  Calendar,
  Gauge,
  Store,
  MessageSquare,
  ClipboardList,
  Package,
  DollarSign,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  addVehicleMaintenance,
  closeVehicleMaintenance,
  formatFleetDateTime,
  getMaintenanceReservationConflict,
  type Vehicle,
  type VehicleMaintenance,
  type VehicleReservation,
} from "@/lib/fleet-store";
import { cn } from "@/lib/utils";
import { createFleetEntry, updateFleetEntryByMaintenance } from "@/lib/fleet-entry-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaintenanceConflictDialog } from "@/components/fleet/MaintenanceConflictDialog";

type MaintenanceDialogProps = {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MaintenanceDialog({ vehicle, open, onOpenChange }: MaintenanceDialogProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"create" | "close" | "view">("create");
  const [selectedMaint, setSelectedMaint] = useState<VehicleMaintenance | null>(null);
  const [maintenanceConflict, setMaintenanceConflict] = useState<VehicleReservation | null>(null);

  // Form states for creation
  const [createForm, setCreateForm] = useState({
    entryDate: new Date().toISOString().slice(0, 16),
    entryMileage: String(vehicle.currentMileage),
    reason: "",
    workshop: "",
    notes: "",
    vehicleStatus: "manutencao" as "manutencao" | "disponivel",
  });

  // Form states for closing
  const [closeForm, setCloseForm] = useState({
    exitDate: new Date().toISOString().slice(0, 16),
    exitMileage: String(vehicle.currentMileage),
    partsCost: "",
    laborCost: "",
    servicesPerformed: "",
    partsReplaced: "",
    notes: "",
    nextRevisionDate: "",
    nextRevisionMileage: "",
    vehicleStatus: "disponivel" as "disponivel" | "manutencao",
  });

  useEffect(() => {
    if (open) {
      const active = vehicle.maintenanceRecords?.find((m) => m.status === "em_andamento");
      if (active) {
        setMode("close");
        setSelectedMaint(active);
        setCloseForm({
          exitDate: new Date().toISOString().slice(0, 16),
          exitMileage: String(vehicle.currentMileage),
          partsCost: "",
          laborCost: "",
          servicesPerformed: "",
          partsReplaced: "",
          notes: "",
          nextRevisionDate: "",
          nextRevisionMileage: "",
          vehicleStatus: "disponivel",
        });
      } else {
        setMode("create");
        setCreateForm({
          entryDate: new Date().toISOString().slice(0, 16),
          entryMileage: String(vehicle.currentMileage),
          reason: "",
          workshop: "",
          notes: "",
          vehicleStatus: "manutencao",
        });
      }
    }
  }, [open, vehicle]);

  const handleCreate = () => {
    if (!createForm.reason.trim() || !createForm.workshop.trim()) {
      toast.error("Preencha o motivo e a oficina.");
      return;
    }
    const conflict = getMaintenanceReservationConflict(vehicle.id, createForm.entryDate);
    if (conflict) {
      setMaintenanceConflict(conflict);
      return;
    }

    const maintenance = addVehicleMaintenance(
      vehicle.id,
      {
        entryDate: createForm.entryDate,
        entryMileage: Number(createForm.entryMileage),
        reason: createForm.reason.trim(),
        workshop: createForm.workshop.trim(),
        notes: createForm.notes.trim() || undefined,
      },
      createForm.vehicleStatus,
    );

    createFleetEntry({
      type: "servico",
      vehicleId: vehicle.id,
      occurredAt: createForm.entryDate,
      mileage: Number(createForm.entryMileage),
      title: createForm.reason.trim(),
      notes:
        [
          createForm.workshop.trim() ? `Oficina: ${createForm.workshop.trim()}` : "",
          createForm.notes.trim(),
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      maintenanceId: maintenance.id,
    });

    toast.success(
      createForm.vehicleStatus === "manutencao"
        ? "Manutenção iniciada. Veículo agora está em manutenção."
        : "Manutenção registrada e veículo mantido disponível.",
    );
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!selectedMaint) return;
    if (!closeForm.exitDate || !closeForm.servicesPerformed.trim()) {
      toast.error("Data de conclusão e serviços realizados são obrigatórios.");
      return;
    }

    if (Number(closeForm.exitMileage) < selectedMaint.entryMileage) {
      toast.error("A quilometragem de saída não pode ser menor que a de entrada.");
      return;
    }

    // Parse numeric cost from formatted string
    const partsCost = parseCurrency(closeForm.partsCost);
    const laborCost = parseCurrency(closeForm.laborCost);
    const numericCost = partsCost + laborCost;

    // Calculate duration
    const start = new Date(selectedMaint.entryDate);
    const end = new Date(closeForm.exitDate);
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    let duration = "";
    if (diffMinutes < 1440) {
      // < 24h
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      duration = `${hours}h ${mins}min`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      duration = `${days} ${days === 1 ? "dia" : "dias"} e ${hours}h`;
    }

    closeVehicleMaintenance(selectedMaint.id, {
      exitDate: closeForm.exitDate,
      exitMileage: Number(closeForm.exitMileage),
      cost: numericCost,
      partsCost,
      laborCost,
      duration,
      servicesPerformed: closeForm.servicesPerformed.trim(),
      partsReplaced: closeForm.partsReplaced.trim(),
      notes: closeForm.notes.trim() || undefined,
      nextRevisionDate: closeForm.nextRevisionDate || undefined,
      nextRevisionMileage: closeForm.nextRevisionMileage
        ? Number(closeForm.nextRevisionMileage)
        : undefined,
      vehicleStatus: closeForm.vehicleStatus,
    });

    const historyChanges = {
      occurredAt: closeForm.exitDate,
      mileage: Number(closeForm.exitMileage),
      title: closeForm.servicesPerformed.trim() || selectedMaint.reason,
      notes:
        [
          selectedMaint.workshop ? `Oficina: ${selectedMaint.workshop}` : "",
          closeForm.partsReplaced.trim() ? `Itens trocados: ${closeForm.partsReplaced.trim()}` : "",
          closeForm.notes.trim(),
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      amount: numericCost,
    };
    const updatedHistory = updateFleetEntryByMaintenance(selectedMaint.id, historyChanges);
    if (!updatedHistory) {
      createFleetEntry({
        type: "servico",
        vehicleId: vehicle.id,
        maintenanceId: selectedMaint.id,
        ...historyChanges,
      });
    }

    toast.success(
      closeForm.vehicleStatus === "manutencao"
        ? "Manutenção encerrada e veículo mantido em manutenção."
        : "Manutenção encerrada. Veículo agora está disponível.",
    );
    onOpenChange(false);
  };

  const formatCurrency = (value: string) => {
    // Remove non-digits
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue) return "";

    const numberValue = parseInt(cleanValue) / 100;
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numberValue);
  };

  const calculateCurrentDuration = () => {
    if (!selectedMaint || !closeForm.exitDate) return "Em andamento";

    const start = new Date(selectedMaint.entryDate);
    const end = new Date(closeForm.exitDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Data inválida";
    if (end < start) return "Conclusão anterior à entrada";

    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1440) {
      // < 24h
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins}min`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      return `${days} ${days === 1 ? "dia" : "dias"} e ${hours}h`;
    }
  };

  return (
    <><Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-[600px] [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer">
        <DialogHeader className="border-b border-border bg-muted/20 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wrench className="h-5 w-5 text-primary" />
            {mode === "create" ? "Iniciar Manutenção" : "Encerrar Manutenção"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {vehicle.model} · <span className="font-mono">{vehicle.plate}</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
          {mode === "create" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data/Hora de Entrada</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="datetime-local"
                      value={createForm.entryDate}
                      onChange={(e) => setCreateForm({ ...createForm, entryDate: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quilometragem Inicial</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={createForm.entryMileage}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, entryMileage: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo / Problema</Label>
                <div className="relative">
                  <AlertCircle className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: Barulho na suspensão, Troca de óleo..."
                    value={createForm.reason}
                    onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Oficina</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome da oficina ou concessionária"
                    value={createForm.workshop}
                    onChange={(e) => setCreateForm({ ...createForm, workshop: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações Iniciais</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    placeholder="Detalhes adicionais..."
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    className="min-h-[100px] pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status do veículo</Label>
                <Select
                  value={createForm.vehicleStatus}
                  onValueChange={(value: "manutencao" | "disponivel") =>
                    setCreateForm({ ...createForm, vehicleStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manutencao">Em manutenção</SelectItem>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Resumo da Entrada */}
              <Card className="bg-muted/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Dados de Entrada
                </div>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Entrada:</span>
                    <p className="font-medium">{formatFleetDateTime(selectedMaint?.entryDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">KM Entrada:</span>
                    <p className="font-medium">
                      {selectedMaint?.entryMileage.toLocaleString("pt-BR")} km
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Motivo:</span>
                    <p className="font-medium">{selectedMaint?.reason}</p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Conclusão</Label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="datetime-local"
                      value={closeForm.exitDate}
                      onChange={(e) => setCloseForm({ ...closeForm, exitDate: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>KM na Conclusão</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={closeForm.exitMileage}
                      onChange={(e) => setCloseForm({ ...closeForm, exitMileage: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Peças (R$)</Label>
                  <CurrencyField
                    value={closeForm.partsCost}
                    onChange={(partsCost) => setCloseForm({ ...closeForm, partsCost })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mão de obra (R$)</Label>
                  <CurrencyField
                    value={closeForm.laborCost}
                    onChange={(laborCost) => setCloseForm({ ...closeForm, laborCost })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    readOnly
                    value={`R$ ${(parseCurrency(closeForm.partsCost) + parseCurrency(closeForm.laborCost)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    className="bg-muted/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Duração do serviço</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      readOnly
                      value={calculateCurrentDuration()}
                      className="bg-muted/50 pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Serviços Realizados</Label>
                <div className="relative">
                  <ClipboardList className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    placeholder="Descreva detalhadamente o que foi feito..."
                    value={closeForm.servicesPerformed}
                    onChange={(e) =>
                      setCloseForm({ ...closeForm, servicesPerformed: e.target.value })
                    }
                    className="min-h-[80px] pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Peças / Itens Trocados</Label>
                <div className="relative">
                  <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    placeholder="Listagem de peças..."
                    value={closeForm.partsReplaced}
                    onChange={(e) => setCloseForm({ ...closeForm, partsReplaced: e.target.value })}
                    className="min-h-[80px] pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Próxima Revisão (Data)</Label>
                  <Input
                    type="date"
                    value={closeForm.nextRevisionDate}
                    onChange={(e) =>
                      setCloseForm({ ...closeForm, nextRevisionDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Próxima Revisão (KM)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 60000"
                    value={closeForm.nextRevisionMileage}
                    onChange={(e) =>
                      setCloseForm({ ...closeForm, nextRevisionMileage: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status do veículo após encerrar</Label>
                <Select
                  value={closeForm.vehicleStatus}
                  onValueChange={(value: "disponivel" | "manutencao") =>
                    setCloseForm({ ...closeForm, vehicleStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="manutencao">Em manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações Finais</Label>
                <Textarea
                  placeholder="Informações adicionais sobre a conclusão..."
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {mode === "create" ? (
            <Button onClick={handleCreate}>Iniciar Manutenção</Button>
          ) : (
            <Button onClick={handleClose}>Encerrar Manutenção</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog><MaintenanceConflictDialog reservation={maintenanceConflict} onCancel={() => setMaintenanceConflict(null)} onVisit={(reservation) => { setMaintenanceConflict(null); onOpenChange(false); if (reservation.eventId !== undefined) void navigate({ to: "/calendario", search: { evento: String(reservation.eventId) } }); }} /></>
  );
}

function parseCurrency(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : 0;
}

function CurrencyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
      <span className="mr-1 text-muted-foreground">R$</span>
      <input
        className="min-w-0 flex-1 bg-transparent outline-none"
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(event) => onChange(formatCurrencyValue(event.target.value))}
      />
    </div>
  );
}

function formatCurrencyValue(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
