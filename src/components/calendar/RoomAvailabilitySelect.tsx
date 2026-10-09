import { ROOM_OPTIONS, type CalendarEvent } from '@/lib/calendar-events';
import { findRoomConflict } from '@/lib/room-availability';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RoomAvailabilitySelect({ value, onChange, events, date, startTime, endTime, ignoreEventId }: {
  value: string; onChange: (value: string) => void; events: CalendarEvent[];
  date: string; startTime: string; endTime: string; ignoreEventId?: string | number;
}) {
  const conflict = findRoomConflict({ events, room: value, date, startTime, endTime, ignoreEventId });
  return (
    <div className="min-w-0 space-y-1">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-0 text-[13px]" aria-invalid={Boolean(conflict)}>
          <SelectValue placeholder="Selecione a sala" />
        </SelectTrigger>
        <SelectContent>
          {ROOM_OPTIONS.map(room => {
            const reserved = findRoomConflict({ events, room, date, startTime, endTime, ignoreEventId });
            return <SelectItem key={room} value={room} disabled={Boolean(reserved)}>
              {room}{reserved ? ` · Indisponível (${reserved.time}–${reserved.end})` : ''}
            </SelectItem>;
          })}
        </SelectContent>
      </Select>
      {conflict && <p role="status" className="text-xs text-destructive">
        Sala ocupada das {conflict.time} às {conflict.end}. Selecione outra sala ou horário.
      </p>}
    </div>
  );
}
