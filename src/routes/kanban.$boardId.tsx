import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Columns3, Trash2 as TrashIcon, Archive as ArchiveIcon } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Inbox,
  CalendarDays,
  Filter,
  FileStack,
  LayoutGrid,
  Layers3,
  List,
  Plus,
  Search,
  Star,
  UserRound,
  Users,
  Palette,
  X,
} from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { kanbanStore, moveCardInList, useKanbanCards } from "@/lib/kanban-store";
import { usePortalAuth } from "@/lib/portal-auth";
import {
  createKanbanColumn,
  copyKanbanColumn,
  moveKanbanColumn,
  moveAllKanbanCards,
  sortKanbanColumnCards,
  listKanbanBoards,
  deleteKanbanColumn,
  archiveKanbanColumnCards,
  loadKanbanBoard,
  getKanbanBoard,
  moveKanbanCard,
  deleteKanbanCard,
  type BoardSummary,
  type BoardMember,
  type KanbanColumnSortMode,
  listBoardMembers,
  listAvailableMembers,
} from "@/lib/kanban-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { KanbanColumnView } from "@/components/kanban/KanbanColumn";
import { KanbanCardPreview } from "@/components/kanban/KanbanCard";
import { KanbanCardDrawer } from "@/components/kanban/KanbanCardDrawer";
import { KanbanBoardMenu } from "@/components/kanban/KanbanBoardMenu";
import { BoardNotifications } from "@/components/kanban/BoardNotifications";
import { BoardSwitcherDialog } from "@/components/kanban/BoardSwitcherDialog";
import { KanbanTemplateDialog } from "@/components/kanban/KanbanTemplateDialog";
import { BoardCollaborationDialog } from "@/components/kanban/BoardCollaborationDialog";
import { templateToCard, type KanbanCardTemplate } from "@/lib/kanban-templates";
import {
  type KanbanCard,
  type ColumnId,
  type KanbanColumn,
  type Priority,
  type CardType,
  kanbanColumnsDef,
  priorities,
  cardTypes,
} from "@/lib/kanban-data";


export const Route = createFileRoute("/kanban/$boardId")({
  head: () => ({
    meta: [
      { title: "Kanban Prócion - Demandas" },
      {
        name: "description",
        content:
          "Quadro Kanban escuro para organizar demandas e projetos internos da Prócion Sistemas.",
      },
    ],
  }),
  component: KanbanPage,
});

type DueFilter = "all" | "overdue" | "today" | "week" | "no-date";
type CompletionFilter = "all" | "open" | "completed";
type ViewMode = "kanban" | "list" | "inbox" | "planner";

type Filters = {
  client: string;
  assignee: string;
  priority: string;
  type: string;
  status: string;
  tag: string;
  due: DueFilter;
  completion: CompletionFilter;
};

const emptyFilters: Filters = {
  client: "all",
  assignee: "all",
  priority: "all",
  type: "all",
  status: "all",
  tag: "all",
  due: "all",
  completion: "all",
};

function daysBetween(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

const FOLLOWED_COLUMNS_STORAGE_KEY = "procion-kanban-followed-columns";

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const actions = args.droppableContainers.filter((container) => container.data.current?.type === "action");
  const actionCollision = pointerWithin({ ...args, droppableContainers: actions });
  if (actionCollision.length) return actionCollision;
  const columnContainers = args.droppableContainers.filter(
    (container) => container.data.current?.type === "column",
  );
  const columnCollision = pointerWithin({ ...args, droppableContainers: columnContainers })[0];
  if (!columnCollision) return [];

  const targetColumnId = columnCollision.data?.droppableContainer.data.current?.columnId;
  const cardContainers = args.droppableContainers.filter(
    (container) =>
      container.data.current?.type === "card" &&
      container.data.current?.card?.columnId === targetColumnId,
  );
  return pointerWithin({ ...args, droppableContainers: cardContainers }).concat(columnCollision);
};

function getInitialColumns(): KanbanColumn[] {
  return kanbanColumnsDef;
}

function getInitialFollowedColumns() {
  if (typeof window === "undefined") return new Set<ColumnId>();
  try {
    const saved = window.localStorage.getItem(FOLLOWED_COLUMNS_STORAGE_KEY);
    if (!saved) return new Set<ColumnId>();
    const parsed = JSON.parse(saved) as ColumnId[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<ColumnId>();
  }
}

function normalizeColumnId(title: string, columns: KanbanColumn[]): ColumnId {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "coluna";
  let id = base;
  let suffix = 2;
  while (columns.some((col) => col.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function useStableHandler<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });
  return useCallback((...args: Args) => handlerRef.current(...args), []);
}

function KanbanDropTarget({ action, label, icon: Icon }: {
  action: "archive" | "delete";
  label: string;
  icon: typeof ArchiveIcon;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `kanban-action-${action}`,
    data: { type: "action", action },
  });
  return (
    <div
      ref={setNodeRef}
      role="status"
      aria-label={label}
      className={cn(
        "flex h-14 min-w-36 items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white px-4 text-sm font-semibold shadow-xl transition-[background-color,border-color,transform] dark:bg-[#22252a]",
        action === "delete" ? "border-rose-400 text-rose-600 dark:text-rose-300" : "border-sky-400 text-sky-700 dark:text-sky-300",
        isOver && "scale-105 bg-sky-100 dark:bg-slate-700",
      )}
    >
      <Icon className="h-5 w-5" /> {label}
    </div>
  );
}

type DrawerRequest = {
  card: KanbanCard | null;
  mode: "edit" | "create";
  defaultColumnId: ColumnId;
};

type DrawerHandle = {
  open: (request: DrawerRequest) => void;
};

const CardDrawerHost = forwardRef<
  DrawerHandle,
  {
    columns: KanbanColumn[];
    boardMembers: BoardMember[];
    onSave: (card: KanbanCard, mode: DrawerRequest["mode"]) => void;
    onDelete: (id: string) => void;
    canDelete: boolean;
  }
>(function CardDrawerHost({ columns, boardMembers, onSave, onDelete, canDelete }, ref) {
  const [request, setRequest] = useState<DrawerRequest | null>(null);
  useImperativeHandle(ref, () => ({ open: setRequest }), []);
  if (!request) return null;
  return (
    <KanbanCardDrawer
      open
      onOpenChange={(open) => {
        if (!open) setRequest(null);
      }}
      card={request.card}
      mode={request.mode}
      defaultColumnId={request.defaultColumnId}
      columns={columns}
      boardMembers={boardMembers}
      onSave={(card) => onSave(card, request.mode)}
      onDelete={canDelete ? onDelete : undefined}
    />
  );
});

