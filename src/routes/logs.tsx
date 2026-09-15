import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogsTable } from "@/components/portal/LatestLogsCard";
import { listHadronLogs, type AuthLogRow } from "@/lib/auth-logs-api";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Logs do sistema - Portal Prócion" },
      {
        name: "description",
        content:
          "Consulte os logs externos do Portal Prócion com filtros por controlador, sigla e busca livre.",
      },
      { property: "og:title", content: "Logs do sistema - Portal Prócion" },
      {
        property: "og:description",
        content: "Histórico completo de logs externos com paginação e filtros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogsPage,
});

const PAGE_SIZE = 25;

function LogsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [controller, setController] = useState("");
  const [acronym, setAcronym] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuthLogRow[]>([]);
  const [controllers, setControllers] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listHadronLogs({
      search: search || undefined,
      operation: controller || undefined,
      acronym: acronym || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        if (result.controllers.length > 0) setControllers(result.controllers);
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
  }, [search, controller, acronym, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <AppShell>
      <PageHeader title="Logs do sistema" description="Registros externos mais recentes" />

      <form
        className="mb-4 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSearch(searchInput.trim());
        }}
      >
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por controlador, ação, operador, URL ou IP"
          className="h-9 w-full max-w-sm"
        />
        <select
          aria-label="Filtrar por controlador"
          value={controller}
          onChange={(event) => {
            setPage(0);
            setController(event.target.value);
          }}
          className="h-9 cursor-pointer rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os controladores</option>
          {controllers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Input
          value={acronym}
          onChange={(event) => {
            setPage(0);
            setAcronym(event.target.value.toUpperCase());
          }}
          placeholder="Sigla"
          className="h-9 w-28 uppercase"
        />
        <Button type="submit" size="sm" className="h-9">
          Buscar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            setSearchInput("");
            setSearch("");
            setController("");
            setAcronym("");
            setPage(0);
          }}
        >
          Limpar
        </Button>
      </form>

      <div className="overflow-hidden rounded-[16px] border border-border bg-card">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Carregando logs…</p>
        ) : error ? (
          <p className="px-4 py-6 text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum log encontrado.</p>
        ) : (
          <LogsTable rows={rows} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} registro{total === 1 ? "" : "s"} · página {page + 1} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
