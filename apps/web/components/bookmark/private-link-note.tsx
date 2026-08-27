import * as React from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Private link note — docs/functional-spec/02-capture.md#private-links.
 *
 * A URL behind auth that the fetcher cannot read. The bookmark keeps whatever
 * the user supplied — title, notes, tags — and the pipeline skips extraction
 * and summarising, so the AI callout is replaced by this: a `--cd-warning`
 * note saying the page could not be read, and an invitation to write the
 * summary by hand.
 *
 * This is not an error. Nothing failed, and nothing is retryable: the page is
 * simply not ours to read. It carries the warning colour and never the danger
 * one, and it never offers Retry.
 */
export interface PrivateLinkNoteProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Overrides the default sentence. */
  children?: React.ReactNode;
  /** An "Add your own summary" control, when the surface offers one. */
  action?: React.ReactNode;
}

const PrivateLinkNote = React.forwardRef<HTMLDivElement, PrivateLinkNoteProps>(
  ({ className, children, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex min-w-0 flex-wrap items-start gap-2 rounded-md",
        "border border-line bg-bg-subtle px-3 py-2.5",
        "font-sans text-[13px] leading-[1.5] text-fg-secondary",
        className,
      )}
      {...props}
    >
      <Lock
        aria-hidden="true"
        className="mt-px size-3.5 shrink-0 text-[color:var(--cd-warning)] [stroke-width:1.7]"
      />
      <span className="min-w-0 flex-1">
        {children ?? (
          <>
            <span className="font-medium text-fg">Private link.</span> Cosmic
            couldn&apos;t read this page, so your own title and notes are shown
            instead.
          </>
        )}
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  ),
);
PrivateLinkNote.displayName = "PrivateLinkNote";

export { PrivateLinkNote };
