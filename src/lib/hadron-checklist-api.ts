import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getHadronOptionChecklist } from "@/lib/hadron-checklist";

const db = supabase as SupabaseClient;
export async function loadOptionChecklist(optionId: string) {
  const { data, error } = await db
    .from("hadron_option_check_values")
    .select("check_id,check1,check2")
    .eq("option_id", optionId);
  if (error) throw error;
  const values = new Map(data.map((row) => [row.check_id, row]));
  return getHadronOptionChecklist(optionId).map((item) => ({
    ...item,
    check1: values.get(item.checkId)?.check1 ?? item.check1,
    check2: values.get(item.checkId)?.check2 ?? item.check2,
  }));
}
export async function processOptionChecklist(
  optionId: string,
  column: 1 | 2,
  items: ReturnType<typeof getHadronOptionChecklist>,
) {
  const { error } = await db.rpc("process_hadron_checklist", {
    p_option_id: optionId,
    p_column: column,
    p_values: items.map((item) => ({
      check_id: item.checkId,
      checked: column === 1 ? item.check1 : item.check2,
    })),
  });
  if (error) throw error;
}
