import { describe, it, expect } from "bun:test";
import {
  HandleCooldownError,
  HandleUnavailableError,
  ProfileValidationError,
  PUBLIC_PROFILE_COLUMNS,
  SocialServiceImpl,
  SocialValidationError,
  assertValidHandle,
  handleChangeAvailableAt,
  normaliseHandle,
  type ProfileCountsRow,
  type PublicProfileRow,
  type RelationshipState,
  type SocialKeyset,
  type SocialRepository,
} from "@cosmic-dolphin/shared";
import { RATE_LIMITS } from "../plugins/rate-limit";
import {
  decodeSocialCursor,
  encodeSocialCursor,
  isPossibleHandle,
  socialPageQuerySchema,
} from "../routes/users";
import { updateProfileSchema as profilePatchSchema } from "../routes/profile";

/**
 * D11's three guarantees, tested where they are actually implemented.
 *
 *  - **Following is reciprocal-free and immediate.** There is no pending
 *    state to assert the absence of; what is asserted is that one call flips
 *    the edge and the count, in one direction only.
 *  - **A blocked user cannot see the blocker's public saves.** Enforced in
 *    `SocialService`, which is why an in-memory repository can prove it: the
 *    service asks for the relationship and refuses *before* it asks for rows,
 *    so a repository that would happily hand the rows over still returns
 *    nothing.
 *  - **No public response contains an email.** Asserted structurally — every
 *    public response is walked to its leaves looking for the key — so the test
 *    keeps holding as shapes grow, rather than checking one field on one model.
 */

// ---------------------------------------------------------------------------
// An in-memory social graph
// ---------------------------------------------------------------------------

interface FakeProfile {
  id: string;
  handle: string;
  name: string;
  /**
   * Present on the fake's *storage* on purpose. The whole point of the leak
   * tests below is that the service cannot surface a field the real repository
   * does not select — so the fake has to hold one for the test to mean
   * anything. If a mapper ever starts copying unknown fields through, this is
   * what catches it.
   */
  email: string;
  createdAt: Date;
}

interface FakeSave {
  id: string;
  user_id: string;
  source_url: string;
  title: string;
  is_public: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
  processing_status: string;
  is_private_link: boolean;
}

class FakeSocialRepository implements SocialRepository {
  profiles: FakeProfile[] = [];
  follows: { follower_id: string; following_id: string; created_at: Date }[] = [];
  blocks: { blocker_id: string; blocked_id: string }[] = [];
  saves: FakeSave[] = [];

  /** Set when `listPublicSaves` is reached, so a refusal can be told from an empty library. */
  savesQueried = false;

  private toRow(profile: FakeProfile): PublicProfileRow {
    // Exactly the columns `PUBLIC_PROFILE_COLUMNS` names — no `email`, the
    // same way the real query cannot produce one.
    return {
      id: profile.id,
      handle: profile.handle,
      name: profile.name,
      picture_url: null,
      created_at: profile.createdAt,
    };
  }

  async findPublicProfileByHandle(
    handle: string
  ): Promise<PublicProfileRow | null> {
    const found = this.profiles.find((p) => p.handle === handle);
    return found ? this.toRow(found) : null;
  }

  async findPublicProfileById(id: string): Promise<PublicProfileRow | null> {
    const found = this.profiles.find((p) => p.id === id);
    return found ? this.toRow(found) : null;
  }

  async countsFor(userId: string): Promise<ProfileCountsRow> {
    return {
      followers: this.follows.filter((f) => f.following_id === userId).length,
      following: this.follows.filter((f) => f.follower_id === userId).length,
      publicSaves: this.saves.filter(
        (s) => s.user_id === userId && s.is_public && !s.is_archived
      ).length,
      collections: 0,
    };
  }

