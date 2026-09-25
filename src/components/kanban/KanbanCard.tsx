import { memo } from "react";
import { CalendarDays, MessageSquare, Paperclip } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { type KanbanCard as CardType, type KanbanColumn, kanbanMembers } from "@/lib/kanban-data";
import { KanbanCardMenu } from "./KanbanCardMenu";
import type { BoardMember } from "@/lib/kanban-api";

function formatDue(iso: string) {
  if (!iso) return "Sem prazo";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Sem prazo";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function getPriorityMeta(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized.includes("baixa")) {
    return { label: "Baixa", accent: "bg-emerald-400", strip: "bg-emerald-500" };
  }
  if (normalized.includes("alta")) {
    return { label: "Alta", accent: "bg-rose-400", strip: "bg-rose-500" };
  }
  if (normalized.includes("cr")) {
    return { label: "Crítica", accent: "bg-red-500", strip: "bg-red-600" };
  }
  return { label: "Média", accent: "bg-amber-400", strip: "bg-yellow-400" };
}

const TAG_COLORS: { match: RegExp; className: string }[] = [
  { match: /fiscal|nf|sped|icms/i, className: "bg-sky-500" },
  { match: /financ|pix|boleto|comiss/i, className: "bg-emerald-500" },
  { match: /estoque|wms|log/i, className: "bg-indigo-500" },
  { match: /performance|bug/i, className: "bg-rose-500" },
  { match: /doc|api/i, className: "bg-violet-500" },
  { match: /ux|design|release/i, className: "bg-pink-500" },
  { match: /implant|migra|produ/i, className: "bg-teal-500" },
  { match: /seg|2fa|infra/i, className: "bg-amber-500" },
];

function getTagColor(tag: string) {
  return TAG_COLORS.find((t) => t.match.test(tag))?.className ?? "bg-slate-400";
}

type KanbanCardItemProps = {
  card: CardType;
  boardId?: string;
  boardMembers?: BoardMember[];
  columns?: KanbanColumn[];
  onClick?: () => void;
  onArchive?: (card: CardType) => void;
};

export function KanbanCardItem({
  card,
  boardId,
  boardMembers = [],
  columns = [],
  onClick,
  onArchive,
}: KanbanCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      data-kanban-card
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        if (!e.currentTarget.contains(e.target as Node)) return;
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "group cursor-grab active:cursor-grabbing rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-[0_1px_1px_rgba(15,23,42,0.08)] transition-[background-color,border-color,box-shadow] duration-150 hover:border-slate-400 hover:shadow-md dark:border-white/10 dark:bg-[#22252a] dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-[#292c31]",
        isDragging && "opacity-30",
      )}
    >
      <KanbanCardContent
        card={card}
        boardId={boardId}
        boardMembers={boardMembers}
        columns={columns}
        onClick={onClick}
        onArchive={onArchive}
      />
    </div>
  );
}

