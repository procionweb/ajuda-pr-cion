import { supabase } from "@/lib/supabase";

export type HadronOccurrence = {
  id: number;
  optionLegacyId: string;
  kind: string;
  priority: string;
  occurrenceHtml: string;
  occurrenceText: string;
  reporter: string;
  occurredAt: string | null;
  solutionHtml: string;
  solutionText: string;
  solver: string;
  solvedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  hadronAt: string | null;
  operatingSystem: string;
  testBase: string;
  status: string;
  modifiedBy: string;
  versionLegacyId: string;
  baseAddress: string;
  sourceCreatedAt: string | null;
  sourceModifiedAt: string | null;
};

type OccurrenceFilters = {
  page: number;
  pageSize?: number;
  optionIds?: string[];
  kind?: string;
  operator?: string;
  operatorField?: "owner" | "reporter" | "solver";
  dateField?: "occurred_at" | "solved_at" | "reviewed_at";
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  unresolved?: boolean;
};

function mapOccurrence(row: Record<string, unknown>): HadronOccurrence {
  return {
    id: Number(row.id),
    optionLegacyId: String(row.option_legacy_id || ""),
    kind: String(row.kind || "ocorrencia"),
    priority: String(row.priority ?? 1),
    occurrenceHtml: String(row.occurrence_html || ""),
    occurrenceText: String(row.occurrence_text || ""),
    reporter: String(row.reporter || ""),
    occurredAt: row.occurred_at ? String(row.occurred_at) : null,
    solutionHtml: String(row.solution_html || ""),
    solutionText: String(row.solution_text || ""),
    solver: String(row.solver || ""),
    solvedAt: row.solved_at ? String(row.solved_at) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    hadronAt: row.hadron_at ? String(row.hadron_at) : null,
    operatingSystem: String(row.operating_system || ""),
    testBase: String(row.test_base || ""),
    status: String(row.status || ""),
    modifiedBy: String(row.modified_by || ""),
    versionLegacyId: String(row.version_legacy_id || ""),
    baseAddress: String(row.base_address || ""),
    sourceCreatedAt: row.source_created_at ? String(row.source_created_at) : null,
    sourceModifiedAt: row.source_modified_at ? String(row.source_modified_at) : null,
  };
}

export async function updateHadronOccurrenceSolution({
  id,
  solution,
  operator,
  baseAddress,
  versionLegacyId,
}: {
  id: number;
  solution: string;
  operator: string;
  baseAddress?: string;
  versionLegacyId?: string;
}) {
  const solvedAt = new Date().toISOString();
  const { error } = await supabase
    .from("hadron_occurrences")
    .update({
      solution_html: solution.trim(),
      solution_text: solution.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      solver: operator,
      solved_at: solvedAt,
      status: "8",
      modified_by: operator,
      source_modified_at: solvedAt,
      base_address: baseAddress?.trim() || null,
      version_legacy_id: versionLegacyId || null,
    })
    .eq("id", id);
  if (error) throw error;
  return solvedAt;
}

export async function reviewHadronOccurrence(id: number) {
  const { data, error } = await supabase.rpc("review_hadron_occurrence", {
    p_occurrence_id: id,
  });
  if (error) throw error;
  return String(data);
}

export async function createHadronOccurrence(input: {
  optionLegacyId: string;
  kind: string;
  occurrence: string;
  operator: string;
  baseAddress: string;
  versionLegacyId: string;
  priority: string;
}) {
  const { data, error } = await supabase.rpc("create_hadron_occurrence", {
    p_option_legacy_id: input.optionLegacyId,
    p_kind: input.kind,
    p_occurrence: input.occurrence.trim(),
    p_operator: input.operator,
    p_base_address: input.baseAddress.trim(),
    p_version_legacy_id: input.versionLegacyId || null,
    p_priority: Number(input.priority),
  });
  if (error) throw error;
  const occurrenceId = Number(data);
  const { error: richTextError } = await supabase
    .from("hadron_occurrences")
    .update({
      occurrence_html: input.occurrence.trim(),
      occurrence_text: input.occurrence.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    })
    .eq("id", occurrenceId);
  if (richTextError) throw richTextError;
  return occurrenceId;
}

