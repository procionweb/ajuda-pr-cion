import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  Boxes,
  CalendarClock,
  Calculator,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Cog,
  FileText,
  Folder,
  Globe,
  Headphones,
  Layers,
  MessageSquare,
  ReceiptText,
  Settings2,
  Shield,
  Sparkles,
  Tag,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { useClients } from "@/lib/clients-store";
import { snapshotCurrentChamadosForTicket } from "@/lib/return-to-ticket";
import type { SupportTicket, TicketPriority } from "@/lib/support-tickets-data";
import {
  useTicketEvents,
  type PastAttendance,
  type TicketEvent,
} from "@/lib/tickets-store";
import { TicketTimelineList } from "./TicketTimelineList";

function getModuleIconByName(module: string): typeof FileText {
  const m = (module ?? "").toLowerCase();
  if (/financ|caixa|banco|boleto|pagar|receber|carteira/.test(m)) return Wallet;
  if (/nfe|nota|fiscal.*(nota|nfe|nfc|cfe)|venda/.test(m)) return ReceiptText;
  if (/estoque|invent|produto|mercadoria/.test(m)) return Boxes;
  if (/basico|terceiros|cadastro|parametr/.test(m)) return Settings2;
  if (/fiscal|apura|sped|imposto/.test(m)) return Calculator;
  if (/hadron|web|portal/.test(m)) return Globe;
  if (/produ[cç][aã]o|manufatur/.test(m)) return Cog;
  if (/log[ií]stic|transporte|entrega/.test(m)) return Truck;
  if (/seguran[cç]a|acesso|permiss/.test(m)) return Shield;
  return FileText;
}

