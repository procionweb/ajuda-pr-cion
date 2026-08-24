import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FileKey2, Pencil, RefreshCw, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes/contratos")({
  head: () => ({ meta: [{ title: "Contratos - Configurações - Portal Prócion" }] }),
  component: ContractsSettingsPage,
});

type ContractRow = {
  id: string;
  legacy_id: string;
  client_id: string | null;
  contract_key: string | null;
  name: string | null;
  status: string | null;
  active: boolean;
  crm_created_at: string | null;
  crm_updated_at: string | null;
  source_payload: Record<string, unknown> | null;
  acronym: string;
};
const PAGE_SIZE = 10;

function ContractsSettingsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    acronym: "",
    name: "",
    key: "",
    modules: "",
    created: "",
    updated: "",
    status: "",
  });
  const [page, setPage] = useState(0);

  async function loadContracts() {
    setLoading(true);
    setError(null);
    // Imported CRM tables are not represented in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: requestError } = await (supabase as any)
      .from("auth_contratos")
      .select(
        "id,legacy_id,client_id,contract_key,name,status,active,crm_created_at,crm_updated_at,source_payload",
      )
      .order("crm_updated_at", { ascending: false, nullsFirst: false });
    if (requestError) {
      setError(requestError.message);
      setContracts([]);
      setLoading(false);
      return;
    }
    const raw = (data ?? []) as Omit<ContractRow, "acronym">[];
    const ids = [...new Set(raw.map((item) => item.client_id).filter(Boolean))];
    const acronyms = new Map<string, string>();
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: clients } = await (supabase as any)
        .from("clients")
        .select("id,acronym")
        .in("id", ids);
      for (const client of clients ?? []) acronyms.set(client.id, client.acronym ?? "");
    }
    setContracts(
      raw.map((item) => ({
        ...item,
        acronym:
          acronyms.get(item.client_id) ?? payloadText(item.source_payload, "con_cliente_sigla"),
      })),
    );
    setLoading(false);
  }
  useEffect(() => {
    void loadContracts();
  }, []);
  const filtered = useMemo(
    () =>
      contracts.filter((item) => {
        const modules = contractModules(item).join(", ");
        return (
          includes(item.acronym, filters.acronym) &&
          includes(item.name, filters.name) &&
          includes(item.contract_key, filters.key) &&
          includes(modules, filters.modules) &&
          includes(formatDate(item.crm_created_at), filters.created) &&
          includes(formatDate(item.crm_updated_at), filters.updated) &&
          (!filters.status || (filters.status === "active" ? item.active : !item.active))
        );
      }),
    [contracts, filters],
  );
  useEffect(() => setPage(0), [filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Contratos"
        description="Contratos Web e módulos habilitados por cliente."
        breadcrumbs={[{ label: "Configurações" }, { label: "Contratos" }]}
      />
      <div className="mb-4 flex justify-end">
        <Button className="gap-2" onClick={() => void loadContracts()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Buscar
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="border-b bg-muted/35 text-muted-foreground">
              <tr>
                {[
                  "Sigla",
                  "Descrição",
                  "Contrato",
                  "Módulos",
                  "Criado",
                  "Modificado",
                  "Status",
                  "Ações",
                ].map((label) => (
                  <th key={label} className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
              <tr className="border-t">
                {(["acronym", "name", "key", "modules", "created", "updated"] as const).map(
                  (key) => (
                    <th key={key} className="p-2">
                      <label className="relative block">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
                        <Input
                          className="h-8 pl-7 text-xs"
                          value={filters[key]}
                          onChange={(e) => setFilter(key, e.target.value)}
                        />
                      </label>
                    </th>
                  ),
                )}
                <th className="p-2">
                  <select
                    className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                    value={filters.status}
                    onChange={(e) => setFilter("status", e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="active">Ativados</option>
                    <option value="inactive">Desativados</option>
                  </select>
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <Empty message="Carregando contratos..." />
              ) : error ? (
                <Empty message={`Não foi possível carregar os contratos: ${error}`} />
              ) : !rows.length ? (
                <Empty message="Nenhum contrato encontrado." />
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/25">
                    <td className="px-3 py-3 text-center text-muted-foreground">
                      {item.acronym || "—"}
                    </td>
                    <td className="px-3 py-3 font-medium">{item.name || "Não informado"}</td>
                    <td className="px-3 py-3 font-mono">{item.contract_key || "—"}</td>
                    <td className="px-3 py-3">{contractModules(item).join(", ") || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDate(item.crm_created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDate(item.crm_updated_at)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-medium",
                          item.active
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.active ? "Ativado" : "Desativado"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Button variant="ghost" size="icon" title="Editar contrato" disabled>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
          <span>
            {filtered.length ? safePage * PAGE_SIZE + 1 : 0}-
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} contratos
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!safePage}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Página {safePage + 1} de {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage + 1 >= pages}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
function Empty({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={8} className="h-48 text-center text-muted-foreground">
        <FileKey2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
        {message}
      </td>
    </tr>
  );
}
function contractModules(item: ContractRow) {
  const raw = item.source_payload?.con_web_apps;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}
function payloadText(payload: Record<string, unknown> | null, key: string) {
  return String(payload?.[key] ?? "");
}
function includes(value: unknown, query: string) {
  return !normalize(query) || normalize(value).includes(normalize(query));
}
function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
