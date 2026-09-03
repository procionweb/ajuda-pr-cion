import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Search, ScrollText } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { DateRangeFilter } from "@/components/portal/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLogDate, listConfigurationAuthLogs, type AuthLogRow } from "@/lib/auth-logs-api";

export const Route = createFileRoute("/configuracoes/logs")({
  head: () => ({ meta: [{ title: "Logs - Configurações - Portal Prócion" }] }),
  component: ConfigurationLogsPage,
});

const PAGE_SIZE = 25;
type Filters = {
  operator: string;
  acronym: string;
  search: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
};
const EMPTY_FILTERS: Filters = {
  operator: "",
  acronym: "",
  search: "",
  fromDate: "",
  fromTime: "",
  toDate: "",
  toTime: "",
};

function toIso(date: string, time: string, end = false) {
  if (!date) return undefined;
  const value = new Date(`${date}T${time || (end ? "23:59:59" : "00:00:00")}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

function ConfigurationLogsPage() {
  const [rows, setRows] = useState<AuthLogRow[]>([]);
  const [operators, setOperators] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listConfigurationAuthLogs({
      search: filters.search,
      operator: filters.operator,
      acronym: filters.acronym,
      from: toIso(filters.fromDate, filters.fromTime),
      to: toIso(filters.toDate, filters.toTime, true),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setOperators(result.operators);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Não foi possível carregar os logs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function search() {
    setPage(0);
    setFilters({ ...draft, acronym: draft.acronym.toUpperCase() });
  }
  function clear() {
    setDraft(EMPTY_FILTERS);
    setPage(0);
    setFilters(EMPTY_FILTERS);
  }

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Logs internos"
        description="Auditoria de acessos e ações registradas no CRM."
        icon={ScrollText}
      />
      <section className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[190px_130px_minmax(220px,1fr)_220px_120px_120px_auto]">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.operator}
            onChange={(e) => update("operator", e.target.value)}
            aria-label="Operador"
          >
            <option value="">Todos os operadores</option>
            {operators.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </select>
          <Input
            placeholder="Sigla"
            value={draft.acronym}
            onChange={(e) => update("acronym", e.target.value.toUpperCase())}
          />
          <Input
            placeholder="Pesquisa geral"
            value={draft.search}
            onChange={(e) => update("search", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
          />
          <DateRangeFilter
            from={draft.fromDate}
            to={draft.toDate}
            onChange={(start, end) =>
              setDraft((current) => ({ ...current, fromDate: start, toDate: end }))
            }
          />
          <Input
            type="time"
            aria-label="Hora inicial"
            value={draft.fromTime}
            onChange={(e) => update("fromTime", e.target.value)}
          />
          <Input
            type="time"
            aria-label="Hora final"
            value={draft.toTime}
            onChange={(e) => update("toTime", e.target.value)}
          />
          <Button onClick={search}>
            <Search className="mr-2 size-4" />
            Buscar
          </Button>
        </div>
        {Object.values(filters).some(Boolean) && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Limpar filtros
          </Button>
        )}

        <div className="overflow-hidden rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead className="border-b bg-muted/35 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Operador / IP</th>
                  <th className="px-4 py-3">Sigla</th>
                  <th className="px-4 py-3">Controlador / Ação</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Info. extra</th>
                  <th className="px-4 py-3">Dispositivo</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{row.operator || "—"}</div>
                      <div className="text-muted-foreground">{row.ipAddress || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {row.clientAcronym || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.controller || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.action || "—"}</div>
                    </td>
                    <td className="max-w-[330px] break-all px-4 py-3">{row.url || "—"}</td>
                    <td className="max-w-[360px] whitespace-normal px-4 py-3">{row.info || "—"}</td>
                    <td className="px-4 py-3">{row.device || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatLogDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="flex min-h-40 items-center justify-center text-muted-foreground">
              <RefreshCw className="mr-2 size-4 animate-spin" />
              Carregando logs...
            </div>
          )}
          {!loading && error && (
            <div className="flex min-h-40 items-center justify-center px-6 text-center text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="flex min-h-40 items-center justify-center text-muted-foreground">
              Nenhum log encontrado.
            </div>
          )}
        </div>
        <div className="mt-3">
          <ListPaginationFooter
            page={page}
            pageCount={pages}
            pageSize={PAGE_SIZE}
            total={total}
            noun="registros"
            onPageChange={setPage}
            loading={loading}
          />
        </div>
      </section>
    </AppShell>
  );
}
