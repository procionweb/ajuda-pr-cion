import { useEffect } from "react";
import { CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import { usePortalAuth } from "@/lib/portal-auth";
import { addNotification } from "@/lib/notifications-store";
import { supabase } from "@/lib/supabase";
import { showBrowserNotification } from "@/lib/browser-notification";

const DESKTOP_SEEN_KEY = "procion.kanban.desktop-seen.v1";
const ALERT_SEEN_KEY = "procion.kanban.alert-seen.v1";

export function KanbanMembershipNotifications() {
  const { session } = usePortalAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const startedAt = Date.now() - 30_000;
    const alertKey = `${ALERT_SEEN_KEY}:${userId}`;
    let alertSeen: Set<string>;
    try {
      alertSeen = new Set(JSON.parse(localStorage.getItem(alertKey) || "[]"));
    } catch {
      alertSeen = new Set();
    }
    let desktopSeen: Set<string>;
    try {
      desktopSeen = new Set(JSON.parse(localStorage.getItem(`${DESKTOP_SEEN_KEY}:${userId}`) || "[]"));
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
          "Você foi removido de um cartão",
          "Você foi adicionado a um agendamento",
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
        addNotification({
          id: `kanban-member:${row.id}`,
          title: row.title,
          description: row.body ?? "",
          time: "agora",
          icon: row.title.includes("agendamento") ? CalendarDays : Users,
          tone: "info",
          href: row.link ?? "/kanban",
        });
        const createdAt = Date.parse(row.created_at);
        const wasSeen = alertSeen.has(row.id);
        const visible = document.visibilityState === "visible";
        if (!wasSeen && (visible || createdAt < startedAt)) {
          alertSeen.add(row.id);
          localStorage.setItem(alertKey, JSON.stringify([...alertSeen].slice(-200)));
        }
        if (visible && createdAt >= startedAt && !wasSeen) {
          toast(row.title, {
            description: "Notification" in window && Notification.permission === "denied"
              ? `${row.body ?? ""} · Avisos do navegador bloqueados nas permissões do site.`
              : row.body ?? "",
            duration: 10000,
            position: "bottom-right",
            action: "Notification" in window && Notification.permission === "default"
              ? { label: "Ativar no navegador", onClick: () => { void Notification.requestPermission().then(() => check()); } }
              : undefined,
          });
        }
        if (
          !desktopSeen.has(row.id) &&
          createdAt >= startedAt
        ) {
          const shown = await showBrowserNotification(
            row.title,
            row.body ?? "",
            `kanban-member:${row.id}`,
            row.link ?? "/kanban",
          );
          if (shown) {
            desktopSeen.add(row.id);
            localStorage.setItem(`${DESKTOP_SEEN_KEY}:${userId}`, JSON.stringify([...desktopSeen].slice(-200)));
          }
        }
      }
    };
    void check();
    window.addEventListener("procion:kanban-card-saved", check);
    window.addEventListener("focus", check);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(check, 10_000);
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
      window.removeEventListener("procion:kanban-card-saved", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
