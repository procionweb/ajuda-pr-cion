import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fuel, Plus, Receipt, Save, Upload, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFleetEntry, type FleetEntryType } from "@/lib/fleet-entry-store";
import { addVehicleMaintenance, getMaintenanceReservationConflict, useVehicles, type VehicleReservation, type VehicleStatus } from "@/lib/fleet-store";
import { useOperatorAcronyms } from "@/lib/collaborators-store";
import { MaintenanceConflictDialog } from "@/components/fleet/MaintenanceConflictDialog";

const TYPES = [
  ["abastecimento", "Abastecimento", Fuel],
  ["despesa", "Despesa", Receipt],
  ["servico", "Serviço", Wrench],
] as const;

type Draft = {
  vehicleId: string;
  occurredAt: string;
  endedAt: string;
  mileage: string;
  endingMileage: string;
  title: string;
  notes: string;
  amount: string;
  liters: string;
  unitPrice: string;
  fuelType: string;
  fuelStation: string;
  driver: string;
  motive: string;
  paymentMethod: string;
  location: string;
  origin: string;
  destination: string;
  distance: string;
  routeKind: "viagem" | "frete";
  ratePerKm: string;
  readingType: string;
  readingValue: string;
  checklistItems: string;
  reminderAt: string;
  reminderKind: "despesa" | "servico";
  attachmentName: string;
  vehicleStatus: "" | Extract<VehicleStatus, "manutencao" | "disponivel">;
};

function localNow(offsetHours = 0) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function emptyDraft(vehicleId = ""): Draft {
  return {
    vehicleId,
    occurredAt: localNow(),
    endedAt: localNow(1),
    mileage: "",
    endingMileage: "",
    title: "",
    notes: "",
    amount: "",
    liters: "",
    unitPrice: "",
    fuelType: "Gasolina aditivada",
    fuelStation: "",
    driver: "",
    motive: "",
    paymentMethod: "",
    location: "",
    origin: "",
    destination: "",
    distance: "",
    routeKind: "viagem",
    ratePerKm: "",
    readingType: "Quilometragem",
    readingValue: "",
    checklistItems: "",
    reminderAt: "",
    reminderKind: "despesa",
    attachmentName: "",
    vehicleStatus: "",
  };
}

