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
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { saveCapture } from "@/lib/store/slices/bookmarksSlice";

import { FeedItem, FeedLeadSkeleton, FeedRowSkeleton } from "./feed-item";
import { SavingNow, SavingRow } from "./saving-now";
import { PendingCaptureRow } from "@/components/bookmark/pending-captures";
import {
  FEED_SCOPES,
  FeedBookmarkEntry,
  FeedEntry,
  dedupeEntries,
  feedEmptyCopy,
  feedHref,
  formatEditionDate,
  formatUpdatedAt,
  greetingFor,
  greetingName,
  scopeOrderCopy,
  splitEdition,
  toFeedEntries,
} from "./feed-data";
import { HomeRail, HomeRailProps, HomeRailSkeleton, PickUp } from "./home-rail";

/**
 * Home — `/my/dashboard`, docs/design-system/pages.md § Home.
 *
 * **The morning edition.** One 1100px column that reads top-down: the edition
 * header (date, greeting, how this scope is ordered, the scope control), what
 * is *Saving now*, what to *Pick up where you left off*, and then the feed —
 * the first ranked bookmark as the `lead`, digests as AI callouts, everything
 * else as `row`s — beside a 260px rail that is **gone entirely below 900px**.
 * That last one is a promise as well as a breakpoint: nothing in the rail is
 * unique, so a narrow window costs the reader a shortcut and never a
 * destination.
 *
 * Three things in here exist because of the hydration trap, and all three
 * would be invisible if they were wrong: the page would screenshot perfectly
 * and every control on it would be dead.
 *
 *  - **"Updated n min ago", the date and the greeting** are the reader's
 *    clock, which does not exist during the server pass. They render only
 *    after mount, into lines that already hold their height.
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
  /** The reader's display name, for the greeting. */
  readerName?: string;
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
 * The page and its grid, in one place so the fallback and the view cannot
 * drift.
 *
 * `min-[900px]` rather than a Tailwind screen: 900 is where 720 + 40 + 260
 * stops fitting with page padding, which is a fact about this page and not
 * about the breakpoint scale.
 */
const EDITION = "mx-auto flex w-full max-w-[1100px] flex-col gap-7 pb-10 pt-4";

const HOME_GRID = cn(
  "grid grid-cols-1 gap-10 border-t border-line pt-7",
  "min-[900px]:grid-cols-[minmax(0,720px)_260px] min-[900px]:justify-between",
);

const FEED_COLUMN = "flex min-w-0 flex-col";

/* ---------------------------------------------------------------------------
   The edition header
   --------------------------------------------------------------------------- */

/**
 * Date, greeting, how this scope is ordered, and the scope control.
 *
 * Everything clock-shaped arrives one paint after hydration (see the note at
 * the top of this file), so every line here reserves its height up front: a
 * header that grows into existence would push the whole edition down under
 * the reader's cursor. Before mount the greeting is a plain "Hello" — true at
 * any hour — rather than an empty heading a screen reader would skip.
 */
function EditionHeader({
  scope,
  onScopeChange,
  readerName,
  now,
  updated,
}: {
  scope: FeedScope;
  onScopeChange?: (scope: FeedScope) => void;
  readerName?: string;
  /** The reader's clock. Absent during the server pass. */
  now?: Date;
  updated?: string;
}) {
  const name = greetingName(readerName);
  const greeting = now ? greetingFor(now) : "Hello";

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="m-0 min-h-[14px] font-sans text-[12px] font-semibold uppercase leading-none tracking-[.08em] text-fg-tertiary">
          {now ? formatEditionDate(now) : null}
        </p>
        <h1 className="m-0 font-serif text-[29px] font-semibold leading-[1.2] tracking-[-.01em] text-fg max-[640px]:text-2xl">
          {name ? `${greeting}, ${name}` : greeting}
        </h1>
        <p
          className="m-0 min-h-5 font-sans text-[13.5px] leading-[1.5] text-fg-secondary"
          aria-live="off"
        >
          {scopeOrderCopy(scope)}
          {updated ? ` · ${updated.charAt(0).toLowerCase()}${updated.slice(1)}` : null}
        </p>
      </div>
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
  frame = "row",
}: {
  entry: FeedBookmarkEntry;
  offline: boolean;
  onComment: () => void;
  menu: React.ReactNode;
  /** The edition's two scales: the page's one `lead`, or a `row` after it. */
  frame?: "lead" | "row";
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

  return (
    <FeedItem
      variant={frame}
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
      // A video keeps its **Watch with summary** at either scale.
      watchHref={entry.variant === "video" ? entry.href : undefined}
      // A partially-failed run goes where the brief would have been. The item
      // stays usable and the original link still opens.
      steps={entry.steps}
      social={social}
    />
  );
}

/* ---------------------------------------------------------------------------
   Saving now
   --------------------------------------------------------------------------- */

