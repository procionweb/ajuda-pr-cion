import * as React from "react";
import { format } from "date-fns";
import {
  Archive,
  ArrowRightLeft,
  CalendarIcon,
  Copy,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  Tag,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { kanbanStore } from "@/lib/kanban-store";
import {
  listBoardMembers,
  listKanbanBoards,
  loadKanbanBoard,
  moveKanbanCard,
  saveKanbanCard,
  type BoardMember,
  type BoardSummary,
} from "@/lib/kanban-api";
import { type KanbanCard, type KanbanColumn } from "@/lib/kanban-data";

type Props = {
  card: KanbanCard;
  boardId?: string;
  columns: KanbanColumn[];
  onOpen?: () => void;
  onArchive?: (card: KanbanCard) => void;
};

export function KanbanCardMenu({ card, boardId, columns, onOpen, onArchive }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<"tags" | "members" | "date" | "move" | "copy" | null>(
    null,
  );

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const openDialog = (key: "tags" | "members" | "date" | "move" | "copy") => {
    setMenuOpen(false);
    setDialog(key);
  };

  const handleCopyLink = async () => {
    setMenuOpen(false);
    const url = `${window.location.origin}${window.location.pathname}#card-${card.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do cartão copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleArchive = () => {
    setMenuOpen(false);
    const archivedCol = columns.find(
      (c) =>
        c.id === "arquivado" || /arquiv|finaliz/i.test(c.id) || /arquiv|finaliz/i.test(c.title),
    );
    if (archivedCol) {
      kanbanStore.updateCard({
        ...card,
        columnId: archivedCol.id,
        archived: true,
      });
    } else {
      kanbanStore.updateCard({ ...card, archived: true });
    }
    onArchive?.(card);
    toast.success("Cartão arquivado");
  };

  const items: {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    danger?: boolean;
  }[] = [
    {
      key: "open",
      label: "Abrir cartão",
      icon: ExternalLink,
      onClick: () => {
        setMenuOpen(false);
        onOpen?.();
      },
    },
    { key: "tags", label: "Editar etiquetas", icon: Tag, onClick: () => openDialog("tags") },
    { key: "members", label: "Alterar membros", icon: Users, onClick: () => openDialog("members") },
    { key: "date", label: "Editar datas", icon: CalendarIcon, onClick: () => openDialog("date") },
    { key: "move", label: "Mover", icon: ArrowRightLeft, onClick: () => openDialog("move") },
    { key: "copy", label: "Copiar cartão", icon: Copy, onClick: () => openDialog("copy") },
    { key: "link", label: "Copiar link", icon: Link2, onClick: handleCopyLink },
    { key: "archive", label: "Arquivar", icon: Archive, onClick: handleArchive, danger: true },
  ];

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={stop}
            onPointerDown={stop}
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-white/7 dark:hover:text-white"
            aria-label="Ações do card"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1" onClick={stop} onPointerDown={stop}>
          <ul className="flex flex-col">
            {items.map((it) => (
              <li key={it.key}>
                <button
                  onClick={it.onClick}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-slate-100 dark:hover:bg-white/8",
                    it.danger
                      ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      : "text-slate-700 dark:text-slate-200",
                  )}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <TagsDialog
        open={dialog === "tags"}
        onOpenChange={(o) => !o && setDialog(null)}
        card={card}
      />
      <MembersDialog
        open={dialog === "members"}
        onOpenChange={(o) => !o && setDialog(null)}
        card={card}
        boardId={boardId}
      />
      <DateDialog
        open={dialog === "date"}
        onOpenChange={(o) => !o && setDialog(null)}
        card={card}
      />
      <MoveDialog
        open={dialog === "move"}
        onOpenChange={(o) => !o && setDialog(null)}
        card={card}
        boardId={boardId}
        columns={columns}
      />
      <CopyDialog
        open={dialog === "copy"}
        onOpenChange={(o) => !o && setDialog(null)}
        card={card}
        boardId={boardId}
        columns={columns}
      />
    </>
  );
}

/* ---------------- Etiquetas ---------------- */

const LABEL_COLORS = [
  "#226e53",
  "#8c690a",
  "#b8640d",
  "#b9352d",
  "#773da2",
  "#1f62b8",
  "#0e7490",
  "#be185d",
];
const labelKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^prioridad normal$/, "prioridade normal");

function TagsDialog({
  open,
  onOpenChange,
  card,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
}) {
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(LABEL_COLORS[0]);
  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setEditing(null);
    setName("");
  }, [open]);
  const allCards = kanbanStore.getSnapshot();
  const labels = Array.from(
    new Map(
      Array.from(new Set(allCards.flatMap((item) => item.tags ?? []))).map((label) => [
        labelKey(label),
        label,
      ]),
    ).values(),
  );
  const visible = labels.filter((label) =>
    label.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );
  const usedColors = new Set<string>();
  const labelColors = new Map(
    labels.map((label, index) => {
      const saved = allCards.find((item) => item.tagColors?.[label])?.tagColors?.[label];
      const color =
        saved && !usedColors.has(saved)
          ? saved
          : (LABEL_COLORS.find((option) => !usedColors.has(option)) ??
            LABEL_COLORS[index % LABEL_COLORS.length]);
      usedColors.add(color);
      return [label, color];
    }),
  );
  const labelColor = (label: string) => labelColors.get(label) ?? LABEL_COLORS[0];

  const toggle = (label: string) => {
    const current = kanbanStore.getSnapshot().find((item) => item.id === card.id) ?? card;
    const selected = current.tags.some((item) => labelKey(item) === labelKey(label));
    kanbanStore.updateCard({
      ...current,
      tags: selected
        ? current.tags.filter((item) => labelKey(item) !== labelKey(label))
        : [...current.tags, label],
      tagColors: selected
        ? current.tagColors
        : { ...current.tagColors, [label]: labelColor(label) },
    });
  };
  const saveLabel = () => {
    const clean = name.trim();
    if (!clean) return;
    if (editing && editing !== clean && labels.includes(clean))
      return toast.error("Já existe uma etiqueta com esse nome");
    const affected = kanbanStore.getSnapshot().filter((item) => item.tags.includes(editing ?? ""));
    if (editing) {
      affected.forEach((item) =>
        kanbanStore.updateCard({
          ...item,
          tags: item.tags.map((tag) => (tag === editing ? clean : tag)),
          tagColors: {
            ...Object.fromEntries(
              Object.entries(item.tagColors ?? {}).filter(([tag]) => tag !== editing),
            ),
            [clean]: color,
          },
        }),
      );
    } else {
      const current = kanbanStore.getSnapshot().find((item) => item.id === card.id) ?? card;
      kanbanStore.updateCard({
        ...current,
        tags: current.tags.includes(clean) ? current.tags : [...current.tags, clean],
        tagColors: { ...current.tagColors, [clean]: color },
      });
    }
    setEditing(null);
    setName("");
  };
  return (
    <ActionDialogFrame title="Etiquetas" open={open} onOpenChange={onOpenChange}>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar etiquetas..."
        autoFocus
      />
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">Etiquetas</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {visible.map((label) => (
            <div key={label} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={card.tags.some((item) => labelKey(item) === labelKey(label))}
                onChange={() => toggle(label)}
                aria-label={`Selecionar ${label}`}
              />
              <button
                type="button"
                onClick={() => toggle(label)}
                className="h-8 min-w-0 flex-1 truncate rounded px-2 text-left text-xs font-semibold text-white"
                style={{ backgroundColor: labelColor(label) }}
              >
                {label}
              </button>
              <button
                type="button"
                aria-label={`Editar ${label}`}
                title={`Editar ${label}`}
                onClick={() => {
                  setEditing(label);
                  setName(label);
                  setColor(labelColor(label));
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      {name || editing !== null ? (
        <div className="space-y-2 border-t pt-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome da etiqueta"
            onKeyDown={(event) => {
              if (event.key === "Enter") saveLabel();
            }}
          />
          <div className="flex gap-2">
            {LABEL_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                title={option}
                aria-label={`Cor ${option}`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "h-7 flex-1 rounded border-2",
                  color === option ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={saveLabel} disabled={!name.trim()}>
              Salvar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setName("");
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setEditing(null);
            setName(" ");
            setColor(LABEL_COLORS[0]);
          }}
        >
          Criar uma nova etiqueta
        </Button>
      )}
    </ActionDialogFrame>
  );
}

/* ---------------- Membros ---------------- */

function MembersDialog({
  open,
  onOpenChange,
  card,
  boardId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  card: KanbanCard;
  boardId?: string;
}) {
  const [members, setMembers] = React.useState<BoardMember[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !boardId) return;
    let active = true;
    setLoading(true);
    setSearch("");
    listBoardMembers({ boardId })
      .then(({ members: result }) => {
        if (active) setMembers(result);
      })
      .catch(() => toast.error("Não foi possível carregar os membros do quadro"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, boardId]);

  const selectedIds = new Set([...(card.participants ?? []), card.assigneeId].filter(Boolean));
  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.email ?? ""} ${member.operator ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const toggle = (id: string) => {
    const current = kanbanStore.getSnapshot().find((item) => item.id === card.id) ?? card;
    const next = new Set(
      [...(current.participants ?? []), current.assigneeId].filter((memberId) =>
        members.some((member) => member.id === memberId),
      ),
    );
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const participants = [...next];
    kanbanStore.updateCard({
      ...current,
      participants,
      assigneeId: participants.includes(current.assigneeId)
        ? current.assigneeId
        : (participants[0] ?? ""),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-[340px] [&>button]:hidden"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">Alterar membros</DialogTitle>
        <DetailModalHeader
          icon={Users}
          title="Alterar membros"
          meta=""
          onClose={() => onOpenChange(false)}
        />

        <div className="space-y-4 px-4 py-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar membros"
            autoFocus
          />
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Membros do Cartão
            </p>
            <div className="space-y-1">
              {members
                .filter((m) => selectedIds.has(m.id))
                .map((m) => {
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px] font-semibold">
                          {m.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{m.name}</span>
                      <X className="h-4 w-4" />
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Membros do Quadro
            </p>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {!loading && filteredMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
              )}
              {filteredMembers.map((m) => {
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[9px] font-semibold">
                        {m.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{m.name}</span>
                    <span>{selectedIds.has(m.id) ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Datas ---------------- */

function DateDialog({
  open,
  onOpenChange,
  card,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  card: KanbanCard;
}) {
  const parse = (iso?: string) => {
    if (!iso) return undefined;
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const [date, setDate] = React.useState<Date | undefined>(parse(card.dueDate));
  const [startDate, setStartDate] = React.useState(card.startDate ?? "");
  const [dueTime, setDueTime] = React.useState(card.dueTime ?? "09:00");
  const [recurrence, setRecurrence] = React.useState(card.recurrence ?? "never");
  const [reminder, setReminder] = React.useState(card.reminder ?? "none");

  React.useEffect(() => {
    if (!open) return;
    setDate(parse(card.dueDate));
    setStartDate(card.startDate ?? "");
    setDueTime(card.dueTime ?? "09:00");
    setRecurrence(card.recurrence ?? "never");
    setReminder(card.reminder ?? "none");
  }, [open, card]);

  const save = () => {
    const iso = date ? format(date, "yyyy-MM-dd") : "";
    if (startDate && iso && startDate > iso)
      return toast.error("A data de início deve ser anterior à entrega");
    const current = kanbanStore.getSnapshot().find((item) => item.id === card.id) ?? card;
    kanbanStore.updateCard({
      ...current,
      dueDate: iso,
      dueTime: iso ? dueTime : "",
      startDate,
      recurrence: iso ? recurrence : "never",
      reminder: iso ? reminder : "none",
    });
    toast.success(date ? "Data de vencimento atualizada" : "Data removida");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        autoFooter={false}
        onOutsideClick={() => onOpenChange(false)}
        className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-[380px] [&>button]:hidden"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">Editar datas</DialogTitle>
        <DetailModalHeader
          icon={CalendarIcon}
          title="Datas"
          meta=""
          onClose={() => onOpenChange(false)}
        />

        <div className="flex flex-col items-center gap-3 px-5 py-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            className={cn("rounded-md border p-3 pointer-events-auto")}
          />
          <div className="w-full space-y-3 text-xs">
            <label className="block space-y-1 font-normal">
              Data de início
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <label className="space-y-1 font-normal">
                Data de entrega
                <Input
                  type="date"
                  value={date ? format(date, "yyyy-MM-dd") : ""}
                  onChange={(event) => setDate(parse(event.target.value))}
                />
              </label>
              <label className="space-y-1 font-normal">
                Horário
                <Input
                  type="time"
                  value={dueTime}
                  disabled={!date}
                  onChange={(event) => setDueTime(event.target.value)}
                />
              </label>
            </div>
            <label className="block space-y-1 font-normal">
              Recorrente
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value)}
              >
                <option value="never">Nunca</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
                <option value="monthly">Mensalmente</option>
              </select>
            </label>
            <label className="block space-y-1 font-normal">
              Definir lembrete
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={reminder}
                onChange={(event) => setReminder(event.target.value)}
              >
                <option value="none">Nenhum</option>
                <option value="at-due">Na hora</option>
                <option value="1-day">1 dia antes</option>
                <option value="2-days">2 dias antes</option>
              </select>
            </label>
          </div>
        </div>

        <DialogFooter
          showClose={false}
          className="flex-col gap-2 border-t border-border bg-card px-5 py-3 sm:flex-col"
        >
          <Button className="w-full cursor-pointer" onClick={save}>
            Salvar
          </Button>
          <Button
            variant="outline"
            className="w-full cursor-pointer text-rose-600"
            onClick={() => {
              const current = kanbanStore.getSnapshot().find((item) => item.id === card.id) ?? card;
              kanbanStore.updateCard({
                ...current,
                dueDate: "",
                dueTime: "",
                recurrence: "never",
                reminder: "none",
              });
              onOpenChange(false);
            }}
          >
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Destino, mover e copiar ---------------- */

function useDestination(
  open: boolean,
  boardId: string | undefined,
  columns: KanbanColumn[],
  card: KanbanCard,
) {
  const [boards, setBoards] = React.useState<BoardSummary[]>([]);
  const [targetBoardId, setTargetBoardId] = React.useState(boardId ?? "");
  const [targetColumns, setTargetColumns] = React.useState(columns);
  const [targetCards, setTargetCards] = React.useState<KanbanCard[]>([]);
  const [columnId, setColumnId] = React.useState(card.columnId);
  const [position, setPosition] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTargetBoardId(boardId ?? "");
    setTargetColumns(columns);
    setTargetCards(kanbanStore.getSnapshot());
    setColumnId(card.columnId);
    setPosition(1);
    listKanbanBoards()
      .then(({ boards: result }) => setBoards(result))
      .catch(() => toast.error("Não foi possível carregar os quadros"));
  }, [open, boardId, card.id, card.columnId, columns]);

  const selectBoard = async (id: string) => {
    setTargetBoardId(id);
    setPosition(1);
    if (id === boardId) {
      setTargetColumns(columns);
      setTargetCards(kanbanStore.getSnapshot());
      setColumnId(columns[0]?.id ?? "");
      return;
    }
    setLoading(true);
    try {
      const result = await loadKanbanBoard({ boardId: id });
      setTargetColumns(result.columns);
      setTargetCards(result.cards);
      setColumnId(result.columns[0]?.id ?? "");
    } catch {
      toast.error("Não foi possível carregar o quadro selecionado");
      setTargetColumns([]);
      setTargetCards([]);
      setColumnId("");
    } finally {
      setLoading(false);
    }
  };
  const cardsInColumn = targetCards.filter(
    (item) => item.columnId === columnId && item.id !== card.id,
  );
  return {
    boards,
    targetBoardId,
    targetColumns,
    columnId,
    position,
    loading,
    cardsInColumn,
    selectBoard,
    setColumnId,
    setPosition,
  };
}

type Destination = ReturnType<typeof useDestination>;

function DestinationFields({ destination }: { destination: Destination }) {
  const field =
    "h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";
  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-xs font-normal">
        Quadro
        <select
          className={field}
          value={destination.targetBoardId}
          onChange={(event) => void destination.selectBoard(event.target.value)}
        >
          {destination.boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-2">
        <label className="space-y-1 text-xs font-normal">
          Lista
          <select
            className={field}
            value={destination.columnId}
            disabled={destination.loading}
            onChange={(event) => {
              destination.setColumnId(event.target.value);
              destination.setPosition(1);
            }}
          >
            {destination.targetColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-normal">
          Posição
          <select
            className={field}
            value={destination.position}
            onChange={(event) => destination.setPosition(Number(event.target.value))}
          >
            {Array.from({ length: destination.cardsInColumn.length + 1 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function ActionDialogFrame({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        autoFooter={false}
        onOutsideClick={() => onOpenChange(false)}
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-md p-0 shadow-xl sm:max-w-[350px] dark:border-white/10 dark:bg-[#2b2d31] dark:text-[#d8d8db] [&>button]:hidden"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex items-center border-b border-border px-4 py-3 text-sm font-normal dark:border-white/10">
          <span className="flex-1 text-center">{title}</span>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  open,
  onOpenChange,
  card,
  boardId,
  columns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  boardId?: string;
  columns: KanbanColumn[];
}) {
  const destination = useDestination(open, boardId, columns, card);
  const [busy, setBusy] = React.useState(false);
  const move = async () => {
    if (!destination.columnId) return;
    setBusy(true);
    try {
      await moveKanbanCard({
        cardId: card.id,
        columnId: destination.columnId,
        beforeCardId: destination.cardsInColumn[destination.position - 1]?.id,
      });
      if (boardId) {
        const result = await loadKanbanBoard({ boardId });
        kanbanStore.hydrate(result.cards as KanbanCard[]);
      }
      toast.success("Cartão movido");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível mover o cartão");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ActionDialogFrame title="Mover cartão" open={open} onOpenChange={onOpenChange}>
      <DestinationFields destination={destination} />
      <Button
        className="w-full bg-[#5f9bea] text-slate-950 hover:bg-[#7baef2]"
        disabled={busy || destination.loading || !destination.columnId}
        onClick={() => void move()}
      >
        Mover
      </Button>
    </ActionDialogFrame>
  );
}

function CopyDialog({
  open,
  onOpenChange,
  card,
  boardId,
  columns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard;
  boardId?: string;
  columns: KanbanColumn[];
}) {
  const destination = useDestination(open, boardId, columns, card);
  const [name, setName] = React.useState(card.title);
  const [keepTags, setKeepTags] = React.useState(true);
  const [keepMembers, setKeepMembers] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setName(card.title);
  }, [open, card.title]);
  const copy = async () => {
    if (!name.trim() || !destination.columnId) return;
    setBusy(true);
    try {
      const selectedMemberIds = [
        ...new Set([...(card.participants ?? []), card.assigneeId].filter(Boolean)),
      ];
      const destinationMembers =
        keepMembers && destination.targetBoardId
          ? (await listBoardMembers({ boardId: destination.targetBoardId })).members
          : [];
      const result = await saveKanbanCard({
        columnId: destination.columnId,
        title: name.trim(),
        description: card.description ?? card.summary,
        priority: card.priority,
        dueDate:
          card.dueDate && card.dueTime ? `${card.dueDate}T${card.dueTime}:00-03:00` : card.dueDate,
        dueTime: card.dueTime,
        startDate: card.startDate,
        recurrence: card.recurrence,
        reminder: card.reminder,
        archived: false,
        tags: keepTags ? card.tags : [],
        tagColors: keepTags ? card.tagColors : {},
        memberIds: keepMembers
          ? selectedMemberIds.filter((id) => destinationMembers.some((member) => member.id === id))
          : [],
        client: card.client,
        module: card.module,
        type: card.type,
        summary: card.summary,
        checklist: card.checklist,
        commentsList: card.commentsList,
        attachmentsList: card.attachmentsList,
        activity: card.activity,
        relatedArticles: card.relatedArticles,
        relatedVersions: card.relatedVersions,
      });
      if (destination.position <= destination.cardsInColumn.length) {
        await moveKanbanCard({
          cardId: result.id,
          columnId: destination.columnId,
          beforeCardId: destination.cardsInColumn[destination.position - 1]?.id,
        });
      }
      if (destination.targetBoardId === boardId && boardId) {
        const reloaded = await loadKanbanBoard({ boardId });
        kanbanStore.hydrate(reloaded.cards as KanbanCard[]);
      }
      toast.success("Cartão criado");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível copiar o cartão");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ActionDialogFrame title="Copiar cartão" open={open} onOpenChange={onOpenChange}>
      <label className="block space-y-1 text-xs font-normal">
        Nome
        <textarea
          className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm font-normal text-foreground"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="space-y-1 text-xs text-muted-foreground">
        Manter...
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={keepTags}
            onChange={(event) => setKeepTags(event.target.checked)}
          />{" "}
          Etiquetas ({card.tags.length})
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={keepMembers}
            onChange={(event) => setKeepMembers(event.target.checked)}
          />{" "}
          Membros ({new Set(card.participants ?? []).size})
        </label>
      </div>
      <DestinationFields destination={destination} />
      <Button
        className="w-full bg-[#5f9bea] text-slate-950 hover:bg-[#7baef2]"
        disabled={busy || destination.loading || !destination.columnId || !name.trim()}
        onClick={() => void copy()}
      >
        Criar Cartão
      </Button>
    </ActionDialogFrame>
  );
}
