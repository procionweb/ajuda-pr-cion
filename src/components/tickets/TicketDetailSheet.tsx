import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Folder,
  Globe,
  History,
  Info,
  LayoutGrid,
  ListChecks,
  LockKeyhole,
  MapPin,
  MessageSquare,
  NotebookText,
  Paperclip,
  Phone,
  Plus,
  PlayCircle,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket as TicketIcon,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import finishIconUrl from "@/assets/ticket-finalize-v4.png";
import transferIconUrl from "@/assets/ticket-transfer-solid.png";
import startAttendanceIconUrl from "@/assets/ticket-start-solid.png";
import scheduleIconUrl from "@/assets/ticket-schedule-solid.png";
import specialistIconUrl from "@/assets/ticket-send-specialist-solid.png";

import { cn } from "@/lib/utils";
import {
  ticketStatuses,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support-tickets-data";
import {
  getTransferBlockReason,
  ticketsStore,
  useTicket,
  useTicketEvents,
  useTickets,
  ticketToPastAttendance,
  useTicketNotes,
  type ClosurePayload,
  type TicketEvent,
} from "@/lib/tickets-store";
import { currentUser } from "@/lib/mock-data";
import { TicketHistoryModal } from "./TicketHistoryModal";
import { TicketHistoryList } from "./TicketHistoryList";
import { PastAttendanceDetailModal } from "./PastAttendanceDetailModal";
import type { PastAttendance } from "@/lib/tickets-store";
import { TicketNotesModal } from "./TicketNotesModal";
import { useTicketSummary } from "@/lib/ticket-summary";
import { TicketTimelineModal } from "./TicketTimelineModal";
import { TicketTimelineList } from "./TicketTimelineList";
import { TicketFloatingChat } from "./TicketFloatingChat";
import { ScheduleEventModal } from "./ScheduleEventModal";
import { ForwardSpecialistModal } from "./ForwardSpecialistModal";
import { TransferTicketModal } from "./TransferTicketModal";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { ModuleKnowledgeLink } from "@/lib/module-link";
import { kbArticlesFull } from "@/lib/kb-data";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Link, useNavigate } from "@tanstack/react-router";
import { clientRows } from "@/routes/clientes.index";
import { useClients } from "@/lib/clients-store";
import { snapshotCurrentChamadosForTicket } from "@/lib/return-to-ticket";
import { formatPhoneDisplay } from "@/lib/client-contacts";
import { EventDetailsModal } from "@/components/calendar/EventDetailsModal";
import { updateLocalEvent, useLocalEvents } from "@/lib/local-events-store";
import type { CalendarEvent } from "@/lib/calendar-events";
import { cancelReservationByEvent } from "@/lib/fleet-store";

const statusTone: Record<TicketStatus, string> = {
  Atrasado: "bg-destructive/12 text-destructive border-destructive/20",
  "Em Aberto": "bg-primary/12 text-primary border-primary/20",
  Ocupado:
    "bg-[#fff1d6] text-[#b66a00] border-[#ffd78a] dark:bg-[#4d3516] dark:text-[#ffd28a] dark:border-[#7a5520]",
  "Em andamento":
    "bg-[#e8f3ff] text-[#246cb5] border-[#bfddff] dark:bg-[#17314e] dark:text-[#9dcaff] dark:border-[#24527d]",
  "Aguardando cliente":
    "bg-[#f2eaff] text-[#7253bd] border-[#d9c9ff] dark:bg-[#2e2549] dark:text-[#c7b8ff] dark:border-[#4b3a78]",
  "Com especialista":
    "bg-[#e7faf1] text-[#1f9860] border-[#bdeed6] dark:bg-[#14382b] dark:text-[#8ee8be] dark:border-[#226447]",
  Agendamento:
    "bg-[#fff8dd] text-[#9c7610] border-[#f4df85] dark:bg-[#403817] dark:text-[#f3d66d] dark:border-[#695b22]",
  Finalizado: "bg-success/12 text-success border-success/20",
  Cancelado: "bg-muted text-muted-foreground border-border",
};

const priorityTone: Record<TicketPriority, string> = {
  Alta: "bg-destructive/12 text-destructive border-destructive/20",
  Media:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  Baixa:
    "bg-[#eaf4ff] text-[#246cb5] border-[#bfdcff] dark:bg-[#17314e] dark:text-[#9dcaff] dark:border-[#24527d]",
};

