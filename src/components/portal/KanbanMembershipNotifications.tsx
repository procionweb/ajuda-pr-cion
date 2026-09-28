import { useEffect } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { usePortalAuth } from "@/lib/portal-auth";
import { addNotification } from "@/lib/notifications-store";
import { supabase } from "@/lib/supabase";

export function KanbanMembershipNotifications() {
  const { session } = usePortalAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const check = async () => {
      const { data, error } = await (supabase as any).from("notifications")
        .select("id, title, body, link, created_at")
        .eq("profile_id", userId)
        .ilike("title", "Você foi adicionado%")
        .order("created_at", { ascending: false }).limit(30);
      if (error || !active) return;
      for (const row of [...(data ?? [])].reverse() as Array<{ id: string; title: string; body: string | null; link: string | null }>) {
        const fresh = addNotification({ id: `kanban-member:${row.id}`, title: row.title,
          description: row.body ?? "", time: "agora", icon: Users, tone: "info",
          href: row.link ?? "/kanban" });
        if (!fresh) continue;
        toast(row.title, { description: row.body ?? "", duration: 10000, position: "bottom-right" });
        if ("Notification" in window && Notification.permission === "granted") {
          const notice = new Notification(row.title, { body: row.body ?? "", tag: `kanban-member:${row.id}` });
          notice.onclick = () => { window.focus(); window.location.assign(row.link ?? "/kanban"); };
        }
      }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    const channel = supabase.channel(`kanban-membership-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${userId}` }, () => void check())
      .subscribe();
    return () => { active = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [userId]);

  return null;
}
