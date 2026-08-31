import { describe, it, expect } from "bun:test";
import path from "node:path";
import {
  DEFAULT_DIGEST_CONFIG,
  DigestRepositoryImpl,
  DigestServiceImpl,
  assessCluster,
  cosineSimilarity,
  findBestCluster,
  type AI,
  type CreateDigestInput,
  type DigestCandidateSave,
  type DigestRepository,
  type DigestSourceRow,
  type FeedDigestRow,
} from "@cosmic-dolphin/shared";

/**
 * D15's two promises, tested where they are actually implemented.
 *
 *  - **A digest names every bookmark it was built from.** Asserted on the
 *    digest the service produces, not on the mapper alone: the promise is that
 *    the sources reach the reader, and a unit test of `mapDigestSources` would
 *    still pass if the generator wrote three ids and the cluster had five.
 *  - **An incoherent cluster produces nothing.** Asserted twice over, because
 *    there are two independent gates and either one must be able to stop the
 *    run on its own: the geometry, which is a pure function over vectors, and
 *    the model's refusal. The geometry test also asserts that **the model was
 *    never asked** — a weak cluster that reaches a prompt is a weak cluster
 *    that comes back as a digest, because a model told to summarise a group
 *    will summarise it.
 *
 * The third promise — two digests never appear within one screenful — is D14's
 * spacing pass and is asserted in `feed.test.ts`, against a feed that now
 * actually contains digests.
 *
 * Everything below runs on 4-dimension vectors and an in-memory repository.
 * No database, no model.
 */

const VIEWER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-08-28T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Vectors, by angle, so a test can state the similarity it wants
// ---------------------------------------------------------------------------

/** A unit vector `deg` degrees off the x axis. `cos(a - b)` is their similarity. */
function unit(deg: number): number[] {
  const radians = (deg * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians), 0, 0];
}

let saveCounter = 0;

