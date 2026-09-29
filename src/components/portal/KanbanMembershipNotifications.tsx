import { useEffect } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { usePortalAuth } from "@/lib/portal-auth";
import { addNotification } from "@/lib/notifications-store";
import { supabase } from "@/lib/supabase";
import { showBrowserNotification } from "@/lib/browser-notification";

const DESKTOP_SEEN_KEY = "procion.kanban.desktop-seen.v1";

export function KanbanMembershipNotifications() {
  const { session } = usePortalAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let desktopSeen: Set<string>;
    try {
      desktopSeen = new Set(JSON.parse(localStorage.getItem(DESKTOP_SEEN_KEY) || "[]"));
    } catch {
      desktopSeen = new Set();
    }
    const check = async () => {
      // The generated Supabase types do not include this existing table.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("id, title, body, link, created_at")
        .eq("profile_id", userId)
        .in("title", [
          "Você foi adicionado a uma área",
          "Você foi removido de uma área",
          "Você foi adicionado a um quadro",
          "Você foi removido de um quadro",
          "Você foi adicionado a um cartão",
        ])
        .order("created_at", { ascending: false })
        .limit(30);
      if (error || !active) return;
      for (const row of [...(data ?? [])].reverse() as Array<{
        id: string;
        title: string;
        body: string | null;
        link: string | null;
        created_at: string;
      }>) {
        const fresh = addNotification({
          id: `kanban-member:${row.id}`,
          title: row.title,
          description: row.body ?? "",
          time: "agora",
          icon: Users,
          tone: "info",
          href: row.link ?? "/kanban",
        });
        if (fresh)
          toast(row.title, {
            description: row.body ?? "",
            duration: 10000,
            position: "bottom-right",
          });
        if (
          !desktopSeen.has(row.id) &&
          Date.now() - Date.parse(row.created_at) < 24 * 60 * 60 * 1000
        ) {
          const shown = await showBrowserNotification(
            row.title,
            row.body ?? "",
            `kanban-member:${row.id}`,
            row.link ?? "/kanban",
          );
          if (shown) {
            desktopSeen.add(row.id);
            localStorage.setItem(DESKTOP_SEEN_KEY, JSON.stringify([...desktopSeen].slice(-100)));
          }
        }
      }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    const channel = supabase
      .channel(`kanban-membership-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${userId}`,
        },
        () => void check(),
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
