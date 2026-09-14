import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getHadronOptionChecklist } from "@/lib/hadron-checklist";
import { getCrmCatalogRecord, listCrmCatalog } from "@/lib/crm-catalog-api";

const db = supabase as SupabaseClient;
export async function loadOptionChecklist(optionId: string) {
  const { data, error } = await db
    .from("hadron_option_check_values")
    .select("check_id,check1,check2")
    .eq("option_id", optionId);
  if (error) throw error;
  const values = new Map(data.map((row) => [row.check_id, row]));
  const savedOption = await getCrmCatalogRecord<{ checklist?: ReturnType<typeof getHadronOptionChecklist> }>("options", optionId);
  const definitions = new Map((await listCrmCatalog<[string,string,string,string,boolean,string,string]>("checklist")).map((item) => [item[0], item]));
  const baseChecks =
    savedOption?.checklist ||
    getHadronOptionChecklist(optionId);
  return (baseChecks as ReturnType<typeof getHadronOptionChecklist>).filter((item) => definitions.has(item.checkId)).map((item) => ({
    ...item,
    title: definitions.get(item.checkId)![2],
    description: definitions.get(item.checkId)![3],
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
