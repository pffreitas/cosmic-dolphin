import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FaviconChip } from "@/components/ui/favicon-chip";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Provenance row — see docs/design-system/patterns.md#provenance-row.
 *
 * The compact, always-visible answer to "where did this come from". Every AI
 * output and every feed item carries one. Trust precedes attention, so this
 * row is rendered BEFORE the title, never after it.
 *
 *   favicon chip · source (500 weight, --cd-fg) · dot · attribution · dot · relative time
 *
 * The five contexts from the spec, expressed through these props:
 *
 *   own save        sources, action="you saved this", timestamp="2d"
 *   shared          actor, action="shared", sources, timestamp="2d"
 *   social signal   sources, attribution="Karpathy", action="liked by 3 people you follow"
 *   AI digest       lead="Built from", sources=[…, …], moreCount={2}
 *   AI summary      sources, action="summarised from the full article"
 *
 * Segment order is fixed:
 *
 *   lead · actor · (action, when there is an actor) · sources · +n more ·
 *   attribution · (action, when there is no actor) · timestamp
 *
 * The action hugs the actor when there is one ("Maya · shared · every.to") and
 * otherwise trails the source ("every.to · you saved this"), which is what the
 * five rows above need and the only conditional in the component.
 *
 * Times arrive already formatted ("2d", "just now"). The row does no date
 * maths: a component that formats time is a component that has to be told the
 * user's locale and clock, and this one is rendered on both sides of the wire.
 */
export interface ProvenanceSource {
  /** Bare domain — "every.to", not "https://every.to/". */
  domain: string;
  /** `metadata.openGraph.favicon`. Falls back to the domain's first letter. */
  faviconUrl?: string | null;
  /** Makes the source a link. A digest's sources link to their bookmarks. */
  href?: string;
}

export interface ProvenanceActor {
  name: string;
  /** `profiles.picture_url`. Falls back to initials on the accent. */
  avatarUrl?: string | null;
  /** Makes the name a link to the person's profile. */
  href?: string;
}

export interface ProvenanceRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** A leading word with no separator after it — the digest's "Built from". */
  lead?: React.ReactNode;
  /** The person this reached the user through. Renders a 22px inline avatar. */
  actor?: ProvenanceActor;
  /** Sources, in order. Each one carries its own favicon chip. */
  sources?: ProvenanceSource[];
  /** "+n more" after the sources — the digest tail. Omitted when 0. */
  moreCount?: number;
  /** Author or channel credit: "Dan Shipper", "Karpathy". */
  attribution?: React.ReactNode;
  /** What happened, in the product's words: "shared", "you saved this". */
  action?: React.ReactNode;
  /** Already-formatted relative time: "2d", "just now", "saved 2d ago". */
  timestamp?: React.ReactNode;
  /** Right-aligned slot — the Cosmic brief's Regenerate ghost button. */
  trailing?: React.ReactNode;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="size-[3px] shrink-0 rounded-pill bg-fg-tertiary"
    />
  );
}

function SourceSegment({ source }: { source: ProvenanceSource }) {
  const body = (
    <>
      <FaviconChip src={source.faviconUrl} domain={source.domain} />
      <span className="truncate font-medium text-fg">{source.domain}</span>
    </>
  );

  if (source.href) {
    return (
      <Link
        href={source.href}
        className={cn(
          "flex min-w-0 items-center gap-[7px] rounded-xs",
          "transition-colors duration-cd-fast ease-cd hover:text-fg",
          focusRing,
        )}
      >
        {body}
      </Link>
    );
  }

  return <span className="flex min-w-0 items-center gap-[7px]">{body}</span>;
}