function KanbanPage() {
  const { boardId: boardIdParam } = Route.useParams();
  const { session, operator, role } = usePortalAuth();
  const actorId = session?.user.id;
  const actorName = String(session?.user.user_metadata?.full_name || operator || session?.user.email || "Usuário");
  const cards = useKanbanCards();
  const setCards = kanbanStore.setCards;
  const [columns, setColumns] = useState<KanbanColumn[]>(getInitialColumns);
  const [boardId, setBoardId] = useState<string | null>(boardIdParam ?? null);
  const [boardName, setBoardName] = useState<string>("");
  const [boardSummary, setBoardSummary] = useState<BoardSummary | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const canDeleteCard = role === "admin" || role === "s_admin" || boardMembers.some((member) => member.id === actorId && member.role === "admin");
  const [cardDeleteTarget, setCardDeleteTarget] = useState<KanbanCard | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cardMembers, setCardMembers] = useState<BoardMember[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [onlyMine, setOnlyMine] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [dragPreviewWidth, setDragPreviewWidth] = useState(258);
  const [dragPreviewHeight, setDragPreviewHeight] = useState(100);
  const [dragTarget, setDragTarget] = useState<{
    columnId: ColumnId;
    beforeCardId?: string;
  } | null>(null);
  const dragStartCardsRef = useRef<KanbanCard[] | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragScrollFrameRef = useRef<number | null>(null);
  const dragPlacementRef = useRef<{ columnId: ColumnId; beforeCardId?: string } | null>(null);
  useEffect(() => () => {
    document.body.classList.remove("kanban-card-dragging");
    if (dragScrollFrameRef.current !== null) cancelAnimationFrame(dragScrollFrameRef.current);
  }, []);
  const drawerRef = useRef<DrawerHandle>(null);
  const defaultColumnIdRef = useRef<ColumnId>("a-fazer");
  const [mobileColumn, setMobileColumn] = useState<ColumnId>("a-fazer");
  const [desktopBoard, setDesktopBoard] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const main = document.querySelector("main");
    if (!main) return;
    const previousOverflow = root.style.overflowY;
    const updateOverflow = () => {
      const fits = window.matchMedia("(min-width: 1280px)").matches &&
        main.getBoundingClientRect().bottom <= window.innerHeight;
      root.style.overflowY = fits ? "hidden" : previousOverflow;
    };
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(main);
    window.addEventListener("resize", updateOverflow);
    updateOverflow();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOverflow);
      root.style.overflowY = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktopBoard(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [newColumnOpen, setNewColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<KanbanColumn | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<KanbanColumn | null>(null);
  const [copyColumnTarget, setCopyColumnTarget] = useState<KanbanColumn | null>(null);
  const [copyColumnName, setCopyColumnName] = useState("");
  const [moveColumnTarget, setMoveColumnTarget] = useState<KanbanColumn | null>(null);
  const [moveBoardId, setMoveBoardId] = useState("");
  const [movePosition, setMovePosition] = useState(1);
  const [moveBoards, setMoveBoards] = useState<BoardSummary[]>([]);
  const [moveColumnCount, setMoveColumnCount] = useState(0);
  const [columnActionBusy, setColumnActionBusy] = useState(false);
  const [followedColumns, setFollowedColumns] = useState<Set<ColumnId>>(getInitialFollowedColumns);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [boardSwitcherOpen, setBoardSwitcherOpen] = useState(false);
  const [boardMenuTab, setBoardMenuTab] = useState<"about" | "activity" | "archive">("about");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [collaborationTab, setCollaborationTab] = useState<"share" | "background">("share");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  useEffect(() => {
    if (!boardId) return;
    let active = true;
    const loadMembers = () => {
      void Promise.all([listBoardMembers({ boardId }), listAvailableMembers()])
        .then(([board, available]) => {
          if (!active) return;
          const members = new Map(available.members.map((member) => [member.id, member]));
          board.members.forEach((member) => members.set(member.id, member));
          setBoardMembers(board.members);
          setCardMembers([...members.values()]);
        })
        .catch(() => {
          void listBoardMembers({ boardId }).then(({ members }) => {
            if (active) {
              setBoardMembers(members);
              setCardMembers(members);
            }
          }).catch(() => {});
        });
    };
    loadMembers();
    window.addEventListener("procion:avatar-updated", loadMembers);
    return () => {
      active = false;
      window.removeEventListener("procion:avatar-updated", loadMembers);
    };
  }, [boardId, reloadKey]);
  const headerMembers = useMemo(() => {
    const members = new Map(boardMembers.map((member) => [member.id, member]));
    const directory = new Map<string, BoardMember>();
    for (const member of cardMembers) {
      directory.set(member.id, member);
      if (member.operator) directory.set(member.operator, member);
    }
    for (const card of cards) {
      for (const id of [card.assigneeId, ...(card.participants ?? [])]) {
        const member = directory.get(id);
        if (member) members.set(member.id, member);
      }
    }
    return [...members.values()];
  }, [boardMembers, cardMembers, cards]);
  const activeFilterCount =
    Object.values(filters).filter((v) => v !== "all").length + (onlyMine ? 1 : 0);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [cards]);
  const clientOptions = useMemo(
    () => [...new Set(cards.map((card) => card.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [cards],
  );

  useEffect(() => {
    let active = true;
    setLoadingBoard(true);
    setLoadError(false);
    Promise.all([
      loadKanbanBoard({ data: { boardId: boardIdParam } }),
      getKanbanBoard({ boardId: boardIdParam }),
    ])
      .then(([result, summary]) => {
        if (!active || !result.board) {
          if (active) setLoadError(true);
          return;
        }
        setBoardId(result.board.id);
        setBoardName(result.board.name ?? "");
        setBoardSummary(summary.board);
        setColumns(result.columns);
        kanbanStore.hydrate(result.cards as KanbanCard[]);
        defaultColumnIdRef.current = result.columns[0]?.id ?? "a-fazer";
        setMobileColumn(result.columns[0]?.id ?? "a-fazer");
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      })
      .finally(() => active && setLoadingBoard(false));
    return () => {
      active = false;
    };
  }, [reloadKey, boardIdParam]);

  useEffect(() => {
    window.localStorage.setItem(
      FOLLOWED_COLUMNS_STORAGE_KEY,
      JSON.stringify(Array.from(followedColumns)),
    );
  }, [followedColumns]);

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (c.archived) return false;
      if (onlyMine) {
        const isMine =
          c.assigneeId === actorId || (actorId && (c.participants ?? []).includes(actorId));
        if (!isMine) return false;
      }
      if (filters.client !== "all" && c.client !== filters.client) return false;
      if (filters.assignee !== "all" && c.assigneeId !== filters.assignee) return false;
      if (filters.priority !== "all" && c.priority !== filters.priority) return false;
      if (filters.type !== "all" && c.type !== filters.type) return false;
      if (filters.status !== "all" && c.columnId !== filters.status) return false;
      if (filters.tag !== "all" && !c.tags.includes(filters.tag)) return false;
      if (filters.completion !== "all") {
        const column = columns.find((item) => item.id === c.columnId);
        const isCompleted =
          c.columnId === "arquivado" ||
          /conclu|finaliz|arquivad/i.test(column?.title ?? "");
        if (filters.completion === "completed" && !isCompleted) return false;
        if (filters.completion === "open" && isCompleted) return false;
      }
      if (filters.due !== "all") {
        if (!c.dueDate) {
          if (filters.due !== "no-date") return false;
        } else {
          const diff = daysBetween(c.dueDate);
          if (filters.due === "overdue" && diff >= 0) return false;
          if (filters.due === "today" && diff !== 0) return false;
          if (filters.due === "week" && (diff < 0 || diff > 7)) return false;
          if (filters.due === "no-date") return false;
        }
      }
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.module.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [cards, query, filters, onlyMine, columns, actorId]);

  const cardsByColumn = useMemo(() => {
    const grouped = Object.fromEntries(
      columns.map((col) => [col.id, [] as KanbanCard[]]),
    ) as Record<ColumnId, KanbanCard[]>;
    const fallbackColumn = columns[0]?.id ?? "a-fazer";
    for (const c of filteredCards) {
      (grouped[c.columnId] ?? grouped[fallbackColumn]).push(c);
    }
    return grouped;
  }, [filteredCards, columns]);

  const stopDragScroll = () => {
    if (dragScrollFrameRef.current !== null) cancelAnimationFrame(dragScrollFrameRef.current);
    dragScrollFrameRef.current = null;
    dragPointerRef.current = null;
    dragStartPointerRef.current = null;
  };

  const scrollWhileDragging = () => {
    const root = scrollRootRef.current;
    const pointer = dragPointerRef.current;
    if (root && pointer) {
      const rect = root.getBoundingClientRect();
      if (pointer.y >= rect.top - 24 && pointer.y <= rect.bottom + 24) {
        const edge = 90;
        const right = pointer.x >= rect.right - edge && pointer.x <= rect.right + 32;
        const left = pointer.x <= rect.left + edge && pointer.x >= rect.left - 32;
        if (right || left) {
          const distance = right ? rect.right - pointer.x : pointer.x - rect.left;
          const speed = Math.max(8, Math.round((edge - distance) / 2.5));
          root.scrollLeft += right ? speed : -speed;
        }
      }
    }
    dragScrollFrameRef.current = requestAnimationFrame(scrollWhileDragging);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const c = cards.find((x) => x.id === e.active.id);
    if (!c) return;
    const target = e.activatorEvent.target;
    const cardElement = target instanceof Element ? target.closest("[data-kanban-card]") : null;
    const measuredWidth = cardElement?.getBoundingClientRect().width;
    const measuredHeight = cardElement?.getBoundingClientRect().height;
    setDragPreviewWidth(measuredWidth && measuredWidth > 100 ? measuredWidth : 258);
    setDragPreviewHeight(measuredHeight && measuredHeight > 40 ? measuredHeight : 100);
    dragStartCardsRef.current = cards;
    dragPlacementRef.current = null;
    setDragTarget(null);
    setActiveCard(c);
    const event = e.activatorEvent as MouseEvent;
    if (desktopBoard && typeof event.clientX === "number") {
      dragStartPointerRef.current = { x: event.clientX, y: event.clientY };
      dragPointerRef.current = dragStartPointerRef.current;
      dragScrollFrameRef.current = requestAnimationFrame(scrollWhileDragging);
    }
    document.body.classList.add("kanban-card-dragging");
  };

  const handleDragMove = (e: DragMoveEvent) => {
    const start = dragStartPointerRef.current;
    if (start) dragPointerRef.current = { x: start.x + e.delta.x, y: start.y + e.delta.y };
  };

  const resolveOverColumn = (
    over: DragEndEvent["over"],
    currentCards: KanbanCard[],
  ): ColumnId | undefined => {
    if (!over) return undefined;
    const overType = over.data.current?.type;
    if (overType === "column") {
      return over.data.current?.columnId as ColumnId | undefined;
    }
    if (overType === "card") {
      return (
        (over.data.current?.card?.columnId as ColumnId | undefined) ??
        currentCards.find((c) => c.id === over.id)?.columnId
      );
    }
    return columns.find((col) => col.id === over.id)?.id;
  };

  const moveCardToColumn = (activeId: string, targetColumn: ColumnId, overCardId?: string) => {
    setCards((prev) => moveCardInList(prev, activeId, targetColumn, overCardId));
  };

  const handleDragOver = (e: DragOverEvent) => {
    const targetColumn = resolveOverColumn(e.over, cards);
    if (!targetColumn) return;
    const overCardId = e.over?.data.current?.type === "card" ? String(e.over.id) : undefined;
    const previousPlacement = dragPlacementRef.current;
    const beforeCardId =
      overCardId ??
      (previousPlacement?.columnId === targetColumn ? previousPlacement.beforeCardId : undefined);
    const placement = { columnId: targetColumn, beforeCardId };
    dragPlacementRef.current = placement;
    if (previousPlacement?.columnId !== targetColumn) setDragTarget(placement);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    stopDragScroll();
    setActiveCard(null);
    setDragTarget(null);
    document.body.classList.remove("kanban-card-dragging");
    if (over?.data.current?.type === "action") {
      const card = kanbanStore.getSnapshot().find((item) => item.id === active.id);
      dragStartCardsRef.current = null;
      dragPlacementRef.current = null;
      if (card && over.data.current.action === "archive") handleArchiveCard(card);
      if (card && over.data.current.action === "delete" && canDeleteCard) setCardDeleteTarget(card);
      return;
    }
    const currentCards = kanbanStore.getSnapshot();
    const targetColumn = resolveOverColumn(over, currentCards);
    const overCardId =
      resolveOverColumn(over, currentCards) === targetColumn && over?.data.current?.type === "card"
        ? String(over.id)
        : undefined;
    if (!targetColumn || over?.id === active.id) {
      dragStartCardsRef.current = null;
      dragPlacementRef.current = null;
      return;
    }
    const previewPlacement = dragPlacementRef.current;
    const beforeCardId =
      overCardId && overCardId !== String(active.id)
        ? overCardId
        : previewPlacement?.columnId === targetColumn
          ? previewPlacement.beforeCardId
          : undefined;
    moveCardToColumn(String(active.id), targetColumn, beforeCardId);
    const originalCards = dragStartCardsRef.current;
    const finalCards = kanbanStore.getSnapshot();
    const originalIndex = originalCards?.findIndex((card) => card.id === active.id);
    const finalIndex = finalCards.findIndex((card) => card.id === active.id);
    const didMove =
      originalIndex !== finalIndex ||
      originalCards?.[originalIndex ?? -1]?.columnId !== finalCards[finalIndex]?.columnId;
    const previousColumnId = originalCards?.[originalIndex ?? -1]?.columnId;
    dragStartCardsRef.current = null;
    dragPlacementRef.current = null;
    if (didMove && /^[0-9a-f-]{36}$/i.test(String(active.id))) {
      void moveKanbanCard({
        data: {
          cardId: String(active.id),
          columnId: targetColumn,
          beforeCardId:
            beforeCardId && /^[0-9a-f-]{36}$/i.test(beforeCardId) ? beforeCardId : undefined,
        },
      }).then(() => {
        if (!previousColumnId) return;
        const moved = kanbanStore.getSnapshot().find((card) => card.id === active.id);
        if (!moved) return;
        const from = columns.find((column) => column.id === previousColumnId)?.title ?? previousColumnId;
        const to = columns.find((column) => column.id === targetColumn)?.title ?? targetColumn;
        kanbanStore.updateCard({
          ...moved,
          activity: [...(moved.activity ?? []), {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            text: previousColumnId === targetColumn
              ? `Posição alterada em "${to}"`
              : `Movido de "${from}" para "${to}"`,
            authorId: actorId,
            authorName: actorName,
            authorOperator: operator || undefined,
          }],
        });
      }).catch(() => {
        toast.error("Não foi possível salvar a movimentação");
        void loadKanbanBoard({ data: { boardId: boardIdParam } }).then((result) =>
          kanbanStore.hydrate(result.cards as KanbanCard[]),
        );
      });
    }
  };

  const handleDragCancel = () => {
    stopDragScroll();
    dragStartCardsRef.current = null;
    dragPlacementRef.current = null;
    setActiveCard(null);
    setDragTarget(null);
    document.body.classList.remove("kanban-card-dragging");
  };

  const openCard = (card: KanbanCard) => {
    drawerRef.current?.open({ card, mode: "edit", defaultColumnId: card.columnId });
  };

  const handleArchiveCard = (card: KanbanCard) => {
    const archiveColumn = columns.find((column) => /arquiv|finaliz/i.test(column.title));
    kanbanStore.updateCard({
      ...card,
      columnId: archiveColumn?.id ?? card.columnId,
      archived: true,
    });
    toast.success("Cartão arquivado", {
      action: {
        label: "Ver no arquivo",
        onClick: () => {
          setBoardMenuTab("archive");
          setBoardMenuOpen(true);
        },
      },
    });
  };

  const handleRestoreCard = (card: KanbanCard) => {
    const fallbackColumn = columns.find((column) => column.id !== "arquivado")?.id ?? "a-fazer";
    kanbanStore.updateCard({ ...card, columnId: fallbackColumn, archived: false });
    toast.success(`Card "${card.title}" restaurado`);
  };

  const handleNewCard = (columnId: ColumnId = "a-fazer") => {
    defaultColumnIdRef.current = columnId;
    drawerRef.current?.open({ card: null, mode: "create", defaultColumnId: columnId });
  };

  const handleUseTemplate = (template: KanbanCardTemplate) => {
    const columnId = columns.some((column) => column.id === defaultColumnIdRef.current)
      ? defaultColumnIdRef.current
      : (columns[0]?.id ?? "a-fazer");
    setTemplatesOpen(false);
    drawerRef.current?.open({
      card: templateToCard(template, columnId),
      mode: "create",
      defaultColumnId: columnId,
    });
  };

  const handleSave = (card: KanbanCard, mode: DrawerRequest["mode"]) => {
    if (mode === "create") kanbanStore.addCard(card);
    else kanbanStore.updateCard(card);
  };

  const handleQuickMove = async (card: KanbanCard, columnId: ColumnId) => {
    if (card.columnId === columnId) return;
    moveCardToColumn(card.id, columnId);
    try {
      await moveKanbanCard({ cardId: card.id, columnId });
      const moved = kanbanStore.getSnapshot().find((item) => item.id === card.id);
      if (!moved) return;
      const from = columns.find((column) => column.id === card.columnId)?.title ?? card.columnId;
      const to = columns.find((column) => column.id === columnId)?.title ?? columnId;
      kanbanStore.updateCard({
        ...moved,
        activity: [...(moved.activity ?? []), {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          text: `Movido de "${from}" para "${to}"`,
          authorId: actorId,
          authorName: actorName,
          authorOperator: operator || undefined,
        }],
      });
    } catch {
      toast.error("Não foi possível mover o cartão");
      void loadKanbanBoard({ boardId: boardIdParam }).then((result) =>
        kanbanStore.hydrate(result.cards as KanbanCard[]),
      );
    }
  };

  const handleDelete = (id: string) => {
    if (!canDeleteCard) return;
    const card = kanbanStore.getSnapshot().find((item) => item.id === id);
    if (card) setCardDeleteTarget(card);
  };

  const confirmDeleteCard = async () => {
    if (!cardDeleteTarget || !canDeleteCard) return;
    setDeleteBusy(true);
    try {
      if (/^[0-9a-f-]{36}$/i.test(cardDeleteTarget.id)) {
        await deleteKanbanCard({ id: cardDeleteTarget.id });
      }
      setCards((previous) => previous.filter((item) => item.id !== cardDeleteTarget.id));
      toast.success("Cartão excluído");
      setCardDeleteTarget(null);
    } catch {
      toast.error("Não foi possível excluir o cartão");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleNewColumn = () => {
    setNewColumnName("");
    setNewColumnOpen(true);
  };

  const confirmNewColumn = async () => {
    const cleanTitle = newColumnName.trim();
    if (!cleanTitle) {
      toast.error("Informe um nome para a coluna");
      return;
    }
    if (!boardId) {
      toast.error("Quadro ainda não carregado");
      return;
    }
    const result = await createKanbanColumn({ data: { boardId, title: cleanTitle } });
    const id = result.id;
    setColumns((prev) => [...prev, { id, title: cleanTitle }]);
    setMobileColumn(id);
    setNewColumnOpen(false);
    setNewColumnName("");
    toast.success(`Coluna "${cleanTitle}" criada`);
  };

  const handleDeleteColumn = (column: KanbanColumn) => {
    if (columns.length <= 1) {
      toast.error("Não é possível excluir a última coluna");
      return;
    }
    setDeleteTarget(column);
  };

  const confirmDeleteColumn = async () => {
    if (!deleteTarget) return;
    if (columns.length <= 1) return;
    const column = deleteTarget;
    const nextColumns = columns.filter((col) => col.id !== column.id);
    const fallbackColumn = nextColumns[0]?.id ?? "a-fazer";
    await deleteKanbanColumn({ data: { id: column.id, fallbackId: fallbackColumn } });
    setColumns(nextColumns);
    setCards((prev) =>
      prev.map((card) =>
        card.columnId === column.id
          ? { ...card, columnId: fallbackColumn, archived: fallbackColumn === "arquivado" }
          : card,
      ),
    );
    setFilters((prev) => (prev.status === column.id ? { ...prev, status: "all" } : prev));
    if (mobileColumn === column.id) setMobileColumn(fallbackColumn);
    setDeleteTarget(null);
    toast.success(`Coluna "${column.title}" excluída`);
  };

  const handleCopyColumn = (column: KanbanColumn) => {
    setCopyColumnTarget(column);
    setCopyColumnName(column.title);
  };

  const confirmCopyColumn = async () => {
    if (!copyColumnTarget || !copyColumnName.trim()) return;
    setColumnActionBusy(true);
    try {
      await copyKanbanColumn({ id: copyColumnTarget.id, title: copyColumnName.trim() });
      const result = await loadKanbanBoard({ data: { boardId: boardIdParam } });
      setColumns(result.columns);
      kanbanStore.hydrate(result.cards as KanbanCard[]);
      setCopyColumnTarget(null);
      toast.success(`Lista "${copyColumnName.trim()}" criada`);
    } catch {
      toast.error("Não foi possível copiar a lista");
    } finally {
      setColumnActionBusy(false);
    }
  };

  const handleMoveColumn = (column: KanbanColumn) => {
    setMoveColumnTarget(column);
    setMoveBoards(boardSummary ? [boardSummary] : []);
    setMoveBoardId(boardId ?? "");
    setMovePosition(columns.findIndex((item) => item.id === column.id) + 1);
    setMoveColumnCount(columns.length);
    void listKanbanBoards()
      .then((result) => setMoveBoards(result.boards))
      .catch(() => toast.error("Não foi possível carregar os quadros"));
  };

  const selectMoveBoard = async (targetBoardId: string) => {
    setMoveBoardId(targetBoardId);
    setMovePosition(1);
    try {
      if (targetBoardId === boardId) setMoveColumnCount(columns.length);
      else {
        const result = await loadKanbanBoard({ boardId: targetBoardId });
        setMoveColumnCount(result.columns.length + 1);
      }
    } catch {
      setMoveColumnCount(0);
      toast.error("Não foi possível carregar o quadro de destino");
    }
  };

  const confirmMoveColumn = async () => {
    if (!moveColumnTarget || !moveBoardId || moveColumnCount < 1) return;
    setColumnActionBusy(true);
    try {
      await moveKanbanColumn({
        id: moveColumnTarget.id,
        boardId: moveBoardId,
        position: movePosition,
      });
      const result = await loadKanbanBoard({ boardId: boardIdParam });
      setColumns(result.columns);
      kanbanStore.hydrate(result.cards as KanbanCard[]);
      setMobileColumn(result.columns[0]?.id ?? "a-fazer");
      setMoveColumnTarget(null);
      toast.success("Lista movida");
    } catch {
      toast.error("Não foi possível mover a lista");
    } finally {
      setColumnActionBusy(false);
    }
  };

  const handleMoveAllCards = async (source: KanbanColumn, destination: KanbanColumn) => {
    try {
      const count = await moveAllKanbanCards(source.id, destination.id);
      const result = await loadKanbanBoard({ boardId: boardIdParam });
      kanbanStore.hydrate(result.cards as KanbanCard[]);
      toast.success(`${count} cartão(ões) movido(s) para "${destination.title}"`);
    } catch {
      toast.error("Não foi possível mover os cartões");
    }
  };

  const handleSortColumn = async (column: KanbanColumn, mode: KanbanColumnSortMode) => {
    try {
      await sortKanbanColumnCards(column.id, mode);
      const result = await loadKanbanBoard({ boardId: boardIdParam });
      kanbanStore.hydrate(result.cards as KanbanCard[]);
      toast.success(`Lista "${column.title}" ordenada`);
    } catch {
      toast.error("Não foi possível ordenar a lista");
    }
  };

  const confirmArchiveColumnCards = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    try {
      const result = await archiveKanbanColumnCards({ data: { columnId: target.id } });
      setCards((prev) =>
        prev.map((card) => (card.columnId === target.id ? { ...card, archived: true } : card)),
      );
      setArchiveTarget(null);
      toast.success(`${result.count} cartão(ões) arquivado(s)`);
    } catch {
      toast.error("Não foi possível arquivar os cartões da lista");
    }
  };

  const handleToggleFollow = (column: KanbanColumn) => {
    setFollowedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column.id)) {
        next.delete(column.id);
        toast(`Você deixou de seguir "${column.title}"`);
      } else {
        next.add(column.id);
        toast.success(`Agora você está seguindo "${column.title}"`);
      }
      return next;
    });
  };

  const openBoardCard = useStableHandler(openCard);
  const archiveBoardCard = useStableHandler(handleArchiveCard);
  const deleteBoardCard = useStableHandler((card: KanbanCard) => handleDelete(card.id));
  const addBoardCard = useStableHandler(handleNewCard);
  const deleteBoardColumn = useStableHandler(handleDeleteColumn);
  const copyBoardColumn = useStableHandler(handleCopyColumn);
  const moveBoardColumn = useStableHandler(handleMoveColumn);
  const moveBoardColumnCards = useStableHandler(handleMoveAllCards);
  const sortBoardColumn = useStableHandler(handleSortColumn);
  const toggleBoardColumnFollow = useStableHandler(handleToggleFollow);

  const clearFilters = () => setFilters(emptyFilters);
  const getColumnCount = (id: ColumnId) => cardsByColumn[id]?.length ?? 0;
  const hasBgImage = !!boardSummary?.backgroundValue && boardSummary?.backgroundType !== "color";
  const boardBackgroundStyle =
    boardSummary?.backgroundType === "color" && boardSummary.backgroundValue
      ? { backgroundColor: boardSummary.backgroundValue }
      : boardSummary?.backgroundValue
        ? {
            backgroundImage: `linear-gradient(rgba(15,23,42,.18),rgba(15,23,42,.18)), url(${boardSummary.backgroundValue})`,
            backgroundSize: boardSummary.backgroundMode === "tile" ? "auto" : "cover",
            backgroundPosition: "center",
            backgroundRepeat: boardSummary.backgroundMode === "tile" ? "repeat" : "no-repeat",
          }
        : undefined;
  const hasPhotoBackground = Boolean(
    boardSummary?.backgroundValue && boardSummary.backgroundType !== "color",
  );

  return (
    <AppShell fullWidth={hasPhotoBackground}>
      <div
        style={boardBackgroundStyle}
        className="min-h-[calc(100dvh-96px)] overflow-hidden rounded-[18px] border border-slate-300 bg-slate-200 p-4 text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:min-h-[calc(100dvh-112px)] lg:min-h-[calc(100dvh-136px)] dark:border-white/8 dark:bg-[#10151f] dark:text-slate-100 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
      >
        <div
          className={cn(
            "mb-3 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between",
            hasBgImage
              ? "border-white/20 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/55"
              : "border-slate-300 bg-slate-50 dark:border-white/8 dark:bg-[#1e2633]",
          )}
        >
          <div className="min-w-0 shrink-0 lg:max-w-[260px]">
            <Link
              to="/kanban"
              className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Meus quadros
            </Link>
            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {boardName || "Kanban Prócion"}
            </h1>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap">
            <div className="relative h-9 min-w-[170px] flex-1 lg:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Buscar demandas..."
                className="h-full w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary/50 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-white/[0.055]"
              />
              <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="relative h-9 w-9 shrink-0 cursor-pointer rounded-lg border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                  title="Filtros"
                  aria-label="Abrir filtros"
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <Badge className="absolute -right-1.5 -top-1.5 h-4 min-w-4 bg-primary px-1 text-[9px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="app-scrollbar w-80 max-w-[calc(100vw-24px)] overflow-y-scroll p-0"
                align="end"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                style={{ maxHeight: "min(620px, var(--radix-popover-content-available-height))" }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="sticky top-0 z-10 flex w-full items-center justify-between border-b bg-popover px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">Filtrar cartões</p>
                      <p className="text-[11px] text-muted-foreground">
                        Combine critérios para refinar o quadro.
                      </p>
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearFilters}
                        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-4 px-4 pb-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                      Conclusão
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <FilterChoiceButton
                        active={filters.completion === "open"}
                        label="Em aberto"
                        onClick={() =>
                          setFilters({
                            ...filters,
                            completion: filters.completion === "open" ? "all" : "open",
                          })
                        }
                      />
                      <FilterChoiceButton
                        active={filters.completion === "completed"}
                        label="Concluídos"
                        onClick={() =>
                          setFilters({
                            ...filters,
                            completion: filters.completion === "completed" ? "all" : "completed",
                          })
                        }
                      />
                    </div>
                  </div>
                  <FilterSelect
                    label="Cliente"
                    value={filters.client}
                    onChange={(v) => setFilters({ ...filters, client: v })}
                    options={[
                      { value: "all", label: "Todos" },
                      ...clientOptions.map((client) => ({ value: client, label: client })),
                    ]}
                  />
                  <FilterSelect
                    label="Responsável"
                    value={filters.assignee}
                    onChange={(v) => setFilters({ ...filters, assignee: v })}
                    options={[
                      { value: "all", label: "Todos" },
                      ...boardMembers.map((member) => ({
                        value: member.id,
                        label: member.operator ? `${member.name} (${member.operator})` : member.name,
                      })),
                    ]}
                  />
                  <FilterSelect
                    label="Prioridade"
                    value={filters.priority}
                    onChange={(v) => setFilters({ ...filters, priority: v as Priority | "all" })}
                    options={[
                      { value: "all", label: "Todas" },
                      ...priorities.map((p) => ({ value: p, label: p })),
                    ]}
                  />
                  <FilterSelect
                    label="Tipo"
                    value={filters.type}
                    onChange={(v) => setFilters({ ...filters, type: v as CardType | "all" })}
                    options={[
                      { value: "all", label: "Todos" },
                      ...cardTypes.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                  <FilterSelect
                    label="Status"
                    value={filters.status}
                    onChange={(v) => setFilters({ ...filters, status: v })}
                    options={[
                      { value: "all", label: "Todos" },
                      ...columns.map((c) => ({ value: c.id, label: c.title })),
                    ]}
                  />
                  <FilterSelect
                    label="Etiqueta"
                    value={filters.tag}
                    onChange={(v) => setFilters({ ...filters, tag: v })}
                    options={[
                      { value: "all", label: "Todas" },
                      ...allTags.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                  <FilterSelect
                    label="Prazo"
                    value={filters.due}
                    onChange={(v) => setFilters({ ...filters, due: v as DueFilter })}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "overdue", label: "Atrasados" },
                      { value: "today", label: "Vence hoje" },
                      { value: "week", label: "Próximos 7 dias" },
                      { value: "no-date", label: "Sem prazo" },
                    ]}
                  />
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={() => setOnlyMine((v) => !v)}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition",
                onlyMine
                  ? "border-violet-500/60 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
              )}
              title="Ver somente cards em que você é responsável ou participante"
            >
              <Star className={cn("h-4 w-4", onlyMine && "fill-current")} />
              <span className="sr-only">Meus cards</span>
            </button>

            <button
              onClick={() => setTemplatesOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              title="Criar cartão a partir de um template"
            >
              <FileStack className="h-4 w-4" />
              <span className="sr-only">Templates</span>
            </button>

            <div className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-white/8 dark:bg-white/[0.035]">
              <ViewToggleButton
                active={viewMode === "kanban"}
                onClick={() => setViewMode("kanban")}
                icon={LayoutGrid}
                label="Kanban"
              />
              <ViewToggleButton
                active={viewMode === "inbox"}
                onClick={() => setViewMode("inbox")}
                icon={Inbox}
                label="Caixa de entrada"
              />
              <ViewToggleButton
                active={viewMode === "planner"}
                onClick={() => setViewMode("planner")}
                icon={CalendarDays}
                label="Planejador"
              />
              <ViewToggleButton
                active={viewMode === "list"}
                onClick={() => setViewMode("list")}
                icon={List}
                label="Lista"
              />
            </div>

            {headerMembers.length > 0 && (
              <div className="flex shrink-0 items-center -space-x-2" aria-label="Pessoas no quadro">
                {headerMembers.slice(0, 4).map((member) => (
                  <Avatar key={member.id} title={member.name} className="h-7 w-7 border-2 border-white dark:border-[#1e2530]">
                    <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                    <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">
                      {member.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {headerMembers.length > 4 && <span className="grid h-7 min-w-7 place-items-center rounded-full border-2 border-white bg-muted px-1 text-[9px] font-semibold dark:border-[#1e2530]">+{headerMembers.length - 4}</span>}
              </div>
            )}
            <button
              onClick={() => {
                setCollaborationTab("share");
                setCollaborationOpen(true);
              }}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/15"
              aria-label="Compartilhar quadro"
              title="Compartilhar"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setCollaborationTab("background");
                setCollaborationOpen(true);
              }}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/15"
              aria-label="Alterar fundo do quadro"
              title="Alterar fundo"
            >
              <Palette className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setBoardMenuTab("archive");
                setBoardMenuOpen(true);
              }}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Abrir cartões arquivados"
              title="Arquivo"
            >
              <ArchiveIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setBoardMenuTab("about");
                setBoardMenuOpen(true);
              }}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Abrir menu do quadro"
            >
              <Layers3 className="h-4 w-4" />
            </button>
            <BoardNotifications boardId={boardId ?? ""} cards={cards} onOpenCard={openCard} />
          </div>
        </div>

        {loadingBoard ? (
          <div className="grid min-h-[420px] place-items-center text-sm text-slate-500">
            Carregando quadro do Supabase...
          </div>
        ) : loadError ? (
          <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <div className="max-w-md">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Não foi possível carregar o quadro. Tente novamente.
              </p>
              <Button
                size="sm"
                className="mt-4 cursor-pointer"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <KanbanListView cards={filteredCards} columns={columns} boardMembers={cardMembers} onOpenCard={openCard} />
        ) : viewMode === "inbox" ? (
          <KanbanInboxView
            cards={filteredCards}
            columns={columns}
            boardMembers={cardMembers}
            onOpenCard={openCard}
            onMoveCard={handleQuickMove}
            onCreateCard={() => handleNewCard(columns[0]?.id ?? "a-fazer")}
          />
        ) : viewMode === "planner" ? (
          <KanbanPlannerView
            cards={filteredCards}
            date={calendarDate}
            onDateChange={setCalendarDate}
            onOpenCard={openCard}
            onSchedule={(card, dueDate) => kanbanStore.updateCard({ ...card, dueDate })}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={kanbanCollisionDetection}
            autoScroll={false}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {/* Mount only one layout: duplicate DnD IDs register hidden, zero-size nodes. */}
            {desktopBoard ? (
              <div>
                <div ref={scrollRootRef} className="overflow-x-auto kanban-scrollbar">
                  <div className="flex min-w-max items-start gap-4 pb-2">
                    {columns.map((col) => (
                      <KanbanColumnView
                        key={col.id}
                        boardId={boardId ?? undefined}
                        boardMembers={cardMembers}
                        column={col}
                        columns={columns}
                        cards={cardsByColumn[col.id]}
                        dragPlaceholder={
                          activeCard &&
                          dragTarget?.columnId === col.id &&
                          activeCard.columnId !== col.id
                            ? { beforeCardId: dragTarget.beforeCardId, height: dragPreviewHeight }
                            : undefined
                        }
                        onCardClick={openBoardCard}
                        onArchiveCard={archiveBoardCard}
                        onDeleteCard={deleteBoardCard}
                        canDeleteCard={canDeleteCard}
                        onAddCard={addBoardCard}
                        onDeleteColumn={deleteBoardColumn}
                        canDeleteColumn={columns.length > 1}
                        onCopyColumn={copyBoardColumn}
                        onMoveColumn={moveBoardColumn}
                        onMoveAllCards={moveBoardColumnCards}
                        onSortColumn={sortBoardColumn}
                        isFollowing={followedColumns.has(col.id)}
                        onToggleFollow={toggleBoardColumnFollow}
                        onArchiveAll={setArchiveTarget}
                      />
                    ))}
                    <button
                      onClick={handleNewColumn}
                      className="flex h-7 w-[210px] shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-slate-100 px-2.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar outra lista
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Tabs value={mobileColumn} onValueChange={(v) => setMobileColumn(v as ColumnId)}>
                  <TabsList className="mb-3 flex h-auto w-full justify-start overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/6">
                    {columns.map((c) => (
                      <TabsTrigger
                        key={c.id}
                        value={c.id}
                        className="cursor-pointer whitespace-nowrap text-xs text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-slate-300 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                      >
                        {c.title}
                        <span className="ml-1.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-white/10 dark:bg-white/10">
                          {cardsByColumn[c.id]?.length ?? 0}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                {columns
                  .filter((c) => c.id === mobileColumn)
                  .map((col) => {
                    return (
                      <KanbanColumnView
                        key={col.id}
                        boardId={boardId ?? undefined}
                        boardMembers={cardMembers}
                        column={col}
                        columns={columns}
                        cards={cardsByColumn[col.id]}
                        dragPlaceholder={
                          activeCard &&
                          dragTarget?.columnId === col.id &&
                          activeCard.columnId !== col.id
                            ? { beforeCardId: dragTarget.beforeCardId, height: dragPreviewHeight }
                            : undefined
                        }
                        onCardClick={openBoardCard}
                        onArchiveCard={archiveBoardCard}
                        onDeleteCard={deleteBoardCard}
                        canDeleteCard={canDeleteCard}
                        onAddCard={addBoardCard}
                        onDeleteColumn={deleteBoardColumn}
                        canDeleteColumn={columns.length > 1}
                        onCopyColumn={copyBoardColumn}
                        onMoveColumn={moveBoardColumn}
                        onMoveAllCards={moveBoardColumnCards}
                        onSortColumn={sortBoardColumn}
                        isFollowing={followedColumns.has(col.id)}
                        onToggleFollow={toggleBoardColumnFollow}
                        onArchiveAll={setArchiveTarget}
                      />
                    );
                  })}
                <button
                  onClick={handleNewColumn}
                  className="mt-3 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar outra lista
                </button>
              </div>
            )}

            {activeCard && (
              <div className="fixed bottom-20 left-1/2 z-[1001] flex -translate-x-1/2 gap-3 pointer-events-auto">
                <KanbanDropTarget action="archive" label="Arquivar" icon={ArchiveIcon} />
                {canDeleteCard && <KanbanDropTarget action="delete" label="Excluir" icon={TrashIcon} />}
              </div>
            )}

            {typeof document !== "undefined" &&
              createPortal(
                <DragOverlay
                  zIndex={1000}
                  dropAnimation={null}
                  style={{
                    width: dragPreviewWidth,
                    minWidth: dragPreviewWidth,
                    height: "auto",
                    pointerEvents: "none",
                    willChange: "transform",
                  }}
                >
                  {activeCard && <KanbanCardPreview card={activeCard} />}
                </DragOverlay>,
                document.body,
              )}
          </DndContext>
        )}
        {!loadingBoard && !loadError && (
          <div className="mx-auto mt-3 flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white/90 p-1 dark:border-white/10 dark:bg-[#171a20]/95">
            {([
              { mode: "inbox" as const, label: "Caixa de entrada", icon: Inbox },
              { mode: "planner" as const, label: "Planejador", icon: CalendarDays },
              { mode: "kanban" as const, label: "Quadro", icon: Columns3 },
            ]).map(({ mode, label, icon: Icon }) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)} aria-pressed={viewMode === mode} className={cn("flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-medium transition", viewMode === mode ? "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10")}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
            <button type="button" onClick={() => setBoardSwitcherOpen(true)} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              <LayoutGrid className="h-4 w-4" /> Mudar de quadros
            </button>
          </div>
        )}
      </div>

      <CardDrawerHost
        ref={drawerRef}
        columns={columns}
        boardMembers={boardMembers}
        onSave={handleSave}
        onDelete={handleDelete}
        canDelete={canDeleteCard}
      />
      <BoardSwitcherDialog open={boardSwitcherOpen} onOpenChange={setBoardSwitcherOpen} currentBoardId={boardId} />

      {boardMenuOpen && (
        <KanbanBoardMenu
          open={boardMenuOpen}
          onOpenChange={setBoardMenuOpen}
          tab={boardMenuTab}
          onTabChange={setBoardMenuTab}
          cards={cards}
          columns={columns}
          followedColumns={followedColumns}
          onOpenCard={openCard}
          onRestoreCard={handleRestoreCard}
          onDeleteCard={handleDelete}
          canDeleteCard={canDeleteCard}
          onCreateColumn={handleNewColumn}
        />
      )}

      <KanbanTemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onUse={handleUseTemplate}
      />
      <BoardCollaborationDialog
        board={boardSummary}
        open={collaborationOpen}
        onOpenChange={setCollaborationOpen}
        initialTab={collaborationTab}
        onChanged={() => setReloadKey((key) => key + 1)}
      />

      <Dialog open={!!copyColumnTarget} onOpenChange={(open) => !open && setCopyColumnTarget(null)}>
        <DialogContent
          autoFooter={false}
          onOutsideClick={() => setCopyColumnTarget(null)}
          className="space-y-3 p-4 sm:max-w-[360px]"
        >
          <div className="flex items-center justify-between border-b pb-2">
            <DialogTitle className="flex-1 text-center text-sm font-normal">
              Copiar lista
            </DialogTitle>
            <button
              type="button"
              className="cursor-pointer"
              aria-label="Fechar"
              onClick={() => setCopyColumnTarget(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="block space-y-1 text-xs font-normal">
            Nome
            <textarea
              autoFocus
              value={copyColumnName}
              onChange={(event) => setCopyColumnName(event.target.value)}
              onFocus={(event) => event.target.select()}
              className="min-h-16 w-full resize-y rounded-md border border-input bg-background p-2 text-sm font-normal"
            />
          </label>
          <Button
            size="sm"
            className="font-normal"
            disabled={columnActionBusy || !copyColumnName.trim()}
            onClick={() => void confirmCopyColumn()}
          >
            Criar lista
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveColumnTarget} onOpenChange={(open) => !open && setMoveColumnTarget(null)}>
        <DialogContent
          autoFooter={false}
          onOutsideClick={() => setMoveColumnTarget(null)}
          className="space-y-3 p-4 sm:max-w-[360px]"
        >
          <div className="flex items-center justify-between border-b pb-2">
            <DialogTitle className="flex-1 text-center text-sm font-normal">
              Mover lista
            </DialogTitle>
            <button
              type="button"
              className="cursor-pointer"
              aria-label="Fechar"
              onClick={() => setMoveColumnTarget(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="block space-y-1 text-xs font-normal">
            Quadro
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
              value={moveBoardId}
              onChange={(event) => void selectMoveBoard(event.target.value)}
            >
              {moveBoards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs font-normal">
            Posição
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
              value={movePosition}
              onChange={(event) => setMovePosition(Number(event.target.value))}
            >
              {Array.from({ length: moveColumnCount }, (_, index) => (
                <option key={index} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            className="font-normal"
            disabled={columnActionBusy || !moveBoardId || moveColumnCount < 1}
            onClick={() => void confirmMoveColumn()}
          >
            Mover
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={newColumnOpen} onOpenChange={setNewColumnOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px] [&>button]:hidden">
          <DialogTitle className="sr-only">Nova coluna</DialogTitle>
          <DetailModalHeader
            icon={Columns3}
            title="Nova coluna"
            meta="Adicione uma nova coluna ao seu quadro Kanban."
            onClose={() => setNewColumnOpen(false)}
          />
          <div className="space-y-2 px-5 py-4">
            <label htmlFor="new-column-name" className="text-xs font-medium text-muted-foreground">
              Nome da coluna
            </label>
            <Input
              id="new-column-name"
              autoFocus
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Ex.: Em revisão"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmNewColumn();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setNewColumnOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="cursor-pointer bg-violet-600 text-white hover:bg-violet-500"
              onClick={confirmNewColumn}
            >
              Criar coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cardDeleteTarget} onOpenChange={(open) => !open && !deleteBusy && setCardDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px] [&>button]:hidden">
          <DialogTitle className="text-base">Excluir cartão?</DialogTitle>
          <p className="text-sm text-muted-foreground">{cardDeleteTarget?.title}</p>
          <p className="text-sm text-muted-foreground">Essa ação não pode ser desfeita.</p>
          <DialogFooter showClose={false} className="mt-3">
            <Button variant="outline" disabled={deleteBusy} onClick={() => setCardDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={() => void confirmDeleteCard()}>Excluir cartão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px] [&>button]:hidden">
          <DialogTitle className="sr-only">Excluir coluna</DialogTitle>
          <DetailModalHeader
            icon={TrashIcon}
            title="Excluir coluna"
            protocol={deleteTarget?.title}
            meta={`Os cards desta coluna serão movidos para a primeira coluna disponível${
              columns[0] && deleteTarget && columns[0].id !== deleteTarget.id
                ? ` ("${columns[0].title}")`
                : ""
            }. Essa ação não pode ser desfeita.`}
            onClose={() => setDeleteTarget(null)}
            accentClassName="bg-destructive"
            iconWrapClassName="bg-destructive text-destructive-foreground"
          />
          <DialogFooter showClose={false} className="border-t border-border bg-card px-5 py-3">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" className="cursor-pointer" onClick={confirmDeleteColumn}>
              Excluir coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px] [&>button]:hidden">
          <DialogTitle className="sr-only">Arquivar todos os cartões</DialogTitle>
          <DetailModalHeader
            icon={ArchiveIcon}
            title="Arquivar todos os cartões?"
            protocol={archiveTarget?.title}
            meta="Os cartões serão removidos do quadro e continuarão disponíveis no arquivo para restauração."
            onClose={() => setArchiveTarget(null)}
          />
          <DialogFooter className="border-t border-border bg-card px-5 py-3">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setArchiveTarget(null)}
            >
              Cancelar
            </Button>
            <Button className="cursor-pointer" onClick={confirmArchiveColumnCards}>
              Arquivar cartões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function KanbanInboxView({
  cards,
  columns,
  boardMembers,
  onOpenCard,
  onCreateCard,
  onMoveCard,
}: {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  boardMembers: BoardMember[];
  onOpenCard: (card: KanbanCard) => void;
  onCreateCard: () => void;
  onMoveCard: (card: KanbanCard, columnId: ColumnId) => void;
}) {
  const firstColumnId = columns[0]?.id;
  const inboxCards = cards.filter((card) => !card.archived && card.columnId === firstColumnId);

  return (
    <div className="grid min-h-[480px] gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1e2633]">
        <div className="flex items-center justify-between border-b px-5 py-4 dark:border-white/8">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Inbox className="h-4 w-4 text-primary" />
              Caixa de entrada
            </h2>
          </div>
          <Button size="sm" className="cursor-pointer" onClick={onCreateCard}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <div className="app-scrollbar max-h-[calc(100dvh-310px)] space-y-2 overflow-y-auto p-4">
          {inboxCards.length ? (
            inboxCards.map((card) => {
              const member = boardMembers.find((item) => item.id === card.assigneeId);
              return (
                <div
                  key={card.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 dark:border-slate-700 dark:bg-[#263244] dark:hover:border-slate-500"
                >
                  <button type="button" onClick={() => onOpenCard(card)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                      <Inbox className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{card.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{card.client} · {card.module}</span>
                    </span>
                  </button>
                  <span className="hidden rounded bg-white px-2 py-1 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-200 sm:inline-flex">{card.priority}</span>
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                      "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100",
                    )}
                    title={member?.operator || member?.name || "Sem responsável"}
                  >
                    {member?.operator?.startsWith("PRC") ? "PRC" : member?.name?.slice(0, 2).toUpperCase() ?? "--"}
                  </span>
                  {columns.length > 1 && <Select onValueChange={(columnId) => onMoveCard(card, columnId)}>
                    <SelectTrigger aria-label={`Mover ${card.title}`} className="h-8 w-28 shrink-0 cursor-pointer text-xs">
                      <SelectValue placeholder="Mover" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.filter((column) => column.id !== card.columnId).map((column) => (
                        <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>}
                </div>
              );
            })
          ) : (
            <EmptyKanbanView message="A caixa de entrada está organizada." />
          )}
        </div>
      </section>
      <aside className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1e2633]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Triagem rápida</h3>
        <div className="mt-5 space-y-3 text-xs">
          <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <span className="text-slate-600 dark:text-slate-300">Aguardando triagem</span>
            <strong className="text-slate-900 dark:text-white">{inboxCards.length}</strong>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <span className="text-slate-600 dark:text-slate-300">Sem prazo</span>
            <strong className="text-slate-900 dark:text-white">
              {inboxCards.filter((card) => !card.dueDate).length}
            </strong>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <span className="text-slate-600 dark:text-slate-300">Alta prioridade</span>
            <strong className="text-rose-500">
              {inboxCards.filter((card) => card.priority === "Alta" || card.priority === "Crítica").length}
            </strong>
          </div>
        </div>
      </aside>
    </div>
  );
}

function KanbanPlannerView({
  cards,
  date,
  onDateChange,
  onOpenCard,
  onSchedule,
}: {
  cards: KanbanCard[];
  date: Date;
  onDateChange: (date: Date) => void;
  onOpenCard: (card: KanbanCard) => void;
  onSchedule: (card: KanbanCard, dueDate: string) => void;
}) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
  const unscheduled = cards.filter((card) => !card.archived && !card.dueDate);
  const moveWeek = (amount: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount * 7);
    onDateChange(next);
  };
  const weekLabel = `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1e2633]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 dark:border-white/8">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => moveWeek(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => moveWeek(1)}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer text-xs"
            onClick={() => onDateChange(new Date())}
          >
            Esta semana
          </Button>
        </div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{weekLabel}</h2>
      </div>
      <div className="app-scrollbar overflow-x-auto">
        <div className="grid min-w-[1040px] grid-cols-[240px_repeat(7,minmax(110px,1fr))]">
          <div className="border-b border-r bg-slate-100 p-3 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-[#263244] dark:text-slate-300">
            Sem data ({unscheduled.length})
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="border-b border-r bg-slate-100 p-3 text-center dark:border-slate-700 dark:bg-[#263244]"
            >
              <span className="block text-[10px] uppercase text-slate-500">
                {day.toLocaleDateString("pt-BR", { weekday: "short" })}
              </span>
              <span className="mt-1 block text-sm font-semibold text-slate-900 dark:text-white">
                {day.getDate()}
              </span>
            </div>
          ))}
          <div className="app-scrollbar max-h-[calc(100dvh-330px)] space-y-2 overflow-y-auto border-r p-2 dark:border-white/8">
            {unscheduled.map((card) => (
              <div key={card.id} className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-[#263244]">
                <PlannerCard card={card} onOpen={() => onOpenCard(card)} />
                <input
                  type="date"
                  aria-label={`Agendar ${card.title}`}
                  className="h-8 w-full cursor-pointer rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  onChange={(event) => {
                    if (event.target.value) onSchedule(card, event.target.value);
                  }}
                />
              </div>
            ))}
            {!unscheduled.length && (
              <p className="p-3 text-center text-xs text-slate-400">Todos os cartões têm prazo.</p>
            )}
          </div>
          {weekDays.map((day) => {
            const dateKey = toLocalDateKey(day);
            const dayCards = cards.filter((card) => card.dueDate === dateKey && !card.archived);
            return (
              <div
                key={dateKey}
                className="group min-h-[420px] space-y-2 border-r p-2 dark:border-white/8"
              >
                {dayCards.map((card) => (
                  <PlannerCard key={card.id} card={card} onOpen={() => onOpenCard(card)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlannerCard({ card, onOpen }: { card: KanbanCard; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-primary/30 hover:shadow dark:border-slate-600 dark:bg-[#263244] dark:hover:bg-[#2c3a4f]"
    >
      <span className="block line-clamp-2 text-[11px] font-medium text-slate-800 dark:text-slate-100">
        {card.title}
      </span>
      <span className="mt-1 block truncate text-[9px] text-slate-500">{card.client}</span>
    </button>
  );
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function KanbanListView({
  cards,
  columns,
  boardMembers,
  onOpenCard,
}: {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  boardMembers: BoardMember[];
  onOpenCard: (card: KanbanCard) => void;
}) {
  const [sortBy, setSortBy] = useState<"title" | "column" | "assignee" | "priority" | "due">("title");
  const [descending, setDescending] = useState(false);
  const columnNames = new Map(columns.map((column) => [column.id, column.title]));
  const sortedCards = [...cards].sort((left, right) => {
    const value = (card: KanbanCard) => {
      if (sortBy === "column") return columnNames.get(card.columnId) ?? card.columnId;
      if (sortBy === "assignee") return boardMembers.find((member) => member.id === card.assigneeId)?.name ?? "";
      if (sortBy === "priority") return String(["Baixa", "Média", "Alta", "Crítica"].indexOf(card.priority));
      if (sortBy === "due") return card.dueDate || "9999-12-31";
      return card.title;
    };
    const result = value(left).localeCompare(value(right), "pt-BR", { sensitivity: "base" });
    return descending ? -result : result;
  });
  const changeSort = (field: typeof sortBy) => {
    if (sortBy === field) setDescending((value) => !value);
    else { setSortBy(field); setDescending(false); }
  };
  const priorityTone: Record<Priority, string> = {
    Alta: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    Média: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    Baixa: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    Crítica: "bg-red-700/20 text-red-700 dark:text-red-300",
  };

  if (!cards.length)
    return <EmptyKanbanView message="Nenhum cartão encontrado com os filtros atuais." />;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1e2633]">
      <div className="app-scrollbar max-h-[calc(100dvh-240px)] overflow-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[minmax(260px,2fr)_1fr_1fr_120px_130px] gap-4 border-b bg-slate-100 px-5 py-3 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-[#263244] dark:text-slate-300">
            {([ ["title", "Cartão"], ["column", "Lista"], ["assignee", "Responsável"], ["priority", "Prioridade"], ["due", "Prazo"] ] as const).map(([field, label]) => (
              <button key={field} type="button" onClick={() => changeSort(field)} className="inline-flex cursor-pointer items-center gap-1 text-left hover:text-primary" aria-label={`Ordenar por ${label}`}>
                {label}<ArrowUpDown className="h-3 w-3" />
              </button>
            ))}
          </div>
          {sortedCards.map((card) => {
            const member = boardMembers.find((item) => item.id === card.assigneeId);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onOpenCard(card)}
                className="grid w-full cursor-pointer grid-cols-[minmax(260px,2fr)_1fr_1fr_120px_130px] items-center gap-4 border-b px-5 py-3 text-left transition last:border-b-0 hover:bg-slate-50 dark:border-white/8 dark:hover:bg-white/[0.05]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                    {card.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                    {card.client} · {card.module}
                  </span>
                </span>
                <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                  {columnNames.get(card.columnId) ?? card.columnId}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                      "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100",
                    )}
                  >
                    {member?.operator?.startsWith("PRC") ? "PRC" : member?.name?.slice(0, 2).toUpperCase() ?? "--"}
                  </span>
                  <span className="truncate">{member?.operator || member?.name || "Sem responsável"}</span>
                </span>
                <span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-1 text-[10px] font-semibold",
                      priorityTone[card.priority],
                    )}
                  >
                    {card.priority}
                  </span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatKanbanDate(card.dueDate)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptyKanbanView({ message }: { message: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
      {message}
    </div>
  );
}

function formatKanbanDate(value: string) {
  if (!value) return "Sem prazo";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
  color: "blue" | "amber" | "violet" | "emerald";
}) {
  const tones = {
    blue: "bg-blue-500 text-blue-200",
    amber: "bg-amber-500 text-amber-200",
    violet: "bg-violet-500 text-violet-200",
    emerald: "bg-emerald-500 text-emerald-200",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/8 dark:bg-white/[0.045] dark:shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-3">
        <div
          className={cn("grid h-11 w-11 place-items-center rounded-xl bg-opacity-25", tones[color])}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-3xl font-black leading-none text-slate-900 dark:text-white">
              {value}
            </span>
          </div>
        </div>
      </div>
      <MiniSpark color={color} />
    </div>
  );
}

function MiniSpark({ color }: { color: "blue" | "amber" | "violet" | "emerald" }) {
  const stroke = {
    blue: "#248cff",
    amber: "#f59e0b",
    violet: "#a855f7",
    emerald: "#22c55e",
  }[color];

  return (
    <svg
      className="mt-4 h-8 w-full overflow-visible"
      viewBox="0 0 160 32"
      fill="none"
      preserveAspectRatio="none"
    >
      <path
        d="M2 24 C20 18 30 19 43 12 C56 23 74 25 91 20 C110 15 121 7 138 13 C147 17 153 15 158 12"
        stroke={stroke}
        strokeWidth="2.5"
      />
      <path
        d="M2 29 C28 25 50 25 75 24 C106 22 132 20 158 18"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />
    </svg>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
  soon,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
  soon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[11px] font-medium transition",
        active
          ? "bg-slate-700 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white",
      )}
      title={soon ? `${label} — em breve` : label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
      {soon && !active && (
        <span className="ml-1 rounded bg-amber-500/20 px-1 py-px text-[8px] font-black uppercase text-amber-700 dark:text-amber-300">
          Em breve
        </span>
      )}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 cursor-pointer text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-xs transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <CheckCircle2 className={cn("h-3.5 w-3.5", active && "fill-primary/15")} />
      {label}
    </button>
  );
}
