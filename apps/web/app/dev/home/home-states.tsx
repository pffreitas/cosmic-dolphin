"use client";

import * as React from "react";
import { FeedScope } from "@cosmic-dolphin/api-client";

import { DevThemeToggle } from "@/app/dev/dev-theme-toggle";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { HomeFallback, HomeView } from "@/components/feed/home-view";
import type {
  FeedBookmarkEntry,
  FeedDigestEntry,
  FeedEntry,
} from "@/components/feed/feed-data";
import type { HomeRailProps } from "@/components/feed/home-rail";

/* ---------------------------------------------------------------------------
   Fixtures.

   Plain props, not the API: every state below has to be reachable on demand
   rather than by waiting for the ranker to happen to be in it. The rows are
   the real `HomeView`, so what this page shows is what `/my/dashboard` shows —
   including the overflow menu, which posts nothing here because `offline` is
   set on every state.
   --------------------------------------------------------------------------- */

function article(
  overrides: Partial<FeedBookmarkEntry> & { bookmarkId: string }
): FeedBookmarkEntry {
  return {
    kind: "bookmark",
    key: `bookmark:${overrides.bookmarkId}`,
    variant: "article",
    href: `/bookmarks/${overrides.bookmarkId}`,
    title: "Untitled",
    action: "you saved this",
    savedAt: "2d ago",
    tags: [],
    privateLink: false,
    likeCount: 0,
    liked: false,
    commentCount: 0,
    saved: false,
    own: false,
    steps: [],
    ...overrides,
  };
}

const DIGEST: FeedDigestEntry = {
  kind: "digest",
  key: "digest:dg_44a1",
  variant: "digest",
  digestId: "dg_44a1",
  href: "/digests/dg_44a1",
  title: "Four of your saves are circling the same argument",
  summary:
    "You've been collecting pieces that all push back on scale-first agent design. Two of them contradict each other on evaluation.",
  rankingReason:
    "You saved 4 links that turned out to be about the same thing, so this pulls them together.",
  keyPoints: [
    {
      term: "Memory beats context.",
      text: "Three sources argue that episodic state, not window size, is the limiting factor.",
    },
    {
      term: "Evaluation is unresolved.",
      text: "Chen proposes trajectory-level scoring; Okafor calls it unfalsifiable.",
    },
  ],
  sources: [
    { bookmarkId: "bk_8f2a", domain: "every.to", href: "/bookmarks/bk_8f2a" },
    { bookmarkId: "bk_91ff", domain: "arxiv.org", href: "/bookmarks/bk_91ff" },
    {
      bookmarkId: "bk_3e77",
      domain: "stratechery.com",
      href: "/bookmarks/bk_3e77",
    },
    { bookmarkId: "bk_1d4c", domain: "youtube.com", href: "/bookmarks/bk_1d4c" },
  ],
  likeCount: 6,
  liked: false,
};

const ENTRIES: FeedEntry[] = [
  article({
    bookmarkId: "bk_91ff",
    variant: "pending",
    title: "Episodic Memory for Long-Horizon Tool-Using Agents",
    domain: "arxiv.org",
    savedAt: "just now",
    own: true,
    saved: true,
    steps: [
      { phase: "extract", state: "done" },
      { phase: "summarise", state: "active" },
      { phase: "tag", state: "pending" },
      { phase: "file", state: "pending" },
    ],
  }),
  article({
    bookmarkId: "bk_8f2a",
    title: "The Bottleneck Was Never Retrieval",
    summary:
      "Agents don't fail because they can't find the right document — they fail because they can't remember what they already tried. A case for episodic memory over bigger context windows.",
    domain: "every.to",
    action: "shared",
    actor: {
      name: "Maya Okafor",
      handle: "maya",
      href: "/u/maya",
    },
    tags: ["agent memory", "retrieval"],
    muteTopic: "agent memory",
    readingTime: "9 min",
    rankingReason:
      "It lines up with the agent memory links you've been finishing, and you finish most of what you save from every.to.",
    likeCount: 128,
    commentCount: 14,
    shareUrl: "https://cosmicdolphin.app/s/bk_8f2a",
  }),
  DIGEST,
  article({
    bookmarkId: "bk_3e77",
    title: "The cost of a perfect index",
    summary:
      "Retrieval quality has a price curve, and most teams are buying the flat part of it.",
    domain: "stratechery.com",
    savedAt: "5d ago",
    own: true,
    saved: true,
    tags: ["retrieval", "cost"],
    muteTopic: "retrieval",
    readingTime: "11 min",
    rankingReason: "You saved it 5 days ago and haven't opened it yet.",
  }),
  article({
    bookmarkId: "bk_5ad3",
    title: "Q3 retrieval eval — internal writeup",
    domain: "notion.so",
    savedAt: "4d ago",
    own: true,
    saved: true,
    privateLink: true,
    tags: ["evaluation"],
    muteTopic: "evaluation",
    rankingReason: "You saved it 4 days ago and haven't opened it yet.",
  }),
];

