/**
 * REGRA CRÍTICA — NÃO ALTERAR CONFIGURAÇÕES DE AMBIENTE
 *
 * Ao realizar qualquer alteração neste projeto, altere SOMENTE os arquivos necessários para atender à solicitação atual.
 *
 * É TERMINANTEMENTE PROIBIDO modificar, recriar, substituir, regenerar ou atualizar automaticamente:
 * .env
 * .env.local
 * .env.production
 * .env.development
 * variáveis VITE_*
 * VITE_SUPABASE_URL
 * VITE_SUPABASE_PUBLISHABLE_KEY
 * VITE_SUPABASE_PROJECT_ID
 * URLs de APIs existentes
 * chaves públicas existentes
 * configurações do Supabase
 * credenciais
 * endpoints
 * configurações de autenticação
 * arquivos de configuração que não estejam diretamente relacionados à alteração solicitada
 *
 * As credenciais e configurações existentes são consideradas CORRETAS e FUNCIONAIS.
 *
 * NUNCA tente "corrigir", "atualizar", "sincronizar" ou substituir essas configurações por valores detectados automaticamente pelo Lovable.
 *
 * Antes de realizar qualquer alteração:
 * 1. Identifique exatamente quais arquivos precisam ser modificados.
 * 2. Modifique somente esses arquivos.
 * 3. Preserve integralmente todos os demais arquivos.
 * 4. Não realize alterações auxiliares, refatorações ou melhorias que não tenham sido solicitadas.
 * 5. Não altere configurações de ambiente como efeito colateral.
 *
 * Após concluir a alteração:
 * 1. Verifique o diff.
 * 2. Confirme que nenhum .env foi alterado.
 * 3. Confirme que nenhuma variável VITE_* foi alterada.
 * 4. Confirme que nenhuma credencial ou configuração do Supabase foi modificada.
 * 5. Caso alguma dessas alterações apareça no diff, REVERTA antes de finalizar.
 *
 * PRINCÍPIO DO PROJETO:
 * "Alterar somente o que foi explicitamente solicitado. Todo o restante deve permanecer exatamente como estava."
 */
import { useMemo, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, GitBranch, KanbanSquare, Sparkles, Clock, Tag } from "lucide-react";
import { SefazStatusPanel } from "@/components/portal/SefazStatusPanel";
import { BrazilNewsCard } from "@/components/portal/BrazilNewsCard";
import { TicketsIndicatorCards } from "@/components/analytics/TicketsAnalytics";
import { availableMonthKeys, currentMonthKey, monthLabel } from "@/lib/tickets-month";
import { AppShell } from "@/components/portal/AppShell";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { kbArticlesFull, kbCategoriesFull } from "@/lib/kb-data";
import { useTickets } from "@/lib/tickets-store";
import { useCrmCatalog } from "@/lib/crm-catalog-api";
import { formatVersionDate, type ErpVersion } from "@/lib/erp-versions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal Prócion — Central de Ajuda" },
      {
        name: "description",
        content:
          "Portal Prócion: central de ajuda com base de conhecimento, atualizações, versões e Kanban.",
      },
      { property: "og:title", content: "Portal Prócion — Central de Ajuda" },
      {
        property: "og:description",
        content: "Encontre artigos, versões e novidades da Prócion Sistemas em um só lugar.",
      },
    ],
  }),
  component: HomePage,
});

const shortcuts = [
  {
    to: "/base-de-conhecimento",
    label: "Base de Conhecimento",
    description: "Guias, manuais e correções.",
    icon: BookOpen,
    tone: "bg-primary/10 text-primary",
  },
  {
    to: "/atualizacoes",
    label: "Atualizações",
    description: "Novidades e melhorias recentes.",
    icon: Sparkles,
    tone: "bg-[#fff4d8] text-[#c47a13]",
  },
  {
    to: "/versoes",
    label: "Versões",
    description: "Histórico e release notes.",
    icon: GitBranch,
    tone: "bg-[#eafaf1] text-[#23a061]",
  },
  {
    to: "/kanban",
    label: "Kanban Prócion",
    description: "Suas demandas em andamento.",
    icon: KanbanSquare,
    tone: "bg-primary/10 text-[#4d5bd8]",
  },
] as const;

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `${diff} dias atrás`;
  if (diff < 30) return `${Math.floor(diff / 7)} sem atrás`;
  // Formatação determinística em UTC para evitar divergência SSR/cliente
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

