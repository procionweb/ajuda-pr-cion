import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, CalendarDays, Car, Check, Laptop, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SmartTextarea } from "@/components/ui/smart-text";
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
} from "@/components/fleet/VehicleAvailabilitySelect";

import { cn } from "@/lib/utils";
import {
  CollaboratorMultiSelect,
  CollaboratorSelect,
  type CollaboratorGuest,
} from "@/components/portal/CollaboratorPicker";
import { ClientPicker } from "@/components/portal/ClientPicker";
import { getClientById, getGroupMembers, resolveGroupCode, useClients } from "@/lib/clients-store";
import type { ClientRow } from "@/routes/clientes.index";
import {
  PLATFORM_OPTIONS,
  PERSONAL_EVENT_OPTIONS,
  ROOM_OPTIONS,
  TYPE_ICON,
  hasEventStarted,
  type CalendarEvent,
  type EventType,
} from "@/lib/calendar-events";

const preventOutsideClose = (event: Event) => event.preventDefault();
type MeetingTarget = "Empresa" | "Cliente";

export function CreateEventDialog({
  open,
  onOpenChange,
  initialDate,
  existingEvents,
  onCreate,
  lockedClient,
  editingEvent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  existingEvents: CalendarEvent[];
  onCreate: (event: Omit<CalendarEvent, "id">) => void;
  /** Cliente fixo (vindo dos detalhes do cliente), vinculado pelo ID real. */
  lockedClient?: { id: string; label: string };
  /** Quando informado, o diálogo funciona em modo de edição. */
  editingEvent?: CalendarEvent;
}) {
  const { clients } = useClients({ onlyActive: true });
  const [type, setType] = useState<EventType>(editingEvent?.type ?? "Visita presencial");
  const [title, setTitle] = useState(editingEvent?.title ?? "");
  const [description, setDescription] = useState(editingEvent?.description ?? "");
  const [guests, setGuests] = useState<CollaboratorGuest[]>(
    (editingEvent?.guestList as CollaboratorGuest[] | undefined) ?? [],
  );
  const [date, setDate] = useState(editingEvent?.date ?? initialDate);
  const [startTime, setStartTime] = useState(editingEvent?.time ?? "09:00");
  const [endTime, setEndTime] = useState(editingEvent?.end ?? "10:00");
  const [client, setClient] = useState<ClientRow | null>(
    editingEvent?.clientId ? getClientById(editingEvent.clientId) : null,
  );
  const [vehicleId, setVehicleId] = useState(editingEvent?.vehicleId ?? NO_VEHICLE);

  const [responsible, setResponsible] = useState(
    editingEvent?.responsible ?? editingEvent?.operator ?? "",
  );
  const [meetingLink, setMeetingLink] = useState(editingEvent?.meetingLink ?? "");
  const [platform, setPlatform] = useState(editingEvent?.platform ?? PLATFORM_OPTIONS[0]);
  const [room, setRoom] = useState(editingEvent?.room ?? ROOM_OPTIONS[0]);
  const [meetingTarget, setMeetingTarget] = useState<MeetingTarget>("Empresa");
  const [meetingReason, setMeetingReason] = useState(editingEvent?.description ?? "");
  const [guestConflicts, setGuestConflicts] = useState<GuestConflict[]>([]);

  const procionClient = useMemo(
    () =>
      clients.find((candidate) => candidate.cnpj.replace(/\D/g, "") === "06887505000104") ??
      clients.find(
        (candidate) =>
          candidate.acronym.trim().toUpperCase() === "PRC" &&
          [candidate.fantasia, candidate.name, candidate.razaoSocial].some((value) =>
            value.toLocaleUpperCase("pt-BR").includes("PROCION"),
          ),
      ) ??
      null,
    [clients],
  );

  useEffect(() => {
    if (open && !editingEvent) setDate(initialDate);
  }, [open, initialDate, editingEvent]);

  useEffect(() => {
    if (lockedClient || type !== "Reunião na Prócion" || !procionClient) return;
    if (meetingTarget === "Empresa" && client?.id !== procionClient.id) {
      setClient(procionClient);
    }
    if (meetingTarget === "Cliente" && client?.id === procionClient.id) {
      setClient(null);
    }
  }, [client, lockedClient, meetingTarget, procionClient, type]);

  // Resolve o cliente do evento em edição assim que a lista do CRM estiver carregada.
  useEffect(() => {
    if (client || !editingEvent || clients.length === 0) return;
    const eventClientLabel = editingEvent.client?.trim() ?? "";
    const eventAcronym = eventClientLabel.split(/[·\-]/, 1)[0]?.trim();
    const normalizedLabel = eventClientLabel.toLocaleLowerCase("pt-BR");
    const found =
      getClientById(editingEvent.clientId) ??
      getClientById(eventAcronym) ??
      clients.find((candidate) =>
        [candidate.fantasia, candidate.name, candidate.razaoSocial, candidate.acronym]
          .filter(Boolean)
          .some((value) => {
            const normalizedValue = String(value).trim().toLocaleLowerCase("pt-BR");
            return normalizedValue === normalizedLabel || normalizedLabel.includes(normalizedValue);
          }),
      ) ??
      null;
    if (found) setClient(found);
  }, [client, editingEvent, clients]);

  // Empresas do mesmo grupo do cliente selecionado (quando aplicável).
  const groupCompanies = useMemo(() => {
    if (!client) return [] as ClientRow[];
    const code = resolveGroupCode(client, clients);
    if (!code) return [] as ClientRow[];
    return getGroupMembers(code, clients).filter((c) => c.id !== client.id);
  }, [client, clients]);

  const reset = () => {
    setType("Visita presencial");
    setTitle("");
    setDescription("");
    setGuests([]);
    setStartTime("09:00");
    setEndTime("10:00");
    setClient(null);
    setVehicleId(NO_VEHICLE);
    setResponsible("");
    setMeetingLink("");
    setPlatform(PLATFORM_OPTIONS[0]);
    setRoom(ROOM_OPTIONS[0]);
    setMeetingTarget("Empresa");
    setMeetingReason("");
  };

  const dayEvents = useMemo(
    () =>
      existingEvents
        .filter((event) => event.date === date)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [existingEvents, date],
  );

  const dateLabel = date
    ? format(new Date(`${date}T12:00:00`), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "Selecione uma data";

  const submit = (ignoreGuestConflicts = false) => {
    if (!title.trim()) {
      toast.error("Informe o título do agendamento.");
      return;
    }
    if (!date || !startTime || !endTime) {
      toast.error("Preencha data e horários.");
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
    if (!responsible) {
      toast.error("Selecione o responsável pelo agendamento.");
      return;
    }
    if (type === "Visita presencial" && !lockedClient && !client) {
      toast.error("Selecione a empresa da visita presencial.");
      return;
    }
    if (type === "Visita presencial" && vehicleId === NO_VEHICLE) {
      toast.error("Selecione o veículo que será usado na visita.");
      return;
    }
    const isMeeting = type === "Reunião remota" || type === "Reunião na Prócion";
    if (isMeeting && !lockedClient && !client) {
      toast.error("Selecione a empresa da reunião.");
      return;
    }
    if (isMeeting && meetingTarget === "Cliente" && !meetingReason.trim()) {
      toast.error("Informe o motivo da reunião com o cliente.");
      return;
    }
    if (!ignoreGuestConflicts) {
      const conflicts = findGuestConflicts({
        events: existingEvents,
        guests: [
          ...guests,
          ...(responsible ? [{ acronym: responsible, name: responsible }] : []),
        ],
        date,
        startTime,
        endTime,
        ignoreEventId: editingEvent?.id,
      });
      if (conflicts.length) {
        setGuestConflicts(conflicts);
        return;
      }
    }
    onCreate({
      date,
      time: startTime,
      end: endTime,
      type,
      origin: "Administração",
      operator: responsible,
      title: title.trim(),
      client: lockedClient
        ? lockedClient.label
        : (type === "Visita presencial" || isMeeting) && client
          ? client.fantasia || client.name || client.razaoSocial || client.acronym
          : undefined,
      clientId:
        lockedClient?.id ??
        (type === "Visita presencial" || isMeeting
          ? client?.id
          : undefined),
      description:
        isMeeting && meetingTarget === "Cliente"
          ? meetingReason.trim()
          : description.trim() || undefined,
      guests:
        type !== "Pessoal" && guests.length
          ? guests.map((guest) => guest.acronym ?? guest.name)
          : undefined,
      guestList: type !== "Pessoal" && guests.length ? guests : undefined,
      needsDisplacement: type === "Visita presencial" ? vehicleId !== NO_VEHICLE : undefined,
      vehicleId: type === "Visita presencial" && vehicleId !== NO_VEHICLE ? vehicleId : undefined,

      responsible,
      meetingLink: type === "Reunião remota" ? meetingLink.trim() || undefined : undefined,
      platform: type === "Reunião remota" ? platform : undefined,
      room: type === "Reunião na Prócion" ? room : undefined,
    });
    reset();
    onOpenChange(false);
  };

  const typeCards: { value: EventType; icon: typeof Car }[] = [
    { value: "Visita presencial", icon: Car },
    { value: "Reunião remota", icon: Laptop },
    { value: "Reunião na Prócion", icon: Building2 },
    { value: "Pessoal", icon: CalendarDays },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={preventOutsideClose}
        onInteractOutside={preventOutsideClose}
        onEscapeKeyDown={preventOutsideClose}
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        className="flex w-[calc(100vw-2rem)] max-w-[880px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">
          {editingEvent ? "Editar agendamento" : "Novo agendamento"}
        </DialogTitle>
        <DetailModalHeader
          dense
          icon={CalendarDays}
          title={editingEvent ? "Editar agendamento" : "Novo agendamento"}
          protocol={dateLabel}
          onClose={() => onOpenChange(false)}
        />

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-card px-5 py-4 md:px-6">
          <EventDateTimeFields
            date={date}
            onDateChange={setDate}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
          />

          <NewField label="Tipo de agendamento" required>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {typeCards.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setType(opt.value);
                      if (opt.value === "Pessoal" && !PERSONAL_EVENT_OPTIONS.includes(title)) {
                        setTitle(PERSONAL_EVENT_OPTIONS[0]);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] transition",
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-input bg-background text-foreground hover:border-primary/40 hover:bg-accent",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.value}
                  </button>
                );
              })}
            </div>
          </NewField>

          <NewField label="Título" required>
            <Input
              lang="pt-BR"
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Informe o título do agendamento"
              maxLength={140}
            />
          </NewField>

          <NewField label="Descrição">
            <SmartTextarea
              value={description}
              onValueChange={setDescription}
              rows={3}
              maxLength={700}
              placeholder="Descreva o objetivo ou as informações do agendamento"
              className="min-h-[80px] resize-none"
            />
          </NewField>

          {type !== "Pessoal" && (
            <NewField label="Convidados">
              <CollaboratorMultiSelect value={guests} onChange={setGuests} />
            </NewField>
          )}

          {lockedClient && (
            <NewField label="Cliente">
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-[13px] text-foreground">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{lockedClient.label}</span>
              </div>
            </NewField>
          )}

          {type === "Visita presencial" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {!lockedClient && (
                <NewField label="Empresa" required className="sm:col-span-2">
                  <ClientPicker
                    compact
                    label=""
                    value={client}
                    onSelect={setClient}
                    placeholder="Buscar por sigla, razão social, fantasia, CNPJ ou grupo..."
                  />
                  {groupCompanies.length > 0 && (
                    <div className="mt-2 rounded-md border border-border bg-background/40 p-2">
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Empresas do grupo {resolveGroupCode(client, clients)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {groupCompanies.map((company) => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => setClient(company)}
                            className="cursor-pointer rounded-full border border-input bg-background px-2.5 py-1 text-[11.5px] text-foreground transition hover:border-primary/40 hover:bg-accent"
                          >
                            <span className="font-mono text-muted-foreground">
                              {company.acronym}
                            </span>{" "}
                            {company.fantasia || company.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </NewField>
              )}
              <NewField label="Responsável">
                <CollaboratorSelect value={responsible} onChange={setResponsible} />
              </NewField>
              <NewField label="Veículo" className={lockedClient ? undefined : "sm:col-span-2"}>
                <VehicleAvailabilitySelect
                  date={date}
                  startTime={startTime}
                  endTime={endTime}
                  value={vehicleId}
                  onChange={setVehicleId}
                  ignoreEventId={editingEvent?.id}
                />
              </NewField>
            </div>
          )}

          {type === "Reunião remota" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <MeetingTargetFields
                target={meetingTarget}
                onTargetChange={setMeetingTarget}
                client={client}
                onClientChange={setClient}
                lockedClient={lockedClient}
                reason={meetingReason}
                onReasonChange={setMeetingReason}
              />
              <NewField label="Link da reunião" className="sm:col-span-2">
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://"
                  />
                </div>
              </NewField>
              <NewField label="Plataforma">
                <SelectNative value={platform} onChange={setPlatform} options={PLATFORM_OPTIONS} />
              </NewField>
              <NewField label="Responsável">
                <CollaboratorSelect value={responsible} onChange={setResponsible} />
              </NewField>
            </div>
          )}

          {type === "Reunião na Prócion" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <MeetingTargetFields
                target={meetingTarget}
                onTargetChange={setMeetingTarget}
                client={client}
                onClientChange={setClient}
                lockedClient={lockedClient}
                reason={meetingReason}
                onReasonChange={setMeetingReason}
              />
              <NewField label="Sala">
                <SelectNative value={room} onChange={setRoom} options={ROOM_OPTIONS} />
              </NewField>
              <NewField label="Responsável">
                <CollaboratorSelect value={responsible} onChange={setResponsible} />
              </NewField>
            </div>
          )}

          {type === "Pessoal" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <NewField label="Compromisso pessoal" required>
                <SelectNative
                  value={PERSONAL_EVENT_OPTIONS.includes(title) ? title : PERSONAL_EVENT_OPTIONS[0]}
                  onChange={setTitle}
                  options={PERSONAL_EVENT_OPTIONS}
                />
              </NewField>
              <NewField label="Responsável">
                <CollaboratorSelect value={responsible} onChange={setResponsible} />
              </NewField>
            </div>
          )}

          <section className="rounded-lg border border-border bg-background/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                Agendamentos do dia
              </p>
              <Badge variant="secondary" className="text-[11px]">
                {dayEvents.length}
              </Badge>
            </div>
            {dayEvents.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">
                Nenhum agendamento para esta data
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-background/95 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Horário</th>
                      <th className="px-2 py-1.5 font-medium">Tipo</th>
                      <th className="px-2 py-1.5 font-medium">Título</th>
                      <th className="px-2 py-1.5 font-medium">Operador</th>
                      <th className="px-3 py-1.5 font-medium">Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEvents.map((ev) => {
                      const Icon = TYPE_ICON[ev.type];
                      return (
                        <tr key={ev.id} className="border-t border-border/50">
                          <td className="px-3 py-1.5 tabular-nums text-foreground">
                            {ev.time}–{ev.end}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Icon className="h-3.5 w-3.5" />
                              {ev.type}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-foreground">{ev.title}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {ev.operator || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {ev.address || ev.room || ev.client || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-5 py-3 md:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancelar
          </Button>
          <Button
            onClick={() => submit()}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
          >
            <CalendarDays className="mr-1.5 h-4 w-4" />
            Adicionar evento
          </Button>
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

function MeetingTargetFields({
  target,
  onTargetChange,
  client,
  onClientChange,
  lockedClient,
  reason,
  onReasonChange,
}: {
  target: MeetingTarget;
  onTargetChange: (value: MeetingTarget) => void;
  client: ClientRow | null;
  onClientChange: (value: ClientRow | null) => void;
  lockedClient?: { id: string; label: string };
  reason: string;
  onReasonChange: (value: string) => void;
}) {
  return (
    <>
      <NewField label="Empresa ou cliente" required className="sm:col-span-2">
        <Select value={target} onValueChange={(value) => onTargetChange(value as MeetingTarget)}>
          <SelectTrigger className="h-9 cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Empresa">Empresa</SelectItem>
            <SelectItem value="Cliente">Cliente</SelectItem>
          </SelectContent>
        </Select>
      </NewField>
      {!lockedClient && (
        <NewField label="Empresa" required className="sm:col-span-2">
          <ClientPicker
            compact
            label=""
            value={client}
            onSelect={onClientChange}
            placeholder="Buscar empresa por sigla, razão social, fantasia, CNPJ ou grupo..."
          />
        </NewField>
      )}
      {target === "Cliente" && (
        <NewField label="Motivo da reunião" required className="sm:col-span-2">
          <SmartTextarea
            value={reason}
            onValueChange={onReasonChange}
            rows={2}
            maxLength={700}
            placeholder="Informe por que a reunião será realizada"
            className="min-h-[64px] resize-none"
          />
        </NewField>
      )}
    </>
  );
}

function SelectNative({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function NewField({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-[12.5px] font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
