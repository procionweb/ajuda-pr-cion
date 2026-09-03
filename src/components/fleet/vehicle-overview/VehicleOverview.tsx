import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  KeyRound,
  Undo2,
  History,
  Gauge,
  Fuel,
  Calendar,
  ShieldCheck,
  User,
  LayoutDashboard,
  Key,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import {
  type Vehicle,
  useUsages,
  formatFleetDateTime,
  VEHICLE_STATUS_LABEL,
  updateVehicle,
  getActiveReservationsByVehicle,
  useReservations,
  getVehicleFuelState,
} from "@/lib/fleet-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { VehicleHistoryModal } from "../VehicleHistoryModal";
import { fleetActions } from "@/lib/fleet-action-store";
import { FleetEntryDialog } from "@/components/fleet/FleetEntryDialog";
import { VehicleHistoryTimeline } from "../VehicleHistoryTimeline";
import { VehicleLastMonthStats } from "./VehicleLastMonthStats";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VehicleEditorModal } from "../VehicleEditorModal";
import { MaintenanceDialog } from "../MaintenanceDialog";
import { OccurrenceDialog } from "../OccurrenceDialog";
import { useFleetEntries } from "@/lib/fleet-entry-store";

interface VehicleOverviewProps {
  vehicle: Vehicle;
}

