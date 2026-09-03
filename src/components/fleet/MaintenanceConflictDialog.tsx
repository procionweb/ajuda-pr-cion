import { AlertTriangle } from "lucide-react";
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
import type { VehicleReservation } from "@/lib/fleet-store";

function time(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MaintenanceConflictDialog({ reservation, onCancel, onVisit }: { reservation: VehicleReservation | null; onCancel: () => void; onVisit: (reservation: VehicleReservation) => void }) {
  return <AlertDialog open={Boolean(reservation)} onOpenChange={(open) => !open && onCancel()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600"><AlertTriangle className="h-5 w-5" /></div>
        <AlertDialogTitle>Veículo reservado para uma visita</AlertDialogTitle>
        <AlertDialogDescription>
          Este veículo possui uma visita hoje, das {reservation ? time(reservation.startAt) : ""} às {reservation ? time(reservation.endAt) : ""}{reservation?.destination ? `, em ${reservation.destination}` : ""}. Altere o veículo da visita antes de iniciar a manutenção.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={() => reservation && onVisit(reservation)}>Ir para visita</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
