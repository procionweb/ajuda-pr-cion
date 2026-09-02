import { useEffect } from "react";
import { CalendarClock, Car } from "lucide-react";
import { toast } from "sonner";
import { listCrmCalendarEvents } from "@/lib/calendar-api";
import { currentUser } from "@/lib/mock-data";
import { addNotification } from "@/lib/notifications-store";

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
          });
          if (added) {
            toast(title, {
              description,
              duration: 10000,
              position: "bottom-right",
            });
          }
        });
      } catch {
        // A central volta a tentar no próximo ciclo sem interromper a navegação.
      }
    };

    void check();
    const interval = window.setInterval(check, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