const KanbanCardContent = memo(function KanbanCardContent({
  card,
  boardId,
  boardMembers = [],
  columns = [],
  onClick,
  onArchive,
}: KanbanCardItemProps) {
  const memberIds = Array.from(new Set([...(card.participants ?? []), card.assigneeId])).filter(
    Boolean,
  );
  const members = memberIds
    .map((id) => {
      const member = boardMembers.find((item) => item.id === id);
      if (member)
        return {
          ...member,
          initials: member.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
          color: "bg-primary/15 text-primary",
        };
      return kanbanMembers.find((item) => item.id === id);
    })
    .filter((member): member is NonNullable<typeof member> => Boolean(member));
  const priority = getPriorityMeta(card.priority);
  const total = card.checklist?.length || (priority.label === "Alta" ? 7 : 5);
  const done =
    card.checklist?.filter((c) => c.done).length ||
    Math.max(1, Math.min(total, Math.round((card.comments + card.attachments + 2) / 2)));
  const progress = Math.round((done / total) * 100);

  return (
    <>
      {/* Trello-style label strips */}
      <div className="mb-1.5 flex flex-wrap gap-1">
        <span
          title={`Prioridade: ${priority.label}`}
          className={cn("h-1.5 w-10 rounded-full", priority.strip)}
        />
        {card.tags?.slice(0, 6).map((t) => (
          <span
            key={t}
            title={t}
            className={cn("h-1.5 w-10 rounded-full opacity-90", getTagColor(t))}
            style={card.tagColors?.[t] ? { backgroundColor: card.tagColors[t] } : undefined}
          />
        ))}
      </div>

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-3 text-[12px] font-medium leading-[1.35] text-slate-800 dark:text-slate-100">
            {card.title}
          </p>
          <p className="mt-1 line-clamp-1 text-[10px] text-slate-500 dark:text-slate-400">
            {card.client} <span className="text-slate-400 dark:text-slate-600">•</span>{" "}
            {card.module}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <KanbanCardMenu
            card={card}
            boardId={boardId}
            columns={columns}
            onOpen={onClick}
            onArchive={onArchive}
          />
        </div>
      </div>

      <div className="flex min-h-6 items-center gap-2.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1" title="Prazo">
          <CalendarDays className="h-3 w-3" />
          {formatDue(card.dueDate)}
        </span>
        {card.comments > 0 && (
          <span className="inline-flex items-center gap-1" title="Comentários">
            <MessageSquare className="h-3 w-3" />
            {card.comments}
          </span>
        )}
        {card.attachments > 0 && (
          <span className="inline-flex items-center gap-1" title="Anexos">
            <Paperclip className="h-3 w-3" />
            {card.attachments}
          </span>
        )}
        {card.checklist && card.checklist.length > 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
              progress === 100
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                : "text-slate-500 dark:text-slate-400",
            )}
            title="Checklist"
          >
            ☑ {done}/{total}
          </span>
        )}
        <span className="ml-auto flex -space-x-1.5 pl-1">
          {members.slice(0, 4).map((member) => (
            <Avatar
              key={member.id}
              title={member.name}
              className="h-6 w-6 border-2 border-white bg-white shadow-sm dark:border-[#22252a] dark:bg-[#22252a]"
            >
              <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
              <AvatarFallback className={cn("text-[8px] font-semibold", member.color)}>
                {member.initials}
              </AvatarFallback>
            </Avatar>
          ))}
          {members.length > 4 && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-slate-200 px-1 text-[8px] text-slate-700 dark:border-[#22252a] dark:bg-slate-700 dark:text-slate-100">
              +{members.length - 4}
            </span>
          )}
        </span>
      </div>
    </>
  );
});

export function KanbanCardPreview({ card }: { card: CardType }) {
  const priority = getPriorityMeta(card.priority);
  const completed = card.checklist?.filter((item) => item.done).length ?? 0;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none box-border w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-slate-900 shadow-xl dark:border-white/25 dark:bg-[#292c31] dark:text-slate-100"
    >
      <div className="mb-1.5 flex flex-wrap gap-1">
        <span className={cn("h-1.5 w-10 rounded-full", priority.strip)} />
        {card.tags?.slice(0, 6).map((tag) => (
          <span
            key={tag}
            className={cn("h-1.5 w-10 rounded-full", getTagColor(tag))}
            style={card.tagColors?.[tag] ? { backgroundColor: card.tagColors[tag] } : undefined}
          />
        ))}
      </div>
      <p className="line-clamp-3 text-[12px] font-medium leading-[1.35]">{card.title}</p>
      <p className="mt-1 line-clamp-1 text-[10px] text-slate-500 dark:text-slate-400">
        {card.client} <span aria-hidden="true">•</span> {card.module}
      </p>
      <div className="mt-2 flex min-h-6 items-center gap-2.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {formatDue(card.dueDate)}
        </span>
        {!!card.checklist?.length && (
          <span>
            ☑ {completed}/{card.checklist.length}
          </span>
        )}
      </div>
    </div>
  );
}
