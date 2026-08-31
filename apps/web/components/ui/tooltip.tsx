"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

/**
 * Tooltip — see docs/design-system/components.md#tooltip.
 *
 * Only for icon-only controls and truncated text, and never the only place
 * information exists: if a control needs explaining beyond its label, the label
 * is wrong. 400ms delay, so it does not fire while the pointer is in transit.
 */
const TOOLTIP_DELAY = 400;

const TooltipProvider = ({
  delayDuration = TOOLTIP_DELAY,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);
TooltipProvider.displayName = TooltipPrimitive.Provider.displayName;

const Tooltip = ({
  delayDuration = TOOLTIP_DELAY,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => (
  <TooltipPrimitive.Root delayDuration={delayDuration} {...props} />
);
Tooltip.displayName = TooltipPrimitive.Root.displayName;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-sm border border-line bg-bg-panel px-2.5 py-1.5",
        "font-sans text-xs leading-none text-fg",
        "shadow-[var(--cd-shadow-popover)]",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        "origin-[--radix-tooltip-content-transform-origin]",
        "motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
