import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Skeleton — see docs/design-system/components.md#skeleton.
 *
 * Base `--cd-bg-inset` with a 1.6s shimmer sweep, flattened under
 * `prefers-reduced-motion`.
 *
 * Skeletons mirror the REAL geometry of what is loading — same line heights,
 * same thumbnail box, same gaps — so nothing reflows when content lands. A
 * generic grey rectangle is a bug: it guarantees a jump.
 *
 *   line    11px bar, full width          body copy
 *   title   17px bar, 72% width           a title-3 heading
 *   thumb   the context's thumbnail box   pass w/h from the real thumbnail
 */
const skeletonVariants = cva(
  cn(
    "relative isolate overflow-hidden bg-bg-inset",
    // The sweep is a pseudo-element so the base colour stays a flat token.
    "after:absolute after:inset-0 after:animate-skeleton-sweep",
    "after:bg-[linear-gradient(90deg,transparent,var(--cd-bg-panel),transparent)]",
    "motion-reduce:after:hidden",
  ),
  {
    variants: {
      shape: {
        line: "h-[11px] w-full rounded-xs",
        title: "h-[17px] w-[72%] rounded-xs",
        thumb: "rounded-md",
        block: "rounded-md",
      },
    },
    defaultVariants: { shape: "block" },
  },
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  );
}

export { Skeleton, skeletonVariants };
