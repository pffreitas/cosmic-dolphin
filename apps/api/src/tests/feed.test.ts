import { describe, it, expect } from "bun:test";
import path from "node:path";
import {
  DEFAULT_FEED_RANKING_PARAMETERS,
  DEFAULT_FEED_WEIGHTS,
  FEED_SIGNAL_NAMES,
  FeedRankingServiceImpl,
  applyAuthorDiversity,
  mergeFeedRankingConfig,
  seenDecayMultiplier,
  socialProofScore,
  type Bookmark as BookmarkRow,
  type FeedImpressionItemType,
  type FeedImpressionRow,
  type FeedRankingConfigOverrides,
  type FeedRepository,
  type FinishedReadRow,
  type FollowedSaveRow,
  type RecentlyServedRow,
  type SaveOutcomeRow,
  type SocialProofRow,
  type SocialService,
} from "@cosmic-dolphin/shared";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  feedQuerySchema,
  stripDebugSignals,
  FEED_PAGE_DEFAULT_LIMIT,
  FEED_PAGE_MAX_LIMIT,
} from "../routes/feed";

/**
 * D14's three guarantees, tested where they are actually implemented.
 *
 *  - **The ranker explains itself in one sentence per item.** Asserted on the
 *    responses the service produces, not on the sentence builder alone: the
 *    promise is that every ranked item carries a reason, and a unit test of the
 *    builder would still pass if the service stopped attaching one.
 *  - **The same item is not served indefinitely unopened.** Asserted through
 *    the impression counter, at both thresholds, and — the half that is easy to
 *    lose — asserted that the dropped item is still reachable in Unread. "Stop
 *    pushing this at me" and "hide this from me" are different promises.
 *  - **No signal rewards engagement time or popularity alone.** Asserted
 *    against the actual signal set rather than against a comment: the six names
 *    are enumerated, an item that wins on social proof alone is shown to lose,
 *    and the config merge is shown to be unable to add a seventh signal.
 *
 * Everything below the candidate query is pure and takes its clock as an
 * argument, so all of this runs against an in-memory repository with no
 * database anywhere.
 */

// ---------------------------------------------------------------------------
// An in-memory feed
// ---------------------------------------------------------------------------

const VIEWER = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-08-28T12:00:00.000Z");

function daysAgo(days: number, from: Date = NOW): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

function bookmarkRow(overrides: Partial<BookmarkRow> & { id: string }): BookmarkRow {
  return {
    id: overrides.id,
    source_url: `https://example.com/${overrides.id}`,
    title: `Title ${overrides.id}`,
    metadata: null,
    collection_id: null,
    filing_source: "ai",
    saved_from_bookmark_id: null,
    user_id: VIEWER,
    is_archived: false,
    is_favorite: false,
    cosmic_summary: null,
    cosmic_brief_summary: null,
    cosmic_key_points: null,
    cosmic_tags: null,
    cosmic_images: null,
    cosmic_links: null,
    quick_access: null,
    search_document: null,
    processing_status: "completed",
    processing_started_at: null,
    processing_completed_at: null,
    processing_error: null,
    is_private_link: false,
    like_count: 0,
    comment_count: 0,
    is_public: false,
    share_slug: null,
    read_at: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    ...overrides,
  } as BookmarkRow;
}

class FakeFeedRepository implements FeedRepository {
  ownUnread: BookmarkRow[] = [];
  followed: FollowedSaveRow[] = [];
  pending: BookmarkRow[] = [];
  similarity = new Map<string, number>();
  finishedReads: FinishedReadRow[] = [];
  saveOutcomes: SaveOutcomeRow[] = [];
  socialProof: SocialProofRow[] = [];
  impressions = new Map<string, FeedImpressionRow>();
  recentlyServed: RecentlyServedRow[] = [];
  servedSince: string[] = [];
  rankingConfig: FeedRankingConfigOverrides | null = null;

  /** What `findOwnUnread` was asked for, so the candidate cap can be asserted. */
  ownUnreadLimits: number[] = [];
  recorded: { itemType: FeedImpressionItemType; itemId: string }[] = [];
  opened: string[] = [];

