import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Minus,
  ArrowUp,
  KeyRound,
  Link2,
  MapPin,
  Pencil,
  Ticket,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { cn } from "@/lib/utils";
import { erpVersions, formatVersionDate } from "@/lib/erp-versions";
import {
  EVENT_TONE_LABEL,
  EVENT_TONE_STYLES,
  TYPE_ICON,
  getEventTone,
  hasEventStarted,
  type CalendarEvent,
} from "@/lib/calendar-events";
import { formatFleetDateTime, getVehicleById, useUsages, useReservations } from "@/lib/fleet-store";
import { useTickets } from "@/lib/tickets-store";

const preventOutsideClose = (event: Event) => event.preventDefault();

function protocolFromTitle(title: string): string | undefined {
  const match = title.match(/(PRC-\d+)/i);
  return match ? match[1].toUpperCase() : undefined;
}

/** Remove marcação HTML herdada do CRM mantendo quebras de linha. */
function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function EventDetailsModal({
  event,
  open,
  onOpenChange,
  onEdit,
  onCancelEvent,
  onSaveReport,
  canEdit = false,
  canCancel = false,
  onPickupVehicle,
  initialAction = "details",
  onViewTicket,
  hideFooterActions = false,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
  onCancelEvent?: (event: CalendarEvent) => void;
  onSaveReport?: (event: CalendarEvent, completed: boolean) => void;
  canEdit?: boolean;
  canCancel?: boolean;
  /** Disponível apenas quando existe veículo reservado e a retirada é possível. */
  onPickupVehicle?: (event: CalendarEvent) => void;
  initialAction?: "details" | "cancel" | "report";
  onViewTicket?: (ticketId: string) => void;
  hideFooterActions?: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [report, setReport] = useState({
    permission: "Clientes" as "Público" | "Clientes" | "Empresa",
    priority: "Baixa" as "Baixa" | "Média" | "Alta",
    option: "",
    version: "",
    startedAt: "",
    endedAt: "",
    contact: "",
    notes: "",
    completed: false,
  });
  const navigate = useNavigate();
  const tickets = useTickets();
  const usages = useUsages();
  const reservations = useReservations();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [open, event?.id]);

  useEffect(() => {
    if (!event) return;
    setCancelReason(event.cancellationReason ?? "");
    setReport({
      permission: event.report?.permission ?? "Clientes",
      priority: event.report?.priority ?? "Baixa",
      option: event.report?.option ?? "",
      version: event.report?.version ?? "",
      startedAt: event.report?.startedAt ?? event.time,
      endedAt: event.report?.endedAt ?? event.end,
      contact: event.report?.contact ?? "",
      notes: event.report?.notes ?? "",
      completed: event.report?.completed ?? false,
    });
    setCancelOpen(initialAction === "cancel");
    setReportOpen(initialAction === "report");
  }, [event, initialAction]);

  const protocol = event ? (event.protocol ?? protocolFromTitle(event.title)) : undefined;
  const ticket = useMemo(() => {
    if (!event) return null;
    if (event.ticketId) return tickets.find((t) => t.id === event.ticketId) ?? null;
    if (protocol) return tickets.find((t) => t.protocol === protocol) ?? null;
    return null;
  }, [event, protocol, tickets]);

  const usage = event
    ? usages.find((u) => String(u.appointmentId) === String(event.id) && u.status !== "cancelado")
    : undefined;
  const reservation = event
    ? reservations.find((r) => String(r.eventId) === String(event.id) && r.status !== "cancelada")
    : undefined;

  if (!event) return null;

  const tone = getEventTone(event);
  const eventHasStarted = hasEventStarted(event, now);
  const toneStyle = EVENT_TONE_STYLES[tone];
  const Icon = TYPE_ICON[event.type];

  const vehicle = getVehicleById(usage?.vehicleId ?? reservation?.vehicleId ?? event.vehicleId);
  const departureRef = usage?.departureAt ?? usage?.scheduledStartAt ?? reservation?.startAt;
  const returnRef = usage?.returnedAt ?? usage?.expectedReturnAt ?? reservation?.endAt;
  const guestLabels =
    event.guestList?.map((guest) =>
      guest.acronym ? `${guest.acronym} · ${guest.name}` : guest.name,
    ) ??
    event.guests ??
    [];

  const canPickup =
    Boolean(vehicle) &&
    Boolean(onPickupVehicle) &&
    (!usage || usage.status === "aguardando_retirada") &&
    tone !== "cancelled";

  const submitReport = (completed: boolean) => {
    onSaveReport?.(
      {
        ...event,
        status: completed || report.completed ? "Concluído" : event.status,
        report: {
          ...report,
          completed: completed || report.completed,
          completedAt: new Date().toISOString(),
        },
      },
      completed,
    );
    setReportOpen(false);
  };

  return (
    <>
      <Dialog open={open && !cancelOpen && !reportOpen} onOpenChange={onOpenChange}>
        <DialogContent
          onPointerDownOutside={preventOutsideClose}
          onInteractOutside={preventOutsideClose}
          style={{ maxHeight: "calc(100vh - 3rem)" }}
          className="flex w-[calc(100vw-2rem)] max-w-[680px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Detalhes do agendamento</DialogTitle>
          <DetailModalHeader
            dense
            icon={Icon}
            title={event.client || ticket?.clientName || event.title}
            protocol={protocol ?? ticket?.protocol}
            onClose={() => onOpenChange(false)}
            meta={
              <>
                {(event.client || ticket?.clientName) && (
                  <>
                    <span className="text-foreground">{event.title}</span>
                    <span>·</span>
                  </>
                )}
                <span>{formatDate(event.date)}</span>
                <span>·</span>
                <span className="tabular-nums">
                  {event.time} às {event.end}
                </span>
              </>
            }
            chips={
              <>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {event.type}
                </Badge>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    toneStyle.soft,
                    toneStyle.text,
                  )}
                >
                  {EVENT_TONE_LABEL[tone]}
                </span>
              </>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={CalendarDays} label="Data">
                {formatDate(event.date)}
              </Info>
              <Info icon={CalendarDays} label="Horário">
                <span className="tabular-nums">
                  {event.time} às {event.end}
                </span>
              </Info>
              <Info icon={UserRound} label="Responsável">
                {event.responsible || event.operator || "—"}
              </Info>
              <Info icon={Ticket} label="Origem">
                {event.origin}
              </Info>
              {(event.client || ticket?.clientName) && (
                <Info icon={UsersRound} label="Cliente / empresa" className="sm:col-span-2">
                  {event.client ||
                    [ticket?.clientCode, ticket?.clientName].filter(Boolean).join(" · ")}
                </Info>
              )}
              {event.type !== "Pessoal" && guestLabels.length > 0 && (
                <Info icon={UsersRound} label="Convidados" className="sm:col-span-2">
                  <span className="flex flex-wrap gap-1">
                    {guestLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {label}
                      </Badge>
                    ))}
                  </span>
                </Info>
              )}
              {event.address && (
                <Info icon={MapPin} label="Endereço" className="sm:col-span-2">
                  {event.address}
                </Info>
              )}
              {event.meetingLink && (
                <Info icon={Link2} label="Link da reunião" className="sm:col-span-2">
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer text-blue-600 no-underline hover:opacity-80 dark:text-blue-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {event.meetingLink}
                  </a>
                </Info>
              )}
              {event.room && (
                <Info icon={MapPin} label="Sala">
                  {event.room}
                </Info>
              )}
              {event.platform && (
                <Info icon={Link2} label="Plataforma">
                  {event.platform}
                </Info>
              )}
              {event.description && (
                <Info icon={CalendarDays} label="Descrição e observações" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{plainText(event.description)}</span>
                </Info>
              )}
              {tone === "cancelled" && event.cancellationReason && (
                <Info icon={X} label="Motivo do cancelamento" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap">{plainText(event.cancellationReason)}</span>
                </Info>
              )}
              {vehicle && (
                <Info icon={Car} label="Veículo reservado" className="sm:col-span-2">
                  {vehicle.model} · {vehicle.plate}
                </Info>
              )}
              {vehicle && (
                <>
                  <Info icon={Car} label="Saída prevista">
                    {formatFleetDateTime(departureRef) || "—"}
                  </Info>
                  <Info icon={Car} label="Devolução prevista">
                    {formatFleetDateTime(returnRef) || "—"}
                  </Info>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2 border-t border-border bg-card px-5 py-3">
            {!hideFooterActions && ticket && (
              <Button
                variant="outline"
                className="h-9 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                  if (onViewTicket) {
                    onViewTicket(ticket.id);
                    return;
                  }
                  void navigate({ to: "/chamados", search: { ticket: ticket.id } });
                }}
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Ver chamado
              </Button>
            )}
            {!hideFooterActions && canPickup && (
              <Button
                className="h-9 cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickupVehicle?.(event);
                }}
              >
                <KeyRound className="mr-1.5 h-4 w-4" />
                Retirar veículo
              </Button>
            )}
            {!hideFooterActions && canEdit && !eventHasStarted && (
              <Button
                variant="outline"
                className="h-9 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(event);
                }}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar agendamento
              </Button>
            )}
            {!hideFooterActions && canCancel && (
              <Button
                variant="outline"
                className="h-9 cursor-pointer border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={(e) => {
                  e.stopPropagation();
                  setCancelOpen(true);
                }}
              >
                <X className="mr-1.5 h-4 w-4" />
                Cancelar agendamento
              </Button>
            )}
            {!hideFooterActions && event.type !== "Pessoal" && canCancel && onSaveReport && (
              <Button
                className="h-9 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportOpen(true);
                }}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                Relatório
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-9 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CancelEventDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={() => {
          onCancelEvent?.({
            ...event,
            cancellationReason: cancelReason.trim(),
            cancelledAt: new Date().toISOString(),
          });
          setCancelOpen(false);
        }}
      />
      <EventReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        event={event}
        report={report}
        setReport={setReport}
        onSave={submitReport}
      />
    </>
  );
}

