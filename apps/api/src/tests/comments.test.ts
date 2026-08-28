import { describe, it, expect, beforeEach } from "bun:test";
import path from "node:path";
import {
  COMMENT_EDIT_WINDOW_MS,
  CommentForbiddenError,
  CommentServiceImpl,
  CommentValidationError,
  MAX_COMMENT_LENGTH,
  type BookmarkVisibilityRow,
  type CommentRepository,
  type CommentWithAuthorRow,
} from "@cosmic-dolphin/shared";
import type { ContentReportRow } from "@cosmic-dolphin/shared";
import { RATE_LIMITS } from "../plugins/rate-limit";
import {
  createCommentSchema,
  createReportSchema,
  updateCommentSchema,
} from "../routes/comments";

/**
 * D12's three guarantees, tested where they are actually implemented.
 *
 *  - **A reply to a reply lands on the parent.** `CommentService` decides this,
 *    which is why an in-memory repository can prove it: the service reads the
 *    requested parent, sees that it already has one, and writes the
 *    grandparent's id instead. A repository that would happily store a
 *    three-deep chain still ends up with a two-level thread.
 *
 *  - **An edit at 16 minutes is refused.** The window is a predicate on the
 *    UPDATE, so the fake below reproduces exactly that predicate — an update
 *    that matches no row — and the assertion is that the *service* turns "no
 *    rows matched, but the comment is yours and alive" into a 403 rather than
 *    a 404 or a silent success.
 *
 *  - **Un-sharing hides the thread without deleting it.** Asserted from both
 *    sides: the reader stops being able to list, and the fake's storage is
 *    inspected directly to show every row is still there. Re-sharing brings
 *    the same ids back.
 */

// ---------------------------------------------------------------------------
// An in-memory thread
// ---------------------------------------------------------------------------

interface FakeBookmark {
  id: string;
  user_id: string;
  is_public: boolean;
}

interface FakeComment {
  id: string;
  bookmark_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface FakeProfile {
  id: string;
  handle: string;
  name: string;
  /**
   * Held in storage on purpose, the same way `social.test.ts` does it: the
   * leak assertion below only means something if the fake *has* an email the
   * mapper could have copied through.
   */
  email: string;
}

class FakeCommentRepository implements CommentRepository {
  bookmarks: FakeBookmark[] = [];
  comments: FakeComment[] = [];
  profiles: FakeProfile[] = [];

  private nextId = 1;

  /** Set when a thread read is actually reached, so a refusal can be told from an empty thread. */
  listed = false;

  reports: {
    reporter_id: string;
    bookmark_id: string | null;
    comment_id: string | null;
    reason: string;
  }[] = [];

  private join(comment: FakeComment): CommentWithAuthorRow {
    const author = this.profiles.find((p) => p.id === comment.user_id) ?? null;

    // Exactly the columns the real join selects. No `email`, the same way the
    // real query cannot produce one.
    return {
      id: comment.id,
      bookmark_id: comment.bookmark_id,
      user_id: comment.user_id,
      parent_id: comment.parent_id,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      deleted_at: comment.deleted_at,
      author_id: author?.id ?? null,
      author_handle: author?.handle ?? null,
      author_name: author?.name ?? null,
      author_picture_url: null,
    };
  }

  /** What the `bookmark_comments_count_sync` trigger maintains. */
  private liveCount(bookmarkId: string): number {
    return this.comments.filter(
      (c) => c.bookmark_id === bookmarkId && c.deleted_at === null
    ).length;
  }

  async findBookmarkVisibility(
    bookmarkId: string
  ): Promise<BookmarkVisibilityRow | null> {
    const bookmark = this.bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark) return null;

    return {
      id: bookmark.id,
      user_id: bookmark.user_id,
      is_public: bookmark.is_public,
      comment_count: this.liveCount(bookmark.id),
    };
  }

  async listByBookmark(bookmarkId: string): Promise<CommentWithAuthorRow[]> {
    this.listed = true;
    return this.comments
      .filter((c) => c.bookmark_id === bookmarkId)
      .sort(
        (a, b) =>
          a.created_at.getTime() - b.created_at.getTime() ||
          a.id.localeCompare(b.id)
      )
      .map((c) => this.join(c));
  }

