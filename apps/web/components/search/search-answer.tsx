import * as React from "react";

import { cn } from "@/lib/utils";
import { AiCallout } from "@/components/ai/ai-callout";
import { ProvenanceRow } from "@/components/provenance-row";
import { Skeleton } from "@/components/ui/skeleton";

import type { AnswerSourceLink } from "./search-data";

export interface SearchAnswerProps {
  /** The answer so far. Grows while `streaming` is true. */
  answer: string;
  /** The bookmarks the answer was built from. Empty means there is no answer. */
  sources: AnswerSourceLink[];
  /** More text is still arriving. */
  streaming?: boolean;
  className?: string;
}

/**
 * A `/search/ask` answer — an AI callout, bound by the provenance rule.
 *
 * Rule 8, restated for this surface: **an answer that cites nothing does not
 * render as an answer.** Not as a callout with an empty foot, not as a callout
 * with a "no sources" note — as nothing at all, leaving the page's empty state
 * to say what happened. That is the guard on the first line of this component,
 * and it is the thing `__tests__/search-answer.test.tsx` exists to hold.
 *
 * The server keeps the same rule from its end: it emits the `sources` frame
 * before any prose and stops there when the frame is empty, so this guard
 * should never be the only thing standing between the reader and an
 * unattributed paragraph. Two locks, because it only takes one careless change
 * on either side to lose the guarantee.
 *
 * Every source is named and every source is a link. There is no `+n more`
 * tail: a bookmark folded into a count is not named, and one that is not a
 * link is not provenance.
 */
export function SearchAnswer({
  answer,
  sources,
  streaming = false,
  className,
}: SearchAnswerProps) {
  if (sources.length === 0) return null;

  const text = answer.trim();
  if (!text && !streaming) return null;

  return (
    <AiCallout
      label="Answer"
      className={className}
      footer={
        <ProvenanceRow
          lead="Built from"
          sources={sources.map((source) => ({
            domain: source.domain,
            faviconUrl: source.faviconUrl,
            href: source.href,
          }))}
        />
      }
    >
      {text ? (
        <p
          className={cn(
            "m-0 whitespace-pre-wrap font-sans text-sm leading-[1.6] text-fg-secondary"
          )}
        >
          {text}
          {streaming ? (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-ai"
            />
          ) : null}
        </p>
      ) : (
        <div className="flex flex-col gap-2 py-1">
          <Skeleton shape="line" className="w-[92%]" />
          <Skeleton shape="line" className="w-[76%]" />
          <Skeleton shape="line" className="w-[48%]" />
        </div>
      )}
    </AiCallout>
  );
}

/**
 * The callout's own loading shape, shown while the sources are still in
 * flight. It is not an answer and it names nothing, so it says nothing.
 */
export function SearchAnswerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ai-border p-6",
        "bg-[linear-gradient(180deg,var(--cd-ai-bg-top)_0%,var(--cd-ai-bg)_100%)]",
        className
      )}
    >
      <Skeleton className="mb-3.5 h-[22px] w-[110px] rounded-pill" />
      <div className="flex flex-col gap-2">
        <Skeleton shape="line" className="w-[94%]" />
        <Skeleton shape="line" className="w-[81%]" />
        <Skeleton shape="line" className="w-[55%]" />
      </div>
    </div>
  );
}