const RAIL: HomeRailProps = {
  continueReading: [
    {
      bookmarkId: "bk_1",
      href: "/bookmarks/bk_1",
      title: "What agents forget, and when",
      percent: 64,
      timeLeft: "4 min left",
    },
    {
      bookmarkId: "bk_2",
      href: "/bookmarks/bk_2",
      title: "A short history of retrieval-augmented generation",
      percent: 22,
      timeLeft: "14 min left",
    },
    {
      bookmarkId: "bk_3",
      href: "/bookmarks/bk_3",
      title: "Typography for long-form reading on screens",
      percent: 91,
      timeLeft: "1 min left",
    },
  ],
  topics: [
    { topic: "agent memory", count: 6, href: "/search?q=agent%20memory" },
    { topic: "retrieval", count: 4, href: "/search?q=retrieval" },
    { topic: "typography", count: 3, href: "/search?q=typography" },
    { topic: "evaluation", count: 2, href: "/search?q=evaluation" },
  ],
  people: [
    {
      id: "u1",
      handle: "maya",
      name: "Maya Okafor",
      href: "/u/maya",
      savesThisWeek: 4,
    },
    {
      id: "u2",
      handle: "dshipper",
      name: "Dan Shipper",
      href: "/u/dshipper",
      savesThisWeek: 2,
    },
    {
      id: "u3",
      handle: "kchen",
      name: "Karen Chen",
      href: "/u/kchen",
      savesThisWeek: 0,
    },
  ],
};

const EMPTY_RAIL: HomeRailProps = {
  continueReading: [],
  topics: [],
  people: [],
};

const COMPUTED_AT = new Date(Date.now() - 4 * 60 * 1000);

type StateKey =
  | "populated"
  | "paging"
  | "loading"
  | "new-user"
  | "empty-scope"
  | "error"
  | "offline";

const STATES: { value: StateKey; label: string }[] = [
  { value: "populated", label: "Populated" },
  { value: "paging", label: "Paging" },
  { value: "loading", label: "Loading" },
  { value: "new-user", label: "New user" },
  { value: "empty-scope", label: "Empty scope" },
  { value: "error", label: "Error" },
  { value: "offline", label: "Offline" },
];

/**
 * `/dev/home` — Home's state gallery.
 *
 * Every state the page owes (docs/design-system/pages.md § Home): three
 * skeleton items with the rail's labels already readable, the display-size
 * hero whose primary action is the URL field, an empty scope that keeps its
 * segmented control, the inline error panel that never replaces the page, and
 * the persistent `--cd-warning` strip over cached items.
 *
 * The theme switch is here so both themes can be checked without leaving.
 */
export function HomeStates() {
  const [state, setState] = React.useState<StateKey>("populated");

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="m-0 font-serif text-[22px] font-semibold leading-[1.25] text-fg">
            Home states
          </h1>
          <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            The real components on fixture data. Dev only — nothing here posts.
          </p>
        </div>
        <DevThemeToggle />
      </div>

      <div className="py-4">
        <Segmented
          aria-label="Home state"
          value={state}
          onValueChange={(value) => setState(value as StateKey)}
        >
          {STATES.map((option) => (
            <SegmentedItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {state === "loading" ? (
        <HomeFallback scope={FeedScope.ForYou} />
      ) : (
        <HomeView
          key={state}
          offline
          forceOffline={state === "offline"}
          scope={state === "empty-scope" ? FeedScope.Following : FeedScope.ForYou}
          entries={
            state === "new-user" || state === "empty-scope" ? [] : ENTRIES
          }
          /*
            The infinite-scroll sentinel is a skeleton feed item, and it is the
            only paging affordance on the page — there is no "Load more" button
            to find here because Home does not have one. `offline` keeps the
            loader inert, so the skeleton sits where a reader mid-scroll sees it.
          */
          nextCursor={state === "paging" ? "cursor-fixture" : undefined}
          computedAt={COMPUTED_AT}
          newUser={state === "new-user"}
          error={state === "error" ? "We couldn't reach your feed." : undefined}
          rail={state === "empty-scope" ? EMPTY_RAIL : RAIL}
        />
      )}
    </div>
  );
}
