import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * The Cosmic Dolphin mark — docs/design-system/foundations.md § Brand.
 *
 * A leaping arc over a single point of light, on an accent tile. It is the
 * "quiet metaphor for depth and connection" of decision 11, drawn rather than
 * borrowed: the emoji it replaces rendered differently on every platform and
 * could not take the accent, a size, or a dark mode.
 *
 * Colours come from the accent tokens through `fill-*` / `stroke-*`, so the mark
 * translates to dark mode with everything else. `app/icon.svg` is the favicon
 * copy of the same geometry, with literals, because a favicon cannot read CSS.
 */
export function LogoMark({
  className,
  title,
}: {
  className?: string;
  /** Omit for a decorative mark beside a wordmark or inside a named link. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-6 shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path
        d="M7.5 22.5C10 13.5 17.5 9 25 11.5"
        fill="none"
        strokeWidth="2.75"
        strokeLinecap="round"
        className="stroke-accent-fg"
      />
      <circle cx="21.75" cy="20.25" r="2.25" className="fill-accent-fg" />
    </svg>
  );
}

/** Mark plus wordmark, linking home. The one brand lockup in the product. */
export function Brandmark({
  className,
  href = "/",
  compact = false,
}: {
  className?: string;
  href?: string;
  /** Mark only, still named for assistive tech. */
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Cosmic Dolphin home"
      className={cn(
        "inline-flex items-center gap-2.5 whitespace-nowrap rounded-sm",
        "font-sans text-[15px] font-semibold leading-none tracking-[-.015em] text-fg",
        focusRing,
        className,
      )}
    >
      <LogoMark />
      {compact ? null : <span>Cosmic Dolphin</span>}
    </Link>
  );
}