  async relationship(
    viewerId: string,
    otherId: string
  ): Promise<RelationshipState> {
    return {
      viewerFollows: this.follows.some(
        (f) => f.follower_id === viewerId && f.following_id === otherId
      ),
      followsViewer: this.follows.some(
        (f) => f.follower_id === otherId && f.following_id === viewerId
      ),
      viewerBlocked: this.blocks.some(
        (b) => b.blocker_id === viewerId && b.blocked_id === otherId
      ),
      blockedViewer: this.blocks.some(
        (b) => b.blocker_id === otherId && b.blocked_id === viewerId
      ),
    };
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    const exists = this.follows.some(
      (f) => f.follower_id === followerId && f.following_id === followingId
    );
    if (exists) return;
    this.follows.push({
      follower_id: followerId,
      following_id: followingId,
      created_at: new Date(),
    });
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    this.follows = this.follows.filter(
      (f) => !(f.follower_id === followerId && f.following_id === followingId)
    );
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (
      !this.blocks.some(
        (b) => b.blocker_id === blockerId && b.blocked_id === blockedId
      )
    ) {
      this.blocks.push({ blocker_id: blockerId, blocked_id: blockedId });
    }

    this.follows = this.follows.filter(
      (f) =>
        !(f.follower_id === blockerId && f.following_id === blockedId) &&
        !(f.follower_id === blockedId && f.following_id === blockerId)
    );
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    this.blocks = this.blocks.filter(
      (b) => !(b.blocker_id === blockerId && b.blocked_id === blockedId)
    );
  }

  async listFollowers(
    userId: string,
    limit: number,
    _cursor?: SocialKeyset | null
  ): Promise<PublicProfileRow[]> {
    return this.follows
      .filter((f) => f.following_id === userId)
      .map((f) => this.profiles.find((p) => p.id === f.follower_id)!)
      .filter(Boolean)
      .map((p) => this.toRow(p))
      .slice(0, limit);
  }

  async listFollowing(
    userId: string,
    limit: number,
    _cursor?: SocialKeyset | null
  ): Promise<PublicProfileRow[]> {
    return this.follows
      .filter((f) => f.follower_id === userId)
      .map((f) => this.profiles.find((p) => p.id === f.following_id)!)
      .filter(Boolean)
      .map((p) => this.toRow(p))
      .slice(0, limit);
  }

  async listPublicSaves(
    userId: string,
    limit: number,
    _cursor?: SocialKeyset | null
  ): Promise<any[]> {
    this.savesQueried = true;
    return this.saves
      .filter((s) => s.user_id === userId && s.is_public && !s.is_archived)
      .slice(0, limit);
  }

  /** Public collections, and the public saves filed in each. */
  collections: {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    created_at: Date;
    save_count: number;
  }[] = [];

  /** `bookmark_likes`, joined to `saves` by `bookmark_id`. */
  likes: {
    id: string;
    user_id: string;
    bookmark_id: string;
    created_at: Date;
  }[] = [];

  collectionsQueried = false;
  likesQueried = false;

  async listPublicCollections(
    userId: string,
    limit: number,
    _cursor?: SocialKeyset | null
  ): Promise<any[]> {
    this.collectionsQueried = true;
    return this.collections
      .filter((c) => c.user_id === userId && c.is_public)
      .slice(0, limit);
  }

  async listLikedPublicBookmarks(
    userId: string,
    limit: number,
    _cursor?: SocialKeyset | null
  ): Promise<any[]> {
    this.likesQueried = true;
    return this.likes
      .filter((like) => like.user_id === userId)
      .map((like) => {
        const save = this.saves.find((s) => s.id === like.bookmark_id);
        if (!save || !save.is_public || save.is_archived) return null;
        return { ...save, liked_at: like.created_at, like_id: like.id };
      })
      .filter(Boolean)
      .slice(0, limit);
  }
}

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

