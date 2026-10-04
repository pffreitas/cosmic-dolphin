"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/focus-ring";
import {
  ProvenanceRow,
  WhyThisAppeared,
  type ProvenanceRowProps,
} from "@/components/provenance-row";
import {
  AiCallout,
  AiKeyPoint,
  AiKeyPoints,
} from "@/components/ai/ai-callout";
import {
  ProcessingSteps,
  type ProcessingPhase,
  type ProcessingStep,
} from "@/components/ai/processing-steps";
import { ActionRow, type ActionRowProps } from "@/components/social/action-row";
import { PrivateLinkNote } from "@/components/bookmark/private-link-note";
import { Thumbnail } from "@/components/bookmark/thumbnail";

/**
 * Feed item — see docs/design-system/patterns.md § Feed item.
 *
 * A bordered panel — `--cd-bg-panel`, 1px `--cd-border`, `--cd-radius-md`, 16px
 * padding, 12px between siblings. Four shapes share one skeleton.
 *
 * The order of the anatomy is the argument of the item and is not negotiable:
 *
 *   1. provenance row — who and where, before anything else
 *   2. title          — title-2, serif, clamp 2, inside the link
 *   3. summary        — 14px `--cd-fg-secondary`, clamp 3
 *   4. tags           — max 3, plus reading time as a neutral tag
 *   5. why this appeared — a <details> disclosure
 *   6. social action row
 *
 * Never a comment thread inline. Never a "trending" badge. Never an entrance
 * animation. Never two digests within one screenful.
 *
 * Two more shapes carry Home's morning edition (docs/design-system/pages.md
 * § Home): `lead`, the top-ranked item at title-1 with its image leading, and
 * `row`, everything after it as separator rows at title-3. Same anatomy, same
 * order — only the scale and the frame change, so a reader who learned one
 * item has learned all of them.
 */

export type FeedItemVariant = "article" | "video" | "digest" | "pending";

export interface FeedItemKeyPoint {
  /** Lead-in run in `--cd-fg`: "Memory beats context." */
  term?: string;
  text: React.ReactNode;
}

/**
 * One source in a digest's `Built from` row — `DigestSource` from the API,
 * with the detail route it links to.
 */
export interface DigestSourceLink {
  bookmarkId: string;
  /** Bare domain: "every.to". */
  domain: string;
  /** `/bookmarks/{id}`. A source that is not a link is not provenance. */
  href: string;
  faviconUrl?: string | null;
}

/**
 * How many sources the `Built from` row names before it tails into `+n more`.
 *
 * A display decision over a complete list, never a truncation of it: the whole
 * list is always in the props, and three chips plus a tail is what fits on one
 * line at 12.5px without pushing the row to two.
 */
export const DIGEST_SOURCES_SHOWN = 3;

interface FeedItemBase {
  /** Detail route — `/bookmarks/{id}`, or the digest's own route. */
  href: string;
  title: string;
  /** Who and where. Rendered before the title, always. */
  provenance: ProvenanceRowProps;
  /**
   * The overflow menu — Not interested, Fewer from this domain, Mute topic.
   * Right-aligned in the provenance row.
   */
  menu?: React.ReactNode;
  className?: string;
}

interface FeedItemContent extends FeedItemBase {
  /** `cosmicBriefSummary`, falling back to `metadata.openGraph.description`. */
  summary?: string | null;
  /** `cosmicTags`. Trimmed to three, with `+n` for the rest. */
  tags?: string[];
  /** Already-formatted reading time — rendered as a neutral tag. */
  readingTime?: string;
  /**
   * `rankingReason` from the feed API — the ranker's own sentence, never a
   * client-side template. Absent means no disclosure is rendered.
   */
  rankingReason?: string;
  /** `metadata.openGraph.image`. */
  thumbnailUrl?: string | null;
  /** Everything the action row needs. Omit it and no action row renders. */
  social?: ActionRowProps;
  /**
   * `isPrivateLink` — a lock by the title and a `--cd-warning` note where the
   * summary would be. The pipeline skipped this one on purpose.
   */
  privateLink?: boolean;
  /**
   * A partially-failed run: the failed phase is shown in place of the brief,
   * not in place of the item. The item stays usable and the original still
   * opens.
   */
  steps?: ProcessingStep[];
  onRetry?: (phase: ProcessingPhase) => void;
}

