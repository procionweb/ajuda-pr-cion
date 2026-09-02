import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type SummaryState = {
  status: "idle" | "loading" | "ready" | "error";
  summary: string | null;
};

export type TicketSummaryContext = {
  requester?: string | null;
  requesterPhone?: string | null;
  operator?: string | null;
  company?: string | null;
};

const cache = new Map<string, SummaryState>();
const inflight = new Map<string, Promise<SummaryState>>();

const IDLE: SummaryState = { status: "idle", summary: null };

function correctRequesterAttribution(
  summary: string | null,
  context?: TicketSummaryContext,
) {
  if (!summary) return summary;
  const requester = context?.requester?.trim();
  if (!requester) return summary;
  return summary.replace(
    /\bO operador\s+PRC[A-Z0-9]+\s+(?=(?:possui|tem|relata|relatou|solicita|solicitou|precisa|informa|informou|questiona|pede)\b)/gi,
    `O solicitante ${requester} `,
  );
}

async function fetchSummary(
  ticketId: string,
  context?: TicketSummaryContext,
): Promise<SummaryState> {
  const { data, error } = await supabase.functions.invoke("ticket-summary", {
    body: { ticketId, context, summaryVersion: 2 },
  });
  if (error) throw error;
  const rawSummary = (data as { summary?: string | null } | null)?.summary ?? null;
  const summary = correctRequesterAttribution(rawSummary, context);
  return { status: summary ? "ready" : "error", summary };
}

/**
 * Retorna o resumo (gerado por IA no backend) da descrição original do chamado.
 * O resultado é persistido no banco e reutilizado — a IA só roda quando não há
 * resumo ou quando a descrição original mudou.
 */
export function useTicketSummary(
  ticketId: string | null | undefined,
  description: string,
  knownSummary?: string | null,
  context?: TicketSummaryContext,
): SummaryState {
  const contextKey = JSON.stringify(context ?? {});
  const key = ticketId ? `${ticketId}:requester-v2:${contextKey}` : "";
  const [state, setState] = useState<SummaryState>(() => {
    if (knownSummary) {
      return {
        status: "ready",
        summary: correctRequesterAttribution(knownSummary, context),
      };
    }
    return cache.get(key) ?? IDLE;
  });

  useEffect(() => {
    if (!key || !description) {
      setState(IDLE);
      return;
    }
    if (knownSummary) {
      const readyState: SummaryState = {
        status: "ready",
        summary: correctRequesterAttribution(knownSummary, context),
      };
      cache.set(key, readyState);
      setState(readyState);
      return;
    }
    const cached = cache.get(key);
    if (cached && cached.status !== "loading") {
      setState(cached);
      return;
    }

    let active = true;
    setState({ status: "loading", summary: null });

    const promise =
      inflight.get(key) ??
      fetchSummary(ticketId!, context)
        .catch((error): SummaryState => {
          console.error(`[ticket-summary] Falha ao gerar resumo do chamado ${key}.`, error);
          return { status: "error", summary: null };
        })
        .then((result) => {
          cache.set(key, result);
          inflight.delete(key);
          return result;
        });

    inflight.set(key, promise);
    void promise.then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
    };
  }, [key, ticketId, description, knownSummary, contextKey]);

  return state;
}
