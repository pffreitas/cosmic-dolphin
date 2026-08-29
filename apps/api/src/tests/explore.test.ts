import { describe, it, expect } from "bun:test";
import {
  EXPLORE_PAGE_DEFAULT_LIMIT,
  EXPLORE_PAGE_MAX_LIMIT,
  ExploreServiceImpl,
  reasonFor,
  type ExploreCandidateRow,
  type ExploreKeyset,
  type ExploreRepository,
  type ExploreTopicRow,
  type TrendingCollectionRow,
  type TrendingPersonRow,
} from "@cosmic-dolphin/shared";
import {
  decodeExploreCursor,
  encodeExploreCursor,
  exploreQuerySchema,
} from "../routes/explore";

/**
 * D18's Explore, tested where the decisions live.
 *
 * The security half of this surface — public only, not the viewer's own,
 * neither side of a block — is expressed as SQL predicates and is therefore
 * the integration suite's to prove; a fake repository that "forgets" to filter
 * would only be testing the fake. What is testable here, and worth testing, is
 * everything the service decides *after* the rows arrive: that a page is
 * paged rather than truncated, that the cursor round-trips, that the reason
 * string is read off numbers rather than invented, and that an empty graph
 * produces an empty page rather than an error.
 */

class FakeExploreRepository implements ExploreRepository {
  candidates: ExploreCandidateRow[] = [];
  topics: ExploreTopicRow[] = [];
  collections: TrendingCollectionRow[] = [];
  people: TrendingPersonRow[] = [];

  lastTopic: string | null | undefined;
  lastCursor: ExploreKeyset | null | undefined;
  lastLimit = 0;

  async findDiscoveryCandidates(
    _viewerId: string,
    options: {
      since: Date;
      limit: number;
      topic?: string | null;
      cursor?: ExploreKeyset | null;
    }
  ): Promise<ExploreCandidateRow[]> {
    this.lastTopic = options.topic;
    this.lastCursor = options.cursor;
    this.lastLimit = options.limit;
    return this.candidates.slice(0, options.limit);
  }

  async findTrendingTopics(): Promise<ExploreTopicRow[]> {
    return this.topics;
  }

  async findTrendingCollections(): Promise<TrendingCollectionRow[]> {
    return this.collections;
  }

  async findTrendingPeople(): Promise<TrendingPersonRow[]> {
    return this.people;
  }
}

const VIEWER = "99999999-9999-9999-9999-999999999999";
const AUTHOR = "88888888-8888-8888-8888-888888888888";

function candidate(
  id: string,
  overrides: Partial<{
    score: number;
    like_count: number;
    comment_count: number;
    cosmic_tags: string[] | null;
    created_at: Date;
  }> = {}
): ExploreCandidateRow {
  const created = overrides.created_at ?? new Date("2026-08-01T00:00:00Z");

  return {
    score: overrides.score ?? 1,
    author: {
      id: AUTHOR,
      handle: "author",
      name: "An Author",
      picture_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
    },
    bookmark: {
      id,
      user_id: AUTHOR,
      source_url: `https://example.com/${id}`,
      title: `Save ${id}`,
      like_count: overrides.like_count ?? 0,
      comment_count: overrides.comment_count ?? 0,
      cosmic_tags: overrides.cosmic_tags ?? null,
      is_public: true,
      is_archived: false,
      created_at: created,
      updated_at: created,
      processing_status: "completed",
      is_private_link: false,
    } as unknown as ExploreCandidateRow["bookmark"],
  };
}

function build() {
  const repo = new FakeExploreRepository();
  return { repo, service: new ExploreServiceImpl(repo) };
}

describe("explore paging", () => {
  it("asks for one row more than the page, so 'full' and 'more' can be told apart", async () => {
    const { repo, service } = build();
    repo.candidates = [candidate("a"), candidate("b"), candidate("c")];

    const page = await service.list(VIEWER, { limit: 2 });

    expect(repo.lastLimit).toBe(3);
    expect(page.items).toHaveLength(2);
    // The third row was the probe, not content.
    expect(page.lastRow).not.toBe(null);
  });

  it("hands back no cursor when the page is the last one", async () => {
    const { repo, service } = build();
    repo.candidates = [candidate("a"), candidate("b")];

    const page = await service.list(VIEWER, { limit: 5 });

    expect(page.items).toHaveLength(2);
    expect(page.lastRow).toBe(null);
  });

  it("returns an empty page on an empty graph rather than failing", async () => {
    const { service } = build();

    const page = await service.list(VIEWER);

    expect(page.items).toEqual([]);
    expect(page.topics).toEqual([]);
    expect(page.lastRow).toBe(null);
  });

  it("passes the topic filter through untouched", async () => {
    const { repo, service } = build();

    await service.list(VIEWER, { topic: "ai" });

    expect(repo.lastTopic).toBe("ai");
  });

  it("clamps an absurd limit to the ceiling", async () => {
    const { repo, service } = build();

    await service.list(VIEWER, { limit: 10_000 });

    expect(repo.lastLimit).toBe(EXPLORE_PAGE_MAX_LIMIT + 1);
  });

  it("falls back to the product default when no limit is given", async () => {
    const { repo, service } = build();

    await service.list(VIEWER);

    expect(repo.lastLimit).toBe(EXPLORE_PAGE_DEFAULT_LIMIT + 1);
  });
});

