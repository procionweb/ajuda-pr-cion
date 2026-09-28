// Supabase Edge Function: kanban-api
// Deploy: supabase functions deploy kanban-api --no-verify-jwt
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (available by default).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@^9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });

const priorityToDb = (v: string) =>
  v === "Alta" || v === "Critica" ? "high" : v === "Baixa" ? "low" : "medium";

const DEFAULT_COLUMNS = [
  { name: "A fazer", position: 0 },
  { name: "Em andamento", position: 1 },
  { name: "Concluido", position: 2 },
];

function groupBy<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = key(r);
    (out[k] ||= []).push(r);
  }
  return out;
}

async function listBoards() {
  const { data: boards, error } = await admin
    .from("kanban_boards")
    .select("id, workspace_id, name, description, color, cover, visibility, is_favorite, updated_at, created_at")
    .eq("archived", false)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const ids = (boards ?? []).map((b: any) => b.id);
  if (!ids.length) return { boards: [] };

  const [colsResult, cardsResult, membersResult] = await Promise.allSettled([
    admin.from("kanban_columns").select("id, board_id").in("board_id", ids).eq("archived", false),
    admin
      .from("kanban_cards")
      .select("id, archived, kanban_columns!inner(board_id, archived)")
      .in("kanban_columns.board_id", ids)
      .eq("kanban_columns.archived", false)
      .eq("archived", false),
    admin
      .from("kanban_board_members")
      .select("board_id, role, profiles:profile_id(id, full_name, avatar_url, operator_code)")
      .in("board_id", ids),
  ]);

  // Optional board summaries must never prevent users from opening the board list.
  // This also keeps the UI available while a freshly deployed schema cache settles.
  const colsRes = colsResult.status === "fulfilled" ? colsResult.value : { data: [] };
  const cardsRes = cardsResult.status === "fulfilled" ? cardsResult.value : { data: [] };
  const membersRes = membersResult.status === "fulfilled" ? membersResult.value : { data: [] };

  if ("error" in colsRes && colsRes.error) console.error("[kanban-api:listBoards:columns]", colsRes.error);
  if ("error" in cardsRes && cardsRes.error) console.error("[kanban-api:listBoards:cards]", cardsRes.error);
  if ("error" in membersRes && membersRes.error) console.error("[kanban-api:listBoards:members]", membersRes.error);

  const colsByBoard = groupBy(colsRes.data ?? [], (r: any) => r.board_id);
  const cardsByBoard: Record<string, number> = {};
  for (const row of (cardsRes.data ?? []) as any[]) {
    const b = row.kanban_columns?.board_id;
    if (b) cardsByBoard[b] = (cardsByBoard[b] ?? 0) + 1;
  }
  const membersByBoard = groupBy(membersRes.data ?? [], (r: any) => r.board_id);

  return {
    boards: (boards ?? []).map((b: any) => ({
      id: b.id,
      workspaceId: b.workspace_id ?? null,
      name: b.name,
      description: b.description ?? "",
      color: b.color ?? null,
      cover: b.cover ?? null,
      visibility: b.visibility ?? "team",
      isFavorite: Boolean(b.is_favorite),
      updatedAt: b.updated_at,
      createdAt: b.created_at,
      columnsCount: (colsByBoard[b.id] ?? []).length,
      cardsCount: cardsByBoard[b.id] ?? 0,
      members: (membersByBoard[b.id] ?? []).map((m: any) => ({
        id: m.profiles?.id,
        name: m.profiles?.full_name ?? "",
        avatarUrl: m.profiles?.avatar_url ?? null,
        operator: m.profiles?.operator_code ?? null,
        role: m.role,
      })).filter((m: any) => m.id),
    })),
  };
}

async function actorId(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("unauthorized");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error("unauthorized");
  return user.id;
}

async function listWorkspaces(req: Request) {
  const currentId = await actorId(req);
  const [{ data: workspaces, error }, boardsResult, membersResult, allBoardsResult] = await Promise.all([
    admin
      .from("kanban_workspaces")
      .select("id, name, slug, description, website, logo_url, visibility, settings, owner_id, created_at")
      .order("created_at", { ascending: true }),
    listBoards(),
    admin
      .from("kanban_workspace_members")
      .select("workspace_id, role, profiles:profile_id(id, full_name, operator_code, avatar_url)"),
    admin.from("kanban_boards").select("workspace_id"),
  ]);
  if (error) throw error;
  if (allBoardsResult.error) throw allBoardsResult.error;

  const boardsByWorkspace = groupBy(boardsResult.boards ?? [], (b: any) => b.workspaceId ?? "unassigned");
  const membersByWorkspace = groupBy(membersResult.data ?? [], (m: any) => m.workspace_id);

  return {
    workspaces: (workspaces ?? []).map((workspace: any) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug ?? "",
      description: workspace.description ?? "",
      website: workspace.website ?? "",
      logoUrl: workspace.logo_url ?? null,
      visibility: workspace.visibility ?? "private",
      settings: workspace.settings ?? {
        memberRestriction: "admins",
        boardCreation: "members",
        boardDeletion: "admins",
        guestSharing: "admins",
      },
      ownerId: workspace.owner_id,
      membershipRole: workspace.owner_id === currentId ? "admin" :
        (membersByWorkspace[workspace.id] ?? []).find((member: any) => member.profiles?.id === currentId)?.role ?? "member",
      membersCount: (membersByWorkspace[workspace.id] ?? []).length,
      boardsCount: (allBoardsResult.data ?? []).filter((board: any) => board.workspace_id === workspace.id).length,
      boards: boardsByWorkspace[workspace.id] ?? [],
    })),
  };
}