  async findById(id: string): Promise<CommentWithAuthorRow | null> {
    const comment = this.comments.find((c) => c.id === id);
    return comment ? this.join(comment) : null;
  }

  async create(data: {
    bookmarkId: string;
    userId: string;
    parentId: string | null;
    body: string;
  }): Promise<CommentWithAuthorRow> {
    const now = new Date();
    const comment: FakeComment = {
      id: `c${this.nextId++}`,
      bookmark_id: data.bookmarkId,
      user_id: data.userId,
      parent_id: data.parentId,
      body: data.body,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    this.comments.push(comment);
    return this.join(comment);
  }

  async updateOwn(
    id: string,
    userId: string,
    body: string,
    windowMs: number
  ): Promise<CommentWithAuthorRow | null> {
    // The exact predicate the real UPDATE carries: mine, alive, and younger
    // than the window. No match means no row updated — the service is what
    // decides which of the three reasons applies.
    const comment = this.comments.find(
      (c) =>
        c.id === id &&
        c.user_id === userId &&
        c.deleted_at === null &&
        Date.now() - c.created_at.getTime() < windowMs
    );
    if (!comment) return null;

    comment.body = body;
    comment.updated_at = new Date();
    return this.join(comment);
  }

  async deleteOwn(
    id: string,
    userId: string
  ): Promise<{ softDeleted: boolean; row: CommentWithAuthorRow | null } | null> {
    const comment = this.comments.find(
      (c) => c.id === id && c.user_id === userId && c.deleted_at === null
    );
    if (!comment) return null;

    const hasReplies = this.comments.some(
      (c) => c.parent_id === id && c.deleted_at === null
    );

    if (hasReplies) {
      comment.body = "";
      comment.deleted_at = new Date();
      comment.updated_at = comment.deleted_at;
      return { softDeleted: true, row: this.join(comment) };
    }

    this.comments = this.comments.filter((c) => c.id !== id);
    return { softDeleted: false, row: null };
  }

  async commentCountFor(bookmarkId: string): Promise<number> {
    return this.liveCount(bookmarkId);
  }

  async createReport(data: {
    reporterId: string;
    bookmarkId: string | null;
    commentId: string | null;
    reason: string;
  }): Promise<ContentReportRow | null> {
    const already = this.reports.find(
      (r) =>
        r.reporter_id === data.reporterId &&
        r.bookmark_id === data.bookmarkId &&
        r.comment_id === data.commentId
    );

    if (!already) {
      this.reports.push({
        reporter_id: data.reporterId,
        bookmark_id: data.bookmarkId,
        comment_id: data.commentId,
        reason: data.reason,
      });
    }

    return {
      id: "r1",
      reporter_id: data.reporterId,
      bookmark_id: data.bookmarkId,
      comment_id: data.commentId,
      reason: data.reason,
      status: "open",
      created_at: new Date(),
    };
  }
}

const OWNER = "user-owner";
const READER = "user-reader";
const OTHER = "user-other";

let repo: FakeCommentRepository;
let service: CommentServiceImpl;

function seed(options: { isPublic?: boolean } = {}) {
  repo = new FakeCommentRepository();
  repo.bookmarks.push({
    id: "bk1",
    user_id: OWNER,
    is_public: options.isPublic ?? true,
  });
  repo.profiles.push(
    { id: OWNER, handle: "owner", name: "Owner", email: "owner@example.com" },
    { id: READER, handle: "reader", name: "Reader", email: "reader@example.com" },
    { id: OTHER, handle: "other", name: "Other", email: "other@example.com" }
  );
  service = new CommentServiceImpl(repo);
}

beforeEach(() => seed());

/** Backdate a comment so an edit window can be tested without waiting. */
function age(id: string, ms: number) {
  const comment = repo.comments.find((c) => c.id === id)!;
  comment.created_at = new Date(Date.now() - ms);
  comment.updated_at = comment.created_at;
}

// ---------------------------------------------------------------------------
// Done when #1 — a reply to a reply lands on the parent
// ---------------------------------------------------------------------------

describe("one level of nesting", () => {
  it("attaches a reply to a reply to that reply's parent", async () => {
    const root = await service.create("bk1", OWNER, { body: "The top one" });
    const reply = await service.create("bk1", READER, {
      body: "A reply",
      parentId: root!.id,
    });

    // The user pressed Reply on the *reply*. Nothing about the request says
    // "attach to the root" — the server decides that.
    const replyToReply = await service.create("bk1", OTHER, {
      body: "A reply to the reply",
      parentId: reply!.id,
    });

    expect(reply!.parentId).toBe(root!.id);
    expect(replyToReply!.parentId).toBe(root!.id);
    expect(replyToReply!.parentId).not.toBe(reply!.id);
  });

  it("keeps flattening no matter how deep the chain the client asks for", async () => {
    const root = await service.create("bk1", OWNER, { body: "Root" });

    let previous = await service.create("bk1", READER, {
      body: "1",
      parentId: root!.id,
    });

    // Five rounds of "reply to the last thing said". A recursive implementation
    // would grow a chain; this stays two deep.
    for (let i = 2; i <= 6; i += 1) {
      previous = await service.create("bk1", OTHER, {
        body: String(i),
        parentId: previous!.id,
      });
      expect(previous!.parentId).toBe(root!.id);
    }

    const parents = new Set(
      repo.comments.map((c) => c.parent_id).filter(Boolean)
    );
    expect([...parents]).toEqual([root!.id]);
  });

  it("refuses a parent that belongs to a different bookmark", async () => {
    repo.bookmarks.push({ id: "bk2", user_id: OWNER, is_public: true });
    const elsewhere = await service.create("bk2", OWNER, { body: "Elsewhere" });

    // Not a nesting question — honouring it would move a comment into a thread
    // its author never saw.
    await expect(
      service.create("bk1", READER, {
        body: "Wrong thread",
        parentId: elsewhere!.id,
      })
    ).rejects.toBeInstanceOf(CommentValidationError);
  });

  it("lets a reply hang off a tombstone rather than stranding it", async () => {
    const root = await service.create("bk1", OWNER, { body: "Root" });
    await service.create("bk1", READER, { body: "Reply", parentId: root!.id });

    // The root now has a reply, so deleting it leaves a tombstone.
    await service.remove(root!.id, OWNER);

    const late = await service.create("bk1", OTHER, {
      body: "Late to the thread",
      parentId: root!.id,
    });

    expect(late!.parentId).toBe(root!.id);
  });
});

// ---------------------------------------------------------------------------
// Done when #2 — an edit at 16 minutes is refused
// ---------------------------------------------------------------------------

describe("the 15-minute edit window", () => {
  it("allows an edit inside the window", async () => {
    const comment = await service.create("bk1", READER, { body: "First take" });
    age(comment!.id, 14 * 60 * 1000);

    const updated = await service.update(comment!.id, READER, "Second take");

    expect(updated!.body).toBe("Second take");
    expect(updated!.isEdited).toBe(true);
  });

  it("refuses an edit at 16 minutes", async () => {
    const comment = await service.create("bk1", READER, { body: "First take" });
    age(comment!.id, 16 * 60 * 1000);

    await expect(
      service.update(comment!.id, READER, "Second take")
    ).rejects.toBeInstanceOf(CommentForbiddenError);

    // And the stored text is untouched. A refused edit that had already
    // written would be the worst of both.
    expect(repo.comments[0]!.body).toBe("First take");
  });

  it("refuses at one millisecond past the window and allows at one before", async () => {
    const late = await service.create("bk1", READER, { body: "late" });
    age(late!.id, COMMENT_EDIT_WINDOW_MS + 1);
    await expect(
      service.update(late!.id, READER, "changed")
    ).rejects.toBeInstanceOf(CommentForbiddenError);

    const early = await service.create("bk1", READER, { body: "early" });
    age(early!.id, COMMENT_EDIT_WINDOW_MS - 1000);
    await expect(
      service.update(early!.id, READER, "changed")
    ).resolves.toBeTruthy();
  });

  it("reports canEdit as false once the window has closed", async () => {
    const comment = await service.create("bk1", READER, { body: "hello" });
    age(comment!.id, 16 * 60 * 1000);

    const thread = await service.list("bk1", READER);
    expect(thread!.comments[0]!.isOwn).toBe(true);
    expect(thread!.comments[0]!.canEdit).toBe(false);
  });

  it("answers 404-shaped null for someone else's comment, not a 403", async () => {
    const comment = await service.create("bk1", READER, { body: "mine" });

    // A 403 here would confirm to a stranger that this comment id is real.
    await expect(service.update(comment!.id, OTHER, "yours now")).resolves.toBe(
      null
    );
  });

  it("refuses to edit a tombstone back into a comment", async () => {
    const root = await service.create("bk1", READER, { body: "Root" });
    await service.create("bk1", OTHER, { body: "Reply", parentId: root!.id });
    await service.remove(root!.id, READER);

    await expect(
      service.update(root!.id, READER, "back from the dead")
    ).rejects.toBeInstanceOf(CommentForbiddenError);
  });

  it("never expires deletion, unlike editing", async () => {
    const comment = await service.create("bk1", READER, { body: "regret" });
    age(comment!.id, 400 * 24 * 60 * 60 * 1000);

    const result = await service.remove(comment!.id, READER);

    expect(result!.deleted).toBe(true);
    expect(repo.comments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Done when #3 — un-sharing hides the thread without deleting it
// ---------------------------------------------------------------------------

describe("un-sharing a bookmark", () => {
  it("hides the thread from readers without deleting a single comment", async () => {
    await service.create("bk1", OWNER, { body: "Owner's note" });
    await service.create("bk1", READER, { body: "Reader's reply" });

    const before = await service.list("bk1", READER);
    expect(before!.comments).toHaveLength(2);

    // Un-share. Nothing touches `bookmark_comments`.
    repo.bookmarks[0]!.is_public = false;
    repo.listed = false;

    const after = await service.list("bk1", READER);
    expect(after).toBe(null);
    // The refusal happened before any thread read: visibility is checked
    // first, so an un-shared bookmark costs one query, not a thread scan.
    expect(repo.listed).toBe(false);

    // The rows are all still there.
    expect(repo.comments).toHaveLength(2);
    expect(repo.comments.every((c) => c.deleted_at === null)).toBe(true);
  });

  it("restores the same thread when the bookmark is shared again", async () => {
    const first = await service.create("bk1", OWNER, { body: "One" });
    const second = await service.create("bk1", READER, { body: "Two" });

    repo.bookmarks[0]!.is_public = false;
    expect(await service.list("bk1", READER)).toBe(null);

    repo.bookmarks[0]!.is_public = true;

    const restored = await service.list("bk1", READER);
    expect(restored!.comments.map((c) => c.id)).toEqual([
      first!.id,
      second!.id,
    ]);
    expect(restored!.comments.map((c) => c.body)).toEqual(["One", "Two"]);
  });

  it("still shows the owner their own thread on a private bookmark", async () => {
    seed({ isPublic: false });
    await service.create("bk1", OWNER, { body: "A private note to self" });

    // Same table, gated on `is_public` — commenting on your own private save
    // is a note to yourself and stays readable to you.
    const owner = await service.list("bk1", OWNER);
    expect(owner!.comments).toHaveLength(1);

    expect(await service.list("bk1", READER)).toBe(null);
  });

  it("refuses a new comment on a bookmark that stopped being public", async () => {
    repo.bookmarks[0]!.is_public = false;

    await expect(
      service.create("bk1", READER, { body: "too late" })
    ).resolves.toBe(null);
    expect(repo.comments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Delete: soft when it has replies, hard when it does not
// ---------------------------------------------------------------------------

describe("deleting a comment", () => {
  it("hard-deletes a comment with no replies", async () => {
    const comment = await service.create("bk1", READER, { body: "alone" });

    const result = await service.remove(comment!.id, READER);

    expect(result!.deleted).toBe(true);
    expect(result!.comment).toBeUndefined();
    expect(repo.comments).toHaveLength(0);
  });

  it("soft-deletes a comment that has replies, and keeps the replies", async () => {
    const root = await service.create("bk1", READER, { body: "the parent" });
    const reply = await service.create("bk1", OTHER, {
      body: "the reply",
      parentId: root!.id,
    });

    const result = await service.remove(root!.id, READER);

    expect(result!.deleted).toBe(false);
    expect(result!.comment!.isDeleted).toBe(true);
    // A tombstone credits nobody and says nothing.
    expect(result!.comment!.body).toBeUndefined();
    expect(result!.comment!.author).toBeUndefined();

    // The reply survived — which is the entire reason for the soft delete.
    expect(repo.comments.find((c) => c.id === reply!.id)).toBeTruthy();
  });

  it("empties the body in storage, not only on the way out", async () => {
    const root = await service.create("bk1", READER, { body: "secret" });
    await service.create("bk1", OTHER, { body: "reply", parentId: root!.id });

    await service.remove(root!.id, READER);

    // A soft delete that left the text on disk would be one in name only.
    expect(repo.comments.find((c) => c.id === root!.id)!.body).toBe("");
  });

  it("drops a tombstone from the thread once its last reply is gone", async () => {
    const root = await service.create("bk1", READER, { body: "parent" });
    const reply = await service.create("bk1", OTHER, {
      body: "reply",
      parentId: root!.id,
    });

    await service.remove(root!.id, READER);
    await service.remove(reply!.id, OTHER);

    // "Comment deleted" over nothing is worse than nothing.
    const thread = await service.list("bk1", READER);
    expect(thread!.comments).toHaveLength(0);
  });

  it("excludes tombstones from the count", async () => {
    const root = await service.create("bk1", READER, { body: "parent" });
    await service.create("bk1", OTHER, { body: "reply", parentId: root!.id });

    const result = await service.remove(root!.id, READER);

    // Two rows, one live. "2 comments" resolving to one comment and a
    // tombstone is a small lie the count should not tell.
    expect(repo.comments).toHaveLength(2);
    expect(result!.commentCount).toBe(1);
  });

  it("refuses to delete someone else's comment", async () => {
    const comment = await service.create("bk1", READER, { body: "mine" });

    await expect(service.remove(comment!.id, OTHER)).resolves.toBe(null);
    expect(repo.comments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Ordering, length, and what the thread does not carry
// ---------------------------------------------------------------------------

describe("the thread itself", () => {
  it("orders chronologically, each reply directly under its parent", async () => {
    const a = await service.create("bk1", OWNER, { body: "A" });
    const b = await service.create("bk1", READER, { body: "B" });
    const replyToA = await service.create("bk1", OTHER, {
      body: "A1",
      parentId: a!.id,
    });

    const thread = await service.list("bk1", READER);

    // Not "most liked", not "best reply" — A, then A's reply, then B.
    expect(thread!.comments.map((c) => c.body)).toEqual(["A", "A1", "B"]);
    expect(thread!.comments.map((c) => c.id)).toEqual([
      a!.id,
      replyToA!.id,
      b!.id,
    ]);
  });

  it("carries no score, rank or vote on any comment", async () => {
    await service.create("bk1", OWNER, { body: "A" });
    const thread = await service.list("bk1", READER);

    const keys = Object.keys(thread!.comments[0]!);
    for (const forbidden of ["score", "rank", "votes", "upvotes", "points"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("never carries an author's email", async () => {
    await service.create("bk1", READER, { body: "hello" });
    const thread = await service.list("bk1", OWNER);

    // Walked to the leaves rather than checked field by field, so the
    // assertion keeps holding as the shape grows.
    const serialised = JSON.stringify(thread);
    expect(serialised).not.toContain("@example.com");
    expect(serialised).not.toContain("email");
  });

  it("trims before it measures, so whitespace is not a comment", async () => {
    await expect(
      service.create("bk1", READER, { body: "   \n  " })
    ).rejects.toBeInstanceOf(CommentValidationError);
  });

  it("accepts exactly 2,000 characters and refuses 2,001", async () => {
    await expect(
      service.create("bk1", READER, { body: "x".repeat(MAX_COMMENT_LENGTH) })
    ).resolves.toBeTruthy();

    await expect(
      service.create("bk1", READER, { body: "x".repeat(MAX_COMMENT_LENGTH + 1) })
    ).rejects.toBeInstanceOf(CommentValidationError);
  });

  it("does not treat a fresh comment as edited", async () => {
    const comment = await service.create("bk1", READER, { body: "hello" });
    expect(comment!.isEdited).toBe(false);
  });

  it("marks isOwn from the viewer, not from the author", async () => {
    const comment = await service.create("bk1", READER, { body: "hello" });
    expect(comment!.isOwn).toBe(true);

    const asOther = await service.list("bk1", OTHER);
    expect(asOther!.comments[0]!.isOwn).toBe(false);
    expect(asOther!.comments[0]!.canEdit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reports — and the absence of auto-hide
// ---------------------------------------------------------------------------

describe("reports", () => {
  it("leaves the reported comment exactly as visible as it was", async () => {
    const comment = await service.create("bk1", READER, { body: "offensive" });

    const before = await service.list("bk1", OTHER);
    await service.report(OTHER, { commentId: comment!.id, reason: "abuse" });
    const after = await service.list("bk1", OTHER);

    // Auto-hide is trivially weaponised. Nothing changed.
    expect(after!.comments.map((c) => c.id)).toEqual(
      before!.comments.map((c) => c.id)
    );
    expect(after!.comments[0]!.isDeleted).toBe(false);
    expect(after!.comments[0]!.body).toBe("offensive");
    expect(after!.commentCount).toBe(before!.commentCount);
  });

  it("leaves a reported bookmark's thread readable", async () => {
    await service.create("bk1", READER, { body: "still here" });

    await service.report(OTHER, { bookmarkId: "bk1", reason: "spam" });

    expect(repo.bookmarks[0]!.is_public).toBe(true);
    const thread = await service.list("bk1", OTHER);
    expect(thread!.comments).toHaveLength(1);
  });

  it("is idempotent per reporter per target", async () => {
    const comment = await service.create("bk1", READER, { body: "x" });

    await service.report(OTHER, { commentId: comment!.id, reason: "abuse" });
    await service.report(OTHER, { commentId: comment!.id, reason: "abuse" });

    // A second press is not a second signal, or one account can flood the
    // review queue on its own.
    expect(repo.reports).toHaveLength(1);
  });

  it("requires exactly one target", async () => {
    await expect(service.report(OTHER, { reason: "no target" })).rejects.toBeInstanceOf(
      CommentValidationError
    );

    await expect(
      service.report(OTHER, {
        bookmarkId: "bk1",
        commentId: "c1",
        reason: "both",
      })
    ).rejects.toBeInstanceOf(CommentValidationError);
  });

  it("refuses to file a report against something the reporter cannot see", async () => {
    await service.create("bk1", OWNER, { body: "private note" });
    repo.bookmarks[0]!.is_public = false;

    await expect(
      service.report(READER, { bookmarkId: "bk1", reason: "curiosity" })
    ).resolves.toBe(null);
    expect(repo.reports).toHaveLength(0);
  });

  it("requires a reason", async () => {
    await expect(
      service.report(OTHER, { bookmarkId: "bk1", reason: "   " })
    ).rejects.toBeInstanceOf(CommentValidationError);
  });
});

// ---------------------------------------------------------------------------
// The wire: schemas and the rate limit
// ---------------------------------------------------------------------------

describe("route schemas", () => {
  it("trims a comment body before measuring it", () => {
    expect(createCommentSchema.safeParse({ body: "  hi  " }).success).toBe(true);
    expect(createCommentSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(
      createCommentSchema.safeParse({ body: `${"x".repeat(2000)}\n` }).success
    ).toBe(true);
    expect(
      createCommentSchema.safeParse({ body: "x".repeat(2001) }).success
    ).toBe(false);
  });

  it("accepts a parentId without judging what it points at", () => {
    // Whether that id is a top-level comment or a reply changes where the
    // comment lands, and that is the service's decision, not the schema's.
    const parsed = createCommentSchema.safeParse({
      body: "reply",
      parentId: "3f1a5b7c-6d2e-4a8f-9b0c-1d2e3f4a5b6c",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a body on an edit", () => {
    expect(updateCommentSchema.safeParse({}).success).toBe(false);
    expect(updateCommentSchema.safeParse({ body: "new" }).success).toBe(true);
  });

  it("requires exactly one report target at the wire", () => {
    const bookmark = "3f1a5b7c-6d2e-4a8f-9b0c-1d2e3f4a5b6c";
    const comment = "4a2b6c8d-7e3f-4b9a-8c1d-2e3f4a5b6c7d";

    expect(
      createReportSchema.safeParse({ bookmarkId: bookmark, reason: "spam" })
        .success
    ).toBe(true);
    expect(
      createReportSchema.safeParse({ reason: "spam" }).success
    ).toBe(false);
    expect(
      createReportSchema.safeParse({
        bookmarkId: bookmark,
        commentId: comment,
        reason: "spam",
      }).success
    ).toBe(false);
  });
});

describe("the comment rate limit", () => {
  it("is 10 per minute, from the one place limits are declared", () => {
    // docs/functional-spec/06-social.md § Comment.
    expect(RATE_LIMITS.comments.max).toBe(10);
    expect(RATE_LIMITS.comments.timeWindow).toBe("1 minute");
  });

  it("has its own bucket, so commenting cannot be starved by following", () => {
    expect(RATE_LIMITS.comments.name).toBe("comments");
    expect(RATE_LIMITS.comments.name).not.toBe(RATE_LIMITS.follows.name);
  });
});

// ---------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------

function repoPath(relativePath: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join("apps", "api"))
    ? path.resolve(cwd, "../..")
    : cwd;

  return path.join(root, relativePath);
}

describe("the comments migration", () => {
  const migration = () =>
    Bun.file(
      repoPath("supabase/migrations/20260828000002_add_comments_and_reports.sql")
    ).text();

  it("maintains comment_count by trigger rather than by application code", async () => {
    const sql = await migration();

    expect(sql).toContain("ALTER TABLE bookmarks ADD COLUMN comment_count");
    expect(sql).toContain("CREATE TRIGGER bookmark_comments_count_sync");
    expect(sql).toContain("sync_bookmark_comment_count");
    // Liveness transitions only — an edit must not move the count, and a
    // cascade must.
    expect(sql).toContain("AFTER INSERT OR UPDATE OF deleted_at OR DELETE");
  });

  it("indexes the thread query partially, on live comments only", async () => {
    const sql = await migration();

    expect(sql).toContain("CREATE INDEX idx_bookmark_comments_bookmark");
    expect(sql).toContain("ON bookmark_comments(bookmark_id, created_at)");
    expect(sql).toContain("WHERE deleted_at IS NULL");
  });

  it("makes comments readable only when the bookmark is public or the reader's", async () => {
    const sql = await migration();

    expect(sql).toContain("ALTER TABLE bookmark_comments ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("CREATE POLICY bookmark_comments_visible_select");
    expect(sql).toContain("b.is_public = true OR b.user_id = auth.uid()");
    expect(sql).toContain("CREATE POLICY bookmark_comments_author_insert");
    expect(sql).toContain("CREATE POLICY bookmark_comments_author_update");
    expect(sql).toContain("CREATE POLICY bookmark_comments_author_delete");
  });

  it("gives content_reports RLS and exactly one target", async () => {
    const sql = await migration();

    expect(sql).toContain("ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("num_nonnulls(bookmark_id, comment_id) = 1");
    expect(sql).toContain("CREATE POLICY content_reports_reporter_select");
    expect(sql).toContain("CREATE POLICY content_reports_reporter_insert");
  });

  it("adds nothing that could hide reported content", async () => {
    const sql = await migration();

    // The absence is the feature. A `hidden_at`, a `visible` flag or a trigger
    // on `content_reports` that touched `bookmarks` would be an auto-hide, and
    // auto-hide is trivially weaponised.
    expect(sql).not.toMatch(/hidden_at|is_hidden|auto_hide/i);
    // `[^;]*` keeps this inside a single statement — a greedy match would run
    // from the comments trigger all the way to the reports RLS policies and
    // fail on a file that is entirely correct.
    expect(sql).not.toMatch(/CREATE TRIGGER[^;]*ON content_reports/i);
  });
});

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

describe("the comments contract", () => {
  const contract = () =>
    Bun.file(repoPath("packages/apispec/comments.tsp")).text();

  it("gives a comment no ranking field to be sorted by", async () => {
    const tsp = await contract();
    const model = tsp.match(/model Comment \{[\s\S]*?\n\}/)?.[0];

    expect(model).toContain("createdAt: utcDateTime;");
    expect(model).not.toMatch(/\bscore\b|\brank\b|\bvotes\b|\bupvotes\b/i);
  });

  it("says the report response carries no visibility change", async () => {
    const tsp = await contract();
    const model = tsp.match(/model CreateReportResponse \{[\s\S]*?\n\}/)?.[0];

    // One boolean, and it is about the report — not about the content.
    expect(model).toContain("reported: boolean;");
    expect(model).not.toMatch(/hidden|removed|visible/i);
  });

  it("routes comments under the bookmark and edits under the comment", async () => {
    const tsp = await contract();

    expect(tsp).toContain('@route("/{id}/comments")');
    expect(tsp).toContain('@route("/comments")');
    expect(tsp).toContain('@route("/reports")');
  });
});
