import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";

/**
 * Tag — see docs/design-system/components.md#tag.
 *
 * Pill, 12px/500. The default `topic` variant is a hairline outline on no fill
 * — topics are evidence about a save, not actions, and painting every one in
 * the accent spent the accent on the least decisive thing on screen. `neutral`
 * carries non-topical facts (reading time, counts) on `--cd-bg-inset`.
 * `accent` is for the rare tag that *is* a selection — an active filter.
 * AI-suggested tags and user tags render identically: the user cannot be
 * asked to care which is which.
 *
 * `Badge` stays exported as an alias so existing callers keep working; new code
 * should reach for `Tag`.
 */
const tagVariants = cva(
  cn(
    "inline-flex items-center gap-1 rounded-pill border-0",
    "px-2.5 py-[5px] font-sans text-xs font-medium leading-none",
    "transition-colors duration-cd-fast ease-cd",
  ),
  {
    variants: {
      variant: {
        topic: "border border-line bg-transparent px-[9px] py-1 text-fg-secondary",
        accent: "bg-accent-soft text-accent",
        neutral: "bg-bg-inset text-fg-secondary",
        danger: "bg-bg-inset text-[color:var(--cd-danger)]",

        // ---- compatibility aliases -------------------------------------
        default: "bg-accent-soft text-accent",
        secondary: "bg-bg-inset text-fg-secondary",
        outline: "bg-bg-inset text-fg-secondary",
        destructive: "bg-bg-inset text-[color:var(--cd-danger)]",
      },
    },
    defaultVariants: {
      variant: "topic",
    },
  },
);

export interface TagProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tagVariants> {
  /**
   * Makes the tag removable: adds a 12px × at the trailing edge. It gets its
   * own accessible name, because "×" alone says nothing.
   */
  onRemove?: () => void;
  /** Accessible name for the remove control. Defaults to "Remove tag". */
  removeLabel?: string;
}

function Tag({
  className,
  variant,
  onRemove,
  removeLabel,
  children,
  ...props
}: TagProps) {
  return (
    <div className={cn(tagVariants({ variant }), className)} {...props}>
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={
            removeLabel ??
            (typeof children === "string"
              ? `Remove ${children}`
              : "Remove tag")
          }
          className={cn(
            "relative -mr-1 grid size-4 place-items-center rounded-pill",
            // A tag is 22px tall, so the 32px target is a transparent ::after
            // rather than a box — foundations.md § Accessibility.
            "after:absolute after:left-1/2 after:top-1/2 after:size-8",
            "after:-translate-x-1/2 after:-translate-y-1/2",
            "text-current opacity-70 transition-opacity hover:opacity-100",
            focusRing,
          )}
        >
          <X aria-hidden="true" className="size-3 [stroke-width:1.7]" />
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Use `Tag`. Kept so existing callers keep compiling. */
const Badge = Tag;
/** @deprecated Use `tagVariants`. */
const badgeVariants = tagVariants;

export type BadgeProps = TagProps;
export { Tag, tagVariants, Badge, badgeVariants };