export type FeedItemProps =
  | ({ variant?: "article" } & FeedItemContent)
  | ({
      variant: "video";
      /** Mono duration badge, bottom-right of the thumbnail: "42:18". */
      duration?: string;
      /** Adds **Watch with summary** to the action row. */
      onWatchWithSummary?: () => void;
      watchHref?: string;
    } & FeedItemContent)
  | ({
      /** Home's top-ranked item. One per page. */
      variant: "lead";
      /** Adds **Watch with summary** — a video can lead too. */
      watchHref?: string;
    } & FeedItemContent)
  | ({
      /** Home's tail: a separator row, not a panel. */
      variant: "row";
      watchHref?: string;
    } & FeedItemContent)
  | ({
      variant: "digest";
      /** Badge label: "This week in your library". */
      label?: React.ReactNode;
      /** 2–5 findings. Rendered with dots — never numbered. */
      keyPoints?: FeedItemKeyPoint[];
      /**
       * Every bookmark the digest was built from — `Digest.sources` from the
       * API, whole and in order.
       *
       * **Required, and the variant builds its own `Built from` row from it.**
       * The provenance obligation is not the caller's to remember: a digest
       * that cannot name its sources is a digest that does not render, so the
       * only way to construct one is to hand it the list. The row shows the
       * first `DIGEST_SOURCES_SHOWN` and tails the rest as `+n more`, which is
       * a display decision taken over a complete list — nothing here truncates
       * what the digest was built from.
       */
      sources: DigestSourceLink[];
    } & Omit<FeedItemContent, "provenance">)
  | ({
      variant: "pending";
      /** One line per surfaced phase. Required: that is the whole variant. */
      steps: ProcessingStep[];
      onRetry?: (phase: ProcessingPhase) => void;
    } & Omit<FeedItemContent, "steps" | "onRetry">);

const MAX_TAGS = 3;

const PANEL = "rounded-md border border-line bg-bg-panel p-4";

/** foundations.md § Typography: title-1 (29px), title-2 (20px), title-3 (17px). */
const TITLE_SIZE = {
  1: "text-[36px] leading-[1.12] tracking-[-.022em] [text-wrap:balance]",
  2: "text-xl leading-[1.3] tracking-[-.01em]",
  3: "text-[19px] leading-[1.3] tracking-[-.008em]",
} as const;

function Title({
  href,
  title,
  privateLink,
  size = 2,
  className,
}: {
  href: string;
  title: string;
  privateLink?: boolean;
  size?: keyof typeof TITLE_SIZE;
  className?: string;
}) {
  // The lead is the page's headline; everything else is an item within it.
  const Heading = size === 1 ? "h2" : "h3";
  return (
    <Heading className={cn("m-0 min-w-0", className)}>
      <Link
        href={href}
        className={cn(
          "flex items-start gap-2 rounded-xs",
          "font-serif font-semibold text-fg",
          TITLE_SIZE[size],
          "hover:underline hover:decoration-line-strong hover:underline-offset-[3px]",
          focusRing,
        )}
      >
        {privateLink ? (
          <Lock
            aria-hidden="true"
            className={cn(
              "shrink-0 text-fg-tertiary [stroke-width:1.7]",
              size === 1 ? "mt-2.5 size-5" : size === 3 ? "mt-1 size-3.5" : "mt-1.5 size-4",
            )}
          />
        ) : null}
        <span className={size === 1 ? "line-clamp-3" : "line-clamp-2"}>{title}</span>
      </Link>
    </Heading>
  );
}

