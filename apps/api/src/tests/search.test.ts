import { describe, expect, it } from "bun:test";
import path from "node:path";
import {
  SearchServiceImpl,
  answerSourcesFrom,
  canAnswer,
  matchesSearchFilters,
  type AI,
  type BookmarkRepository,
  type EmbeddingService,
  type HybridSearchResult,
  type SearchAnswerSource,
} from "@cosmic-dolphin/shared";

/**
 * D17's one promise, tested where it is actually kept.
 *
 * **Every `search/ask` answer links its sources, and an answer that cites
 * nothing is not produced at all.** Rule 8 says no AI output ships without
 * naming its sources; the tempting way to satisfy it is to let the model write
 * "I couldn't find anything" and render that with an empty `.ai-foot`, which is
 * precisely the shape the rule forbids. So the check sits on the server: no
 * sources, no generation, and the model is never even asked.
 *
 * Everything below runs on fake repositories. No database, no model.
 */

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-08-28T12:00:00.000Z");

/**
 * A raw `bookmarks` row, snake_case, exactly as the search repositories hand
 * it back — they `SELECT *` and there is no camel-case plugin on the
 * connection. Search results being mapped out of this shape is the difference
 * between a library row that renders and one whose every field reads absent.
 */
function row(overrides: Record<string, any> = {}): any {
  return {
    id: "bk-1",
    source_url: "https://every.to/chain-of-thought/the-thing",
    title: "The thing",
    metadata: { openGraph: { favicon: "https://every.to/favicon.ico" } },
    collection_id: null,
    user_id: USER,
    is_archived: false,
    cosmic_brief_summary: "A brief summary.",
    cosmic_tags: ["agents"],
    is_private_link: false,
    is_public: false,
    read_at: null,
    processing_status: "completed",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

interface FakeArms {
  fts?: any[];
  vector?: { bookmark: any; matchedChunk: string }[];
}

function fakeRepository(arms: FakeArms): BookmarkRepository {
  return {
    async fullTextSearch() {
      return (arms.fts ?? []).map((bookmark, index) => ({
        bookmark,
        score: 1 - index / 100,
      }));
    },
    async vectorSearch() {
      return (arms.vector ?? []).map((entry, index) => ({
        bookmark: entry.bookmark,
        score: 1 - index / 100,
        matchedChunk: entry.matchedChunk,
      }));
    },
  } as unknown as BookmarkRepository;
}

const fakeEmbeddings: EmbeddingService = {
  async embedText() {
    return [0.1, 0.2, 0.3];
  },
} as unknown as EmbeddingService;

/** Records whether anything ever asked it for a model. */
function fakeAI(): AI & { asked: number } {
  const ai = {
    asked: 0,
    getModel() {
      ai.asked += 1;
      throw new Error("the model must not be reached in these tests");
    },
  };
  return ai as unknown as AI & { asked: number };
}

function collect(service: SearchServiceImpl) {
  const chunks: string[] = [];
  const sourceFrames: SearchAnswerSource[][] = [];
  const resultFrames: HybridSearchResult[][] = [];
  /** The order events were emitted in — the only way to assert "sources first". */
  const order: string[] = [];

  return {
    chunks,
    sourceFrames,
    resultFrames,
    order,
    handlers: {
      onSources(sources: SearchAnswerSource[]) {
        order.push("sources");
        sourceFrames.push(sources);
      },
      onChunk(chunk: string) {
        order.push("chunk");
        chunks.push(chunk);
      },
      onResults(results: HybridSearchResult[]) {
        order.push("results");
        resultFrames.push(results);
      },
    },
    service,
  };
}

describe("search/ask provenance", () => {
  it("produces no answer at all when there is nothing to cite", async () => {
    const ai = fakeAI();
    const service = new SearchServiceImpl(
      fakeRepository({}),
      fakeEmbeddings,
      ai
    );

    const run = collect(service);
    await service.askWithContext(USER, "anything", run.handlers);

    // The sources frame is still sent — the client is told, explicitly, that
    // there is nothing behind this query — but not one word of prose follows.
    expect(run.sourceFrames).toEqual([[]]);
    expect(run.chunks).toEqual([]);
    // And the model was never asked. A run that reaches a prompt is a run that
    // comes back with an unattributed paragraph.
    expect(ai.asked).toBe(0);
  });

  it("names every source before a single chunk of the answer", async () => {
    const service = new SearchServiceImpl(
      fakeRepository({
        fts: [row(), row({ id: "bk-2", source_url: "https://www.stratechery.com/x" })],
      }),
      fakeEmbeddings,
      fakeAI()
    );

    const run = collect(service);
    // The model throws, so the stream stops right after the sources frame —
    // which is all this test is about: what the client has been told by the
    // time the first chunk could possibly arrive.
    await service.askWithContext(USER, "agents", run.handlers).catch(() => {});

    expect(run.order.indexOf("sources")).toBeLessThan(
      run.order.indexOf("chunk") === -1 ? Infinity : run.order.indexOf("chunk")
    );

    const [sources] = run.sourceFrames;
    expect(sources).toHaveLength(2);
    // Every source is addressable. A source that is not a link is not
    // provenance, and `bookmarkId` is what makes the link possible.
    for (const source of sources) {
      expect(source.bookmarkId).toBeTruthy();
      expect(source.title).toBeTruthy();
    }
    expect(sources.map((source) => source.domain)).toEqual([
      "every.to",
      "stratechery.com",
    ]);
    expect(canAnswer(sources)).toBe(true);
  });

  it("refuses to call an empty source list an answer", () => {
    expect(canAnswer([])).toBe(false);
    expect(canAnswer(answerSourcesFrom([]))).toBe(false);
  });
});

describe("hybrid search results", () => {
  it("maps rows into the API's bookmark shape", async () => {
    const service = new SearchServiceImpl(
      fakeRepository({ fts: [row()] }),
      fakeEmbeddings,
      fakeAI()
    );

    const [result] = await service.hybridSearch(USER, "thing");

    // Without the mapping the client gets `source_url` and reads `sourceUrl`
    // as undefined — a library row with no domain, no summary and no read
    // state, which looks like missing data rather than a missing mapper.
    expect(result.bookmark.sourceUrl).toBe(
      "https://every.to/chain-of-thought/the-thing"
    );
    expect(result.bookmark.cosmicBriefSummary).toBe("A brief summary.");
    expect(result.bookmark.isRead).toBe(false);
  });

  it("marks a vector-only hit semantic and a literal hit keyword", async () => {
    const literal = row({ id: "bk-1" });
    const related = row({ id: "bk-2", title: "Something else" });

    const service = new SearchServiceImpl(
      fakeRepository({
        fts: [literal],
        vector: [
          { bookmark: literal, matchedChunk: "a chunk" },
          { bookmark: related, matchedChunk: "another chunk" },
        ],
      }),
      fakeEmbeddings,
      fakeAI()
    );

    const results = await service.hybridSearch(USER, "thing");
    const byId = new Map(results.map((r) => [r.bookmark.id, r]));

    // Reached both ways: the literal match is what the reader can see, so it
    // wins and the row does not claim to need an explanation.
    expect(byId.get("bk-1")?.match).toBe("keyword");
    // Reached only by similarity: nothing the reader typed is in this row, and
    // `/search` puts a `Related` tag on it so it explains itself.
    expect(byId.get("bk-2")?.match).toBe("semantic");
  });
});

describe("search filters", () => {
  const bookmark = {
    id: "bk-1",
    sourceUrl: "https://every.to/x",
    userId: USER,
    collectionId: "col-1",
    cosmicTags: ["Agents", "memory"],
    isRead: false,
    isPrivateLink: false,
    isPublic: false,
    processingStatus: "completed" as const,
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    updatedAt: NOW,
  };

  it("keeps a save only when every active filter agrees", () => {
    expect(matchesSearchFilters(bookmark, {}, NOW)).toBe(true);
    expect(
      matchesSearchFilters(bookmark, { collectionId: "col-1" }, NOW)
    ).toBe(true);
    expect(
      matchesSearchFilters(bookmark, { collectionId: "col-2" }, NOW)
    ).toBe(false);
  });

  it("matches tags without asking the reader to match case", () => {
    expect(matchesSearchFilters(bookmark, { tag: "agents" }, NOW)).toBe(true);
    expect(matchesSearchFilters(bookmark, { tag: "AGENTS" }, NOW)).toBe(true);
    expect(matchesSearchFilters(bookmark, { tag: "reading" }, NOW)).toBe(false);
  });

  it("reads unread off the same field the library does", () => {
    expect(matchesSearchFilters(bookmark, { readStatus: "unread" }, NOW)).toBe(
      true
    );
    expect(matchesSearchFilters(bookmark, { readStatus: "read" }, NOW)).toBe(
      false
    );
    expect(
      matchesSearchFilters(
        { ...bookmark, isRead: true, readAt: NOW },
        { readStatus: "read" },
        NOW
      )
    ).toBe(true);
  });

  it("measures the date range from the save, not from the read", () => {
    // Saved 8 days before NOW.
    expect(matchesSearchFilters(bookmark, { dateRange: "week" }, NOW)).toBe(
      false
    );
    expect(matchesSearchFilters(bookmark, { dateRange: "month" }, NOW)).toBe(
      true
    );
    expect(matchesSearchFilters(bookmark, { dateRange: "any" }, NOW)).toBe(true);
  });
});

describe("search contract", () => {
  function repoPath(relativePath: string): string {
    const cwd = process.cwd();
    const root = cwd.endsWith(path.join("apps", "api"))
      ? path.resolve(cwd, "../..")
      : cwd;

    return path.join(root, relativePath);
  }

  it("types the answer's sources, so a client cannot render one without them", async () => {
    // The contract is the outermost lock on rule 8 for this surface: a client
    // that has no `SearchAnswerSource` in its types has no way to draw the
    // `.ai-foot`, and the first thing to go when a stream is opaque is the
    // provenance.
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/search.tsp")
    ).text();

    const source = typeSpec.match(/model SearchAnswerSource \{[\s\S]*?\n\}/)?.[0];
    expect(source).toContain("bookmarkId: string;");
    expect(source).toContain("title: string;");
    expect(source).toContain("domain: string;");

    const item = typeSpec.match(/model HybridSearchResultItem \{[\s\S]*?\n\}/)?.[0];
    expect(item).toContain("match: SearchMatchKind;");
  });
});
