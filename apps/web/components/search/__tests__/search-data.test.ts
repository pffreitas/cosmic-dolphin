import { describe, expect, it } from "vitest";
import type { Bookmark, HybridSearchResultItem } from "@cosmic-dolphin/api-client";

import {
  hasActiveFilters,
  hasHighlight,
  highlightSegments,
  parseSearchView,
  queryTerms,
  searchHref,
  snippetAround,
  tagOptions,
  toAnswerSources,
  toSearchItem,
  urlFromQuery,
} from "../search-data";

const NOW = new Date("2026-08-28T12:00:00.000Z");

function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "bk-1",
    sourceUrl: "https://every.to/chain-of-thought/agent-memory",
    title: "Agent memory beats context",
    cosmicBriefSummary: "Why agent memory matters more than a bigger window.",
    cosmicTags: ["agents", "memory"],
    metadata: { openGraph: { favicon: "https://every.to/favicon.ico" } },
    isPrivateLink: false,
    isPublic: false,
    userId: "u-1",
    processingStatus: "completed",
    createdAt: new Date("2026-08-26T12:00:00.000Z"),
    updatedAt: NOW,
    ...overrides,
  } as Bookmark;
}

function result(
  overrides: Partial<HybridSearchResultItem> = {}
): HybridSearchResultItem {
  return {
    bookmark: bookmark(),
    score: 0.5,
    matchedChunks: [],
    match: "keyword",
    ...overrides,
  } as HybridSearchResultItem;
}

describe("highlighting", () => {
  it("marks the matched span and nothing else", () => {
    const segments = highlightSegments("Agent memory beats context", "memory");

    expect(segments).toEqual([
      { text: "Agent ", hit: false },
      { text: "memory", hit: true },
      { text: " beats context", hit: false },
    ]);
  });

  it("matches without asking the reader to match case", () => {
    expect(hasHighlight("Agent memory", "AGENT")).toBe(true);
  });

  it("merges overlapping terms into one mark", () => {
    // "agent" and "agents" both hit the same run. Two nested marks would
    // double the tint and make one word darker than the rest for no reason.
    const segments = highlightSegments("agents everywhere", "agent agents");

    expect(segments).toEqual([
      { text: "agents", hit: true },
      { text: " everywhere", hit: false },
    ]);
  });

  it("ignores single characters", () => {
    // Highlighting every "a" in a paragraph points at nothing while making the
    // row unreadable.
    expect(queryTerms("a memory")).toEqual(["memory"]);
    expect(hasHighlight("a paragraph", "a")).toBe(false);
  });

  it("leaves text alone when nothing matched", () => {
    expect(highlightSegments("Agent memory", "sailing")).toEqual([
      { text: "Agent memory", hit: false },
    ]);
  });

  it("keeps the match inside the window when it trims a long passage", () => {
    const passage = `${"filler ".repeat(60)}needle ${"filler ".repeat(60)}`;
    const snippet = snippetAround(passage, "needle");

    expect(snippet).toContain("needle");
    expect(snippet.length).toBeLessThan(passage.length);
  });
});

describe("the view in the URL", () => {
  it("round-trips through the query string", () => {
    const view = parseSearchView({
      q: " agent memory ",
      collection_id: "col-1",
      tag: "agents",
      read_status: "unread",
      date: "month",
    });

    expect(view).toEqual({
      q: "agent memory",
      collectionId: "col-1",
      tag: "agents",
      readStatus: "unread",
      dateRange: "month",
    });
    expect(searchHref(view)).toBe(
      "/search?q=agent+memory&collection_id=col-1&tag=agents&read_status=unread&date=month"
    );
  });

  it("falls back rather than trusting a hand-edited URL", () => {
    const view = parseSearchView({ q: "x", read_status: "nonsense", date: "🙃" });

    expect(view.readStatus).toBe("all");
    expect(view.dateRange).toBe("any");
    expect(hasActiveFilters(view)).toBe(false);
    expect(searchHref(view)).toBe("/search?q=x");
  });
});

describe("results", () => {
  it("builds the library row's own view model", () => {
    const item = toSearchItem(result(), "memory", NOW);

    expect(item.row.href).toBe("/bookmarks/bk-1");
    expect(item.row.title).toBe("Agent memory beats context");
    expect(item.row.domain).toBe("every.to");
    expect(item.row.savedAt).toBe("2d ago");
    expect(item.match).toBe("keyword");
  });

  it("gives every row the feed's provenance line, own-save shape", () => {
    const item = toSearchItem(result(), "memory", NOW);

    expect(item.provenance.sources).toEqual([
      {
        domain: "every.to",
        faviconUrl: "https://every.to/favicon.ico",
        href: "/bookmarks/bk-1",
      },
    ]);
    expect(item.provenance.action).toBe("you saved this");
    expect(item.provenance.timestamp).toBe("2d ago");
  });

  it("shows the matched passage rather than the brief when there is one", () => {
    const item = toSearchItem(
      result({ matchedChunks: ["  the passage that actually matched  "] }),
      "matched",
      NOW
    );

    expect(item.snippet).toBe("the passage that actually matched");
  });

  it("carries the match kind that earns a Related tag", () => {
    expect(toSearchItem(result({ match: "semantic" }), "x", NOW).match).toBe(
      "semantic"
    );
  });

  it("offers only the tags actually present in the results", () => {
    const items = [
      toSearchItem(result(), "x", NOW),
      toSearchItem(
        result({
          bookmark: bookmark({ id: "bk-2", cosmicTags: ["Memory", "rag"] }),
        }),
        "x",
        NOW
      ),
    ];

    // "Memory" and "memory" are one tag, and the filter must not offer both.
    expect(tagOptions(items)).toEqual(["agents", "memory", "rag"]);
  });
});

describe("answer sources", () => {
  it("makes every source a link to its bookmark", () => {
    const sources = toAnswerSources([
      { bookmarkId: "bk-1", title: "One", domain: "every.to" },
      { bookmarkId: "bk-2", title: "Two", domain: "" },
    ]);

    expect(sources[0].href).toBe("/bookmarks/bk-1");
    expect(sources[1].href).toBe("/bookmarks/bk-2");
    // A source with no parseable host still has to say something.
    expect(sources[1].domain).toBe("saved link");
  });
});

describe("save this link", () => {
  it("recognises a pasted link, with or without a scheme", () => {
    expect(urlFromQuery("https://every.to/x")).toBe("https://every.to/x");
    expect(urlFromQuery("every.to/x")).toBe("https://every.to/x");
  });

  it("treats a sentence as a search, even one with a link in it", () => {
    expect(urlFromQuery("what did every.to say about agents")).toBeUndefined();
    expect(urlFromQuery("agent memory")).toBeUndefined();
    expect(urlFromQuery("")).toBeUndefined();
  });

  it("refuses a scheme that is not http", () => {
    expect(urlFromQuery("javascript:alert(1)")).toBeUndefined();
    expect(urlFromQuery("mailto:me@example.com")).toBeUndefined();
  });
});
