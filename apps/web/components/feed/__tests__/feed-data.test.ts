import { describe, expect, it } from "vitest";
import { Bookmark, Digest, FeedItem, FeedScope } from "@cosmic-dolphin/api-client";

import {
  DEFAULT_FEED_SCOPE,
  dedupeEntries,
  feedEmptyCopy,
  feedHref,
  formatEditionDate,
  formatUpdatedAt,
  greetingFor,
  greetingName,
  parseFeedScope,
  pipelineSteps,
  scopeOrderCopy,
  splitEdition,
  toFeedEntries,
} from "../feed-data";

/**
 * The pure half of Home.
 *
 * Two things here are load-bearing beyond the mapping itself:
 *
 *  - **`rankingReason` is carried, never composed.** The client cannot know
 *    what the ranker weighted, and a plausible-sounding wrong answer is worse
 *    than none — so an item without one produces a row without one.
 *  - **Every relative time is a string by the time it leaves this file.** The
 *    server formats it once, in one clock. A row that formatted its own time
 *    during render would say "just now" on the server and "1m ago" on the
 *    client, and React answers that by abandoning hydration — which leaves a
 *    page that screenshots perfectly and whose every button is dead.
 */

const NOW = new Date("2026-08-28T12:00:00.000Z");

function bookmark(overrides: Partial<Bookmark> & { id: string }): Bookmark {
  return {
    sourceUrl: `https://every.to/${overrides.id}`,
    title: `Title ${overrides.id}`,
    userId: "u1",
    createdAt: new Date("2026-08-26T12:00:00.000Z"),
    updatedAt: new Date("2026-08-26T12:00:00.000Z"),
    ...overrides,
  } as Bookmark;
}

describe("toFeedEntries", () => {
  it("carries the ranker's sentence through and never invents one", () => {
    const entries = toFeedEntries(
      [
        {
          type: "own_save",
          bookmark: bookmark({ id: "a" }),
          rankingReason: "You saved it yesterday.",
        },
        { type: "own_save", bookmark: bookmark({ id: "b" }) },
      ] as FeedItem[],
      NOW
    );

    expect(entries[0].rankingReason).toBe("You saved it yesterday.");
    expect(entries[1].rankingReason).toBeUndefined();
  });

  it("formats every time as a string, on one clock", () => {
    const [entry] = toFeedEntries(
      [{ type: "own_save", bookmark: bookmark({ id: "a" }) }] as FeedItem[],
      NOW
    );

    expect(entry.kind).toBe("bookmark");
    if (entry.kind !== "bookmark") throw new Error("expected a bookmark row");
    expect(entry.savedAt).toBe("2d ago");
  });

  it("names who a followed save reached the reader through", () => {
    const [entry] = toFeedEntries(
      [
        {
          type: "followed_save",
          bookmark: bookmark({ id: "a", userId: "u2" }),
          actor: { id: "u2", handle: "maya", name: "Maya" },
        },
      ] as FeedItem[],
      NOW
    );

    if (entry.kind !== "bookmark") throw new Error("expected a bookmark row");
    expect(entry.actor?.name).toBe("Maya");
    expect(entry.actor?.href).toBe("/u/maya");
    expect(entry.action).toBe("shared");
    // Not the reader's own: the Save control has something to do.
    expect(entry.own).toBe(false);
  });

  it("keeps a reshare distinguishable from a share", () => {
    const [entry] = toFeedEntries(
      [
        {
          type: "reshare",
          bookmark: bookmark({ id: "a", userId: "u2" }),
          actor: { id: "u2", handle: "maya", name: "Maya" },
        },
      ] as FeedItem[],
      NOW
    );

    if (entry.kind !== "bookmark") throw new Error("expected a bookmark row");
    expect(entry.action).toBe("reshared");
  });

  it("gives a video host the video variant", () => {
    const [entry] = toFeedEntries(
      [
        {
          type: "own_save",
          bookmark: bookmark({
            id: "v",
            sourceUrl: "https://www.youtube.com/watch?v=1",
          }),
        },
      ] as FeedItem[],
      NOW
    );

    expect(entry.variant).toBe("video");
  });

  it("renders a digest from its own payload, with every source", () => {
    const digest = {
      id: "dg1",
      title: "Four saves circling one argument",
      summary: "…",
      keyPoints: [{ term: "Memory beats context.", text: "Three sources agree." }],
      sources: [
        {
          bookmarkId: "s1",
          title: "One",
          url: "https://every.to/one",
          domain: "every.to",
        },
        {
          bookmarkId: "s2",
          title: "Two",
          url: "https://arxiv.org/two",
          domain: "arxiv.org",
        },
      ],
      coherence: 0.8,
      createdAt: NOW,
      likeCount: 2,
      isLikedByCurrentUser: false,
      isPublic: false,
    } as Digest;

    const [entry] = toFeedEntries(
      [{ type: "digest", digest, rankingReason: "You saved 2 links…" }] as FeedItem[],
      NOW
    );

    expect(entry.kind).toBe("digest");
    if (entry.kind !== "digest") throw new Error("expected a digest row");
    // Whole and in order: a digest that cannot name what it was built from is
    // a digest that does not render.
    expect(entry.sources.map((source) => source.domain)).toEqual([
      "every.to",
      "arxiv.org",
    ]);
    expect(entry.sources[0].href).toBe("/bookmarks/s1");
  });

  it("drops an item that carries neither a bookmark nor a digest", () => {
    const entries = toFeedEntries([{ type: "own_save" }] as FeedItem[], NOW);
    expect(entries).toEqual([]);
  });

  it("gives bookmarks and digests keys that cannot collide", () => {
    const entries = toFeedEntries(
      [
        { type: "own_save", bookmark: bookmark({ id: "same" }) },
        {
          type: "digest",
          digest: { id: "same", title: "d", summary: "", keyPoints: [], sources: [] } as unknown as Digest,
        },
      ] as FeedItem[],
      NOW
    );

    expect(new Set(entries.map((entry) => entry.key)).size).toBe(2);
  });
});