function HomePage() {
  const supportTickets = useTickets();
  const { items: savedVersions } = useCrmCatalog<ErpVersion>("versions");
  const latestArticles = [...kbArticlesFull]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const latestVersions = [...savedVersions]
    .sort((a, b) => b.data_versao.localeCompare(a.data_versao))
    .slice(0, 4);
  const categoriesMap = Object.fromEntries(kbCategoriesFull.map((c) => [c.id, c]));

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const monthOptions = useMemo(() => availableMonthKeys(supportTickets), [supportTickets]);

  return (
    <AppShell>
      <section className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Indicadores de <span className="capitalize">{monthLabel(selectedMonth)}</span>
          </h2>
          <select
            aria-label="Selecionar mês"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm capitalize outline-none focus:ring-2 focus:ring-ring"
          >
            {monthOptions.map((key) => (
              <option key={key} value={key} className="capitalize">
                {monthLabel(key)}
              </option>
            ))}
          </select>
        </div>
        <TicketsIndicatorCards month={selectedMonth} />
      </section>

      <section className="mb-6 grid grid-cols-1 items-stretch gap-6 lg:h-[400px] lg:grid-cols-[minmax(0,68fr)_minmax(0,32fr)]">
        <SefazStatusPanel />
        <BrazilNewsCard />
      </section>

      {/* Atalhos */}
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-medium text-foreground">Atalhos</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((s) => (
            <Link key={s.to} to={s.to} className="group">
              <Card className="h-full rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-5 shadow-[0_10px_26px_rgba(25,29,51,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(25,29,51,0.10)]">
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-bold text-foreground">{s.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                  Abrir <ArrowRight className="h-3 w-3" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Últimos artigos + Versões */}
      <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)]">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h3 className="text-base font-medium text-foreground">Últimos artigos</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Atualizações recentes na base de conhecimento.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
              <Link to="/base-de-conhecimento">
                Ver todos <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-[#f1f3f8]">
            {latestArticles.map((a) => {
              const cat = categoriesMap[a.category];
              return (
                <li key={a.slug}>
                  <Link
                    to="/base-de-conhecimento/$slug"
                    params={{ slug: a.slug }}
                    className="flex items-start gap-4 py-4 transition hover:bg-muted/40/60"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {cat && (
                          <span className="inline-flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {cat.name}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelative(a.updatedAt)}
                        </span>
                        {a.module && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            {a.module}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-[#c5cadb]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-[14px] border-0 bg-white dark:bg-[#20263d] p-6 shadow-[0_10px_26px_rgba(25,29,51,0.06)]">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-medium text-foreground">Últimas versões</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Release notes recentes.</p>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-primary hover:text-primary"
            >
              <Link to="/versoes">
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <ol className="relative space-y-5 border-l border-border pl-5">
            {latestVersions.map((v) => (
              <li key={v.id} className="relative min-w-0">
                <span className="absolute -left-[26px] top-1 grid h-4 w-4 place-items-center rounded-full bg-white dark:bg-[#20263d] ring-2 ring-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-sm font-bold text-foreground">{v.versao}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatVersionDate(v.data_versao)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {[
                    `Runtime: ${formatVersionDate(v.data_runtime)}`,
                    `Arquivos: ${formatVersionDate(v.data_arq)}`,
                  ].map((h) => (
                    <li key={h} className="flex min-w-0 gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#c5cadb]" />
                      <span className="min-w-0 break-words">{h}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </AppShell>
  );
}