type ReportDraft = {
  permission: "Público" | "Clientes" | "Empresa";
  priority: "Baixa" | "Média" | "Alta";
  option: string;
  version: string;
  startedAt: string;
  endedAt: string;
  contact: string;
  notes: string;
  completed: boolean;
};

function CancelEventDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="border-b border-border px-5 py-4 text-base">
          Cancelar agendamento
        </DialogTitle>
        <div className="space-y-2 px-5 py-5">
          <Label htmlFor="calendar-cancel-reason">Motivo do cancelamento</Label>
          <Textarea
            id="calendar-cancel-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Informe por que o agendamento foi cancelado"
            className="min-h-28 resize-none"
          />
        </div>
        <DialogFooter className="border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={onConfirm}>
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventReportDialog({
  open,
  onOpenChange,
  event,
  report,
  setReport,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent;
  report: ReportDraft;
  setReport: Dispatch<SetStateAction<ReportDraft>>;
  onSave: (completed: boolean) => void;
}) {
  const primaryLabel = event.client ?? event.title;
  const showTitle =
    event.title.trim().toLocaleLowerCase("pt-BR") !==
    primaryLabel.trim().toLocaleLowerCase("pt-BR");
  const versionOptions = useMemo(
    () =>
      erpVersions.map((version) => `${version.versao}-${formatVersionDate(version.data_versao)}`),
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="border-b border-border px-5 py-4 text-base">
          Relatório do agendamento
        </DialogTitle>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium">{primaryLabel}</p>
              {showTitle && <p className="mt-1 truncate text-muted-foreground">{event.title}</p>}
            </div>
            <p className="whitespace-nowrap text-muted-foreground">
              {formatDate(event.date)} · {event.time} às {event.end}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Permissão"
              value={report.permission}
              options={["Público", "Clientes", "Empresa"]}
              onChange={(permission) =>
                setReport((p) => ({ ...p, permission: permission as ReportDraft["permission"] }))
              }
            />
            <PriorityField
              value={report.priority}
              onChange={(priority) => setReport((p) => ({ ...p, priority }))}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
            <Checkbox
              checked={report.completed}
              onCheckedChange={(completed) =>
                setReport((p) => ({ ...p, completed: completed === true }))
              }
            />
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Concluir agendamento ao salvar
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Opção/formulário"
              value={report.option}
              onChange={(option) => setReport((p) => ({ ...p, option }))}
            />
            <SelectField
              label="Versão do Hádron"
              value={report.version}
              options={["Selecione a versão", ...versionOptions]}
              onChange={(version) =>
                setReport((p) => ({
                  ...p,
                  version: version === "Selecione a versão" ? "" : version,
                }))
              }
            />
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              <Field
                label="Horário inicial"
                type="time"
                value={report.startedAt}
                onChange={(startedAt) => setReport((p) => ({ ...p, startedAt }))}
              />
              <Field
                label="Horário final"
                type="time"
                value={report.endedAt}
                onChange={(endedAt) => setReport((p) => ({ ...p, endedAt }))}
              />
              <Field
                label="Contato"
                value={report.contact}
                onChange={(contact) => setReport((p) => ({ ...p, contact }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-report-notes">Observação</Label>
            <Textarea
              id="calendar-report-notes"
              value={report.notes}
              onChange={(e) => setReport((p) => ({ ...p, notes: e.target.value }))}
              className="min-h-32 resize-none"
              placeholder="Descreva o atendimento realizado"
            />
          </div>
        </div>
        <DialogFooter className="flex-wrap border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button variant="outline" onClick={() => onSave(false)}>
            Salvar e continuar
          </Button>
          <Button onClick={() => onSave(true)}>Salvar e finalizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const reportPriorities = [
  {
    value: "Baixa" as const,
    label: "Baixa",
    icon: ChevronDown,
    baseClass: "border-success/25 bg-success/10 dark:bg-success/15",
    activeClass:
      "border-success/70 ring-2 ring-success/40 shadow-sm bg-success/15 dark:bg-success/20",
    iconWrapClass: "bg-success text-success-foreground",
    textClass: "text-success",
  },
  {
    value: "Média" as const,
    label: "Média",
    icon: Minus,
    baseClass: "border-warning/30 bg-warning/12 dark:bg-warning/15",
    activeClass:
      "border-warning/70 ring-2 ring-warning/40 shadow-sm bg-warning/20 dark:bg-warning/25",
    iconWrapClass: "bg-warning text-warning-foreground",
    textClass: "text-warning-foreground",
  },
  {
    value: "Alta" as const,
    label: "Alta",
    icon: ArrowUp,
    baseClass: "border-destructive/25 bg-destructive/10 dark:bg-destructive/15",
    activeClass:
      "border-destructive/70 ring-2 ring-destructive/40 shadow-sm bg-destructive/15 dark:bg-destructive/20",
    iconWrapClass: "bg-destructive text-destructive-foreground",
    textClass: "text-destructive",
  },
];

function PriorityField({
  value,
  onChange,
}: {
  value: ReportDraft["priority"];
  onChange: (value: ReportDraft["priority"]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Prioridade</Label>
      <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-3 gap-2">
        {reportPriorities.map((priority) => {
          const Icon = priority.icon;
          const active = value === priority.value;
          return (
            <button
              key={priority.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(priority.value)}
              className={cn(
                "relative flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-medium transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                priority.baseClass,
                active && priority.activeClass,
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                  priority.iconWrapClass,
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={cn("font-medium", priority.textClass)}>{priority.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = `event-report-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = `event-report-${label.toLowerCase()}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 px-3 py-2", className)}>
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}
