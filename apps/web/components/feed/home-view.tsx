"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Inbox, MoreHorizontal, VolumeX, WifiOff } from "lucide-react";
import { FeedScope } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { focusRing } from "@/components/ui/focus-ring";
import { useToast } from "@/components/ui/toast";
import { useCaptureToast } from "@/components/bookmark/capture-toast";
import { CommentDrawer } from "@/components/social/comment-drawer";
import { useReshare } from "@/components/social/use-reshare";
import { isCaptureUrl } from "@/lib/capture";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { FeedClientAPI } from "@/lib/api/feed-client";
import { useAppDispatch } from "@/lib/store/hooks";
import { saveCapture } from "@/lib/store/slices/bookmarksSlice";

import { FeedItem, FeedItemSkeleton } from "./feed-item";
import {
  FEED_SCOPES,
  FeedBookmarkEntry,
  FeedEntry,
  dedupeEntries,
  feedEmptyCopy,
  feedHref,
  formatUpdatedAt,
  toFeedEntries,
} from "./feed-data";
import { HomeRail, HomeRailProps, HomeRailSkeleton } from "./home-rail";

/**
 * Home — `/my/dashboard`, docs/design-system/pages.md § Home.
 *
 * The page is a two-column grid: `minmax(0,1fr) 268px` with a 32px gap and
 * 24px of page padding, the feed column capped at 680px, and **the rail gone
 * entirely below 900px**. That last one is a promise as well as a breakpoint —
 * nothing in the rail is unique, so a narrow window costs the reader a
 * shortcut and never a destination.
 *
 * Three things in here exist because of the hydration trap, and all three
 * would be invisible if they were wrong: the page would screenshot perfectly
 * and every control on it would be dead.
 *
 *  - **"Updated n min ago"** is the difference between two clocks, one of
 *    which does not exist during the server pass. It renders only after mount.
 *  - **The offline strip** reads `navigator.onLine`, which the server cannot
 *    know. Same guard.
 *  - **Relative times on the rows** are formatted on the server, once, in
 *    `feed-data.ts`, and carried through as strings.
 */

const PAGE_SIZE = 20;

export interface HomeViewProps {
  scope: FeedScope;
  entries: FeedEntry[];
  nextCursor?: string;
  /** When the ranking was computed. Drives the meta line. */
  computedAt: Date;
  /** The feed request failed. An inline panel — never instead of the page. */
  error?: string;
  /**
   * The reader has no saves at all. Distinct from an empty scope: one is a
   * person who has not started, the other is a filter with nothing behind it,
   * and the same "nothing here" would be wrong for both.
   */
  newUser: boolean;
  rail: HomeRailProps;
  /** Suppresses every network call — the states gallery and the tests. */
  offline?: boolean;
  /**
   * Forces the offline strip on.
   *
   * The real condition is `navigator.onLine`, which a developer with a working
   * connection cannot reach and which no fixture can set. Without this the
   * offline state would be the one state in the gallery that is described
   * rather than shown — and the states nobody can see are exactly the ones
   * that rot.
   */
  forceOffline?: boolean;
}

/* ---------------------------------------------------------------------------
   Layout
   --------------------------------------------------------------------------- */

/**
 * The grid, in one place so the fallback and the view cannot drift.
 *
 * `min-[900px]` rather than a Tailwind screen: 900 is where 680 + 32 + 268
 * stops fitting, which is a fact about this page and not about the breakpoint
 * scale.
 */
const HOME_GRID =
  "grid grid-cols-1 gap-8 py-6 min-[900px]:grid-cols-[minmax(0,1fr)_268px]";

/** 680px, per the spec. The column is centred in whatever space it gets. */
const FEED_COLUMN = "flex min-w-0 max-w-[680px] flex-col";

/* ---------------------------------------------------------------------------
   The scope control and its meta line
   --------------------------------------------------------------------------- */

