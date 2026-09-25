import { supabase } from "@/lib/supabase";

// Client-side wrapper around the `kanban-api` Supabase Edge Function.
// The Edge Function uses SUPABASE_SERVICE_ROLE_KEY on the server; the
// frontend never sees privileged credentials.

class KanbanUnavailableError extends Error {
  constructor() {
    super("KANBAN_UNAVAILABLE");
    this.name = "KanbanUnavailableError";
  }
}

async function invoke<T>(action: string, data?: unknown): Promise<T> {
  const { data: res, error } = await supabase.functions.invoke("kanban-api", {
    body: { action, data },
  });
  if (error || !res || (res as any).error) {
    throw new KanbanUnavailableError();
  }
  return (res as { data: T }).data;
}

type Wrapped<T> = { data: T } | T;
const unwrap = <T>(x: Wrapped<T> | undefined): T =>
  (x && typeof x === "object" && "data" in (x as any) ? (x as any).data : x) as T;

/* ---------- Board (contents) ---------- */

export type BoardSummary = {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string;
  color: string | null;
  cover: string | null;
  backgroundType?: "color" | "photo" | "custom";
  backgroundValue?: string | null;
  backgroundMode?: "cover" | "tile";
  backgroundTextTheme?: "auto" | "light" | "dark";
  visibility: "team" | "private" | string;
  isFavorite: boolean;
  updatedAt: string;
  createdAt: string;
  columnsCount: number;
  cardsCount: number;
  members: {
    id: string;
    name: string;
    avatarUrl: string | null;
    operator: string | null;
    role: string;
  }[];
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  logoUrl: string | null;
  visibility: "private" | "company" | string;
  settings: {
    memberRestriction: "admins" | "members";
    boardCreation: "admins" | "members";
    boardDeletion: "admins" | "members";
    guestSharing: "admins" | "members";
  };
  membershipRole: "admin" | "member" | "guest" | string;
  membersCount: number;
  boards: BoardSummary[];
};

export const listKanbanWorkspaces = async () => {
  try {
    return await invoke<{ workspaces: WorkspaceSummary[] }>("listWorkspaces");
  } catch {
    const [{ data, error }, boardResult] = await Promise.all([
      (supabase as any).rpc("get_kanban_workspaces"),
      invoke<{ boards: BoardSummary[] }>("listBoards"),
    ]);
    if (error) throw error;
    const boards = boardResult.boards ?? [];
    const workspaces = (data ?? []) as Omit<WorkspaceSummary, "boards">[];
    const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
    return {
      workspaces: workspaces.map((workspace, index) => ({
        ...workspace,
        boards: boards.filter(
          (board) =>
            board.workspaceId === workspace.id ||
            (index === 0 && (!board.workspaceId || !knownWorkspaceIds.has(board.workspaceId))),
        ),
      })),
    };
  }
};

export const createKanbanWorkspace = (
  input: Wrapped<{
    name: string;
    slug?: string;
    description?: string;
    website?: string;
    visibility?: string;
    settings?: WorkspaceSummary["settings"];
  }>,
) => invoke<{ id: string }>("createWorkspace", unwrap(input));

export const updateKanbanWorkspace = async (
  input: Wrapped<{
    id: string;
    name?: string;
    slug?: string;
    description?: string;
    website?: string;
    visibility?: string;
    settings?: WorkspaceSummary["settings"];
  }>,
) => {
  const data = unwrap(input);
  const { error } = await (supabase as any).rpc("update_kanban_workspace", {
    workspace_id: data.id,
    workspace_name: data.name,
    workspace_slug: data.slug,
    workspace_description: data.description ?? "",
    workspace_website: data.website ?? "",
    workspace_visibility: data.visibility ?? "private",
    workspace_settings: data.settings,
  });
  if (error) throw error;
  return { ok: true as const };
};

export const listWorkspaceMembers = (input: Wrapped<{ workspaceId: string }>) =>
  invoke<{ members: BoardMember[] }>("listWorkspaceMembers", unwrap(input));

export const addWorkspaceMember = (
  input: Wrapped<{
    workspaceId: string;
    profileId: string;
    role?: "admin" | "member" | "guest";
  }>,
) => invoke<{ ok: true }>("addWorkspaceMember", unwrap(input));