  async findOwnUnread(
    _userId: string,
    since: Date,
    limit: number
  ): Promise<BookmarkRow[]> {
    this.ownUnreadLimits.push(limit);
    return this.ownUnread
      .filter((row) => row.created_at >= since)
      .slice(0, limit);
  }

  async findFollowedSaves(
    _userId: string,
    since: Date,
    limit: number
  ): Promise<FollowedSaveRow[]> {
    return this.followed
      .filter((row) => row.bookmark.created_at >= since)
      .slice(0, limit);
  }

  async findPending(_userId: string, limit: number): Promise<BookmarkRow[]> {
    return this.pending.slice(0, limit);
  }

  async similarityToInterestVector(): Promise<Map<string, number>> {
    return this.similarity;
  }

  async findFinishedReads(): Promise<FinishedReadRow[]> {
    return this.finishedReads;
  }

  async findSaveOutcomes(): Promise<SaveOutcomeRow[]> {
    return this.saveOutcomes;
  }

  async findSocialProof(): Promise<SocialProofRow[]> {
    return this.socialProof;
  }

  async findImpressions(): Promise<Map<string, FeedImpressionRow>> {
    return this.impressions;
  }

  async findRecentlyServed(): Promise<RecentlyServedRow[]> {
    return this.recentlyServed;
  }

  async findServedSince(): Promise<string[]> {
    return this.servedSince;
  }

  async recordImpressions(
    _userId: string,
    items: { itemType: FeedImpressionItemType; itemId: string }[]
  ): Promise<void> {
    this.recorded.push(...items);
  }

  async markOpened(
    _userId: string,
    _itemType: FeedImpressionItemType,
    itemId: string
  ): Promise<void> {
    this.opened.push(itemId);
  }

  async findRankingConfig(): Promise<FeedRankingConfigOverrides | null> {
    return this.rankingConfig;
  }

  /** Convenience: n unopened serves of one bookmark. */
  seen(bookmarkId: string, servedCount: number, opened = false): void {
    this.impressions.set(`bookmark:${bookmarkId}`, {
      user_id: VIEWER,
      item_type: "bookmark",
      item_id: bookmarkId,
      served_count: servedCount,
      opened_at: opened ? daysAgo(1) : null,
      last_served_at: daysAgo(0.1),
    });
  }
}

/** Everything the ranker asks the social graph. Blocking is the only question. */
function fakeSocial(blocked: string[] = []): SocialService {
  return {
    async canInteract(_viewerId: string, otherId: string) {
      return !blocked.includes(otherId);
    },
  } as unknown as SocialService;
}

function makeService(
  repository: FakeFeedRepository,
  blocked: string[] = []
): FeedRankingServiceImpl {
  return new FeedRankingServiceImpl(repository, fakeSocial(blocked), "test");
}

function repoPath(relativePath: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join("apps", "api"))
    ? path.resolve(cwd, "../..")
    : cwd;

  return path.join(root, relativePath);
}

// ---------------------------------------------------------------------------
// Guarantee 1 — the ranker explains itself in one sentence per item
// ---------------------------------------------------------------------------

