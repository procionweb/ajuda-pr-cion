import { AnalyticsFocusData, AnalyzeButton } from "./AnalyticsFocus";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Filter,
  Layers3,
  Search,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listKanbanBoards, loadKanbanBoard } from "@/lib/kanban-api";
import { type KanbanCard } from "@/lib/kanban-data";

const palette = ["#20b8a6", "#4f7cff", "#f59e0b", "#f05d72", "#8b5cf6", "#0ea5e9"];
const money = new Intl.NumberFormat("pt-BR");

function daysUntil(date: string) {
  const d = new Date(date);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function KanbanAnalyticsSection() {
  const [kanbanColumnsDef, setColumns] = useState<{ id: string; title: string }[]>([]);
  const [kanbanMembers, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [remoteCards, setRemoteCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [responsible, setResponsible] = useState("all");

  useEffect(() => {
    let active = true;
    listKanbanBoards()
      .then(async ({ boards }) => {
        const board = boards[0];
        if (!board) return;
        const result = await loadKanbanBoard({ data: { boardId: board.id } });
        if (active) {
          setRemoteCards(result.cards as KanbanCard[]);
          setColumns(result.columns);
          setMembers(board.members);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const isDone = (card: KanbanCard) =>
    /finaliz|conclu/i.test(
      kanbanColumnsDef.find((column) => column.id === card.columnId)?.title ?? "",
    );
  const cards = remoteCards;
  const filtered = useMemo(
    () =>
      cards.filter((card) => {
        if (
          query &&
          !`${card.id} ${card.title} ${card.client} ${card.module}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          return false;
        if (responsible !== "all" && card.assigneeId !== responsible) return false;
        return true;
      }),
    [cards, query, responsible],
  );
  const active = filtered.filter((c) => !c.archived);
  const overdue = active.filter((c) => !isDone(c) && daysUntil(c.dueDate) < 0);
  const done = active.filter(isDone);
  const inProgress = active.filter((c) =>
    /andamento|atendimento|homolog/i.test(
      kanbanColumnsDef.find((column) => column.id === c.columnId)?.title ?? "",
    ),
  );
  const dueSoon = active.filter(
    (c) => !isDone(c) && daysUntil(c.dueDate) >= 0 && daysUntil(c.dueDate) <= 7,
  );
  const completion = active.length ? Math.round((done.length / active.length) * 100) : 0;
  const columns = kanbanColumnsDef.map((column) => ({
    name: column.title,
    value: active.filter((c) => c.columnId === column.id).length,
  }));
  const priorities = ["Crítica", "Alta", "Média", "Baixa"].map((name) => ({
    name,
    value: active.filter((c) => c.priority === name).length,
  }));
  const trend = Array.from({ length: Number(period) }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - Number(period) + 1 + index);
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const scheduled = active.filter((card) => card.dueDate?.slice(0, 10) === key);
    return {
      day: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      prazos: scheduled.length,
      pendentes: scheduled.filter((card) => !isDone(card)).length,
    };
  });
  const members = kanbanMembers
    .map((member) => ({
      ...member,
      total: active.filter((c) => c.assigneeId === member.id).length,
      done: done.filter((c) => c.assigneeId === member.id).length,
    }))
    .filter((m) => m.total);

  return (
    <AnalyticsFocusData
      rows={active.map((card) => ({
        id: card.id,
        dimensions: {
          Colunas: kanbanColumnsDef.find((c) => c.id === card.columnId)?.title || card.columnId,
          Prioridades: card.priority,
          Clientes: card.client || "Não informado",
          Responsáveis:
            kanbanMembers.find((m) => m.id === card.assigneeId)?.name ||
            (card.assigneeId ? "Responsável fora do quadro" : "Sem responsável"),
        },
      }))}
    >
      <div className="space-y-5 pb-10">
        {loadError && (
          <p role="alert">
            Não foi possível carregar os dados do Kanban. Recarregue a página para tentar novamente.
          </p>
        )}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-primary" /> Leitura do fluxo
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cards..."
                className="h-9 w-52 rounded-lg border border-border bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
            >
              <option value="all">Todos responsáveis</option>
              {kanbanMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Layers3}
            label="Cards no fluxo"
            value={active.length}
            note={`${columns.filter((c) => c.value).length} colunas ativas`}
            accent="teal"
          />
          <Metric
            icon={Activity}
            label="Em andamento"
            value={inProgress.length}
            note="trabalho em execução"
            accent="blue"
          />
          <Metric
            icon={AlertTriangle}
            label="Atrasados"
            value={overdue.length}
            note={overdue.length ? "precisam de atenção" : "nenhum prazo vencido"}
            accent="rose"
          />
          <Metric
            icon={CheckCircle2}
            label="Conclusão"
            value={`${completion}%`}
            note={`${done.length} cards finalizados`}
            accent="violet"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
          <Panel
            title="Prazos por dia"
            subtitle={`Cards com vencimento no período · ${period} dias`}
          >
            <div className="h-[250px] pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="kanbanCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#20b8a6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#20b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="kanbanDone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4f7cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="prazos"
                    name="Com prazo"
                    stroke="#20b8a6"
                    fill="url(#kanbanCreated)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="pendentes"
                    name="Ainda pendentes"
                    stroke="#4f7cff"
                    fill="url(#kanbanDone)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Cards por coluna" subtitle="Onde o trabalho está concentrado">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={columns} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="currentColor" opacity={0.08} />
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={112}
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                  />
                  <Tooltip />
                  <Bar dataKey="value" name="Cards" radius={[0, 5, 5, 0]}>
                    {columns.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title="Prioridades" subtitle="Distribuição do trabalho">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorities}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={4}
                  >
                    {priorities.map((_, i) => (
                      <Cell key={i} fill={palette[i + 1]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              {priorities.map((p, i) => (
                <span key={p.name} className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full" style={{ background: palette[i + 1] }} />
                  {p.name} <b className="text-foreground">{p.value}</b>
                </span>
              ))}
            </div>
          </Panel>
          <Panel title="Prazos críticos" subtitle="O que merece atenção agora">
            <div className="space-y-3 pt-2">
              <Insight icon={AlertTriangle} label="Atrasados" value={overdue.length} tone="rose" />
              <Insight icon={Clock3} label="Vencem em 7 dias" value={dueSoon.length} tone="amber" />
              <Insight
                icon={ArrowUpRight}
                label="Alta prioridade"
                value={
                  active.filter((c) => c.priority === "Alta" || c.priority === "Crítica").length
                }
                tone="blue"
              />
            </div>
          </Panel>
          <Panel title="Responsáveis" subtitle="Carga atual e conclusão">
            <div className="space-y-3 pt-1">
              {members.slice(0, 5).map((m) => (
                <div key={m.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground">
                      {m.done}/{m.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${m.total ? Math.max(8, (m.done / m.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Cards que pedem ação" subtitle="Acompanhe prazo, prioridade e responsável">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Card</th>
                  <th className="px-3 py-3 font-medium">Coluna</th>
                  <th className="px-3 py-3 font-medium">Responsável</th>
                  <th className="px-3 py-3 font-medium">Prioridade</th>
                  <th className="px-3 py-3 font-medium">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {active
                  .filter((c) => !isDone(c))
                  .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
                  .slice(0, 8)
                  .map((card) => (
                    <tr key={card.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{card.title}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {card.id} · {card.client}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {kanbanColumnsDef.find((c) => c.id === card.columnId)?.title ??
                          card.columnId}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {kanbanMembers.find((m) => m.id === card.assigneeId)?.name ??
                          "Sem responsável"}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                          {card.priority}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-3 font-medium ${daysUntil(card.dueDate) < 0 ? "text-rose-500" : "text-muted-foreground"}`}
                      >
                        {daysUntil(card.dueDate) < 0
                          ? `${Math.abs(daysUntil(card.dueDate))}d atrasado`
                          : daysUntil(card.dueDate) === 0
                            ? "Hoje"
                            : `em ${daysUntil(card.dueDate)}d`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!active.some((c) => !isDone(c)) && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum card pendente para os filtros atuais.
              </div>
            )}
          </div>
        </Panel>
        {loading && (
          <p className="text-center text-xs text-muted-foreground">
            Sincronizando dados do Kanban…
          </p>
        )}
      </div>
    </AnalyticsFocusData>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  accent,
}: {
  icon: typeof Layers3;
  label: string;
  value: string | number;
  note: string;
  accent: string;
}) {
  const tones: Record<string, { bar: string; icon: string; bg: string }> = {
    teal: { bar: "#14b8a6", icon: "#0f766e", bg: "rgba(20,184,166,.12)" },
    blue: { bar: "#3b82f6", icon: "#2563eb", bg: "rgba(59,130,246,.12)" },
    rose: { bar: "#f43f5e", icon: "#e11d48", bg: "rgba(244,63,94,.12)" },
    violet: { bar: "#8b5cf6", icon: "#7c3aed", bg: "rgba(139,92,246,.12)" },
  };
  const tone = tones[accent] ?? tones.blue;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: tone.bar }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
          <AnalyzeButton title={label} />
        </div>
        <div className="rounded-xl p-2.5" style={{ background: tone.bg, color: tone.icon }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="analytics-kanban-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <AnalyzeButton title={title} />
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
function Insight({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </span>
      <strong className="text-lg text-foreground">{value}</strong>
    </div>
  );
}
