import { useId, useMemo, useState, type PointerEvent } from "react";
import { GitBranch, GripHorizontal, RotateCcw, X } from "lucide-react";
import type { SupportTicket } from "@/lib/support-tickets-data";
import "./connected-analysis.css";

type Dimension = "module" | "clientName" | "owner" | "status";
type Filter = { dimension: Dimension; value: string };
type Branch = {
  id: number;
  parent: number | null;
  title: string;
  filters: Filter[];
  dimension: Dimension;
  x: number;
  y: number;
};
const dimensions: { value: Dimension; label: string }[] = [
  { value: "module", label: "Módulos" },
  { value: "clientName", label: "Clientes" },
  { value: "owner", label: "Responsáveis" },
  { value: "status", label: "Situação" },
];
const initial: Branch = {
  id: 0,
  parent: null,
  title: "Chamados do período",
  filters: [],
  dimension: "module",
  x: 32,
  y: 50,
};
const labelFor = (ticket: SupportTicket, dimension: Dimension) =>
  ticket[dimension]?.trim() || "Não informado";

export function ConnectedAnalysis({ tickets }: { tickets: SupportTicket[] }) {
  const [branches, setBranches] = useState<Branch[]>([initial]);
  const [active, setActive] = useState(false);
  const glow = useId().replace(/:/g, "");
  const nodes = useMemo(
    () =>
      branches.map((branch) => {
        const scoped = tickets.filter((ticket) =>
          branch.filters.every((filter) => labelFor(ticket, filter.dimension) === filter.value),
        );
        const counts = new Map<string, number>();
        scoped.forEach((ticket) => {
          const label = labelFor(ticket, branch.dimension);
          counts.set(label, (counts.get(label) || 0) + 1);
        });
        return {
          ...branch,
          total: scoped.length,
          rows: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
        };
      }),
    [branches, tickets],
  );
  const width = Math.max(1000, ...branches.map((branch) => branch.x + 340));
  const height = Math.max(470, ...branches.map((branch) => branch.y + 410));

  function expand(branch: Branch, value: string) {
    setActive(true);
    setBranches((current) => {
      if (
        current.some(
          (node) =>
            node.parent === branch.id &&
            node.filters.at(-1)?.value === value &&
            node.filters.at(-1)?.dimension === branch.dimension,
        )
      )
        return current;
      const filters = [...branch.filters, { dimension: branch.dimension, value }];
      const next = dimensions.find(
        (dimension) => !filters.some((filter) => filter.dimension === dimension.value),
      );
      if (!next) return current;
      return [
        ...current,
        {
          id: Math.max(...current.map((node) => node.id)) + 1,
          parent: branch.id,
          title: value,
          filters,
          dimension: next.value,
          x: branch.x + 365,
          y: 50 + current.filter((node) => node.parent === branch.id).length * 420,
        },
      ];
    });
  }

  function remove(id: number) {
    setBranches((current) => {
      const removed = new Set([id]);
      for (const node of current)
        if (node.parent !== null && removed.has(node.parent)) removed.add(node.id);
      return current.filter((node) => !removed.has(node.id));
    });
  }

  function drag(event: PointerEvent<HTMLButtonElement>, branch: Branch) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX,
      startY = event.clientY;
    const button = event.currentTarget;
    const move = (moveEvent: globalThis.PointerEvent) =>
      setBranches((current) =>
        current.map((node) =>
          node.id === branch.id
            ? {
                ...node,
                x: Math.max(16, branch.x + moveEvent.clientX - startX),
                y: Math.max(16, branch.y + moveEvent.clientY - startY),
              }
            : node,
        ),
      );
    const stop = () => {
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", stop);
      button.removeEventListener("pointercancel", stop);
      button.removeEventListener("lostpointercapture", stop);
    };
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
  }

  return (
    <div className="connected-analysis">
      <header className="connected-analysis__toolbar">
        <div>
          <h2>
            <GitBranch size={18} /> Explorar conexões
          </h2>
          <p>Selecione uma barra para detalhar. Arraste os cartões para organizar a análise.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setBranches([initial]);
            setActive(false);
          }}
        >
          <RotateCcw size={14} /> Reiniciar
        </button>
      </header>
      <div
        className="connected-analysis__viewport"
        tabIndex={0}
        role="region"
        aria-label="Mapa de análise de chamados; role para explorar os cartões"
      >
        <div
          className={`connected-analysis__canvas ${active ? "is-exploring" : ""}`}
          style={{ width, height }}
        >
          <svg
            className="connected-analysis__wires"
            width={width}
            height={height}
            aria-hidden="true"
          >
            <defs>
              <filter id={glow}>
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>
            {branches
              .filter((branch) => branch.parent !== null)
              .map((branch) => {
                const parent = branches.find((node) => node.id === branch.parent)!;
                const x = parent.x + 300,
                  y = parent.y + 160;
                const path = `M ${x} ${y} C ${x + 65} ${y}, ${branch.x - 65} ${branch.y + 70}, ${branch.x} ${branch.y + 70}`;
                return (
                  <g key={branch.id}>
                    <path
                      d={path}
                      stroke="#38d9f5"
                      strokeWidth="5"
                      filter={`url(#${glow})`}
                      opacity=".5"
                    />
                    <path
                      className="connected-analysis__wire"
                      d={path}
                      stroke="#70e9fa"
                      strokeWidth="1.5"
                      pathLength="1"
                    />
                    <circle cx={x} cy={y} r="3" fill="#adf5ff" />
                    <circle cx={branch.x} cy={branch.y + 70} r="3" fill="#adf5ff" />
                  </g>
                );
              })}
          </svg>
          {nodes.map((branch) => (
            <article
              key={branch.id}
              className="connected-analysis__node"
              style={{ left: branch.x, top: branch.y }}
              aria-label={branch.title}
            >
              <div className="connected-analysis__node-header">
                <button
                  type="button"
                  className="connected-analysis__grip"
                  aria-label={`Mover ${branch.title}; use as setas`}
                  onPointerDown={(event) => drag(event, branch)}
                  onKeyDown={(event) => {
                    const offsets: Record<string, [number, number]> = {
                      ArrowLeft: [-20, 0],
                      ArrowRight: [20, 0],
                      ArrowUp: [0, -20],
                      ArrowDown: [0, 20],
                    };
                    const offset = offsets[event.key];
                    if (!offset) return;
                    event.preventDefault();
                    setBranches((current) =>
                      current.map((node) =>
                        node.id === branch.id
                          ? {
                              ...node,
                              x: Math.max(16, node.x + offset[0]),
                              y: Math.max(16, node.y + offset[1]),
                            }
                          : node,
                      ),
                    );
                  }}
                >
                  <GripHorizontal size={15} />
                </button>
                <h3 title={branch.title}>{branch.title}</h3>
                {branch.parent !== null && (
                  <button
                    type="button"
                    aria-label={`Fechar ${branch.title} e suas ramificações`}
                    onClick={() => remove(branch.id)}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="connected-analysis__summary">
                <strong>{branch.total.toLocaleString("pt-BR")}</strong>
                <span>chamados no recorte</span>
              </div>
              <label className="connected-analysis__dimension">
                Detalhar por
                <select
                  value={branch.dimension}
                  onChange={(event) => {
                    const dimension = event.target.value as Dimension;
                    setBranches((current) =>
                      current.map((node) =>
                        node.id === branch.id ? { ...node, dimension } : node,
                      ),
                    );
                  }}
                >
                  {dimensions
                    .filter(
                      (dimension) =>
                        !branch.filters.some((filter) => filter.dimension === dimension.value),
                    )
                    .map((dimension) => (
                      <option key={dimension.value} value={dimension.value}>
                        {dimension.label}
                      </option>
                    ))}
                </select>
              </label>
              <div className="connected-analysis__rows">
                {branch.rows.length === 0 && (
                  <p>Nenhum chamado neste recorte. Ajuste os filtros do Analytics.</p>
                )}
                {branch.rows.map(([label, count]) => (
                  <button
                    type="button"
                    key={label}
                    disabled={branch.filters.length >= 3}
                    onClick={() => expand(branch, label)}
                    aria-label={`${label}: ${count} chamados${branch.filters.length < 3 ? ", abrir detalhes" : ""}`}
                  >
                    <span className="connected-analysis__row-label">{label}</span>
                    <strong>{count}</strong>
                    <span className="connected-analysis__track">
                      <span
                        style={{ width: `${(count / Math.max(1, branch.rows[0][1])) * 100}%` }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <footer>
                {branch.filters.length >= 3
                  ? "Detalhamento completo"
                  : "Clique em uma barra para abrir uma conexão"}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
