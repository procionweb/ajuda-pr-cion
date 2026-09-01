import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

/**
 * Fonte única de colaboradores do site.
 * Origem: tabela public.tab_colaboradores (importada de tab_colaboradores.json),
 * lida pela RPC `list_colaboradores`. Nenhum dado sensível (senha, CPF, PIS)
 * é importado, retornado ou exibido.
 */
export type Collaborator = {
  id: string;
  legacyId: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  /** Sigla real do operador (ex.: PRCROG, PRCPED). */
  acronym: string | null;
  /** Código numérico do operador no CRM. */
  operatorCode: string | null;
  active: boolean;
  terminatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type RawCollaborator = {
  id: string;
  legacy_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  operator_acronym: string | null;
  operator_code: string | null;
  active: boolean | null;
  terminated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const DEPARTMENT_LABEL: Record<string, string> = {
  admin: "Administrativo",
  support: "Suporte",
  development: "Desenvolvimento",
  commercial: "Comercial",
  cob: "Cobrança",
  tester: "Testes",
};

export function departmentLabel(value: string | null | undefined): string {
  if (!value) return "";
  return DEPARTMENT_LABEL[value] ?? value;
}

function mapRow(row: RawCollaborator): Collaborator {
  const name =
    (row.full_name || "").trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    row.operator_acronym ||
    row.email ||
    "Colaborador";
  return {
    id: row.id,
    legacyId: row.legacy_id,
    name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    department: row.department,
    jobTitle: row.job_title && row.job_title !== "funcao" ? row.job_title : null,
    acronym: row.operator_acronym,
    operatorCode: row.operator_code,
    // Inativo quando o status vem falso OU quando há data de rescisão preenchida.
    active: row.active !== false && !row.terminated_at,
    terminatedAt: row.terminated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let cache: Collaborator[] | null = null;
let pending: Promise<Collaborator[]> | null = null;
const listeners = new Set<() => void>();

export async function fetchCollaborators(force = false): Promise<Collaborator[]> {
  if (cache && !force) return cache;
  if (pending && !force) return pending;
  pending = (async () => {
    const { data, error } = await supabase.rpc("list_colaboradores");
    if (error) throw error;
    const rows = ((data ?? []) as RawCollaborator[]).map(mapRow);
    rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    cache = rows;
    listeners.forEach((fn) => fn());
    return rows;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export function getCachedCollaborators(): Collaborator[] {
  return cache ?? [];
}

/** Normaliza texto para busca sem acentos e sem diferenciar maiúsculas. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function collaboratorMatches(collaborator: Collaborator, term: string): boolean {
  const query = normalizeSearch(term);
  if (!query) return true;
  const haystack = normalizeSearch(
    [
      collaborator.name,
      collaborator.acronym,
      collaborator.operatorCode,
      collaborator.email,
      collaborator.department,
      departmentLabel(collaborator.department),
      collaborator.jobTitle,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return query.split(/\s+/).every((part) => haystack.includes(part));
}

/**
 * Compatibilidade com registros antigos: casa por sigla, e-mail, id ou nome.
 */
export function findCollaborator(
  list: Collaborator[],
  value: string | null | undefined,
): Collaborator | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const normalized = normalizeSearch(raw);
  return (
    list.find((item) => item.id === raw) ||
    list.find((item) => (item.acronym ?? "").toUpperCase() === upper) ||
    list.find((item) => (item.email ?? "").toLowerCase() === raw.toLowerCase()) ||
    list.find((item) => item.operatorCode === raw) ||
    list.find((item) => normalizeSearch(item.name) === normalized)
  );
}

/** Rótulo padrão: "PRCROG · Rogério Silva". */
export function collaboratorLabel(collaborator: Collaborator): string {
  return collaborator.acronym ? `${collaborator.acronym} · ${collaborator.name}` : collaborator.name;
}

export function useCollaborators(options: { onlyActive?: boolean } = {}) {
  const onlyActive = options.onlyActive ?? true;
  const [all, setAll] = useState<Collaborator[]>(() => getCachedCollaborators());
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (force = false) => {
      setLoading(true);
      fetchCollaborators(force)
        .then((rows) => {
          setAll(rows);
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Falha ao carregar colaboradores.");
        })
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    const notify = () => setAll(getCachedCollaborators());
    listeners.add(notify);
    if (cache) {
      setAll(cache);
      setLoading(false);
    } else {
      load();
    }
    return () => {
      listeners.delete(notify);
    };
  }, [load]);

  const collaborators = useMemo(
    () => (onlyActive ? all.filter((item) => item.active) : all),
    [all, onlyActive],
  );

  return {
    collaborators,
    allCollaborators: all,
    loading,
    error,
    reload: () => load(true),
  };
}

/** Siglas reais dos colaboradores ativos (substitui listas fixas de operadores). */
export function useOperatorAcronyms(): string[] {
  const { collaborators } = useCollaborators();
  return useMemo(
    () =>
      collaborators
        .map((item) => item.acronym)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [collaborators],
  );
}
