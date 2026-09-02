import { Bell, Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toneStyles } from "@/lib/notifications-data";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from "@/lib/notifications-store";
import { cn } from "@/lib/utils";

export function NotificationsPopover() {
  const items = useNotifications();
  const unread = items.filter((n) => !n.read).length;

  const markAll = markAllNotificationsRead;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className="relative focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-card">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo em dia"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={markAll}
            disabled={unread === 0}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Marcar tudo
          </Button>
        </div>

        <ScrollArea className="max-h-[380px]">
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = n.icon;
              return (
                <li
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/[0.03]",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      toneStyles[n.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {n.time}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
          <button className="text-xs font-medium text-primary hover:underline">
            Ver todas
          </button>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="h-3.5 w-3.5" /> Preferências
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
