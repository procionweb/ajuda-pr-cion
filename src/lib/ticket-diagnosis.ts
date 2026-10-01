import { supabase } from "./supabase";

export type DiagnosisConfidence = "baixa" | "media" | "alta";

export type TicketDiagnosisSource = {
  id: string;
  kind: "knowledge" | "ticket";
  title: string;
  detail: string;
  url?: string | null;
};

export type TicketDiagnosis = {
  diagnosisId: string;
  assessment: string;
  probableCauses: string[];
  missingQuestions: string[];
  suggestedSteps: string[];
  sourceRefs: string[];
  confidence: DiagnosisConfidence;
  confidenceReason: string;
  shouldEscalate: boolean;
  escalationReason: string;
  warning: string;
  answerBasis: "base_interna" | "conhecimento_geral" | "mista";
  sources: TicketDiagnosisSource[];
};

export type TicketDiagnosisFeedback = "resolved" | "not_resolved";

export type TicketDiagnosisInput = {
  ticketId: string;
  protocol: string;
  subject: string;
  description: string;
  module: string;
  clientName: string;
  status: string;
};

export async function analyzeTicket(input: TicketDiagnosisInput): Promise<TicketDiagnosis> {
  const { data, error } = await supabase.functions.invoke("ticket-diagnosis", {
    body: input,
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || !("diagnosis" in data)) {
    throw new Error("A análise não retornou um resultado válido.");
  }

  return (data as { diagnosis: TicketDiagnosis }).diagnosis;
}

export async function submitTicketDiagnosisFeedback(
  diagnosisId: string,
  feedback: TicketDiagnosisFeedback,
) {
  const { data, error } = await supabase.functions.invoke("ticket-diagnosis", {
    body: { action: "feedback", diagnosisId, feedback },
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || !("ok" in data)) {
    throw new Error("O feedback não foi confirmado.");
  }
}
