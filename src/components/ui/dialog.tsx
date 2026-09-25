"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;
const containsFooter = (children: React.ReactNode): boolean =>
  React.Children.toArray(children).some(
    (child) =>
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      (child.type === DialogFooter || containsFooter(child.props.children)),
  );
const containsClose = (children: React.ReactNode): boolean =>
  React.Children.toArray(children).some((child) =>
    typeof child === "string"
      ? child.trim() === "Fechar"
      : React.isValidElement<{ children?: React.ReactNode }>(child) &&
        containsClose(child.props.children),
  );

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    autoFooter?: boolean;
    onOutsideClick?: () => void;
  }
>(
  (
    {
      className,
      children,
      autoFooter = true,
      onOutsideClick,
      onPointerDownOutside,
      onInteractOutside,
      onEscapeKeyDown,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <DialogOverlay
        onClick={(event) => {
          if (!onOutsideClick) return;
          event.stopPropagation();
          onOutsideClick();
        }}
      />
      <DialogPrimitive.Content
        ref={ref}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event);
          if (!event.defaultPrevented) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          if (!event.defaultPrevented) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event);
          if (!event.defaultPrevented) event.preventDefault();
        }}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-card p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-h-[90vh] sm:w-full sm:rounded-lg sm:p-6 modal-scrollbar [&_button]:font-normal [&_button:not(:disabled)]:cursor-pointer",
          className,
        )}
        {...props}
      >
        {children}
        {autoFooter && !containsFooter(children) && (
          <DialogFooter className="shrink-0 border-t px-4 py-3" />
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

type DialogFooterProps = React.HTMLAttributes<HTMLDivElement> & { showClose?: boolean };

const DialogFooter = ({ className, children, showClose = true, ...props }: DialogFooterProps) => (
  <div
    className={cn(
      "sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-end gap-2 bg-card sm:space-x-2",
      className,
    )}
    {...props}
  >
    {showClose && !containsClose(children) && (
      <DialogPrimitive.Close asChild>
        <Button type="button" variant="outline">
          Fechar
        </Button>
      </DialogPrimitive.Close>
    )}
    {children}
  </div>
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
