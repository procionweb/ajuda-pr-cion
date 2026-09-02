import type { ReactNode } from "react";
import { AppSidebar, MobileBottomNav } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { FleetActionModals } from "@/components/fleet/FleetActionModals";
import { useSidebarCollapsed } from "@/lib/sidebar-store";
import { cn } from "@/lib/utils";
import { CalendarNotifications } from "./CalendarNotifications";

export function AppShell({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  const collapsed = useSidebarCollapsed();
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className={cn("transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[86px]" : "lg:pl-[286px]")}>
        <AppHeader />
        <main
          className={cn(
            "mx-auto min-w-0 overflow-x-hidden px-4 py-6 pb-24 sm:px-6 lg:px-7 lg:py-7 lg:pb-8",
            fullWidth ? "w-full max-w-none" : "max-w-[1680px]",
          )}
        >
          {children}
        </main>
      </div>
      <MobileBottomNav />
      <FleetActionModals />
      <CalendarNotifications />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-6 lg:mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
