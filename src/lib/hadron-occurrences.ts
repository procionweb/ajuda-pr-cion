import { supabase } from "@/lib/supabase";

export type HadronOccurrence = {
  id: number;
  optionLegacyId: string;
  kind: string;
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
  operatingSystem: string;
  testBase: string;
  status: string;
};

type OccurrenceFilters = {
  page: number;
  pageSize?: number;
  optionIds?: string[];
  kind?: string;
  operator?: string;
  dateFrom?: string;
  dateTo?: string;
  query?: string;
};

function mapOccurrence(row: Record<string, unknown>): HadronOccurrence {
  return {
    id: Number(row.id),
    optionLegacyId: String(row.option_legacy_id || ""),
    kind: String(row.kind || "ocorrencia"),
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
    operatingSystem: String(row.operating_system || ""),
    testBase: String(row.test_base || ""),
    status: String(row.status || ""),
  };
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
  if (filters.operator && filters.operator !== "todos") {
    request = request.or(`reporter.eq.${filters.operator},solver.eq.${filters.operator}`);
  }
  if (filters.dateFrom) request = request.gte("occurred_at", `${filters.dateFrom}T00:00:00-03:00`);
  if (filters.dateTo) request = request.lte("occurred_at", `${filters.dateTo}T23:59:59-03:00`);
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

export async function listHadronOccurrenceOperators() {
  const { data, error } = await supabase.rpc("get_hadron_occurrence_operators");
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => String(row.operator));
}
