import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import {
  formatLogDate,
  listHadronLogs,
  type AuthLogRow,
} from "@/lib/auth-logs-api";

export function LatestLogsCard() {
  const [rows, setRows] = useState<AuthLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listHadronLogs({ limit: 6 })
      .then((page) => {
        if (!active) return;
        setRows(page.rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar os logs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-card text-card-foreground shadow-[0_14px_36px_rgba(15,16,20,0.08)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-[17px] font-semibold leading-tight">Últimos Logs</h2>
        </div>
        <Link
          to="/configuracoes/logs"
          className="shrink-0 text-[13px] font-medium text-primary hover:underline"
        >
          Ver todos
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">Carregando logs…</p>
        ) : error ? (
          <p className="px-6 py-6 text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">Nenhum log encontrado.</p>
        ) : (
          <LogsTable rows={rows} />
        )}
      </div>
    </section>
  );
}

export function LogsTable({ rows }: { rows: AuthLogRow[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Controlador / Ação</th>
            <th className="px-4 py-2 font-medium">Sigla</th>
            <th className="px-4 py-2 font-medium">URL / Informação</th>
            <th className="px-4 py-2 font-medium">Operador / IP</th>
            <th className="px-4 py-2 font-medium whitespace-nowrap">Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((log) => (
            <tr key={log.id} className="align-top transition hover:bg-muted/40">
              <td className="px-4 py-2">
                <p className="font-medium text-foreground">{log.controller ?? "—"}</p>
                <p className="text-[11.5px] text-muted-foreground">{log.action ?? "—"}</p>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-foreground">
                {log.clientAcronym ?? "—"}
              </td>
              <td className="max-w-[320px] px-4 py-2">
                <p className="break-all text-[11.5px] text-muted-foreground">
                  {log.url ?? "—"}
                </p>
                {log.info ? (
                  <p className="break-all text-[11.5px] text-muted-foreground/80">{log.info}</p>
                ) : null}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <p className="text-foreground">{log.operator ?? "—"}</p>
                <p className="text-[11.5px] text-muted-foreground">{log.ipAddress ?? "—"}</p>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                {formatLogDate(log.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
