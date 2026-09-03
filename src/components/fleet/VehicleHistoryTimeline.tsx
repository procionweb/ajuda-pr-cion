import { useMemo, useState } from "react";
import { 
  Fuel, 
  Receipt, 
  Wrench, 
  MapPinned, 
  Gauge, 
  ClipboardCheck, 
  Bell,
  Download,
  Calendar,
  UserRound
} from "lucide-react";
import { type FleetEntry, type FleetEntryType, useFleetEntries } from "@/lib/fleet-entry-store";
import { useVehicles } from "@/lib/fleet-store";
import { exportFleetHistoryXlsx, type FleetHistoryExportRow } from "@/lib/fleet-history-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  abastecimento: { icon: Fuel, color: "text-orange-500", border: "border-orange-500", label: "Abastecimento" },
  despesa: { icon: Receipt, color: "text-red-500", border: "border-red-500", label: "Despesa" },
  servico: { icon: Wrench, color: "text-orange-500", border: "border-orange-500", label: "Serviço" },
  percurso: { icon: MapPinned, color: "text-indigo-500", border: "border-indigo-500", label: "Percurso" },
  leitura: { icon: Gauge, color: "text-slate-500", border: "border-slate-500", label: "Leitura" },
  checklist: { icon: ClipboardCheck, color: "text-purple-500", border: "border-purple-500", label: "Checklist" },
  lembrete: { icon: Bell, color: "text-amber-500", border: "border-amber-500", label: "Lembrete" },
  ocorrencia: { icon: Receipt, color: "text-red-500", border: "border-red-500", label: "Ocorrência" },
};

export function VehicleHistoryTimeline({ vehicleId }: { vehicleId: string }) {
  const allEntries = useFleetEntries();
  const vehicle = useVehicles().find((item) => item.id === vehicleId);
  const [entryType, setEntryType] = useState<FleetEntryType | "all">("all");
  const [month, setMonth] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const vehicleEntries = useMemo(() => {
    return allEntries
      .filter(e => e.vehicleId === vehicleId)
      .filter((e) => entryType === "all" || e.type === entryType)
      .filter((e) => month === "all" || e.occurredAt.slice(0, 7) === month)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [allEntries, entryType, month, vehicleId]);

  const months = useMemo(() => [...new Set(allEntries.filter((e) => e.vehicleId === vehicleId).map((e) => e.occurredAt.slice(0, 7)))].sort().reverse(), [allEntries, vehicleId]);

  const visibleEntries = showAll ? vehicleEntries : vehicleEntries.slice(0, 3);

  const groups = useMemo(() => {
    const map: Record<string, FleetEntry[]> = {};
    visibleEntries.forEach(entry => {
      const date = new Date(entry.occurredAt);
      const month = date.toLocaleString('pt-BR', { month: 'long' });
      const year = date.getFullYear();
      const key = `${month} de ${year}`;
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    });
    return Object.entries(map);
  }, [visibleEntries]);

  const exportData = () => {
    if (!vehicle) return;
    const rows: FleetHistoryExportRow[] = vehicleEntries.map((entry) => ({
      date: new Date(entry.occurredAt).toLocaleString("pt-BR"), category: TYPE_CONFIG[entry.type].label,
      title: entry.title, operator: entry.driver || "", mileage: entry.mileage?.toLocaleString("pt-BR") || "",
      amount: entry.amount?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "",
      details: entry.notes || entry.destination || entry.location || "",
    }));
    exportFleetHistoryXlsx(vehicle, rows);
  };

  return (
    <Card className="flex flex-col border-border/50 bg-card p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-bold">Histórico</h3>
        <Download 
          className="h-5 w-5 text-primary cursor-pointer hover:opacity-70" 
          onClick={exportData}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select value={entryType} onChange={(event) => setEntryType(event.target.value as FleetEntryType | "all")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">Todos os lançamentos</option>
          {(Object.keys(TYPE_CONFIG) as FleetEntryType[]).map((type) => <option key={type} value={type}>{TYPE_CONFIG[type].label}</option>)}
        </select>
        <select value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">Todos os meses</option>
          {months.map((value) => <option key={value} value={value}>{new Date(`${value}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</option>)}
        </select>
      </div>

      <div className="relative flex-1 space-y-5 before:absolute before:inset-0 before:ml-[1.15rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-border/60">
        {groups.map(([key, entries]) => (
          <div key={key} className="relative">
            <div className="mb-4 ml-10 flex items-center gap-4">
              <h4 className="text-sm font-semibold text-muted-foreground/60">{key}</h4>
            </div>

            <div className="space-y-6">
              {entries.map((entry) => {
                const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.despesa;
                const Icon = config.icon;
                const date = new Date(entry.occurredAt);
                
                return (
                  <div key={entry.id} className="relative pl-12">
                    {/* Linha e Círculo da Timeline */}
                    <div className={cn(
                      "absolute left-1 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border-[3px] bg-background shadow-sm",
                      config.border
                    )}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    
                    <div className="flex flex-col gap-2.5 border-b border-border/40 pb-4 last:border-0">
                      <h5 className="text-base font-semibold">{entry.title}</h5>
                      
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <Icon className="h-3.5 w-3.5" />
                          {entry.fuelType || entry.type} {entry.liters ? `(${entry.liters.toLocaleString('pt-BR')} L)` : ''}
                        </div>

                        {entry.mileage && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <Gauge className="h-3.5 w-3.5" />
                            {entry.mileage.toLocaleString('pt-BR')} km
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <UserRound className="h-3.5 w-3.5" />
                          {entry.driver || "PRC não informado"}
                        </div>
                      </div>

                      {entry.amount !== undefined && (
                        <p className="text-sm font-bold text-foreground/80">
                          R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {vehicleEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">Nenhum registro encontrado.</p>
          </div>
        )}
      </div>

      {vehicleEntries.length > 3 && (
        <Button variant="ghost" className="mt-5 w-full cursor-pointer text-primary" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Mostrar menos" : "Ver tudo"}
        </Button>
      )}
    </Card>
  );
}
