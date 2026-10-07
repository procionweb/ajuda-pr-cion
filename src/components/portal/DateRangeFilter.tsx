import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const parseDate = (value: string) => (value ? new Date(`${value}T12:00:00`) : undefined);
const serializeDate = (value?: Date) => (value ? format(value, "yyyy-MM-dd") : "");

export function DateRangeFilter({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [draft, setDraft] = useState<DateRange | undefined>();
  useEffect(
    () => setDraft(from || to ? { from: parseDate(from), to: parseDate(to) } : undefined),
    [from, to],
  );
  const label =
    from && to
      ? `${format(parseDate(from)!, "dd/MM/yyyy")} - ${format(parseDate(to)!, "dd/MM/yyyy")}`
      : from
        ? `A partir de ${format(parseDate(from)!, "dd/MM/yyyy")}`
        : to
          ? `Até ${format(parseDate(to)!, "dd/MM/yyyy")}`
          : "dd/mm/aaaa - dd/mm/aaaa";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-full min-w-[190px] cursor-pointer items-center gap-2 truncate rounded-lg border border-border bg-background px-3 text-[12px] outline-none focus:ring-2 focus:ring-ring",
            !from && !to && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-auto max-w-[calc(100vw-1rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain p-0">
        <Calendar
          mode="range"
          numberOfMonths={compact ? 1 : 2}
          selected={draft}
          onSelect={setDraft}
          locale={ptBR}
          initialFocus
          className="pointer-events-auto p-3"
        />
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-popover px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(undefined);
              onChange("", "");
              setOpen(false);
            }}
          >
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              let start = draft?.from;
              let end = draft?.to;
              if (start && end && start > end) [start, end] = [end, start];
              onChange(serializeDate(start), serializeDate(end));
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
