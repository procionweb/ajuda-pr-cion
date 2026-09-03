import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  Filter as FilterIcon,
  Fuel,
  Gauge,
  MapPin,
  Receipt,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useUsages,
  USAGE_STATUS_LABEL,
  formatFleetDateTime,
  type UsageStatus,
  type Vehicle,
  type VehicleUsage,
  type VehicleMaintenance,
} from "@/lib/fleet-store";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Store } from "lucide-react";
import { type FleetEntry, useFleetEntries } from "@/lib/fleet-entry-store";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportFleetHistoryCsv, exportFleetHistoryPdf, exportFleetHistoryXlsx, type FleetHistoryExportRow } from "@/lib/fleet-history-export";
import procionLogoWhiteUrl from "@/assets/procion-logo-white.png";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function formatDate(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}
function formatTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}
function formatKm(v?: number) {
  return v !== undefined ? `${v.toLocaleString("pt-BR")} km` : "—";
}
function diffHours(a?: string, b?: string) {
  if (!a || !b) return 0;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / 36e5);
}

const safeText = (value: unknown) => (typeof value === "string" ? value : String(value ?? ""));
function fmtDuration(h: number) {
  if (h <= 0) return "0h";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h ${mm}min` : `${hh}h`;
}

function usageBadgeClass(status: UsageStatus) {
  return cn(
    "inline-flex h-[22px] w-fit items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[11px] font-normal leading-none",
    status === "em_deslocamento" &&
      "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    status === "aguardando_retirada" &&
      "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    status === "devolvido" &&
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    status === "cancelado" &&
      "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300",
  );
}

// ---------------------------------------------------------------------------
// Modal principal
// ---------------------------------------------------------------------------
export function VehicleHistoryModal({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const allUsages = useUsages();
  const allEntries = useFleetEntries();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("lancamentos");

  // Filtros
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [operator, setOperator] = useState("");
  const [statusFilter, setStatusFilter] = useState<UsageStatus | "all">("all");
  const [destination, setDestination] = useState("");

  const vehicleUsages = useMemo(() => {
    if (!vehicle) return [];
    return allUsages
      .filter((u) => u.vehicleId === vehicle.id)
      .sort((a, b) =>
        safeText(b.departureAt ?? b.scheduledStartAt ?? b.returnedAt).localeCompare(
          safeText(a.departureAt ?? a.scheduledStartAt ?? a.returnedAt),
        ),
      );
  }, [allUsages, vehicle]);

  const filtered = useMemo(() => {
    return vehicleUsages.filter((u) => {
      const ref = safeText(u.departureAt ?? u.scheduledStartAt ?? u.returnedAt).slice(0, 10);
      if (!ref) return false;
      if (dateFrom && ref < dateFrom) return false;
      if (dateTo && ref > dateTo) return false;
      if (
        operator.trim() &&
        !safeText(u.operatorId).toLowerCase().includes(operator.trim().toLowerCase())
      )
        return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (destination.trim()) {
        const hay = `${safeText(u.destination)} ${safeText(u.client)}`.toLowerCase();
        if (!hay.includes(destination.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [vehicleUsages, dateFrom, dateTo, operator, statusFilter, destination]);

  const stats = useMemo(() => computeStats(vehicleUsages), [vehicleUsages]);
  const vehicleEntries = useMemo(() => {
    if (!vehicle) return [];
    return allEntries
      .filter((entry) => entry.vehicleId === vehicle.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [allEntries, vehicle]);
  const historyRows = useMemo(
    () => buildHistoryRows(filtered, vehicleEntries, vehicle?.maintenanceRecords ?? []),
    [filtered, vehicleEntries, vehicle?.maintenanceRecords],
  );
  const exportRows = useMemo(() => historyRows.filter((row) => {
    if (activeTab === "utilizacao") return row.category === "Utilização";
    if (activeTab === "manutencao") return row.category === "Manutenção";
    return row.category !== "Utilização" && row.category !== "Manutenção";
  }), [activeTab, historyRows]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setOperator("");
    setStatusFilter("all");
    setDestination("");
  };

  const selected = selectedId ? (vehicleUsages.find((u) => u.id === selectedId) ?? null) : null;

  const handleOpenChange = (v: boolean) => {
    if (!v) setSelectedId(null);
    onOpenChange(v);
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 sm:w-[calc(100vw-2rem)] md:w-[960px] lg:w-[1040px] [&>button]:hidden [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer">
        <DialogTitle className="sr-only">
          Histórico do veículo {vehicle.model} {vehicle.plate}
        </DialogTitle>

        <DetailModalHeader
          icon={Truck}
          title="Histórico do veículo"
          protocol={vehicle.plate}
          onClose={() => handleOpenChange(false)}
          chips={
            <div className="flex items-center gap-2">
              <VehicleStatusChip status={vehicle.status} />
              {vehicle.maintenanceRecords?.some((m) => m.status === "em_andamento") && (
                <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <Wrench className="mr-1 h-3 w-3" />
                  Manutenção em andamento
                </Badge>
              )}
            </div>
          }
          meta={
            <>
              <span className="truncate text-foreground">{vehicle.model}</span>
              <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                <span className="font-medium text-foreground">
                  {formatKm(vehicle.currentMileage)}
                </span>
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1">
                <Truck className="h-3 w-3" />
                <span className="font-medium text-foreground">{vehicle.category}</span>
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Próxima revisão{" "}
                <span className="font-medium text-foreground">{vehicle.nextRevisionDate}</span>
              </span>
            </>
          }
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {selected ? (
            <DetailView usage={selected} vehicle={vehicle} onBack={() => setSelectedId(null)} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-6">
                <TabsList className="h-10 w-auto">
                  <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
                  <TabsTrigger value="utilizacao">Utilização</TabsTrigger>
                  <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent
                value="utilizacao"
                className="min-h-0 flex-1 flex-col overflow-hidden m-0 data-[state=active]:flex"
              >
                <ListView
                  stats={stats}
                  usages={filtered}
                  totalCount={vehicleUsages.length}
                  onOpen={(id) => setSelectedId(id)}
                  filters={{
                    dateFrom,
                    dateTo,
                    operator,
                    statusFilter,
                    destination,
                    setDateFrom,
                    setDateTo,
                    setOperator,
                    setStatusFilter,
                    setDestination,
                    clearFilters,
                  }}
                />
              </TabsContent>
              <TabsContent value="lancamentos" className="min-h-0 flex-1 overflow-y-auto m-0 p-6">
                <FleetEntriesList entries={vehicleEntries} />
              </TabsContent>
              <TabsContent value="manutencao" className="min-h-0 flex-1 overflow-y-auto m-0 p-6">
                <MaintenanceListView maintenanceRecords={vehicle.maintenanceRecords ?? []} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Rodapé */}
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 md:px-6">
          <div className="text-[11.5px] text-muted-foreground">
            {vehicleUsages.length} utilização(ões) registrada(s)
          </div>
          <div className="flex items-center gap-2">
            {!selected && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="h-9 cursor-pointer gap-2"><Download className="h-4 w-4" />Exportar histórico</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={() => exportFleetHistoryCsv(vehicle, exportRows)}>Baixar CSV</DropdownMenuItem><DropdownMenuItem onClick={() => exportFleetHistoryXlsx(vehicle, exportRows)}>Baixar XLSX</DropdownMenuItem><DropdownMenuItem onClick={() => void exportFleetHistoryPdf(vehicle, exportRows, procionLogoWhiteUrl)}>Baixar PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
            <Button
              variant="outline"
              className="h-9 cursor-pointer"
              onClick={() => handleOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function FleetEntriesList({ entries }: { entries: FleetEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <Receipt className="mb-2 h-8 w-8 opacity-20" />
        <p className="text-sm">Nenhum lançamento registrado para este veículo.</p>
      </div>
    );
  }

  const labels = {
    abastecimento: "Abastecimento",
    despesa: "Despesa",
    servico: "Serviço",
    percurso: "Percurso",
    leitura: "Leitura",
    checklist: "Checklist",
    lembrete: "Lembrete",
  } as const;

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{entry.title}</span>
                <Badge variant="secondary" className="h-5 text-[10px] uppercase">
                  {labels[entry.type]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFleetDateTime(entry.occurredAt)}
                {entry.mileage !== undefined
                  ? ` · ${entry.mileage.toLocaleString("pt-BR")} km`
                  : ""}
              </p>
              {entry.notes && (
                <p className="whitespace-pre-line text-xs text-muted-foreground">{entry.notes}</p>
              )}
            </div>
            {entry.amount !== undefined && (
              <span className="shrink-0 text-sm font-medium">
                {entry.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista + resumo + filtros
// ---------------------------------------------------------------------------
type Filters = {
  dateFrom: string;
  dateTo: string;
  operator: string;
  statusFilter: UsageStatus | "all";
  destination: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setOperator: (v: string) => void;
  setStatusFilter: (v: UsageStatus | "all") => void;
  setDestination: (v: string) => void;
  clearFilters: () => void;
};

function ListView({
  stats,
  usages,
  totalCount,
  onOpen,
  filters,
}: {
  stats: ReturnType<typeof computeStats>;
  usages: VehicleUsage[];
  totalCount: number;
  onOpen: (id: string) => void;
  filters: Filters;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6">
      {/* Resumo */}
      <section>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Resumo de utilização
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total de saídas" value={String(stats.totalTrips)} />
          <StatCard label="KM percorridos" value={formatKm(stats.totalKm)} />
          <StatCard label="Tempo em uso" value={stats.totalTime} />
          <StatCard label="Top operador" value={stats.topOperator} />
          <StatCard label="Última utilização" value={stats.lastUse} />
          <StatCard label="Média por saída" value={formatKm(stats.avgKm)} />
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-lg border border-border bg-muted/25 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <FilterIcon className="h-3.5 w-3.5" />
          Filtros
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <LabeledField label="Período inicial">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => filters.setDateFrom(e.target.value)}
              className="h-9 cursor-text text-[12.5px]"
            />
          </LabeledField>
          <LabeledField label="Período final">
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => filters.setDateTo(e.target.value)}
              className="h-9 cursor-text text-[12.5px]"
            />
          </LabeledField>
          <LabeledField label="Operador">
            <Input
              value={filters.operator}
              onChange={(e) => filters.setOperator(e.target.value)}
              placeholder="PRC..."
              className="h-9 cursor-text text-[12.5px]"
            />
          </LabeledField>
          <LabeledField label="Status">
            <select
              value={filters.statusFilter}
              onChange={(e) => filters.setStatusFilter(e.target.value as UsageStatus | "all")}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-[12.5px]"
            >
              <option value="all">Todos</option>
              {(Object.keys(USAGE_STATUS_LABEL) as UsageStatus[]).map((s) => (
                <option key={s} value={s}>
                  {USAGE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Cliente/Destino">
            <Input
              value={filters.destination}
              onChange={(e) => filters.setDestination(e.target.value)}
              placeholder="Buscar..."
              className="h-9 cursor-text text-[12.5px]"
            />
          </LabeledField>
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            className="h-8 cursor-pointer text-[12px]"
            onClick={filters.clearFilters}
          >
            Limpar filtros
          </Button>
        </div>
      </section>

      {/* Tabela */}
      <section className="min-h-0 rounded-lg border border-border">
        {totalCount === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma utilização registrada para este veículo
          </p>
        ) : usages.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado com os filtros atuais
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[980px] text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Data</Th>
                  <Th>Saída</Th>
                  <Th>Devolução</Th>
                  <Th>Operador</Th>
                  <Th>Destino</Th>
                  <Th className="text-right">KM inicial</Th>
                  <Th className="text-right">KM final</Th>
                  <Th className="text-right">Percorrido</Th>
                  <Th>Comb. saída</Th>
                  <Th>Comb. devol.</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ação</Th>
                </tr>
              </thead>
              <tbody>
                {usages.map((u) => {
                  const inProgress = u.status === "em_deslocamento";
                  return (
                    <tr key={u.id} className="border-t border-border transition hover:bg-accent/40">
                      <Td className="tabular-nums">
                        {formatDate(u.departureAt ?? u.scheduledStartAt ?? u.returnedAt)}
                      </Td>
                      <Td className="tabular-nums">
                        {formatTime(u.departureAt ?? u.scheduledStartAt)}
                      </Td>
                      <Td className="tabular-nums">
                        {inProgress ? (
                          <span className="text-amber-600 dark:text-amber-300">Em andamento</span>
                        ) : (
                          formatTime(u.returnedAt ?? u.expectedReturnAt)
                        )}
                      </Td>
                      <Td>{u.operatorId}</Td>
                      <Td className="max-w-[240px] truncate text-muted-foreground">
                        {u.destination}
                      </Td>
                      <Td className="text-right tabular-nums">{formatKm(u.departureMileage)}</Td>
                      <Td className="text-right tabular-nums">
                        {inProgress ? "—" : formatKm(u.returnMileage)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {computeDistance(u) !== undefined ? formatKm(computeDistance(u)) : "—"}
                      </Td>
                      <Td className="text-muted-foreground">{u.fuelAtDeparture ?? "—"}</Td>
                      <Td className="text-muted-foreground">
                        {inProgress ? "—" : (u.fuelAtReturn ?? "—")}
                      </Td>
                      <Td>
                        <span className={usageBadgeClass(u.status)}>
                          {USAGE_STATUS_LABEL[u.status]}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          className="h-7 cursor-pointer px-2 text-[12px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(u.id);
                          }}
                        >
                          Ver detalhes
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-3 py-2 text-left font-medium", className)}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap px-3 py-2 align-middle", className)}>{children}</td>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[13.5px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function VehicleStatusChip({ status }: { status: Vehicle["status"] }) {
  const map: Record<Vehicle["status"], { label: string; cls: string }> = {
    disponivel: {
      label: "Disponível",
      cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    },
    em_uso: {
      label: "Em uso",
      cls: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    },
    manutencao: {
      label: "Manutenção",
      cls: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    },
  };
  const { label, cls } = map[status] ?? {
    label: "Não informado",
    cls: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge
      className={cn(
        "inline-flex h-[22px] w-fit items-center border px-2 text-[11px] font-normal leading-none",
        cls,
      )}
    >
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Detalhes da utilização
// ---------------------------------------------------------------------------
function DetailView({
  usage,
  vehicle,
  onBack,
}: {
  usage: VehicleUsage;
  vehicle: Vehicle;
  onBack: () => void;
}) {
  const distance = computeDistance(usage);
  const inProgress = usage.status === "em_deslocamento";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 md:px-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="h-8 cursor-pointer gap-1.5 px-2 text-[12.5px]"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao histórico
        </Button>
        <span className={usageBadgeClass(usage.status)}>{USAGE_STATUS_LABEL[usage.status]}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailBlock title="Veículo">
          <Row icon={Truck} label="Veículo" value={`${vehicle.model} · ${vehicle.plate}`} />
          <Row icon={UserRound} label="Operador" value={usage.operatorId} />
          <Row
            icon={CalendarClock}
            label="Agendamento"
            value={usage.appointmentId ? String(usage.appointmentId) : "—"}
          />
        </DetailBlock>

        <DetailBlock title="Cliente e destino">
          <Row icon={UserRound} label="Cliente" value={usage.client ?? "—"} />
          <Row icon={MapPin} label="Endereço" value={usage.destination} />
        </DetailBlock>

        <DetailBlock title="Saída">
          <Row
            icon={CalendarClock}
            label={usage.departureAt ? "Data/hora" : "Data/hora prevista"}
            value={formatDateTime(usage.departureAt ?? usage.scheduledStartAt)}
          />
          <Row icon={Gauge} label="KM inicial" value={formatKm(usage.departureMileage)} />
          <Row icon={Fuel} label="Combustível" value={usage.fuelAtDeparture ?? "—"} />
        </DetailBlock>

        <DetailBlock title="Devolução">
          <Row
            icon={CalendarClock}
            label={usage.returnedAt ? "Data/hora" : "Data/hora prevista"}
            value={
              inProgress && !usage.expectedReturnAt
                ? "Em andamento"
                : formatDateTime(usage.returnedAt ?? usage.expectedReturnAt)
            }
          />
          <Row
            icon={Gauge}
            label="KM final"
            value={inProgress ? "—" : formatKm(usage.returnMileage)}
          />
          <Row
            icon={Fuel}
            label="Combustível"
            value={inProgress ? "—" : (usage.fuelAtReturn ?? "—")}
          />
          <Row
            icon={Gauge}
            label="Total percorrido"
            value={distance !== undefined ? formatKm(distance) : "—"}
          />
        </DetailBlock>
      </div>
    </div>
  );
}

function DetailBlock({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", full && "md:col-span-2")}>
      <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-[12.5px]">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground">{value}</span>
      </div>
    </div>
  );
}

function PhotoGallery({ photos }: { photos?: string[] }) {
  if (!photos || photos.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">Nenhuma foto anexada.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((p, i) => (
        <div
          key={i}
          className="aspect-video overflow-hidden rounded-md border border-border bg-muted"
        >
          <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estatísticas + exportação
// ---------------------------------------------------------------------------
function computeDistance(u: VehicleUsage) {
  if (u.distanceTraveled !== undefined) return u.distanceTraveled;
  if (u.departureMileage !== undefined && u.returnMileage !== undefined) {
    return Math.max(0, u.returnMileage - u.departureMileage);
  }
  return undefined;
}

function computeStats(usages: VehicleUsage[]) {
  if (usages.length === 0) {
    return {
      totalTrips: 0,
      totalKm: 0,
      totalTime: "0h",
      topOperator: "—",
      lastUse: "—",
      avgKm: 0,
    };
  }
  const totalKm = usages.reduce((s, u) => s + (computeDistance(u) ?? 0), 0);
  const totalHours = usages.reduce((s, u) => s + diffHours(u.departureAt, u.returnedAt), 0);
  const opCount: Record<string, number> = {};
  usages.forEach((u) => {
    const operator = safeText(u.operatorId) || "Não informado";
    opCount[operator] = (opCount[operator] ?? 0) + 1;
  });
  const topOperator = Object.entries(opCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const withDistance = usages.filter((u) => computeDistance(u) !== undefined);
  const avgKm = withDistance.length ? Math.round(totalKm / withDistance.length) : 0;
  const lastRef = usages
    .map((u) => safeText(u.returnedAt ?? u.departureAt ?? u.scheduledStartAt))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return {
    totalTrips: usages.length,
    totalKm,
    totalTime: fmtDuration(totalHours),
    topOperator,
    lastUse: lastRef ? formatDate(lastRef) : "—",
    avgKm,
  };
}

function buildHistoryRows(usages: VehicleUsage[], entries: FleetEntry[], maintenance: VehicleMaintenance[]): FleetHistoryExportRow[] {
  const entryLabels: Record<string, string> = { abastecimento: "Abastecimento", despesa: "Despesa", servico: "Serviço", percurso: "Percurso", leitura: "Leitura", checklist: "Checklist", lembrete: "Lembrete", ocorrencia: "Ocorrência" };
  const rows: FleetHistoryExportRow[] = [
    ...entries.map((entry) => ({ date: formatDateTime(entry.occurredAt), category: entryLabels[entry.type] || entry.type, title: entry.title, operator: entry.driver || "", mileage: entry.mileage !== undefined ? formatKm(entry.mileage) : "", amount: entry.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "", details: entry.notes || entry.destination || entry.location || "" })),
    ...usages.map((usage) => ({ date: formatDateTime(usage.departureAt ?? usage.scheduledStartAt ?? usage.returnedAt), category: "Utilização", title: usage.client || usage.destination || "Utilização do veículo", operator: usage.operatorId, mileage: computeDistance(usage) !== undefined ? formatKm(computeDistance(usage)) : "", amount: "", details: `${usage.destination} | ${USAGE_STATUS_LABEL[usage.status]}` })),
    ...maintenance.map((item) => ({ date: formatDateTime(item.entryDate), category: "Manutenção", title: item.reason, operator: "", mileage: formatKm(item.entryMileage), amount: item.cost?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "", details: [item.workshop, item.servicesPerformed, item.partsReplaced, item.notes].filter(Boolean).join(" | ") })),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function MaintenanceListView({ maintenanceRecords }: { maintenanceRecords: VehicleMaintenance[] }) {
  if (maintenanceRecords.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <Wrench className="mb-2 h-8 w-8 opacity-20" />
        <p className="text-sm">Nenhuma manutenção registrada para este veículo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {maintenanceRecords.map((m) => {
        const inProgress = m.status === "em_andamento";
        return (
          <Card
            key={m.id}
            className={cn(
              "overflow-hidden border-l-4",
              inProgress ? "border-l-amber-500 bg-amber-500/5" : "border-l-emerald-500",
            )}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.reason}</span>
                    <Badge
                      variant={inProgress ? "outline" : "secondary"}
                      className={cn(
                        "h-5 text-[10px] uppercase",
                        inProgress
                          ? "border-amber-500 text-amber-600"
                          : "bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {inProgress ? "Em andamento" : "Concluída"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Store className="h-3 w-3" />
                    {m.workshop}
                  </p>
                </div>
                {m.cost !== undefined && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {m.cost.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">Custo Total</p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase text-muted-foreground">Entrada</p>
                  <p className="text-[12px] font-medium">{formatFleetDateTime(m.entryDate)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.entryMileage.toLocaleString("pt-BR")} km
                  </p>
                </div>
                {m.exitDate && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Conclusão</p>
                    <p className="text-[12px] font-medium">{formatFleetDateTime(m.exitDate)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.exitMileage?.toLocaleString("pt-BR")} km
                    </p>
                  </div>
                )}
                {m.duration && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Duração</p>
                    <p className="text-[12px] font-medium">{m.duration}</p>
                  </div>
                )}
                {m.servicesPerformed && (
                  <div className="col-span-2 space-y-0.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Serviços / Peças</p>
                    <p className="text-[12px] line-clamp-2">{m.servicesPerformed}</p>
                    {m.partsReplaced && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                        {m.partsReplaced}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {m.notes && (
                <div className="mt-3 rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
                  <strong>Obs:</strong> {m.notes}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