describe("explore items", () => {
  it("names the person the save reached the reader through", async () => {
    const { repo, service } = build();
    repo.candidates = [candidate("a")];

    const [item] = (await service.list(VIEWER)).items;

    expect(item.actor).toEqual({
      id: AUTHOR,
      handle: "author",
      name: "An Author",
      pictureUrl: undefined,
    });
    // Not `own_save` — it is somebody else's, and the provenance row says so.
    expect(item.type).toBe("followed_save");
  });

  it("carries a server-written reason on every item", async () => {
    const { repo, service } = build();
    repo.candidates = [candidate("a", { like_count: 4 })];

    const [item] = (await service.list(VIEWER)).items;

    expect(item.rankingReason).toBe("Liked by 4 people");
  });
});

describe("explore reason strings", () => {
  it("prefers discussion to likes, because it is the stronger signal", () => {
    expect(reasonFor({ like_count: 50, comment_count: 2 })).toBe(
      "Being discussed — 2 comments"
    );
  });

  it("says one thing in the singular", () => {
    expect(reasonFor({ like_count: 1, comment_count: 0 })).toBe(
      "Liked by 1 person"
    );
    expect(reasonFor({ like_count: 0, comment_count: 1 })).toBe(
      "Being discussed — 1 comment"
    );
  });

  it("falls back to what it can honestly claim, and never invents a number", () => {
    expect(reasonFor({ like_count: 0, comment_count: 0 }, "Ada")).toBe(
      "Recently shared by Ada"
    );
    expect(reasonFor({ like_count: 0, comment_count: 0 })).toBe(
      "Recently shared publicly"
    );
    // A blank name is not a name.
    expect(reasonFor({ like_count: 0, comment_count: 0 }, "   ")).toBe(
      "Recently shared publicly"
    );
  });
});

describe("explore rail", () => {
  it("maps trending people with the viewer's relationship already resolved", async () => {
    const { repo, service } = build();
    repo.people = [
      {
        profile: {
          id: AUTHOR,
          handle: "author",
          name: "An Author",
          picture_url: null,
          created_at: new Date("2026-01-01T00:00:00Z"),
        },
        saves_in_window: 4,
        followers: 12,
        is_followed_by_viewer: true,
      },
    ];

    const rail = await service.rail(VIEWER);

    expect(rail.people[0]).toEqual({
      person: {
        id: AUTHOR,
        handle: "author",
        name: "An Author",
        pictureUrl: undefined,
      },
      savesThisWeek: 4,
      followers: 12,
      isFollowedByViewer: true,
    });
  });

  it("is empty, not broken, before the graph is populated", async () => {
    const { service } = build();

    const rail = await service.rail(VIEWER);

    expect(rail).toEqual({ collections: [], people: [] });
  });
});

describe("explore cursor", () => {
  it("round-trips a score keyset through an opaque string", () => {
    const createdAt = new Date("2026-08-01T12:00:00Z");
    const encoded = encodeExploreCursor({ score: 3.5, createdAt, id: "abc" });

    const decoded = decodeExploreCursor(encoded);

    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.cursor.score).toBe(3.5);
    expect(decoded.ok && decoded.cursor.id).toBe("abc");
    expect(decoded.ok && decoded.cursor.createdAt.toISOString()).toBe(
      createdAt.toISOString()
    );
  });

  it("refuses a cursor a client made up", () => {
    expect(decodeExploreCursor("not-a-cursor").ok).toBe(false);
    expect(
      decodeExploreCursor(
        Buffer.from(
          JSON.stringify({ s: "high", c: "2026-01-01", i: "x" })
        ).toString("base64url")
      ).ok
    ).toBe(false);
    expect(
      decodeExploreCursor(
        Buffer.from(JSON.stringify({ s: 1, c: "nonsense", i: "x" })).toString(
          "base64url"
        )
      ).ok
    ).toBe(false);
  });
});

describe("explore query schema", () => {
  it("lower-cases the topic so one filter is not two that disagree", () => {
    const parsed = exploreQuerySchema.parse({ topic: "  AI  " });
    expect(parsed.topic).toBe("ai");
  });

  it("defaults the limit and rejects one past the ceiling", () => {
    expect(exploreQuerySchema.parse({}).limit).toBe(EXPLORE_PAGE_DEFAULT_LIMIT);
    expect(
      exploreQuerySchema.safeParse({ limit: EXPLORE_PAGE_MAX_LIMIT + 1 }).success
    ).toBe(false);
  });
});
