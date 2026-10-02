"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { FaviconChip } from "@/components/ui/favicon-chip";
import { focusRing } from "@/components/ui/focus-ring";
import {
  ProcessingSteps,
  type ProcessingPhase,
  type ProcessingStep,
} from "@/components/ai/processing-steps";

/**
 * *Saving now* — docs/design-system/pages.md § Home, block 2.
 *
 * Every save in flight, as one `--cd-bg-subtle` bordered strip with a hairline
 * between rows: favicon · title (clamp 1) · time on the left, the staged AI
 * progress laid out inline on the right. It is the `pending` feed item at the
 * scale of a row — same title, same phases, same Retry — so the save still
 * looks like the thing it is becoming (rule seven), but four of them do not
 * push the edition below the fold.
 *
 * The strip is where the header's omnibox lands a paste. It is absent when
 * nothing is in flight; it never reserves space or apologises for being empty.
 */

export interface SavingRowProps {
  /** Detail route once the save has landed, the source URL before. */
  href: string;
  title: string;
  domain: string;
  faviconUrl?: string | null;
  /** Already formatted: "just now". */
  timestamp: string;
  steps: ProcessingStep[];
  onRetry?: (phase: ProcessingPhase) => void;
  /** Dismiss, Summarise now — right-aligned after the steps. */
  actions?: React.ReactNode;
}

export function SavingRow({
  href,
  title,
  domain,
  faviconUrl,
  timestamp,
  steps,
  onRetry,
  actions,
}: SavingRowProps) {
  // A link that leaves the product opens like one. Before the save lands there
  // is no detail route, so the row points at the source itself.
  const external = /^https?:\/\//.test(href);

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2.5 px-4 py-3">
      <div className="flex min-w-0 flex-[1_1_320px] items-center gap-2.5">
        <FaviconChip src={faviconUrl} domain={domain} />
        <Link
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className={cn(
            "min-w-0 truncate rounded-xs",
            "font-serif text-base font-semibold leading-[1.35] text-fg",
            "hover:underline hover:decoration-line-strong hover:underline-offset-[3px]",
            focusRing,
          )}
        >
          {title}
        </Link>
        <span className="shrink-0 font-sans text-[12.5px] leading-[1.4] text-fg-tertiary">
          {timestamp}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <ProcessingSteps
          layout="inline"
          steps={steps}
          onRetry={onRetry}
          announceLabel={title}
        />
        {actions ? (
          <span className="flex shrink-0 items-center gap-1">{actions}</span>
        ) : null}
      </div>
    </li>
  );
}

/** The strip. Renders nothing when it has no rows. */
export function SavingNow({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <section aria-label="Saving now">
      <ul
        className={cn(
          "m-0 list-none divide-y divide-line p-0",
          "rounded-md border border-line bg-bg-subtle",
        )}
      >
        {rows}
      </ul>
    </section>
  );
}
