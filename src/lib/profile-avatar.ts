import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";

export function useProfileAvatar() {
  const { session } = usePortalAuth();
  const userId = session?.user.id;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const { data } = await (supabase as any).from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      if (active) setAvatarUrl(data?.avatar_url ?? null);
    };
    void load();
    window.addEventListener("procion:avatar-updated", load);
    return () => { active = false; window.removeEventListener("procion:avatar-updated", load); };
  }, [userId]);
  return avatarUrl;
}