describe("the ranker explains itself", () => {
  it("gives every ranked item exactly one sentence", async () => {
    const repository = new FakeFeedRepository();
    repository.ownUnread = [
      bookmarkRow({ id: "a", source_url: "https://every.to/a" }),
      bookmarkRow({ id: "b", source_url: "https://stratechery.com/b" }),
      bookmarkRow({ id: "c", source_url: "https://newyorker.com/c" }),
    ];

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(page.items).toHaveLength(3);
    for (const item of page.items) {
      const reason = item.rankingReason;
      expect(typeof reason).toBe("string");
      expect(reason!.length).toBeGreaterThan(0);
      // One sentence: it ends in a full stop and contains no other one.
      expect(reason!.endsWith(".")).toBe(true);
      expect(reason!.slice(0, -1)).not.toContain(".");
      // Second person, per docs/functional-spec/05-feed.md § Why this appeared.
      expect(reason!.toLowerCase()).toMatch(/\byou\b|\byour\b|\bit\b/);
    }
  });

  it("writes the sentence from the two signals that actually moved the item", async () => {
    // The reason is not a template over the item — it is a readout of the
    // score. Two items with the same shape but different evidence must get
    // different sentences, which is the thing a client could not reproduce.
    const repository = new FakeFeedRepository();
    repository.ownUnread = [
      bookmarkRow({ id: "fresh", created_at: NOW, updated_at: NOW }),
      bookmarkRow({
        id: "trusted",
        source_url: "https://every.to/trusted",
        created_at: daysAgo(30),
        updated_at: daysAgo(30),
      }),
    ];
    // The reader finishes everything from every.to and nothing from example.com.
    repository.saveOutcomes = [
      ...Array.from({ length: 8 }, () => ({
        sourceUrl: "https://every.to/x",
        read: true,
      })),
      ...Array.from({ length: 8 }, () => ({
        sourceUrl: "https://example.com/x",
        read: false,
      })),
    ];

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });
    const byId = new Map(
      page.items.map((item) => [item.bookmark!.id, item.rankingReason!])
    );

    expect(byId.get("trusted")).toContain("every.to");
    expect(byId.get("fresh")).not.toContain("every.to");
    expect(byId.get("fresh")).not.toEqual(byId.get("trusted"));
  });

  it("never attaches a reason to a pinned item", async () => {
    // `pending` is pinned rather than ranked, so it has nothing to explain. A
    // sentence there would be the ranker taking credit for an ordering it did
    // not produce.
    const repository = new FakeFeedRepository();
    repository.pending = [
      bookmarkRow({ id: "p", processing_status: "processing" }),
    ];

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(page.items[0].type).toBe("pending");
    expect(page.items[0].rankingReason).toBeUndefined();
  });

  it("keeps the reason server-side by contract", async () => {
    // The contract is the outer lock: a client that receives `rankingReason`
    // has no reason to synthesise one, and `signals` — the material it would
    // need to try — is documented as debugging only and stripped in production.
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/bookmarks.tsp")
    ).text();
    const feedItem = typeSpec.match(/model FeedItem \{[\s\S]*?\n\}/)?.[0];

    expect(feedItem).toContain("rankingReason?: string;");
    expect(typeSpec).toContain("never synthesised on the client");

    const item = {
      type: "own_save" as const,
      rankingReason: "You saved it yesterday.",
      signals: [
        { name: "recency", weight: 0.2, value: 1, contribution: 0.2 },
      ],
    };

    expect(stripDebugSignals([item], false)[0].signals).toBeUndefined();
    expect(stripDebugSignals([item], false)[0].rankingReason).toBe(
      "You saved it yesterday."
    );
    expect(stripDebugSignals([item], true)[0].signals).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Guarantee 2 — the same item is not served indefinitely unopened
// ---------------------------------------------------------------------------

describe("the same item is not served indefinitely unopened", () => {
  it("multiplies the score by 0.6 after 3 unopened impressions", () => {
    const { seenDecayAfter, seenDecayFactor } = DEFAULT_FEED_RANKING_PARAMETERS;

    expect(seenDecayAfter).toBe(3);
    expect(seenDecayFactor).toBe(0.6);
    expect(seenDecayMultiplier(2, seenDecayAfter, seenDecayFactor)).toBe(1);
    expect(seenDecayMultiplier(3, seenDecayAfter, seenDecayFactor)).toBe(0.6);
    expect(seenDecayMultiplier(9, seenDecayAfter, seenDecayFactor)).toBe(0.6);
  });

  it("sinks a thrice-ignored item below an identical fresh one", async () => {
    // The multiplier has to reach the ordering, not just exist. Two items that
    // are identical in every signal, one of them ignored three times.
    const repository = new FakeFeedRepository();
    repository.ownUnread = [
      bookmarkRow({ id: "ignored", created_at: daysAgo(2), updated_at: daysAgo(2) }),
      bookmarkRow({ id: "unseen", created_at: daysAgo(2), updated_at: daysAgo(2) }),
    ];
    repository.seen("ignored", 3);

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(page.items.map((item) => item.bookmark!.id)).toEqual([
      "unseen",
      "ignored",
    ]);
  });

  it("drops an item from For you after 5, and keeps it reachable in Unread", async () => {
    const repository = new FakeFeedRepository();
    repository.ownUnread = [
      bookmarkRow({ id: "exhausted" }),
      bookmarkRow({ id: "other" }),
    ];
    repository.seen("exhausted", 5);

    const service = makeService(repository);

    const forYou = await service.getFeed(VIEWER, { scope: "for_you", now: NOW });
    expect(forYou.items.map((item) => item.bookmark!.id)).not.toContain(
      "exhausted"
    );

    // Still there, in the order it was saved. This is the half of the promise
    // that is easy to lose: the item stops being pushed, it is not hidden.
    const unread = await service.getFeed(VIEWER, { scope: "unread", now: NOW });
    expect(unread.items.map((item) => item.bookmark!.id)).toContain("exhausted");
  });

  it("stops decaying an item the reader actually opened", async () => {
    // `opened_at` is what ends the decay. Without this, a link opened on the
    // sixth impression would still be dropped, which punishes the success case.
    const repository = new FakeFeedRepository();
    repository.ownUnread = [bookmarkRow({ id: "opened" })];
    repository.seen("opened", 9, true);

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(page.items.map((item) => item.bookmark!.id)).toEqual(["opened"]);
  });

  it("counts a serve for every item it hands out", async () => {
    // Nothing above works unless serving is recorded, so this is the pin on the
    // mechanism rather than on the thresholds.
    const repository = new FakeFeedRepository();
    repository.ownUnread = [bookmarkRow({ id: "a" }), bookmarkRow({ id: "b" })];

    await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(repository.recorded.map((entry) => entry.itemId).sort()).toEqual([
      "a",
      "b",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Guarantee 3 — no signal rewards engagement time or popularity alone
// ---------------------------------------------------------------------------

describe("no signal rewards engagement time or popularity alone", () => {
  it("has exactly the six signals the spec names, and no seventh", () => {
    // Asserted against the signal set itself, the way D12 asserted the absence
    // of auto-hide: not "there is no engagement signal" in a comment, but the
    // enumeration of every signal that exists.
    expect([...FEED_SIGNAL_NAMES]).toEqual([
      "topic_affinity",
      "source_affinity",
      "recency",
      "social_proof",
      "effort_fit",
      "novelty",
    ]);

    for (const name of FEED_SIGNAL_NAMES) {
      expect(name).not.toMatch(
        /engagement|dwell|time_on|scroll|trending|popular|views|clicks/
      );
    }

    expect(DEFAULT_FEED_WEIGHTS).toEqual({
      topic_affinity: 0.35,
      source_affinity: 0.15,
      recency: 0.2,
      social_proof: 0.15,
      effort_fit: 0.1,
      novelty: 0.05,
    });
  });

  it("cannot be given a seventh signal by configuration", () => {
    // The weights are tunable without a deploy; the *set* of signals is not.
    // A config row carrying `trending` adds nothing, rather than adding a
    // trending boost.
    const merged = mergeFeedRankingConfig({
      weights: { trending: 0.9, engagement_time: 0.9, topic_affinity: 0.4 },
    });

    expect(Object.keys(merged.weights).sort()).toEqual(
      [...FEED_SIGNAL_NAMES].sort()
    );
    expect(merged.weights.topic_affinity).toBe(0.4);
    // Everything not overridden still falls back to the file.
    expect(merged.weights.recency).toBe(DEFAULT_FEED_WEIGHTS.recency);
    expect(merged.parameters).toEqual(DEFAULT_FEED_RANKING_PARAMETERS);
  });

  it("saturates social proof, so a bigger crowd stops mattering", () => {
    const cap = DEFAULT_FEED_RANKING_PARAMETERS.socialProofCap;

    expect(socialProofScore(0, cap)).toBe(0);
    expect(socialProofScore(cap, cap)).toBe(1);
    // Above the cap it is flat: the ten-thousandth saver moves nothing.
    expect(socialProofScore(10_000, cap)).toBe(1);
    expect(socialProofScore(2, cap)).toBeLessThan(socialProofScore(4, cap));
  });

  it("loses to an item that wins on the reader's own signals", async () => {
    // The property stated as an outcome: an item that maxes out popularity and
    // nothing else must not beat one the reader is actually likely to finish.
    const repository = new FakeFeedRepository();

    const popular = bookmarkRow({
      id: "popular",
      user_id: "22222222-2222-2222-2222-222222222222",
      is_public: true,
      source_url: "https://viral.example/popular",
      created_at: daysAgo(10),
      updated_at: daysAgo(10),
    });

    repository.followed = [
      {
        bookmark: popular,
        author: {
          id: "22222222-2222-2222-2222-222222222222",
          handle: "maya",
          name: "Maya",
          picture_url: null,
          created_at: daysAgo(200),
        } as FollowedSaveRow["author"],
      },
    ];
    repository.socialProof = [
      { bookmarkId: "popular", reshares: 500, likes: 5000 },
    ];

    repository.ownUnread = [
      bookmarkRow({
        id: "relevant",
        source_url: "https://every.to/relevant",
        created_at: daysAgo(10),
        updated_at: daysAgo(10),
      }),
    ];
    repository.similarity.set("relevant", 0.9);
    repository.saveOutcomes = Array.from({ length: 10 }, () => ({
      sourceUrl: "https://every.to/x",
      read: true,
    }));

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(page.items[0].bookmark!.id).toBe("relevant");
  });

  it("counts only people the viewer follows", async () => {
    // The repository's social-proof query is scoped to the follow graph, so
    // there is no global count anywhere for a popularity signal to read. This
    // pins it at the source, where a well-meaning `count(*)` would land.
    const source = await Bun.file(
      repoPath("packages/shared/src/repositories/feed.repository.ts")
    ).text();
    const query = source.match(/async findSocialProof\([\s\S]*?\n {2}\}/)?.[0];

    expect(query).toContain("followed");
    expect(query).toContain("follower_id = ");
    expect(query).not.toMatch(/dwell|engagement|time_spent/i);
  });
});

// ---------------------------------------------------------------------------
// The rest of the ranker's contract
// ---------------------------------------------------------------------------

describe("pending items", () => {
  it("pin to the top regardless of score", async () => {
    const repository = new FakeFeedRepository();
    // A pending save from a month ago: last on every signal there is.
    repository.pending = [
      bookmarkRow({
        id: "pending",
        processing_status: "processing",
        created_at: daysAgo(60),
        updated_at: daysAgo(60),
      }),
    ];
    repository.ownUnread = [
      bookmarkRow({ id: "hot", created_at: NOW, updated_at: NOW }),
    ];
    repository.similarity.set("hot", 1);

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    expect(page.items[0].type).toBe("pending");
    expect(page.items[0].bookmark!.id).toBe("pending");
    expect(page.items[1].bookmark!.id).toBe("hot");
  });
});

describe("author diversity", () => {
  it("allows at most 2 consecutive items from one person or domain", () => {
    const run = [
      { authorId: "a", domain: "one.com" },
      { authorId: "a", domain: "one.com" },
      { authorId: "a", domain: "one.com" },
      { authorId: "a", domain: "one.com" },
      { authorId: "b", domain: "two.com" },
      { authorId: "c", domain: "three.com" },
    ];

    const spaced = applyAuthorDiversity(
      run,
      DEFAULT_FEED_RANKING_PARAMETERS.maxConsecutiveFromSource
    );

    // Nothing is dropped — a run is a bad order, not bad items.
    expect(spaced).toHaveLength(run.length);

    let longest = 1;
    let current = 1;
    for (let i = 1; i < spaced.length; i += 1) {
      current = spaced[i].authorId === spaced[i - 1].authorId ? current + 1 : 1;
      longest = Math.max(longest, current);
    }
    expect(longest).toBeLessThanOrEqual(2);
  });

  it("spaces a run of same-domain saves in a real ranking", async () => {
    const repository = new FakeFeedRepository();
    repository.ownUnread = [
      bookmarkRow({ id: "d1", source_url: "https://same.com/1" }),
      bookmarkRow({ id: "d2", source_url: "https://same.com/2" }),
      bookmarkRow({ id: "d3", source_url: "https://same.com/3" }),
      bookmarkRow({ id: "other", source_url: "https://elsewhere.com/1" }),
    ];

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });
    const domains = page.items.map((item) =>
      new URL(item.bookmark!.sourceUrl).hostname
    );

    let longest = 1;
    let current = 1;
    for (let i = 1; i < domains.length; i += 1) {
      current = domains[i] === domains[i - 1] ? current + 1 : 1;
      longest = Math.max(longest, current);
    }
    expect(longest).toBeLessThanOrEqual(2);
  });
});

describe("the candidate set", () => {
  it("is capped at 500", async () => {
    expect(DEFAULT_FEED_RANKING_PARAMETERS.candidateCap).toBe(500);

    const repository = new FakeFeedRepository();
    repository.ownUnread = Array.from({ length: 900 }, (_, index) =>
      bookmarkRow({
        id: `b-${String(index).padStart(4, "0")}`,
        created_at: daysAgo(index / 24),
        updated_at: daysAgo(index / 24),
      })
    );

    const service = makeService(repository);
    let page = await service.getFeed(VIEWER, {
      limit: FEED_PAGE_MAX_LIMIT,
      now: NOW,
    });

    // The cap is asked for at the query, so an unbounded library never reaches
    // the ranker in the first place.
    expect(repository.ownUnreadLimits).toContain(500);
    expect(page.items.length).toBe(FEED_PAGE_MAX_LIMIT);

    // And it holds all the way through paging: the whole session is 500 items
    // long, not 900. Paged through the cursor rather than read off the session,
    // because the cap the reader experiences is the one that matters.
    const seen = new Set(page.items.map((item) => item.bookmark!.id));
    while (page.nextCursor) {
      page = await service.getFeed(VIEWER, {
        limit: FEED_PAGE_MAX_LIMIT,
        cursor: page.nextCursor,
        now: NOW,
      });
      for (const item of page.items) seen.add(item.bookmark!.id);
    }

    expect(seen.size).toBe(500);
  });

  it("excludes authors the viewer has blocked", async () => {
    const blockedAuthor = "33333333-3333-3333-3333-333333333333";
    const repository = new FakeFeedRepository();
    repository.followed = [
      {
        bookmark: bookmarkRow({
          id: "blocked",
          user_id: blockedAuthor,
          is_public: true,
        }),
        author: {
          id: blockedAuthor,
          handle: "blocked",
          name: "Blocked",
          picture_url: null,
          created_at: daysAgo(200),
        } as FollowedSaveRow["author"],
      },
    ];

    const page = await makeService(repository, [blockedAuthor]).getFeed(VIEWER, {
      now: NOW,
    });

    expect(page.items).toHaveLength(0);
  });
});

describe("the cache", () => {
  it("keeps the ranked head warm for five minutes", async () => {
    expect(DEFAULT_FEED_RANKING_PARAMETERS.cacheTtlSeconds).toBe(300);

    const repository = new FakeFeedRepository();
    repository.ownUnread = [bookmarkRow({ id: "a" })];
    const service = makeService(repository);

    const first = await service.getFeed(VIEWER, { now: NOW });
    expect(first.metrics.cacheHit).toBe(false);

    const within = await service.getFeed(VIEWER, {
      now: new Date(NOW.getTime() + 4 * 60 * 1000),
    });
    expect(within.metrics.cacheHit).toBe(true);
    expect(within.computedAt).toEqual(first.computedAt);

    const after = await service.getFeed(VIEWER, {
      now: new Date(NOW.getTime() + 6 * 60 * 1000),
    });
    expect(after.metrics.cacheHit).toBe(false);
    expect(after.computedAt).not.toEqual(first.computedAt);
  });

  it("prepends a newly saved bookmark rather than serving past it", async () => {
    const repository = new FakeFeedRepository();
    repository.ownUnread = [bookmarkRow({ id: "old" })];
    const service = makeService(repository);

    await service.getFeed(VIEWER, { now: NOW });

    const later = new Date(NOW.getTime() + 60 * 1000);
    repository.ownUnread = [
      bookmarkRow({ id: "brand-new", created_at: later, updated_at: later }),
      ...repository.ownUnread,
    ];

    const page = await service.getFeed(VIEWER, { now: later });

    // Still a cache hit — the head was not recomputed — and the save the user
    // just made is nevertheless first.
    expect(page.metrics.cacheHit).toBe(true);
    expect(page.items[0].bookmark!.id).toBe("brand-new");
  });
});

describe("the feed cursor", () => {
  it("round-trips, and pages without repeating an item", async () => {
    const repository = new FakeFeedRepository();
    repository.ownUnread = Array.from({ length: 25 }, (_, index) =>
      bookmarkRow({
        id: `p-${String(index).padStart(2, "0")}`,
        created_at: daysAgo(index),
        updated_at: daysAgo(index),
      })
    );

    const service = makeService(repository);

    const first = await service.getFeed(VIEWER, { limit: 20, now: NOW });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();

    const encoded = encodeFeedCursor(first.nextCursor!);
    const decoded = decodeFeedCursor(encoded, "for_you");
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.cursor).toEqual(first.nextCursor!);

    const second = await service.getFeed(VIEWER, {
      limit: 20,
      cursor: decoded.ok ? decoded.cursor : null,
      now: NOW,
    });

    const firstIds = first.items.map((item) => item.bookmark!.id);
    const secondIds = second.items.map((item) => item.bookmark!.id);
    expect(secondIds).toHaveLength(5);
    expect(firstIds.filter((id) => secondIds.includes(id))).toHaveLength(0);
    expect(second.nextCursor).toBeNull();
  });

  it("refuses a cursor produced under a different scope", () => {
    // Replaying a For you cursor against Following would index into an ordering
    // built from a different candidate set — a page of items in an order nobody
    // computed. It is a 400, not a best effort.
    const encoded = encodeFeedCursor({
      scope: "for_you",
      session: "session-1",
      position: 20,
    });

    const wrong = decodeFeedCursor(encoded, "following");
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.error).toBe(
      "Cursor does not match the requested scope"
    );

    expect(decodeFeedCursor("not-a-cursor", "for_you").ok).toBe(false);
    expect(
      decodeFeedCursor(
        Buffer.from(JSON.stringify({ s: "for_you", t: "x", p: -1 })).toString(
          "base64url"
        ),
        "for_you"
      ).ok
    ).toBe(false);
  });

  it("is the only paging the query accepts", () => {
    const parsed = feedQuerySchema.safeParse({});
    expect(parsed.success && parsed.data).toEqual({
      scope: "for_you",
      limit: FEED_PAGE_DEFAULT_LIMIT,
    });
    expect(FEED_PAGE_DEFAULT_LIMIT).toBe(20);

    // No `offset` in the schema, so an offset cannot survive validation into
    // the handler even if a stale client sends one.
    const withOffset = feedQuerySchema.safeParse({ offset: 40 });
    expect(withOffset.success && withOffset.data).not.toHaveProperty("offset");

    expect(feedQuerySchema.safeParse({ scope: "unread" }).success).toBe(true);
    expect(feedQuerySchema.safeParse({ scope: "trending" }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(
      feedQuerySchema.safeParse({ limit: FEED_PAGE_MAX_LIMIT + 1 }).success
    ).toBe(false);
  });

  it("is gone from the contract as an offset", async () => {
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/bookmarks.tsp")
    ).text();
    const query = typeSpec.match(/model GetFeedQuery \{[\s\S]*?\n\}/)?.[0];

    expect(query).toContain("cursor?: string;");
    expect(query).not.toMatch(/offset/i);
    expect(typeSpec).toMatch(/model FeedResponse \{[\s\S]*computedAt: utcDateTime;/);
  });
});

describe("the scopes", () => {
  it("gives Unread the user's own saves, chronologically and unranked", async () => {
    const repository = new FakeFeedRepository();
    repository.ownUnread = [
      bookmarkRow({ id: "newest", created_at: daysAgo(1), updated_at: daysAgo(1) }),
      bookmarkRow({ id: "middle", created_at: daysAgo(5), updated_at: daysAgo(5) }),
      bookmarkRow({ id: "oldest", created_at: daysAgo(9), updated_at: daysAgo(9) }),
    ];
    // Signals that would reorder a ranked scope, and must not reorder this one.
    repository.similarity.set("oldest", 1);

    const page = await makeService(repository).getFeed(VIEWER, {
      scope: "unread",
      now: NOW,
    });

    expect(page.items.map((item) => item.bookmark!.id)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
    expect(page.items.every((item) => item.rankingReason === undefined)).toBe(
      true
    );
  });

  it("gives Following only followed saves", async () => {
    const author = "44444444-4444-4444-4444-444444444444";
    const repository = new FakeFeedRepository();
    repository.ownUnread = [bookmarkRow({ id: "mine" })];
    repository.followed = [
      {
        bookmark: bookmarkRow({ id: "theirs", user_id: author, is_public: true }),
        author: {
          id: author,
          handle: "maya",
          name: "Maya",
          picture_url: null,
          created_at: daysAgo(200),
        } as FollowedSaveRow["author"],
      },
    ];

    const page = await makeService(repository).getFeed(VIEWER, {
      scope: "following",
      now: NOW,
    });

    expect(page.items.map((item) => item.bookmark!.id)).toEqual(["theirs"]);
    expect(page.items[0].actor?.handle).toBe("maya");
    expect(page.items[0].type).toBe("followed_save");
  });
});

describe("the ranking configuration", () => {
  it("takes its weights from the environment's row, falling back to the file", async () => {
    const repository = new FakeFeedRepository();
    repository.rankingConfig = {
      weights: { recency: 0.9 },
      parameters: { seenDropAfter: 1 },
    };
    repository.ownUnread = [
      bookmarkRow({ id: "seen-once" }),
      bookmarkRow({ id: "unseen" }),
    ];
    repository.seen("seen-once", 1);

    const page = await makeService(repository).getFeed(VIEWER, { now: NOW });

    // The row moved a threshold without a deploy: one unopened serve now drops.
    expect(page.items.map((item) => item.bookmark!.id)).toEqual(["unseen"]);
  });

  it("survives a row that is nonsense", () => {
    const merged = mergeFeedRankingConfig({
      weights: { recency: "high", topic_affinity: -1, novelty: 0.5 },
      parameters: { pageSize: 0, candidateCap: 100 },
    });

    expect(merged.weights.recency).toBe(DEFAULT_FEED_WEIGHTS.recency);
    expect(merged.weights.topic_affinity).toBe(DEFAULT_FEED_WEIGHTS.topic_affinity);
    expect(merged.weights.novelty).toBe(0.5);
    expect(merged.parameters.pageSize).toBe(
      DEFAULT_FEED_RANKING_PARAMETERS.pageSize
    );
    expect(merged.parameters.candidateCap).toBe(100);
    expect(mergeFeedRankingConfig(null).weights).toEqual(DEFAULT_FEED_WEIGHTS);
  });
});

describe("marking a bookmark read", () => {
  it("tells the ranker the reader went in", async () => {
    const repository = new FakeFeedRepository();
    await makeService(repository).recordOpen(VIEWER, "opened-one");
    expect(repository.opened).toEqual(["opened-one"]);
  });

  it("never turns a failed impression write into a failed read", async () => {
    const repository = new FakeFeedRepository();
    repository.markOpened = async () => {
      throw new Error("database is on fire");
    };

    // Resolves rather than rejects: a read that returned 500 is a broken
    // product, and a missing impression is a slightly worse ranking.
    await expect(
      makeService(repository).recordOpen(VIEWER, "x")
    ).resolves.toBeUndefined();
  });
});
