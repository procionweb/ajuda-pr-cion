import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Search, Smartphone } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes/dispositivos")({
  head: () => ({ meta: [{ title: "Dispositivos - Configurações - Portal Prócion" }] }),
  component: DevicesSettingsPage,
});

type DeviceRow = {
  id: string;
  legacy_id: string;
  auth_contratos_id_con: string;
  device_uuid: string | null;
  utilizador: string | null;
  codrep: string | null;
  tipo: string | null;
  sistema: string | null;
  status: string | null;
  active: boolean;
  build_version: string | null;
  db_version: string | null;
  last_checked_at: string | null;
  crm_created_at: string | null;
  crm_updated_at: string | null;
  client_id: string | null;
  client_acronym: string;
};

const PAGE_SIZE = 25;

function DevicesSettingsPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [acronym, setAcronym] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  async function loadDevices() {
    setLoading(true);
    setError(null);
    // Imported CRM tables are not represented in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: requestError } = await (supabase as any)
      .from("mob_dispositivos")
      .select(
        "id,legacy_id,auth_contratos_id_con,client_id,device_uuid,utilizador,codrep,tipo,sistema,status,active,build_version,db_version,last_checked_at,crm_created_at,crm_updated_at",
      )
      .order("last_checked_at", { ascending: false, nullsFirst: false });

    if (requestError) {
      setError(requestError.message || "Falha ao consultar os dispositivos.");
      setDevices([]);
    } else {
      const rawDevices = (data ?? []) as Omit<DeviceRow, "client_acronym">[];
      const clientIds = [...new Set(rawDevices.map((item) => item.client_id).filter(Boolean))];
      const acronyms = new Map<string, string>();
      if (clientIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: clients } = await (supabase as any)
          .from("clients")
          .select("id,acronym")
          .in("id", clientIds);
        for (const client of clients ?? []) acronyms.set(client.id, client.acronym ?? "");
      }
      setDevices(
        rawDevices.map((item) => ({
          ...item,
          client_acronym: item.client_id ? (acronyms.get(item.client_id) ?? "") : "",
        })),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadDevices();
  }, []);

  const types = useMemo(
    () => [...new Set(devices.map((item) => item.tipo).filter(Boolean) as string[])].sort(),
    [devices],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query);
    const normalizedAcronym = normalize(acronym);
    return devices.filter((item) => {
      const clientAcronym = item.client_acronym;
      if (normalizedAcronym && !normalize(clientAcronym).includes(normalizedAcronym)) return false;
      if (type && item.tipo !== type) return false;
      if (status === "active" && !item.active) return false;
      if (status === "inactive" && item.active) return false;
      if (!normalizedQuery) return true;
      return [
        clientAcronym,
        item.auth_contratos_id_con,
        item.device_uuid,
        item.utilizador,
        item.codrep,
        item.tipo,
        item.sistema,
        item.build_version,
        item.db_version,
      ].some((value) => normalize(value).includes(normalizedQuery));
    });
  }, [acronym, devices, query, status, type]);

  useEffect(() => setPage(0), [acronym, query, status, type]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function exportCsv() {
    const headers = [
      "Sigla/Chave",
      "Status",
      "Última verificação",
      "Data de atualização",
      "Utilizador",
      "Representante",
      "Tipo",
      "Versão",
      "Sistema",
      "UUID",
      "Data de registro",
    ];
    const lines = filtered.map((item) => [
      `${item.client_acronym} | ${item.auth_contratos_id_con}`,
      item.active ? "Ativo" : "Inativo",
      formatDate(item.last_checked_at),
      formatDate(item.crm_updated_at),
      item.utilizador ?? "",
      item.codrep ?? "",
      item.tipo ?? "",
      formatVersion(item),
      item.sistema ?? "",
      item.device_uuid ?? "",
      formatDate(item.crm_created_at),
    ]);
    const csv = [headers, ...lines]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = "dispositivos-mobile.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Dispositivos Mobile"
        description="Dispositivos vinculados aos contratos de internet dos clientes."
        breadcrumbs={[{ label: "Configurações" }, { label: "Dispositivos" }]}
      />

      <section className="mb-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_170px_190px_180px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca geral"
            className="h-10 pl-9"
          />
        </label>
        <Input
          value={acronym}
          onChange={(event) => setAcronym(event.target.value.toUpperCase())}
          placeholder="Sigla"
          className="h-10 uppercase"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os tipos</option>
          {types.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={selectClass}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <Button className="h-10 gap-2" onClick={() => void loadDevices()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Buscar
        </Button>
      </section>

      <div className="mb-3 flex justify-end">
        <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-xs">
            <thead className="border-b bg-muted/35 uppercase text-muted-foreground">
              <tr>
                {[
                  "Sigla / Chave",
                  "Status",
                  "Últ. verificação",
                  "Data atualização",
                  "Utilizador",
                  "Representante",
                  "Tipo",
                  "Versão",
                  "Sistema",
                  "UUID",
                  "Data de registro",
                ].map((label) => (
                  <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <EmptyRow message="Carregando dispositivos..." />
              ) : error ? (
                <EmptyRow
                  message={`Não foi possível carregar os dispositivos: ${error}`}
                  destructive
                />
              ) : rows.length === 0 ? (
                <EmptyRow message="Nenhum dispositivo encontrado." />
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/25">
                    <td className="whitespace-nowrap px-3 py-3 font-medium">
                      {item.client_acronym || "—"} | {item.auth_contratos_id_con}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge active={item.active} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDate(item.last_checked_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDate(item.crm_updated_at)}
                    </td>
                    <td
                      className="max-w-52 truncate px-3 py-3"
                      title={item.utilizador ?? undefined}
                    >
                      {item.utilizador || "Não informado"}
                    </td>
                    <td className="px-3 py-3 text-center">{item.codrep || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{item.tipo || "Não informado"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatVersion(item)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {item.sistema || "Não informado"}
                    </td>
                    <td
                      className="max-w-72 truncate px-3 py-3 font-mono"
                      title={item.device_uuid ?? undefined}
                    >
                      {item.device_uuid || "Não informado"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDate(item.crm_created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
          <span>
            Mostrando {filtered.length ? safePage * PAGE_SIZE + 1 : 0} a{" "}
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}{" "}
            dispositivos
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Página {safePage + 1} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage + 1 >= pageCount}
              onClick={() => setPage(safePage + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}

function EmptyRow({ message, destructive = false }: { message: string; destructive?: boolean }) {
  return (
    <tr>
      <td
        colSpan={11}
        className={cn(
          "h-52 px-6 text-center text-muted-foreground",
          destructive && "text-destructive",
        )}
      >
        <Smartphone className="mx-auto mb-3 h-8 w-8 opacity-40" />
        {message}
      </td>
    </tr>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 font-medium",
        active
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function formatVersion(item: DeviceRow) {
  if (item.build_version && item.db_version && item.build_version !== item.db_version)
    return `${item.build_version}/${item.db_version}`;
  return item.build_version || item.db_version || "Não informada";
}

function formatDate(value: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20";
