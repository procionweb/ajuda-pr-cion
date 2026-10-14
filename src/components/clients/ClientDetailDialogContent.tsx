import type { ReactNode } from "react";
import { DialogContent, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Rodapé fora da área rolável para nunca cobrir os últimos registros. */
export function ClientDetailDialogContent({
  children,
  className,
  bodyClassName,
  footer,
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}) {
  return (
    <DialogContent
      autoFooter={false}
      className={cn(
        className,
        "flex flex-col gap-0 overflow-hidden p-0 sm:p-0 text-[13px] [&_.text-sm]:text-[13px] [&_.text-base]:text-[13px] [&_.text-lg]:text-[14px] [&_.text-xl]:text-[14px] [&_.font-medium]:font-normal [&_.font-semibold]:font-normal [&_input]:text-[13px] [&_textarea]:text-[13px]",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5",
          bodyClassName,
        )}
      >
        {children}
      </div>
      <DialogFooter className="static shrink-0 border-t border-border px-4 py-3 [&_button]:text-[13px]">
        {footer}
      </DialogFooter>
    </DialogContent>
  );
}
