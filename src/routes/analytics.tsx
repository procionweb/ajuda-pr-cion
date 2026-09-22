import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SupportAnalyticsDashboard } from "@/components/analytics/SupportAnalyticsDashboard";

const searchSchema = z.object({
  view: z.string().catch("chamados").default("chamados"),
  from: z.string().catch("").optional(),
  to: z.string().catch("").optional(),
});

function formatDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return null;
  return `${year}-${month}-${day}`;
}

function TypedDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => formatDateInput(value));
  useEffect(() => setDraft(formatDateInput(value)), [value]);

  return (
    <label className="min-w-[145px] flex-1 sm:flex-none">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
          const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
            .filter(Boolean)
            .join("/");
          setDraft(masked);
          if (!digits) onChange("");
          const parsed = parseDateInput(masked);
          if (parsed) onChange(parsed);
        }}
        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

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
  const today = new Date();
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const setPreset = (preset: string) => {
    const start = new Date(today);
    const end = new Date(today);
    if (preset === "7 dias") start.setDate(start.getDate() - 6);
    if (preset === "30 dias") start.setDate(start.getDate() - 29);
    if (preset === "90 dias") start.setDate(start.getDate() - 89);
    if (preset === "12 meses") start.setMonth(start.getMonth() - 12);
    if (preset === "Este mês") start.setDate(1);
    if (preset === "Mês anterior") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    }
    navigate({ search: { view: activeTab, from: dateKey(start), to: dateKey(end) } });
  };

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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              <label className="text-xs text-muted-foreground">Período<select aria-label="Período" value="" onChange={(event) => setPreset(event.target.value)} className="mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"><option value="">Selecionar</option>{["Hoje", "7 dias", "30 dias", "90 dias", "12 meses", "Este mês", "Mês anterior"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <TypedDateInput
                label="Data inicial"
                value={from}
                onChange={(nextFrom) =>
                  navigate({ search: { view: activeTab, from: nextFrom, to } })
                }
              />
              <TypedDateInput
                label="Data final"
                value={to}
                onChange={(nextTo) =>
                  navigate({ search: { view: activeTab, from, to: nextTo } })
                }
              />
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
          <SupportAnalyticsDashboard
            from={from}
            to={to}
          />
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
