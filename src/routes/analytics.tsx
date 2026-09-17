import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TicketsAnalyticsSection } from "@/components/analytics/TicketsAnalytics";

const searchSchema = z.object({
  view: z.string().catch("chamados").default("chamados"),
  from: z.string().catch("").optional(),
  to: z.string().catch("").optional(),
});

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CRM Prócion" },
      {
        name: "description",
        content:
          "Indicadores de chamados e Kanban da Prócion consolidados em uma central de analytics.",
      },
    ],
  }),
  validateSearch: searchSchema,
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { view, from = "", to = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/analytics" });
  const activeTab = view === "kanban" ? "kanban" : "chamados";

  return (
    <AppShell>
      <div className="mb-5">
        <Breadcrumbs items={[{ label: "Analytics" }]} />
        <h1 className="text-lg font-medium tracking-tight text-foreground">Analytics</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Indicadores consolidados de atendimento e produtividade do time.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          navigate({ search: { view: v === "kanban" ? "kanban" : "chamados", from, to } })
        }
        className="w-full"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="chamados" className="cursor-pointer">
              Chamados
            </TabsTrigger>
            <TabsTrigger value="kanban" className="cursor-pointer">
              Kanban
            </TabsTrigger>
          </TabsList>
          {activeTab === "chamados" && (
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:flex-nowrap">
              <label className="min-w-[145px] flex-1 sm:flex-none">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Data inicial
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) =>
                    navigate({ search: { view: activeTab, from: event.target.value, to } })
                  }
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="min-w-[145px] flex-1 sm:flex-none">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Data final
                </span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) =>
                    navigate({ search: { view: activeTab, from, to: event.target.value } })
                  }
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              {(from || to) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 cursor-pointer px-3"
                  onClick={() => navigate({ search: { view: activeTab, from: "", to: "" } })}
                >
                  Limpar
                </Button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="chamados" className="mt-0">
          <TicketsAnalyticsSection from={from} to={to} />
        </TabsContent>

        <TabsContent value="kanban" className="mt-0">
          <KanbanAnalyticsEmpty />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function KanbanAnalyticsEmpty() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[14px] border border-dashed border-border/70 bg-white p-10 text-center dark:bg-[#20263d]">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <BarChart3 className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">
        Os indicadores do Kanban serão exibidos aqui
      </p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        Assim que os dados analíticos do Kanban estiverem disponíveis, eles aparecerão nesta aba.
      </p>
    </div>
  );
}