function save(
  deg: number,
  overrides: Partial<DigestCandidateSave> = {}
): DigestCandidateSave {
  saveCounter += 1;
  const id = `bk-${String(saveCounter).padStart(4, "0")}`;
  return {
    bookmarkId: id,
    title: `Save ${id}`,
    url: `https://source-${saveCounter}.example/${id}`,
    tags: ["agents"],
    createdAt: NOW,
    summary: "A summary.",
    embedding: unit(deg),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// An in-memory digest repository
// ---------------------------------------------------------------------------

class FakeDigestRepository implements DigestRepository {
  candidateSaves: DigestCandidateSave[] = [];
  alreadyDigested = new Set<string>();
  recentDigest = false;
  rows = new Map<string, FeedDigestRow>();
  likes = new Set<string>();

  /** Every method called, in order — how "share touches nothing else" is asserted. */
  calls: string[] = [];
  created: CreateDigestInput[] = [];

  async findById(digestId: string): Promise<FeedDigestRow | null> {
    this.calls.push("findById");
    return this.rows.get(digestId) ?? null;
  }

  async findSources(bookmarkIds: string[]): Promise<DigestSourceRow[]> {
    this.calls.push("findSources");
    // Deliberately returned in a different order from the ids asked for: the
    // digest's own order is the cluster's, and the mapper must impose it.
    return [...bookmarkIds].reverse().map((id) => ({
      id,
      title: `Save ${id}`,
      source_url: `https://source-${id}.example/${id}`,
      metadata: { openGraph: { favicon: `https://source-${id}.example/f.ico` } },
    }));
  }

  async findLikedBy(_userId: string, digestIds: string[]): Promise<Set<string>> {
    this.calls.push("findLikedBy");
    return new Set(digestIds.filter((id) => this.likes.has(id)));
  }

  async create(input: CreateDigestInput): Promise<FeedDigestRow> {
    this.calls.push("create");
    this.created.push(input);

    const row: FeedDigestRow = {
      id: `dg-${this.created.length}`,
      user_id: input.userId,
      title: input.title,
      summary: input.summary,
      key_points: input.keyPoints,
      source_bookmark_ids: input.sourceBookmarkIds,
      coherence: input.coherence,
      model_id: input.modelId,
      window_start: input.windowStart,
      window_end: input.windowEnd,
      is_public: false,
      share_slug: null,
      like_count: 0,
      created_at: NOW,
      updated_at: NOW,
    };

    this.rows.set(row.id, row);
    return row;
  }

  async like(userId: string, digestId: string): Promise<number> {
    this.calls.push("like");
    this.likes.add(digestId);
    const row = this.rows.get(digestId);
    if (row) row.like_count += 1;
    return row?.like_count ?? 0;
  }

  async unlike(_userId: string, digestId: string): Promise<number> {
    this.calls.push("unlike");
    this.likes.delete(digestId);
    const row = this.rows.get(digestId);
    if (row) row.like_count = Math.max(0, row.like_count - 1);
    return row?.like_count ?? 0;
  }

  async share(digestId: string, userId: string): Promise<FeedDigestRow | null> {
    this.calls.push("share");
    const row = this.rows.get(digestId);
    if (!row || row.user_id !== userId) return null;
    row.is_public = true;
    row.share_slug = row.share_slug ?? "abcdef0123456789";
    return row;
  }

  async unshare(digestId: string, userId: string): Promise<FeedDigestRow | null> {
    this.calls.push("unshare");
    const row = this.rows.get(digestId);
    if (!row || row.user_id !== userId) return null;
    row.is_public = false;
    return row;
  }

  async findUsersDueForDigest(): Promise<string[]> {
    this.calls.push("findUsersDueForDigest");
    return [];
  }

  async hasRecentDigest(): Promise<boolean> {
    this.calls.push("hasRecentDigest");
    return this.recentDigest;
  }

  async findCandidateSaves(): Promise<DigestCandidateSave[]> {
    this.calls.push("findCandidateSaves");
    return this.candidateSaves;
  }

  async findRecentlyDigestedBookmarkIds(): Promise<Set<string>> {
    this.calls.push("findRecentlyDigestedBookmarkIds");
    return this.alreadyDigested;
  }
}

/** A model that answers with `response`, and counts how often it was asked. */
function fakeAi(response: unknown): { ai: AI; asked: () => number } {
  let calls = 0;
  const ai = {
    async newSession(refID: string) {
      return { sessionID: "session-1", refID };
    },
    async generateObject() {
      calls += 1;
      return response;
    },
  } as unknown as AI;

  return { ai, asked: () => calls };
}

const GOOD_ANSWER = {
  coherent: true,
  title: "Four of your saves are circling the same argument",
  summary: "They all push back on scale-first agent design.",
  keyPoints: [
    { term: "Memory beats context.", text: "Three of them say episodic state is the limit." },
    { term: null, text: "Evaluation is unresolved." },
  ],
};

function makeService(
  repository: FakeDigestRepository,
  response: unknown = GOOD_ANSWER
) {
  const { ai, asked } = fakeAi(response);
  return {
    service: new DigestServiceImpl(repository, ai),
    asked,
  };
}

function repoPath(relativePath: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join("apps", "api"))
    ? path.resolve(cwd, "../..")
    : cwd;

  return path.join(root, relativePath);
}

// ---------------------------------------------------------------------------
// Guarantee 1 — a digest names every bookmark it was built from
// ---------------------------------------------------------------------------

describe("a digest names every bookmark it was built from", () => {
  it("writes every member of the cluster as a source", async () => {
    const repository = new FakeDigestRepository();
    // Four tight saves, four different domains.
    repository.candidateSaves = [save(0), save(3), save(6), save(9)];
    const { service } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;

    const cluster = repository.created[0];
    expect(cluster.sourceBookmarkIds.length).toBe(4);

    // Not "some of them", not "the first three": the ids written are exactly
    // the ids the observation was computed from.
    expect(new Set(cluster.sourceBookmarkIds)).toEqual(
      new Set(repository.candidateSaves.map((entry) => entry.bookmarkId))
    );

    // And they reach the reader, in the cluster's order, each one a link.
    expect(result.digest.sources.map((source) => source.bookmarkId)).toEqual(
      cluster.sourceBookmarkIds
    );
    for (const source of result.digest.sources) {
      expect(source.url).toContain("https://");
      expect(source.domain).not.toBe("");
    }
  });

  it("never stores fewer sources than it was built from", async () => {
    const repository = new FakeDigestRepository();
    repository.candidateSaves = [save(0), save(2), save(4), save(6), save(8)];
    const { service } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;

    // The `Built from` row shows three and tails the rest, but the payload is
    // complete — the truncation is a display decision, never a storage one.
    expect(result.digest.sources.length).toBe(
      repository.created[0].sourceBookmarkIds.length
    );
    expect(result.digest.sources.length).toBeGreaterThanOrEqual(3);
  });

  it("refuses to create a digest with fewer than three sources", async () => {
    // The real repository, and no database: the guard runs before the insert
    // does, on purpose, so a generator bug reads "a digest needs at least 3
    // source bookmarks" rather than surfacing as a CHECK constraint name.
    //
    // The service cannot reach this state — `minClusterSize` stops it — but
    // this is the floor under the next caller, which will not know the rule.
    const real = new DigestRepositoryImpl(null as never);

    await expect(
      real.create({
        userId: VIEWER,
        title: "t",
        summary: "s",
        keyPoints: [],
        sourceBookmarkIds: ["a", "b"],
        coherence: 0.9,
        modelId: null,
        windowStart: NOW,
        windowEnd: NOW,
      })
    ).rejects.toThrow(/at least 3 source bookmarks/);
  });
});

// ---------------------------------------------------------------------------
// Guarantee 2 — an incoherent cluster produces nothing
// ---------------------------------------------------------------------------

describe("an incoherent cluster produces nothing", () => {
  it("produces no digest, and never asks the model, when the geometry fails", async () => {
    const repository = new FakeDigestRepository();
    // A seed with two neighbours that are close to it and far from each other:
    // 0.79 to the seed, 0.25 to one another. The neighbourhood exists; the
    // cluster does not.
    repository.candidateSaves = [save(0), save(37.8), save(-37.8)];
    const { service, asked } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("skipped");
    if (result.outcome !== "skipped") return;
    expect(result.reason).toBe("no_coherent_cluster");
    expect(result.coherence).toBeLessThan(DEFAULT_DIGEST_CONFIG.coherence);

    // The part that matters most. A weak cluster that reaches a prompt comes
    // back as a digest, because a model asked to find a pattern finds one.
    expect(asked()).toBe(0);
    expect(repository.created.length).toBe(0);
  });

  it("produces no digest when the saves are unrelated to each other", async () => {
    const repository = new FakeDigestRepository();
    repository.candidateSaves = [save(0), save(90), save(180), save(270)];
    const { service, asked } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("skipped");
    expect(asked()).toBe(0);
    expect(repository.created.length).toBe(0);
  });

  it("produces no digest when the model declines a cluster that passed the geometry", async () => {
    const repository = new FakeDigestRepository();
    repository.candidateSaves = [save(0), save(3), save(6)];
    const { service, asked } = makeService(repository, {
      coherent: false,
      title: "",
      summary: "",
      keyPoints: [],
    });

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("skipped");
    if (result.outcome !== "skipped") return;
    expect(result.reason).toBe("model_declined");
    // The geometry passed — the model was asked and said no. Two independent
    // gates, either one sufficient.
    expect(asked()).toBe(1);
    expect(repository.created.length).toBe(0);
  });

  it("produces no digest when the model says yes with nothing behind it", async () => {
    const repository = new FakeDigestRepository();
    repository.candidateSaves = [save(0), save(3), save(6)];
    const { service } = makeService(repository, {
      coherent: true,
      title: "Something",
      summary: "Something else",
      keyPoints: [{ term: null, text: "Only one finding." }],
    });

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("skipped");
    if (result.outcome !== "skipped") return;
    expect(result.reason).toBe("model_incomplete");
    expect(repository.created.length).toBe(0);
  });

  it("produces no digest when there is nothing to cluster", async () => {
    const repository = new FakeDigestRepository();
    repository.candidateSaves = [save(0), save(2)];
    const { service, asked } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("skipped");
    if (result.outcome !== "skipped") return;
    expect(result.reason).toBe("not_enough_saves");
    expect(asked()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The threshold itself — explicit, not implicit
// ---------------------------------------------------------------------------

describe("the coherence threshold", () => {
  it("is a number in configuration, not a literal in a loop", () => {
    expect(DEFAULT_DIGEST_CONFIG.coherence).toBeGreaterThan(0);
    expect(DEFAULT_DIGEST_CONFIG.coherence).toBeLessThanOrEqual(1);
    expect(DEFAULT_DIGEST_CONFIG.minPairSimilarity).toBeLessThan(
      DEFAULT_DIGEST_CONFIG.coherence
    );
    expect(DEFAULT_DIGEST_CONFIG.minClusterSize).toBe(3);
    expect(DEFAULT_DIGEST_CONFIG.maxClusterSize).toBe(6);
  });

  it("passes a tight cluster and fails a loose one at the same size", () => {
    const tight = assessCluster(
      [save(0), save(3), save(6)],
      DEFAULT_DIGEST_CONFIG
    );
    expect(tight.coherent).toBe(true);
    expect(tight.coherence).toBeGreaterThanOrEqual(
      DEFAULT_DIGEST_CONFIG.coherence
    );

    const loose = assessCluster(
      [save(0), save(40), save(80)],
      DEFAULT_DIGEST_CONFIG
    );
    expect(loose.coherent).toBe(false);
    expect(loose.coherence).toBeLessThan(DEFAULT_DIGEST_CONFIG.coherence);
  });

  it("does not let a good average carry one unrelated save", () => {
    // Three tight, one at 46 degrees. Mean pairwise clears the bar; the
    // weakest pair does not, and that is the gate a mean alone cannot see.
    const assessment = assessCluster(
      [save(0), save(5), save(10), save(46)],
      DEFAULT_DIGEST_CONFIG
    );

    expect(assessment.coherence).toBeGreaterThanOrEqual(
      DEFAULT_DIGEST_CONFIG.coherence
    );
    expect(assessment.weakestPair).toBeLessThan(
      DEFAULT_DIGEST_CONFIG.minPairSimilarity
    );
    expect(assessment.coherent).toBe(false);
  });

  it("does not call one blog's output a pattern in someone's reading", () => {
    const onlyDomain = "https://oneblog.example/";
    const assessment = assessCluster(
      [
        save(0, { url: `${onlyDomain}a` }),
        save(3, { url: `${onlyDomain}b` }),
        save(6, { url: `${onlyDomain}c` }),
      ],
      DEFAULT_DIGEST_CONFIG
    );

    expect(assessment.coherence).toBeGreaterThanOrEqual(
      DEFAULT_DIGEST_CONFIG.coherence
    );
    expect(assessment.distinctDomains).toBe(1);
    expect(assessment.coherent).toBe(false);
  });

  it("caps a cluster at six however many neighbours a seed has", () => {
    const saves = Array.from({ length: 12 }, (_, index) => save(index * 0.5));
    const cluster = findBestCluster(saves, DEFAULT_DIGEST_CONFIG);

    expect(cluster).not.toBeNull();
    expect(cluster!.members.length).toBeLessThanOrEqual(
      DEFAULT_DIGEST_CONFIG.maxClusterSize
    );
    expect(cluster!.coherent).toBe(true);
  });

  it("is deterministic: the same window produces the same cluster", () => {
    const saves = [save(0), save(4), save(8), save(70), save(140)];
    const first = findBestCluster(saves, DEFAULT_DIGEST_CONFIG);
    const second = findBestCluster([...saves].reverse(), DEFAULT_DIGEST_CONFIG);

    expect(first!.members.map((m) => m.bookmarkId).sort()).toEqual(
      second!.members.map((m) => m.bookmarkId).sort()
    );
  });

  it("treats an unwritten embedding as unrelated rather than as agreement", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [0, 0])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The same cluster does not come back every night
// ---------------------------------------------------------------------------

describe("repetition", () => {
  it("skips a user who already has a digest inside the cooldown", async () => {
    const repository = new FakeDigestRepository();
    repository.recentDigest = true;
    repository.candidateSaves = [save(0), save(3), save(6)];
    const { service, asked } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });

    expect(result.outcome).toBe("skipped");
    if (result.outcome !== "skipped") return;
    expect(result.reason).toBe("cooldown");
    expect(asked()).toBe(0);
    // At-least-once delivery means the job, not the queue, has to refuse.
    expect(repository.created.length).toBe(0);
  });

  it("does not reuse a save that is already in a recent digest", async () => {
    const repository = new FakeDigestRepository();
    const saves = [save(0), save(3), save(6)];
    repository.candidateSaves = saves;
    repository.alreadyDigested = new Set([saves[0].bookmarkId]);
    const { service } = makeService(repository);

    const result = await service.generateForUser(VIEWER, { now: NOW });

    // Two eligible saves left, which is not a cluster.
    expect(result.outcome).toBe("skipped");
  });
});

// ---------------------------------------------------------------------------
// A first-class social object
// ---------------------------------------------------------------------------

describe("digests as social objects", () => {
  async function createOne(repository: FakeDigestRepository) {
    repository.candidateSaves = [save(0), save(3), save(6)];
    const { service } = makeService(repository);
    const result = await service.generateForUser(VIEWER, { now: NOW });
    if (result.outcome !== "created") throw new Error("expected a digest");
    return { service, digest: result.digest };
  }

  it("hides a private digest from everyone but its owner", async () => {
    const repository = new FakeDigestRepository();
    const { service, digest } = await createOne(repository);

    expect(await service.findForViewer(digest.id, VIEWER)).not.toBeNull();
    // Not a 403: a private digest does not confirm its own existence.
    expect(await service.findForViewer(digest.id, OTHER)).toBeNull();
  });

  it("shows a shared digest to everyone", async () => {
    const repository = new FakeDigestRepository();
    const { service, digest } = await createOne(repository);

    await service.share(digest.id, VIEWER);

    const seen = await service.findForViewer(digest.id, OTHER);
    expect(seen).not.toBeNull();
    expect(seen!.isPublic).toBe(true);
    expect(seen!.shareUrl).toContain("/s/d/");
  });

  it("refuses to share someone else's digest, and does not say it exists", async () => {
    const repository = new FakeDigestRepository();
    const { service, digest } = await createOne(repository);

    expect(await service.share(digest.id, OTHER)).toBeNull();
    expect(repository.rows.get(digest.id)!.is_public).toBe(false);
  });

  it("shares the digest and touches nothing else", async () => {
    const repository = new FakeDigestRepository();
    const { service, digest } = await createOne(repository);

    repository.calls = [];
    await service.share(digest.id, VIEWER);

    // Resharing a digest saves the digest, not its sources. The whole of the
    // share path is one write to `feed_digests`: the source bookmarks are not
    // read, not updated, and not published.
    expect(repository.calls).toEqual(["share"]);
  });

  it("likes and unlikes, and reports the state back", async () => {
    const repository = new FakeDigestRepository();
    const { service, digest } = await createOne(repository);

    const liked = await service.like(VIEWER, digest.id);
    expect(liked).toEqual({ likeCount: 1, isLikedByCurrentUser: true });

    const unliked = await service.unlike(VIEWER, digest.id);
    expect(unliked).toEqual({ likeCount: 0, isLikedByCurrentUser: false });
  });

  it("will not let a stranger like a private digest", async () => {
    const repository = new FakeDigestRepository();
    const { service, digest } = await createOne(repository);

    expect(await service.like(OTHER, digest.id)).toBeNull();
    expect(repository.rows.get(digest.id)!.like_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

describe("the digest contract", () => {
  it("gives a digest its own routes, likes and share link", async () => {
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/digests.tsp")
    ).text();

    expect(typeSpec).toContain('@route("/{id}")');
    expect(typeSpec).toContain('@route("/{id}/like")');
    expect(typeSpec).toContain('@route("/{id}/share")');
    expect(typeSpec).toContain("@put");
    expect(typeSpec).toContain("@delete");
  });

  it("makes the sources part of the digest, not an extra request", async () => {
    // The `Built from` row cannot be optional and cannot be a second fetch: a
    // provenance row the client has to go and get is a provenance row that is
    // missing while it loads.
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/digests.tsp")
    ).text();
    const digest = typeSpec.match(/model Digest \{[\s\S]*?\n\}/)?.[0];

    expect(digest).toContain("sources: DigestSource[];");
    expect(digest).not.toMatch(/sources\?:/);

    const source = typeSpec.match(/model DigestSource \{[\s\S]*?\n\}/)?.[0];
    expect(source).toContain("bookmarkId: string;");
    expect(source).toContain("url: string;");
    expect(source).toContain("domain: string;");
  });

  it("carries the digest on the feed item, in place of the bookmark", async () => {
    const typeSpec = await Bun.file(
      repoPath("packages/apispec/bookmarks.tsp")
    ).text();
    const feedItem = typeSpec.match(/model FeedItem \{[\s\S]*?\n\}/)?.[0];

    expect(feedItem).toContain("bookmark?: Bookmark;");
    expect(feedItem).toContain("digest?: Digest;");
  });

  it("adds the digest table with its index and owner-unless-public RLS", async () => {
    const migration = await Bun.file(
      repoPath("supabase/migrations/20260828000004_add_feed_digests.sql")
    ).text();

    expect(migration).toContain("CREATE TABLE feed_digests");
    expect(migration).toContain("ALTER TABLE feed_digests ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("USING (user_id = auth.uid() OR is_public = true)");
    expect(migration).toContain("CREATE INDEX idx_feed_digests_user_recent");

    // The provenance guarantee, at storage level: a digest cannot be stored
    // without naming between three and six sources.
    expect(migration).toContain("source_bookmark_ids uuid[] NOT NULL");
    expect(migration).toMatch(
      /CHECK \(array_length\(source_bookmark_ids, 1\) BETWEEN 3 AND 6\)/
    );
  });

  it("routes the scheduled job through the existing queue, not a new broker", async () => {
    const migration = await Bun.file(
      repoPath("supabase/migrations/20260828000004_add_feed_digests.sql")
    ).text();
    expect(migration).toContain("pgmq.create('digests')");

    const scheduler = await Bun.file(
      repoPath("apps/worker/src/digest/digest-scheduler.service.ts")
    ).text();

    // The tick enqueues; it does not generate. If this file ever calls the
    // digest service directly, the scheduled path stops being the queue path.
    expect(scheduler).toContain("queueService.sendMessage");
    expect(scheduler).not.toContain("generateForUser");
  });
});
