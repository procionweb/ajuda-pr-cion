import { supabase } from "@/lib/supabase";

export type HadronOptionLock = {
  optionId: string;
  userId: string;
  operator: string;
  lockedAt: string;
};

export async function listHadronOptionLocks() {
  const { data, error } = await supabase
    .from("hadron_option_locks")
    .select("option_id,user_id,operator,locked_at");
  if (error) throw error;
  return Object.fromEntries(
    (data || []).map((row) => [
      String(row.option_id),
      {
        optionId: String(row.option_id),
        userId: String(row.user_id),
        operator: String(row.operator || "Não informado"),
        lockedAt: String(row.locked_at),
      } satisfies HadronOptionLock,
    ]),
  ) as Record<string, HadronOptionLock>;
}

export async function acquireHadronOptionLock(optionId: string, operator: string) {
  const { data, error } = await supabase.rpc("acquire_hadron_option_lock", {
    target_option_id: optionId,
    target_operator: operator,
  });
  if (error) throw error;
  const result = data?.[0] as { acquired?: boolean; locked_by?: string } | undefined;
  return {
    acquired: Boolean(result?.acquired),
    lockedBy: String(result?.locked_by || operator),
  };
}

export async function releaseHadronOptionLock(optionId: string) {
  const { error } = await supabase.rpc("release_hadron_option_lock", {
    target_option_id: optionId,
  });
  if (error) throw error;
}
