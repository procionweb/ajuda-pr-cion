import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Users } from "lucide-react";
import { toast } from "sonner";
import {
  CollaboratorMultiSelect,
  CollaboratorSelect,
  type CollaboratorGuest,
} from "@/components/portal/CollaboratorPicker";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { EventDateTimeFields } from "@/components/calendar/EventDateTimeFields";
import {
  findGuestConflicts,
  GuestConflictDialog,
  type GuestConflict,
} from "@/components/calendar/GuestConflictDialog";
import {
  NO_VEHICLE,
  VehicleAvailabilitySelect,
  useVehicleAvailability,
  isUnavailable,
} from "@/components/fleet/VehicleAvailabilitySelect";

import { ticketsStore } from "@/lib/tickets-store";
import type { SupportTicket } from "@/lib/support-tickets-data";
import { modulesMap, moduleOptions, splitModule } from "@/lib/modules-map";
import { addLocalEvent, useLocalEvents } from "@/lib/local-events-store";
import { hasEventStarted, type EventType } from "@/lib/calendar-events";
import { listCrmCalendarEvents } from "@/lib/calendar-api";
import { createReservation } from "@/lib/fleet-store";
import { CorrectionHint } from "@/components/ui/smart-text";
import { useSpellCorrection } from "@/lib/spellcheck";

const EVENT_TYPES = ["Visita", "Reunião remota", "Reunião PRC"];
const preventOutsideClose = (event: Event) => event.preventDefault();

