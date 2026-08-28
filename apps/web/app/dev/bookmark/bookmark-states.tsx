"use client";

import * as React from "react";
import { Highlight, ReadingProgress } from "@cosmic-dolphin/api-client";

import { Button } from "@/components/ui/button";
import { DevThemeToggle } from "@/app/dev/dev-theme-toggle";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { BookmarkDetail } from "@/components/bookmark/detail/bookmark-detail";
import type {
  BookmarkDetailModel,
  DetailMode,
  DetailState,
} from "@/components/bookmark/detail/detail-data";
import type { DetailServices } from "@/components/bookmark/detail/detail-services";
import type { HighlightAnchor } from "@/lib/reading/highlight-anchor";

/* ---------------------------------------------------------------------------
   Fixtures.

   The four states of this page are four different sets of server answers, and
   no single database is in all of them. Driving the real `BookmarkDetail` off
   props is the only way to see them side by side — and it is the real
   component, so what this page shows is what the two routes show.
   --------------------------------------------------------------------------- */

const BODY = `
The obvious representation for a highlight is a pair of character offsets, and
it is the wrong one. Extraction is not stable: a nav bar that used to survive
the readability pass stops surviving it, a cookie banner appears, a paragraph
gets an em dash where it had a hyphen — and every offset in the document moves.

## What survives instead

Store the quote, and a short run of text either side of it. Resolution becomes
a search rather than a lookup, staged from most to least certain, and the
staging is the whole design.

> A highlight that matches nothing resolves to null — orphaned — which the
> reader shows as a note beside the text rather than a stripe through the wrong
> sentence.

1. **Exact quote, context-scored.** The overwhelmingly common case: the text is
   untouched and only its position moved.
2. **Context-anchored.** The quote's own words changed but its surroundings did
   not.
3. **Fuzzy.** Neither survived intact, so seed candidates from what did and
   accept the best window inside a bounded edit distance.

Reporting an orphan is a correct outcome. Guessing is not, and the difference
between the two is the difference between a tool you can trust with your own
reading and one you check up on.

## Why the stages are ordered

Each stage answers a different way the document can have changed, and running
them in order of certainty is what keeps the cheap, common case cheap. The
overwhelming majority of highlights are found by the first stage in a single
indexOf call, and the two expensive stages never run at all.

The exact stage handles the case that looks like it needs no handling: the text
is untouched and only its position moved. Stored offsets get precisely this
case wrong, which is why it is worth a stage of its own rather than an
optimisation inside a general search.

The context stage handles a typo fix, a smart-quote substitution, or an em dash
where there used to be a hyphen. The quote's own words changed and its
surroundings did not, so the surroundings are what locate it.

The fuzzy stage handles everything else, and it is bounded on purpose. It seeds
candidate positions from the quote's own head and tail shingles and from the
context, scores at most sixty-four windows, and accepts nothing outside a
quarter of the quote's length in edit distance. A tighter threshold orphans
highlights over a re-typeset dash; a looser one starts inventing matches.

## What the reader does with an orphan

Nothing, visually — and that is the design. An orphaned highlight is listed
beside the text rather than drawn through it, because a stripe in the wrong
place is a claim about what you highlighted, and a wrong claim about your own
reading is worse than an admission that the page moved.

## Reading progress is a different problem

Progress is bookkeeping the reader never asked for. It is written on a five
second throttle plus one write on unmount, it is monotonic in SQL so a second
tab scrolled to the top cannot walk it backwards, and a dropped write is not
worth a toast. A highlight is the opposite on every count: it is deliberate, it
is rare, and a silent failure would be a lie about something a person did.

That asymmetry is the reason the two live in different places in the code, on
different failure policies, with different guarantees — and the reason the read
state on this page is never set for you.

## The last paragraph

Which exists so this fixture is longer than a viewport, and the reader's scroll
maths, its progress writes and its restore-on-reload have something real to
work against.
`.trim();

function model(
  state: DetailState,
  mode: DetailMode,
  overrides: Partial<BookmarkDetailModel> = {},
): BookmarkDetailModel {
  return {
    id: "fixture",
    mode,
    state,
    title: "Highlights that survive a re-extraction",
    sourceUrl: "https://every.to/highlights-that-survive",
    domain: "every.to",
    attribution: "Dan Shipper",
    savedAt: "2d ago",
    readingTime: "9 min",
    collectionPath: [
      {
        id: "engineering",
        name: "Engineering",
        href: "/my/library?collection_id=engineering",
      },
    ],
    briefSummary:
      "Anchoring a highlight by quote and context instead of character offsets is what lets it survive the next time the page is re-extracted.",
    keyPoints: [
      "Offsets do not fail loudly — they silently point at a different sentence.",
      "Resolution runs in three stages, from exact match to bounded fuzzy search.",
      "An unplaceable highlight is reported as orphaned rather than drawn somewhere plausible.",
    ],
    readerBody: BODY,
    images: [],
    tags: ["anchoring", "reading", "extraction"],
    isRead: false,
    isPrivateLink: state === "private",
    processingError:
      state === "failed"
        ? "The page returned 403 to the fetcher after three attempts."
        : undefined,
    likeCount: 12,
    commentCount: 3,
    isLiked: false,
    shareUrl: "https://cosmicdolphin.com/s/fixture",
    isPublic: true,
    ...overrides,
  };
}

