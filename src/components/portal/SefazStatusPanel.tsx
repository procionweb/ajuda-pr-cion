import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSefazMonitor, type FiscalDocument, type SefazMonitorResponse } from "@/lib/sefaz-api";
import { useTheme } from "@/lib/theme-store";
import { NfeConsultDialog } from "@/components/portal/NfeConsultDialog";

const documentLabels: Record<FiscalDocument, string> = {
  nfe: "NF-e",
  nfce: "NFC-e",
  cte: "CT-e",
  mdfe: "MDF-e",
};

const DOWNDETECTOR_SEFAZ_URL = "https://downdetector.com.br/fora-do-ar/sefaz/";

function formatUpdatedAt(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function ChartTooltip({
  active,
  payload,
  label,
  isDark,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; payload: { status: string } }>;
  label?: string;
  isDark: boolean;
  metric: "status" | "latency";
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const value = Number(payload.find((item) => item.dataKey === "responseTime")?.value ?? 0);

  return (
    <div
      className={`rounded border px-3 py-2 text-xs shadow-xl ${
        isDark
          ? "border-[#56575f] bg-[#34353b] text-white"
          : "border-border bg-popover text-popover-foreground"
      }`}
    >
      <p>SEFAZ {label}</p>
      <p className={`mt-1 ${isDark ? "text-[#b9bbc5]" : "text-muted-foreground"}`}>
        {point.status}
        {metric === "latency" ? ` · ${value.toFixed(2)}s` : ""}
      </p>
    </div>
  );
}

export function SefazStatusPanel() {
  const theme = useTheme();
  const isDark = theme === "dark";
  const [data, setData] = useState<SefazMonitorResponse>();
  const [selectedDocument, setSelectedDocument] = useState<FiscalDocument>("nfe");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await getSefazMonitor());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível consultar o monitor SEFAZ.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const refreshInterval = window.setInterval(() => {
      void loadStatus();
    }, 60_000);

    return () => window.clearInterval(refreshInterval);
  }, [loadStatus]);

  const selected = data?.documents.find((item) => item.document === selectedDocument);
  const availableDocuments =
    data?.documents.map((item) => item.document) ??
    (Object.keys(documentLabels) as FiscalDocument[]);
  const chartData = useMemo(
    () => selected?.states.map((state) => ({ ...state, normalLimit: 2 })) ?? [],
    [selected],
  );
  const maxResponse = Math.max(10, ...chartData.map((state) => state.responseTime));
  const yAxisMax = Math.ceil(maxResponse / 10) * 10;

  const gridStroke = isDark ? "#505159" : "#e5e7eb";
  const axisStroke = isDark ? "#55565d" : "#d1d5db";
  const tickFill = isDark ? "#999ba6" : "#6b7280";
  const referenceStroke = isDark ? "#ffffff" : "#374151";
  const watermarkColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(15,16,20,0.06)";

  const chartBg = isDark ? "bg-[#25262a]" : "bg-white";
  const headerBg = isDark ? "bg-[#42434b] text-white" : "bg-card text-card-foreground";
  const cardBorder = isDark ? "" : "border border-border";
  const subtitle = isDark ? "text-[#b9bbc5]" : "text-muted-foreground";
  const tabsWrap = isDark ? "border-[#5a5b63] bg-[#34353b]" : "border-border bg-background";
  const tabInactive = isDark
    ? "text-[#c7c8cf] hover:bg-white/10"
    : "text-muted-foreground hover:bg-muted";
  const refreshBtn = isDark
    ? "border-[#5a5b63] bg-[#34353b] text-[#d9dae0] hover:bg-[#505159]"
    : "border-border bg-background text-muted-foreground hover:bg-muted";

  return (
    <section
      className={`flex h-full flex-col overflow-hidden rounded-[20px] ${cardBorder} ${headerBg} shadow-[0_14px_36px_rgba(15,16,20,0.08)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.35)]`}
    >
      <header className="relative flex flex-col items-stretch gap-3 px-4 py-4 pr-14 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 sm:py-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-tight">
            Disponibilidade dos autorizadores SEFAZ
          </h2>
          <p className={`mt-1 text-[11px] ${subtitle}`}>
            Status técnico via {data?.source ?? "Webmania"} ·{" "}
            {selected ? `atualizado às ${formatUpdatedAt(selected.updatedAt)}` : "consultando..."}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-center">
          <a
            href={DOWNDETECTOR_SEFAZ_URL}
            target="_blank"
            rel="noreferrer"
            title="Ver relatos de usuários no Downdetector"
            className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-xs transition ${refreshBtn}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Relatos externos
          </a>
          <NfeConsultDialog />
          <div className={`col-span-2 grid grid-cols-4 rounded-md border p-0.5 sm:flex ${tabsWrap}`}>
            {availableDocuments.map((document) => (
              <button
                key={document}
                type="button"
                onClick={() => setSelectedDocument(document)}
                className={`min-w-0 cursor-pointer rounded px-2 py-1.5 text-xs transition-colors sm:px-3 ${
                  selectedDocument === document ? "bg-[#11a6b2] text-white" : tabInactive
                }`}
              >
                {documentLabels[document]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            title="Atualizar status"
            aria-label="Atualizar status"
            className={`absolute right-4 top-4 h-9 w-9 cursor-pointer place-items-center rounded-md border transition disabled:cursor-wait sm:static sm:grid ${refreshBtn}`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className={`flex-1 min-h-0 ${chartBg}`}>
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-[#16b3bd]" />
            <p className="text-sm">Status temporariamente indisponível</p>
            <p className={`max-w-lg text-xs ${subtitle}`}>{error}</p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="cursor-pointer rounded-full bg-[#11a6b2] px-5 py-2 text-sm text-white hover:bg-[#1396a0]"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="relative h-full px-4 pb-2 pt-4 sm:px-6">
            <div
              className="pointer-events-none absolute inset-x-0 top-[52px] z-10 text-center text-[30px]"
              style={{ color: watermarkColor }}
            >
              Prócion Monitor
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sefazIncidentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12b8c2" stopOpacity={0.92} />
                    <stop offset="100%" stopColor="#0d8d96" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="5 6"
                  vertical
                  horizontal={false}
                />
                <XAxis
                  dataKey="uf"
                  axisLine={{ stroke: axisStroke }}
                  tickLine={{ stroke: axisStroke }}
                  interval={0}
                  minTickGap={0}
                  tick={{ fill: tickFill, fontSize: 9 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, yAxisMax]}
                  width={38}
                  tick={{ fill: tickFill, fontSize: 11 }}
                />
                <Tooltip
                  content={<ChartTooltip isDark={isDark} metric={selected?.metric ?? "status"} />}
                  cursor={{ stroke: isDark ? "#666870" : "#9ca3af" }}
                />
                <Area
                  type="linear"
                  dataKey="responseTime"
                  stroke="#13b8c3"
                  strokeWidth={1.25}
                  fill="url(#sefazIncidentFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#13b8c3", stroke: "#fff", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="normalLimit"
                  stroke={referenceStroke}
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
