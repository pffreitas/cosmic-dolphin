"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";

/**
 * Dialog & Sheet — see docs/design-system/components.md#dialog--sheet.
 *
 * Below 640px a dialog becomes a bottom sheet: full width, pinned to the
 * bottom edge, `--cd-radius-lg` on the top corners only. Above it, a centred
 * panel at `--cd-radius-md`.
 *
 * Every dialog has a title, an explicit primary action, and a cancel that is a
 * `ghost` button. In a destructive dialog the destructive action is the primary
 * and fills `--cd-danger` (`<Button variant="dangerSolid">`).
 */
const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[color:var(--cd-overlay)]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 grid gap-4 border border-line bg-bg-panel p-6 text-fg",
        "shadow-[var(--cd-shadow-dialog)]",
        "duration-cd ease-cd",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Bottom sheet below 640px: full width, top corners only.
        "inset-x-0 bottom-0 w-full max-h-[90dvh] overflow-y-auto rounded-t-lg",
        "max-sm:max-w-none",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // Centred panel from 640px up. Confirmations cap at 520px; editors
        // pass `sm:max-w-[720px]`. The cap is unprefixed so a caller's own
        // `max-w-*` merges it away cleanly.
        "max-w-[520px]",
        "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2",
        "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md",
        "sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-top-[48%]",
        "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
        "motion-reduce:animate-none",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-4 top-4 grid size-8 place-items-center rounded-sm",
          "text-fg-tertiary transition-colors hover:bg-bg-inset hover:text-fg",
          "disabled:pointer-events-none",
          focusRing,
        )}
      >
        <X aria-hidden="true" className="size-4 [stroke-width:1.7]" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-1.5 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "pr-8 font-serif text-[20px] font-semibold leading-[1.3] text-fg",
      className,
    )}
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
    className={cn(
      "font-sans text-[13.5px] leading-[1.55] text-fg-secondary",
      className,
    )}
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
