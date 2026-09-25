import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  Archive,
  Plus,
  Paperclip,
  MessageSquare,
  History,
  BookOpen,
  Tag,
  CheckSquare,
  Send,
  FileText,
  GitBranch,
  Users,
  Calendar,
  Building2,
  Boxes,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type KanbanCard,
  type ColumnId,
  type KanbanColumn,
  type ChecklistItem,
  type CommentEntry,
  type ActivityEntry,
  type RelatedArticle,
  type RelatedVersion,
  kanbanMembers,
  kanbanClients,
  kanbanModules,
  kanbanColumnsDef,
  priorities,
  cardTypes,
  priorityMeta,
  kbVersions,
} from "@/lib/kanban-data";
import { kbArticlesFull, suggestArticlesForCard, getCategory } from "@/lib/kb-data";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SmartTextarea } from "@/components/ui/smart-text";

const kbArticles: RelatedArticle[] = kbArticlesFull.map((a) => ({
  id: a.id,
  title: a.title,
  category: getCategory(a.category).name,
}));

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard | null;
  mode: "edit" | "create";
  defaultColumnId?: ColumnId;
  columns?: KanbanColumn[];
  onSave: (card: KanbanCard) => void;
  onDelete?: (id: string) => void;
};

const CURRENT_USER_ID = "u-ar"; // usuário logado simulado

const emptyDraft = (columnId: ColumnId): KanbanCard => ({
  id: "",
  columnId,
  title: "",
  summary: "",
  client: kanbanClients[0],
  module: kanbanModules[0],
  priority: "Média",
  type: "Suporte",
  assigneeId: kanbanMembers[0].id,
  dueDate: new Date().toISOString().slice(0, 10),
  tags: [],
  comments: 0,
  attachments: 0,
  description: "",
  participants: [],
  checklist: [],
  commentsList: [],
  activity: [],
  attachmentsList: [],
  relatedArticles: [],
  relatedVersions: [],
});

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const nowIso = () => new Date().toISOString();

const normalizePriority = (value: unknown): KanbanCard["priority"] => {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized === "baixa" || normalized === "low") return "Baixa";
  if (normalized === "alta" || normalized === "high") return "Alta";
  if (normalized === "critica" || normalized === "critical") return "Crítica";
  return "Média";
};

const withDefaults = (c: KanbanCard): KanbanCard => ({
  ...c,
  priority: normalizePriority(c.priority),
  description: c.description ?? c.summary,
  participants: c.participants ?? [c.assigneeId],
  checklist: c.checklist ?? [],
  commentsList: c.commentsList ?? [],
  activity: c.activity ?? [],
  attachmentsList: c.attachmentsList ?? [],
  relatedArticles: c.relatedArticles ?? [],
  relatedVersions: c.relatedVersions ?? [],
});

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberById(id?: string) {
  return kanbanMembers.find((m) => m.id === id);
}

