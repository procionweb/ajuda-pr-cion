import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Truck, Undo2, History, Filter, ShieldCheck } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useVehicles,
  useUsages,
  useReservations,
  getActiveReservationsByVehicle,
  getVehicleById,
  fleetDayKey,
  formatFleetDateTime,
  getUsageDepartureRef,
  getUsageReturnRef,
  getLicensingStatus,
  VEHICLE_STATUS_LABEL,
  USAGE_STATUS_LABEL,
  type UsageStatus,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/fleet-store";
import { fleetActions } from "@/lib/fleet-action-store";
import { VehicleHistoryModal } from "@/components/fleet/VehicleHistoryModal";
import { FleetEntryDialog } from "@/components/fleet/FleetEntryDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/frota/")({
  component: FleetPage,
});

type TabKey = "saidas" | "veiculos" | "em_uso" | "historico";

const TABS: { key: TabKey; label: string; icon: typeof KeyRound }[] = [
  { key: "veiculos", label: "Veículos", icon: Truck },
  { key: "saidas", label: "Saídas", icon: KeyRound },
  { key: "em_uso", label: "Em uso", icon: Undo2 },
  { key: "historico", label: "Histórico", icon: History },
];

function FleetPage() {
  const [tab, setTab] = useState<TabKey>("veiculos");
  const [query, setQuery] = useState("");

  return (
    <AppShell>
      <PageHeader
        title="Frota"
        description="Retiradas, devoluções e histórico dos veículos da equipe."
        breadcrumbs={[{ label: "Frota" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-10 cursor-pointer gap-2 rounded-lg">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            <FleetEntryDialog />
          </div>
        }
      />

      <div className="mb-4 w-full min-w-0 max-w-full border-b border-border">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="-mb-px flex min-w-0 items-center gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex h-11 w-full items-center pb-2 sm:w-64 sm:pb-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar veículo, operador ou cliente..."
              className="h-9 cursor-text text-[13px]"
            />
          </div>
        </div>
      </div>

      <div className="min-w-0 max-w-full">
        {tab === "saidas" && <DeparturesView query={query} />}
        {tab === "veiculos" && <VehiclesView query={query} />}
        {tab === "em_uso" && <InUseView query={query} />}
        {tab === "historico" && <HistoryView query={query} />}
      </div>
    </AppShell>
  );
}

function DeparturesView({ query }: { query: string }) {
  const usages = useUsages();
  const today = fleetDayKey(new Date().toISOString());
  const rows = useMemo(
    () =>
      usages
        .filter((u) => {
          if (u.status === "cancelado") return false;
          const ref = fleetDayKey(getUsageDepartureRef(u));
          if (!ref) return false;
          return ref >= today;
        })
        .filter((u) => matchesQuery(u, query))
        .sort((a, b) =>
          (getUsageDepartureRef(a) ?? "").localeCompare(getUsageDepartureRef(b) ?? ""),
        ),
    [usages, query, today],
  );

  return (
    <Card className="overflow-hidden p-0">
      <TableHeader
        cols={["Saída", "Devolução", "Operador", "Cliente/Destino", "Veículo", "Status", "Ações"]}
        widths={["150px", "150px", "120px", "1fr", "180px", "150px", "200px"]}
      />
      {rows.length === 0 && <EmptyRow label="Nenhuma saída registrada." />}
      {rows.map((u) => {
        const vehicle = getVehicleById(u.vehicleId);
        const departureLabel = formatFleetDateTime(getUsageDepartureRef(u));
        const returnLabel = formatFleetDateTime(getUsageReturnRef(u));
        const pending = u.status === "aguardando_retirada";
        return (
          <div
            key={u.id}
            className="grid items-center gap-3 border-t border-border px-4 py-2.5 text-[13px]"
            style={{ gridTemplateColumns: "150px 150px 120px 1fr 180px 150px 200px" }}
          >
            <span className="tabular-nums text-foreground">
              {departureLabel}
              {pending && (
                <span className="block text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  Prevista
                </span>
              )}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {returnLabel}
              {u.status !== "devolvido" && (
                <span className="block text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  Prevista
                </span>
              )}
            </span>
            <span className="text-foreground">{u.operatorId}</span>
            <span className="min-w-0 truncate text-muted-foreground">{u.destination}</span>
            <span className="text-muted-foreground">
              {vehicle ? `${vehicle.model} · ${vehicle.plate}` : "—"}
            </span>
            <UsageBadge status={u.status} />

            <div className="flex justify-end gap-1.5">
              {u.status === "aguardando_retirada" && (
                <Button
                  size="sm"
                  className="h-8 cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => fleetActions.openPickup(u.id)}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Retirar
                </Button>
              )}
              {u.status === "em_deslocamento" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 cursor-pointer"
                  onClick={() => fleetActions.openReturn(u.id)}
                >
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  Devolver
                </Button>
              )}
              {u.status === "devolvido" && (
                <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400">
                  Devolvido
                </span>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function VehiclesView({ query }: { query: string }) {
  const vehicles = useVehicles();
  useReservations();
  const rows = vehicles.filter((v) =>
    `${v.model} ${v.plate} ${v.category}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="grid w-full min-w-0 max-w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((v) => {
          const reservation = getActiveReservationsByVehicle(v.id)
            .filter((item) => new Date(item.endAt).getTime() >= Date.now())
            .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
          return (
          <Card
            key={v.id}
            className="group relative min-w-0 overflow-hidden p-0 transition hover:border-primary/40 hover:shadow-md"
          >
            <Link
              to="/frota/$vehicleId"
              params={{ vehicleId: v.id }}
              aria-label={`Ver detalhes de ${v.model}`}
              className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="sr-only">Ver detalhes de {v.model}</span>
            </Link>
            <div className="flex h-32 items-center justify-center bg-white">
              <img src={v.imageUrl} alt={v.model} className="h-full w-full object-contain p-2" />
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{v.model}</p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-primary">{v.plate}</p>
                </div>
                <div className="flex items-center gap-1">
                  {reservation ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                      Reservado
                    </Badge>
                  ) : (
                    <VehicleBadge status={v.status} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
                <span>Ano: <span className="text-foreground">{v.yearModel}</span></span>
                <span>KM: <span className="text-foreground">{v.currentMileage.toLocaleString("pt-BR")}</span></span>
                <LicensingSummary vehicle={v} />
              </div>
            </div>
          </Card>
          );
        })}
      </div>
    </>
  );
}

function InUseView({ query }: { query: string }) {
  const usages = useUsages();
  const rows = usages
    .filter((u) => u.status === "em_deslocamento")
    .filter((u) => matchesQuery(u, query));

  return (
    <Card className="overflow-hidden p-0">
      <TableHeader
        cols={["Veículo", "Operador", "Destino", "Saída", "Previsão retorno", "Ações"]}
        widths={["200px", "120px", "1fr", "160px", "160px", "160px"]}
      />
      {rows.length === 0 && <EmptyRow label="Nenhum veículo em uso no momento." />}
      {rows.map((u) => {
        const vehicle = getVehicleById(u.vehicleId);
        return (
          <div
            key={u.id}
            className="grid items-center gap-3 border-t border-border px-4 py-2.5 text-[13px]"
            style={{ gridTemplateColumns: "200px 120px 1fr 160px 160px 160px" }}
          >
            <span className="text-foreground">{vehicle ? `${vehicle.model} · ${vehicle.plate}` : "—"}</span>
            <span className="text-foreground">{u.operatorId}</span>
            <span className="min-w-0 truncate text-muted-foreground">{u.destination}</span>
            <span className="tabular-nums text-muted-foreground">{formatFleetDateTime(getUsageDepartureRef(u))}</span>
            <span className="tabular-nums text-muted-foreground">{formatFleetDateTime(u.expectedReturnAt)}</span>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => fleetActions.openReturn(u.id)}>
                <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Devolver
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function HistoryView({ query }: { query: string }) {
  const usages = useUsages();
  const rows = usages
    .filter((u) => u.status === "devolvido" || u.status === "cancelado")
    .filter((u) => matchesQuery(u, query))
    .sort((a, b) => (b.returnedAt ?? b.updatedAt).localeCompare(a.returnedAt ?? a.updatedAt));

  return (
    <Card className="overflow-hidden p-0">
      <TableHeader
        cols={["Data", "Veículo", "Operador", "Destino", "KM", "Status"]}
        widths={["160px", "180px", "120px", "1fr", "120px", "140px"]}
      />
      {rows.length === 0 && <EmptyRow label="Sem registros no histórico." />}
      {rows.map((u) => {
        const vehicle = getVehicleById(u.vehicleId);
        return (
          <div
            key={u.id}
            className="grid items-center gap-3 border-t border-border px-4 py-2.5 text-[13px]"
            style={{ gridTemplateColumns: "160px 180px 120px 1fr 120px 140px" }}
          >
            <span className="tabular-nums text-muted-foreground">{formatFleetDateTime(u.returnedAt ?? getUsageDepartureRef(u))}</span>
            <span className="text-foreground">{vehicle ? `${vehicle.model} · ${vehicle.plate}` : "—"}</span>
            <span className="text-foreground">{u.operatorId}</span>
            <span className="min-w-0 truncate text-muted-foreground">{u.destination}</span>
            <span className="tabular-nums text-muted-foreground">{u.distanceTraveled ? `${u.distanceTraveled.toLocaleString("pt-BR")} km` : "—"}</span>
            <UsageBadge status={u.status} />
          </div>
        );
      })}
    </Card>
  );
}

function LicensingSummary({ vehicle }: { vehicle: Vehicle }) {
  const licensing = getLicensingStatus(vehicle);
  const color = licensing.status === "overdue" ? "text-red-600" : licensing.status === "due_soon" ? "text-amber-600" : licensing.status === "regular" ? "text-emerald-600" : "text-muted-foreground";
  return (
    <span className={cn("col-span-2 flex items-center gap-1", color)}>
      <ShieldCheck className="h-3.5 w-3.5" />
      Licenciamento: <span>{licensing.label}</span>
    </span>
  );
}

function matchesQuery(u: { destination: string; operatorId: string; client?: string }, q: string) {
  if (!q.trim()) return true;
  const search = q.toLowerCase();
  return u.destination.toLowerCase().includes(search) || u.operatorId.toLowerCase().includes(search) || u.client?.toLowerCase().includes(search);
}

function TableHeader({ cols, widths }: { cols: string[]; widths: string[] }) {
  return (
    <div className="grid gap-3 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: widths.join(" ") }}>
      {cols.map((c) => <div key={c}>{c}</div>)}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function VehicleBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge className={cn("h-5 border-0 text-[10.5px] font-semibold", status === "disponivel" && "bg-emerald-500/10 text-emerald-600", status === "em_uso" && "bg-blue-500/10 text-blue-600", status === "manutencao" && "bg-amber-500/10 text-amber-600")}>
      {VEHICLE_STATUS_LABEL[status]}
    </Badge>
  );
}

function UsageBadge({ status }: { status: UsageStatus }) {
  return (
    <Badge variant="outline" className={cn("h-5 text-[10.5px] font-semibold", status === "aguardando_retirada" && "bg-amber-500/10 text-amber-600", status === "em_deslocamento" && "bg-blue-500/10 text-blue-600", status === "devolvido" && "bg-emerald-500/10 text-emerald-600", status === "cancelado" && "bg-slate-400/10 text-slate-600")}>
      {USAGE_STATUS_LABEL[status]}
    </Badge>
  );
}
