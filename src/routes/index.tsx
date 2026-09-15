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

import { createFileRoute } from "@tanstack/react-router";
import { SefazStatusPanel } from "@/components/portal/SefazStatusPanel";
import { BrazilNewsCard } from "@/components/portal/BrazilNewsCard";
import { TicketsIndicatorCards } from "@/components/analytics/TicketsAnalytics";
import { availableMonthKeys, currentMonthKey, monthLabel } from "@/lib/tickets-month";
import { AppShell } from "@/components/portal/AppShell";

import { useTickets } from "@/lib/tickets-store";

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

function HomePage() {
  const supportTickets = useTickets();

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
    </AppShell>
  );
}
