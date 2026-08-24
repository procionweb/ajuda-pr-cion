import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Globe2,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes/aplicativos")({
  head: () => ({ meta: [{ title: "Aplicativos - Configurações - Portal Prócion" }] }),
  component: ApplicationsSettingsPage,
});

type ApplicationRow = {
  id: string;
  legacy_id: string;
  name: string | null;
  app_type: string | null;
  build_version: string | null;
  db_version: string | null;
  image_name: string | null;
  status: string | null;
  active: boolean;
  crm_created_at: string | null;
  crm_updated_at: string | null;
};

const PAGE_SIZE = 10;

const appPresentation: Record<
  string,
  { icon: typeof AppWindow; iconClass: string; backgroundClass: string }
> = {
  MOB: {
    icon: Smartphone,
    iconClass: "text-sky-700 dark:text-sky-300",
    backgroundClass: "bg-sky-100 dark:bg-sky-950/60",
  },
  WEB: {
    icon: Globe2,
    iconClass: "text-indigo-700 dark:text-indigo-300",
    backgroundClass: "bg-indigo-100 dark:bg-indigo-950/60",
  },
  B2C: {
    icon: ShoppingBag,
    iconClass: "text-emerald-700 dark:text-emerald-300",
    backgroundClass: "bg-emerald-100 dark:bg-emerald-950/60",
  },
  B2B: {
    icon: UsersRound,
    iconClass: "text-amber-700 dark:text-amber-300",
    backgroundClass: "bg-amber-100 dark:bg-amber-950/60",
  },
};

function ApplicationsSettingsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  async function loadApplications() {
    setLoading(true);
    setError(null);
    // Imported CRM tables are not represented in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: requestError } = await (supabase as any).rpc(
      "configuration_applications_list",
    );
    if (requestError) {
      setError(requestError.message);
      setApplications([]);
    } else {
      setApplications((Array.isArray(data) ? data : []) as ApplicationRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return applications;
    return applications.filter((application) =>
      [application.name, application.app_type, application.build_version, application.db_version]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [applications, query]);

  useEffect(() => setPage(0), [query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <AppShell>
      <PageHeader
        title="Aplicativos"
        description="Versões dos aplicativos integrados ao Hádron."
        breadcrumbs={[{ label: "Configurações" }, { label: "Aplicativos" }]}
      />

      <section className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por aplicativo, tipo ou versão"
            className="h-10 pl-9"
          />
        </label>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => void loadApplications()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/35 px-5 py-3 text-xs font-medium uppercase text-muted-foreground">
          Aplicativos ({filtered.length})
        </div>
        {loading ? (
          <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
            Carregando aplicativos...
          </div>
        ) : error ? (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-destructive">
            Não foi possível carregar os aplicativos: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
            Nenhum aplicativo encontrado.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((application) => {
              const presentation = appPresentation[application.app_type ?? ""] ?? {
                icon: AppWindow,
                iconClass: "text-muted-foreground",
                backgroundClass: "bg-muted",
              };
              const Icon = presentation.icon;
              return (
                <li
                  key={application.id}
                  className="flex min-h-28 items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/20 sm:gap-5 sm:px-6"
                >
                  <div
                    className={cn(
                      "grid h-16 w-16 shrink-0 place-items-center rounded-lg",
                      presentation.backgroundClass,
                    )}
                    title={application.image_name ?? undefined}
                  >
                    <Icon className={cn("h-8 w-8", presentation.iconClass)} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground sm:text-lg">
                        {application.name || "Aplicativo sem nome"}
                      </h2>
                      {application.app_type && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {application.app_type}
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-8">
                      <div className="flex gap-1.5">
                        <dt>Build:</dt>
                        <dd className="font-medium text-foreground">
                          {application.build_version || "Não informado"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Versão BD:</dt>
                        <dd className="font-medium text-foreground">
                          {application.db_version || "Não informada"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "aplicativo" : "aplicativos"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center text-muted-foreground">
              Página {safePage + 1} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
