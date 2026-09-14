import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type CatalogEntity = "options" | "releases" | "articles" | "checklist" | "parameters" | "serials" | "versions" | "kanban_templates";
type CatalogRow = { record_id: string; payload: unknown; deleted: boolean };
type Snapshot = { rows: CatalogRow[]; loaded: boolean };
const db = supabase as SupabaseClient;
const empty: Snapshot = { rows: [], loaded: false };
const snapshots = new Map<CatalogEntity, Snapshot>();
const requests = new Map<CatalogEntity, Promise<void>>();
const revisions = new Map<CatalogEntity, number>();
const saving = new Set<CatalogEntity>();
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const recordId = (value: unknown) => String(Array.isArray(value) ? value[0] : (value as { id: string }).id);

const legacyKeys: Partial<Record<CatalogEntity, string[]>> = {
  options: ["hadron-option-overrides", "hadron-custom-options", "hadron-disabled-options"],
  releases: ["hadron-custom-releases"], serials: ["hadron-serials"], versions: ["hadron-versions"],
  kanban_templates: ["procion-kanban-card-templates-v1"],
};
async function importBrowserRecords(entity: CatalogEntity, rows: CatalogRow[]) {
  if (typeof window === "undefined") return false;
  let imported = false;
  for (const key of legacyKeys[entity] || []) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { toast.error("Há dados antigos inválidos neste navegador. Eles foram preservados para recuperação."); continue; }
    const deleted = key === "hadron-disabled-options";
    const values = deleted ? parsed.map((id: string) => rows.find((row) => row.record_id === id)?.payload).filter(Boolean)
      : Array.isArray(parsed) ? parsed : Object.values(parsed);
    for (let offset = 0; offset < values.length; offset += 100) {
      const { error } = await db.rpc("import_crm_catalog_records", { p_entity: entity,
        p_changes: values.slice(offset, offset + 100).map((payload: unknown) => ({ id: recordId(payload), payload, deleted })),
      });
      if (error) throw error;
    }
    localStorage.removeItem(key);
    imported = true;
  }
  return imported;
}

export async function loadCrmCatalog(entity: CatalogEntity, refresh = false) {
  if (requests.has(entity)) return requests.get(entity);
  if (!refresh && snapshots.get(entity)?.loaded) return;
  const request = (async () => {
    const revision = revisions.get(entity) || 0;
    const rows: CatalogRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("crm_catalog_records")
        .select("record_id,payload,deleted").eq("entity", entity)
        .order("record_id").range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
    if (await importBrowserRecords(entity, rows)) {
      requests.delete(entity);
      await loadCrmCatalog(entity, true);
      return;
    }
    if ((revisions.get(entity) || 0) !== revision) return;
    snapshots.set(entity, { rows, loaded: true });
    publish();
  })();
  requests.set(entity, request);
  try { await request; } finally { requests.delete(entity); }
}

export async function saveCrmCatalog(entity: CatalogEntity, values: unknown[], deleted = false) {
  await loadCrmCatalog(entity);
  const { error } = await db.rpc("save_crm_catalog_records", {
    p_entity: entity,
    p_changes: values.map((payload) => ({ id: recordId(payload), payload, deleted })),
  });
  if (error) throw error;
  revisions.set(entity, (revisions.get(entity) || 0) + 1);
  const previous = snapshots.get(entity) || empty;
  const changes = new Map(values.map((payload) => [recordId(payload), { record_id: recordId(payload), payload, deleted }]));
  const rows = previous.rows.map((row) => {
    const changed = changes.get(row.record_id);
    changes.delete(row.record_id);
    return changed || row;
  });
  snapshots.set(entity, { rows: [...rows, ...changes.values()], loaded: previous.loaded });
  publish();
}

export async function trySaveCrmCatalog(entity: CatalogEntity, values: unknown[], deleted = false) {
  if (saving.has(entity)) { toast.info("Aguarde a gravação em andamento."); return false; }
  saving.add(entity);
  try { await saveCrmCatalog(entity, values, deleted); return true; }
  catch (error) { console.error("[crm] Falha ao salvar", entity, error); toast.error("Não foi possível salvar no banco. Tente novamente."); return false; }
  finally { saving.delete(entity); }
}

export function useCrmCatalog<T>(entity: CatalogEntity, includeDeleted = false) {
  const snapshot = useSyncExternalStore(subscribe, () => snapshots.get(entity) || empty, () => empty);
  useEffect(() => {
    const refresh = () => { void loadCrmCatalog(entity, true).catch(() => toast.error("Não foi possível carregar os dados do banco.")); };
    refresh();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      revisions.set(entity, (revisions.get(entity) || 0) + 1);
      snapshots.delete(entity);
      publish();
    });
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { authListener.subscription.unsubscribe(); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [entity]);
  return useMemo(() => ({
    items: snapshot.rows.filter((row) => includeDeleted || !row.deleted).map((row) => row.payload as T),
    deletedIds: snapshot.rows.filter((row) => row.deleted).map((row) => row.record_id),
    loaded: snapshot.loaded,
  }), [snapshot, includeDeleted]);
}

export async function listCrmCatalog<T>(entity: CatalogEntity): Promise<T[]> {
  await loadCrmCatalog(entity);
  return (snapshots.get(entity)?.rows || []).filter((row) => !row.deleted).map((row) => row.payload as T);
}

export async function getCrmCatalogRecord<T>(entity: CatalogEntity, id: string): Promise<T | undefined> {
  const { data, error } = await db.from("crm_catalog_records").select("payload").eq("entity", entity).eq("record_id", id).eq("deleted", false).maybeSingle();
  if (error) throw error;
  return data?.payload as T | undefined;
}