function Tags({
  tags,
  readingTime,
  max = MAX_TAGS,
}: {
  tags?: string[];
  readingTime?: string;
  max?: number;
}) {
  const shown = tags?.slice(0, max) ?? [];
  const overflow = (tags?.length ?? 0) - shown.length;
  if (shown.length === 0 && overflow <= 0 && !readingTime) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
      {overflow > 0 ? <Tag variant="neutral">{`+${overflow}`}</Tag> : null}
      {readingTime ? (
        <span className="nums pl-1 font-sans text-[12.5px] leading-none text-fg-tertiary">
          {`${readingTime} read`}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The item's last line: the social actions on the left, the topics and
 * reading time on the right. One line where there used to be three.
 */
function Footer({
  actions,
  tags,
  readingTime,
  maxTags,
}: {
  actions?: React.ReactNode;
  tags?: string[];
  readingTime?: string;
  maxTags?: number;
}) {
  const hasMeta = Boolean(tags?.length || readingTime);
  if (!actions && !hasMeta) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {actions ?? <span />}
      {hasMeta ? <Tags tags={tags} readingTime={readingTime} max={maxTags} /> : null}
    </div>
  );
}

function TopRow({
  provenance,
  menu,
  rankingReason,
  className,
}: {
  provenance: ProvenanceRowProps;
  menu?: React.ReactNode;
  /** "Why this appeared" rides on the provenance line; open, it takes a line of its own. */
  rankingReason?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <ProvenanceRow {...provenance} />
      {rankingReason ? (
        <>
          <span aria-hidden="true" className="text-[12.5px] leading-none text-fg-tertiary">
            ·
          </span>
          <WhyThisAppeared
            reason={rankingReason}
            className="open:order-last open:basis-full"
          />
        </>
      ) : null}
      {menu ? <span className="-my-1 ml-auto shrink-0">{menu}</span> : null}
    </div>
  );
}

function FeedItem(props: FeedItemProps) {
  const variant = props.variant ?? "article";

  // ---- digest ------------------------------------------------------------
  // The panel border and padding are dropped; the AI callout *is* the frame.
  if (variant === "digest") {
    const { href, title, sources, menu, summary, keyPoints, label, social, className } =
      props as Extract<FeedItemProps, { variant: "digest" }>;

    // The provenance row is built here, from the sources, rather than accepted
    // as a prop. "Built from" is not a caption a caller chooses — it is the
    // obligation every AI output in this product carries, and the only way to
    // render a digest is to have handed over what it was built from.
    const shown = sources.slice(0, DIGEST_SOURCES_SHOWN);
    const overflow = sources.length - shown.length;

    return (
      <article className={cn("mb-3 last:mb-0", className)}>
        <AiCallout
          label={label ?? "This week in your library"}
          action={menu}
          footer={
            <div className="flex flex-col gap-3">
              <ProvenanceRow
                lead="Built from"
                sources={shown.map((source) => ({
                  domain: source.domain,
                  faviconUrl: source.faviconUrl,
                  href: source.href,
                }))}
                moreCount={overflow > 0 ? overflow : undefined}
              />
              {social ? <ActionRow saveLabel="Save digest" {...social} /> : null}
            </div>
          }
        >
          <Title href={href} title={title} className="mb-2" />
          {summary ? (
            <p className="m-0 font-sans text-sm leading-[1.6] text-fg-secondary">
              {summary}
            </p>
          ) : null}
          {keyPoints && keyPoints.length > 0 ? (
            <AiKeyPoints className="mt-3">
              {keyPoints.map((point, index) => (
                <AiKeyPoint key={index} term={point.term}>
                  {point.text}
                </AiKeyPoint>
              ))}
            </AiKeyPoints>
          ) : null}
        </AiCallout>
      </article>
    );
  }

  // ---- pending -----------------------------------------------------------
  // Appears the instant a link is saved: a real row, with staged progress
  // where the summary will be and a skeleton in the thumbnail's exact box.
  if (variant === "pending") {
    const { href, title, provenance, menu, steps, onRetry, thumbnailUrl, className } =
      props as Extract<FeedItemProps, { variant: "pending" }>;

    return (
      <article className={cn(PANEL, "mb-3 last:mb-0", className)}>
        <TopRow provenance={provenance} menu={menu} />
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Title href={href} title={title} />
            <ProcessingSteps
              className="mt-0.5"
              steps={steps}
              onRetry={onRetry}
              announceLabel={title}
            />
          </div>
          {thumbnailUrl ? (
            <Thumbnail src={thumbnailUrl} className="h-[88px] w-[132px] rounded-md" />
          ) : (
            <Skeleton
              shape="thumb"
              className="h-[88px] w-[132px] shrink-0 rounded-md"
            />
          )}
        </div>
      </article>
    );
  }

  // ---- lead & row --------------------------------------------------------
  if (variant === "lead" || variant === "row") {
    return <EditionItem {...(props as EditionItemProps)} />;
  }

  // ---- article & video ---------------------------------------------------
  const {
    href,
    title,
    provenance,
    menu,
    summary,
    tags,
    readingTime,
    rankingReason,
    thumbnailUrl,
    social,
    privateLink,
    steps,
    onRetry,
    className,
  } = props as FeedItemContent;

  const isVideo = variant === "video";
  const video = isVideo
    ? (props as Extract<FeedItemProps, { variant: "video" }>)
    : null;

  const body = (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Title href={href} title={title} privateLink={privateLink} />

      {privateLink ? (
        <PrivateLinkNote />
      ) : summary ? (
        <p className="m-0 line-clamp-3 font-sans text-sm leading-[1.6] text-fg-secondary">
          {summary}
        </p>
      ) : null}

      {/* A failed phase goes where the brief would have been — the item stays
          usable, and the original link always opens. */}
      {steps && steps.length > 0 ? (
        <ProcessingSteps steps={steps} onRetry={onRetry} announceLabel={title} />
      ) : null}

      <Footer
        actions={
          social ? <ActionRow {...social} itemTitle={social.itemTitle ?? title} /> : undefined
        }
        tags={tags}
        readingTime={readingTime}
      />

      {video && (video.watchHref || video.onWatchWithSummary) ? (
        <div className="mt-0.5 flex justify-start">
          {video.watchHref ? (
            <Button size="sm" asChild>
              <Link href={video.watchHref}>Watch with summary</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              type="button"
              onClick={video.onWatchWithSummary}
              icon={<Play aria-hidden="true" className="fill-current" />}
            >
              Watch with summary
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <article className={cn(PANEL, "mb-3 last:mb-0", className)}>
      <TopRow provenance={provenance} menu={menu} rankingReason={rankingReason} />

      {isVideo ? (
        <>
          {/* Media leads for video, and only for video. */}
          <Thumbnail
            src={thumbnailUrl}
            badge={video?.duration}
            className="mb-3 h-[210px] w-full rounded-md"
          />
          {body}
        </>
      ) : (
        <div className="flex items-start gap-4">
          {body}
          <Thumbnail
            src={thumbnailUrl}
            className="h-[88px] w-[132px] rounded-md max-[900px]:h-[70px] max-[900px]:w-24"
          />
        </div>
      )}
    </article>
  );
}
FeedItem.displayName = "FeedItem";

type EditionItemProps = Extract<FeedItemProps, { variant: "lead" | "row" }>;

/**
 * `lead` and `row` — the morning edition's two scales of the same item.
 *
 * `lead`: no panel. The image leads at full width × 300 *when there is one* —
 * a 300px placeholder wash would be decoration, and thumbnails are evidence,
 * not ornament (decisions.md #9). Then provenance, a title-1 title, the
 * summary at 15px within 62ch, tags, why, and the action row.
 *
 * `row`: a separator row on Home's tail — title-3, a two-line summary in
 * body-sm, and an 88×64 thumbnail that always holds its box so the list stays
 * scannable.
 */
function EditionItem(props: EditionItemProps) {
  const {
    variant,
    href,
    title,
    provenance,
    menu,
    summary,
    tags,
    readingTime,
    rankingReason,
    thumbnailUrl,
    social,
    privateLink,
    steps,
    onRetry,
    watchHref,
    className,
  } = props;

  const lead = variant === "lead";

  const actionRow =
    social || watchHref ? (
      <div className="flex flex-wrap items-center gap-3">
        {social ? (
          <ActionRow {...social} itemTitle={social.itemTitle ?? title} />
        ) : null}
        {watchHref ? (
          <Button size="sm" asChild>
            <Link href={watchHref}>Watch with summary</Link>
          </Button>
        ) : null}
      </div>
    ) : undefined;

  const footer = (
    <Footer
      actions={actionRow}
      tags={tags}
      readingTime={readingTime}
      maxTags={lead ? MAX_TAGS : 2}
    />
  );

  const brief = privateLink ? (
    <PrivateLinkNote />
  ) : summary ? (
    <p
      className={cn(
        "m-0 font-sans text-fg-secondary [text-wrap:pretty]",
        lead
          ? "line-clamp-4 max-w-[62ch] text-[15px] leading-[1.65]"
          : "line-clamp-2 text-[13.5px] leading-[1.55]",
      )}
    >
      {summary}
    </p>
  ) : null;

  const progress =
    steps && steps.length > 0 ? (
      <ProcessingSteps steps={steps} onRetry={onRetry} announceLabel={title} />
    ) : null;

  if (lead) {
    return (
      <article className={cn("flex flex-col gap-3.5", className)}>
        {thumbnailUrl ? (
          <Thumbnail
            src={thumbnailUrl}
            className="h-[300px] w-full rounded-md max-[640px]:h-[180px]"
          />
        ) : null}
        <TopRow
          provenance={provenance}
          menu={menu}
          rankingReason={rankingReason}
          className="mb-0"
        />
        <Title
          href={href}
          title={title}
          privateLink={privateLink}
          size={1}
          className="max-[640px]:[&_a]:text-[28px]"
        />
        {brief}
        {progress}
        <div className="pt-1">{footer}</div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "-mx-3 flex items-start gap-4 border-b border-line px-3 py-5",
        "transition-colors duration-cd-fast ease-cd hover:bg-bg-subtle",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <TopRow
          provenance={provenance}
          menu={menu}
          rankingReason={rankingReason}
          className="mb-0"
        />
        <div className="flex items-start gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Title href={href} title={title} privateLink={privateLink} size={3} />
            {brief}
            {progress}
          </div>
          <Thumbnail
            src={thumbnailUrl}
            className="h-[72px] w-[108px] rounded-md max-[640px]:hidden"
          />
        </div>
        {footer}
      </div>
    </article>
  );
}

/**
 * The tail's loading row — the `row` variant's geometry, so the skeleton
 * sentinel that triggers the next page sits exactly where a row will land.
 */
function FeedRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-4 border-b border-line py-4", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-xs" />
          <Skeleton shape="line" className="h-3 w-40" />
        </div>
        <Skeleton className="h-[17px] w-[64%] rounded-xs" />
        <Skeleton shape="line" className="w-[92%]" />
        <Skeleton shape="line" className="w-[70%]" />
      </div>
      <Skeleton shape="thumb" className="mt-8 h-16 w-[88px] shrink-0 rounded-md max-[640px]:hidden" />
    </div>
  );
}

/** The lead's loading shape: image box, provenance, a two-line headline. */
function FeedLeadSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <Skeleton shape="thumb" className="h-[300px] w-full rounded-md max-[640px]:h-[180px]" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-xs" />
        <Skeleton shape="line" className="h-3 w-48" />
      </div>
      <Skeleton className="h-7 w-[86%] rounded-xs" />
      <Skeleton className="h-7 w-[52%] rounded-xs" />
      <Skeleton shape="line" className="w-[90%]" />
      <Skeleton shape="line" className="w-[76%]" />
    </div>
  );
}

/**
 * The loading item. Mirrors the article variant's geometry — provenance line,
 * 20px title, three summary lines, tag row, 132×88 thumbnail — so nothing
 * reflows when the real item lands.
 */
function FeedItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(PANEL, "mb-3 last:mb-0", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <Skeleton className="size-4 rounded-xs" />
        <Skeleton shape="line" className="h-3 w-40" />
      </div>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-[72%] rounded-xs" />
          <Skeleton shape="line" className="w-[94%]" />
          <Skeleton shape="line" className="w-[88%]" />
          <Skeleton shape="line" className="w-[56%]" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-[22px] w-24 rounded-pill" />
            <Skeleton className="h-[22px] w-20 rounded-pill" />
            <Skeleton className="h-[22px] w-16 rounded-pill" />
          </div>
        </div>
        <Skeleton shape="thumb" className="h-[88px] w-[132px] shrink-0 rounded-md" />
      </div>
    </div>
  );
}

export { FeedItem, FeedItemSkeleton, FeedLeadSkeleton, FeedRowSkeleton };
