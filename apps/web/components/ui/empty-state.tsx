import * as React from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty state — see docs/design-system/components.md#empty-state.
 *
 * Centred, max 42ch, on `--cd-bg-subtle` or on the bare page. 20px Lucide icon
 * in `--cd-fg-tertiary`, a `title-3` heading, a `body-sm` explanation, and —
 * when there is one — a single `primary` action.
 *
 * Empty states name the specific emptiness. "No unread links in Research"
 * beats "Nothing here". If you find yourself writing the second one, you do not
 * yet know enough about the surface to describe what is missing.
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon;
  /** Name the specific emptiness, not the general absence of things. */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** At most one action, and it is the surface's `primary` button. */
  action?: React.ReactNode;
  /** Sit on the recessed ground rather than the bare page. */
  ground?: boolean;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { className, icon: Icon, title, description, action, ground = false, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        ground && "rounded-md bg-bg-subtle",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className="size-5 shrink-0 text-fg-tertiary [stroke-width:1.7]"
        />
      ) : null}
      <div className="flex max-w-[42ch] flex-col gap-1.5">
        <p className="font-serif text-[17px] font-semibold leading-[1.35] text-fg">
          {title}
        </p>
        {description ? (
          <p className="font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