function ScopeBar({
  scope,
  onScopeChange,
  meta,
}: {
  scope: FeedScope;
  onScopeChange?: (scope: FeedScope) => void;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-4">
      <Segmented
        aria-label="Feed scope"
        value={scope}
        onValueChange={(value) => onScopeChange?.(value as FeedScope)}
      >
        {FEED_SCOPES.map((option) => (
          <SegmentedItem key={option.value} value={option.value}>
            {option.label}
          </SegmentedItem>
        ))}
      </Segmented>
      {/*
        Reserves its line whether or not it has text yet. The meta appears one
        paint after hydration, and a line that grows into existence would push
        the first feed item down under the reader's cursor.
      */}
      <p
        className="m-0 min-h-4 font-sans text-[12.5px] leading-[1.4] text-fg-tertiary"
        aria-live="off"
      >
        {meta}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   The overflow menu — the feedback surface
   --------------------------------------------------------------------------- */

function FeedbackMenu({
  entry,
  onNotInterested,
  onFewerFromDomain,
  onMuteTopic,
}: {
  entry: FeedBookmarkEntry;
  onNotInterested: () => void;
  onFewerFromDomain: () => void;
  onMuteTopic: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`More actions for ${entry.title}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onNotInterested}>
          <Ban aria-hidden="true" />
          Not interested
        </DropdownMenuItem>
        {entry.domain ? (
          <DropdownMenuItem onSelect={onFewerFromDomain}>
            <Ban aria-hidden="true" />
            Fewer from {entry.domain}
          </DropdownMenuItem>
        ) : null}
        {entry.muteTopic ? (
          <DropdownMenuItem onSelect={onMuteTopic}>
            <VolumeX aria-hidden="true" />
            Mute “{entry.muteTopic}”
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------------------------------
   One row
   --------------------------------------------------------------------------- */

/**
 * A bookmark row, with its reshare bound.
 *
 * Its own component because `useReshare` is a hook and one row's save state is
 * not another's — a single hook hoisted into the list would give twenty items
 * one shared "Saved".
 */
function BookmarkRow({
  entry,
  offline,
  onComment,
  menu,
}: {
  entry: FeedBookmarkEntry;
  offline: boolean;
  onComment: () => void;
  menu: React.ReactNode;
}) {
  const reshare = useReshare({
    bookmarkId: entry.bookmarkId,
    saved: entry.saved,
    offline,
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

  if (entry.variant === "pending") {
    return (
      <FeedItem
        variant="pending"
        href={entry.href}
        title={entry.title}
        provenance={provenance}
        menu={menu}
        thumbnailUrl={entry.thumbnailUrl}
        steps={entry.steps}
      />
    );
  }

  const social = {
    likeCount: entry.likeCount,
    liked: entry.liked,
    onLikeChange: (next: boolean) => {
      if (offline) return;
      const call = next
        ? BookmarksClientAPI.like(entry.bookmarkId)
        : BookmarksClientAPI.unlike(entry.bookmarkId);
      void call.catch(() => undefined);
    },
    commentCount: entry.commentCount,
    // Never a thread inline (decisions.md #18) — the drawer opens over the
    // feed so the next four items stay where the reader left them.
    onComment,
    shareUrl: entry.shareUrl,
    itemTitle: entry.title,
    // The reader's own save is already in their library; there is nothing to
    // reshare and the control says so rather than offering a no-op.
    saved: entry.own || reshare.saved,
    onSaveChange: entry.own ? undefined : reshare.onSaveChange,
    saveOnce: true,
    savedLabel: entry.own ? "In your library" : "Saved",
  };

  if (entry.variant === "video") {
    return (
      <FeedItem
        variant="video"
        href={entry.href}
        title={entry.title}
        provenance={provenance}
        menu={menu}
        summary={entry.summary}
        tags={entry.tags}
        readingTime={entry.readingTime}
        rankingReason={entry.rankingReason}
        thumbnailUrl={entry.thumbnailUrl}
        duration={entry.duration}
        watchHref={entry.href}
        social={social}
      />
    );
  }

  return (
    <FeedItem
      href={entry.href}
      title={entry.title}
      provenance={provenance}
      menu={menu}
      summary={entry.summary}
      tags={entry.tags}
      readingTime={entry.readingTime}
      rankingReason={entry.rankingReason}
      thumbnailUrl={entry.thumbnailUrl}
      privateLink={entry.privateLink}
      // A partially-failed run goes where the brief would have been. The item
      // stays usable and the original link still opens.
      steps={entry.steps}
      social={social}
    />
  );
}

/* ---------------------------------------------------------------------------
   The new-user hero
   --------------------------------------------------------------------------- */

/** The three sources the hero offers. Examples, not endorsements. */
const SUGGESTED_SOURCES = [
  { label: "every.to", url: "https://every.to" },
  { label: "stratechery.com", url: "https://stratechery.com" },
  { label: "arxiv.org", url: "https://arxiv.org" },
];

/**
 * Empty (new user) — a display-size hero whose primary action *is* the URL
 * field, not a button that opens a dialog containing one.
 *
 * The rail is not rendered beside it: there is nothing to continue reading,
 * no topics, and nobody followed, and three empty sections next to "Save your
 * first link" would be a page apologising three times.
 */
function NewUserHero({ offline }: { offline: boolean }) {
  const dispatch = useAppDispatch();
  const announce = useCaptureToast();
  const { toast } = useToast();

  const [url, setUrl] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);

  async function submit(candidate: string) {
    if (!isCaptureUrl(candidate)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);

    if (offline) {
      setUrl("");
      return;
    }

    setUrl("");
    const result = await dispatch(saveCapture({ url: candidate }));
    if (saveCapture.fulfilled.match(result)) {
      announce(result.payload);
      return;
    }
    // The URL goes back in the field. A save that did not happen is a "not
    // yet", and throwing the paste away would make it a "no".
    setUrl(candidate);
    toast({
      title: "Couldn't save that",
      description: "The link is still in the field. Try again.",
      variant: "danger",
    });
  }

  return (
    <div className="flex flex-col items-start gap-5 py-10">
      <div className="flex max-w-[38ch] flex-col gap-2">
        <h1
          className="m-0 font-serif text-[40px] font-semibold leading-[1.1] text-fg"
          style={{ textWrap: "balance" }}
        >
          Save your first link.
        </h1>
        <p className="m-0 font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
          Paste a URL and it is yours in a second — summarised, tagged and
          filed while you carry on. Home fills in as you save.
        </p>
      </div>

      <form
        className="flex w-full max-w-[520px] flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(url);
        }}
      >
        <Input
          shape="pill"
          className="min-w-0 flex-1"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (invalid) setInvalid(false);
          }}
          placeholder="https://"
          aria-label="Link to save"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "home-hero-url-error" : undefined}
          inputMode="url"
          autoComplete="off"
        />
        <Button type="submit" variant="primary">
          Save link
        </Button>
      </form>

      {invalid ? (
        <p
          id="home-hero-url-error"
          className="m-0 font-sans text-[12.5px] leading-[1.4] text-[color:var(--cd-danger)]"
        >
          That doesn&apos;t look like a link. It needs a domain, like
          example.com/article.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-sans text-[12.5px] leading-[1.4] text-fg-tertiary">
          Try one of these
        </span>
        {SUGGESTED_SOURCES.map((source) => (
          <button
            key={source.url}
            type="button"
            onClick={() => setUrl(source.url)}
            className={cn(
              "rounded-pill border border-line bg-bg-subtle px-2.5 py-1",
              "font-sans text-[12px] leading-none text-fg-secondary",
              "transition-colors duration-cd-fast ease-cd hover:bg-bg-inset hover:text-fg",
              focusRing
            )}
          >
            {source.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   The view
   --------------------------------------------------------------------------- */

export function HomeView({
  scope,
  entries: initialEntries,
  nextCursor: initialCursor,
  computedAt,
  error,
  newUser,
  rail,
  offline = false,
  forceOffline = false,
}: HomeViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [entries, setEntries] = React.useState<FeedEntry[]>(initialEntries);
  const [cursor, setCursor] = React.useState<string | undefined>(initialCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | undefined>(error);
  const [commentsFor, setCommentsFor] = React.useState<FeedBookmarkEntry | null>(
    null
  );

  /**
   * The one flag that gates everything the server cannot know.
   *
   * `next-themes`' resolved theme, `navigator.onLine`, and any difference of
   * two clocks all belong behind it. Branching on them during render is what
   * makes React abandon hydration — and a page whose hydration was abandoned
   * looks completely correct and does nothing at all.
   */
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [browserOffline, setBrowserOffline] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setBrowserOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const isOffline = forceOffline || (mounted && browserOffline);

  // Recomputed on a timer as well as on a render, so a tab left open does not
  // keep claiming the ranking is one minute old an hour later.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const updatedLabel = React.useMemo(
    () => (mounted ? formatUpdatedAt(computedAt, new Date()) : ""),
    // `tick` is the dependency that matters; `computedAt` changes on a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, computedAt, tick]
  );

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const loadMore = React.useCallback(async () => {
    if (!cursor || loadingMore || offline || isOffline) return;
    setLoadingMore(true);
    try {
      const page = await FeedClientAPI.page({
        scope,
        cursor,
        limit: PAGE_SIZE,
      });
      const next = toFeedEntries(page.items ?? []);
      setEntries((current) => dedupeEntries([...current, ...next]));
      setCursor(page.nextCursor);
      setPageError(undefined);
    } catch {
      // Inline, under the items that are already on screen. The page the
      // reader has does not go away because the page after it did not arrive.
      setPageError("The next page didn't arrive.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, offline, isOffline, scope]);

  /**
   * Infinite scroll — a skeleton item as the sentinel, and no pagination
   * controls anywhere (docs/functional-spec/05-feed.md § Delivery).
   *
   * The observer watches the skeleton itself rather than a zero-height
   * tripwire, so the thing that triggers the next page is the same thing that
   * tells the reader a page is coming.
   */
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;

    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) void loadMore();
      },
      // A screenful of warning, so the skeleton is usually replaced before it
      // is read rather than after.
      { rootMargin: "600px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  /**
   * Feedback, applied to the list on screen before it is sent.
   *
   * The deliverable's word is *visibly*: the row goes now, and the ranker
   * agrees with the screen on the next request. A failure puts the rows back
   * and says so — a menu that quietly did nothing would be worse than no menu.
   */
  const sendFeedback = React.useCallback(
    async (options: {
      matches: (entry: FeedEntry) => boolean;
      send: () => Promise<unknown>;
      title: string;
    }) => {
      const snapshot = entries;
      const removed = snapshot.filter(options.matches);
      if (removed.length === 0) return;

      setEntries((current) =>
        current.filter((entry) => !options.matches(entry))
      );

      if (offline) {
        toast({ title: options.title });
        return;
      }

      try {
        await options.send();
        toast({ title: options.title });
        // The rail's counts and the next ranking both move; refreshing the
        // route is how the server-rendered half catches up with the click.
        router.refresh();
      } catch {
        setEntries(snapshot);
        toast({
          title: "That didn't reach the ranker",
          description: "Nothing was changed. Try again.",
          variant: "danger",
        });
      }
    },
    [entries, offline, router, toast]
  );

  const notInterested = (entry: FeedBookmarkEntry) =>
    void sendFeedback({
      matches: (candidate) =>
        candidate.kind === "bookmark" &&
        candidate.bookmarkId === entry.bookmarkId,
      send: () => FeedClientAPI.notInterested(entry.bookmarkId),
      title: "You won't see that again",
    });

  const fewerFromDomain = (entry: FeedBookmarkEntry) => {
    const domain = entry.domain;
    if (!domain) return;
    void sendFeedback({
      // Every row from that domain, not only the one the menu was opened on.
      // "Fewer from this domain" that removed one item would be indisputably
      // true and completely useless.
      matches: (candidate) =>
        candidate.kind === "bookmark" && candidate.domain === domain,
      send: () => FeedClientAPI.fewerFromDomain(domain),
      title: `Fewer from ${domain}`,
    });
  };

  const muteTopic = (entry: FeedBookmarkEntry) => {
    const topic = entry.muteTopic;
    if (!topic) return;
    const lowered = topic.toLowerCase();
    void sendFeedback({
      matches: (candidate) =>
        candidate.kind === "bookmark" &&
        candidate.tags.some((tag) => tag.toLowerCase() === lowered),
      send: () => FeedClientAPI.muteTopic(topic),
      title: `Muted “${topic}”`,
    });
  };

  // A reader with no saves at all gets the hero and no rail. An empty *scope*
  // is a different thing and keeps both the control and the rail.
  if (newUser && entries.length === 0 && !pageError) {
    return (
      <div className="px-6 py-6">
        <NewUserHero offline={offline || isOffline} />
      </div>
    );
  }

  return (
    <div className="px-6">
      <div className={HOME_GRID}>
        <section className={FEED_COLUMN}>
          {/*
            The offline strip. Persistent — it is not a toast, because the
            condition does not pass on its own — and it sits above the items
            rather than instead of them: what is on screen was fetched and is
            still readable.
          */}
          {isOffline ? (
            <div
              role="status"
              className={cn(
                "mb-4 flex items-start gap-2 rounded-md border border-line bg-bg-subtle px-3.5 py-2.5"
              )}
            >
              <WifiOff
                aria-hidden="true"
                className="mt-px size-3.5 shrink-0 text-[color:var(--cd-warning)] [stroke-width:1.7]"
              />
              <p className="m-0 font-sans text-[12.5px] leading-[1.5] text-fg-secondary">
                <b className="font-medium text-fg">You&apos;re offline.</b>{" "}
                These are the items already loaded. Nothing new arrives, and
                likes and saves wait until you&apos;re back.
              </p>
            </div>
          ) : null}

          <ScopeBar
            scope={scope}
            onScopeChange={(next) => router.push(feedHref(next))}
            meta={updatedLabel}
          />

          {entries.length === 0 && !pageError ? (
            <EmptyState
              ground
              icon={Inbox}
              title={feedEmptyCopy(scope).title}
              description={feedEmptyCopy(scope).description}
              action={
                scope === FeedScope.ForYou ? null : (
                  <Button
                    size="sm"
                    onClick={() => router.push(feedHref(FeedScope.ForYou))}
                  >
                    Back to For you
                  </Button>
                )
              }
            />
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) =>
                entry.kind === "digest" ? (
                  <FeedItem
                    key={entry.key}
                    variant="digest"
                    href={entry.href}
                    title={entry.title}
                    summary={entry.summary}
                    keyPoints={entry.keyPoints}
                    sources={entry.sources}
                    rankingReason={entry.rankingReason}
                    social={{
                      likeCount: entry.likeCount,
                      liked: entry.liked,
                      shareUrl: entry.shareUrl,
                      itemTitle: entry.title,
                    }}
                  />
                ) : (
                  <BookmarkRow
                    key={entry.key}
                    entry={entry}
                    offline={offline || isOffline}
                    onComment={() => setCommentsFor(entry)}
                    menu={
                      <FeedbackMenu
                        entry={entry}
                        onNotInterested={() => notInterested(entry)}
                        onFewerFromDomain={() => fewerFromDomain(entry)}
                        onMuteTopic={() => muteTopic(entry)}
                      />
                    }
                  />
                )
              )}
            </div>
          )}

          {/*
            The error panel. Below whatever is already on screen, never in
            place of it, and it carries the one thing worth pressing.
          */}
          {pageError ? (
            <div className="mt-2 rounded-md border border-line bg-bg-subtle p-5">
              <p className="m-0 font-sans text-[13.5px] leading-[1.55] text-fg">
                {pageError}
              </p>
              <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.5] text-fg-secondary">
                Nothing is lost — everything above is still here.
              </p>
              <div className="pt-3">
                <Button
                  size="sm"
                  loading={loadingMore}
                  onClick={() => {
                    setPageError(undefined);
                    if (cursor) void loadMore();
                    else router.refresh();
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          {/*
            The sentinel: a skeleton feed item that is both the trigger and the
            signal. No "Load more" button — Home has no pagination controls.
          */}
          {cursor && !pageError ? (
            <div ref={sentinelRef} aria-hidden="true">
              <FeedItemSkeleton />
            </div>
          ) : null}
        </section>

        <HomeRail {...rail} />
      </div>

      {/*
        One drawer for the whole list, not one per row: a dialog rendered
        twenty times is twenty focus traps.
      */}
      <CommentDrawer
        bookmarkId={commentsFor?.bookmarkId ?? ""}
        title={commentsFor?.title}
        commentCount={commentsFor?.commentCount ?? 0}
        open={commentsFor !== null}
        onOpenChange={(open) => !open && setCommentsFor(null)}
        offline={offline || isOffline}
      />
    </div>
  );
}

/**
 * Loading — three skeleton feed items, and a rail whose labels are already
 * readable (docs/design-system/pages.md § Home).
 *
 * The scope control is in here too and is not a skeleton: it is the one
 * control on the page that works before the data does, and greying it out
 * would make the page look further from ready than it is.
 */
export function HomeFallback({ scope }: { scope: FeedScope }) {
  return (
    <div className="px-6">
      <div className={HOME_GRID}>
        <section className={FEED_COLUMN} aria-busy="true">
          <ScopeBar scope={scope} />
          <div className="flex flex-col">
            <FeedItemSkeleton />
            <FeedItemSkeleton />
            <FeedItemSkeleton />
          </div>
        </section>
        <HomeRailSkeleton />
      </div>
    </div>
  );
}
