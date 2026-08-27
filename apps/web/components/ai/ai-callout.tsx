import * as React from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * AI callout — see docs/design-system/patterns.md#ai-callout.
 *
 * The quiet editorial layer. Used for the Cosmic brief, feed digests, and
 * collection suggestions.
 *
 * A soft gradient ground, one hairline, one corner aura, and a chip that names
 * the author. The aura is the only decorative gradient in the product: one per
 * callout, always top-right, always behind the content (`z-index:-1` with
 * `isolation:isolate` on the parent).
 *
 * Never an accent rail down the left edge. Never a second gradient. Never
 * purple, never a chat bubble, never the word "magic". And never an AI output
 * without a `footer` naming its sources — that is rule 8, not a preference.
 */
export interface AiCalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Badge label beside the sparkle: "Cosmic brief", "Suggestion". */
  label: React.ReactNode;
  /** Right-aligned meta in the head: "9 min article · read in 40 seconds". */
  meta?: React.ReactNode;
  /** Right-aligned control in the head — usually the overflow menu. */
  action?: React.ReactNode;
  /**
   * The `.ai-foot`: a divider and the provenance row naming the sources.
   * Every AI output ships one.
   */
  footer?: React.ReactNode;
  /** 14px padding instead of 24px, for the Library rail's suggestion. */
  compact?: boolean;
}

const AiCallout = React.forwardRef<HTMLDivElement, AiCalloutProps>(
  (
    { className, label, meta, action, footer, compact = false, children, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "relative isolate rounded-lg border border-ai-border",
        "bg-[linear-gradient(180deg,var(--cd-ai-bg-top)_0%,var(--cd-ai-bg)_100%)]",
        "shadow-[inset_0_1px_0_var(--cd-ai-sheen)]",
        compact ? "p-3.5" : "p-6",
        // The corner aura. Behind the content, never over it.
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10",
        "before:rounded-[inherit] before:content-['']",
        "before:bg-[radial-gradient(110%_130%_at_100%_0%,var(--cd-ai-glow),transparent_58%)]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2.5",
          compact ? "mb-2.5" : "mb-3.5",
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill",
            "border border-ai-border bg-ai-chip py-[5px] pl-2 pr-[11px]",
            "font-sans text-xs font-semibold leading-none text-ai",
          )}
        >
          <Sparkles aria-hidden="true" className="size-3 shrink-0 fill-current" />
          {label}
        </span>
        {meta ? (
          <span className="ml-auto font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            {meta}
          </span>
        ) : null}
        {action ? (
          <span className={cn(meta ? "shrink-0" : "ml-auto shrink-0")}>
            {action}
          </span>
        ) : null}
      </div>

      {children}

      {footer ? (
        <div className="mt-4 border-t border-ai-border pt-3.5">{footer}</div>
      ) : null}
    </div>
  ),
);
AiCallout.displayName = "AiCallout";

/**
 * Key points inside a callout.
 *
 * A 6px `--cd-ai` dot with a 3px `--cd-ai-chip` halo. Never `01 / 02 / 03`:
 * findings are not a sequence, and numbering claims an order the content does
 * not have — which is why this is a `<ul>` and not an `<ol>`.
 */
const AiKeyPoints = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("m-0 flex list-none flex-col gap-[11px] p-0", className)}
    {...props}
  />
));
AiKeyPoints.displayName = "AiKeyPoints";

export interface AiKeyPointProps extends React.LiHTMLAttributes<HTMLLIElement> {
  /** Optional lead-in run in `--cd-fg` at 500: "Memory beats context." */
  term?: React.ReactNode;
}

const AiKeyPoint = React.forwardRef<HTMLLIElement, AiKeyPointProps>(
  ({ className, term, children, ...props }, ref) => (
    <li
      ref={ref}
      className={cn(
        "flex gap-[11px] font-sans text-sm leading-[1.55] text-fg-secondary",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-2 size-1.5 shrink-0 rounded-pill bg-ai",
          "shadow-[0_0_0_3px_var(--cd-ai-chip)]",
        )}
      />
      <span className="min-w-0">
        {term ? (
          <b className="font-medium text-fg">{term} </b>
        ) : null}
        {children}
      </span>
    </li>
  ),
);
AiKeyPoint.displayName = "AiKeyPoint";

export { AiCallout, AiKeyPoints, AiKeyPoint };
