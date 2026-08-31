"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentDrawer } from "@/components/social/comment-drawer";
import { useReshare } from "@/components/social/use-reshare";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { ExploreClientAPI } from "@/lib/api/explore-client";
import { FeedItem, FeedItemSkeleton } from "@/components/feed/feed-item";
import {
  FeedBookmarkEntry,
  FeedEntry,
  dedupeEntries,
  toFeedEntries,
} from "@/components/feed/feed-data";

import { ExploreRail, ExploreRailProps, ExploreRailSkeleton } from "./explore-rail";
import { ExploreTopicOption, exploreHref, ALL_TOPICS } from "./explore-data";

/**
 * Explore — docs/design-system/pages.md § Explore.
 *
 * The same two-column geometry as Home, because it is the same kind of page:
 * `minmax(0,1fr) 268px`, 32px gap, the column capped at 680px, and the rail
 * gone entirely below 900px.
 *
 * What is deliberately **not** here, and each absence is a decision:
 *
 *  - **No feedback menu.** "Not interested", "Fewer from this domain" and
 *    "Mute topic" are inputs to the personal ranker. Explore is not ranked
 *    personally, so a menu item that claimed to tune it would be a control
 *    wired to nothing.
 *  - **No "Updated n min ago".** Home's meta line reports the age of a cached
 *    personal ranking. Explore recomputes per request and has no session to
 *    report the age of; a timestamp there would be describing the clock, not
 *    the content.
 *  - **No hero for a new user.** A reader with no saves is not what makes
 *    Explore empty — a young social graph is. The empty state says that.
 */
export interface ExploreViewProps {
  topic: string;
  topics: ExploreTopicOption[];
  entries: FeedEntry[];
  nextCursor?: string;
  rail: ExploreRailProps;
  /** Set when the request did not complete. Distinct from an empty graph. */
  error?: string;
}

const PAGE_SIZE = 20;

export function ExploreView({
  topic,
  topics,
  entries: initialEntries,
  nextCursor: initialCursor,
  rail,
  error,
}: ExploreViewProps) {
  const router = useRouter();

  const [entries, setEntries] = React.useState<FeedEntry[]>(initialEntries);
  const [cursor, setCursor] = React.useState<string | undefined>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | undefined>(error);
  const [commentsFor, setCommentsFor] = React.useState<FeedBookmarkEntry | null>(
    null
  );

  // The server render and the first client render must agree, so the initial
  // props are the only source of truth until something is actually clicked.
  React.useEffect(() => {
    setEntries(initialEntries);
    setCursor(initialCursor);
    setPageError(error);
  }, [initialEntries, initialCursor, error]);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const loadMore = React.useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await ExploreClientAPI.page({
        topic: topic === ALL_TOPICS ? undefined : topic,
        cursor,
        limit: PAGE_SIZE,
      });
      const next = toFeedEntries(page.items ?? []);
      setEntries((current) => dedupeEntries([...current, ...next]));
      setCursor(page.nextCursor);
      setPageError(undefined);
    } catch {
      setPageError("The next page didn't arrive.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, topic]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;

    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <>
      <div className="flex justify-center gap-8 py-6">
        <div className="flex min-w-0 max-w-[680px] flex-1 flex-col gap-4">
          <ExploreTopics
            topic={topic}
            topics={topics}
            onSelect={(next) => router.push(exploreHref(next))}
          />

          {pageError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-bg-panel p-4"
            >
              <p className="m-0 font-sans text-[13.5px] leading-[1.5] text-fg-secondary">
                {pageError}
              </p>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setPageError(undefined);
                  router.refresh();
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {entries.length === 0 && !pageError ? (
            <ExploreEmpty topic={topic} />
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) =>
                entry.kind === "bookmark" ? (
                  <ExploreRow
                    key={entry.key}
                    entry={entry}
                    onComment={() => setCommentsFor(entry)}
                  />
                ) : null
              )}
            </div>
          )}

          {cursor ? (
            <div ref={sentinelRef} aria-hidden="true">
              <FeedItemSkeleton />
            </div>
          ) : null}
        </div>

        <ExploreRail {...rail} />
      </div>

      <CommentDrawer
        bookmarkId={commentsFor?.bookmarkId ?? ""}
        title={commentsFor?.title}
        commentCount={commentsFor?.commentCount ?? 0}
        open={commentsFor !== null}
        onOpenChange={(open) => {
          if (!open) setCommentsFor(null);
        }}
      />
    </>
  );
}