export async function updateHadronOccurrence(input: {
  id: number;
  occurrence: string;
  operator: string;
  baseAddress: string;
  versionLegacyId: string;
  priority: string;
}) {
  const modifiedAt = new Date().toISOString();
  const { error } = await supabase
    .from("hadron_occurrences")
    .update({
      occurrence_html: input.occurrence.trim(),
      occurrence_text: input.occurrence.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      base_address: input.baseAddress.trim(),
      version_legacy_id: input.versionLegacyId || null,
      priority: Number(input.priority),
      modified_by: input.operator,
      source_modified_at: modifiedAt,
    })
    .eq("id", input.id);
  if (error) throw error;
}

export async function deleteHadronOccurrence(id: number) {
  const { error } = await supabase.rpc("delete_hadron_occurrence", {
    p_occurrence_id: id,
  });
  if (error) throw error;
}

export async function updateHadronOccurrencePriority(id: number, priority: string) {
  const { error } = await supabase.rpc("set_hadron_occurrence_priority", {p_id:id,p_priority:Number(priority)});
  if (error) throw error;
}

export async function listHadronOccurrences(filters: OccurrenceFilters) {
  const pageSize = filters.pageSize || 50;
  let request = supabase
    .from("hadron_occurrences")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (filters.optionIds?.length) request = request.in("option_legacy_id", filters.optionIds);
  if (filters.kind && filters.kind !== "todos") request = request.eq("kind", filters.kind);
  if (filters.unresolved) request = request.eq("kind", "ocorrencia").is("solved_at", null).is("reviewed_at", null);
  if (filters.operator && filters.operator !== "todos") {
    if (filters.operatorField === "reporter") request = request.eq("reporter", filters.operator);
    else if (filters.operatorField === "solver") request = request.eq("solver", filters.operator);
    else if (filters.operatorField === "owner") {
      // O responsável pertence ao cadastro da opção e é filtrado no cliente.
    } else request = request.or(`reporter.eq.${filters.operator},solver.eq.${filters.operator}`);
  }
  const dateField = filters.dateField || "occurred_at";
  if (filters.dateFrom) request = request.gte(dateField, `${filters.dateFrom}T00:00:00-03:00`);
  if (filters.dateTo) {
    const nextDay = new Date(`${filters.dateTo}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    request = request.lt(dateField, `${nextDay.toISOString().slice(0, 10)}T00:00:00-03:00`);
  }
  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[,%()]/g, " ");
    request = request.or(`occurrence_text.ilike.%${term}%,solution_text.ilike.%${term}%`);
  }

  const start = (filters.page - 1) * pageSize;
  const { data, count, error } = await request.range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: (data || []).map((row) => mapOccurrence(row)), total: count || 0 };
}

export async function getHadronOccurrenceCounts() {
  const { data, error } = await supabase.rpc("get_hadron_occurrence_counts");
  if (error) throw error;
  return Object.fromEntries(
    (data || []).map((row: Record<string, unknown>) => [
      String(row.option_legacy_id),
      Number(row.occurrence_count || 0),
    ]),
  ) as Record<string, number>;
}

export type HadronOpenOccurrenceStat = { count: number; firstOccurrence: string | null };

export async function getHadronOpenOccurrenceStats() {
  const { data, error } = await supabase.rpc("get_hadron_occurrence_open_stats");
  if (error) throw error;
  return Object.fromEntries(
    (data || []).map((row: Record<string, unknown>) => [
      String(row.option_legacy_id),
      {
        count: Number(row.occurrence_count || 0),
        firstOccurrence: row.first_occurrence ? String(row.first_occurrence) : null,
      },
    ]),
  ) as Record<string, HadronOpenOccurrenceStat>;
}

export async function getHadronOccurrenceKindCounts() {
  const kinds = ["aviso", "sugestao", "aprovacao", "solucao", "revisada", "ocorrencia"];
  const counts = await Promise.all(
    kinds.map(async (kind) => {
      const { count, error } = await supabase
        .from("hadron_occurrences")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind);
      if (error) throw error;
      return [kind, count || 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<string, number>;
}

export async function listHadronOccurrenceOperators() {
  const { data, error } = await supabase.rpc("get_hadron_occurrence_operators");
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => String(row.operator));
}

export async function getHadronOverview() {
  const {data,error} = await supabase.rpc("get_hadron_overview");
  if (error) throw error;
  const result = data as unknown as {general:Record<string,unknown>[];review:Record<string,unknown>[];options:{option_legacy_id:string;count:number}[];operators:{reporter:string;count:number}[];total:number;reviewTotal:number};
  return {...result,general:result.general.map(mapOccurrence),review:result.review.map(mapOccurrence)};
}
