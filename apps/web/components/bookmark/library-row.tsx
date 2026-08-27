import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, Folder, Lock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tag } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/focus-ring";
import { PrivateLinkNote } from "@/components/bookmark/private-link-note";
import { Thumbnail } from "@/components/bookmark/thumbnail";

/**
 * Library row — see docs/design-system/patterns.md#library-row.
 *
 * Separator rows, not cards: a hairline between siblings, 16px of vertical
 * padding, `--cd-bg-subtle` on hover.
 *
 * This surface is private, so it carries **no social counts** and no action
 * row. Putting one here would leak the fact that the Library is a feed, which
 * it is not.
 *
 *   unread dot · collection breadcrumb · title · summary ·
 *   tags + (domain · relative time · reading time) · 88×64 thumbnail
 *
 * The unread dot is 6px of `--cd-accent`, and a transparent spacer of the same
 * size when the row is read, so every title in the list stays on one left
 * edge. It is never a badge.
 *
 * The breadcrumb comes from `collectionPath` and is clickable at every level.
 * While the pipeline is still filing it reads `Inbox` followed by an AI
 * *filing…* marker — a suggestion in progress, never a move that already
 * happened.
 */
export interface LibraryRowCollection {
  id: string;
  name: string;
  /** Filtered Library route for this level. Without it the crumb is text. */
  href?: string;
}

export interface LibraryRowProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Detail route — `/bookmarks/{id}`. */
  href: string;
  title: string;
  /** `cosmicBriefSummary`, falling back to `metadata.openGraph.description`. */
  summary?: string | null;

  /** `collectionPath`, root first. Empty or absent renders as Inbox. */
  collectionPath?: LibraryRowCollection[];
  /** The `file` phase is still in flight: Inbox plus a *filing…* marker. */
  filing?: boolean;

  unread?: boolean;
  /** `cosmicTags`. Trimmed to three, with `+n` for the rest. */
  tags?: string[];

  /** Bare domain for the meta line. */
  domain?: string;
  /** Already-formatted relative time: "2d ago". */
  savedAt?: string;
  /** Already-formatted reading time: "9 min". */
  readingTime?: string;

  /** `metadata.openGraph.image`. */
  thumbnailUrl?: string | null;

  /** `isPrivateLink` — a lock by the title and a warning note in place of the summary. */
  privateLink?: boolean;
  /** The summary has not landed yet: skeleton lines in its place. */
  summaryLoading?: boolean;

  /** Trailing controls — a read toggle, an overflow menu. */
  actions?: React.ReactNode;
}

const MAX_TAGS = 3;

function Breadcrumb({
  collectionPath,
  filing,
}: Pick<LibraryRowProps, "collectionPath" | "filing">) {
  const path = collectionPath ?? [];
  const inbox = path.length === 0;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 font-sans text-xs leading-[1.4] text-fg-tertiary">
      <Folder aria-hidden="true" className="size-3 shrink-0 [stroke-width:1.7]" />
      {inbox ? (
        <span>Inbox</span>
      ) : (
        path.map((collection, index) => {
          const last = index === path.length - 1;
          const label = (
            <span className={cn("truncate", last && "font-medium text-fg-secondary")}>
              {collection.name}
            </span>
          );
          return (
            <React.Fragment key={collection.id}>
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3 shrink-0 [stroke-width:1.7]"
                />
              ) : null}
              {collection.href ? (
                <Link
                  href={collection.href}
                  className={cn(
                    "min-w-0 rounded-xs transition-colors duration-cd-fast ease-cd hover:text-fg",
                    focusRing,
                  )}
                >
                  {label}
                </Link>
              ) : (
                label
              )}
            </React.Fragment>
          );
        })
      )}
      {filing ? (
        <span className="ml-1 inline-flex items-center gap-1 font-semibold uppercase tracking-[.08em] text-ai opacity-85 text-[10.5px]">
          <Sparkles aria-hidden="true" className="size-2.5 shrink-0 fill-current" />
          filing…
        </span>
      ) : null}
    </div>
  );
}