describe("dedupeEntries", () => {
  it("keeps the first of a repeated row", () => {
    const entries = toFeedEntries(
      [
        { type: "own_save", bookmark: bookmark({ id: "a" }) },
        { type: "own_save", bookmark: bookmark({ id: "a" }) },
        { type: "own_save", bookmark: bookmark({ id: "b" }) },
      ] as FeedItem[],
      NOW
    );

    expect(dedupeEntries(entries).map((entry) => entry.key)).toEqual([
      "bookmark:a",
      "bookmark:b",
    ]);
  });
});

describe("pipelineSteps", () => {
  it("reports nothing for a finished bookmark", () => {
    expect(
      pipelineSteps(bookmark({ id: "a", processingStatus: "completed" }))
    ).toEqual([]);
  });

  it("marks a phase done only when the field behind it has a value", () => {
    const steps = pipelineSteps(
      bookmark({
        id: "a",
        processingStatus: "processing",
        cosmicBriefSummary: "A summary.",
      })
    );

    expect(steps.find((step) => step.phase === "summarise")?.state).toBe("done");
    expect(steps.find((step) => step.phase === "tag")?.state).toBe("active");
    expect(steps.find((step) => step.phase === "file")?.state).toBe("pending");
  });

  it("says why a failed run failed, in the pipeline's own words", () => {
    const steps = pipelineSteps(
      bookmark({
        id: "a",
        processingStatus: "failed",
        processingError: "The page refused the fetch.",
      })
    );

    expect(steps).toHaveLength(1);
    expect(steps[0].state).toBe("failed");
    expect(steps[0].error).toBe("The page refused the fetch.");
  });
});