export function ScheduleEventModal({
  open,
  onOpenChange,
  ticket,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  ticket: SupportTicket;
}) {
  const defaults = useMemo(() => splitModule(ticket.module), [ticket.module]);
  const [type, setType] = useState(EVENT_TYPES[1]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [responsible, setResponsible] = useState(ticket.owner || "");
  const [guests, setGuests] = useState<CollaboratorGuest[]>([]);
  const [vehicleId, setVehicleId] = useState(NO_VEHICLE);
  const [module, setModule] = useState(defaults.module);
  const [submodule, setSubmodule] = useState(defaults.submodule);
  const [description, setDescription] = useState("");
  const descriptionCorrection = useSpellCorrection({
    value: description,
    onChange: setDescription,
  });
  const [reminder, setReminder] = useState(true);
  const [guestConflicts, setGuestConflicts] = useState<GuestConflict[]>([]);
  const localCalendarEvents = useLocalEvents();
  const [crmCalendarEvents, setCrmCalendarEvents] = useState<Awaited<
    ReturnType<typeof listCrmCalendarEvents>
  >>([]);
  const calendarEvents = useMemo(() => {
    const merged = new Map<string, (typeof localCalendarEvents)[number]>();
    crmCalendarEvents.forEach((event) => merged.set(String(event.id), event));
    localCalendarEvents.forEach((event) => merged.set(String(event.id), event));
    return [...merged.values()];
  }, [crmCalendarEvents, localCalendarEvents]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void listCrmCalendarEvents()
      .then((events) => {
        if (active) setCrmCalendarEvents(events);
      })
      .catch(() => {
        if (active) setCrmCalendarEvents([]);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const availableSubs = modulesMap[module] ?? [];
  const {
    vehicles,
    availability: vehicleAvailability,
    windowStart,
    windowEnd,
  } = useVehicleAvailability(date, startTime, endTime);

  const changeModule = (value: string) => {
    setModule(value);
    const subs = modulesMap[value] ?? [];
    if (!subs.includes(submodule)) setSubmodule(subs[0] ?? "");
  };

  const reset = () => {
    setType(EVENT_TYPES[1]);
    setDate("");
    setStartTime("");
    setEndTime("");
    setResponsible(ticket.owner || "");
    setGuests([]);
    setVehicleId(NO_VEHICLE);
    setModule(defaults.module);
    setSubmodule(defaults.submodule);
    setDescription("");
    setReminder(true);
  };

  const submit = (ignoreGuestConflicts = false) => {
    if (ticket.status === "Finalizado") {
      toast.error("Chamado finalizado não pode receber novos agendamentos.");
      return;
    }
    if (!date || !startTime || !endTime || !responsible || !module || !submodule) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    if (hasEventStarted({ date, time: startTime })) {
      toast.error("Esse horário já passou. Escolha um horário futuro.");
      return;
    }
    if (endTime <= startTime) {
      toast.error("O horário final deve ser posterior ao inicial.");
      return;
    }
    if (!ignoreGuestConflicts) {
      const conflicts = findGuestConflicts({
        events: calendarEvents,
        guests: [
          ...guests,
          ...(responsible ? [{ acronym: responsible, name: responsible }] : []),
        ],
        date,
        startTime,
        endTime,
      });
      if (conflicts.length) {
        setGuestConflicts(conflicts);
        return;
      }
    }

    let vehicleLabel: string | undefined;
    let reservationId: string | undefined;
    const eventId = crypto.randomUUID();

    if (vehicleId !== NO_VEHICLE) {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) {
        toast.error("Veículo não encontrado.");
        return;
      }
      if (!windowStart || !windowEnd) {
        toast.error("Informe data e horários para reservar veículo.");
        return;
      }
      const info = vehicleAvailability.get(vehicleId);
      if (isUnavailable(info)) {
        toast.error("Veículo indisponível para reserva.");
        return;
      }
      const created = createReservation({
        vehicleId: vehicle.id,
        operatorId: responsible,
        startAt: windowStart,
        endAt: windowEnd,
        eventId,
        ticketId: ticket.id,
        customerId: ticket.clientCode,
        destination: `${ticket.clientCode || "—"} · ${ticket.clientName || "Cliente não vinculado"}`,
      });
      if ("error" in created) {
        toast.error("Conflito de agenda para o veículo escolhido.", {
          description: `Já existe pré-reserva de ${new Date(created.conflict.startAt).toLocaleString("pt-BR")} até ${new Date(created.conflict.endAt).toLocaleString("pt-BR")}.`,
        });
        return;
      }
      reservationId = created.id;
      vehicleLabel = `${vehicle.model} · ${vehicle.plate}`;
    }

    ticketsStore.scheduleEvent(ticket.id, {
      type,
      date,
      startTime,
      endTime,
      responsible,
      guests: guests.length ? guests.map((g) => g.acronym ?? g.name).join(", ") : undefined,
      vehicle: vehicleLabel,
      module,
      submodule,
      description: description.trim() || undefined,
      reminder,
    });

    const calendarType: EventType =
      type === "Visita"
        ? "Visita presencial"
        : type === "Reunião PRC"
          ? "Reunião na Prócion"
          : "Reunião remota";
    const clientLabel = [ticket.clientCode, ticket.clientName].filter(Boolean).join(" · ");

    addLocalEvent({
      id: eventId,
      date,
      time: startTime,
      end: endTime,
      type: calendarType,
      origin: "Suporte",
      operator: responsible,
      responsible,
      title: `${ticket.protocol} - ${ticket.subject}`,
      ticketId: ticket.id,
      protocol: ticket.protocol,
      client: clientLabel || undefined,
      description: description.trim() || undefined,
      guests: guests.map((guest) => guest.acronym ?? guest.name),
      guestList: guests.length ? guests : undefined,
      needsDisplacement: calendarType === "Visita presencial",
      vehicleId: vehicleId !== NO_VEHICLE ? vehicleId : undefined,
    });

    toast.success("Evento agendado", {
      description: `${date} · ${startTime} às ${endTime}${reservationId ? " · veículo pré-agendado" : ""}`,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={preventOutsideClose}
        onInteractOutside={preventOutsideClose}
        onEscapeKeyDown={preventOutsideClose}
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        className="flex w-[calc(100vw-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Agendar evento {ticket.protocol}</DialogTitle>
        <DetailModalHeader
          icon={CalendarClock}
          title={ticket.clientName || "Cliente não vinculado"}
          protocol={ticket.protocol}
          onClose={() => onOpenChange(false)}
          meta={
            <span className="inline-flex items-center gap-1">
              <span className="truncate text-foreground">Agendar evento</span>
              <span className="text-border">·</span>
              <span className="text-primary">{ticket.clientCode || "—"}</span>
            </span>
          }
        />
        <div className="flex-1 space-y-2.5 overflow-y-auto bg-card px-5 py-3 md:px-6">
          <EventDateTimeFields
            className="gap-2.5"
            date={date}
            onDateChange={setDate}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Tipo do evento" required>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Selecione o tipo do evento" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsável" required>
              <CollaboratorSelect value={responsible} onChange={setResponsible} />
            </Field>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Módulo" required>
              <Select value={module} onValueChange={changeModule}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Selecione o módulo" />
                </SelectTrigger>
                <SelectContent>
                  {moduleOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Submódulo" required>
              <Select
                value={submodule}
                onValueChange={setSubmodule}
                disabled={availableSubs.length === 0}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Selecione o submódulo" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubs.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className={type === "Visita" ? "grid gap-2.5 sm:grid-cols-2" : "grid gap-2.5"}>
            <Field label="Convidados">
              <CollaboratorMultiSelect value={guests} onChange={setGuests} />
            </Field>
            {type === "Visita" && (
              <Field label="Veículo">
                <VehicleAvailabilitySelect
                  date={date}
                  startTime={startTime}
                  endTime={endTime}
                  value={vehicleId}
                  onChange={setVehicleId}
                />
              </Field>
            )}
          </div>
          <Field label="Observações">
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                descriptionCorrection.notifyTyping(e);
              }}
              onBlur={() => descriptionCorrection.runNow()}
              rows={2}
              maxLength={700}
              placeholder="Objetivo, orientações e informações para o atendimento..."
              className="min-h-[64px] w-full resize-none rounded-md border border-input bg-background p-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
            <CorrectionHint
              correcting={descriptionCorrection.correcting}
              corrected={descriptionCorrection.corrected}
              onUndo={descriptionCorrection.undo}
            />
          </Field>
        </div>
        <DialogFooter className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-5 py-2.5 sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-muted-foreground">
            <Checkbox
              checked={reminder}
              onCheckedChange={(value) => setReminder(value === true)}
              className="h-4 w-4 cursor-pointer"
            />
            Gerar lembrete
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button onClick={submit} className="cursor-pointer">
              <CalendarClock className="mr-1.5 h-4 w-4" />
              Agendar evento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <GuestConflictDialog
        conflicts={guestConflicts}
        onCancel={() => setGuestConflicts([])}
        onContinue={() => {
          setGuestConflicts([]);
          submit(true);
        }}
      />
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[12.5px] font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
