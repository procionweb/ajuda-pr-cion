import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Copy,
  Eye,
  EyeOff,
  MoreVertical,
  Plus,
  Trash2,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanCardItem } from "./KanbanCard";
import type { KanbanCard, KanbanColumn } from "@/lib/kanban-data";
import type { BoardMember, KanbanColumnSortMode } from "@/lib/kanban-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const columnMeta: Record<string, { dot: string; text: string }> = {
  "a-fazer": { dot: "bg-sky-500", text: "text-slate-800 dark:text-slate-100" },
  "em-andamento": { dot: "bg-amber-400", text: "text-slate-800 dark:text-slate-100" },
  concluido: { dot: "bg-blue-500", text: "text-slate-800 dark:text-slate-100" },
  homologacao: { dot: "bg-violet-500", text: "text-slate-800 dark:text-slate-100" },
  arquivado: { dot: "bg-emerald-500", text: "text-slate-800 dark:text-slate-100" },
};

export function KanbanColumnView({
  boardId,
  boardMembers = [],
  column,
  columns,
  cards,
  onCardClick,
  onArchiveCard,
  onAddCard,
  onDeleteColumn,
  canDeleteColumn = true,
  onCopyColumn,
  onMoveColumn,
  onMoveAllCards,
  onSortColumn,
  isFollowing = false,
  onToggleFollow,
  onArchiveAll,
}: {
  boardId?: string;
  boardMembers?: BoardMember[];
  column: KanbanColumn;
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onCardClick: (card: KanbanCard) => void;
  onArchiveCard: (card: KanbanCard) => void;
  onAddCard: (columnId: KanbanColumn["id"]) => void;
  onDeleteColumn?: (column: KanbanColumn) => void;
  canDeleteColumn?: boolean;
  onCopyColumn?: (column: KanbanColumn) => void;
  onMoveColumn?: (column: KanbanColumn) => void;
  onMoveAllCards?: (column: KanbanColumn, destination: KanbanColumn) => void;
  onSortColumn?: (column: KanbanColumn, mode: KanbanColumnSortMode) => void;
  isFollowing?: boolean;
  onToggleFollow?: (column: KanbanColumn) => void;
  onArchiveAll?: (column: KanbanColumn) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });
  const meta = columnMeta[column.id] ?? columnMeta["a-fazer"];

  return (
    <section
      ref={setNodeRef}
      className="relative flex h-[clamp(390px,calc(100dvh-250px),720px)] w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-slate-100 p-2.5 shadow-sm dark:border-white/8 dark:bg-[#171a20] dark:shadow-[0_18px_40px_rgba(0,0,0,0.16)]"
    >
      <div className="mb-3 flex h-7 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
          <h2 className={cn("truncate text-[12px] font-semibold", meta.text)}>{column.title}</h2>
          <span className="grid h-5 min-w-5 place-items-center rounded-full border border-slate-200 bg-white px-1.5 text-[10px] font-black text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-slate-300">
            {cards.length}
          </span>
          {isFollowing && (
            <span
              title="Você está seguindo esta lista"
              className="grid h-5 w-5 place-items-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300"
            >
              <Eye className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-white/7 dark:hover:text-white"
                aria-label={`Ações da lista ${column.title}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[290px]">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Ações da lista
              </DropdownMenuLabel>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => onAddCard(column.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar cartão
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => onCopyColumn?.(column)}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar lista
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => onMoveColumn?.(column)}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Mover lista
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="cursor-pointer"
                  disabled={cards.length === 0 || columns.length < 2}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Mover todos os cartões
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[230px]">
                  {columns.map((destination) => (
                    <DropdownMenuItem
                      key={destination.id}
                      className="cursor-pointer"
                      disabled={destination.id === column.id}
                      onSelect={() => onMoveAllCards?.(column, destination)}
                    >
                      {destination.title}
                      {destination.id === column.id ? " (atual)" : ""}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer" disabled={cards.length < 2}>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Ordenar lista
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[280px]">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => onSortColumn?.(column, "created_newest")}
                  >
                    Data de criação (mais recente primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => onSortColumn?.(column, "created_oldest")}
                  >
                    Data de criação (mais antigo primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => onSortColumn?.(column, "name")}
                  >
                    Nome do cartão (ordem alfabética)
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => onToggleFollow?.(column)}
              >
                {isFollowing ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Deixar de seguir
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Seguir
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={cards.length === 0}
                onSelect={() => onArchiveAll?.(column)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Arquivar todos os cartões
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-rose-600 focus:text-rose-600 dark:text-rose-400"
                disabled={!canDeleteColumn}
                onSelect={() => onDeleteColumn?.(column)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-lg border border-dashed border-transparent transition-colors",
          isOver && "border-primary/50 bg-primary/10",
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="app-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-1">
            {cards.map((c) => (
              <KanbanCardItem
                key={c.id}
                boardId={boardId}
                boardMembers={boardMembers}
                card={c}
                columns={columns}
                onClick={() => onCardClick(c)}
                onArchive={onArchiveCard}
              />
            ))}
          </div>
        </SortableContext>

        <button
          onClick={() => onAddCard(column.id)}
          className="mt-2 flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/7 dark:hover:text-white"
        >
          <Plus className="h-3 w-3" />
          Adicionar um cartão
        </button>
      </div>
    </section>
  );
}