/**
 * The topic control.
 *
 * `components.md` puts the ceiling for a segmented control at four options,
 * and pages.md asks for a segmented control here — so this shows **All plus
 * the four leading topics**, not every tag in the window. The rest are
 * reachable through search, which is where an arbitrary tag has always been a
 * query. A currently-selected topic outside the leading four is appended
 * rather than dropped: a control that cannot show its own selection is worse
 * than a fifth segment.
 */
function ExploreTopics({
  topic,
  topics,
  onSelect,
}: {
  topic: string;
  topics: ExploreTopicOption[];
  onSelect: (topic: string) => void;
}) {
  const shown = React.useMemo(() => {
    const leading = topics.slice(0, 4);
    if (topic !== ALL_TOPICS && !leading.some((row) => row.topic === topic)) {
      const selected = topics.find((row) => row.topic === topic);
      leading.push(selected ?? { topic, count: 0 });
    }
    return leading;
  }, [topics, topic]);

  if (shown.length === 0) return null;

  return (
    <Segmented value={topic} onValueChange={onSelect} aria-label="Topic">
      <SegmentedItem value={ALL_TOPICS}>Everything</SegmentedItem>
      {shown.map((row) => (
        <SegmentedItem key={row.topic} value={row.topic}>
          {row.topic}
        </SegmentedItem>
      ))}
    </Segmented>
  );
}

/**
 * The honest empty state.
 *
 * It names the actual emptiness rather than the general absence of things: an
 * unpopulated social graph, or one topic with nothing behind it. Neither copy
 * pretends the reader did something wrong, because they did not — nobody has
 * published yet.
 */
function ExploreEmpty({ topic }: { topic: string }) {
  if (topic !== ALL_TOPICS) {
    return (
      <EmptyState
        ground
        icon={Compass}
        title={`Nothing public tagged “${topic}” yet.`}
        description="Explore only shows saves people have made public. Try another topic, or come back when more has been shared."
      />
    );
  }

  return (
    <EmptyState
      ground
      icon={Compass}
      title="Nobody has shared anything publicly yet."
      description="Explore fills up as people make saves public. Until then there is genuinely nothing here — your own library is on Home and in Library."
    />
  );
}

/**
 * One row, with its reshare bound.
 *
 * Its own component because `useReshare` is a hook and one row's save state is
 * not another's — hoisting it into the list would give twenty items one shared
 * "Saved".
 */
function ExploreRow({
  entry,
  onComment,
}: {
  entry: FeedBookmarkEntry;
  onComment: () => void;
}) {
  const reshare = useReshare({
    bookmarkId: entry.bookmarkId,
    saved: entry.saved,
  });

  const provenance = {
    actor: entry.actor
      ? {
          name: entry.actor.name,
          avatarUrl: entry.actor.avatarUrl,
          href: entry.actor.href,
        }
      : undefined,
    sources: entry.domain
      ? [{ domain: entry.domain, faviconUrl: entry.faviconUrl }]
      : undefined,
    action: entry.action,
    timestamp: entry.savedAt,
  };

  const social = {
    likeCount: entry.likeCount,
    liked: entry.liked,
    onLikeChange: (next: boolean) => {
      const call = next
        ? BookmarksClientAPI.like(entry.bookmarkId)
        : BookmarksClientAPI.unlike(entry.bookmarkId);
      void call.catch(() => undefined);
    },
    commentCount: entry.commentCount,
    onComment,
    shareUrl: entry.shareUrl,
    itemTitle: entry.title,
    saved: entry.own || reshare.saved,
    onSaveChange: entry.own ? undefined : reshare.onSaveChange,
    saveOnce: true,
    savedLabel: entry.own ? "In your library" : "Saved",
  };

  return (
    <FeedItem
      variant={entry.variant === "video" ? "video" : "article"}
      href={entry.href}
      title={entry.title}
      provenance={provenance}
      summary={entry.summary}
      tags={entry.tags}
      readingTime={entry.readingTime}
      rankingReason={entry.rankingReason}
      thumbnailUrl={entry.thumbnailUrl}
      privateLink={entry.privateLink}
      social={social}
    />
  );
}

/** The loading shape: the control's geometry, three items, and a live rail. */
export function ExploreFallback() {
  return (
    <div className="flex justify-center gap-8 py-6">
      <div className={cn("flex min-w-0 max-w-[680px] flex-1 flex-col gap-4")}>
        <Skeleton className="h-[38px] w-[280px] rounded-pill" />
        <div className="flex flex-col gap-3">
          <FeedItemSkeleton />
          <FeedItemSkeleton />
          <FeedItemSkeleton />
        </div>
      </div>
      <ExploreRailSkeleton />
    </div>
  );
}