function buildGraph() {
  const repo = new FakeSocialRepository();

  repo.profiles.push(
    {
      id: ALICE,
      handle: "alice",
      name: "Alice",
      email: "alice@example.com",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: BOB,
      handle: "bob",
      name: "Bob",
      email: "bob@example.com",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    }
  );

  repo.saves.push({
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    user_id: ALICE,
    source_url: "https://example.com/one",
    title: "Alice's public save",
    is_public: true,
    is_archived: false,
    created_at: new Date("2026-03-01T00:00:00Z"),
    updated_at: new Date("2026-03-01T00:00:00Z"),
    processing_status: "completed",
    is_private_link: false,
  });

  return { repo, service: new SocialServiceImpl(repo) };
}

/** Every key on the object, however deeply nested. */
function collectKeys(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, into);
    return into;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [key, child] of Object.entries(value)) {
      into.push(key);
      collectKeys(child, into);
    }
  }

  return into;
}

// ---------------------------------------------------------------------------
// Following is reciprocal-free and immediate
// ---------------------------------------------------------------------------

describe("follow", () => {
  it("takes effect on the first call, with no approval step", async () => {
    const { service } = buildGraph();

    const result = await service.follow(BOB, "alice");

    expect(result).toEqual({ following: true, followerCount: 1 });
  });

  it("does not make the followed user follow back", async () => {
    const { service } = buildGraph();

    await service.follow(BOB, "alice");

    const aliceSeenByBob = await service.getPublicProfile("alice", BOB);
    expect(aliceSeenByBob?.isFollowedByViewer).toBe(true);
    // The edge is directed. Alice has not followed Bob by being followed.
    expect(aliceSeenByBob?.followsViewer).toBe(false);

    const bobSeenByAlice = await service.getPublicProfile("bob", ALICE);
    expect(bobSeenByAlice?.isFollowedByViewer).toBe(false);
    expect(bobSeenByAlice?.followsViewer).toBe(true);
  });

  it("is idempotent — following twice is one follower", async () => {
    const { service } = buildGraph();

    await service.follow(BOB, "alice");
    const second = await service.follow(BOB, "alice");

    expect(second?.followerCount).toBe(1);
  });

  it("unfollows immediately", async () => {
    const { service } = buildGraph();

    await service.follow(BOB, "alice");
    const result = await service.unfollow(BOB, "alice");

    expect(result).toEqual({ following: false, followerCount: 0 });
  });

  it("refuses a self-follow", async () => {
    const { service } = buildGraph();

    await expect(service.follow(ALICE, "alice")).rejects.toBeInstanceOf(
      SocialValidationError
    );
  });

  it("answers 404 — not 403 — for a handle that does not exist", async () => {
    const { service } = buildGraph();

    expect(await service.follow(BOB, "nobody")).toBeNull();
  });

  it("is rate limited at 100 an hour, from the shared policy map", () => {
    expect(RATE_LIMITS.follows.name).toBe("follows");
    expect(RATE_LIMITS.follows.max).toBe(100);
    expect(RATE_LIMITS.follows.timeWindow).toBe("1 hour");
  });
});

// ---------------------------------------------------------------------------
// A blocked user cannot see the blocker's public saves
// ---------------------------------------------------------------------------