const sourceLabels: Record<SupportTicket["source"], string> = {
  Telefone: "Telefone",
  "Portal do cliente": "Portal do cliente",
  WhatsApp: "WhatsApp",
  Email: "Email",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const slaTextTone: Record<"ok" | "warn" | "late", string> = {
  ok: "text-success",
  warn: "text-warning-foreground",
  late: "text-destructive",
};

const timelineIcon: Record<TicketEvent["kind"], typeof Info> = {
  created: MessageSquare,
  attached: Paperclip,
  assumed: UserPlus,
  attend: PlayCircle,
  status: ShieldCheck,
  message: Send,
  note: FileText,
  solution: Sparkles,
  closed: CheckCircle2,
  scheduled: CalendarClock,
  forwarded: UserCheck,
};

const timelineTone: Record<TicketEvent["kind"], string> = {
  created: "bg-primary/12 text-primary",
  attached: "bg-muted text-foreground",
  assumed: "bg-[#e7faf1] text-[#1f9860] dark:bg-[#14382b] dark:text-[#8ee8be]",
  attend: "bg-[#fff1d6] text-[#b66a00] dark:bg-[#4d3516] dark:text-[#ffd28a]",
  status: "bg-[#e8f3ff] text-[#246cb5] dark:bg-[#17314e] dark:text-[#9dcaff]",
  message: "bg-[#f2eaff] text-[#7253bd] dark:bg-[#2e2549] dark:text-[#c7b8ff]",
  note: "bg-muted text-foreground",
  solution: "bg-success/15 text-success",
  closed: "bg-success/15 text-success",
  scheduled: "bg-[#fff8dd] text-[#9c7610] dark:bg-[#403817] dark:text-[#f3d66d]",
  forwarded: "bg-[#e7faf1] text-[#1f9860] dark:bg-[#14382b] dark:text-[#8ee8be]",
};

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

function createMaskedActionIcon(maskUrl: string, size: string = "contain"): IconComponent {
  return function MaskedActionIcon({ className }) {
    return (
      <span
        aria-hidden="true"
        className={cn("block bg-current", className)}
        style={{
          WebkitMask: `url(${maskUrl}) center / ${size} no-repeat`,
          mask: `url(${maskUrl}) center / ${size} no-repeat`,
        }}
      />
    );
  };
}

const TicketCloseIcon = createMaskedActionIcon(finishIconUrl);
const TicketAssumeIcon = createMaskedActionIcon(transferIconUrl);
const TicketAttendIcon = createMaskedActionIcon(startAttendanceIconUrl);
const TicketScheduleIcon = createMaskedActionIcon(scheduleIconUrl);
const TicketForwardIcon = createMaskedActionIcon(specialistIconUrl);
const TicketTimelineIcon = History;

import { getModuleIcon } from "@/lib/ticket-icons";
import { computeAttendanceTime, computeSla, formatElapsedTime } from "@/lib/ticket-sla";

export function TicketDetailSheet({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const ticket = useTicket(ticketId);
  const allTickets = useTickets();
  const events = useTicketEvents(ticketId);
  const notes = useTicketNotes(ticketId);
  const historyList = useMemo(() => {
    if (!ticket?.clientCode) return [];
    const clientCode = ticket.clientCode.trim().toUpperCase();
    return allTickets
      .filter(
        (item) =>
          item.clientCode.trim().toUpperCase() === clientCode && item.status === "Finalizado",
      )
      .sort(
        (a, b) =>
          new Date(b.closedAt || b.updatedAt).getTime() -
          new Date(a.closedAt || a.updatedAt).getTime(),
      )
      .map(ticketToPastAttendance);
  }, [allTickets, ticket?.clientCode]);

  const [note, setNote] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const transferBlockReason = getTransferBlockReason(ticket);
  const canTransfer = !transferBlockReason;
  const openTransfer = () => {
    const reason = getTransferBlockReason(ticket);
    if (reason) {
      toast.error(reason);
      return;
    }
    setTransferOpen(true);
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);
  const [calendarEventAction, setCalendarEventAction] = useState<"details" | "cancel" | "report">(
    "details",
  );
  const localCalendarEvents = useLocalEvents();
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<PastAttendance | null>(null);
  const [activeAction, setActiveAction] = useState<
    "encerrar" | "assumir" | "agendar" | "encaminhar" | "atender" | "timeline" | "novo"
  >("atender");

  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open, ticketId]);

  const sla = useMemo(() => (ticket ? computeSla(ticket, clockNow) : null), [ticket, clockNow]);
  const attendanceTime = useMemo(
    () => (ticket ? computeAttendanceTime(ticket, clockNow) : null),
    [ticket, clockNow],
  );
  // Descrição real informada na abertura do chamado (sem texto padrão).
  const ticketDescription = useMemo(() => {
    const raw = ticket?.description;
    return typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim() : "";
  }, [ticket?.description]);
  const summaryState = useTicketSummary(
    ticket?.id,
    ticketDescription,
    ticket?.descriptionSummary ?? null,
    {
      requester: ticket?.contact,
      requesterPhone: ticket?.contactPhone,
      operator:
        ticketDescription.match(/\bOperador:\s*([A-Z0-9]+)/i)?.[1] ||
        ticket?.owner ||
        ticket?.attendant,
      company: ticket?.companyName || ticket?.clientName,
    },
  );
  const { clients: loadedClients } = useClients({ onlyActive: false });
  // Resolve o cliente pela sigla real do chamado (ou da empresa/subempresa),
  // nunca apenas por UUID/companyId — chamados importados podem não tê-los.
  const resolvedClient = useMemo(() => {
    const candidates = [ticket?.clientCode, ticket?.clientName]
      .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
      .filter(Boolean);
    if (!candidates.length) return null;
    const pool = [...loadedClients, ...clientRows];
    for (const code of candidates) {
      const found = pool.find(
        (c) => c.id?.toLowerCase() === code || c.acronym?.toLowerCase() === code,
      );
      if (found) return found;
    }
    return null;
  }, [ticket?.clientCode, ticket?.clientName, loadedClients]);
  const clientSlug = resolvedClient?.id ?? null;
  const appointmentHistory = useMemo(() => {
    if (!ticket) return [];

    const normalize = (value?: string) =>
      (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
    const clientIds = new Set(
      [resolvedClient?.id, ticket.companyId]
        .filter((value): value is string => Boolean(value))
        .map(normalize),
    );
    const clientCodes = new Set(
      [resolvedClient?.acronym, ticket.clientCode]
        .filter((value): value is string => Boolean(value))
        .map(normalize),
    );

    return localCalendarEvents
      .filter((event) => {
        if (event.status !== "Concluído" && event.status !== "Cancelado") return false;
        if (event.ticketId && String(event.ticketId) === String(ticket.id)) return true;
        if (event.clientId && clientIds.has(normalize(event.clientId))) return true;
        const eventClient = normalize(event.client);
        return [...clientCodes].some(
          (code) => eventClient === code || eventClient.startsWith(`${code} `),
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(`${left.date}T${left.time || "00:00"}:00`).getTime();
        const rightTime = new Date(`${right.date}T${right.time || "00:00"}:00`).getTime();
        return rightTime - leftTime;
      });
  }, [localCalendarEvents, resolvedClient, ticket]);

  if (!ticket || !sla || !attendanceTime) return null;

  const firstAttendanceEventId = [...events]
    .filter((event) => event.kind === "attend")
    .sort((left, right) => left.when.localeCompare(right.when))[0]?.id;
  const timelineEvents = events.filter(
    (event) =>
      event.kind !== "note" && (event.kind !== "attend" || event.id === firstAttendanceEventId),
  );

  const findScheduledEvent = (timelineEvent: TicketEvent) => {
    const candidates = localCalendarEvents.filter(
      (calendarEvent) => String(calendarEvent.ticketId ?? "") === String(ticket.id),
    );
    const scheduleMatch = timelineEvent.description.match(
      /para\s+(\d{4}-\d{2}-\d{2}),\s+das\s+(\d{2}:\d{2})/i,
    );
    const exact = scheduleMatch
      ? candidates.find(
          (calendarEvent) =>
            calendarEvent.date === scheduleMatch[1] && calendarEvent.time === scheduleMatch[2],
        )
      : undefined;
    const timelineTimestamp = new Date(timelineEvent.when).getTime();
    const closest = [...candidates].sort((left, right) => {
      const leftTimestamp = Number(String(left.id).split("-").at(-1));
      const rightTimestamp = Number(String(right.id).split("-").at(-1));
      const leftDistance = Number.isFinite(leftTimestamp)
        ? Math.abs(leftTimestamp - timelineTimestamp)
        : Number.POSITIVE_INFINITY;
      const rightDistance = Number.isFinite(rightTimestamp)
        ? Math.abs(rightTimestamp - timelineTimestamp)
        : Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    })[0];
    return exact ?? closest ?? null;
  };

  const resolveScheduledEvent = (timelineEvent: TicketEvent) => {
    const calendarEvent = findScheduledEvent(timelineEvent);
    if (!calendarEvent) {
      toast.error("Não foi possível localizar os detalhes deste agendamento.");
      return null;
    }
    return calendarEvent;
  };

  const getScheduledEventStatus = (timelineEvent: TicketEvent) => {
    const calendarEvent = findScheduledEvent(timelineEvent);
    if (!calendarEvent) return "active" as const;
    const normalized = String(calendarEvent.status ?? "").toLocaleLowerCase("pt-BR");
    if (normalized.includes("cancel")) return "cancelled" as const;
    if (normalized.includes("conclu")) return "completed" as const;
    return "active" as const;
  };

  const openScheduledEventAction = (
    timelineEvent: TicketEvent,
    action: "details" | "cancel" | "report",
  ) => {
    const calendarEvent = resolveScheduledEvent(timelineEvent);
    if (!calendarEvent) return;
    setTimelineOpen(false);
    setCalendarEventAction(action);
    setSelectedCalendarEvent(calendarEvent);
  };

  const openScheduledEvent = (timelineEvent: TicketEvent) =>
    openScheduledEventAction(timelineEvent, "details");
  const cancelScheduledEvent = (timelineEvent: TicketEvent) =>
    openScheduledEventAction(timelineEvent, "cancel");
  const reportScheduledEvent = (timelineEvent: TicketEvent) =>
    openScheduledEventAction(timelineEvent, "report");

  const handleCancelScheduledEvent = (calendarEvent: CalendarEvent) => {
    updateLocalEvent(calendarEvent.id, { ...calendarEvent, status: "Cancelado" });
    cancelReservationByEvent(calendarEvent.id);
    setSelectedCalendarEvent(null);
    toast.success("Agendamento cancelado");
  };

  const handleSaveScheduledReport = (calendarEvent: CalendarEvent, completed: boolean) => {
    updateLocalEvent(calendarEvent.id, calendarEvent);
    if (completed || calendarEvent.report?.completed) {
      cancelReservationByEvent(calendarEvent.id);
      setSelectedCalendarEvent(null);
      toast.success("Relatório salvo e agendamento concluído");
      return;
    }
    toast.success("Relatório salvo");
  };

  const isMine = ticket.owner === currentUser.operator || ticket.lockedBy === currentUser.operator;
  const isFinalized = ticket.status === "Finalizado";
  const createAnotherTicket = () => {
    onOpenChange(false);
    void navigate({
      to: "/chamados/novo",
      search: {
        cliente: ticket.clientCode || undefined,
        empresa: ticket.companyId || undefined,
      },
    });
  };

  const handleAttend = () => {
    if (ticket.attendanceStartedAt) {
      toast.info("O atendimento deste chamado já foi iniciado.");
      return;
    }
    ticketsStore.attendTicket(ticket.id);
    toast.success("Atendimento iniciado");
  };
  // status change removed from side menu; substituted by "Agendar evento" and "Encaminhar a especialista"
  const handleSaveNote = () => {
    const text = note.trim();
    if (!text) return;
    ticketsStore.addInternalNote(ticket.id, text);
    setNote("");
    toast.success("Nota interna salva");
  };
  const handleClose = (payload: ClosurePayload) => {
    ticketsStore.closeTicket(ticket.id, payload);
    localCalendarEvents
      .filter(
        (event) =>
          String(event.ticketId ?? "") === String(ticket.id) && event.status === "Agendado",
      )
      .forEach((event) => updateLocalEvent(event.id, { ...event, status: "Concluído" }));
    setCloseOpen(false);
    toast.success("Chamado encerrado");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <DialogContent
          onPointerDownOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest("[data-ticket-floating-chat]")) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest("[data-ticket-floating-chat]")) {
              event.preventDefault();
            }
          }}
          className="grid max-h-none w-[92vw] max-w-[1500px] gap-4 !overflow-visible border-0 bg-transparent p-0 shadow-none xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6 [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Detalhes do chamado {ticket.protocol}</DialogTitle>

          {/* Painel esquerdo — Chamado */}
          <div className="relative flex max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <DetailModalHeader
              icon={getModuleIcon(ticket.module, ticket.source, ticket.subject)}
              title={ticket.subject}
              protocol={ticket.protocol}
              onClose={() => onOpenChange(false)}
              chips={
                <>
                  <Badge
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide",
                      statusTone[ticket.status],
                    )}
                  >
                    {ticket.status}
                  </Badge>
                  <Badge
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-0.5 text-[10.5px] font-medium",
                      priorityTone[ticket.priority],
                    )}
                  >
                    Prioridade {ticket.priority}
                  </Badge>
                  {ticket.lockedBy && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-[10.5px] font-medium text-warning-foreground">
                      <LockKeyhole className="h-3 w-3" />
                      {ticket.lockedBy}
                    </span>
                  )}
                </>
              }
              trailing={
                <div
                  className={cn(
                    "inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5",
                    statusTone[ticket.status],
                  )}
                  title={`Situação atual: ${ticket.status}`}
                >
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[11px] font-semibold">{ticket.status}</span>
                    <span className="truncate text-[10px] font-normal opacity-80">
                      Atualizado em {formatDateTime(ticket.updatedAt)}
                    </span>
                  </span>
                </div>
              }

              meta={
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  {clientSlug ? (
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: clientSlug }}
                      search={{ tab: "cliente", from: "chamado", ticketId: ticket.id }}
                      onClick={() => snapshotCurrentChamadosForTicket(ticket.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Ver detalhes do cliente"
                    >
                      <span className="font-semibold text-primary">{ticket.clientCode || "—"}</span>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span className="truncate text-foreground">
                        {ticket.clientName || "Cliente não vinculado"}
                      </span>
                    </Link>
                  ) : (
                    <>
                      <span className="font-semibold text-primary">{ticket.clientCode || "—"}</span>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span className="truncate text-foreground">
                        {ticket.clientName || "Cliente não vinculado"}
                      </span>
                    </>
                  )}

                  {(ticket.companyName || ticket.companyNumber || ticket.companyDocument) && (
                    <>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {ticket.companyNumber
                          ? `${String(ticket.companyNumber).padStart(3, "0")} · `
                          : ""}
                        {ticket.companyName || "Empresa"}
                        {ticket.companyDocument ? ` · ${ticket.companyDocument}` : ""}
                      </span>
                    </>
                  )}
                </span>
              }
            />

            {/* Body: sidebar (menu + ações) | conteúdo | chat */}
            <div className="flex flex-1 min-h-0 flex-col bg-card md:flex-row md:gap-4 md:p-4 dark:bg-muted/30">
              {/* Sidebar */}
              <aside
                className={cn(
                  "hidden shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[width] duration-200 md:flex",
                  navCollapsed ? "md:w-[64px]" : "md:w-[210px]",
                )}
              >
                <div className="flex items-center justify-end p-2">
                  <button
                    type="button"
                    onClick={() => setNavCollapsed((v) => !v)}
                    aria-label={navCollapsed ? "Expandir menu" : "Retrair menu"}
                    title={navCollapsed ? "Expandir menu" : "Retrair menu"}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {navCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="flex-1 space-y-1 overflow-y-auto p-2">
                  {!navCollapsed && (
                    <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ações
                    </p>
                  )}
                  <SideItem
                    icon={Plus}
                    label="Adicionar chamado"
                    collapsed={navCollapsed}
                    active={activeAction === "novo"}
                    onClick={() => {
                      setActiveAction("novo");
                      createAnotherTicket();
                    }}
                  />
                  <SideItem
                    icon={TicketCloseIcon}
                    label="Finalizar"
                    collapsed={navCollapsed}
                    active={activeAction === "encerrar"}
                    disabled={isFinalized}
                    title={isFinalized ? "Chamado finalizado" : undefined}
                    onClick={() => {
                      setActiveAction("encerrar");
                      setCloseOpen(true);
                    }}
                  />
                  <SideItem
                    icon={TicketAssumeIcon}
                    label="Transferir chamado"
                    collapsed={navCollapsed}
                    active={activeAction === "assumir"}
                    disabled={isFinalized || !canTransfer}
                    title={transferBlockReason ?? undefined}
                    onClick={() => {
                      setActiveAction("assumir");
                      openTransfer();
                    }}
                  />
                  <SideItem
                    icon={TicketScheduleIcon}
                    label="Agendar evento"
                    collapsed={navCollapsed}
                    active={activeAction === "agendar"}
                    disabled={isFinalized}
                    title={isFinalized ? "Chamado finalizado" : undefined}
                    onClick={() => {
                      setActiveAction("agendar");
                      setScheduleOpen(true);
                    }}
                  />
                  <SideItem
                    icon={TicketForwardIcon}
                    label="Enviar a especialista"
                    nowrap
                    collapsed={navCollapsed}
                    active={activeAction === "encaminhar"}
                    disabled={isFinalized}
                    title={isFinalized ? "Chamado finalizado" : undefined}
                    onClick={() => {
                      setActiveAction("encaminhar");
                      setForwardOpen(true);
                    }}
                  />
                  <SideItem
                    icon={TicketAttendIcon}
                    label="Iniciar atendimento"
                    collapsed={navCollapsed}
                    active={activeAction === "atender"}
                    disabled={isFinalized || Boolean(ticket.attendanceStartedAt)}
                    title={
                      isFinalized
                        ? "Chamado finalizado"
                        : ticket.attendanceStartedAt
                          ? "Atendimento já iniciado"
                          : undefined
                    }
                    onClick={() => {
                      setActiveAction("atender");
                      handleAttend();
                    }}
                  />
                </div>

                {isMine && (
                  <div className="p-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-[10.5px] font-medium text-primary",
                        navCollapsed && "md:justify-center md:px-0",
                      )}
                      title={`Atendendo: ${currentUser.operator}`}
                    >
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn("truncate", navCollapsed && "md:hidden")}>
                        {currentUser.operator}
                      </span>
                    </span>
                  </div>
                )}
              </aside>

              {/* Mobile action bar (topo, rolável) */}
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
                <MobileAction
                  icon={Plus}
                  label="Adicionar chamado"
                  onClick={createAnotherTicket}
                  highlight
                />
                <MobileAction
                  icon={TicketCloseIcon}
                  label="Finalizar"
                  disabled={isFinalized}
                  title={isFinalized ? "Chamado finalizado" : undefined}
                  onClick={() => setCloseOpen(true)}
                />
                <MobileAction
                  icon={TicketAssumeIcon}
                  label="Transferir"
                  disabled={isFinalized || !canTransfer}
                  title={transferBlockReason ?? undefined}
                  onClick={openTransfer}
                />
                <MobileAction
                  icon={TicketScheduleIcon}
                  label="Agendar"
                  disabled={isFinalized}
                  title={isFinalized ? "Chamado finalizado" : undefined}
                  onClick={() => setScheduleOpen(true)}
                />
                <MobileAction
                  icon={TicketForwardIcon}
                  label="Enviar a especialista"
                  disabled={isFinalized}
                  title={isFinalized ? "Chamado finalizado" : undefined}
                  onClick={() => setForwardOpen(true)}
                />
                <MobileAction
                  icon={TicketAttendIcon}
                  label="Iniciar atendimento"
                  disabled={isFinalized || Boolean(ticket.attendanceStartedAt)}
                  title={
                    isFinalized
                      ? "Chamado finalizado"
                      : ticket.attendanceStartedAt
                        ? "Atendimento já iniciado"
                        : undefined
                  }
                  onClick={handleAttend}
                  highlight
                />
                <MobileAction
                  icon={TicketTimelineIcon}
                  label="Timeline"
                  onClick={() => setTimelineOpen(true)}
                />
              </div>

              {/* Main content */}
              <div className="modal-scrollbar flex-1 min-w-0 overflow-y-auto rounded-2xl border border-border bg-card px-5 py-5 md:px-6">
                {/* Resumo */}
                <Section title="Resumo do chamado" icon={LayoutGrid}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat label="Status">
                      <Badge
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
                          statusTone[ticket.status],
                        )}
                      >
                        {ticket.status}
                      </Badge>
                    </MiniStat>
                    <MiniStat label="Prioridade">
                      <Badge
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
                          priorityTone[ticket.priority],
                        )}
                      >
                        {ticket.priority}
                      </Badge>
                    </MiniStat>
                    <MiniStat label="SLA de espera">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                          <span
                            className={cn(
                              "text-[18px] font-bold leading-none sm:text-[20px]",
                              slaTextTone[sla.tone],
                            )}
                          >
                            {sla.pct}%
                          </span>
                          <span className="mt-1 text-[10px] text-muted-foreground">
                            {sla.minutes}min decorridos
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 text-[9px] font-medium leading-tight",
                              sla.tone === "ok"
                                ? "text-success"
                                : sla.tone === "warn"
                                  ? "text-warning-foreground"
                                  : "text-destructive",
                            )}
                          >
                            {sla.tone === "ok"
                              ? "Dentro do prazo"
                              : sla.tone === "warn"
                                ? "Próximo do limite"
                                : "Fora do prazo"}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:h-9 sm:w-9",
                            sla.tone === "ok"
                              ? "border-success/25 bg-success/10 text-success"
                              : sla.tone === "warn"
                                ? "border-warning/25 bg-warning/15 text-warning-foreground"
                                : "border-destructive/25 bg-destructive/10 text-destructive",
                          )}
                          aria-hidden
                        >
                          <Clock3 className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                        </div>
                      </div>
                    </MiniStat>
                    <MiniStat label="Tempo de atendimento">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-[18px] font-normal leading-none text-foreground sm:text-[20px]">
                            {attendanceTime.started
                              ? formatElapsedTime(attendanceTime.seconds)
                              : "Não iniciado"}
                          </span>
                          <span
                            className={cn(
                              "mt-1 text-[10px] font-medium",
                              attendanceTime.running ? "text-success" : "text-muted-foreground",
                            )}
                          >
                            {attendanceTime.running
                              ? "Em atendimento"
                              : attendanceTime.started
                                ? "Contagem pausada"
                                : "Aguardando início"}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:h-9 sm:w-9",
                            attendanceTime.running
                              ? "border-success/25 bg-success/10 text-success"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                          aria-hidden
                        >
                          {attendanceTime.running ? (
                            <PlayCircle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                          ) : (
                            <Clock3 className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                          )}
                        </div>
                      </div>
                    </MiniStat>
                  </div>
                </Section>

                <Section title="Resumo do problema" icon={FileText}>
                  {ticketDescription ? (
                    <div key={ticket.id} className="space-y-2">
                      {summaryState.status === "loading" ? (
                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                          Gerando resumo da descrição...
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                          {summaryState.summary ?? ticketDescription}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setDescriptionOpen(true)}
                        className="w-fit cursor-pointer text-[12px] font-medium text-primary no-underline hover:opacity-80"
                      >
                        Ver descrição original
                      </button>
                    </div>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Descrição não informada
                    </p>
                  )}
                </Section>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Section title="Cliente" icon={Building2} compact>
                    {(() => {
                      const nameNode = (
                        <p className="text-[12px] font-normal leading-snug text-foreground break-words">
                          {ticket.clientName || "Cliente não vinculado"}
                        </p>
                      );
                      return clientSlug ? (
                        <Link
                          to="/clientes/$clienteId"
                          params={{ clienteId: clientSlug }}
                          search={{ tab: "cliente", from: "chamado", ticketId: ticket.id }}
                          onClick={() => snapshotCurrentChamadosForTicket(ticket.id)}
                          className="block cursor-pointer rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Ver detalhes do cliente"
                          aria-label={`Ver detalhes do cliente ${ticket.clientName || "Cliente não vinculado"}`}
                        >
                          {nameNode}
                        </Link>
                      ) : (
                        nameNode
                      );
                    })()}

                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {resolvedClient?.city || "Localização não informada"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Código {ticket.clientCode || "—"}
                    </p>
                  </Section>

                  <Section title="Contato" icon={UserRound} compact>
                    <p className="text-[13px] font-normal text-foreground truncate">
                      {ticket.contact}
                    </p>
                    {ticket.contactPhone && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {formatPhoneDisplay(ticket.contactPhone)}
                      </p>
                    )}
                  </Section>

                  <Section title="Módulo" icon={Folder} compact>
                    <div className="flex items-center gap-1.5">
                      <ModuleKnowledgeLink
                        module={ticket.module}
                        className="truncate text-[13px] font-normal text-foreground"
                        returnToTicketId={ticket.id}
                        onBeforeNavigate={() => snapshotCurrentChamadosForTicket(ticket.id)}
                      />
                      {notes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setNotesOpen(true)}
                          title={`Ver ${notes.length} nota(s) interna(s)`}
                          aria-label="Ver notas internas"
                          className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-md bg-primary/10 text-primary transition hover:bg-primary/20"
                        >
                          <NotebookText className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      Origem: {sourceLabels[ticket.source]}
                    </p>
                    {notes.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-primary">
                        {notes.length} nota(s) interna(s)
                      </p>
                    )}
                  </Section>
                </div>

                {/* Datas e responsável — card próprio */}
                <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_6px_18px_rgba(25,29,51,0.04)] sm:grid-cols-3">
                  <CompactInfo
                    icon={CalendarClock}
                    label="Abertura"
                    value={formatDateTime(ticket.openedAt)}
                  />
                  <CompactInfo
                    icon={Clock3}
                    label="Última atualização"
                    value={formatDateTime(ticket.updatedAt)}
                  />
                  <CompactInfo
                    icon={UserRound}
                    label="Responsável atual"
                    value={ticket.lockedBy ? `${ticket.owner} · ${ticket.lockedBy}` : ticket.owner}
                  />
                </div>

                {/* Timeline do chamado atual — embutida */}
                <div className="mt-4">
                  <Section title="Timeline do chamado" icon={History}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12.5px] font-medium text-foreground">
                          Eventos do atendimento
                        </span>
                        <span className="text-[11.5px] font-medium text-muted-foreground">
                          ({timelineEvents.length})
                        </span>
                      </div>
                      {timelineEvents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTimelineOpen(true)}
                          className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
                        >
                          Ver completa
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="rounded-xl border border-border bg-card px-3 py-3">
                      <TicketTimelineList
                        events={timelineEvents}
                        variant="compact"
                        limit={5}
                        onEventSelect={openScheduledEvent}
                        onEventCancel={cancelScheduledEvent}
                        onEventReport={reportScheduledEvent}
                        getScheduledEventStatus={getScheduledEventStatus}
                      />
                    </div>
                  </Section>
                </div>

                <div className="h-2" />
              </div>
            </div>
            {/* fim body wrapper */}
          </div>
          {/* fim painel esquerdo */}

          {/* Painel direito — Histórico de atendimentos anteriores */}
          <TicketPastAttendancesSidePanel
            ticket={ticket}
            items={historyList}
            appointments={appointmentHistory}
            onSelect={setSelectedHistory}
            onSelectAppointment={(event) => {
              setCalendarEventAction("details");
              setSelectedCalendarEvent(event);
            }}
            onSeeAll={() => setHistoryOpen(true)}
            className="hidden max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(0,0,0,0.35)] xl:flex"
          />

          <TicketFloatingChat ticket={ticket} />
        </DialogContent>
      </Dialog>

      <CloseTicketDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        onConfirm={handleClose}
        ticket={ticket}
      />

      <TicketHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        ticket={ticket}
        historyItems={historyList}
      />

      <TicketNotesModal
        open={notesOpen}
        onOpenChange={setNotesOpen}
        notes={notes}
        protocol={ticket.protocol}
      />

      <Dialog open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Descrição original {ticket.protocol}</DialogTitle>
          <DetailModalHeader
            icon={FileText}
            title="Descrição original"
            protocol={ticket.protocol}
            onClose={() => setDescriptionOpen(false)}
          />
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
              {ticketDescription || "Descrição não informada"}
            </p>
          </div>
          <DialogFooter className="border-t border-border bg-card px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => setDescriptionOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TicketTimelineModal
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        ticket={ticket}
        events={timelineEvents}
        onEventSelect={openScheduledEvent}
        onEventCancel={cancelScheduledEvent}
        onEventReport={reportScheduledEvent}
        getScheduledEventStatus={getScheduledEventStatus}
      />

      <EventDetailsModal
        event={selectedCalendarEvent}
        open={selectedCalendarEvent !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedCalendarEvent(null);
            setCalendarEventAction("details");
          }
        }}
        initialAction={calendarEventAction}
        canCancel
        onCancelEvent={handleCancelScheduledEvent}
        onSaveReport={handleSaveScheduledReport}
        onViewTicket={() => {
          setSelectedCalendarEvent(null);
          setCalendarEventAction("details");
        }}
        hideFooterActions
      />

      <PastAttendanceDetailModal
        open={selectedHistory !== null}
        onOpenChange={(v) => !v && setSelectedHistory(null)}
        attendance={selectedHistory}
        ticket={ticket}
      />

      <ScheduleEventModal open={scheduleOpen} onOpenChange={setScheduleOpen} ticket={ticket} />

      <ForwardSpecialistModal open={forwardOpen} onOpenChange={setForwardOpen} ticket={ticket} />

      <TransferTicketModal open={transferOpen} onOpenChange={setTransferOpen} ticket={ticket} />
    </>
  );
}