/**
 * Every save in flight: the reader's optimistic captures (the omnibox's
 * pastes, newest first) and the feed's own `pending` items.
 *
 * A capture the server has accepted is also, one refresh later, a pending
 * item in the feed — the same save twice. The capture wins: it is the row the
 * reader watched appear, and it carries the Retry and Dismiss the feed row
 * does not.
 */
function SavingNowStrip({ pending }: { pending: FeedBookmarkEntry[] }) {
  const captures = useAppSelector((state) => state.bookmarks.captures);
  const captured = new Set(
    captures.map((capture) => capture.bookmarkId).filter(Boolean)
  );

  return (
    <SavingNow>
      {captures.map((capture) => (
        <PendingCaptureRow key={capture.id} capture={capture} compact />
      ))}
      {pending
        .filter((entry) => !captured.has(entry.bookmarkId))
        .map((entry) => (
          <SavingRow
            key={entry.key}
            href={entry.href}
            title={entry.title}
            domain={entry.domain ?? ""}
            faviconUrl={entry.faviconUrl}
            timestamp={entry.savedAt}
            steps={entry.steps}
          />
        ))}
    </SavingNow>
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
  readerName,
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

  // The reader's clock, for the date and the greeting. Same mounted gate, same
  // tick: an edition left open past noon should stop saying "Good morning".
  const readerNow = React.useMemo(
    () => (mounted ? new Date() : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, tick]
  );

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

  const edition = splitEdition(entries);

  const renderBookmark = (entry: FeedBookmarkEntry, frame: "lead" | "row") => (
    <BookmarkRow
      key={entry.key}
      entry={entry}
      frame={frame}
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
  );

  const empty = !edition.lead && edition.rest.length === 0 && !pageError;

  return (
    <div className="px-6 max-[640px]:px-0">
      <div className={EDITION}>
        {/*
          The offline strip. Persistent — it is not a toast, because the
          condition does not pass on its own — and it sits above the edition
          rather than instead of it: what is on screen was fetched and is
          still readable.
        */}
        {isOffline ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-line bg-bg-subtle px-3.5 py-2.5"
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

        <EditionHeader
          scope={scope}
          onScopeChange={(next) => router.push(feedHref(next))}
          readerName={readerName}
          now={readerNow}
          updated={updatedLabel}
        />

        <SavingNowStrip pending={edition.saving} />

        <PickUp entries={rail.continueReading} />

        <div className={HOME_GRID}>
          <section aria-label="Feed" className={FEED_COLUMN}>
            {empty ? (
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
              <>
                {edition.lead ? (
                  <div className="pb-6">{renderBookmark(edition.lead, "lead")}</div>
                ) : null}

                {edition.rest.length > 0 ? (
                  <div className="flex flex-col">
                    {edition.lead ? (
                      <h2 className="m-0 pb-1 font-sans text-[11px] font-semibold uppercase leading-none tracking-[.07em] text-fg-tertiary">
                        More for you
                      </h2>
                    ) : null}
                    {edition.rest.map((entry) =>
                      entry.kind === "digest" ? (
                        // A digest keeps its own frame — the AI callout — with
                        // air above and below so it does not read as a row.
                        <FeedItem
                          key={entry.key}
                          variant="digest"
                          className="my-4"
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
                        renderBookmark(entry, "row")
                      )
                    )}
                  </div>
                ) : null}
              </>
            )}

            {/*
              The error panel. Below whatever is already on screen, never in
              place of it, and it carries the one thing worth pressing.
            */}
            {pageError ? (
              <div className="mt-4 rounded-md border border-line bg-bg-subtle p-5">
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
              The sentinel: a skeleton row that is both the trigger and the
              signal. No "Load more" button — Home has no pagination controls.
            */}
            {cursor && !pageError ? (
              <div ref={sentinelRef} aria-hidden="true">
                <FeedRowSkeleton />
              </div>
            ) : null}
          </section>

          <HomeRail topics={rail.topics} people={rail.people} />
        </div>
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
 * Loading — the edition header with its scope control live, a skeleton lead,
 * three skeleton rows, and a rail whose labels are already readable
 * (docs/design-system/pages.md § Home).
 *
 * The scope control is not a skeleton: it is the one control on the page that
 * works before the data does, and greying it out would make the page look
 * further from ready than it is.
 */
export function HomeFallback({
  scope,
  readerName,
}: {
  scope: FeedScope;
  readerName?: string;
}) {
  return (
    <div className="px-6 max-[640px]:px-0">
      <div className={EDITION}>
        <EditionHeader scope={scope} readerName={readerName} />
        <div className={HOME_GRID}>
          <section className={FEED_COLUMN} aria-busy="true">
            <FeedLeadSkeleton className="pb-6" />
            <FeedRowSkeleton />
            <FeedRowSkeleton />
            <FeedRowSkeleton />
          </section>
          <HomeRailSkeleton />
        </div>
      </div>
    </div>
  );
}