describe("block", () => {
  it("hides the blocker's public saves from the blocked user", async () => {
    const { repo, service } = buildGraph();

    // Bob can see them to begin with.
    const before = await service.listPublicSaves("alice", { viewerId: BOB });
    expect(before?.bookmarks).toHaveLength(1);

    await service.block(ALICE, "bob");
    repo.savesQueried = false;

    const after = await service.listPublicSaves("alice", { viewerId: BOB });

    // `null`, which the route turns into a 404 — the same answer as "no such
    // handle", so a block is not something the blocked user can detect.
    expect(after).toBeNull();
    // And the refusal happened before the rows were ever asked for.
    expect(repo.savesQueried).toBe(false);
  });

  it("hides the blocker's profile from the blocked user entirely", async () => {
    const { service } = buildGraph();

    await service.block(ALICE, "bob");

    expect(await service.getPublicProfile("alice", BOB)).toBeNull();
    expect(await service.listFollowers("alice", { viewerId: BOB })).toBeNull();
    expect(await service.listFollowing("alice", { viewerId: BOB })).toBeNull();
  });

  it("leaves the blocker's own view of the world intact, minus the content", async () => {
    const { service } = buildGraph();

    await service.block(ALICE, "bob");

    // Alice can still reach Bob's profile — that is where she undoes it.
    const bob = await service.getPublicProfile("bob", ALICE);
    expect(bob?.isBlockedByViewer).toBe(true);
  });

  it("removes both follow edges", async () => {
    const { repo, service } = buildGraph();

    await service.follow(BOB, "alice");
    await service.follow(ALICE, "bob");
    expect(repo.follows).toHaveLength(2);

    await service.block(ALICE, "bob");

    expect(repo.follows).toHaveLength(0);
  });

  it("does not stop the blocked user blocking back", async () => {
    const { service } = buildGraph();

    await service.block(ALICE, "bob");

    // Bob cannot see Alice, and can still block her.
    expect(await service.block(BOB, "alice")).toEqual({ blocked: true });
  });

  it("stops a follow in either direction", async () => {
    const { service } = buildGraph();

    await service.block(ALICE, "bob");

    expect(await service.follow(BOB, "alice")).toBeNull();
    expect(await service.follow(ALICE, "bob")).toBeNull();
  });

  it("refuses a self-block", async () => {
    const { service } = buildGraph();

    await expect(service.block(ALICE, "alice")).rejects.toBeInstanceOf(
      SocialValidationError
    );
  });

  it("unblocking does not restore the follows it deleted", async () => {
    const { repo, service } = buildGraph();

    await service.follow(BOB, "alice");
    await service.block(ALICE, "bob");
    await service.unblock(ALICE, "bob");

    expect(repo.follows).toHaveLength(0);
    // And Bob can see Alice again.
    expect(await service.getPublicProfile("alice", BOB)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No public response contains an email
// ---------------------------------------------------------------------------

describe("email never leaves through a public response", () => {
  it("is absent from a public profile, at any depth", async () => {
    const { service } = buildGraph();

    const profile = await service.getPublicProfile("alice", BOB);

    expect(profile).not.toBeNull();
    expect(collectKeys(profile)).not.toContain("email");
    expect(JSON.stringify(profile)).not.toContain("alice@example.com");
  });

  it("is absent from a follower list", async () => {
    const { service } = buildGraph();
    await service.follow(BOB, "alice");

    const followers = await service.listFollowers("alice", { viewerId: ALICE });

    expect(followers?.profiles).toHaveLength(1);
    expect(collectKeys(followers)).not.toContain("email");
    expect(JSON.stringify(followers)).not.toContain("bob@example.com");
  });

  it("is absent from a following list", async () => {
    const { service } = buildGraph();
    await service.follow(BOB, "alice");

    const following = await service.listFollowing("bob", { viewerId: BOB });

    expect(following?.profiles).toHaveLength(1);
    expect(collectKeys(following)).not.toContain("email");
    expect(JSON.stringify(following)).not.toContain("alice@example.com");
  });

  it("is absent from a page of public saves", async () => {
    const { service } = buildGraph();

    const saves = await service.listPublicSaves("alice", { viewerId: BOB });

    expect(saves?.bookmarks).toHaveLength(1);
    expect(collectKeys(saves)).not.toContain("email");
  });

  it("is not among the columns any public read selects", () => {
    // The structural half of the guarantee: the mapper cannot omit a field the
    // query never fetched.
    expect(PUBLIC_PROFILE_COLUMNS).not.toContain("email" as never);
    expect([...PUBLIC_PROFILE_COLUMNS].sort()).toEqual([
      "created_at",
      "handle",
      "id",
      "name",
      "picture_url",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------

describe("handles", () => {
  it("folds case and trims, rather than refusing", () => {
    expect(normaliseHandle("  Paulo  ")).toBe("paulo");
  });

  it("accepts lowercase letters, digits and underscores", () => {
    expect(() => assertValidHandle("paulo_freitas_9")).not.toThrow();
  });

  it("refuses everything else, rather than silently rewriting it", () => {
    for (const bad of ["pa", "paulo freitas", "paulo.freitas", "paulo-f", "é" + "aaa"]) {
      expect(() => assertValidHandle(bad)).toThrow(ProfileValidationError);
    }
  });

  it("refuses one over the 30-character cap", () => {
    expect(() => assertValidHandle("a".repeat(31))).toThrow(
      ProfileValidationError
    );
    expect(() => assertValidHandle("a".repeat(30))).not.toThrow();
  });

  it("lets a never-changed handle be changed now", () => {
    // The reserved handle was assigned by a migration, not by a person. It has
    // not spent the allowance.
    expect(handleChangeAvailableAt(null)).toBeNull();
  });

  it("holds a changed handle for 30 days, then releases it", () => {
    const changedAt = new Date("2026-08-01T00:00:00Z");

    const duringCooldown = handleChangeAvailableAt(
      changedAt,
      new Date("2026-08-20T00:00:00Z")
    );
    expect(duringCooldown?.toISOString()).toBe("2026-08-31T00:00:00.000Z");

    expect(
      handleChangeAvailableAt(changedAt, new Date("2026-08-31T00:00:01Z"))
    ).toBeNull();
  });

  it("carries the day it becomes available in the cooldown error", () => {
    const error = new HandleCooldownError(new Date("2026-08-31T00:00:00Z"));
    expect(error.message).toContain("2026-08-31");
  });

  it("names the handle in the taken error, so the client can echo it", () => {
    expect(new HandleUnavailableError("paulo").message).toContain("paulo");
  });

  it("treats an impossible handle in a URL as a 404, not a 400", () => {
    expect(isPossibleHandle("alice")).toBe(true);
    expect(isPossibleHandle("Alice")).toBe(true);
    expect(isPossibleHandle("a")).toBe(false);
    expect(isPossibleHandle("../../etc/passwd")).toBe(false);
  });
});

describe("PATCH /profile — what is accepted", () => {
  it("accepts a handle on its own, which is the claim prompt's whole request", () => {
    const parsed = profilePatchSchema.safeParse({ handle: "paulo" });
    expect(parsed.success).toBe(true);
  });

  it("distinguishes clearing a name from leaving it alone", () => {
    expect(profilePatchSchema.safeParse({ name: null }).success).toBe(true);
    expect(profilePatchSchema.safeParse({}).success).toBe(true);

    const cleared = profilePatchSchema.safeParse({ name: null });
    expect(cleared.success && cleared.data.name).toBe(null);
  });

  it("refuses a handle that is too short before it reaches the service", () => {
    expect(profilePatchSchema.safeParse({ handle: "ab" }).success).toBe(false);
  });

  it("defaults a page size and refuses one past the ceiling", () => {
    const bare = socialPageQuerySchema.safeParse({});
    expect(bare.success && bare.data.limit).toBe(24);
    expect(socialPageQuerySchema.safeParse({ limit: "1000" }).success).toBe(
      false
    );
  });
});

describe("social cursors", () => {
  it("round-trips a keyset through an opaque string", () => {
    const createdAt = new Date("2026-03-01T12:00:00Z");
    const encoded = encodeSocialCursor({ createdAt, id: "abc" });

    const decoded = decodeSocialCursor(encoded);

    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.cursor.id).toBe("abc");
    expect(decoded.ok && decoded.cursor.createdAt.toISOString()).toBe(
      createdAt.toISOString()
    );
  });

  it("refuses a cursor a client made up", () => {
    expect(decodeSocialCursor("not-a-cursor").ok).toBe(false);
    expect(
      decodeSocialCursor(
        Buffer.from(JSON.stringify({ c: "nonsense", i: "x" })).toString(
          "base64url"
        )
      ).ok
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D18's profile tabs — Collections and Likes
// ---------------------------------------------------------------------------

/**
 * Both tabs go through the same `resolveVisible` gate the saves tab does, so
 * what is worth testing is not that the gate exists a third time — it is that
 * neither tab found a way around it, and that each is honest about what it
 * counts.
 */
function buildTabs() {
  const { repo, service } = buildGraph();

  repo.collections.push(
    {
      id: "cccccccc-0000-0000-0000-000000000001",
      user_id: ALICE,
      name: "Public reading",
      description: "Things worth keeping",
      is_public: true,
      created_at: new Date("2026-02-10T00:00:00Z"),
      save_count: 3,
    },
    {
      id: "cccccccc-0000-0000-0000-000000000002",
      user_id: ALICE,
      name: "Private drafts",
      description: null,
      is_public: false,
      created_at: new Date("2026-02-11T00:00:00Z"),
      save_count: 9,
    }
  );

  // A private save of Bob's that Alice liked. The like is real; the bookmark
  // is not public, so the Likes tab must not surface it.
  repo.saves.push({
    id: "bbbbbbbb-0000-0000-0000-000000000001",
    user_id: BOB,
    source_url: "https://example.com/private",
    title: "Bob's private save",
    is_public: false,
    is_archived: false,
    created_at: new Date("2026-03-02T00:00:00Z"),
    updated_at: new Date("2026-03-02T00:00:00Z"),
    processing_status: "completed",
    is_private_link: false,
  });

  repo.likes.push(
    {
      id: "11111111-aaaa-0000-0000-000000000001",
      user_id: ALICE,
      bookmark_id: "aaaaaaaa-0000-0000-0000-000000000001",
      created_at: new Date("2026-03-05T00:00:00Z"),
    },
    {
      id: "11111111-aaaa-0000-0000-000000000002",
      user_id: ALICE,
      bookmark_id: "bbbbbbbb-0000-0000-0000-000000000001",
      created_at: new Date("2026-03-06T00:00:00Z"),
    }
  );

  return { repo, service };
}

describe("public collections tab", () => {
  it("lists only the public collections", async () => {
    const { service } = buildTabs();

    const page = await service.listPublicCollections("alice", { viewerId: BOB });

    expect(page?.collections.map((c) => c.name)).toEqual(["Public reading"]);
    expect(page?.collections[0]?.saveCount).toBe(3);
  });

  it("returns nothing to someone the profile has blocked", async () => {
    const { service } = buildTabs();
    await service.block(ALICE, "bob");

    // Alice blocked Bob, so from Bob's side Alice does not exist at all.
    expect(await service.listPublicCollections("alice", { viewerId: BOB })).toBe(
      null
    );
  });

  it("returns an empty page — not the rows — to someone the viewer blocked", async () => {
    const { repo, service } = buildTabs();
    await service.block(BOB, "alice");

    const page = await service.listPublicCollections("alice", { viewerId: BOB });

    expect(page?.collections).toEqual([]);
    // The refusal happened before the query, not after it.
    expect(repo.collectionsQueried).toBe(false);
  });

  it("carries no email, however deeply nested", async () => {
    const { service } = buildTabs();
    const page = await service.listPublicCollections("alice", { viewerId: BOB });

    expect(collectKeys(page)).not.toContain("email");
  });
});

describe("likes tab", () => {
  it("lists liked bookmarks that are public and drops the ones that are not", async () => {
    const { service } = buildTabs();

    const page = await service.listLikes("alice", { viewerId: BOB });

    expect(page?.bookmarks.map((b) => b.title)).toEqual([
      "Alice's public save",
    ]);
  });

  it("returns nothing to someone the profile has blocked", async () => {
    const { service } = buildTabs();
    await service.block(ALICE, "bob");

    expect(await service.listLikes("alice", { viewerId: BOB })).toBe(null);
  });

  it("does not query at all for someone the viewer blocked", async () => {
    const { repo, service } = buildTabs();
    await service.block(BOB, "alice");

    const page = await service.listLikes("alice", { viewerId: BOB });

    expect(page?.bookmarks).toEqual([]);
    expect(repo.likesQueried).toBe(false);
  });
});
