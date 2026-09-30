import { supabase } from "@/integrations/supabase/client";

export type DowndetectorChartPoint = {
  time: string;
  reports: number;
};

export type DowndetectorFailure = {
  label: string;
  percent: number;
  reports?: number;
};

export type DowndetectorSnapshot = {
  id: number;
  serviceSlug: string;
  statusText: string;
  chartPoints: DowndetectorChartPoint[];
  reportedFailures: DowndetectorFailure[];
  sourceUrl: string;
  collectedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseChartPoints(value: unknown): DowndetectorChartPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.time !== "string") return [];
    const reports = Number(entry.reports);
    return Number.isFinite(reports) && reports >= 0 ? [{ time: entry.time, reports }] : [];
  });
}

function parseFailures(value: unknown): DowndetectorFailure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.label !== "string") return [];
    const percent = Number(entry.percent);
    const reports = entry.reports == null ? undefined : Number(entry.reports);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return [];
    return [
      {
        label: entry.label,
        percent,
        reports:
          reports !== undefined && Number.isFinite(reports) && reports >= 0 ? reports : undefined,
      },
    ];
  });
}

export async function getLatestDowndetectorSnapshot(
  serviceSlug = "sefaz",
): Promise<DowndetectorSnapshot | undefined> {
  const { data, error } = await supabase.functions.invoke("downdetector-snapshot", {
    method: "GET",
    headers: { "x-service-slug": serviceSlug },
  });

  if (error) throw new Error(`Não foi possível carregar os relatos externos: ${error.message}`);
  if (!isRecord(data) || data.snapshot == null) return undefined;
  if (!isRecord(data.snapshot)) throw new Error("A coleta compartilhada está inválida.");

  const row = data.snapshot;
  return {
    id: Number(row.id ?? 0),
    serviceSlug: String(row.serviceSlug ?? serviceSlug),
    statusText: String(row.statusText ?? "Status não informado"),
    chartPoints: parseChartPoints(row.chartPoints),
    reportedFailures: parseFailures(row.reportedFailures),
    sourceUrl: String(row.sourceUrl ?? ""),
    collectedAt: String(row.collectedAt ?? ""),
  };
}
