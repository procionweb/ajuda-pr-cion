import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, MessageCircle, Phone, Mail, Globe } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { SupportTicket } from "@/lib/support-tickets-data";
import { ticketStatusTone } from "@/lib/ticket-status-tone";
import { cn } from "@/lib/utils";

const colors = ["#119fee", "#17cfb8", "#ffba55", "#e67ba9", "#889cf5"];
const number = new Intl.NumberFormat("pt-BR");
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const dailyColors = { novos: "#4aa8ff", andamento: "#33d7dd", resolvidos: "#ffae55" };

function Panel({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`analytics-glass ${className}`}>
      <header>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>
      {children}
    </article>
  );
}

export function AnalyticsOverview({
  tickets,
  rangeEnd,
}: {
  tickets: SupportTicket[];
  rangeEnd?: string;
}) {
  const funnelId = useId();
  const [dayOffset, setDayOffset] = useState(0);
  const [edgeDirection, setEdgeDirection] = useState(0);
  const data = useMemo(() => {
    const latest = tickets.reduce(
      (max, ticket) => Math.max(max, Date.parse(ticket.openedAt) || 0),
      0,
    );
    const end = rangeEnd ? new Date(`${rangeEnd}T12:00:00`) : new Date(latest || Date.now());
    const days = [];
    const cursor = new Date(end);
    cursor.setHours(0, 0, 0, 0);
    const earliest = tickets.reduce(
      (min, ticket) => Math.min(min, Date.parse(ticket.openedAt) || min),
      end.getTime(),
    );
    while (days.length < 20 || cursor.getTime() >= earliest) {
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6)
        days.unshift({
          key: dayKey(cursor),
          label: cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          date: cursor.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }),
          novos: 0,
          andamento: 0,
          resolvidos: 0,
        });
      cursor.setDate(cursor.getDate() - 1);
    }
    const byDay = new Map(days.map((day) => [day.key, day]));
    const heatDays = new Set(days.slice(-20).map((day) => day.key));
    const heat = Array.from({ length: 5 }, () => Array<number>(12).fill(0));
    const modules = new Map<string, number>();
    const priorities = new Map<string, number>();
    let finished = 0;
    let active = 0;
    let waiting = 0;
    let canceled = 0;
    for (const ticket of tickets) {
      const opened = new Date(ticket.openedAt);
      const day = byDay.get(dayKey(opened));
      if (day) {
        day.novos++;
        if (["Em andamento", "Ocupado", "Com especialista"].includes(ticket.status))
          day.andamento++;
        const hour = opened.getHours() - 7;
        if (
          heatDays.has(day.key) &&
          hour >= 0 &&
          hour < 12 &&
          opened.getDay() >= 1 &&
          opened.getDay() <= 5
        )
          heat[opened.getDay() - 1][hour]++;
      }
      if (ticket.closedAt && ticket.status === "Finalizado") {
        const closedDay = byDay.get(dayKey(new Date(ticket.closedAt)));
        if (closedDay) closedDay.resolvidos++;
      }
      if (ticket.status === "Finalizado") finished++;
      else if (ticket.status === "Cancelado") canceled++;
      else if (["Em Aberto", "Aguardando cliente", "Agendamento"].includes(ticket.status))
        waiting++;
      else active++;
      const module = ticket.module.split(" - ").pop()?.trim() || "Não informado";
      modules.set(module, (modules.get(module) || 0) + 1);
      priorities.set(ticket.priority, (priorities.get(ticket.priority) || 0) + 1);
    }
    const ranked = [...modules].sort((a, b) => b[1] - a[1]);
    const segments = ranked.slice(0, 4).map(([name, value]) => ({ name, value }));
    const others = ranked.slice(4).reduce((sum, [, total]) => sum + total, 0);
    if (others) segments.push({ name: "Outros", value: others });
    return {
      days,
      heat,
      heatMax: Math.max(1, ...heat.flat()),
      segments,
      priorities,
      finished,
      active,
      waiting,
      canceled,
      recent: [...tickets]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 5),
    };
  }, [tickets, rangeEnd]);
  const maxOffset = Math.max(0, data.days.length - 20);
  const offset = Math.min(dayOffset, maxOffset);
  const visibleDays = data.days.slice(data.days.length - 20 - offset, data.days.length - offset);
  useEffect(() => {
    setDayOffset(0);
    setEdgeDirection(0);
  }, [tickets, rangeEnd]);
  useEffect(() => {
    if (!edgeDirection) return;
    const timer = window.setInterval(() => {
      setDayOffset((current) => Math.max(0, Math.min(maxOffset, current + edgeDirection)));
    }, 350);
    return () => window.clearInterval(timer);
  }, [edgeDirection, maxOffset]);
  const rate = tickets.length ? (data.finished / tickets.length) * 100 : 0;
  const stages = [
    { name: "Recebidos", value: tickets.length },
    { name: "Aguardando", value: data.waiting },
    { name: "Em atendimento", value: data.active },
    { name: "Finalizados", value: data.finished },
  ];

  return (
    <div className="analytics-overview">
      <Panel
        title="Panorama dos chamados"
        subtitle="Da abertura à conclusão"
        className="analytics-flow"
      >
        <div className="analytics-funnel">
          {stages.map((stage, index) => (
            <div
              className="analytics-funnel-row"
              key={stage.name}
              style={
                {
                  "--stage-color": ["#149fff", "#00cce8", "#ffa442", "#ffc541"][index],
                } as CSSProperties
              }
            >
              <div
                className="analytics-funnel-shape"
                style={{ width: `${100 - index * 20}%` }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 180 58" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`${funnelId}-body-${index}`} x1="0" x2="1">
                      <stop offset="0" stopColor="var(--stage-color)" />
                      <stop offset="0.12" stopColor="#c5f5ff" stopOpacity="0.9" />
                      <stop offset="0.24" stopColor="var(--stage-color)" />
                      <stop offset="0.55" stopColor="var(--stage-color)" stopOpacity="0.38" />
                      <stop offset="0.85" stopColor="var(--stage-color)" stopOpacity="0.8" />
                      <stop offset="1" stopColor="#ecfaff" />
                    </linearGradient>
                    <linearGradient id={`${funnelId}-top-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--stage-color)" stopOpacity="0.35" />
                      <stop offset="1" stopColor="var(--stage-color)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M5 10 Q90 23 175 10 L157 47 Q90 60 23 47 Z"
                    fill={`url(#${funnelId}-body-${index})`}
                    stroke="var(--stage-color)"
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx="90"
                    cy="10"
                    rx="85"
                    ry="8"
                    fill={`url(#${funnelId}-top-${index})`}
                    stroke="#b9efff"
                    strokeWidth="1.3"
                  />
                  <path d="M6 11 Q90 26 174 11" fill="none" stroke="#d5faff" strokeWidth="1.5" />
                  <path
                    d="M24 47 Q90 60 156 47"
                    fill="none"
                    stroke="var(--stage-color)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="analytics-funnel-tag">
                <span>{stage.name}</span>
                <strong>{number.format(stage.value)}</strong>
              </div>
              <small>
                {tickets.length
                  ? ((stage.value / tickets.length) * 100).toLocaleString("pt-BR", {
                      maximumFractionDigits:
                        stage.value > 0 && stage.value / tickets.length < 0.001 ? 2 : 1,
                    })
                  : 0}
                %
              </small>
            </div>
          ))}
        </div>
        <p className="analytics-footnote">{number.format(data.canceled)} cancelados</p>
      </Panel>

      <Panel
        title="Atendimentos por dia"
        subtitle="Volume e tendência de atendimentos no período"
        className="analytics-daily"
      >
        <div className="analytics-chart-legend">
          <span style={{ color: dailyColors.novos }}>● Novos</span>
          <span style={{ color: dailyColors.andamento }}>● Em andamento</span>
          <span style={{ color: dailyColors.resolvidos }}>● Resolvidos</span>
        </div>
        <div
          className="analytics-daily-chart"
          tabIndex={0}
          role="region"
          aria-label="Atendimentos por dia. Use as setas para navegar pelos dias."
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setDayOffset((current) =>
              Math.max(0, Math.min(maxOffset, current + (event.key === "ArrowLeft" ? 1 : -1))),
            );
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "touch") return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            setEdgeDirection(x < 36 ? 1 : x > bounds.width - 36 ? -1 : 0);
          }}
          onPointerLeave={() => setEdgeDirection(0)}
          onBlur={() => setEdgeDirection(0)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={visibleDays} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="overview-new" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={dailyColors.novos} stopOpacity={0.65} />
                  <stop offset="100%" stopColor={dailyColors.novos} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--analytics-grid)" vertical={true} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--analytics-grid)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as (typeof data.days)[number];
                  return (
                    <div className="analytics-daily-tooltip">
                      <strong>{point.date}</strong>
                      <span>
                        <i style={{ background: dailyColors.novos }} />
                        Novos <b>{point.novos}</b>
                      </span>
                      <span>
                        <i style={{ background: dailyColors.andamento }} />
                        Em andamento <b>{point.andamento}</b>
                      </span>
                      <span>
                        <i style={{ background: dailyColors.resolvidos }} />
                        Resolvidos <b>{point.resolvidos}</b>
                      </span>
                    </div>
                  );
                }}
              />
              <Area
                name="Novos"
                dataKey="novos"
                type="linear"
                stroke={dailyColors.novos}
                fill="url(#overview-new)"
                strokeWidth={1.5}
                isAnimationActive={false}
                dot={{ r: 2, fill: dailyColors.novos, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--analytics-surface)", strokeWidth: 2 }}
              />
              <Line
                name="Em andamento"
                dataKey="andamento"
                type="linear"
                stroke={dailyColors.andamento}
                strokeWidth={1.5}
                isAnimationActive={false}
                dot={{ r: 2, fill: dailyColors.andamento, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--analytics-surface)", strokeWidth: 2 }}
              />
              <Line
                name="Resolvidos"
                dataKey="resolvidos"
                type="linear"
                stroke={dailyColors.resolvidos}
                strokeWidth={1.5}
                isAnimationActive={false}
                dot={{ r: 2, fill: dailyColors.resolvidos, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "var(--analytics-surface)", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Interações recentes"
        subtitle="Últimas atualizações dos chamados"
        className="analytics-recent"
      >
        {data.recent.length === 0 && (
          <p className="analytics-empty">Nenhum chamado neste período.</p>
        )}
        {data.recent.map((ticket) => {
          const Icon =
            ticket.source === "Telefone"
              ? Phone
              : ticket.source === "Email"
                ? Mail
                : ticket.source === "WhatsApp"
                  ? MessageCircle
                  : Globe;
          return (
            <Link
              key={ticket.id}
              to="/chamados"
              search={{ ticket: ticket.id }}
              className="analytics-recent-row"
              title={`${ticket.clientName || ticket.clientCode}: ${ticket.subject}`}
            >
              <span className="analytics-avatar">
                {(ticket.owner || ticket.attendant || "?").slice(0, 2)}
              </span>
              <Icon size={14} />
              <div>
                <strong>{ticket.clientName || ticket.clientCode || "Empresa não informada"}</strong>
                <p>{ticket.subject}</p>
                <time>{new Date(ticket.updatedAt).toLocaleDateString("pt-BR")}</time>
              </div>
              <span className={cn("analytics-status", ticketStatusTone[ticket.status])}>
                {ticket.status}
              </span>
            </Link>
          );
        })}
        <Link to="/chamados" className="analytics-view-all">
          Ver chamados <ArrowUpRight size={14} />
        </Link>
      </Panel>

      <Panel
        title="Taxa de resolução"
        subtitle="Chamados finalizados no período"
        className="analytics-resolution"
      >
        <div className="analytics-ring-layout">
          <div className="analytics-ring">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { value: data.finished },
                    {
                      value:
                        Math.max(0, tickets.length - data.finished) || (tickets.length ? 0 : 1),
                    },
                  ]}
                  dataKey="value"
                  innerRadius="72%"
                  outerRadius="96%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  <Cell fill={colors[1]} />
                  <Cell fill="var(--analytics-grid)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <strong>{rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
              <span>resolvidos</span>
            </div>
          </div>
          <div className="analytics-ring-legend">
            {["Alta", "Media", "Baixa"].map((priority, index) => (
              <div key={priority}>
                <span>
                  <i style={{ background: colors[index + 1] }} />
                  {priority === "Media" ? "Média" : priority}
                </span>
                <strong>{number.format(data.priorities.get(priority) || 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title="Distribuição por módulo"
        subtitle="Áreas mais acionadas"
        className="analytics-segments"
      >
        <div className="analytics-ring-layout">
          <div className="analytics-ring">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.segments.length ? data.segments : [{ name: "Sem dados", value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="66%"
                  outerRadius="96%"
                  stroke="none"
                >
                  {(data.segments.length ? data.segments : [{ name: "Sem dados" }]).map(
                    (segment, index) => (
                      <Cell
                        key={segment.name}
                        fill={data.segments.length ? colors[index] : "var(--analytics-grid)"}
                      />
                    ),
                  )}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                    color: "var(--foreground)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div>
              <strong>{number.format(tickets.length)}</strong>
              <span>chamados</span>
            </div>
          </div>
          <div className="analytics-ring-legend">
            {data.segments.map((segment, index) => (
              <div key={segment.name} title={segment.name}>
                <span>
                  <i style={{ background: colors[index] }} />
                  {segment.name}
                </span>
                <strong>
                  {((segment.value / tickets.length) * 100).toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </strong>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title="Mapa de atividade"
        subtitle="Aberturas por dia e horário · 20 dias úteis"
        className="analytics-heatmap"
      >
        <div className="analytics-heat-grid">
          {data.heat.map((row, index) => (
            <div key={index}>
              <span>{["Seg", "Ter", "Qua", "Qui", "Sex"][index]}</span>
              {row.map((value, hour) => (
                <span
                  key={hour}
                  tabIndex={0}
                  className="analytics-heat-cell"
                  style={{
                    background: value
                      ? `color-mix(in srgb, #11c5ed ${20 + (value / data.heatMax) * 80}%, var(--analytics-heat-base))`
                      : "var(--analytics-grid)",
                  }}
                  title={`${["Segunda", "Terça", "Quarta", "Quinta", "Sexta"][index]}, ${hour + 7}h: ${value} chamados`}
                  aria-label={`${["Segunda", "Terça", "Quarta", "Quinta", "Sexta"][index]}, ${hour + 7}h: ${value} chamados`}
                />
              ))}
            </div>
          ))}
          <div className="analytics-heat-hours">
            <span />
            {Array.from({ length: 12 }, (_, hour) => (
              <span key={hour}>{hour % 2 === 0 ? `${hour + 7}h` : ""}</span>
            ))}
          </div>
        </div>
        <div className="analytics-heat-key">
          <span>Menos</span>
          {[20, 40, 60, 80, 100].map((value) => (
            <i
              key={value}
              style={{
                background: `color-mix(in srgb, #11c5ed ${value}%, var(--analytics-heat-base))`,
              }}
            />
          ))}
          <span>Mais</span>
        </div>
      </Panel>
    </div>
  );
}
