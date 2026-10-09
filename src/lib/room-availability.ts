import type { CalendarEvent } from '@/lib/calendar-events';

export function findRoomConflict({
  events, room, date, startTime, endTime, ignoreEventId,
}: {
  events: CalendarEvent[]; room: string; date: string; startTime: string; endTime: string;
  ignoreEventId?: string | number;
}) {
  if (!room || !date || !startTime || !endTime || endTime <= startTime) return undefined;
  const normalizedRoom = room.trim().toLocaleLowerCase('pt-BR');
  return events.find(event =>
    String(event.id) !== String(ignoreEventId ?? '') &&
    event.type === 'Reunião na Prócion' &&
    event.status !== 'Cancelado' && event.status !== 'Concluído' &&
    event.room?.trim().toLocaleLowerCase('pt-BR') === normalizedRoom &&
    event.date === date && startTime < event.end && endTime > event.time,
  );
}