async function createWorkspace(payload: any, req: Request) {
  const ownerId = await actorId(req);
  const { data, error } = await admin
    .from("kanban_workspaces")
    .insert({
      name: String(payload?.name ?? "").trim(),
      owner_id: ownerId,
      slug: String(payload?.slug ?? "").trim() || null,
      description: String(payload?.description ?? "").trim(),
      website: String(payload?.website ?? "").trim(),
      visibility: payload?.visibility === "company" ? "company" : "private",
      settings: payload?.settings ?? undefined,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: memberError } = await admin.from("kanban_workspace_members").upsert({
    workspace_id: data.id, profile_id: ownerId, role: "admin",
  }, { onConflict: "workspace_id,profile_id" });
  if (memberError) throw memberError;
  return { id: data.id };
}

async function deleteWorkspace(payload: any, req: Request) {
  const currentId = await actorId(req);
  const { data: workspace, error: workspaceError } = await admin.from("kanban_workspaces")
    .select("owner_id").eq("id", payload.workspaceId).single();
  if (workspaceError) throw workspaceError;
  const { data: membership } = await admin.from("kanban_workspace_members")
    .select("role").eq("workspace_id", payload.workspaceId).eq("profile_id", currentId).maybeSingle();
  if (workspace.owner_id !== currentId && membership?.role !== "admin") throw new Error("forbidden");
  const { count, error: countError } = await admin.from("kanban_boards")
    .select("id", { count: "exact", head: true }).eq("workspace_id", payload.workspaceId);
  if (countError) throw countError;
  if (count) throw new Error("workspace_has_boards");
  const { error } = await admin.from("kanban_workspaces").delete().eq("id", payload.workspaceId);
  if (error) throw error;
  return { ok: true };
}

async function updateWorkspace(payload: any) {
  let workspaceId = payload.id;
  if (workspaceId === "legacy") {
    const { data: fallbackWorkspace, error: fallbackError } = await admin
      .from("kanban_workspaces")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    if (!fallbackWorkspace?.id) throw new Error("Área de trabalho não encontrada.");
    workspaceId = fallbackWorkspace.id;
  }
  const patch: any = {};
  if (payload.name !== undefined) patch.name = String(payload.name).trim();
  if (payload.slug !== undefined) patch.slug = String(payload.slug).trim();
  if (payload.description !== undefined) patch.description = String(payload.description).trim();
  if (payload.website !== undefined) patch.website = String(payload.website).trim();
  if (payload.visibility !== undefined) patch.visibility = payload.visibility;
  if (payload.settings !== undefined) patch.settings = payload.settings;
  const { error } = await admin.from("kanban_workspaces").update(patch).eq("id", workspaceId);
  if (error) throw error;
  return { ok: true };
}

async function listWorkspaceMembers(payload: any) {
  const [{ data, error }, ownerResult] = await Promise.all([admin
    .from("kanban_workspace_members")
    .select("role, profiles:profile_id(id, full_name, email, operator_code, avatar_url)")
    .eq("workspace_id", payload.workspaceId),
    admin.from("kanban_workspaces").select("owner_id, owner:owner_id(id, full_name, email, operator_code, avatar_url)")
      .eq("id", payload.workspaceId).maybeSingle()]);
  if (error) throw error;
  const owner = (ownerResult.data as any)?.owner;
  const rows = [...(data ?? [])];
  if (owner?.id && !rows.some((item: any) => item.profiles?.id === owner.id)) {
    rows.unshift({ role: "admin", profiles: owner } as any);
  }
  return {
    members: rows.map((item: any) => ({
      id: item.profiles?.id,
      name: item.profiles?.full_name ?? "",
      email: item.profiles?.email ?? null,
      operator: item.profiles?.operator_code ?? null,
      avatarUrl: item.profiles?.avatar_url ?? null,
      role: item.profiles?.id === (ownerResult.data as any)?.owner_id ? "admin" : item.role,
    })).filter((item: any) => item.id),
  };
}

async function addWorkspaceMember(payload: any) {
  const { error } = await admin.from("kanban_workspace_members").upsert([{
    workspace_id: payload.workspaceId,
    profile_id: payload.profileId,
    role: payload.role ?? "member",
  }], { onConflict: "workspace_id,profile_id" });
  if (error) throw error;
  const { data: workspace } = await admin.from("kanban_workspaces").select("name").eq("id", payload.workspaceId).maybeSingle();
  await admin.from("notifications").insert({ profile_id: payload.profileId,
    title: "Você foi adicionado a uma área", body: workspace?.name ?? "Área de trabalho",
    link: "/kanban" });
  return { ok: true };
}

async function updateWorkspaceMemberRole(payload: any) {
  const { error } = await admin.from("kanban_workspace_members")
    .update({ role: payload.role })
    .eq("workspace_id", payload.workspaceId)
    .eq("profile_id", payload.profileId);
  if (error) throw error;
  return { ok: true };
}

async function removeWorkspaceMember(payload: any) {
  const { error } = await admin.from("kanban_workspace_members")
    .delete()
    .eq("workspace_id", payload.workspaceId)
    .eq("profile_id", payload.profileId);
  if (error) throw error;
  return { ok: true };
}

async function getBoard(payload: any) {
  const { data, error } = await admin
    .from("kanban_boards")
    .select("id, name, description, color, cover, visibility, is_favorite, background_type, background_value, background_mode, background_text_theme")
    .eq("id", payload.boardId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { board: null };
  return {
    board: {
      id: data.id,
      name: data.name,
      description: data.description ?? "",
      color: data.color ?? null,
      cover: data.cover ?? null,
      visibility: data.visibility ?? "team",
      isFavorite: Boolean(data.is_favorite),
      backgroundType: data.background_type ?? "color",
      backgroundValue: data.background_value ?? null,
      backgroundMode: data.background_mode ?? "cover",
      backgroundTextTheme: data.background_text_theme ?? "auto",
    },
  };
}

async function loadBoard(payload: any) {
  if (!payload?.boardId) throw new Error("boardId_required");
  const { data: board, error: e1 } = await admin
    .from("kanban_boards")
    .select("id, name, description")
    .eq("id", payload.boardId)
    .eq("archived", false)
    .maybeSingle();
  if (e1) throw e1;
  if (!board) return { board: null, columns: [], cards: [] };

  const [colsRes, cardsRes] = await Promise.all([
    admin
      .from("kanban_columns")
      .select("id, name, position, source_position")
      .eq("board_id", board.id)
      .eq("archived", false)
      .order("position", { ascending: true }),
    admin
      .from("kanban_cards")
      .select(
        "id, column_id, title, description, priority, due_at, position, archived, labels, member_legacy_ids, source_payload, kanban_columns!inner(board_id, archived)",
      )
      .eq("kanban_columns.board_id", board.id)
      .eq("kanban_columns.archived", false)
      .eq("archived", false)
      .order("position", { ascending: true }),
  ]);
  if (colsRes.error) throw colsRes.error;
  if (cardsRes.error) throw cardsRes.error;

  const cardIds = (cardsRes.data ?? []).map((c: any) => c.id);
  const [checklistRes, commentsRes, attachmentsRes] = await Promise.all([
    cardIds.length
      ? admin
          .from("kanban_checklist_items")
          .select("id, card_id, title, completed, position, checklist_title")
          .in("card_id", cardIds)
          .order("position", { ascending: true })
      : { data: [], error: null },
    cardIds.length
      ? admin
          .from("kanban_comments")
          .select("id, card_id, author_legacy_id, body, created_at")
          .in("card_id", cardIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null },
    cardIds.length
      ? admin
          .from("kanban_card_attachments")
          .select("id, card_id, name, bytes, mime_type, position, url, source_payload")
          .in("card_id", cardIds)
          .order("position", { ascending: true })
      : { data: [], error: null },
  ]);
  if ((checklistRes as any).error) throw (checklistRes as any).error;
  if ((commentsRes as any).error) throw (commentsRes as any).error;
  if ((attachmentsRes as any).error) throw (attachmentsRes as any).error;

  const cl = groupBy((checklistRes as any).data ?? [], (r: any) => r.card_id);
  const cm = groupBy((commentsRes as any).data ?? [], (r: any) => r.card_id);
  const at = groupBy((attachmentsRes as any).data ?? [], (r: any) => r.card_id);

  const priorityToUi = (v: string | null) =>
    v === "high" ? "Alta" : v === "low" ? "Baixa" : "Média";
  const labelNames = (labels: unknown): string[] => {
    if (!Array.isArray(labels)) return [];
    return labels
      .map((l: any) => String(l?.name || l?.color || "").trim())
      .filter(Boolean);
  };

  const cards = (cardsRes.data ?? []).map((row: any) => {
    const payload = row.source_payload ?? {};
    const memberIds = row.member_legacy_ids ?? [];
    const storedChecklist = cl[row.id] ?? [];
    const storedComments = cm[row.id] ?? [];
    const storedAttachments = at[row.id] ?? [];
    return {
      id: row.id,
      columnId: row.column_id,
      title: row.title,
      summary:
        payload.summary ??
        row.description?.split(/\r?\n/).find(Boolean) ??
        "Cartao importado do Trello",
      description: row.description ?? "",
      client: payload.client || "Interno",
      module: payload.module || "Trello",
      priority: priorityToUi(row.priority),
      type: payload.type || "Melhoria",
      assigneeId: memberIds[0] ?? "u-ar",
      participants: memberIds,
      dueDate: row.due_at ? String(row.due_at).slice(0, 10) : "",
      tags: labelNames(row.labels),
      comments: (cm[row.id] ?? []).length,
      attachments: (at[row.id] ?? []).length,
      archived: Boolean(row.archived),
      checklist: storedChecklist.length
        ? storedChecklist.map((i: any) => ({
            id: i.id,
            text: i.title,
            done: i.completed,
            checklistTitle: i.checklist_title || "Checklist",
          }))
        : Array.isArray(payload.checklist)
          ? payload.checklist
          : [],
      commentsList: storedComments.length
        ? storedComments.map((i: any) => ({
            id: i.id,
            authorId: i.author_legacy_id ?? "trello",
            at: i.created_at,
            text: i.body,
          }))
        : Array.isArray(payload.commentsList)
          ? payload.commentsList
          : [],
      attachmentsList: storedAttachments.length
        ? storedAttachments.map((i: any) => ({
            id: i.id,
            name: i.name ?? "Anexo",
            size: i.source_payload?.displaySize || (i.bytes ? String(i.bytes) : ""),
            kind: i.mime_type ?? "link",
            url: i.url ?? undefined,
          }))
        : Array.isArray(payload.attachmentsList)
          ? payload.attachmentsList
          : [],
      activity: Array.isArray(payload.activity) ? payload.activity : [],
      relatedArticles: Array.isArray(payload.relatedArticles) ? payload.relatedArticles : [],
      relatedVersions: Array.isArray(payload.relatedVersions) ? payload.relatedVersions : [],
    };
  });

  return {
    board: { id: board.id, name: board.name, description: board.description },
    columns: (colsRes.data ?? []).map((r: any) => ({ id: r.id, title: r.name })),
    cards,
  };
}

async function nextCardPosition(columnId: string) {
  const { data, error } = await admin
    .from("kanban_cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw error;
  return Number(data?.[0]?.position ?? 0) + 1024;
}

async function touchBoardOfColumn(columnId: string) {
  const { data } = await admin
    .from("kanban_columns")
    .select("board_id")
    .eq("id", columnId)
    .maybeSingle();
  if (data?.board_id) {
    await admin
      .from("kanban_boards")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.board_id);
  }
}

async function saveCard(payload: any) {
  const isUuid = payload.id && /^[0-9a-f-]{36}$/i.test(payload.id);
  const row: any = {
    column_id: payload.columnId,
    title: payload.title,
    description: payload.description ?? "",
    priority: priorityToDb(payload.priority ?? "Media"),
    due_at: payload.dueDate || null,
    archived: Boolean(payload.archived),
    labels: (payload.tags ?? []).map((name: string) => ({ name })),
    member_legacy_ids: payload.memberIds ?? [],
    source_payload: {
      client: payload.client ?? "Interno",
      module: payload.module ?? "Trello",
      type: payload.type ?? "Melhoria",
      summary: payload.summary ?? "",
      checklist: Array.isArray(payload.checklist) ? payload.checklist : [],
      commentsList: Array.isArray(payload.commentsList) ? payload.commentsList : [],
      attachmentsList: Array.isArray(payload.attachmentsList) ? payload.attachmentsList : [],
      activity: Array.isArray(payload.activity) ? payload.activity : [],
      relatedArticles: Array.isArray(payload.relatedArticles) ? payload.relatedArticles : [],
      relatedVersions: Array.isArray(payload.relatedVersions) ? payload.relatedVersions : [],
    },
    updated_at: new Date().toISOString(),
  };
  let cardId: string;
  if (isUuid) {
    const { data, error } = await admin
      .from("kanban_cards")
      .update(row)
      .eq("id", payload.id)
      .select("id")
      .single();
    if (error) throw error;
    cardId = data.id;
  } else {
    row.position = await nextCardPosition(payload.columnId);
    const { data, error } = await admin
      .from("kanban_cards")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    cardId = data.id;
  }

  const cleanupResults = await Promise.all([
    admin.from("kanban_checklist_items").delete().eq("card_id", cardId),
    admin.from("kanban_comments").delete().eq("card_id", cardId),
    admin.from("kanban_card_attachments").delete().eq("card_id", cardId),
  ]);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) throw cleanupError;

  const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  const comments = Array.isArray(payload.commentsList) ? payload.commentsList : [];
  const attachments = Array.isArray(payload.attachmentsList) ? payload.attachmentsList : [];
  if (checklist.length) {
    const { error } = await admin.from("kanban_checklist_items").insert(
      checklist.map((item: any, position: number) => ({
        card_id: cardId,
        title: item.text,
        completed: Boolean(item.done),
        position,
        checklist_title: item.checklistTitle || "Checklist",
        legacy_id: `app-${cardId}-${position}`,
      })),
    );
    if (error) throw error;
  }
  if (comments.length) {
    const { error } = await admin.from("kanban_comments").insert(
      comments.map((item: any, position: number) => ({
        card_id: cardId,
        body: item.text,
        created_at: item.at || new Date().toISOString(),
        author_legacy_id: item.authorId || "app",
        legacy_id: `app-${cardId}-${position}`,
      })),
    );
    if (error) throw error;
  }
  if (attachments.length) {
    const { error } = await admin.from("kanban_card_attachments").insert(
      attachments.map((item: any, position: number) => ({
        card_id: cardId,
        legacy_id: `app-${cardId}-${position}`,
        name: item.name,
        url: item.url || null,
        mime_type: item.kind || "link",
        position,
        is_upload: false,
        source_payload: { displaySize: item.size || "" },
      })),
    );
    if (error) throw error;
  }
  await touchBoardOfColumn(payload.columnId);
  return { id: cardId };
}

async function moveCard(payload: any) {
  let position: number;
  if (payload.beforeCardId) {
    const { data, error } = await admin
      .from("kanban_cards")
      .select("position")
      .eq("id", payload.beforeCardId)
      .maybeSingle();
    if (error) throw error;
    position = Number(data?.position ?? 1024) - 0.5;
  } else {
    position = await nextCardPosition(payload.columnId);
  }
  const { error } = await admin
    .from("kanban_cards")
    .update({
      column_id: payload.columnId,
      position,
      archived: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.cardId);
  if (error) throw error;
  await touchBoardOfColumn(payload.columnId);
  return { ok: true };
}

async function archiveCard(payload: any) {
  const { error } = await admin
    .from("kanban_cards")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

async function deleteCard(payload: any) {
  const { error } = await admin.from("kanban_cards").delete().eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

async function createColumn(payload: any) {
  const { data: pos, error: eP } = await admin
    .from("kanban_columns")
    .select("position")
    .eq("board_id", payload.boardId)
    .order("position", { ascending: false })
    .limit(1);
  if (eP) throw eP;
  const position = Number(pos?.[0]?.position ?? -1) + 1;
  const { data, error } = await admin
    .from("kanban_columns")
    .insert({ board_id: payload.boardId, name: payload.title, position })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

async function deleteColumn(payload: any) {
  const { error: eMove } = await admin
    .from("kanban_cards")
    .update({ column_id: payload.fallbackId, updated_at: new Date().toISOString() })
    .eq("column_id", payload.id);
  if (eMove) throw eMove;
  const { error } = await admin.from("kanban_columns").delete().eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

async function copyColumn(payload: any) {
  const { data: source, error: sourceError } = await admin
    .from("kanban_columns")
    .select("board_id, position")
    .eq("id", payload.id)
    .single();
  if (sourceError) throw sourceError;

  const { data: created, error: createError } = await admin
    .from("kanban_columns")
    .insert({
      board_id: source.board_id,
      name: payload.title,
      position: Number(source.position) + 0.5,
    })
    .select("id, name")
    .single();
  if (createError) throw createError;

  const { data: sourceCards, error: cardsError } = await admin
    .from("kanban_cards")
    .select("title, description, priority, due_at, position, archived, labels, member_legacy_ids, source_payload")
    .eq("column_id", payload.id)
    .eq("archived", false)
    .order("position");
  if (cardsError) throw cardsError;

  let copiedCards: any[] = [];
  if (sourceCards?.length) {
    const { data, error } = await admin
      .from("kanban_cards")
      .insert(sourceCards.map((card: any) => ({ ...card, column_id: created.id })))
      .select("id, column_id, title, description, priority, due_at, archived, labels, member_legacy_ids, source_payload");
    if (error) throw error;
    copiedCards = data ?? [];
  }

  return { column: { id: created.id, title: created.name }, cards: copiedCards };
}

async function reorderColumns(payload: any) {
  const ids = Array.isArray(payload.columnIds) ? payload.columnIds : [];
  for (let position = 0; position < ids.length; position += 1) {
    const { error } = await admin
      .from("kanban_columns")
      .update({ position })
      .eq("id", ids[position]);
    if (error) throw error;
  }
  return { ok: true };
}

async function archiveColumnCards(payload: any) {
  const { data, error } = await admin
    .from("kanban_cards")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("column_id", payload.columnId)
    .eq("archived", false)
    .select("id");
  if (error) throw error;
  await touchBoardOfColumn(payload.columnId);
  return { ok: true, count: data?.length ?? 0 };
}

/* ---------- BOARDS ---------- */

async function createBoard(payload: any, req: Request) {
  const ownerId = await actorId(req);
  const { data: board, error } = await admin
    .from("kanban_boards")
    .insert({
      name: payload.name,
      owner_id: ownerId,
      description: payload.description ?? "",
      color: payload.color ?? null,
      cover: payload.cover ?? null,
      visibility: payload.visibility ?? "team",
      workspace_id: payload.workspaceId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const cols = DEFAULT_COLUMNS.map((c) => ({ ...c, board_id: board.id }));
  const { error: eCols } = await admin.from("kanban_columns").insert(cols);
  if (eCols) throw eCols;

  const memberIds: string[] = Array.isArray(payload.memberIds) ? payload.memberIds : [];
  if (memberIds.length) {
    const rows = memberIds.map((id: string) => ({
      board_id: board.id,
      profile_id: id,
      role: "member",
    }));
    await admin.from("kanban_board_members").upsert(rows, { onConflict: "board_id,profile_id" });
  }
  if (ownerId) {
    await admin
      .from("kanban_board_members")
      .upsert(
        [{ board_id: board.id, profile_id: ownerId, role: "admin" }],
        { onConflict: "board_id,profile_id" },
      );
  }
  return { id: board.id };
}

async function updateBoard(payload: any) {
  const patch: any = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.cover !== undefined) patch.cover = payload.cover;
  if (payload.visibility !== undefined) patch.visibility = payload.visibility;
  if (payload.isFavorite !== undefined) patch.is_favorite = Boolean(payload.isFavorite);
  if (payload.backgroundType !== undefined) patch.background_type = payload.backgroundType;
  if (payload.backgroundValue !== undefined) patch.background_value = payload.backgroundValue;
  if (payload.backgroundMode !== undefined) patch.background_mode = payload.backgroundMode;
  if (payload.backgroundTextTheme !== undefined) patch.background_text_theme = payload.backgroundTextTheme;
  const { error } = await admin.from("kanban_boards").update(patch).eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

async function duplicateBoard(payload: any) {
  const { data: src, error: e1 } = await admin
    .from("kanban_boards")
    .select("name, description, color, cover, visibility, workspace_id")
    .eq("id", payload.id)
    .single();
  if (e1) throw e1;
  const { data: newBoard, error: e2 } = await admin
    .from("kanban_boards")
    .insert({
      name: `${src.name} (cópia)`,
      description: src.description,
      color: src.color,
      cover: src.cover,
      visibility: src.visibility,
      workspace_id: src.workspace_id,
    })
    .select("id")
    .single();
  if (e2) throw e2;

  const { data: cols, error: e3 } = await admin
    .from("kanban_columns")
    .select("id, name, position, color")
    .eq("board_id", payload.id)
    .eq("archived", false)
    .order("position");
  if (e3) throw e3;

  const colMap = new Map<string, string>();
  for (const c of cols ?? []) {
    const { data: nc, error } = await admin
      .from("kanban_columns")
      .insert({ board_id: newBoard.id, name: c.name, position: c.position, color: c.color })
      .select("id")
      .single();
    if (error) throw error;
    colMap.set(c.id, nc.id);
  }

  const { data: cards, error: e4 } = await admin
    .from("kanban_cards")
    .select("column_id, title, description, priority, due_at, position, labels, member_legacy_ids")
    .in("column_id", Array.from(colMap.keys()))
    .eq("archived", false);
  if (e4) throw e4;

  if (cards?.length) {
    const rows = cards.map((c: any) => ({
      column_id: colMap.get(c.column_id),
      title: c.title,
      description: c.description,
      priority: c.priority,
      due_at: c.due_at,
      position: c.position,
      labels: c.labels ?? [],
      member_legacy_ids: c.member_legacy_ids ?? [],
    }));
    const { error } = await admin.from("kanban_cards").insert(rows);
    if (error) throw error;
  }
  return { id: newBoard.id };
}

async function archiveBoard(payload: any) {
  const { error } = await admin
    .from("kanban_boards")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

async function deleteBoard(payload: any) {
  const { error } = await admin.from("kanban_boards").delete().eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

/* ---------- MEMBERS ---------- */

async function listAvailableMembers(payload: any) {
  const q = String(payload?.query ?? "").trim();
  let query = admin
    .from("profiles")
    .select("id, full_name, email, operator_code, avatar_url, role, active")
    .eq("active", true)
    .order("full_name", { ascending: true })
    .limit(100);
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,operator_code.ilike.%${q}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return {
    members: (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name,
      email: p.email,
      operator: p.operator_code,
      avatarUrl: p.avatar_url,
    })),
  };
}

async function listBoardMembers(payload: any) {
  const { data, error } = await admin
    .from("kanban_board_members")
    .select("role, profiles:profile_id(id, full_name, email, operator_code, avatar_url)")
    .eq("board_id", payload.boardId);
  if (error) throw error;
  return {
    members: (data ?? [])
      .map((m: any) => ({
        id: m.profiles?.id,
        name: m.profiles?.full_name ?? "",
        email: m.profiles?.email,
        operator: m.profiles?.operator_code,
        avatarUrl: m.profiles?.avatar_url,
        role: m.role,
      }))
      .filter((m: any) => m.id),
  };
}

async function addBoardMember(payload: any) {
  const { error } = await admin
    .from("kanban_board_members")
    .upsert(
      [{ board_id: payload.boardId, profile_id: payload.profileId, role: payload.role ?? "member" }],
      { onConflict: "board_id,profile_id" },
    );
  if (error) throw error;
  const { data: board } = await admin.from("kanban_boards").select("name").eq("id", payload.boardId).maybeSingle();
  await admin.from("notifications").insert({ profile_id: payload.profileId,
    title: "Você foi adicionado a um quadro", body: board?.name ?? "Quadro",
    link: `/kanban/${payload.boardId}` });
  return { ok: true };
}

async function updateBoardMemberRole(payload: any) {
  const { error } = await admin
    .from("kanban_board_members")
    .update({ role: payload.role })
    .eq("board_id", payload.boardId)
    .eq("profile_id", payload.profileId);
  if (error) throw error;
  return { ok: true };
}

async function removeBoardMember(payload: any) {
  const { error } = await admin
    .from("kanban_board_members")
    .delete()
    .eq("board_id", payload.boardId)
    .eq("profile_id", payload.profileId);
  if (error) throw error;
  return { ok: true };
}

function mapInvite(row: any) {
  return { id: row.id, type: row.invite_type, email: row.email, role: row.role, token: row.token,
    status: row.status, expiresAt: row.expires_at, maxUses: row.max_uses, usesCount: row.uses_count,
    createdAt: row.created_at };
}

async function listBoardInvites(payload: any) {
  const { data, error } = await admin.from("kanban_board_invites").select("*")
    .eq("board_id", payload.boardId).neq("status", "revoked").order("created_at", { ascending: false });
  if (error) throw error;
  return { invites: (data ?? []).map(mapInvite) };
}

async function requireBoardInviter(req: Request, boardId: string, invitedRole: string) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("unauthorized");
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error("unauthorized");
  const { data: board, error: boardError } = await admin.from("kanban_boards")
    .select("owner_id").eq("id", boardId).single();
  if (boardError || !board) throw new Error("board_not_found");
  if (board.owner_id === user.id) return;
  const { data: member } = await admin.from("kanban_board_members")
    .select("role").eq("board_id", boardId).eq("profile_id", user.id).maybeSingle();
  if (member?.role === "observer") throw new Error("forbidden");
  if (member?.role === "admin") return;
  if (invitedRole === "admin") throw new Error("forbidden");
  if (member?.role === "member") return;
  const { data: profile } = await admin.from("profiles")
    .select("role, active").eq("id", user.id).maybeSingle();
  if (!profile?.active || !["admin", "support", "specialist"].includes(profile.role)) {
    throw new Error("forbidden");
  }
}

async function sendBoardInvite(email: string, boardName: string, link: string) {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASSWORD");
  const from = Deno.env.get("SMTP_FROM");
  const port = Number(Deno.env.get("SMTP_PORT"));
  if (!host || !user || !pass || !from || !Number.isInteger(port)) throw new Error("smtp_not_configured");
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  try {
    await transport.sendMail({
      from: { name: "Prócion CRM", address: from }, to: email,
      subject: "Convite para acessar um quadro da Prócion",
      text: `Olá,\n\nVocê recebeu um convite para acessar o quadro "${boardName}" no CRM Prócion.\n\nAbra o link abaixo e entre com este mesmo endereço de email para aceitar:\n${link}\n\nSe você ainda não possui uma conta no CRM, solicite a criação do seu acesso antes de abrir o link.\n\nEste convite foi enviado pela equipe Prócion. Se não o esperava, ignore esta mensagem.`,
      html: `<p>Olá,</p><p>Você recebeu um convite para acessar o quadro <strong>${escapeHtml(boardName)}</strong> no CRM Prócion.</p><p><a href="${escapeHtml(link)}">Abrir convite</a></p><p>Entre com este mesmo endereço de email. Se ainda não possui uma conta no CRM, solicite a criação do seu acesso antes de abrir o link.</p><p>Se não esperava este convite, ignore esta mensagem.</p>`,
    });
  } finally {
    transport.close();
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function createBoardInvite(payload: any, req: Request) {
  if (!['email', 'link'].includes(payload.type) || !['admin', 'member', 'observer'].includes(payload.role ?? 'member')) throw new Error('invalid_invite');
  await requireBoardInviter(req, payload.boardId, payload.role ?? "member");
  const email = payload.email?.trim().toLowerCase() || null;
  if (payload.type === "email" && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("invalid_email");
  let joinedExistingMember = false;
  let existingProfileId: string | null = null;
  if (payload.type === "email" && email) {
    const { data: profile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    existingProfileId = profile?.id ?? null;
  }
  const { data, error } = await admin.from("kanban_board_invites").insert({
    board_id: payload.boardId, invite_type: payload.type, email, role: payload.role ?? "member",
    status: "pending", expires_at: payload.expiresAt ?? null,
    max_uses: payload.maxUses ?? null,
  }).select("*").single();
  if (error) throw error;
  if (payload.type === "email" && email) {
    const { data: board } = await admin.from("kanban_boards").select("name").eq("id", payload.boardId).single();
    const link = existingProfileId
      ? `https://ajuda-pr-cion.vercel.app/kanban/${payload.boardId}`
      : `https://ajuda-pr-cion.vercel.app/kanban/convite/${data.token}`;
    try {
      await sendBoardInvite(email, board?.name ?? "Quadro", link);
    } catch (sendError) {
      await admin.from("kanban_board_invites").delete().eq("id", data.id);
      throw sendError;
    }
    if (existingProfileId) {
      const { error: memberError } = await admin.from("kanban_board_members").upsert({
        board_id: payload.boardId, profile_id: existingProfileId, role: payload.role ?? "member",
      }, { onConflict: "board_id,profile_id" });
      if (memberError) throw memberError;
      const { error: acceptError } = await admin.from("kanban_board_invites").update({ status: "accepted" }).eq("id", data.id);
      if (acceptError) throw acceptError;
      joinedExistingMember = true;
    }
  }
  return { invite: mapInvite(data), joinedExistingMember, emailSent: payload.type === "email" };
}

async function acceptBoardInvite(payload: any, req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("unauthorized");
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) throw new Error("unauthorized");
  const { data: invite, error } = await admin.from("kanban_board_invites")
    .select("*").eq("token", payload.token).single();
  if (error || !invite || !["pending", "accepted"].includes(invite.status) ||
      (invite.expires_at && Date.parse(invite.expires_at) <= Date.now()) ||
      (invite.invite_type === "email" && invite.email?.toLowerCase() !== user.email?.toLowerCase())) {
    throw new Error("invalid_invite");
  }
  if (invite.status === "accepted") {
    const { data: member } = await admin.from("kanban_board_members")
      .select("profile_id").eq("board_id", invite.board_id).eq("profile_id", user.id).maybeSingle();
    if (!member) throw new Error("invalid_invite");
    return { boardId: invite.board_id };
  }
  if (invite.max_uses && invite.uses_count >= invite.max_uses) throw new Error("invalid_invite");
  const { error: memberError } = await admin.from("kanban_board_members").upsert({
    board_id: invite.board_id, profile_id: user.id, role: invite.role,
  }, { onConflict: "board_id,profile_id" });
  if (memberError) throw memberError;
  await admin.from("kanban_board_invites").update({
    status: "accepted", uses_count: invite.uses_count + 1, updated_at: new Date().toISOString(),
  }).eq("id", invite.id);
  return { boardId: invite.board_id };
}

async function getBoardInviteInfo(payload: any, req: Request) {
  const { data: invite, error } = await admin.from("kanban_board_invites")
    .select("board_id, invite_type, email, status, expires_at").eq("token", payload.token).single();
  if (error || !invite) throw new Error("invalid_invite");
  const { data: board } = await admin.from("kanban_boards").select("name").eq("id", invite.board_id).single();
  const email = invite.email?.toLowerCase() ?? null;
  const { data: profile } = email
    ? await admin.from("profiles").select("id").ilike("email", email).maybeSingle()
    : { data: null };
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  return {
    boardName: board?.name ?? "Quadro",
    status: invite.status,
    expired: Boolean(invite.expires_at && Date.parse(invite.expires_at) <= Date.now()),
    recipient: email ? email.replace(/^(.).*(?=@)/, "$1***") : null,
    accountExists: Boolean(profile),
    recipientMatches: user ? (!email || user.email?.toLowerCase() === email) : null,
    signedInEmail: user?.email ?? null,
  };
}

async function revokeBoardInvite(payload: any) {
  const { error } = await admin.from("kanban_board_invites").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("id", payload.id);
  if (error) throw error;
  return { ok: true };
}

async function uploadBoardBackground(payload: any) {
  const match = String(payload.dataUrl ?? "").match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("invalid_file");
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  const extension = String(payload.fileName ?? "image.jpg").split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = `${payload.boardId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage.from("kanban-backgrounds").upload(path, bytes, { contentType: match[1], upsert: false });
  if (error) throw error;
  const { data } = admin.storage.from("kanban-backgrounds").getPublicUrl(path);
  await admin.from("kanban_boards").update({ background_type: "custom", background_value: data.publicUrl, updated_at: new Date().toISOString() }).eq("id", payload.boardId);
  return { url: data.publicUrl };
}

async function uploadProfileAvatar(payload: any, req: Request) {
  const userId = await actorId(req);
  const match = String(payload.dataUrl ?? "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("invalid_avatar");
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  if (bytes.length > 2 * 1024 * 1024) throw new Error("avatar_too_large");
  const extension = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("profile-avatars")
    .upload(path, bytes, { contentType: match[1], upsert: false });
  if (uploadError) throw uploadError;
  const { data } = admin.storage.from("profile-avatars").getPublicUrl(path);
  const { error } = await admin.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
  if (error) throw error;
  return { url: data.publicUrl };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, data } = await req.json();
    let result: unknown;
    switch (action) {
      case "listWorkspaces":
        result = await listWorkspaces(req);
        break;
      case "createWorkspace":
        result = await createWorkspace(data, req);
        break;
      case "deleteWorkspace":
        result = await deleteWorkspace(data, req);
        break;
      case "updateWorkspace":
        result = await updateWorkspace(data);
        break;
      case "listWorkspaceMembers":
        result = await listWorkspaceMembers(data);
        break;
      case "addWorkspaceMember":
        result = await addWorkspaceMember(data);
        break;
      case "updateWorkspaceMemberRole":
        result = await updateWorkspaceMemberRole(data);
        break;
      case "removeWorkspaceMember":
        result = await removeWorkspaceMember(data);
        break;
      case "listBoards":
        result = await listBoards();
        break;
      case "getBoard":
        result = await getBoard(data);
        break;
      case "loadBoard":
        result = await loadBoard(data);
        break;
      case "createBoard":
        result = await createBoard(data, req);
        break;
      case "updateBoard":
        result = await updateBoard(data);
        break;
      case "duplicateBoard":
        result = await duplicateBoard(data);
        break;
      case "archiveBoard":
        result = await archiveBoard(data);
        break;
      case "deleteBoard":
        result = await deleteBoard(data);
        break;
      case "listAvailableMembers":
        result = await listAvailableMembers(data);
        break;
      case "listBoardMembers":
        result = await listBoardMembers(data);
        break;
      case "addBoardMember":
        result = await addBoardMember(data);
        break;
      case "updateBoardMemberRole":
        result = await updateBoardMemberRole(data);
        break;
      case "removeBoardMember":
        result = await removeBoardMember(data);
        break;
      case "listBoardInvites":
        result = await listBoardInvites(data);
        break;
      case "createBoardInvite":
        result = await createBoardInvite(data, req);
        break;
      case "acceptBoardInvite":
        result = await acceptBoardInvite(data, req);
        break;
      case "getBoardInviteInfo":
        result = await getBoardInviteInfo(data, req);
        break;
      case "revokeBoardInvite":
        result = await revokeBoardInvite(data);
        break;
      case "uploadBoardBackground":
        result = await uploadBoardBackground(data);
        break;
      case "uploadProfileAvatar":
        result = await uploadProfileAvatar(data, req);
        break;
      case "createCard":
      case "updateCard":
        result = await saveCard(data);
        break;
      case "moveCard":
        result = await moveCard(data);
        break;
      case "archiveCard":
        result = await archiveCard(data);
        break;
      case "deleteCard":
        result = await deleteCard(data);
        break;
      case "createColumn":
        result = await createColumn(data);
        break;
      case "deleteColumn":
        result = await deleteColumn(data);
        break;
      case "copyColumn":
        result = await copyColumn(data);
        break;
      case "reorderColumns":
        result = await reorderColumns(data);
        break;
      case "archiveColumnCards":
        result = await archiveColumnCards(data);
        break;
      default:
        return json({ error: "unknown_action" }, 400);
    }
    return json({ data: result });
  } catch (err) {
    console.error("[kanban-api]", err);
    return json({ error: "KANBAN_UNAVAILABLE" }, 500);
  }
});
