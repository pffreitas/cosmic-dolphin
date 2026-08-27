import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Kbd — see docs/design-system/components.md#kbd.
 *
 * Mono, 11px, `--cd-border-strong` with a 2px bottom border, `--cd-radius-xs`.
 * Used in the header search chip and the command palette. Shortcuts are shown,
 * not hidden — this product is for people who will learn them.
 */
const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-xs",
        "border border-b-2 border-line-strong bg-bg-panel px-1 pb-px",
        "font-mono text-[11px] leading-[1.3] text-fg-secondary",
        className,
      )}
      {...props}
    />
  ),
);
Kbd.displayName = "Kbd";

export { Kbd };
