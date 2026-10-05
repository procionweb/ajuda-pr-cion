import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { GitBranch, X, ArrowLeft } from "lucide-react";
import "./analytics-focus.css";

export type FocusRow = { id: string; dimensions: Record<string, string> };
const FocusData = createContext<FocusRow[] | null>(null);
export function AnalyticsFocusData({ rows, children }: { rows: FocusRow[]; children: ReactNode }) {
  return <FocusData.Provider value={rows}>{children}</FocusData.Provider>;
}

/** Read-only breakdowns of the exact dataset supplied by the analytics view. */
export function AnalyzeButton({ title }: { title: string }) {
  const contextRows = useContext(FocusData);
  const rows = contextRows ?? [];
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<{ dimension: string; value: string }[]>([]);
  const scoped = useMemo(
    () => rows.filter((row) => filters.every((f) => row.dimensions[f.dimension] === f.value)),
    [rows, filters],
  );
  const dimensions = Object.keys(rows[0]?.dimensions ?? {}).slice(0, 4);
  if (contextRows === null) return null;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setFilters([]);
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="af-trigger" aria-label={`Analisar ${title}`}>
          <GitBranch size={14} /> Analisar
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="af-backdrop" />
        <Dialog.Content className="af-dialog" aria-describedby="af-description">
          <header className="af-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description id="af-description">
                Análise do recorte atual. Clique em um grupo para aprofundar.
              </Dialog.Description>
            </div>
            <Dialog.Close className="af-close" aria-label="Fechar análise">
              <X size={20} />
            </Dialog.Close>
          </header>
          <div className="af-breadcrumb">
            <button
              disabled={!filters.length}
              onClick={() => setFilters((current) => current.slice(0, -1))}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <span>
              {filters.length
                ? filters.map((f) => `${f.dimension}: ${f.value}`).join(" / ")
                : "Todos os registros do recorte"}
            </span>
          </div>
          <div className="af-network" key={JSON.stringify(filters)}>
            <svg
              className="af-lines"
              viewBox="0 0 1000 580"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {[
                [245, 145],
                [755, 145],
                [245, 435],
                [755, 435],
              ]
                .slice(0, dimensions.length)
                .map(([x, y], i) => (
                  <g key={i} style={{ animationDelay: `${i * 100}ms` }}>
                    <path pathLength="1" d={`M500 290 C${x} 290, 500 ${y}, ${x} ${y}`} />
                    <circle cx={x} cy={y} r="4" />
                  </g>
                ))}
            </svg>
            <article className="af-source">
              <GitBranch size={24} />
              <span>Registros em foco</span>
              <strong>{scoped.length.toLocaleString("pt-BR")}</strong>
              <small>de {rows.length.toLocaleString("pt-BR")} no recorte atual</small>
            </article>
            {dimensions.map((dimension, index) => {
              const counts = new Map<string, number>();
              scoped.forEach((row) => {
                const value = row.dimensions[dimension] || "Não informado";
                counts.set(value, (counts.get(value) ?? 0) + 1);
              });
              const groups = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
              return (
                <article
                  key={dimension}
                  className={`af-node af-node-${index}`}
                  style={{ "--delay": `${index * 110}ms` } as CSSProperties}
                >
                  <h3>{dimension}</h3>
                  <div className="af-groups">
                    {groups.map(([value, count]) => (
                      <button
                        key={value}
                        onClick={() =>
                          setFilters((current) => [
                            ...current.filter((f) => f.dimension !== dimension),
                            { dimension, value },
                          ])
                        }
                      >
                        <span>{value}</span>
                        <b>{count}</b>
                        <i
                          style={{ width: `${scoped.length ? (count / scoped.length) * 100 : 0}%` }}
                        />
                      </button>
                    ))}
                    {!groups.length && <p>Nenhum registro neste recorte.</p>}
                  </div>
                  <small>
                    {groups.length} grupos • {scoped.length} registros
                  </small>
                </article>
              );
            })}
            {!rows.length && <p className="af-empty">Não há dados disponíveis para analisar.</p>}
          </div>
          <footer className="af-footer">
            Contagens calculadas com os dados e filtros desta aba. Esc para sair.
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
