import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LayoutGrid,
  Plus,
  Search,
  Star,
  MoreHorizontal,
  Users,
  ListChecks,
  CalendarDays,
  Copy,
  Pencil,
  Archive,
  Trash2,
  RefreshCw,
  Settings,
  Building2,
} from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { cn } from "@/lib/utils";
import {
  listKanbanBoards,
  archiveKanbanBoard,
  deleteKanbanBoard,
  duplicateKanbanBoard,
  updateKanbanBoard,
  listKanbanWorkspaces,
  type BoardSummary,
  type WorkspaceSummary,
} from "@/lib/kanban-api";
import { CreateBoardModal } from "@/components/kanban/CreateBoardModal";
import { ManageMembersModal } from "@/components/kanban/ManageMembersModal";
import { EditBoardModal } from "@/components/kanban/EditBoardModal";
import { WorkspaceModal } from "@/components/kanban/WorkspaceModal";

export const Route = createFileRoute("/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban Prócion — Quadros" },
      {
        name: "description",
        content:
          "Quadros, projetos e demandas internas Prócion. Escolha um quadro para acessar seus cartões.",
      },
    ],
  }),
  component: KanbanRoute,
});

function KanbanRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isBoardList = pathname === "/kanban" || pathname === "/kanban/";

  return isBoardList ? <BoardListPage /> : <Outlet />;
}

type FilterTab = "all" | "mine" | "favorites";
const CURRENT_USER_ID = "u-ar"; // legacy placeholder while auth is not wired

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const COLOR_CLASSES: Record<string, string> = {
  blue: "from-sky-500 to-blue-600",
  green: "from-emerald-500 to-teal-600",
  purple: "from-violet-500 to-purple-600",
  orange: "from-amber-500 to-orange-600",
  pink: "from-pink-500 to-rose-600",
  slate: "from-slate-500 to-slate-700",
};
function coverClass(color: string | null) {
  if (color && COLOR_CLASSES[color]) return COLOR_CLASSES[color];
  return COLOR_CLASSES.blue;
}

function BoardListPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createBoardWorkspaceId, setCreateBoardWorkspaceId] = useState<string | null>(null);
  const [workspaceModal, setWorkspaceModal] = useState<{ workspace: WorkspaceSummary; tab: "settings" | "members" } | null>(null);
  const [membersFor, setMembersFor] = useState<BoardSummary | null>(null);
  const [editFor, setEditFor] = useState<BoardSummary | null>(null);
  const [deleteFor, setDeleteFor] = useState<BoardSummary | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    listKanbanWorkspaces()
      .then((res) => {
        if (!active) return;
        const nextWorkspaces = res.workspaces ?? [];
        setWorkspaces(nextWorkspaces);
        setBoards(nextWorkspaces.flatMap((workspace) => workspace.boards));
      })
      .catch(async () => {
        if (!active) return;
        try {
          const res = await listKanbanBoards();
          if (!active) return;
          const fallbackBoards = res.boards ?? [];
          const fallbackWorkspaceId = fallbackBoards.find((board) => board.workspaceId)?.workspaceId ?? "legacy";
          setBoards(fallbackBoards);
          setWorkspaces([{
            id: fallbackWorkspaceId,
            name: "Desenvolvimento Procion",
            slug: "desenvolvimento-procion",
            description: "Projetos, melhorias e demandas internas da Procion.",
            website: "",
            logoUrl: null,
            visibility: "private",
            settings: {
              memberRestriction: "admins",
              boardCreation: "members",
              boardDeletion: "admins",
              guestSharing: "admins",
            },
            membershipRole: "admin",
            membersCount: 0,
            boards: fallbackBoards,
          }]);
        } catch {
          if (active) setLoadError(true);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boards.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !b.description.toLowerCase().includes(q)) {
        return false;
      }
      if (tab === "favorites" && !b.isFavorite) return false;
      if (tab === "mine" && !b.members.some((m) => m.id === CURRENT_USER_ID || m.operator === CURRENT_USER_ID)) {
        // fallback: while auth is not wired, show boards where the current placeholder user is a member
        return false;
      }
      return true;
    });
  }, [boards, query, tab]);

  const workspaceSections = useMemo(() => {
    const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    return workspaces.map((workspace, index) => ({
      ...workspace,
      boards: filtered.filter((board) =>
        workspace.id === "legacy"
        || board.workspaceId === workspace.id
        || (index === 0 && (!board.workspaceId || !workspaceIds.has(board.workspaceId))),
      ),
    })).filter((workspace) => workspace.boards.length > 0 || !query.trim());
  }, [filtered, query, workspaces]);

  const toggleFavorite = async (board: BoardSummary) => {
    const next = !board.isFavorite;
    setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, isFavorite: next } : b)));
    try {
      await updateKanbanBoard({ data: { id: board.id, isFavorite: next } });
    } catch {
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, isFavorite: !next } : b)));
      toast.error("Não foi possível atualizar o favorito.");
    }
  };

  const handleDuplicate = async (board: BoardSummary) => {
    try {
      const res = await duplicateKanbanBoard({ data: { id: board.id } });
      toast.success("Quadro duplicado.");
      setReloadKey((k) => k + 1);
      if (res?.id) navigate({ to: "/kanban/$boardId", params: { boardId: res.id } });
    } catch {
      toast.error("Não foi possível duplicar o quadro.");
    }
  };

  const handleArchive = async (board: BoardSummary) => {
    try {
      await archiveKanbanBoard({ data: { id: board.id } });
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
      toast.success("Quadro arquivado.");
    } catch {
      toast.error("Não foi possível arquivar.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteFor) return;
    const target = deleteFor;
    setDeleteFor(null);
    try {
      await deleteKanbanBoard({ data: { id: target.id } });
      setBoards((prev) => prev.filter((b) => b.id !== target.id));
      toast.success("Quadro excluído.");
    } catch {
      toast.error("Não foi possível excluir.");
    }
  };

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-92px)] rounded-[18px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-[#050c18] dark:text-slate-100 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[22px] font-medium tracking-tight text-slate-900 dark:text-white">
              <LayoutGrid className="h-5 w-5 text-primary" />
              Kanban Prócion
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Quadros, projetos e demandas internas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative h-11 w-full min-w-[220px] shrink-0 sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Buscar quadros..."
                className="h-11 pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setCreateWorkspaceOpen(true)}
              className="h-11 cursor-pointer gap-2 rounded-lg"
            >
              <Building2 className="h-4 w-4" />
              Criar área
            </Button>
            <Button
              onClick={() => {
                setCreateBoardWorkspaceId(workspaces[0]?.id === "legacy" ? null : workspaces[0]?.id ?? null);
                setCreateOpen(true);
              }}
              className="h-11 cursor-pointer gap-2 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Criar quadro
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)} className="mb-5">
          <TabsList className="cursor-pointer">
            <TabsTrigger value="all" className="cursor-pointer">Todos</TabsTrigger>
            <TabsTrigger value="mine" className="cursor-pointer">Meus quadros</TabsTrigger>
            <TabsTrigger value="favorites" className="cursor-pointer">Favoritos</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[190px] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-white/8 dark:bg-white/5"
              />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Não foi possível carregar os quadros. Tente novamente.
            </p>
            <Button
              variant="outline"
              className="cursor-pointer gap-2"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <LayoutGrid className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {boards.length === 0
                ? "Você ainda não possui quadros. Crie o primeiro."
                : "Nenhum quadro encontrado para os filtros atuais."}
            </p>
            {boards.length === 0 && (
              <Button className="cursor-pointer gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Criar quadro
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {workspaceSections.map((workspace) => (
              <section key={workspace.id}>
                <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-medium">{workspace.name}</h2>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{workspace.description || "Área de trabalho Kanban"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" className="cursor-pointer gap-2"><LayoutGrid className="h-4 w-4" />Quadros</Button>
                    <Button variant="outline" size="sm" className="cursor-pointer gap-2" onClick={() => setWorkspaceModal({ workspace, tab: "members" })}><Users className="h-4 w-4" />Membros <span className="text-xs text-slate-400">{workspace.membersCount || ""}</span></Button>
                    <Button variant="outline" size="sm" className="cursor-pointer gap-2" onClick={() => setWorkspaceModal({ workspace, tab: "settings" })}><Settings className="h-4 w-4" />Configurações</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {workspace.boards.map((board) => (
              <div
                key={board.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-[#101827]"
              >
                <Link
                  to="/kanban/$boardId"
                  params={{ boardId: board.id }}
                  className="block cursor-pointer"
                >
                  <div
                    className={cn(
                      "h-16 w-full bg-gradient-to-r",
                      coverClass(board.color),
                    )}
                    style={board.cover ? { backgroundImage: `url(${board.cover})`, backgroundSize: "cover" } : undefined}
                  />
                  <div className="p-4">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {board.name}
                      </h3>
                    </div>
                    <p className="line-clamp-2 min-h-[32px] text-xs text-slate-500 dark:text-slate-400">
                      {board.description || "Sem descrição"}
                    </p>

                    <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1" title="Listas">
                        <LayoutGrid className="h-3 w-3" />
                        {board.columnsCount}
                      </span>
                      <span className="inline-flex items-center gap-1" title="Cartões ativos">
                        <ListChecks className="h-3 w-3" />
                        {board.cardsCount}
                      </span>
                      {board.updatedAt && (
                        <span className="inline-flex items-center gap-1" title="Última atualização">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(board.updatedAt)}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {board.members.slice(0, 4).map((m) => (
                          <div
                            key={m.id}
                            title={m.name}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-primary/15 text-[10px] font-semibold text-primary dark:border-[#101827]"
                          >
                            {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                        ))}
                        {board.members.length > 4 && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-200 text-[10px] font-semibold text-slate-600 dark:border-[#101827] dark:bg-white/10 dark:text-slate-300">
                            +{board.members.length - 4}
                          </div>
                        )}
                      </div>
                      {board.visibility && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {board.visibility === "private" ? "Privado" : "Equipe"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={board.isFavorite ? "Desfavoritar" : "Favoritar"}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      void toggleFavorite(board);
                    }}
                    className={cn(
                      "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:text-amber-500 dark:bg-black/40 dark:text-slate-300",
                      board.isFavorite && "text-amber-500",
                    )}
                  >
                    <Star className={cn("h-4 w-4", board.isFavorite && "fill-current")} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Menu do quadro"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:text-slate-900 dark:bg-black/40 dark:text-slate-300 dark:hover:text-white"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => setEditFor(board)}
                      >
                        <Pencil className="h-4 w-4" />
                        Renomear / editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => setMembersFor(board)}
                      >
                        <Users className="h-4 w-4" />
                        Gerenciar membros
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => void handleDuplicate(board)}
                      >
                        <Copy className="h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => void handleArchive(board)}
                      >
                        <Archive className="h-4 w-4" />
                        Arquivar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        onClick={() => setDeleteFor(board)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateBoardWorkspaceId(workspace.id === "legacy" ? null : workspace.id);
                      setCreateOpen(true);
                    }}
                    className="flex min-h-[190px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600 transition hover:border-primary hover:text-primary dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-300"
                  >
                    <Plus className="h-4 w-4" /> Criar novo quadro
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CreateBoardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={createBoardWorkspaceId}
        onCreated={(id) => {
          setCreateOpen(false);
          setReloadKey((k) => k + 1);
          navigate({ to: "/kanban/$boardId", params: { boardId: id } });
        }}
      />

      <WorkspaceModal
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        workspace={null}
        onChanged={() => setReloadKey((key) => key + 1)}
      />

      {workspaceModal && (
        <WorkspaceModal
          open={!!workspaceModal}
          onOpenChange={(nextOpen) => !nextOpen && setWorkspaceModal(null)}
          workspace={workspaceModal.workspace}
          initialTab={workspaceModal.tab}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      )}

      {editFor && (
        <EditBoardModal
          board={editFor}
          open={!!editFor}
          onOpenChange={(v) => !v && setEditFor(null)}
          onSaved={() => {
            setEditFor(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {membersFor && (
        <ManageMembersModal
          boardId={membersFor.id}
          boardName={membersFor.name}
          open={!!membersFor}
          onOpenChange={(v) => !v && setMembersFor(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}

      <Dialog open={!!deleteFor} onOpenChange={(v) => !v && setDeleteFor(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Excluir quadro</DialogTitle>
          <DetailModalHeader
            icon={Trash2}
            title="Excluir quadro"
            protocol={deleteFor?.name}
            meta="Esta ação não pode ser desfeita. O quadro e todos os cartões serão removidos."
            onClose={() => setDeleteFor(null)}
            accentClassName="bg-destructive"
            iconWrapClassName="bg-destructive text-destructive-foreground"
          />
          <DialogFooter showClose={false} className="border-t border-border bg-card px-5 py-3">

            <Button variant="outline" className="cursor-pointer" onClick={() => setDeleteFor(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void confirmDelete()}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
