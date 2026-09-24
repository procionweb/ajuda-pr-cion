import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Activity, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TicketsAnalyticsSection } from "@/components/analytics/TicketsAnalytics";
import { usePortalAuth } from "@/lib/portal-auth";
import "@/components/analytics/analytics-immersive.css";

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
  )
    return null;
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
  const { session, operator } = usePortalAuth();
  const metadata = session?.user.user_metadata;
  const fullName = String(metadata?.full_name || metadata?.name || operator || "").trim();
  const firstName = fullName.split(/\s+/)[0] || "time";
  const { view, from = "", to = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/analytics" });
  const activeTab = view === "kanban" ? "kanban" : "chamados";
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const updateScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const offset = Math.max(-70, Math.min(70, page.getBoundingClientRect().top * -0.08));
        page.style.setProperty("--analytics-scroll", `${offset}px`);
      });
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateScroll);
    };
  }, []);

  const moveBackdrop = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType === "touch" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--analytics-pointer-x", `${x * 16}px`);
    event.currentTarget.style.setProperty("--analytics-pointer-y", `${y * 10}px`);
  };

  return (
    <AppShell fullWidth>
      <div
        ref={pageRef}
        className="analytics-cockpit"
        onPointerMove={moveBackdrop}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--analytics-pointer-x", "0px");
          event.currentTarget.style.setProperty("--analytics-pointer-y", "0px");
        }}
      >
        <div className="analytics-scene" aria-hidden="true" />

        <div className="analytics-cockpit__content">
          <div className="analytics-heading">
            <div>
              <Breadcrumbs items={[{ label: "Analytics" }]} />
              <div className="flex items-center gap-3">
                <span className="analytics-heading__icon" aria-hidden="true">
                  <Activity className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Olá, {firstName}!
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                    Indicadores consolidados de atendimento e produtividade do time.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              navigate({ search: { view: v === "kanban" ? "kanban" : "chamados", from, to } })
            }
            className="w-full"
          >
            <div className="analytics-toolbar">
              <TabsList className="analytics-tabs">
                <TabsTrigger value="chamados" className="cursor-pointer">
                  Chamados
                </TabsTrigger>
                <TabsTrigger value="kanban" className="cursor-pointer">
                  Kanban
                </TabsTrigger>
              </TabsList>
              {activeTab === "chamados" && (
                <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:flex-nowrap">
                  {!from && !to && (
                    <span className="self-end pb-2 text-xs text-muted-foreground">Mês atual</span>
                  )}
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
              <TicketsAnalyticsSection from={from} to={to} />
            </TabsContent>

            <TabsContent value="kanban" className="mt-0">
              <KanbanAnalyticsEmpty />
            </TabsContent>
          </Tabs>
        </div>
      </div>
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