describe("the scope control", () => {
  it("falls back to For you rather than erroring on a hand-edited URL", () => {
    expect(parseFeedScope(undefined)).toBe(DEFAULT_FEED_SCOPE);
    expect(parseFeedScope("nonsense")).toBe(DEFAULT_FEED_SCOPE);
    expect(parseFeedScope("unread")).toBe(FeedScope.Unread);
  });

  it("keeps the default scope out of the URL", () => {
    expect(feedHref(FeedScope.ForYou)).toBe("/my/dashboard");
    expect(feedHref(FeedScope.Unread)).toBe("/my/dashboard?scope=unread");
  });

  it("names the specific emptiness of each scope", () => {
    const copies = [
      feedEmptyCopy(FeedScope.ForYou),
      feedEmptyCopy(FeedScope.Following),
      feedEmptyCopy(FeedScope.Unread),
    ];

    expect(new Set(copies.map((copy) => copy.title)).size).toBe(3);
    for (const copy of copies) {
      expect(copy.title.toLowerCase()).not.toContain("nothing here");
    }
  });
});

describe("formatUpdatedAt", () => {
  it("counts from computedAt, in minutes then hours then days", () => {
    const at = new Date("2026-08-28T12:00:00.000Z");
    const after = (ms: number) => new Date(at.getTime() + ms);

    expect(formatUpdatedAt(at, after(0))).toBe("Updated just now");
    expect(formatUpdatedAt(at, after(60_000))).toBe("Updated 1 min ago");
    expect(formatUpdatedAt(at, after(4 * 60_000))).toBe("Updated 4 min ago");
    expect(formatUpdatedAt(at, after(90 * 60_000))).toBe("Updated 1 hour ago");
    expect(formatUpdatedAt(at, after(50 * 60 * 60_000))).toBe(
      "Updated 2 days ago"
    );
    // A clock that ran backwards is not a negative age.
    expect(formatUpdatedAt(at, after(-60_000))).toBe("Updated just now");
  });
});

describe("splitEdition", () => {
  const digestItem = {
    type: "digest",
    digest: { id: "d1", title: "Digest", summary: "…", keyPoints: [], sources: [] },
  } as unknown as FeedItem;

  it("sends pending saves to Saving now and leads with the first finished bookmark", () => {
    const entries = toFeedEntries(
      [
        { bookmark: bookmark({ id: "p1", processingStatus: "processing" }) } as FeedItem,
        digestItem,
        { bookmark: bookmark({ id: "b1" }) } as FeedItem,
        { bookmark: bookmark({ id: "b2" }) } as FeedItem,
      ],
      NOW
    );
    const edition = splitEdition(entries);

    expect(edition.saving.map((entry) => entry.key)).toEqual(["bookmark:p1"]);
    expect(edition.lead?.key).toBe("bookmark:b1");
    // A digest never leads, and the split never re-ranks what it moves.
    expect(edition.rest.map((entry) => entry.key)).toEqual(["digest:d1", "bookmark:b2"]);
  });

  it("has no lead when the page holds only digests", () => {
    const edition = splitEdition(toFeedEntries([digestItem], NOW));
    expect(edition.lead).toBeUndefined();
    expect(edition.rest).toHaveLength(1);
  });
});

describe("the edition header", () => {
  it("greets by the reader's hour", () => {
    expect(greetingFor(new Date(2026, 9, 2, 8))).toBe("Good morning");
    expect(greetingFor(new Date(2026, 9, 2, 14))).toBe("Good afternoon");
    expect(greetingFor(new Date(2026, 9, 2, 22))).toBe("Good evening");
    expect(greetingFor(new Date(2026, 9, 2, 3))).toBe("Good evening");
  });

  it("dates the edition as weekday, day, month", () => {
    expect(formatEditionDate(new Date(2026, 9, 2), "en-GB")).toBe("Friday 2 October");
  });

  it("uses the first word of a name and leaves a handle whole", () => {
    expect(greetingName("Paulo Freitas")).toBe("Paulo");
    expect(greetingName("@maya.okafor")).toBe("maya.okafor");
    expect(greetingName("  ")).toBeUndefined();
  });

  it("says how each scope is ordered", () => {
    expect(scopeOrderCopy(FeedScope.Unread)).toBe("Your unread saves, newest first");
    expect(scopeOrderCopy(FeedScope.ForYou)).toMatch(/ranked/i);
  });
});
