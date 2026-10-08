import { useEffect, useState } from "react";
import { MessageSquarePlus, Plus, X, ArrowUp, ChevronDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { ticketsStore, type ClosurePayload } from "@/lib/tickets-store";
import type { SupportTicket } from "@/lib/support-tickets-data";
import { cvsArticles } from "@/lib/cvs-catalogs-imported";
import { normalizeSearch, searchHadronForms, searchHadronOptions } from "@/lib/hadron-options";
import { cn } from "@/lib/utils";

const priorityOptions: {
  value: SupportTicket["priority"];
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

const types: ClosurePayload["type"][] = [
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

export function ManualTicketTimelineModal({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: SupportTicket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [hadronOption, setHadronOption] = useState("");
  const [hadronSearching, setHadronSearching] = useState(false);
  const [permission, setPermission] = useState<ClosurePayload["permission"]>("Clientes");
  const [priority, setPriority] = useState<SupportTicket["priority"]>(ticket.priority);
  const [type, setType] = useState<ClosurePayload["type"]>("Não definido");
  const [articles, setArticles] = useState<string[]>([]);
  const [forms, setForms] = useState<string[]>([]);
  const [articleQuery, setArticleQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMessage("");
    setHadronOption(ticket.hadronOption || "");
    setHadronSearching(false);
    setPermission(ticket.permission || "Clientes");
    setPriority(ticket.priority);
    setType("Não definido");
    setArticles([]);
    setForms([]);
    setArticleQuery("");
    setFormQuery("");
  }, [open, ticket.id]);
  const save = async (finalize: boolean) => {
    if (saving || !message.trim()) return;
    setSaving(true);
    try {
      const details = [
        "Tipo: " + type,
        "Prioridade: " + priority,
        "Permissão: " + permission,
        hadronOption && "Opção Hádron: " + hadronOption,
        articles.length > 0 && "Artigos relacionados: " + articles.join("; "),
        forms.length > 0 && "Opções/Formulários relacionados: " + forms.join("; "),
      ]
        .filter(Boolean)
        .join("\n");
      await ticketsStore.addManualTimeline(ticket.id, {
        subject: ticket.subject,
        description: message.trim() + "\n\n" + details,
        priority,
        permission,
        hadronOption,
        type,
        relatedArticles: articles,
        relatedForms: forms,
        finalize,
      });
      toast.success(
        finalize ? "Registro salvo e chamado finalizado" : "Registro adicionado à timeline",
        { description: ticket.protocol },
      );
      if (finalize) onOpenChange(false);
      else {
        setMessage("");
        setArticles([]);
        setForms([]);
        setArticleQuery("");
        setFormQuery("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };
  const disabled = saving || !message.trim() || ticket.status === "Finalizado";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent
        className="ticket-action-modal flex w-[calc(100vw-2rem)] max-w-[940px] max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 [&>button]:hidden"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Adicionar à timeline</DialogTitle>
        <DetailModalHeader
          icon={MessageSquarePlus}
          title="Adicionar à timeline"
          protocol={ticket.protocol}
          meta={ticket.clientName}
        />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
              <Label htmlFor="timeline-hadron">Opção Hádron</Label>
              <Input
                id="timeline-hadron"
                className="mt-1"
                placeholder="Buscar por código ou nome"
                value={hadronOption}
                onChange={(event) => {
                  setHadronOption(event.target.value);
                  setHadronSearching(true);
                }}
              />
              {hadronSearching && hadronOption.trim() && (
                <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                  {searchHadronOptions(hadronOption).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-accent"
                      onClick={() => {
                        setHadronOption(option.label);
                        setHadronSearching(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Label>Permissão</Label>
              <Select
                value={permission}
                onValueChange={(value) => setPermission(value as ClosurePayload["permission"])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Público", "Clientes", "Empresa"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label>Prioridade</Label>
              <div
                role="radiogroup"
                aria-label="Prioridade"
                className="mt-1 grid grid-cols-3 gap-2"
              >
                {priorityOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={priority === option.value}
                      onClick={() => setPriority(option.value)}
                      className={cn(
                        "relative flex h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-medium transition",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                        option.baseClass,
                        priority === option.value && option.activeClass,
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                          option.iconWrapClass,
                        )}
                      >
                        <Icon className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className={cn("font-medium", option.textClass)}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="manual-ticket-description">
              Mensagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="manual-ticket-description"
              className="mt-1 min-h-48"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Descreva o atendimento e as orientações ao cliente..."
            />
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as ClosurePayload["type"])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <RelatedField
              label="Artigos relacionados"
              query={articleQuery}
              onQuery={setArticleQuery}
              selected={articles}
              onSelected={setArticles}
              suggestions={
                articleQuery.trim()
                  ? cvsArticles
                      .filter(
                        (item) =>
                          item.status === "1" &&
                          normalizeSearch(item.title).includes(normalizeSearch(articleQuery)),
                      )
                      .slice(0, 10)
                      .map((item) => item.title)
                  : []
              }
            />
            <RelatedField
              label="Opções/Formulários relacionados"
              query={formQuery}
              onQuery={setFormQuery}
              selected={forms}
              onSelected={setForms}
              suggestions={
                formQuery.trim() ? searchHadronForms(formQuery).map((item) => item.label) : []
              }
            />
          </div>
        </div>
        <DialogFooter showClose={false} className="ticket-action-footer border-t px-5 py-3">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button variant="outline" disabled={disabled} onClick={() => void save(false)}>
            Salvar e continuar
          </Button>
          <Button disabled={disabled} onClick={() => void save(true)}>
            Salvar e finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelatedField({
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
    const item = value.trim();
    if (item && !selected.includes(item)) onSelected([...selected, item]);
    onQuery("");
  };
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="relative mt-1">
        <div className="flex gap-2">
          <Input
            className="min-w-0"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Busca rápida"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(suggestions[0] || query);
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            aria-label={"Adicionar " + label.toLowerCase()}
            disabled={!query.trim()}
            onClick={() => add(suggestions[0] || query)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {query.trim() && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
            {suggestions
              .filter((item) => !selected.includes(item))
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-accent"
                  onClick={() => add(item)}
                >
                  {item}
                </button>
              ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {selected.map((item) => (
          <button
            key={item}
            type="button"
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
            onClick={() => onSelected(selected.filter((value) => value !== item))}
            aria-label={"Remover " + item}
          >
            <span className="truncate">{item}</span>
            <X className="h-3 w-3 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
