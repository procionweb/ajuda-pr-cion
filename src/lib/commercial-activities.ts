import { supabase } from "./supabase";
export const activityTypes = [
  { value: "1", label: "Ligação" },
  { value: "2", label: "E-mail" },
  { value: "3", label: "Visita" },
  { value: "5", label: "Reunião Prócion" },
  { value: "6", label: "Reunião remota" },
  { value: "10", label: "Solicitação / sugestão" },
];
export type ContactActivity = {
  id: string;
  lead_id: string;
  type: string;
  description: string;
  occurred_at: string;
  return_at: string | null;
  status: string;
  priority: string;
  actor: string;
};
export function activityStatus(activity: ContactActivity) {
  return activity.status === "pendente"
    ? activity.return_at && new Date(activity.return_at).getTime() < Date.now()
      ? "Atrasado"
      : "Agendado"
    : activity.status === "cancelado"
      ? "Cancelado"
      : "Concluído";
}
export async function contactActivities(leadId: string): Promise<ContactActivity[]> {
  const { data, error } = await supabase.rpc(
    "company_lead_activities_get" as never,
    { p_lead: leadId } as never,
  );
  if (error) throw error;
  return (data || []) as ContactActivity[];
}
export async function finishActivity(id: string, status = "concluido") {
  const { error } = await supabase.rpc(
    "company_lead_activity_finish" as never,
    { p_id: id, p_status: status } as never,
  );
  if (error) throw error;
}
