import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUp, ChevronDown, Minus, Plus, Repeat, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useOperatorAcronyms } from "@/lib/collaborators-store";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { getTransferBlockReason, ticketsStore } from "@/lib/tickets-store";
import { cn } from "@/lib/utils";
import { computeSla } from "@/lib/ticket-sla";
import {
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support-tickets-data";
import { kbArticlesFull } from "@/lib/kb-data";
import { CalendarClock } from "lucide-react";
import { CorrectionHint } from "@/components/ui/smart-text";
import { useSpellCorrection } from "@/lib/spellcheck";

type TransferType = "Transferir";
const PERMISSIONS = ["Público", "Clientes", "Empresa"] as const;

const HADRON_OPTIONS = [
  "Vendas › NFE › Emissão",
  "Vendas › NFE › Cancelamento",
  "Vendas › Pedidos › Faturamento",
  "Fiscal › SPED › Geração",
  "Fiscal › Apuração › ICMS",
  "Financeiro › Contas a Pagar › Baixa",
  "Financeiro › Contas a Receber › Cobrança",
  "Estoque › Movimentação › Entrada",
  "Estoque › Inventário › Contagem",
  "Básico › Terceiros › Cadastro",
  "Básico › Produtos › Cadastro",
  "Hadron Web › Portal › Integrações",
];

const FORM_OPTIONS = [
  "Checklist de validação fiscal",
  "Formulário de configuração",
  "Roteiro de treinamento",
  "Termo de aceite do cliente",
  "Relatório de diagnóstico",
];

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
  Media: "bg-warning/16 text-warning-foreground border-warning/30",
  Baixa: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_OPTIONS: {
  value: TicketPriority;
  label: string;
  icon: typeof ArrowUp;
  baseClass: string;
  activeClass: string;
  iconWrapClass: string;
  textClass: string;
}[] = [
  {
    value: "Baixa",
    label: "Baixa",
    icon: ChevronDown,
    baseClass: "border-success/25 bg-success/10 dark:bg-success/15",
    activeClass:
      "border-success/70 ring-2 ring-success/40 shadow-sm bg-success/15 dark:bg-success/20",
    iconWrapClass: "bg-success text-success-foreground",
    textClass: "text-success",
  },
  {
    value: "Media",
    label: "Média",
    icon: Minus,
    baseClass: "border-warning/30 bg-warning/12 dark:bg-warning/15",
    activeClass:
      "border-warning/70 ring-2 ring-warning/40 shadow-sm bg-warning/20 dark:bg-warning/25",
    iconWrapClass: "bg-warning text-warning-foreground",
    textClass: "text-warning-foreground",
  },
  {
    value: "Alta",
    label: "Alta",
    icon: ArrowUp,
    baseClass: "border-destructive/25 bg-destructive/10 dark:bg-destructive/15",
    activeClass:
      "border-destructive/70 ring-2 ring-destructive/40 shadow-sm bg-destructive/15 dark:bg-destructive/20",
    iconWrapClass: "bg-destructive text-destructive-foreground",
    textClass: "text-destructive",
  },
];

function PrioritySegmented({
  value,
  onChange,
}: {
  value: TicketPriority;
  onChange: (v: TicketPriority) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-3 gap-2">
      {PRIORITY_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border text-xs font-medium transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              opt.baseClass,
              active && opt.activeClass,
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                opt.iconWrapClass,
              )}
            >
              <Icon className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className={cn("font-medium", opt.textClass)}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const preventOutsideClose = (event: Event) => event.preventDefault();

export function TransferTicketModal({
  open,
  onOpenChange,
  ticket,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  ticket: SupportTicket;
}) {
  const sla = useMemo(() => computeSla(ticket), [ticket]);
  const blockReason = getTransferBlockReason(ticket);

  useEffect(() => {
    if (open && blockReason) {
      toast.error(blockReason);
      onOpenChange(false);
    }
  }, [open, blockReason, onOpenChange]);

  const [hadronOption, setHadronOption] = useState("");
  const [hadronQuery, setHadronQuery] = useState("");
  const [permission, setPermission] = useState<(typeof PERMISSIONS)[number]>("Clientes");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [message, setMessage] = useState("");
  const messageCorrection = useSpellCorrection({ value: message, onChange: setMessage });
  const type: TransferType = "Transferir";
  const [operatorQuery, setOperatorQuery] = useState("");
  const [operator, setOperator] = useState("");
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [articleQuery, setArticleQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [relatedArticles, setRelatedArticles] = useState<string[]>([]);
  const [relatedForms, setRelatedForms] = useState<string[]>([]);

  const operatorAcronyms = useOperatorAcronyms();
  const needsOperator = true;

  const availableOperators = operatorAcronyms.filter((op) => op !== ticket.owner);
  const filteredOperators = availableOperators.filter((op) =>
    op.toLowerCase().includes(operatorQuery.toLowerCase()),
  );

  const hadronSuggestions = HADRON_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(hadronQuery.toLowerCase()),
  ).slice(0, 6);

  const articleSuggestions = kbArticlesFull
    .filter((a) => `${a.title} ${a.module}`.toLowerCase().includes(articleQuery.toLowerCase()))
    .filter((a) => !relatedArticles.includes(a.title))
    .slice(0, 5)
    .map((a) => a.title);

  const formSuggestions = FORM_OPTIONS.filter((form) =>
    form.toLowerCase().includes(formQuery.toLowerCase()),
  ).filter((form) => !relatedForms.includes(form));

  const reset = () => {
    setHadronOption("");
    setHadronQuery("");
    setPermission("Clientes");
    setPriority(ticket.priority);
    setMessage("");
    setOperatorQuery("");
    setOperator("");
    setOperatorOpen(false);
    setArticleQuery("");
    setFormQuery("");
    setRelatedArticles([]);
    setRelatedForms([]);
  };

  const submit = () => {
    const reason = getTransferBlockReason(ticket);
    if (reason) {
      toast.error(reason);
      onOpenChange(false);
      return;
    }
    if (needsOperator && !operator) {
      toast.error("Selecione o operador de destino.");
      return;
    }
    if (needsOperator && operator === ticket.owner) {
      toast.error("Escolha um operador diferente do atual responsável.");
      return;
    }
    if (!message.trim()) {
      toast.error("Informe a mensagem de transferência.");
      return;
    }
    try {
      ticketsStore.transferTicket(ticket.id, {
        toOperator: operator,
        type,
        message: message.trim(),
        priority,
        permission,
        hadronOption: hadronOption.trim(),
        relatedArticles,
        relatedForms,
      });
      toast.success("Chamado transferido", {
        description: `Novo responsável: ${operator}`,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      const description = error instanceof Error ? error.message : "";
      toast.error(
        description.startsWith("Não é possível transferir")
          ? description
          : "Não foi possível transferir o chamado. Tente novamente.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={preventOutsideClose}
        onInteractOutside={preventOutsideClose}
        onEscapeKeyDown={preventOutsideClose}
        style={{ maxHeight: "min(94svh, calc(100dvh - 1.5rem))" }}
        className="flex w-[calc(100vw-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Transferir chamado {ticket.protocol}</DialogTitle>

        <DetailModalHeader
          icon={Repeat}
          title={ticket.clientName || "Cliente não vinculado"}
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
              <span className="truncate text-foreground">Transferir chamado</span>
              <span aria-hidden className="text-border">·</span>
              <span className="font-semibold text-primary">{ticket.clientCode || "—"}</span>
            </span>
          }
        />

        {/* Body */}
        <div className="grid min-h-0 gap-x-4 gap-y-2.5 overflow-y-auto px-4 py-3 sm:grid-cols-2 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Field label="Opção Hádron">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={hadronOption}
                onChange={(e) => {
                  setHadronOption(e.target.value);
                  setHadronQuery(e.target.value);
                }}
                placeholder="Pesquise uma opção do Hádron..."
                className="h-9 rounded-lg bg-card pl-8"
              />
              {hadronQuery.trim() &&
                hadronSuggestions.length > 0 &&
                hadronSuggestions[0] !== hadronOption && (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {hadronSuggestions.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => {
                          setHadronOption(opt);
                          setHadronQuery("");
                        }}
                        className="block w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-accent"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </Field>

          <Field label="Permissão">
            <Select
              value={permission}
              onValueChange={(value) => setPermission(value as (typeof PERMISSIONS)[number])}
            >
              <SelectTrigger className="h-9 w-full cursor-pointer rounded-lg bg-card text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Prioridade">
            <PrioritySegmented value={priority} onChange={setPriority} />
          </Field>

          <Field label="Tipo" required>
            <Select value={type} disabled>
              <SelectTrigger className="h-9 w-full cursor-not-allowed rounded-lg bg-muted/50 text-sm opacity-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Transferir">Transferir</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {needsOperator && (
            <Field label="Operador" required>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={operator || operatorQuery}
                  onChange={(e) => {
                    setOperator("");
                    setOperatorQuery(e.target.value);
                    setOperatorOpen(true);
                  }}
                  onFocus={() => setOperatorOpen(true)}
                  onBlur={() => setTimeout(() => setOperatorOpen(false), 150)}
                  placeholder="Buscar operador (sigla PRC)..."
                  className="h-9 rounded-lg bg-card pl-8"
                />
                {operatorOpen && filteredOperators.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {filteredOperators.map((op) => (
                      <button
                        type="button"
                        key={op}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setOperator(op);
                          setOperatorQuery("");
                          setOperatorOpen(false);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-accent"
                      >
                        <span className="font-mono font-semibold text-primary">{op}</span>
                        <span className="text-muted-foreground">Operador Procion</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {operator && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Selecionado:{" "}
                  <span className="font-mono font-semibold text-primary">{operator}</span>
                </p>
              )}
            </Field>
          )}
          {!needsOperator && <div />}

          <div className="sm:col-span-2">
            <Label className="mb-1 block text-[12px] font-medium text-foreground">
              Mensagem de transferência <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                messageCorrection.notifyTyping(e);
              }}
              onBlur={() => messageCorrection.runNow()}
              rows={3}
              maxLength={1000}
              placeholder="Registre o motivo da transferência e as orientações ao próximo operador..."
              className="min-h-[72px] w-full resize-y rounded-lg border border-input bg-card p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <CorrectionHint
              correcting={messageCorrection.correcting}
              corrected={messageCorrection.corrected}
              onUndo={messageCorrection.undo}
            />
          </div>

          <RelatedPicker
            label="Artigos relacionados"
            query={articleQuery}
            setQuery={setArticleQuery}
            selected={relatedArticles}
            suggestions={articleSuggestions}
            onAdd={(item) => {
              if (!relatedArticles.includes(item)) {
                setRelatedArticles((cur) => [...cur, item]);
              }
              setArticleQuery("");
            }}
            onRemove={(item) => setRelatedArticles((cur) => cur.filter((v) => v !== item))}
          />
          <RelatedPicker
            label="Opções/Formulários relacionados"
            query={formQuery}
            setQuery={setFormQuery}
            selected={relatedForms}
            suggestions={formSuggestions}
            onAdd={(item) => {
              if (!relatedForms.includes(item)) {
                setRelatedForms((cur) => [...cur, item]);
              }
              setFormQuery("");
            }}
            onRemove={(item) => setRelatedForms((cur) => cur.filter((v) => v !== item))}
          />
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-card px-6 py-2.5 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 cursor-pointer rounded-lg"
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={Boolean(blockReason)}
            className="h-9 cursor-pointer rounded-lg"
          >
            <Repeat className="mr-1.5 h-4 w-4" />
            Transferir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
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
      <Label className="mb-1 block text-[12px] font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
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
            className="h-9 rounded-lg bg-card"
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
            className="h-9 w-9 shrink-0 cursor-pointer rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/15"
            >
              <span className="truncate">{item}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
