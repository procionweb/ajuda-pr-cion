import { useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Seleção de data e horário compartilhada entre o modal de novo agendamento do
 * Calendário e o modal de agendamento dos detalhes do chamado.
 */
export function EventDateTimeFields({
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  className,
}: {
  date: string;
  onDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  className?: string;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const compact = useIsMobileOrTablet();
  const typedTime = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  };

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      <DateTimeField label="Data" required>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            >
              <CalendarDays className="h-4 w-4 opacity-70" />
              <span>
                {date ? format(new Date(`${date}T12:00:00`), "dd/MM/yyyy") : "dd/mm/aaaa"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date ? new Date(`${date}T12:00:00`) : undefined}
              onSelect={(d) => {
                if (d) onDateChange(toDateValue(d));
                setDateOpen(false);
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </DateTimeField>
      <DateTimeField label="Início" required>
        <Input
          type={compact ? "text" : "time"}
          inputMode={compact ? "numeric" : undefined}
          placeholder="HH:mm"
          maxLength={compact ? 5 : undefined}
          pattern={compact ? "([01][0-9]|2[0-3]):[0-5][0-9]" : undefined}
          value={startTime}
          onChange={(e) => onStartTimeChange(compact ? typedTime(e.target.value) : e.target.value)}
          className="cursor-pointer"
        />
      </DateTimeField>
      <DateTimeField label="Término" required>
        <Input
          type={compact ? "text" : "time"}
          inputMode={compact ? "numeric" : undefined}
          placeholder="HH:mm"
          maxLength={compact ? 5 : undefined}
          pattern={compact ? "([01][0-9]|2[0-3]):[0-5][0-9]" : undefined}
          value={endTime}
          onChange={(e) => onEndTimeChange(compact ? typedTime(e.target.value) : e.target.value)}
          className="cursor-pointer"
        />
      </DateTimeField>
    </div>
  );
}

function DateTimeField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[12.5px] font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