const HIGHLIGHTS: Highlight[] = [
  {
    id: "h1",
    bookmarkId: "fixture",
    userId: "u",
    quote:
      "Extraction is not stable: a nav bar that used to survive the readability pass stops surviving it",
    prefix: "and it is the wrong one. ",
    suffix: ", a cookie banner appears",
    createdAt: new Date("2026-08-25T10:00:00Z"),
  },
  {
    id: "h2",
    bookmarkId: "fixture",
    userId: "u",
    quote: "Reporting an orphan is a correct outcome. Guessing is not",
    prefix: "own reading and one you check up on. ",
    suffix: ", and the difference",
    createdAt: new Date("2026-08-26T10:00:00Z"),
  },
];

/**
 * Every call answers from memory, so the gallery never touches the API and a
 * state stays the state you selected.
 *
 * Progress is the exception: it goes to `sessionStorage`, standing in for the
 * server's row. That makes this page the place to check the one claim about
 * the reader that cannot be checked by looking at it — scroll into the
 * article, wait for the throttle, reload, and the reader should put you back
 * where you were. A fixture that forgot on reload would let that break
 * silently.
 */
const PROGRESS_KEY = "cd-dev-bookmark-progress";

function readStoredProgress(): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { percent: number; scrollOffset: number | null };
    return {
      bookmarkId: "fixture",
      percent: parsed.percent,
      scrollOffset: parsed.scrollOffset ?? undefined,
      updatedAt: new Date(),
    };
  } catch {
    return null;
  }
}

function fixtureServices(highlights: Highlight[]): DetailServices {
  let stored = [...highlights];

  return {
    markRead: async () => ({ isRead: true }),
    markUnread: async () => ({ isRead: false }),
    reprocess: async () => {},
    like: async () => ({ likeCount: 13, isLiked: true }),
    unlike: async () => ({ likeCount: 12, isLiked: false }),
    listHighlights: async () => stored,
    createHighlight: async (_id: string, anchor: HighlightAnchor) => {
      const created: Highlight = {
        id: `h${stored.length + 1}`,
        bookmarkId: "fixture",
        userId: "u",
        quote: anchor.quote,
        prefix: anchor.prefix ?? undefined,
        suffix: anchor.suffix ?? undefined,
        createdAt: new Date(),
      };
      stored = [...stored, created];
      return created;
    },
    getProgress: async () => readStoredProgress(),
    saveProgress: async (_id, percent, scrollOffset) => {
      try {
        window.sessionStorage.setItem(
          PROGRESS_KEY,
          JSON.stringify({ percent, scrollOffset }),
        );
      } catch {
        // A private window with storage blocked. Nothing to restore, which is
        // the same answer as never having read the article.
      }
      return null;
    },
  };
}

type StateKey = "ready" | "processing" | "failed" | "private" | "shared";

const STATES: { value: StateKey; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "private", label: "Private link" },
  { value: "shared", label: "Shared /s/[slug]" },
];

/**
 * `/dev/bookmark` — the detail page's states, alongside `/dev/library` and
 * `/dev/patterns`.
 *
 * The fifth entry is not a state but the other route: `/s/[slug]` is the same
 * composition with the breadcrumb, the read toggle and the highlights removed
 * and **Save to your library** added, and seeing the two next to each other is
 * the fastest way to notice if that stops being true.
 *
 * Not found is the one state absent here, because it is not rendered by this
 * component at all — it is a real 404 from each route's `not-found.tsx`, which
 * is the point of it. Visit `/bookmarks/does-not-exist` to see it.
 */
export function BookmarkStates() {
  const [state, setState] = React.useState<StateKey>("ready");
  const services = React.useMemo(() => fixtureServices(HIGHLIGHTS), []);

  const current = React.useMemo(() => {
    switch (state) {
      case "shared":
        return model("ready", "shared");
      case "processing":
        // Nothing has been written yet, which is the whole point of the
        // state: the brief's position holds the checklist and the reader
        // holds a skeleton.
        return model("processing", "owner", {
          briefSummary: undefined,
          keyPoints: [],
          readerBody: undefined,
          tags: [],
        });
      case "private":
        return model("private", "owner", {
          title: "A note I saved from a private wiki",
          sourceUrl: "https://www.notion.so/team/reading-notes",
          domain: "notion.so",
          attribution: undefined,
          readingTime: undefined,
          briefSummary: undefined,
          keyPoints: [],
          readerBody: undefined,
          tags: [],
        });
      case "failed":
        return model("failed", "owner", {
          briefSummary: undefined,
          keyPoints: [],
          readerBody: undefined,
        });
      default:
        return model("ready", "owner");
    }
  }, [state]);

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="m-0 font-serif text-[22px] font-semibold leading-[1.25] text-fg">
            Bookmark detail states
          </h1>
          <p className="m-0 pt-1 font-sans text-[12.5px] leading-[1.4] text-fg-secondary">
            The real page on fixture data. Dev only. Select text in the reader
            to see the popover.
          </p>
        </div>
        <DevThemeToggle />
      </div>

      <div className="py-4">
        <Segmented
          aria-label="Detail state"
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

      <BookmarkDetail
        key={state}
        model={current}
        initialHighlights={state === "ready" ? HIGHLIGHTS : []}
        services={services}
        // The gallery is offline: it renders states, it does not exercise the
        // network. Highlighting still works — the fixture services keep the
        // new anchor in memory and the reader repaints from it.
        offline={state !== "ready"}
      />
    </div>
  );
}