export function VehicleOverview({ vehicle }: VehicleOverviewProps) {
  const navigate = useNavigate();
  const usages = useUsages();
  useReservations();
  const [activeTab, setActiveTab] = useState("overview");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isOccurrenceOpen, setIsOccurrenceOpen] = useState(false);
  const fleetEntries = useFleetEntries();
  const [selectedUsage, setSelectedUsage] = useState<any>(null);
  const [isUsageDetailsOpen, setIsUsageDetailsOpen] = useState(false);

  const vehicleUsages = useMemo(() => {
    return usages
      .filter((u) => u.vehicleId === vehicle.id)
      .sort((a, b) => (b.returnedAt ?? b.updatedAt).localeCompare(a.returnedAt ?? a.updatedAt));
  }, [usages, vehicle.id]);

  const lastUsage = vehicleUsages.find((u) => u.status === "devolvido");
  const occurrences = fleetEntries.filter(
    (entry) => entry.vehicleId === vehicle.id && entry.type === "ocorrencia",
  );
  const activeReservation = getActiveReservationsByVehicle(vehicle.id).some(
    (item) => new Date(item.endAt).getTime() >= Date.now(),
  );
  const fuelState = getVehicleFuelState(vehicle);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Resumo Principal Superior */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: "/frota" })}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  {vehicle.model.split(" / ")[0]}
                </h1>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {vehicle.yearModel.split(" / ")[0] || "2024"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Visão geral do veículo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "h-7 px-3 text-[11px] font-semibold uppercase tracking-wider",
                activeReservation
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : vehicle.status === "disponivel"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : vehicle.status === "manutencao"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
              )}
            >
              {activeReservation ? "Reservado" : VEHICLE_STATUS_LABEL[vehicle.status]}
            </Badge>
          </div>
        </div>

        <Card className="grid grid-cols-2 gap-y-4 gap-x-6 p-4 md:grid-cols-7 bg-muted/20 border-border/50">
          <HeaderStat icon={Calendar} label="Modelo" value={vehicle.model.split(" / ")[0]} />
          <HeaderStat icon={Key} label="Placa" value={vehicle.plate} />
          <HeaderStat icon={ShieldCheck} label="Renavam" value={vehicle.renavam || "—"} />
          <HeaderStat
            icon={Gauge}
            label="KM Atual"
            value={`${vehicle.currentMileage.toLocaleString("pt-BR")} km`}
          />
          <HeaderStat
            icon={Fuel}
            label="Combustível"
            value={`${fuelState.label} · ${fuelState.liters.toFixed(1)} L`}
          />
          <HeaderStat
            icon={LayoutDashboard}
            label="Status"
            value={activeReservation ? "Reservado" : VEHICLE_STATUS_LABEL[vehicle.status]}
          />
          <HeaderStat icon={User} label="Último condutor" value={lastUsage?.operatorId || "—"} />
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <FleetEntryDialog defaultVehicleId={vehicle.id} triggerLabel="Adicionar lançamento" />
        {vehicle.status === "manutencao" && (
          <ActionButton
            icon={Wrench}
            label="Encerrar manutenção"
            onClick={() => setIsMaintenanceOpen(true)}
          />
        )}
        {vehicle.status === "em_uso" && (
          <ActionButton
            icon={Undo2}
            label="Registrar devolução"
            onClick={() => {
              const current = vehicleUsages.find((u) => u.status === "em_deslocamento");
              if (current) fleetActions.openReturn(current.id);
            }}
          />
        )}
        <ActionButton
          icon={History}
          label="Histórico"
          onClick={() => setIsHistoryModalOpen(true)}
        />
        <ActionButton
          icon={Settings}
          label="Editar veículo"
          onClick={() => setIsEditorOpen(true)}
        />
      </div>

      <VehicleEditorModal vehicle={vehicle} open={isEditorOpen} onOpenChange={setIsEditorOpen} />
      <MaintenanceDialog
        vehicle={vehicle}
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
      />
      <OccurrenceDialog
        vehicleId={vehicle.id}
        open={isOccurrenceOpen}
        onOpenChange={setIsOccurrenceOpen}
      />

      {/* Main Content Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <VehicleHistoryTimeline vehicleId={vehicle.id} />
            <VehicleLastMonthStats
              vehicleId={vehicle.id}
              usages={vehicleUsages}
              onUsageClick={(usage) => {
                setSelectedUsage(usage);
                setIsUsageDetailsOpen(true);
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="occurrences" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-primary">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-base font-bold">Ocorrências</h3>
              </div>
              <Button className="gap-2" onClick={() => setIsOccurrenceOpen(true)}>
                <AlertTriangle className="h-4 w-4" /> Nova ocorrência
              </Button>
            </div>
            {occurrences.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-muted-foreground">
                <AlertTriangle className="mb-2 h-8 w-8 opacity-20" />
                <p className="text-sm">Nenhuma ocorrência registrada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {occurrences.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.title}</span>
                        <Badge
                          variant={
                            entry.occurrenceSeverity === "alta" ? "destructive" : "secondary"
                          }
                        >
                          {entry.occurrenceSeverity === "alta"
                            ? "Alta"
                            : entry.occurrenceSeverity === "media"
                              ? "Média"
                              : "Baixa"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[entry.driver, entry.location, entry.occurrenceReference]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {formatFleetDateTime(entry.occurredAt)}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <VehicleHistoryModal
        vehicle={vehicle}
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />

      {/* Modal Detalhes Utilização */}
      <Dialog open={isUsageDetailsOpen} onOpenChange={setIsUsageDetailsOpen}>
        <DialogContent className="max-w-2xl [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer">
          {selectedUsage && (
            <>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <KeyRound className="h-5 w-5 text-primary" />
                Detalhes da Utilização
              </DialogTitle>
              <div className="grid grid-cols-2 gap-6 py-4">
                <DetailItem label="Operador" value={selectedUsage.operatorId} />
                <DetailItem label="Status" value={selectedUsage.status} />
                <DetailItem label="Destino" value={selectedUsage.destination} fullWidth />
                <DetailItem
                  label="Saída Real"
                  value={formatFleetDateTime(
                    selectedUsage.departureAt || selectedUsage.scheduledStartAt,
                  )}
                />
                <DetailItem
                  label="Retorno Real"
                  value={
                    selectedUsage.returnedAt ? formatFleetDateTime(selectedUsage.returnedAt) : "—"
                  }
                />
                <DetailItem
                  label="KM Saída"
                  value={
                    selectedUsage.departureMileage
                      ? `${selectedUsage.departureMileage.toLocaleString("pt-BR")} km`
                      : "—"
                  }
                />
                <DetailItem
                  label="KM Retorno"
                  value={
                    selectedUsage.returnMileage
                      ? `${selectedUsage.returnMileage.toLocaleString("pt-BR")} km`
                      : "—"
                  }
                />
                <DetailItem
                  label="Combustível Saída"
                  value={selectedUsage.fuelAtDeparture || "—"}
                />
                <DetailItem label="Combustível Retorno" value={selectedUsage.fuelAtReturn || "—"} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: any;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="text-[10px] font-normal uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-sm font-normal truncate">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-9 gap-2 text-[12px] font-semibold border-border/60 hover:border-primary hover:bg-primary/5 transition-all"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

function DetailItem({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", fullWidth && "col-span-2")}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