const LibraryRow = React.forwardRef<HTMLElement, LibraryRowProps>(
  (
    {
      className,
      href,
      title,
      summary,
      collectionPath,
      filing = false,
      unread = false,
      tags,
      domain,
      savedAt,
      readingTime,
      thumbnailUrl,
      privateLink = false,
      summaryLoading = false,
      actions,
      ...props
    },
    ref,
  ) => {
    const shownTags = tags?.slice(0, MAX_TAGS) ?? [];
    const overflow = (tags?.length ?? 0) - shownTags.length;
    const meta = [domain, savedAt, readingTime].filter(Boolean).join(" · ");

    return (
      <article
        ref={ref}
        className={cn(
          "flex gap-4 border-b border-line py-4 last:border-b-0",
          "transition-colors duration-cd-fast ease-cd hover:bg-bg-subtle",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-[9px] size-1.5 shrink-0 rounded-pill",
            unread ? "bg-accent" : "bg-transparent",
          )}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Breadcrumb collectionPath={collectionPath} filing={filing} />

          <h3 className="m-0 min-w-0">
            <Link
              href={href}
              className={cn(
                "flex items-start gap-1.5 rounded-xs",
                "font-serif text-[17px] font-semibold leading-[1.35] text-fg",
                "hover:underline hover:decoration-line-strong hover:underline-offset-[3px]",
                focusRing,
              )}
            >
              {unread ? <span className="sr-only">Unread. </span> : null}
              {privateLink ? (
                <Lock
                  aria-hidden="true"
                  className="mt-1 size-3.5 shrink-0 text-fg-tertiary [stroke-width:1.7]"
                />
              ) : null}
              <span className="line-clamp-2">{title}</span>
            </Link>
          </h3>

          {privateLink ? (
            <PrivateLinkNote className="mt-0.5" />
          ) : summaryLoading ? (
            <div className="flex max-w-[420px] flex-col gap-2 py-1">
              <Skeleton shape="line" className="w-[88%]" />
              <Skeleton shape="line" className="w-[52%]" />
            </div>
          ) : summary ? (
            <p className="m-0 line-clamp-2 font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
              {summary}
            </p>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {unread ? null : (
              <Tag variant="neutral">
                <Check aria-hidden="true" className="size-3 [stroke-width:2.2]" />
                Read
              </Tag>
            )}
            {shownTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {overflow > 0 ? <Tag variant="neutral">{`+${overflow}`}</Tag> : null}
            {meta ? (
              <span className="ml-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
                {meta}
              </span>
            ) : null}
            {actions ? <span className="ml-auto">{actions}</span> : null}
          </div>
        </div>

        {summaryLoading && !thumbnailUrl ? (
          <Skeleton shape="thumb" className="h-16 w-[88px] shrink-0 rounded-sm" />
        ) : (
          <Thumbnail
            src={thumbnailUrl}
            className="h-16 w-[88px] rounded-sm"
          />
        )}
      </article>
    );
  },
);
LibraryRow.displayName = "LibraryRow";

/**
 * The list container. Carries the top hairline so the first row has a line
 * above it and the last one does not have a stray line below.
 */
const LibraryList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("border-t border-line", className)} {...props} />
));
LibraryList.displayName = "LibraryList";

/**
 * The loading row. Mirrors the real row's geometry exactly — same dot spacer,
 * same 17px title, same two summary lines, same 88×64 thumbnail — so nothing
 * moves when the content lands.
 */
const LibraryRowSkeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex gap-4 border-b border-line py-4 last:border-b-0", className)}
    {...props}
  >
    <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0" />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Skeleton shape="line" className="h-3 w-[120px]" />
      <Skeleton shape="title" className="my-[3px]" />
      <Skeleton shape="line" className="w-[92%]" />
      <Skeleton shape="line" className="w-[64%]" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-[22px] w-16 rounded-pill" />
        <Skeleton className="h-[22px] w-20 rounded-pill" />
      </div>
    </div>
    <Skeleton shape="thumb" className="h-16 w-[88px] shrink-0 rounded-sm" />
  </div>
));
LibraryRowSkeleton.displayName = "LibraryRowSkeleton";

export { LibraryRow, LibraryList, LibraryRowSkeleton };