function ActorSegment({ actor }: { actor: ProvenanceActor }) {
  const body = (
    <>
      <Avatar size="inline">
        {actor.avatarUrl ? (
          <AvatarImage src={actor.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback>{initials(actor.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-fg">{actor.name}</span>
    </>
  );

  if (actor.href) {
    return (
      <Link
        href={actor.href}
        className={cn(
          "flex min-w-0 items-center gap-[7px] rounded-xs",
          "transition-colors duration-cd-fast ease-cd hover:text-fg",
          focusRing,
        )}
      >
        {body}
      </Link>
    );
  }

  return <span className="flex min-w-0 items-center gap-[7px]">{body}</span>;
}

const ProvenanceRow = React.forwardRef<HTMLDivElement, ProvenanceRowProps>(
  (
    {
      className,
      lead,
      actor,
      sources,
      moreCount,
      attribution,
      action,
      timestamp,
      trailing,
      ...props
    },
    ref,
  ) => {
    const segments: React.ReactNode[] = [];

    if (actor) segments.push(<ActorSegment key="actor" actor={actor} />);
    if (actor && action) segments.push(<span key="action">{action}</span>);

    sources?.forEach((source, index) => {
      segments.push(
        <SourceSegment key={`source-${source.domain}-${index}`} source={source} />,
      );
    });

    if (moreCount && moreCount > 0) {
      segments.push(<span key="more">{`+${moreCount} more`}</span>);
    }
    if (attribution) segments.push(<span key="attribution">{attribution}</span>);
    if (!actor && action) segments.push(<span key="action">{action}</span>);
    if (timestamp) {
      segments.push(
        <span key="timestamp" className="whitespace-nowrap">
          {timestamp}
        </span>,
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-[7px]",
          "font-sans text-[12.5px] leading-[1.4] text-fg-secondary",
          className,
        )}
        {...props}
      >
        {lead ? <span>{lead}</span> : null}
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <Dot /> : null}
            {segment}
          </React.Fragment>
        ))}
        {trailing ? <span className="ml-auto">{trailing}</span> : null}
      </div>
    );
  },
);
ProvenanceRow.displayName = "ProvenanceRow";

/**
 * "Why this appeared" — a sibling of the provenance row, never a child of it.
 *
 * A dotted-underline `--cd-ai` summary that expands into a `--cd-ai-bg` panel
 * giving the actual ranking reason in one sentence, in plain language and in
 * the second person. It is a disclosure, not a tooltip, and it is never hidden
 * behind a hover.
 *
 * The sentence comes from the API (`rankingReason`). It is never assembled
 * client-side from a template: the client cannot know what the ranker actually
 * weighted, and a plausible-sounding wrong answer is worse than none.
 */
export interface WhyThisAppearedProps
  extends Omit<React.HTMLAttributes<HTMLDetailsElement>, "children"> {
  /** `rankingReason` from the feed API. Render nothing when it is absent. */
  reason?: React.ReactNode;
  /** Overrides the disclosure label. */
  label?: React.ReactNode;
}

const WhyThisAppeared = React.forwardRef<
  HTMLDetailsElement,
  WhyThisAppearedProps
>(({ className, reason, label = "Why this appeared", ...props }, ref) => {
  if (!reason) return null;

  return (
    <details ref={ref} className={cn("min-w-0", className)} {...props}>
      <summary
        className={cn(
          "inline-flex w-fit cursor-pointer list-none items-center rounded-xs",
          "font-sans text-[12.5px] leading-[1.4] text-ai",
          "underline decoration-dotted underline-offset-[3px]",
          "[&::-webkit-details-marker]:hidden",
          focusRing,
        )}
      >
        {label}
      </summary>
      <div
        className={cn(
          "mt-2 rounded-md border border-ai-border px-[13px] py-[11px]",
          "bg-[linear-gradient(180deg,var(--cd-ai-bg-top)_0%,var(--cd-ai-bg)_100%)]",
          "shadow-[inset_0_1px_0_var(--cd-ai-sheen)]",
          "font-sans text-[13px] leading-[1.55] text-fg-secondary",
        )}
      >
        {reason}
      </div>
    </details>
  );
});
WhyThisAppeared.displayName = "WhyThisAppeared";

export { ProvenanceRow, WhyThisAppeared };