export function KanbanCardDrawer({
  open,
  onOpenChange,
  card,
  mode,
  defaultColumnId = "a-fazer",
  columns = kanbanColumnsDef,
  onSave,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<KanbanCard>(
    card ? withDefaults(card) : emptyDraft(defaultColumnId),
  );
  const [tagsInput, setTagsInput] = useState((card?.tags ?? []).join(", "));
  const [newComment, setNewComment] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState(
    card?.checklist?.[0]?.checklistTitle || "Checklist",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const base = card ? withDefaults(card) : emptyDraft(defaultColumnId);
    setDraft(base);
    setTagsInput((base.tags ?? []).join(", "));
    setNewComment("");
    setNewChecklistItem("");
    setNewChecklistTitle(base.checklist?.[0]?.checklistTitle || "Checklist");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, card, defaultColumnId]);

  const update = <K extends keyof KanbanCard>(key: K, value: KanbanCard[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  // === Ações ===
  const handleChangeStatus = (v: ColumnId) => {
    if (v === draft.columnId) return;
    setDraft((d) => ({ ...d, columnId: v, archived: v === "arquivado" }));
  };

  const handleChangePriority = (v: KanbanCard["priority"]) => {
    if (v === draft.priority) return;
    update("priority", v);
  };

  const handleChangeAssignee = (v: string) => {
    if (v === draft.assigneeId) return;
    update("assigneeId", v);
  };

  const toggleParticipant = (id: string) => {
    setDraft((d) => {
      const has = (d.participants ?? []).includes(id);
      return {
        ...d,
        participants: has
          ? (d.participants ?? []).filter((p) => p !== id)
          : [...(d.participants ?? []), id],
      };
    });
  };

  const addChecklistItem = () => {
    const t = newChecklistItem.trim();
    if (!t) return;
    setDraft((d) => ({
      ...d,
      checklist: [
        ...(d.checklist ?? []),
        {
          id: uid("ck"),
          text: t,
          done: false,
          checklistTitle: newChecklistTitle.trim() || "Checklist",
        },
      ],
    }));
    setNewChecklistItem("");
  };

  const toggleChecklist = (id: string) => {
    setDraft((d) => ({
      ...d,
      checklist: (d.checklist ?? []).map((it) =>
        it.id === id ? { ...it, done: !it.done } : it,
      ),
    }));
  };

  const removeChecklist = (id: string) => {
    setDraft((d) => ({
      ...d,
      checklist: (d.checklist ?? []).filter((it) => it.id !== id),
    }));
  };

  const addComment = () => {
    const t = newComment.trim();
    if (!t) return;
    const entry: CommentEntry = {
      id: uid("cm"),
      authorId: CURRENT_USER_ID,
      at: nowIso(),
      text: t,
    };
    setDraft((d) => ({
      ...d,
      commentsList: [...(d.commentsList ?? []), entry],
      comments: (d.commentsList?.length ?? d.comments ?? 0) + 1,
    }));
    setNewComment("");
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const addAttachmentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const attachments = await Promise.all(
      list.map(async (f) => ({
        id: uid("at"),
        name: f.name,
        size: formatFileSize(f.size),
        kind: (f.name.split(".").pop() ?? f.type.split("/").pop() ?? "file").toLowerCase(),
        url: await readFileAsDataUrl(f),
      })),
    );
    setDraft((d) => ({
      ...d,
      attachmentsList: [
        ...(d.attachmentsList ?? []),
        ...attachments,
      ],
      attachments: (d.attachmentsList?.length ?? d.attachments ?? 0) + list.length,
    }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setDraft((d) => ({
      ...d,
      attachmentsList: (d.attachmentsList ?? []).filter((a) => a.id !== id),
    }));
  };

  const toggleArticle = (article: RelatedArticle) => {
    setDraft((d) => {
      const has = (d.relatedArticles ?? []).some((a) => a.id === article.id);
      return {
        ...d,
        relatedArticles: has
          ? (d.relatedArticles ?? []).filter((a) => a.id !== article.id)
          : [...(d.relatedArticles ?? []), article],
      };
    });
  };

  const toggleVersion = (version: RelatedVersion) => {
    setDraft((d) => {
      const has = (d.relatedVersions ?? []).some((v) => v.id === version.id);
      return {
        ...d,
        relatedVersions: has
          ? (d.relatedVersions ?? []).filter((v) => v.id !== version.id)
          : [...(d.relatedVersions ?? []), version],
      };
    });
  };

  const handleArchive = () => {
    const updated: KanbanCard = {
      ...draft,
      columnId: "arquivado",
      archived: true,
      activity: [
        ...(draft.activity ?? []),
        {
          id: uid("ac"),
          at: nowIso(),
          text: "Arquivado",
          authorId: CURRENT_USER_ID,
        },
      ],
    };
    onSave(updated);
    onOpenChange(false);
  };

  const handleSave = () => {
    const fallbackTitle =
      draft.summary?.trim() ||
      draft.description?.trim().split(/\r?\n/).find(Boolean)?.slice(0, 120) ||
      "";
    const title = draft.title.trim() || fallbackTitle;
    if (!title) {
      toast.error("Informe o título do cartão");
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);
    let final: KanbanCard = {
      ...draft,
      title,
      tags,
      comments: (draft.commentsList ?? []).length || draft.comments,
      attachments: (draft.attachmentsList ?? []).length || draft.attachments,
    };
    const changes: string[] = [];
    const before = card ? withDefaults(card) : null;
    const changed = (label: string, previous: unknown, next: unknown) => {
      if (String(previous ?? "") !== String(next ?? "")) {
        changes.push(`${label} alterado de "${String(previous || "vazio")}" para "${String(next || "vazio")}"`);
      }
    };

    if (!before) {
      changes.push("Cartão criado");
    } else {
      changed("Título", before.title, final.title);
      changed("Resumo", before.summary, final.summary);
      changed("Descrição", before.description, final.description);
      changed("Cliente", before.client, final.client);
      changed("Módulo do sistema", before.module, final.module);
      changed("Tipo", before.type, final.type);
      changed("Prioridade", before.priority, final.priority);
      changed("Prazo", before.dueDate, final.dueDate);

      if (before.columnId !== final.columnId) {
        const from = columns.find((column) => column.id === before.columnId)?.title ?? before.columnId;
        const to = columns.find((column) => column.id === final.columnId)?.title ?? final.columnId;
        changes.push(`Movido de "${from}" para "${to}"`);
      }
      if (before.assigneeId !== final.assigneeId) {
        const from = memberById(before.assigneeId)?.name ?? before.assigneeId;
        const to = memberById(final.assigneeId)?.name ?? final.assigneeId;
        changes.push(`Responsável alterado de "${from}" para "${to}"`);
      }
      const sorted = (values: string[]) => [...values].sort().join("|");
      if (sorted(before.participants ?? []) !== sorted(final.participants ?? [])) changes.push("Participantes atualizados");
      if (sorted(before.tags ?? []) !== sorted(final.tags ?? [])) changes.push("Etiquetas atualizadas");

      const oldChecklist = new Map((before.checklist ?? []).map((item) => [item.id, item]));
      const newChecklist = new Map((final.checklist ?? []).map((item) => [item.id, item]));
      for (const item of final.checklist ?? []) {
        const old = oldChecklist.get(item.id);
        if (!old) changes.push(`Item de checklist adicionado: "${item.text}"`);
        else if (old.done !== item.done) changes.push(`Checklist "${item.text}" marcado como ${item.done ? "concluído" : "pendente"}`);
        else if (old.text !== item.text) changes.push(`Item de checklist renomeado para "${item.text}"`);
      }
      for (const item of before.checklist ?? []) {
        if (!newChecklist.has(item.id)) changes.push(`Item de checklist removido: "${item.text}"`);
      }

      const auditRelations = <T extends { id: string }>(
        previous: T[],
        next: T[],
        label: string,
        display: (item: T) => string,
      ) => {
        const oldIds = new Set(previous.map((item) => item.id));
        const newIds = new Set(next.map((item) => item.id));
        next.filter((item) => !oldIds.has(item.id)).forEach((item) => changes.push(`${label} adicionado: "${display(item)}"`));
        previous.filter((item) => !newIds.has(item.id)).forEach((item) => changes.push(`${label} removido: "${display(item)}"`));
      };
      auditRelations(before.relatedArticles ?? [], final.relatedArticles ?? [], "Artigo", (item) => item.title);
      auditRelations(before.relatedVersions ?? [], final.relatedVersions ?? [], "Versão", (item) => item.version);
      auditRelations(before.attachmentsList ?? [], final.attachmentsList ?? [], "Anexo", (item) => item.name);

      const oldComments = new Set((before.commentsList ?? []).map((item) => item.id));
      const addedComments = (final.commentsList ?? []).filter((item) => !oldComments.has(item.id));
      if (addedComments.length) changes.push(`${addedComments.length} comentário(s) adicionado(s)`);
    }

    if (changes.length) {
      const at = nowIso();
      final = {
        ...final,
        activity: [
          ...(final.activity ?? []),
          ...changes.map((text, index) => ({
            id: uid(`ac-${index}`),
            at,
            text,
            authorId: CURRENT_USER_ID,
          })),
        ],
      };
    }
    onSave(final);
    onOpenChange(false);
  };

  const checklistProgress = useMemo(() => {
    const items = draft.checklist ?? [];
    if (!items.length) return 0;
    return Math.round((items.filter((i) => i.done).length / items.length) * 100);
  }, [draft.checklist]);

  const checklistGroups = useMemo(() => {
    const groups = new Map<string, ChecklistItem[]>();
    for (const item of draft.checklist ?? []) {
      const title = item.checklistTitle?.trim() || "Checklist";
      groups.set(title, [...(groups.get(title) ?? []), item]);
    }
    return [...groups.entries()];
  }, [draft.checklist]);

  const assignee = memberById(draft.assigneeId);
  const isCritical = draft.priority === "Crítica";
  const currentPriorityMeta = priorityMeta[draft.priority] ?? priorityMeta["Média"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-3xl lg:max-w-5xl h-full max-h-screen p-0 flex flex-col gap-0 data-[state=open]:duration-200 data-[state=closed]:duration-150"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border bg-background">
          <SheetHeader className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {mode === "edit" && draft.id && (
                <span className="font-mono">{draft.id}</span>
              )}
              {mode === "edit" && draft.id && <span>·</span>}
              <Badge className={cn("text-[10px]", currentPriorityMeta.badge)}>
                {isCritical && "🚨 "}
                {draft.priority}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {draft.type}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {columns.find((c) => c.id === draft.columnId)?.title ?? draft.columnId}
              </Badge>
              {draft.archived && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Arquivado
                </Badge>
              )}
            </div>
            <SheetTitle className="sr-only">
              {mode === "create" ? "Novo card" : draft.title || "Detalhes do card"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {mode === "create"
                ? "Preencha as informações da nova demanda."
                : "Edite as informações e clique em salvar."}
            </SheetDescription>
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="kanban-card-title" className="text-[11px] uppercase text-muted-foreground">
                Título do cartão <span className="text-destructive">*</span>
              </Label>
              <Input
                lang="pt-BR"
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
                id="kanban-card-title"
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                aria-label="Título do cartão"
                aria-required="true"
                autoFocus={mode === "create"}
                placeholder="Ex: Erro na emissão de NF-e: rejeição XML"
                className="h-11 border-border bg-card px-3 text-base font-medium shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:text-lg"
              />
            </div>
          </SheetHeader>
        </div>

        {/* Body: two columns on lg */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* MAIN */}
            <div className="px-5 sm:px-6 py-5 space-y-7 min-w-0">
              {/* Descrição */}
              <section className="space-y-2">
                <SectionHeader icon={FileText} title="Descrição" />
                <SmartTextarea
                  rows={5}
                  value={draft.description ?? ""}
                  onValueChange={(next) => update("description", next)}
                  placeholder="Contexto, hipóteses, critérios de aceite e impacto no cliente."
                  className="resize-y"
                />
              </section>

              {/* Checklist */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <SectionHeader
                    icon={CheckSquare}
                    title="Checklist"
                    count={`${(draft.checklist ?? []).filter((i) => i.done).length}/${(draft.checklist ?? []).length}`}
                  />
                  {(draft.checklist ?? []).length > 0 && (
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <Progress value={checklistProgress} className="h-1.5" />
                      <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">
                        {checklistProgress}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {checklistGroups.map(([title, items]) => {
                    const completed = items.filter((item) => item.done).length;
                    const progress = Math.round((completed / items.length) * 100);
                    return (
                      <div key={title} className="rounded-lg border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {completed} de {items.length} concluídos
                            </p>
                          </div>
                          <div className="flex w-36 items-center gap-2">
                            <Progress value={progress} className="h-1.5" />
                            <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
                              {progress}%
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <ChecklistRow
                              key={item.id}
                              item={item}
                              onToggle={() => toggleChecklist(item.id)}
                              onRemove={() => removeChecklist(item.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {checklistGroups.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum item adicionado.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <Input
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Nome do checklist"
                    className="h-9 text-sm"
                    list="kanban-checklist-titles"
                  />
                  <datalist id="kanban-checklist-titles">
                    {checklistGroups.map(([title]) => (
                      <option key={title} value={title} />
                    ))}
                  </datalist>
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                    placeholder="Adicionar item ao checklist..."
                    className="h-9 text-sm"
                  />
                  <Button size="sm" variant="secondary" onClick={addChecklistItem} className="cursor-pointer">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </section>

              {/* Anexos */}
              <section className="space-y-3">
                <SectionHeader
                  icon={Paperclip}
                  title="Anexos"
                  count={(draft.attachmentsList ?? []).length}
                />
                <div className="space-y-1.5">
                  {(draft.attachmentsList ?? []).map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2",
                        a.url && "cursor-pointer transition-colors hover:bg-muted/40",
                      )}
                      role={a.url ? "link" : undefined}
                      tabIndex={a.url ? 0 : undefined}
                      onClick={() => a.url && window.open(a.url, "_blank", "noopener,noreferrer")}
                      onKeyDown={(event) => {
                        if (a.url && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          window.open(a.url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 shrink-0 grid place-items-center rounded bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                          {a.kind.slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm font-medium text-primary hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {a.name}
                            </a>
                          ) : (
                            <p className="text-sm font-medium truncate">{a.name}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">{a.size}</p>
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removeAttachment(a.id);
                        }}
                        className="cursor-pointer text-muted-foreground hover:text-destructive p-1"
                        aria-label="Remover anexo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {(draft.attachmentsList ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum anexo.
                    </p>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => addAttachmentFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground"
                  >
                    <Paperclip className="mx-auto mb-1.5 h-5 w-5" />
                    <span className="block font-medium">Clique para anexar arquivos</span>
                    <span className="block text-[11px]">Você pode selecionar um ou mais arquivos do computador</span>
                  </button>
                </div>
              </section>

              {/* Sugestões automáticas para Bug/Suporte */}
              {(draft.type === "Bug" || draft.type === "Suporte") && (() => {
                const suggestions = suggestArticlesForCard({
                  type: draft.type,
                  module: draft.module,
                  tags: draft.tags,
                }).filter(
                  (a) => !(draft.relatedArticles ?? []).some((x) => x.id === a.id),
                );
                if (suggestions.length === 0) return null;
                return (
                  <section className="space-y-3">
                    <SectionHeader icon={BookOpen} title="Sugestões da base" count={suggestions.length} />
                    <p className="text-xs text-muted-foreground">
                      Artigos de Erros e Correções que podem ajudar neste card.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {suggestions.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3"
                        >
                          <div className="min-w-0">
                            <Link
                              to="/base-de-conhecimento/$slug"
                              params={{ slug: a.slug }}
                              className="cursor-pointer text-sm font-medium hover:underline block truncate"
                            >
                              {a.title}
                            </Link>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {a.id} · {getCategory(a.category).name} · {a.module}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              toggleArticle({
                                id: a.id,
                                title: a.title,
                                category: getCategory(a.category).name,
                              })
                            }
                            className="cursor-pointer shrink-0 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Vincular
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()}

              {/* Relacionados */}
              <section className="space-y-3">
                <SectionHeader icon={BookOpen} title="Relacionados" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <RelatedBlock
                    title="Artigos da base"
                    icon={BookOpen}
                    items={(draft.relatedArticles ?? []).map((a) => {
                      const full = kbArticlesFull.find((k) => k.id === a.id);
                      return {
                        key: a.id,
                        primary: a.title,
                        secondary: `${a.id} · ${a.category}`,
                        href: full ? `/base-de-conhecimento/${full.slug}` : undefined,
                      };
                    })}
                    emptyLabel="Nenhum artigo vinculado."
                    picker={
                      <RelationPicker
                        label="Vincular artigo"
                        options={kbArticles.map((a) => ({
                          id: a.id,
                          label: a.title,
                          hint: a.category,
                          selected: (draft.relatedArticles ?? []).some(
                            (x) => x.id === a.id,
                          ),
                          onToggle: () => toggleArticle(a),
                        }))}
                      />
                    }
                  />
                  <RelatedBlock
                    title="Versões"
                    icon={GitBranch}
                    items={(draft.relatedVersions ?? []).map((v) => ({
                      key: v.id,
                      primary: `v${v.version}`,
                      secondary: `${v.date} · ${v.note}`,
                    }))}
                    emptyLabel="Nenhuma versão vinculada."
                    picker={
                      <RelationPicker
                        label="Vincular versão"
                        options={kbVersions.map((v) => ({
                          id: v.id,
                          label: `v${v.version}`,
                          hint: v.note,
                          selected: (draft.relatedVersions ?? []).some(
                            (x) => x.id === v.id,
                          ),
                          onToggle: () => toggleVersion(v),
                        }))}
                      />
                    }
                  />
                </div>
              </section>


              {/* Comentários */}
              <section className="space-y-3">
                <SectionHeader
                  icon={MessageSquare}
                  title="Comentários"
                  count={(draft.commentsList ?? []).length}
                />
                <div className="space-y-4">
                  {[...(draft.commentsList ?? [])]
                    .sort((a, b) => a.at.localeCompare(b.at))
                    .map((c) => {
                      const author = memberById(c.authorId);
                      return (
                        <div key={c.id} className="flex gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback
                              className={cn(
                                "text-[10px] font-medium",
                                author?.color,
                              )}
                            >
                              {author?.initials ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold">
                                {author?.name ?? "Usuário"}
                              </span>
                              <span className="text-muted-foreground">
                                {formatWhen(c.at)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                              {c.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  {(draft.commentsList ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum comentário ainda.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 items-start pt-2 border-t border-border">
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback
                      className={cn(
                        "text-[10px] font-medium",
                        memberById(CURRENT_USER_ID)?.color,
                      )}
                    >
                      {memberById(CURRENT_USER_ID)?.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <SmartTextarea
                      value={newComment}
                      onValueChange={setNewComment}
                      placeholder="Escreva um comentário..."
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={addComment} disabled={!newComment.trim()}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Comentar
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Histórico */}
              <section className="space-y-3">
                <SectionHeader
                  icon={History}
                  title="Histórico de movimentações"
                  count={(draft.activity ?? []).length}
                />
                <ol className="relative border-l border-border ml-2 pl-4 space-y-3">
                  {[...(draft.activity ?? [])]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((e) => {
                      const author = memberById(e.authorId);
                      return (
                        <li key={e.id} className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                          <p className="text-sm">{e.text}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {author?.name ? `${author.name} · ` : ""}
                            {formatWhen(e.at)}
                          </p>
                        </li>
                      );
                    })}
                  {(draft.activity ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Sem movimentações registradas.
                    </p>
                  )}
                </ol>
              </section>
            </div>

            {/* SIDEBAR (props operacionais) */}
            <aside className="border-t lg:border-t-0 lg:border-l border-border bg-muted/30 px-5 sm:px-6 py-5 space-y-5">
              <SidebarField icon={Boxes} label="Status">
                <Select value={draft.columnId} onValueChange={(v) => handleChangeStatus(v as ColumnId)}>
                  <SelectTrigger className="h-9 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField icon={Tag} label="Prioridade">
                <Select value={draft.priority} onValueChange={(v) => handleChangePriority(v as KanbanCard["priority"])}>
                  <SelectTrigger className="h-10 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="inline-flex items-center gap-2.5">
                          <span className={cn("h-2 w-14 rounded-full", priorityMeta[p].strip)} />
                          {p}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField icon={Tag} label="Tipo">
                <Select value={draft.type} onValueChange={(v) => update("type", v as KanbanCard["type"])}>
                  <SelectTrigger className="h-9 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cardTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField icon={Users} label="Responsável">
                <Select value={draft.assigneeId} onValueChange={handleChangeAssignee}>
                  <SelectTrigger className="h-9 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kanbanMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-5 w-5 rounded-full grid place-items-center text-[9px] font-semibold", m.color)}>
                            {m.initials}
                          </span>
                          {m.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignee && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={cn("text-[10px] font-medium", assignee.color)}>
                        {assignee.initials}
                      </AvatarFallback>
                    </Avatar>
                    {assignee.name}
                  </div>
                )}
              </SidebarField>

              <SidebarField icon={Users} label="Participantes">
                <div className="flex items-center flex-wrap gap-1.5">
                  {(draft.participants ?? []).map((pid) => {
                    const p = memberById(pid);
                    if (!p) return null;
                    return (
                      <button
                        key={pid}
                        onClick={() => toggleParticipant(pid)}
                        className="group inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-background border border-border text-[11px]"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className={cn("text-[9px] font-semibold", p.color)}>
                            {p.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{p.name.split(" ")[0]}</span>
                        <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive" />
                      </button>
                    );
                  })}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40">
                        <Plus className="h-3 w-3" /> Adicionar
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="end">
                      <div className="space-y-0.5 max-h-64 overflow-y-auto">
                        {kanbanMembers.map((m) => {
                          const selected = (draft.participants ?? []).includes(m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => toggleParticipant(m.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted",
                                selected && "bg-muted",
                              )}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className={cn("text-[10px] font-medium", m.color)}>
                                  {m.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-left">{m.name}</span>
                              {selected && <CheckSquare className="h-3.5 w-3.5 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </SidebarField>

              <SidebarField icon={Building2} label="Cliente">
                <Select value={draft.client} onValueChange={(v) => update("client", v)}>
                  <SelectTrigger className="h-9 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interno">Interno</SelectItem>
                    {kanbanClients.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField icon={Boxes} label="Módulo do sistema">
                <Select value={draft.module} onValueChange={(v) => update("module", v)}>
                  <SelectTrigger className="h-9 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {kanbanModules.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField icon={Calendar} label="Prazo">
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => update("dueDate", e.target.value)}
                  className="h-9 cursor-pointer"
                />
              </SidebarField>

              <SidebarField icon={Tag} label="Tags">
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="fiscal, nf-e"
                  className="h-9 cursor-pointer"
                />
              </SidebarField>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Ações
                </Label>
                <div className="flex flex-col gap-1.5">
                  {(() => {
                    const idx = kanbanColumnsDef.findIndex((c) => c.id === draft.columnId);
                    const next = idx >= 0 && idx < kanbanColumnsDef.length - 1 ? kanbanColumnsDef[idx + 1] : null;
                    if (!next) return null;
                    return (
                      <Button
                        variant="default"
                        size="sm"
                        className="cursor-pointer justify-start"
                        onClick={() => handleChangeStatus(next.id)}
                      >
                        <GitBranch className="h-4 w-4 mr-2" /> Próximo passo: {next.title}
                      </Button>
                    );
                  })()}
                  <Button variant="outline" size="sm" className="cursor-pointer justify-start" onClick={handleArchive}>
                    <Archive className="h-4 w-4 mr-2" /> Arquivar card
                  </Button>
                  {mode === "edit" && onDelete && draft.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-destructive hover:text-destructive"
                      onClick={() => {
                        onDelete(draft.id);
                        onOpenChange(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </Button>
                  )}
                </div>
              </div>

            </aside>
          </div>
        </div>

        {/* Footer sticky */}
        <div className="px-5 sm:px-6 py-3 border-t border-border bg-background flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground truncate">
            {mode === "create" ? "Criando novo card" : `Editando ${draft.id || "card"}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="cursor-pointer">
              {mode === "create" ? "Criar card" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ helpers ============

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number | string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">{title}</h3>
      {count !== undefined && count !== "" && (
        <span className="text-[11px] text-muted-foreground">({count})</span>
      )}
    </div>
  );
}

function SidebarField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
      <Checkbox checked={item.done} onCheckedChange={onToggle} />
      <span
        className={cn(
          "flex-1 text-sm",
          item.done && "line-through text-muted-foreground",
        )}
      >
        {item.text}
      </span>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
        aria-label="Remover item"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RelatedBlock({
  title,
  icon: Icon,
  items,
  emptyLabel,
  picker,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { key: string; primary: string; secondary: string; href?: string }[];
  emptyLabel: string;
  picker: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {title}
        </div>
        {picker}
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
        )}
        {items.map((it) => (
          <div key={it.key} className="text-sm">
            {it.href ? (
              <a
                href={it.href}
                className="font-medium leading-tight hover:underline block"
              >
                {it.primary}
              </a>
            ) : (
              <p className="font-medium leading-tight">{it.primary}</p>
            )}
            <p className="text-[11px] text-muted-foreground">{it.secondary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationPicker({
  label,
  options,
}: {
  label: string;
  options: {
    id: string;
    label: string;
    hint: string;
    selected: boolean;
    onToggle: () => void;
  }[];
}) {
  const sortedOptions = useMemo(
    () =>
      [...options].sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
      ),
    [options],
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="cursor-pointer inline-flex items-center gap-1 h-6 px-2 rounded-md border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40">
          <Plus className="h-3 w-3" /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {sortedOptions.map((o) => (
            <button
              key={o.id}
              onClick={o.onToggle}
              className={cn(
                "cursor-pointer w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-start gap-2",
                o.selected && "bg-muted",
              )}
            >
              <CheckSquare
                className={cn(
                  "h-3.5 w-3.5 mt-0.5 shrink-0",
                  o.selected ? "text-primary" : "text-muted-foreground/40",
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{o.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {o.hint}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

