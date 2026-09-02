import { Bell, Check, MonitorUp } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
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
  const navigate = useNavigate();
  const items = useNotifications();
  const visibleItems = items.filter((item) => !item.read);
  const unread = visibleItems.length;

  const markAll = markAllNotificationsRead;

  const openNotification = (id: string, href?: string) => {
    markNotificationRead(id);
    if (href) void navigate({ to: href });
  };

  const enableDesktopNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Este navegador não oferece notificações no computador.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") toast.success("Avisos no computador ativados.");
    else toast.error("Permissão de notificações não concedida.");
  };

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
      <PopoverContent align="end" className="w-[calc(100vw-1rem)] max-w-[360px] p-0">
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
            {visibleItems.map((n) => {
              const Icon = n.icon;
              return (
                <li
                  key={n.id}
                  onClick={() => openNotification(n.id, n.href)}
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
            {visibleItems.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação pendente.
              </li>
            )}
          </ul>
        </ScrollArea>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">Avisos do portal</span>
          <button
            type="button"
            onClick={enableDesktopNotifications}
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline"
          >
            <MonitorUp className="h-3.5 w-3.5" /> Ativar avisos no computador
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
