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
import { getSefazMonitor, type SefazMonitorResponse } from "@/lib/sefaz-api";
import { getLatestDowndetectorSnapshot, type DowndetectorSnapshot } from "@/lib/downdetector-api";
import { useTheme } from "@/lib/theme-store";
import { NfeConsultDialog } from "@/components/portal/NfeConsultDialog";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [view, setView] = useState<"technical" | "external">("technical");
  const [externalData, setExternalData] = useState<DowndetectorSnapshot>();
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string>();

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

  const loadExternalReports = useCallback(async () => {
    setExternalLoading(true);
    setExternalError(undefined);
    try {
      setExternalData(await getLatestDowndetectorSnapshot());
    } catch (cause) {
      setExternalError(
        cause instanceof Error ? cause.message : "Não foi possível carregar os relatos externos.",
      );
    } finally {
      setExternalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const refreshInterval = window.setInterval(() => {
      void loadStatus();
    }, 60_000);

    return () => window.clearInterval(refreshInterval);
  }, [loadStatus]);

  useEffect(() => {
    if (view === "external" && !externalData && !externalLoading) {
      void loadExternalReports();
    }
  }, [externalData, externalLoading, loadExternalReports, view]);

  const selected = data?.documents.find((item) => item.document === "nfe");
  const chartData = useMemo(
    () =>
      selected?.states
        .filter((state) => state.uf.toLocaleUpperCase("pt-BR") === "SP")
        .map((state) => ({ ...state, normalLimit: 2 })) ?? [],
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
            {view === "technical"
              ? "Disponibilidade da NF-e em São Paulo"
              : "Relatos externos da SEFAZ"}
          </h2>
          <p className={`mt-1 text-[11px] ${subtitle}`}>
            {view === "technical" ? (
              <>
                Status técnico via {data?.source ?? "Webmania"} ·{" "}
                {selected
                  ? `atualizado às ${formatUpdatedAt(selected.updatedAt)}`
                  : "consultando..."}
              </>
            ) : (
              "Dados agregados do Downdetector, disponíveis para toda a equipe"
            )}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={() =>
              setView((current) => (current === "technical" ? "external" : "technical"))
            }
            title={view === "technical" ? "Ver relatos externos" : "Voltar ao status técnico"}
            className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-xs transition ${refreshBtn}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {view === "technical" ? "Relatos externos" : "Status técnico"}
          </button>
          {view === "technical" ? (
            <NfeConsultDialog />
          ) : (
            <a
              href={DOWNDETECTOR_SEFAZ_URL}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs transition ${refreshBtn}`}
            >
              Conferir fonte <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => void (view === "technical" ? loadStatus() : loadExternalReports())}
            disabled={view === "technical" ? loading : externalLoading}
            title="Atualizar status"
            aria-label="Atualizar status"
            className={`absolute right-4 top-4 h-9 w-9 cursor-pointer place-items-center rounded-md border transition disabled:cursor-wait sm:static sm:grid ${refreshBtn}`}
          >
            <RefreshCw
              className={`h-4 w-4 ${(view === "technical" ? loading : externalLoading) ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      <div className={`flex-1 min-h-0 ${chartBg}`}>
        {view === "external" ? (
          <ExternalReportsView
            data={externalData}
            error={externalError}
            loading={externalLoading}
            isDark={isDark}
            subtitleClass={subtitle}
          />
        ) : error ? (
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

function ExternalReportsView({
  data,
  error,
  loading,
  isDark,
  subtitleClass,
}: {
  data?: DowndetectorSnapshot;
  error?: string;
  loading: boolean;
  isDark: boolean;
  subtitleClass: string;
}) {
  if (loading && !data) {
    return (
      <div className={`grid h-full place-items-center text-sm ${subtitleClass}`}>
        Carregando relatos...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-[#16b3bd]" />
        <p className="text-sm">Ainda não há uma coleta compartilhada</p>
        <p className={`max-w-lg text-xs ${subtitleClass}`}>
          {error ??
            "Assim que o coletor autorizado enviar o primeiro snapshot, o gráfico aparecerá aqui para toda a equipe."}
        </p>
      </div>
    );
  }

  const peak = Math.max(0, ...data.chartPoints.map((point) => point.reports));
  const timeTicks = data.chartPoints
    .map((point) => point.time)
    .filter((time) => {
      const [hour, minute] = time.split(":").map(Number);
      return minute === 0 && hour % 3 === 0;
    });
  const collectedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data.collectedAt));

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-5 px-5 pb-5 pt-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Relatos nas últimas 24 horas</p>
            <p className={`text-[11px] ${subtitleClass}`}>
              {data.statusText} · coleta {collectedAt}
            </p>
          </div>
          <div className="text-right">
            <strong className="text-xl text-[#12b8c2]">{peak}</strong>
            <p className={`text-[10px] ${subtitleClass}`}>pico de relatos</p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data.chartPoints}
              margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="downdetectorReportsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f05a72" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#f05a72" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={isDark ? "#40424a" : "#e5e7eb"}
                strokeDasharray="4 6"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                ticks={timeTicks}
                interval={0}
                tick={{ fill: isDark ? "#999ba6" : "#6b7280", fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#999ba6" : "#6b7280", fontSize: 10 }}
              />
              <Tooltip cursor={{ stroke: "#f05a72", strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="reports"
                name="Relatos"
                stroke="#f05a72"
                strokeWidth={2.5}
                fill="url(#downdetectorReportsFill)"
                dot={false}
                activeDot={{ r: 4, fill: "#f05a72", stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <aside
        className={`border-t pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 ${isDark ? "border-[#40424a]" : "border-border"}`}
      >
        <h3 className="text-sm font-semibold">Falhas mais relatadas</h3>
        <div className="mt-4 space-y-4">
          {data.reportedFailures.map((failure) => (
            <div key={failure.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate">{failure.label}</span>
                <strong>{failure.percent}%</strong>
              </div>
              <div
                className={`h-1.5 overflow-hidden rounded-full ${isDark ? "bg-[#41434b]" : "bg-muted"}`}
              >
                <div
                  className="h-full rounded-full bg-[#f05a72]"
                  style={{ width: `${failure.percent}%` }}
                />
              </div>
              {failure.reports !== undefined && (
                <p className={`mt-1 text-[10px] ${subtitleClass}`}>{failure.reports} relatos</p>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