function CloseTicketDialog({
  open,
  onOpenChange,
  onConfirm,
  ticket,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (payload: ClosurePayload) => void;
  ticket: SupportTicket;
}) {
  const [solution, setSolution] = useState("");
  const [hadronOption, setHadronOption] = useState("");
  const [permission, setPermission] = useState<"" | ClosurePayload["permission"]>("");
  const [type, setType] = useState<ClosurePayload["type"]>("Não definido");
  const [articleQuery, setArticleQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [relatedArticles, setRelatedArticles] = useState<string[]>([]);
  const [relatedForms, setRelatedForms] = useState<string[]>([]);
  const sla = useMemo(() => computeSla(ticket), [ticket]);
  const typeOptions: ClosurePayload["type"][] = [
    "Não definido",
    "Dúvida",
    "Configuração",
    "Atualização do Hádron",
    "Problema Hádron",
    "Problema Externo",
    "Treinamento",
    "Solicitação/Sugestão",
    "Outros",
  ];
  const formOptions = [
    "Checklist de validação fiscal",
    "Formulário de configuração",
    "Roteiro de treinamento",
    "Termo de aceite do cliente",
    "Relatório de diagnóstico",
  ];
  const articleSuggestions = kbArticlesFull
    .filter((article) =>
      `${article.title} ${article.module}`.toLowerCase().includes(articleQuery.toLowerCase()),
    )
    .filter((article) => !relatedArticles.includes(article.title))
    .slice(0, 5);
  const formSuggestions = formOptions
    .filter((form) => form.toLowerCase().includes(formQuery.toLowerCase()))
    .filter((form) => !relatedForms.includes(form));

  const reset = () => {
    setSolution("");
    setHadronOption("");
    setPermission("");
    setType("Não definido");
    setArticleQuery("");
    setFormQuery("");
    setRelatedArticles([]);
    setRelatedForms([]);
  };

  const solutionPlain = solution.replace(/<[^>]*>/g, "").trim();

  const handleSubmit = () => {
    if (!permission) {
      toast.error("Selecione uma permissão válida.");
      return;
    }
    if (!solutionPlain) {
      toast.error("Informe a mensagem de finalização.");
      return;
    }
    onConfirm({
      solution,
      type,
      hadronOption: hadronOption.trim(),
      permission,
      relatedArticles,
      relatedForms,
      addToClientHistory: true,
      generateKbArticle: false,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.('[data-rich-text-menu="true"]')) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.('[data-rich-text-menu="true"]')) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
        }}
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        className="flex w-[calc(100vw-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Finalizar chamado {ticket.protocol}</DialogTitle>

        <DetailModalHeader
          icon={CheckCircle2}
          title="Finalizar chamado"
          protocol={ticket.protocol}
          onClose={() => onOpenChange(false)}
          accentClassName="bg-success"
          iconWrapClassName="bg-success text-success-foreground"
          chips={
            <>
              <Badge
                className={cn(
                  "shrink-0 rounded-md border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide",
                  statusTone[ticket.status],
                )}
              >
                {ticket.status}
              </Badge>
              <Badge
                className={cn(
                  "shrink-0 rounded-md border px-2 py-0.5 text-[10.5px] font-medium",
                  priorityTone[ticket.priority],
                )}
              >
                Prioridade {ticket.priority}
              </Badge>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium",
                  sla.tone === "late"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : sla.tone === "warn"
                      ? "border-warning/40 bg-warning/15 text-warning-foreground"
                      : "border-border bg-muted/50 text-muted-foreground",
                )}
              >
                <CalendarClock className="h-3 w-3" />
                SLA {sla.pct}% · {sla.minutes}min
                {sla.tone === "late" && <span className="ml-1 uppercase">· vencido</span>}
              </span>
            </>
          }
          meta={
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-primary">{ticket.clientCode || "—"}</span>
              <span aria-hidden className="text-border">
                ·
              </span>
              <span className="truncate text-foreground">
                {ticket.clientName || "Cliente não vinculado"}
              </span>
            </span>
          }
        />

        {/* Body */}
        <div className="min-h-0 grid gap-4 overflow-y-auto px-4 py-5 sm:grid-cols-2 md:px-6">
          <Field label="Opção Hádron">
            <Input
              value={hadronOption}
              onChange={(event) => setHadronOption(event.target.value)}
              placeholder="Informe a opção ou rotina utilizada"
              className="h-10 rounded-lg bg-card"
            />
          </Field>
          <Field label="Permissão">
            <Select
              value={permission}
              onValueChange={(value) => setPermission(value as ClosurePayload["permission"])}
            >
              <SelectTrigger className="h-10 rounded-lg bg-card text-sm">
                <SelectValue placeholder="Permissão" />
              </SelectTrigger>
              <SelectContent>
                {(["Público", "Clientes", "Empresa"] as const).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Mensagem de finalização
            </Label>
            <RichTextEditor
              value={solution}
              onChange={setSolution}
              placeholder="Descreva a solução aplicada e as orientações finais ao cliente..."
              minHeight={160}
            />
          </div>

          <Field label="Tipo">
            <Select
              value={type}
              onValueChange={(value) => setType(value as ClosurePayload["type"])}
            >
              <SelectTrigger className="h-10 rounded-lg bg-card text-sm">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div />

          <RelatedPicker
            label="Artigos relacionados"
            query={articleQuery}
            setQuery={setArticleQuery}
            selected={relatedArticles}
            suggestions={articleSuggestions.map((article) => article.title)}
            onAdd={(item) => {
              setRelatedArticles((current) => [...current, item]);
              setArticleQuery("");
            }}
            onRemove={(item) =>
              setRelatedArticles((current) => current.filter((value) => value !== item))
            }
          />
          <RelatedPicker
            label="Opções/Formulários relacionados"
            query={formQuery}
            setQuery={setFormQuery}
            selected={relatedForms}
            suggestions={formSuggestions}
            onAdd={(item) => {
              setRelatedForms((current) => [...current, item]);
              setFormQuery("");
            }}
            onRemove={(item) =>
              setRelatedForms((current) => current.filter((value) => value !== item))
            }
          />
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2 border-t border-border bg-card px-6 py-3 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="cursor-pointer rounded-lg"
          >
            Fechar
          </Button>
          <Button onClick={handleSubmit} className="cursor-pointer rounded-lg">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Salvar e finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[12.5px] font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RelatedPicker({
  label,
  query,
  setQuery,
  selected,
  suggestions,
  onAdd,
  onRemove,
}: {
  label: string;
  query: string;
  setQuery: (value: string) => void;
  selected: string[];
  suggestions: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) {
                event.preventDefault();
                onAdd(suggestions[0] ?? query.trim());
              }
            }}
            placeholder="Buscar e adicionar..."
            className="h-10 rounded-lg bg-card"
          />
          <Button
            type="button"
            size="icon"
            disabled={!query.trim()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const item = suggestions[0] ?? query.trim();
              if (!item) return;
              onAdd(item);
            }}
            className="h-10 w-10 shrink-0 cursor-pointer rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Adicionar em ${label}`}
          >
            <Plus className="pointer-events-none h-4 w-4" />
          </Button>
        </div>
        {query.trim() && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-36 w-[calc(100%-48px)] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {suggestions.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => onAdd(item)}
                className="block w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-accent"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onRemove(item)}
              title="Remover"
              className="max-w-full cursor-pointer truncate rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/15"
            >
              {item} ×
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