export const updateWorkspaceMemberRole = (
  input: Wrapped<{
    workspaceId: string;
    profileId: string;
    role: "admin" | "member" | "guest";
  }>,
) => invoke<{ ok: true }>("updateWorkspaceMemberRole", unwrap(input));

export const removeWorkspaceMember = (
  input: Wrapped<{
    workspaceId: string;
    profileId: string;
  }>,
) => invoke<{ ok: true }>("removeWorkspaceMember", unwrap(input));

export type BoardMember = {
  id: string;
  name: string;
  email?: string | null;
  operator?: string | null;
  avatarUrl?: string | null;
  role?: string;
};

export const loadKanbanBoard = async (input: Wrapped<{ boardId: string }>) => {
  const { boardId } = unwrap(input);
  const { data, error } = await supabase.rpc("load_kanban_board_payload", {
    target_board_id: boardId,
  });
  if (error || !data) throw new KanbanUnavailableError();
  return data as { board: any; columns: any[]; cards: any[] };
};

export const getKanbanBoard = (input: Wrapped<{ boardId: string }>) =>
  invoke<{ board: BoardSummary | null }>("getBoard", unwrap(input));

export const listKanbanBoards = () => invoke<{ boards: BoardSummary[] }>("listBoards");

export const createKanbanBoard = (
  input: Wrapped<{
    name: string;
    description?: string;
    color?: string | null;
    cover?: string | null;
    visibility?: string;
    memberIds?: string[];
    ownerId?: string | null;
    workspaceId?: string | null;
  }>,
) => invoke<{ id: string }>("createBoard", unwrap(input));

export const updateKanbanBoard = (
  input: Wrapped<{
    id: string;
    name?: string;
    description?: string;
    color?: string | null;
    cover?: string | null;
    visibility?: string;
    isFavorite?: boolean;
    backgroundType?: "color" | "photo" | "custom";
    backgroundValue?: string | null;
    backgroundMode?: "cover" | "tile";
    backgroundTextTheme?: "auto" | "light" | "dark";
  }>,
) => invoke<{ ok: true }>("updateBoard", unwrap(input));

export type BoardInvite = {
  id: string;
  type: "email" | "link";
  email: string | null;
  role: "admin" | "member" | "observer";
  token: string;
  status: string;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  createdAt: string;
};

export const listBoardInvites = (input: Wrapped<{ boardId: string }>) =>
  invoke<{ invites: BoardInvite[] }>("listBoardInvites", unwrap(input));

export const createBoardInvite = (
  input: Wrapped<{
    boardId: string;
    type: "email" | "link";
    email?: string;
    role?: "admin" | "member" | "observer";
    expiresAt?: string | null;
    maxUses?: number | null;
  }>,
) =>
  invoke<{ invite: BoardInvite; joinedExistingMember?: boolean }>(
    "createBoardInvite",
    unwrap(input),
  );

export const revokeBoardInvite = (input: Wrapped<{ id: string }>) =>
  invoke<{ ok: true }>("revokeBoardInvite", unwrap(input));

export const uploadBoardBackground = (
  input: Wrapped<{
    boardId: string;
    fileName: string;
    dataUrl: string;
  }>,
) => invoke<{ url: string }>("uploadBoardBackground", unwrap(input));

export const duplicateKanbanBoard = (input: Wrapped<{ id: string }>) =>
  invoke<{ id: string }>("duplicateBoard", unwrap(input));

export const archiveKanbanBoard = (input: Wrapped<{ id: string }>) =>
  invoke<{ ok: true }>("archiveBoard", unwrap(input));

export const deleteKanbanBoard = (input: Wrapped<{ id: string }>) =>
  invoke<{ ok: true }>("deleteBoard", unwrap(input));

/* ---------- Members ---------- */

export const listAvailableMembers = (input?: Wrapped<{ query?: string }>) =>
  invoke<{ members: BoardMember[] }>("listAvailableMembers", unwrap(input ?? { data: {} }));

export const listBoardMembers = (input: Wrapped<{ boardId: string }>) =>
  invoke<{ members: BoardMember[] }>("listBoardMembers", unwrap(input));

