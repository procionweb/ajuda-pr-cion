import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { HadronModule, HadronSubmodule } from "@/lib/hadron-modules";

const db = supabase as SupabaseClient;
export async function loadHadronModules(): Promise<HadronModule[]> {
  const [modules, subs] = await Promise.all([
    db.from("hadron_modules").select("id,nome").is("deleted_at", null),
    db.from("hadron_submodules").select("id,id_modulo,nome"),
  ]);
  if (modules.error) throw modules.error;
  if (subs.error) throw subs.error;
  return modules.data
    .map((module) => ({
      ...module,
      submodules: subs.data
        .filter((sub) => sub.id_modulo === module.id)
        .sort((a, b) => Number(a.id) - Number(b.id)),
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}
export async function saveHadronModule(id: string, nome: string) {
  const result = await db
    .from("hadron_modules")
    .update({ nome })
    .eq("id", id)
    .select("id")
    .single();
  if (result.error) throw result.error;
}

export async function removeHadronModule(id: string) {
  const result = await db.from("hadron_modules").update({deleted_at:new Date().toISOString()}).eq("id",id).select("id").single();
  if (result.error) throw result.error;
}
export async function saveHadronSubmodule(sub: HadronSubmodule, editing: boolean) {
  const result = editing
    ? await db
        .from("hadron_submodules")
        .update({ nome: sub.nome })
        .eq("id_modulo", sub.id_modulo)
        .eq("id", sub.id)
        .select("id")
        .single()
    : await db.from("hadron_submodules").insert(sub).select("id").single();
  if (result.error) throw result.error;
}