const Section = forwardRef<
  HTMLElement,
  {
    title: string;
    icon: typeof Info;
    children: React.ReactNode;
    compact?: boolean;
  }
>(function Section({ title, icon: Icon, children, compact }, ref) {
  return (
    <section
      ref={ref}
      className={cn(
        "mb-3 rounded-2xl border border-border bg-card shadow-[0_6px_18px_rgba(25,29,51,0.04)]",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className={cn("mb-2 flex items-center gap-2", compact && "mb-1.5")}>
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className={cn("font-bold text-foreground", compact ? "text-[12px]" : "text-[13px]")}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
});

function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function CompactInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Info;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="truncate text-[12.5px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function sideItemClasses(highlight: boolean) {
  return cn(
    "group flex w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition",
    highlight
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "text-foreground hover:bg-accent",
  );
}

function SideItem({
  icon: Icon,
  label,
  collapsed,
  onClick,
  active,
  className,
  nowrap,
  disabled,
  title,
}: {
  icon: IconComponent;
  label: string;
  collapsed: boolean;
  onClick: () => void;
  active?: boolean;
  className?: string;
  nowrap?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? (collapsed ? label : undefined)}
      aria-label={label}
      aria-pressed={!!active}
      className={cn(
        sideItemClasses(!!active),
        collapsed && "md:justify-center md:px-0",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        className,
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors group-hover:text-primary",
          active ? "text-primary-foreground" : "text-slate-500 dark:text-slate-300",
        )}
        strokeWidth={2.35}
      />
      <span
        className={cn(collapsed && "md:hidden", nowrap ? "min-w-0 whitespace-nowrap" : "truncate")}
        style={nowrap ? { overflow: "visible", textOverflow: "clip" } : undefined}
      >
        {label}
      </span>
    </button>
  );
}

function MobileAction({
  icon: Icon,
  label,
  onClick,
  highlight,
  disabled,
  title,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  highlight?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition",
        disabled && "cursor-not-allowed opacity-50",
        highlight
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-card text-foreground hover:bg-accent",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          highlight ? "text-primary-foreground" : "text-slate-500 dark:text-slate-300",
        )}
        strokeWidth={2.35}
      />
      <span>{label}</span>
    </button>
  );
}

