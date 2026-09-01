import { useMemo, useState, type ReactNode } from "react";
import { ArrowUp, Check, ChevronDown, Minus, Search, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { ticketsStore } from "@/lib/tickets-store";
import { cn } from "@/lib/utils";
import type { SupportTicket, TicketPriority } from "@/lib/support-tickets-data";
import { modulesMap, moduleOptions, splitModule } from "@/lib/modules-map";
import { cvsArticles } from "@/lib/cvs-catalogs-imported";
import {
  normalizeSearch,
  searchHadronForms,
  searchHadronOptions,
  type HadronOption,
} from "@/lib/hadron-options";
import { CorrectionHint } from "@/components/ui/smart-text";
import { useSpellCorrection } from "@/lib/spellcheck";

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

const TYPES = [
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
const PERMISSIONS = ["Público", "Clientes", "Empresa"];
const AREAS = [
  "Ag. Comercial",
  "Ag. Financeiro",
  "Ag. Administrativo",
  "Ag. Desenvolvimento",
  "Ag. Web",
];
const preventOutsideClose = (event: Event) => event.preventDefault();

type ForwardSpecialistModalProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  ticket: SupportTicket;
};

/**
 * Wrapper que garante formulário novo a cada abertura e a cada troca de
 * chamado/cliente: o conteúdo é desmontado ao fechar e remontado por `key`.
 */
export function ForwardSpecialistModal(props: ForwardSpecialistModalProps) {
  if (!props.open) return null;
  return (
    <ForwardSpecialistModalContent
      key={`${props.ticket.id}:${props.ticket.clientCode}`}
      {...props}
    />
  );
}

function ForwardSpecialistModalContent({
  open,
  onOpenChange,
  ticket,
}: ForwardSpecialistModalProps) {
  const defaults = useMemo(() => splitModule(ticket.module), [ticket.module]);
  const [permission, setPermission] = useState("Clientes");
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [type, setType] = useState(TYPES[0]);
  const [waitingArea, setWaitingArea] = useState("Ag. Desenvolvimento");
  const [module, setModule] = useState(defaults.module);
  const [submodule, setSubmodule] = useState(defaults.submodule);
  const [reason, setReason] = useState("");
  const reasonCorrection = useSpellCorrection({ value: reason, onChange: setReason });
  const [hadronOptionQuery, setHadronOptionQuery] = useState("");
  const [hadronOption, setHadronOption] = useState<HadronOption | null>(null);
  const [articleQuery, setArticleQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [relatedArticles, setRelatedArticles] = useState<string[]>([]);
  const [relatedForms, setRelatedForms] = useState<string[]>([]);

  const availableSubs = modulesMap[module] ?? [];
  const optionSuggestions = useMemo(
    () => searchHadronOptions(hadronOptionQuery),
    [hadronOptionQuery],
  );
  const articleSuggestions = useMemo(() => {
    const query = normalizeSearch(articleQuery);
    if (!query) return [];
    return cvsArticles
      .filter((article) => article.status === "1")
      .filter((article) => normalizeSearch(`${article.id} ${article.title}`).includes(query))
      .slice(0, 10)
      .map((article) => article.title);
  }, [articleQuery]);
  const formSuggestions = useMemo(
    () => searchHadronForms(formQuery).map((option) => option.label),
    [formQuery],
  );

  const changeModule = (value: string) => {
    setModule(value);
    const subs = modulesMap[value] ?? [];
    if (!subs.includes(submodule)) {
      setSubmodule(subs[0] ?? "");
    }
  };

  const reset = () => {
    setPermission("Clientes");
    setPriority(ticket.priority);
    setType(TYPES[0]);
    setWaitingArea("Ag. Desenvolvimento");
    setModule(defaults.module);
    setSubmodule(defaults.submodule);
    setReason("");
    setHadronOptionQuery("");
    setHadronOption(null);
    setArticleQuery("");
    setFormQuery("");
    setRelatedArticles([]);
    setRelatedForms([]);
  };
  const submit = () => {
    if (ticket.status === "Finalizado") {
      toast.error("Chamado finalizado não pode ser enviado a um especialista.");
      return;
    }
    if (!module || !submodule) {
      toast.error("Selecione módulo e submódulo.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe a mensagem para o especialista.");
      return;
    }
    ticketsStore.forwardToSpecialist(ticket.id, {
      waitingArea,
      reason: reason.trim(),
      permission,
      priority,
      type,
      module,
      submodule,
      hadronOption: hadronOption?.label || "",
      relatedArticles,
      relatedForms,
    });
    toast.success("Chamado enviado para a fila de especialistas", {
      description: `${waitingArea} · ${module} / ${submodule}`,
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
        <DialogTitle className="sr-only">
          Enviar chamado {ticket.protocol} a especialista
        </DialogTitle>
        <DetailModalHeader
          dense
          icon={UserCheck}
          title={ticket.clientName || "Cliente não vinculado"}
          protocol={ticket.protocol}
          onClose={() => onOpenChange(false)}
          meta={
            <span className="inline-flex items-center gap-1">
              <span className="truncate text-foreground">Enviar a especialista</span>
              <span className="text-border">·</span>
              <span className="text-primary">{ticket.clientCode}</span>
            </span>
          }
        />
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-3 md:px-6">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tipo">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 w-full cursor-pointer text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Área de espera">
              <Select value={waitingArea} onValueChange={setWaitingArea}>
                <SelectTrigger className="h-9 w-full cursor-pointer text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Permissão">
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger className="h-9 w-full cursor-pointer text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prioridade">
              <PrioritySegmented value={priority} onChange={setPriority} />
            </Field>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Módulo" required>
              <Select value={module} onValueChange={changeModule}>
                <SelectTrigger className="h-9 w-full cursor-pointer text-[13px]">
                  <SelectValue />
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
                <SelectTrigger className="h-9 w-full cursor-pointer text-[13px]">
                  <SelectValue />
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
          <HadronOptionPicker
            query={hadronOptionQuery}
            onQuery={(value) => {
              setHadronOption(null);
              setHadronOptionQuery(value);
            }}
            selected={hadronOption}
            suggestions={optionSuggestions}
            onSelect={(option) => {
              setHadronOption(option);
              setHadronOptionQuery(option.label);
            }}
          />
          <Field label="Mensagem para o especialista" required>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                reasonCorrection.notifyTyping(e);
              }}
              onBlur={() => reasonCorrection.runNow()}
              rows={2}
              maxLength={1000}
              placeholder="Descreva o diagnóstico, testes realizados e o que precisa ser analisado..."
              className="min-h-[60px] w-full resize-none rounded-md border border-input bg-background p-2.5 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
            <CorrectionHint
              correcting={reasonCorrection.correcting}
              corrected={reasonCorrection.corrected}
              onUndo={reasonCorrection.undo}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <RelatedPicker
              label="Artigos relacionados"
              query={articleQuery}
              onQuery={setArticleQuery}
              selected={relatedArticles}
              onSelected={setRelatedArticles}
              suggestions={articleSuggestions}
            />
            <RelatedPicker
              label="Formulários relacionados"
              query={formQuery}
              onQuery={setFormQuery}
              selected={relatedForms}
              onSelected={setRelatedForms}
              suggestions={formSuggestions}
            />
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            O chamado será encaminhado para a fila de especialistas. O responsável será definido
            posteriormente pelo backend.
          </p>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-card px-5 py-2.5 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancelar
          </Button>
          <Button onClick={submit} className="cursor-pointer">
            <UserCheck className="mr-1.5 h-4 w-4" />
            Enviar a especialista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelatedPicker({
  label,
  query,
  onQuery,
  selected,
  onSelected,
  suggestions,
}: {
  label: string;
  query: string;
  onQuery: (value: string) => void;
  selected: string[];
  onSelected: (value: string[]) => void;
  suggestions: string[];
}) {
  const add = (value: string) => {
    if (!value || selected.includes(value)) return;
    onSelected([...selected, value]);
    onQuery("");
  };
  return (
    <div>
      <Label className="mb-1 block text-[12.5px] font-medium">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={`Buscar ${label.toLocaleLowerCase("pt-BR")}`}
          className="pl-9"
        />
        {query.trim() && (
          <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {suggestions.length ? (
              suggestions.map((item) => (
                <button
                  type="button"
                  key={item}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(item)}
                  className="flex w-full cursor-pointer items-center rounded px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-accent"
                >
                  {item}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-3 text-xs text-muted-foreground">
                Nenhum resultado encontrado.
              </p>
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-1.5 max-h-[64px] overflow-y-auto rounded-md pr-0.5">
          <div className="flex flex-wrap gap-1">
            {selected.map((item) => (
              <button
                type="button"
                key={item}
                title={item}
                onClick={() => onSelected(selected.filter((value) => value !== item))}
                className="inline-flex max-w-[220px] cursor-pointer items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10.5px] leading-tight text-primary"
              >
                <span className="truncate">{item}</span>
                <X className="h-2.5 w-2.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HadronOptionPicker({
  query,
  onQuery,
  selected,
  suggestions,
  onSelect,
}: {
  query: string;
  onQuery: (value: string) => void;
  selected: HadronOption | null;
  suggestions: HadronOption[];
  onSelect: (option: HadronOption) => void;
}) {
  return (
    <Field label="Opção do Hádron">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 z-10 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar por código ou nome da opção"
          className="pl-9 pr-9"
        />
        {selected && <Check className="absolute right-3 top-2.5 h-4 w-4 text-success" />}
        {!selected && query.trim() && (
          <div className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {suggestions.length ? (
              suggestions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                  className="block w-full cursor-pointer rounded px-3 py-2 text-left hover:bg-accent"
                >
                  <span className="block text-xs font-medium text-popover-foreground">
                    {option.description}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {option.option} - {option.form || option.option}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
            )}
          </div>
        )}
      </div>
    </Field>
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
      <Label className="mb-1 block text-[12.5px] font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