const priorityChip: Record<TicketPriority, string> = {
  Alta: "bg-destructive/12 text-destructive border-destructive/25",
  Media:
    "bg-[#fff4d1] text-[#8a6300] border-[#f2d97a] dark:bg-[#3a2f10] dark:text-[#f3d66d] dark:border-[#5c4a1c]",
  Baixa:
    "bg-[#eaf4ff] text-[#246cb5] border-[#bfdcff] dark:bg-[#17314e] dark:text-[#9dcaff] dark:border-[#24527d]",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addMinutes(iso: string, minutes: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1)
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

const CHANNELS = ["Telefone", "Portal do cliente", "WhatsApp", "Email"] as const;
const CATEGORIES = [
  "Dúvida operacional",
  "Erro do sistema",
  "Configuração fiscal",
  "Cadastro / parâmetros",
  "Integração",
  "Relatório",
];

const PROBLEM_TEMPLATES = [
  "Cliente relatou divergência ao gerar o arquivo. Foram anexados prints e log da operação para análise.",
  "Ao executar a rotina, o sistema apresentou mensagem de erro impedindo a continuidade do processo.",
  "Cliente informou que o cadastro não estava refletindo corretamente nas movimentações subsequentes.",
  "Registro solicitado não aparecia no relatório mesmo após a inclusão. Cliente pediu conferência dos parâmetros.",
];

const SOLUTION_TEMPLATES = [
  "Foi realizada a conferência dos parâmetros fiscais e orientado o cliente sobre a correção do cadastro. Após ajuste, o SPED foi gerado com sucesso.",
  "Identificada configuração divergente no cadastro. Após correção junto ao cliente, a rotina passou a executar normalmente.",
  "Orientado o cliente quanto ao fluxo correto do módulo. Realizado teste em conjunto e processo concluído sem erros.",
  "Aplicado ajuste nos parâmetros e reprocessado o movimento. Cliente validou o resultado e aprovou o encerramento.",
];

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

function plainText(value: string) {
  if (typeof document === "undefined") return value.replace(/<[^>]*>/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent || element.innerText || "").trim();
}

function getClosureSolution(events: TicketEvent[]) {
  const closedEvent = [...events]
    .reverse()
    .find(
      (event) =>
        event.kind === "closed" &&
        event.description.trim().toLowerCase().startsWith("chamado finalizado por"),
    );
  if (!closedEvent) return "Solução não informada.";

  const separator = closedEvent.description.indexOf(". ");
  if (separator < 0) return "Solução não informada.";
  return plainText(closedEvent.description.slice(separator + 2)) || "Solução não informada.";
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export function PastAttendanceDetailModal({
  open,
  onOpenChange,
  attendance,
  ticket,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendance: PastAttendance | null;
  ticket: SupportTicket | null;
}) {
  const recordedEvents = useTicketEvents(attendance?.id);
  const { clients } = useClients({ onlyActive: false });
  if (!attendance) return null;

  const client = ticket
    ? clients.find((item) => {
        const candidates = [ticket.clientCode, ticket.clientName]
          .map((value) => value?.trim().toLowerCase())
          .filter(Boolean);
        return candidates.some(
          (value) => item.id.toLowerCase() === value || item.acronym.toLowerCase() === value,
        );
      })
    : null;
  const clientName = ticket?.clientName || attendance.title;

  const h = hashString(attendance.id);
  const channel = CHANNELS[h % CHANNELS.length];
  const category = CATEGORIES[h % CATEGORIES.length];
  const fallbackDurationMinutes = 30 + (h % 240);
  const closedAt = attendance.closedAt || addMinutes(attendance.date, fallbackDurationMinutes);
  const openedTime = new Date(attendance.date).getTime();
  const closedTime = new Date(closedAt).getTime();
  const startedTime = attendance.attendanceStartedAt
    ? new Date(attendance.attendanceStartedAt).getTime()
    : Number.NaN;
  const durationMinutes = Math.max(0, Math.round((closedTime - openedTime) / 60000));
  const waitingMinutes = Number.isFinite(startedTime)
    ? Math.max(0, Math.round((startedTime - openedTime) / 60000))
    : null;
  const attendanceMinutes = Number.isFinite(attendance.attendanceElapsedSeconds)
    ? Math.max(0, Math.round((attendance.attendanceElapsedSeconds ?? 0) / 60))
    : Number.isFinite(startedTime)
      ? Math.max(0, Math.round((closedTime - startedTime) / 60000))
      : null;
  const problem = plainText(attendance.description?.trim() || "") || "Descrição não informada.";
  const solution = getClosureSolution(recordedEvents);
  const ModuleIcon = getModuleIconByName(attendance.module);

  const fallbackTimelineEvents: TicketEvent[] = [
    {
      id: `${attendance.id}-evt-created`,
      kind: "created",
      when: attendance.date,
      actor: "Cliente",
      actorType: "cliente",
      description: `Chamado aberto pelo cliente — ${attendance.title}.`,
    },
    {
      id: `${attendance.id}-evt-assumed`,
      kind: "assumed",
      when: addMinutes(attendance.date, Math.max(5, Math.floor(durationMinutes * 0.08))),
      actor: attendance.operator,
      actorType: "suporte",
      description: `${attendance.operator} assumiu o atendimento.`,
    },
    {
      id: `${attendance.id}-evt-attend`,
      kind: "attend",
      when: addMinutes(attendance.date, Math.max(10, Math.floor(durationMinutes * 0.15))),
      actor: attendance.operator,
      actorType: "suporte",
      description: "Atendimento iniciado e análise do problema em andamento.",
    },
    {
      id: `${attendance.id}-evt-solution`,
      kind: "solution",
      when: addMinutes(attendance.date, Math.max(20, Math.floor(durationMinutes * 0.8))),
      actor: attendance.operator,
      actorType: "suporte",
      description: solution,
    },
    {
      id: `${attendance.id}-evt-closed`,
      kind: "closed",
      when: closedAt,
      actor: attendance.operator,
      actorType: "suporte",
      description: "Chamado finalizado após validação com o cliente.",
    },
  ];

  const timelineEvents = recordedEvents.length > 0 ? recordedEvents : fallbackTimelineEvents;

  const copySolution = async () => {
    try {
      await navigator.clipboard.writeText(solution);
      toast.success("Solução copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 !overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:w-[calc(100vw-2rem)] md:w-[880px] lg:w-[960px] [&>button]:hidden">
        <DialogTitle className="sr-only">
          Detalhes do atendimento {attendance.protocol}
        </DialogTitle>

        <DetailModalHeader
          icon={ModuleIcon}
          title={
            client && ticket ? (
              <Link
                to="/clientes/$clienteId"
                params={{ clienteId: client.id }}
                search={{ tab: "cliente", from: "chamado", ticketId: ticket.id }}
                onClick={() => snapshotCurrentChamadosForTicket(ticket.id)}
                className="cursor-pointer rounded-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Ver detalhes do cliente"
              >
                {clientName}
              </Link>
            ) : (
              clientName
            )
          }
          protocol={attendance.protocol}
          onClose={() => onOpenChange(false)}
          chips={
            <>
              <Badge className="rounded-md border border-success/25 bg-success/12 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-success">
                Finalizado
              </Badge>
              <Badge
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide",
                  priorityChip[attendance.priority],
                )}
              >
                {attendance.priority}
              </Badge>
            </>
          }
          meta={
            <>
              {ticket && (
                <span className="inline-flex items-center gap-1">
                  <span className="truncate text-foreground">Detalhes do atendimento</span>
                  <span aria-hidden className="text-border">·</span>
                  <span className="font-semibold text-primary">{ticket.clientCode}</span>
                </span>
              )}
              <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">
                  {formatDateTime(attendance.date)}
                </span>
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{attendance.operator}</span>
              </span>
            </>
          }
        />



        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto bg-card px-4 py-5 md:px-6">
          {/* Info grid */}
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Dados do atendimento
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={Folder} label="Módulo" value={attendance.module} />
              <InfoRow icon={Tag} label="Categoria" value={category} />
              <InfoRow icon={Headphones} label="Canal de origem" value={channel} />
              <InfoRow
                icon={CalendarClock}
                label="Data de abertura"
                value={formatDateTime(attendance.date)}
              />
              <InfoRow
                icon={CheckCircle2}
                label="Data de finalização"
                value={formatDateTime(closedAt)}
              />
              <InfoRow
                icon={Clock}
                label="Tempo total"
                value={formatDuration(durationMinutes)}
              />
              <InfoRow
                icon={Clock}
                label="Tempo para iniciar atendimento"
                value={waitingMinutes === null ? "Não informado" : formatDuration(waitingMinutes)}
              />
              <InfoRow
                icon={Clock}
                label="Tempo de atendimento até finalizar"
                value={
                  attendanceMinutes === null
                    ? "Não informado"
                    : formatDuration(attendanceMinutes)
                }
              />
              <InfoRow
                icon={UserRound}
                label="Atendente responsável"
                value={attendance.operator}
              />
              <InfoRow
                icon={Users}
                label="Solicitante"
                value={attendance.contact || "Não informado"}
              />
              <InfoRow icon={Layers} label="Prioridade" value={attendance.priority} />
              <InfoRow icon={FileText} label="Protocolo" value={attendance.protocol} />
            </div>
          </section>

          {/* Problema */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[12.5px] font-medium uppercase tracking-wider text-foreground">
                Descrição do problema
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {problem}
            </p>
          </section>

          {/* Solução — destaque */}
          <section className="relative overflow-hidden rounded-xl border border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <span
              aria-hidden
              className="absolute left-0 top-0 h-full w-1 bg-success"
            />
            <div className="mb-2 flex items-center justify-between gap-2 pl-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-success" />
                <h3 className="text-[12.5px] font-medium uppercase tracking-wider text-success">
                  Solução aplicada
                </h3>
              </div>
              <button
                type="button"
                onClick={copySolution}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-success/30 bg-card px-2 py-1 text-[11px] font-medium text-success transition hover:bg-success/10"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
            <p className="pl-2 text-[13.5px] font-medium leading-relaxed text-foreground">
              {solution}
            </p>
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-[12.5px] font-medium uppercase tracking-wider text-foreground">
              Timeline
            </h3>
            <TicketTimelineList events={timelineEvents} variant="compact" />
          </section>
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={copySolution}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:bg-muted"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copiar solução
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Fechar
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
