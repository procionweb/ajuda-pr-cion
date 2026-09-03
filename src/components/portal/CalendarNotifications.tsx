import { useEffect } from "react";
import { CalendarClock, Car } from "lucide-react";
import { toast } from "sonner";
import { listCrmCalendarEvents } from "@/lib/calendar-api";
import { currentUser } from "@/lib/mock-data";
import { addNotification } from "@/lib/notifications-store";
import { useLocalEvents } from "@/lib/local-events-store";
import { supabase } from "@/lib/supabase";

const REMINDER_WINDOW_MS = 30 * 60 * 1000;

function includesOperator(values: Array<string | undefined>, operator: string) {
  const normalized = operator.trim().toLocaleUpperCase("pt-BR");
  return values.some((value) =>
    String(value || "")
      .split(/[,;]+/)
      .some((part) => part.trim().toLocaleUpperCase("pt-BR").startsWith(normalized)),
  );
}

export function CalendarNotifications() {
  useLocalEvents(); // Mantém eventos e reservas da Frota sincronizados em todo o portal.
  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const events = await listCrmCalendarEvents();
        if (!active) return;
        const now = Date.now();
        events.forEach((event) => {
          if (event.status === "Cancelado" || event.status === "Concluído") return;
          if (!includesOperator([event.responsible, event.operator, ...(event.guests || [])], currentUser.operator)) return;
          const startsAt = new Date(`${event.date}T${event.time}:00`).getTime();
          const remaining = startsAt - now;
          if (remaining < 0 || remaining > REMINDER_WINDOW_MS) return;

          const hasVehicle = event.type === "Visita presencial" && Boolean(event.vehicleId);
          const minutes = Math.max(1, Math.ceil(remaining / 60000));
          const title = hasVehicle ? "Retire o veículo da visita" : "Agendamento próximo";
          const description = `${event.time} · ${event.title}${hasVehicle ? " · veículo reservado" : ""}`;
          const added = addNotification({
            id: `calendar:${event.id}:${event.date}:${event.time}`,
            title,
            description,
            time: `em ${minutes} min`,
            icon: hasVehicle ? Car : CalendarClock,
            tone: hasVehicle ? "warning" : "info",
            href: `/calendario?evento=${encodeURIComponent(String(event.id))}`,
          });
          if (added) {
            toast(title, {
              description,
              duration: 10000,
              position: "bottom-right",
            });
            if ("Notification" in window && Notification.permission === "granted") {
              const desktopNotification = new Notification(title, {
                body: description,
                tag: `calendar:${event.id}`,
              });
              desktopNotification.onclick = () => {
                window.focus();
                window.location.assign(`/calendario?evento=${encodeURIComponent(String(event.id))}`);
              };
            }
          }
        });
      } catch {
        // A central volta a tentar no próximo ciclo sem interromper a navegação.
      }
    };

    void check();
    const interval = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase
      .channel("calendar-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => void check(),
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