export function FleetEntryDialog({
  defaultVehicleId,
  triggerLabel = "Adicionar",
}: {
  defaultVehicleId?: string;
  triggerLabel?: string;
}) {
  const vehicles = useVehicles();
  const navigate = useNavigate();
  const operatorAcronyms = useOperatorAcronyms();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FleetEntryType | null>(null);
  const [draft, setDraft] = useState(() => emptyDraft(defaultVehicleId));
  const [maintenanceConflict, setMaintenanceConflict] = useState<VehicleReservation | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const selectedLabel = TYPES.find(([value]) => value === type)?.[1];
  const close = () => {
    setOpen(false);
    setType(null);
    setDraft(emptyDraft(defaultVehicleId));
  };

  const save = () => {
    if (!type || !draft.vehicleId || !draft.occurredAt)
      return toast.error("Preencha veículo e data do lançamento.");
    if (!draft.driver.trim()) return toast.error("Selecione o operador responsável pelo lançamento.");
    if ((type === "abastecimento" || type === "despesa") && !draft.paymentMethod) {
      return toast.error("Selecione a forma de pagamento.");
    }
    const title = draft.title.trim() || selectedLabel || "Lançamento";
    if (type === "servico") {
      if (!draft.title.trim() || !draft.location.trim()) {
        return toast.error("Preencha o motivo da manutenção e a oficina.");
      }
      const conflict = getMaintenanceReservationConflict(draft.vehicleId, draft.occurredAt);
      if (conflict) {
        setMaintenanceConflict(conflict);
        return;
      }
      const maintenance = addVehicleMaintenance(draft.vehicleId, {
        entryDate: draft.occurredAt,
        entryMileage: numberValue(draft.mileage) ?? 0,
        reason: draft.title.trim(),
        workshop: draft.location.trim(),
        notes:
          [draft.driver ? `Responsável: ${draft.driver}` : "", draft.notes.trim()]
            .filter(Boolean)
            .join("\n") || undefined,
      });
      createFleetEntry({
        type: "servico",
        vehicleId: draft.vehicleId,
        occurredAt: draft.occurredAt,
        mileage: numberValue(draft.mileage),
        title,
        driver: draft.driver.trim() || undefined,
        location: draft.location.trim(),
        notes: draft.notes.trim() || undefined,
        maintenanceId: maintenance.id,
      });
      toast.success(
        maintenance.status === "agendado"
          ? "Manutenção agendada. O veículo ficará em manutenção na data informada."
          : "Manutenção iniciada. O veículo foi colocado em manutenção.",
      );
      close();
      return;
    }
    createFleetEntry({
      type,
      vehicleId: draft.vehicleId,
      occurredAt: draft.occurredAt,
      title,
      mileage: numberValue(draft.mileage),
      notes: draft.notes.trim() || undefined,
      amount: moneyValue(draft.amount),
      liters: numberValue(draft.liters),
      unitPrice: moneyValue(draft.unitPrice),
      fuelType: type === "abastecimento" ? draft.fuelType : undefined,
      fuelStation: type === "abastecimento" ? draft.fuelStation.trim() || undefined : undefined,
      driver: draft.driver.trim() || undefined,
      motive: draft.motive.trim() || undefined,
      paymentMethod: draft.paymentMethod || undefined,
      location: draft.location.trim() || undefined,
      attachmentName: draft.attachmentName || undefined,
      origin: type === "percurso" ? draft.origin.trim() || undefined : undefined,
      destination: type === "percurso" ? draft.destination.trim() || undefined : undefined,
      distance: type === "percurso" ? numberValue(draft.distance) : undefined,
      endedAt: type === "percurso" ? draft.endedAt : undefined,
      endingMileage: type === "percurso" ? numberValue(draft.endingMileage) : undefined,
      routeKind: type === "percurso" ? draft.routeKind : undefined,
      ratePerKm: type === "percurso" ? moneyValue(draft.ratePerKm) : undefined,
      readingType: type === "leitura" ? draft.readingType : undefined,
      readingValue: type === "leitura" ? draft.readingValue.trim() || undefined : undefined,
      checklistItems:
        type === "checklist"
          ? draft.checklistItems
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      reminderAt: type === "lembrete" ? draft.reminderAt || undefined : undefined,
      reminderKind: type === "lembrete" ? draft.reminderKind : undefined,
    });
    toast.success(`${selectedLabel} registrado com sucesso.`);
    close();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="h-10 gap-2">
        <Plus className="h-4 w-4" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col overflow-hidden p-0 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>
              {type ? `Adicionar ${selectedLabel?.toLowerCase()}` : "Adicionar lançamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 [scrollbar-color:hsl(var(--muted-foreground)/.35)_transparent] [scrollbar-width:thin]">
            {!type ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {TYPES.map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border bg-card p-3 text-sm font-medium transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                <CommonFields
                  draft={draft}
                  set={set}
                  vehicles={vehicles}
                  type={type}
                  lockVehicle={Boolean(defaultVehicleId)}
                />
                {type === "abastecimento" && (
                  <FuelFields draft={draft} set={set} operators={operatorAcronyms} />
                )}
                {type === "despesa" && (
                  <ExpenseFields draft={draft} set={set} operators={operatorAcronyms} />
                )}
                {type === "servico" && (
                  <ServiceFields draft={draft} set={set} operators={operatorAcronyms} />
                )}
                {type === "percurso" && <RouteFields draft={draft} set={set} />}
                {type === "leitura" && <ReadingFields draft={draft} set={set} />}
                {type === "checklist" && (
                  <Field label="Itens do checklist (um por linha)">
                    <Textarea
                      rows={6}
                      value={draft.checklistItems}
                      onChange={(e) => set("checklistItems", e.target.value)}
                      placeholder={"Óleo\nFreios\nLuzes\nPneus\nDocumentos"}
                    />
                  </Field>
                )}
                {type === "lembrete" && <ReminderFields draft={draft} set={set} />}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Anexo (opcional)">
                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{draft.attachmentName || "Anexar arquivo"}</span>
                      <input
                        className="sr-only"
                        type="file"
                        onChange={(e) => set("attachmentName", e.target.files?.[0]?.name || "")}
                      />
                    </label>
                  </Field>
                  <Field label="Observação">
                    <Textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t px-6 py-2">
            {type && (
              <Button variant="ghost" onClick={() => setType(null)}>
                Voltar
              </Button>
            )}
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            {type && (
              <Button onClick={save} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <MaintenanceConflictDialog reservation={maintenanceConflict} onCancel={() => setMaintenanceConflict(null)} onVisit={(reservation) => { setMaintenanceConflict(null); close(); if (reservation.eventId !== undefined) void navigate({ to: "/calendario", search: { evento: String(reservation.eventId) } }); }} />
    </>
  );
}

type Setter = <K extends keyof Draft>(key: K, value: Draft[K]) => void;
type VehicleOption = { id: string; model: string; plate: string };

function CommonFields({
  draft,
  set,
  vehicles,
  type,
  lockVehicle,
}: {
  draft: Draft;
  set: Setter;
  vehicles: VehicleOption[];
  type: FleetEntryType;
  lockVehicle: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!lockVehicle && (
        <Field label="Veículo">
          <select
            value={draft.vehicleId}
            onChange={(e) => set("vehicleId", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.model} · {v.plate}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={type === "percurso" ? "Data e hora inicial" : "Data e hora"}>
        <Input
          type="datetime-local"
          value={draft.occurredAt}
          onChange={(e) => set("occurredAt", e.target.value)}
        />
      </Field>
      <Field label={type === "percurso" ? "Odômetro inicial (km)" : "Odômetro (km)"}>
        <Input
          inputMode="numeric"
          value={draft.mileage}
          onChange={(e) => set("mileage", e.target.value.replace(/\D/g, ""))}
        />
      </Field>
    </div>
  );
}

function computeLiters(amount: string, unitPrice: string) {
  const total = moneyValue(amount);
  const price = moneyValue(unitPrice);
  if (total === undefined || price === undefined || !(total > 0) || !(price > 0)) return "";
  const liters = total / price;
  if (!Number.isFinite(liters)) return "";
  return liters.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function FuelFields({ draft, set, operators }: { draft: Draft; set: Setter; operators: string[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Combustível">
          <select
            className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
            value={draft.fuelType}
            onChange={(e) => set("fuelType", e.target.value)}
          >
            <option>Gasolina aditivada</option>
            <option>Gasolina comum</option>
            <option>Etanol</option>
            <option>Diesel</option>
            <option>GNV</option>
          </select>
        </Field>
        <Field label="Preço por litro (R$)">
          <CurrencyInput
            value={draft.unitPrice}
            onChange={(value) => {
              set("unitPrice", value);
              set("liters", computeLiters(draft.amount, value));
            }}
          />
        </Field>
        <Field label="Valor total (R$)">
          <CurrencyInput
            value={draft.amount}
            onChange={(value) => {
              set("amount", value);
              set("liters", computeLiters(value, draft.unitPrice));
            }}
          />
        </Field>
        <Field label="Litros">
          <Input
            inputMode="decimal"
            value={draft.liters}
            onChange={(e) => set("liters", e.target.value)}
          />
        </Field>
        <Field label="Posto de combustível">
          <Input value={draft.fuelStation} onChange={(e) => set("fuelStation", e.target.value)} />
        </Field>
        <DriverSelect
          value={draft.driver}
          onChange={(value) => set("driver", value)}
          operators={operators}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Motivo (opcional)">
          <Input value={draft.motive} onChange={(e) => set("motive", e.target.value)} />
        </Field>
        <Payment draft={draft} set={set} />
      </div>
    </>
  );
}

function ExpenseFields({
  draft,
  set,
  operators,
}: {
  draft: Draft;
  set: Setter;
  operators: string[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Tipo de despesa">
        <Input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex.: estacionamento"
        />
      </Field>
      <Field label="Valor (R$)">
        <CurrencyInput value={draft.amount} onChange={(value) => set("amount", value)} />
      </Field>
      <Field label="Local (opcional)">
        <Input value={draft.location} onChange={(e) => set("location", e.target.value)} />
      </Field>
      <DriverSelect
        value={draft.driver}
        onChange={(value) => set("driver", value)}
        operators={operators}
      />
      <Field label="Motivo (opcional)">
        <Input value={draft.motive} onChange={(e) => set("motive", e.target.value)} />
      </Field>
      <Payment draft={draft} set={set} />
    </div>
  );
}
function ServiceFields({
  draft,
  set,
  operators,
}: {
  draft: Draft;
  set: Setter;
  operators: string[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Motivo da manutenção">
          <Input
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: barulho na roda esquerda"
          />
        </Field>
        <Field label="Local / oficina">
          <Input value={draft.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <DriverSelect
          value={draft.driver}
          onChange={(value) => set("driver", value)}
          operators={operators}
        />
    </div>
  );
}
function RouteFields({ draft, set }: { draft: Draft; set: Setter }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Origem">
          <Input value={draft.origin} onChange={(e) => set("origin", e.target.value)} />
        </Field>
        <Field label="Destino">
          <Input value={draft.destination} onChange={(e) => set("destination", e.target.value)} />
        </Field>
        <Field label="Data e hora final">
          <Input
            type="datetime-local"
            value={draft.endedAt}
            onChange={(e) => set("endedAt", e.target.value)}
          />
        </Field>
        <Field label="Odômetro final">
          <Input
            value={draft.endingMileage}
            onChange={(e) => set("endingMileage", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Modalidade">
          <select
            className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
            value={draft.routeKind}
            onChange={(e) => set("routeKind", e.target.value as Draft["routeKind"])}
          >
            <option value="viagem">Viagem</option>
            <option value="frete">Frete</option>
          </select>
        </Field>
        <Field label="Distância (km)">
          <Input value={draft.distance} onChange={(e) => set("distance", e.target.value)} />
        </Field>
        <Field label="Valor por km (R$)">
          <CurrencyInput value={draft.ratePerKm} onChange={(value) => set("ratePerKm", value)} />
        </Field>
        <Field label="Motorista">
          <Input value={draft.driver} onChange={(e) => set("driver", e.target.value)} />
        </Field>
      </div>
      <Field label="Motivo (opcional)">
        <Input value={draft.motive} onChange={(e) => set("motive", e.target.value)} />
      </Field>
    </>
  );
}
function ReadingFields({ draft, set }: { draft: Draft; set: Setter }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Tipo de leitura">
        <Input value={draft.readingType} onChange={(e) => set("readingType", e.target.value)} />
      </Field>
      <Field label="Valor">
        <Input value={draft.readingValue} onChange={(e) => set("readingValue", e.target.value)} />
      </Field>
      <Field label="Motorista">
        <Input value={draft.driver} onChange={(e) => set("driver", e.target.value)} />
      </Field>
    </div>
  );
}
function ReminderFields({ draft, set }: { draft: Draft; set: Setter }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Categoria">
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={draft.reminderKind}
          onChange={(e) => set("reminderKind", e.target.value as Draft["reminderKind"])}
        >
          <option value="despesa">Despesa</option>
          <option value="servico">Serviço</option>
        </select>
      </Field>
      <Field label={draft.reminderKind === "despesa" ? "Tipo de despesa" : "Tipo de serviço"}>
        <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Lembrar em">
        <Input
          type="datetime-local"
          value={draft.reminderAt}
          onChange={(e) => set("reminderAt", e.target.value)}
        />
      </Field>
    </div>
  );
}
function Payment({ draft, set }: { draft: Draft; set: Setter }) {
  return (
    <Field label="Forma de pagamento *">
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={draft.paymentMethod}
        onChange={(e) => set("paymentMethod", e.target.value)}
      >
        <option value="">Selecione</option>
        <option>Dinheiro</option>
        <option>Cartão de crédito</option>
        <option>Cartão de débito</option>
        <option>Pix</option>
        <option>Boleto</option>
      </select>
    </Field>
  );
}
function CurrencyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      inputMode="decimal"
      placeholder="0,00"
      value={value}
      onChange={(event) => onChange(formatCurrencyInput(event.target.value))}
    />
  );
}
function DriverSelect({
  value,
  onChange,
  operators,
}: {
  value: string;
  onChange: (value: string) => void;
  operators: string[];
}) {
  return (
    <Field label="Operador *">
      <select
        className="h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione um PRC</option>
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {operator}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}
function moneyValue(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}
function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