function TicketTimelineInline({ events }: { events: TicketEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-6 text-center text-[12px] text-muted-foreground">
        Nenhum evento registrado ainda.
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 rounded-xl border border-border bg-card px-3 py-3">
      {events.map((ev, i) => {
        const Icon = timelineIcon[ev.kind];
        const isLast = i === events.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                  timelineTone[ev.kind],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[12.5px] font-medium text-foreground">{ev.actor}</span>
                <span className="text-[11px] text-muted-foreground">{formatDateTime(ev.when)}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {ev.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TicketPastAttendancesSidePanel({
  ticket,
  items,
  appointments,
  onSelect,
  onSelectAppointment,
  onSeeAll,
  className,
}: {
  ticket: SupportTicket;
  items: PastAttendance[];
  appointments: CalendarEvent[];
  onSelect: (item: PastAttendance) => void;
  onSelectAppointment: (event: CalendarEvent) => void;
  onSeeAll: () => void;
  className?: string;
}) {
  return (
    <aside className={cn("flex min-h-0 flex-col bg-card", className)}>
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium text-foreground">Histórico</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-[11px] text-muted-foreground">
              Cliente {ticket.clientCode || "—"}
            </p>
            <Badge
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                statusTone[ticket.status],
              )}
            >
              {ticket.status}
            </Badge>
          </div>
        </div>
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center text-muted-foreground"
        >
          <History className="h-3.5 w-3.5" />
        </span>
      </header>

      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-medium text-foreground">Atendimentos</span>
          <span className="text-[11px] font-medium text-muted-foreground">({items.length})</span>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
          >
            Ver todos ({items.length})
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "modal-scrollbar flex-1 min-h-0 space-y-4 overflow-y-auto bg-muted/20 px-3 py-3",
        )}
      >
        {items.length === 0 && appointments.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted-foreground">
            Sem atendimentos ou agendamentos anteriores.
          </p>
        ) : (
          <>
            {items.length > 0 && (
              <TicketHistoryList items={items.slice(0, 5)} onSelect={onSelect} timeline />
            )}

            <section>
              <div className="mb-2 flex items-baseline gap-1.5 border-t border-border pt-3">
                <span className="text-[12px] font-medium text-foreground">Agendamentos</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  ({appointments.length})
                </span>
              </div>
              {appointments.length === 0 ? (
                <p className="rounded-lg border border-border bg-card px-3 py-5 text-center text-[11px] text-muted-foreground">
                  Sem agendamentos concluídos ou cancelados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {appointments.slice(0, 5).map((event) => {
                    const eventDate = new Date(`${event.date}T${event.time || "00:00"}:00`);
                    const cancelled = event.status === "Cancelado";
                    return (
                      <li key={String(event.id)}>
                        <button
                          type="button"
                          onClick={() => onSelectAppointment(event)}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary/35 hover:bg-primary/[0.03]"
                        >
                          <span
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                              cancelled
                                ? "bg-destructive/10 text-destructive"
                                : "bg-success/10 text-success",
                            )}
                          >
                            <CalendarClock className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11.5px] font-medium text-foreground">
                              {event.title}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {eventDate.toLocaleDateString("pt-BR")} às {event.time.slice(0, 5)}
                            </span>
                          </span>
                          <Badge
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium",
                              cancelled
                                ? "border-destructive/20 bg-destructive/10 text-destructive"
                                : "border-success/20 bg-success/10 text-success",
                            )}
                          >
                            {event.status}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
