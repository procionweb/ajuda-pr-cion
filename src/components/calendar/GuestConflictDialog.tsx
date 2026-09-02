import { CalendarClock, UsersRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CalendarEvent } from "@/lib/calendar-events";

export type GuestConflict = {
  event: CalendarEvent;
  guests: string[];
};

type GuestIdentity = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  acronym?: string | null;
};

function normalize(value?: string | null) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function guestKeys(guest: GuestIdentity | string) {
  if (typeof guest === "string") return [normalize(guest)].filter(Boolean);
  return [guest.id, guest.acronym, guest.email, guest.name].map(normalize).filter(Boolean);
}

export function findGuestConflicts({
  events,
  guests,
  date,
  startTime,
  endTime,
  ignoreEventId,
}: {
  events: CalendarEvent[];
  guests: GuestIdentity[];
  date: string;
  startTime: string;
  endTime: string;
  ignoreEventId?: string | number;
}): GuestConflict[] {
  if (!guests.length) return [];

  return events.flatMap((event) => {
    if (
      event.date !== date ||
      event.status === "Cancelado" ||
      String(event.id) === String(ignoreEventId ?? "") ||
      startTime >= event.end ||
      endTime <= event.time
    ) {
      return [];
    }

    const eventGuestKeys = new Set(
      [...(event.guestList ?? []), ...(event.guests ?? [])].flatMap(guestKeys),
    );
    const matched = guests
      .filter((guest) => guestKeys(guest).some((key) => eventGuestKeys.has(key)))
      .map((guest) => guest.acronym || guest.name || guest.email || "Convidado");

    return matched.length ? [{ event, guests: matched }] : [];
  });
}

export function GuestConflictDialog({
  conflicts,
  onCancel,
  onContinue,
}: {
  conflicts: GuestConflict[];
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <AlertDialog open={conflicts.length > 0}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Convidado com conflito de horário</AlertDialogTitle>
          <AlertDialogDescription>
            Um ou mais convidados já participam de outro agendamento nesse período.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {conflicts.map(({ event, guests }) => (
            <div key={event.id} className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{event.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                {event.date.split("-").reverse().join("/")} · {event.time} às {event.end} · {event.type}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <UsersRound className="h-4 w-4" />
                {guests.join(", ")}
              </p>
              {event.client && <p className="mt-1 text-muted-foreground">{event.client}</p>}
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>Continuar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
