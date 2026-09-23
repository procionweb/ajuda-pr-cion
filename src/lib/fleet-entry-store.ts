import { useSyncExternalStore } from "react";
import { loadFleetState, saveFleetState } from "@/lib/fleet-persistence";

export type FleetEntryType =
  | "abastecimento"
  | "despesa"
  | "servico"
  | "percurso"
  | "leitura"
  | "checklist"
  | "lembrete"
  | "ocorrencia";

export type FleetOccurrenceKind = "colisao" | "multa" | "avaria" | "pane" | "outro";
export type FleetOccurrenceSeverity = "baixa" | "media" | "alta";

export type FleetEntry = {
  id: string;
  type: FleetEntryType;
  vehicleId: string;
  occurredAt: string;
  mileage?: number;
  title: string;
  notes?: string;
  amount?: number;
  liters?: number;
  fuelType?: string;
  fuelLevel?: string;
  unitPrice?: number;
  fullTank?: boolean;
  previousRefuelingMissing?: boolean;
  fuelStation?: string;
  driver?: string;
  motive?: string;
  paymentMethod?: string;
  location?: string;
  attachmentName?: string;
  origin?: string;
  destination?: string;
  distance?: number;
  endedAt?: string;
  endingMileage?: number;
  routeKind?: "viagem" | "frete";
  ratePerKm?: number;
  readingType?: string;
  readingValue?: string;
  checklistItems?: string[];
  reminderAt?: string;
  reminderKind?: "despesa" | "servico";
  createdAt: string;
  maintenanceId?: string;
  occurrenceKind?: FleetOccurrenceKind;
  occurrenceSeverity?: FleetOccurrenceSeverity;
  occurrenceReference?: string;
};

const STORAGE_KEY = "procion.fleet-entries.v1";
let entries: FleetEntry[] = [];
let hydrated = false;
let remoteLoadStarted = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  window.localStorage.removeItem(STORAGE_KEY);
  if (remoteLoadStarted) return;
  remoteLoadStarted = true;
  void loadFleetState<FleetEntry[]>("fleet_entries").then((saved) => {
    const remote = Array.isArray(saved) ? saved.filter((entry) => entry?.type !== "receita") : [];
    const merged = new Map(remote.map((entry) => [entry.id, entry]));
    entries.forEach((entry) => merged.set(entry.id, entry));
    entries = [...merged.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    listeners.forEach((listener) => listener());
  });
}

function persist() {
  void saveFleetState("fleet_entries", entries);
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  hydrate();
  return entries;
}

export function useFleetEntries() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function createFleetEntry(input: Omit<FleetEntry, "id" | "createdAt">) {
  const entry: FleetEntry = {
    ...input,
    id: `fleet-entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  entries = [entry, ...entries];
  persist();
  listeners.forEach((listener) => listener());
  return entry;
}

export function updateFleetEntryByMaintenance(
  maintenanceId: string,
  changes: Partial<Omit<FleetEntry, "id" | "createdAt" | "maintenanceId">>,
) {
  hydrate();
  let updated = false;
  entries = entries.map((entry) => {
    if (entry.maintenanceId !== maintenanceId) return entry;
    updated = true;
    return { ...entry, ...changes };
  });
  if (!updated) return false;
  persist();
  listeners.forEach((listener) => listener());
  return true;
}
