import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Callout — see docs/design-system/patterns.md#callout.
 *
 * The panel that holds a Cosmic brief, a feed digest, or a collection
 * suggestion. Since R6 it is deliberately *not* dressed as AI: a plain
 * `--cd-bg-panel` panel, one `--cd-border` hairline, a sentence-case label in
 * `--cd-fg-secondary`. No sparkle, no tinted gradient, no glow. What earns the
 * reader's trust is the footer naming its sources — rule 8 — not a costume
 * that says "a machine made this".
 *
 * Never an accent rail down the left edge. Never a chat bubble, never the
 * word "magic". And never a callout without a `footer` naming its sources.
 */
export interface AiCalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The panel's label: "Cosmic brief", "This week in your library". */
  label: React.ReactNode;
  /** Right-aligned meta in the head: "9 min article · read in 40 seconds". */
  meta?: React.ReactNode;
  /** Right-aligned control in the head — usually the overflow menu. */
  action?: React.ReactNode;
  /**
   * A divider and the provenance row naming the sources. Every callout ships
   * one.
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
        "rounded-md border border-line bg-bg-panel",
        compact ? "p-3.5" : "p-5",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2.5",
          compact ? "mb-2" : "mb-2.5",
        )}
      >
        <span className="font-sans text-[12.5px] font-semibold leading-[1.4] text-fg-secondary">
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
        <div className="mt-4 border-t border-line pt-3.5">{footer}</div>
      ) : null}
    </div>
  ),
);
AiCallout.displayName = "AiCallout";

/**
 * Key points inside a callout.
 *
 * A 5px `--cd-fg-tertiary` dot. Never `01 / 02 / 03`:
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
          "mt-[9px] size-[5px] shrink-0 rounded-pill bg-fg-tertiary",
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