export const addBoardMember = (
  input: Wrapped<{ boardId: string; profileId: string; role?: string }>,
) => invoke<{ ok: true }>("addBoardMember", unwrap(input));

export const updateBoardMemberRole = (
  input: Wrapped<{ boardId: string; profileId: string; role: string }>,
) => invoke<{ ok: true }>("updateBoardMemberRole", unwrap(input));

export const removeBoardMember = (input: Wrapped<{ boardId: string; profileId: string }>) =>
  invoke<{ ok: true }>("removeBoardMember", unwrap(input));

/* ---------- Cards & Columns ---------- */

export const saveKanbanCard = async (
  input: Wrapped<{
    id?: string;
    columnId: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    dueTime?: string;
    startDate?: string;
    recurrence?: string;
    reminder?: string;
    archived?: boolean;
    tags?: string[];
    tagColors?: Record<string, string>;
    memberIds?: string[];
    client?: string;
    module?: string;
    type?: string;
    summary?: string;
    checklist?: Array<{ id: string; text: string; done: boolean; checklistTitle?: string }>;
    commentsList?: Array<{ id: string; authorId: string; at: string; text: string }>;
    attachmentsList?: Array<{ id: string; name: string; size: string; kind: string; url?: string }>;
    activity?: Array<{ id: string; at: string; text: string; authorId?: string }>;
    relatedArticles?: Array<{ id: string; title: string; category: string }>;
    relatedVersions?: Array<{ id: string; version: string; date: string; note: string }>;
  }>,
) => {
  const payload = unwrap(input);
  const { data, error } = await supabase.rpc("save_kanban_card_payload_v2", {
    payload,
  });

  if (error || !data || typeof data.id !== "string") {
    throw new KanbanUnavailableError();
  }

  return data as { id: string };
};

export const moveKanbanCard = (
  input: Wrapped<{
    cardId: string;
    columnId: string;
    beforeCardId?: string;
  }>,
) => invoke<{ ok: true }>("moveCard", unwrap(input));

export const deleteKanbanCard = (input: Wrapped<{ id: string }>) =>
  invoke<{ ok: true }>("deleteCard", unwrap(input));

export const archiveKanbanCard = (input: Wrapped<{ id: string }>) =>
  invoke<{ ok: true }>("archiveCard", unwrap(input));

export const createKanbanColumn = (input: Wrapped<{ boardId: string; title: string }>) =>
  invoke<{ id: string }>("createColumn", unwrap(input));

export const deleteKanbanColumn = (input: Wrapped<{ id: string; fallbackId: string }>) =>
  invoke<{ ok: true }>("deleteColumn", unwrap(input));

export const copyKanbanColumn = async (input: Wrapped<{ id: string; title: string }>) => {
  const { id, title } = unwrap(input);
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
  const { data, error } = await rpc("copy_kanban_column_payload", {
    source_column_id: id,
    new_name: title,
  });
  if (error) throw error;
  return { id: data as string };
};

export const moveKanbanColumn = async (
  input: Wrapped<{ id: string; boardId: string; position: number }>,
) => {
  const { id, boardId, position } = unwrap(input);
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc("move_kanban_column_payload", {
    source_column_id: id,
    destination_board_id: boardId,
    destination_position: position,
  });
  if (error) throw error;
};

export const moveAllKanbanCards = async (sourceColumnId: string, destinationColumnId: string) => {
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
  const { data, error } = await rpc("move_all_kanban_cards", {
    source_column_id: sourceColumnId,
    destination_column_id: destinationColumnId,
  });
  if (error) throw error;
  return Number(data ?? 0);
};

export type KanbanColumnSortMode = "created_newest" | "created_oldest" | "name";

export const sortKanbanColumnCards = async (columnId: string, mode: KanbanColumnSortMode) => {
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc("sort_kanban_column_cards", {
    target_column_id: columnId,
    sort_mode: mode,
  });
  if (error) throw error;
};

export const reorderKanbanColumns = (input: Wrapped<{ columnIds: string[] }>) =>
  invoke<{ ok: true }>("reorderColumns", unwrap(input));

export const archiveKanbanColumnCards = (input: Wrapped<{ columnId: string }>) =>
  invoke<{ ok: true; count: number }>("archiveColumnCards", unwrap(input));
