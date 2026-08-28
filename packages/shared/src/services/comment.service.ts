import {
  Comment,
  CommentAuthor,
  CommentsResponse,
  CreateReportResult,
  DeleteCommentResult,
} from "../types";
import {
  CommentRepository,
  CommentWithAuthorRow,
} from "../repositories/comment.repository";

/**
 * Conversation on a bookmark, and the moderation floor under it.
 *
 * Four product rules live in this file and nowhere else, so that adding a
 * fifth caller cannot quietly get a different answer:
 *
 * **One level of nesting.** A `parentId` pointing at a reply is not refused —
 * it is *re-pointed* at that reply's own parent. Refusing would be technically
 * defensible and behaviourally wrong: the user pressed Reply on something they
 * can see, and telling them that thing cannot be replied to is a worse
 * explanation than putting the reply where a one-level thread can hold it.
 * Deep threads are where reading products turn into forums.
 *
 * **Editable for 15 minutes, then frozen.** Enforced as a predicate on the
 * UPDATE (see `CommentRepository.updateOwn`) against the database's clock. The
 * `canEdit` flag on the way out is a *hint* for the client, computed from the
 * same constant, and the server never trusts it coming back.
 *
 * **Delete is two different operations.** Replies make a comment load-bearing:
 * removing it would take them with it via the cascade, so it becomes a
 * tombstone instead. With no replies it is removed outright and leaves nothing.
 *
 * **Visibility is the parent bookmark's, and only ever the parent bookmark's.**
 * A comment thread is readable when the bookmark is public or the reader owns
 * it. That single rule is what makes un-sharing *hide* a thread rather than
 * delete one: nothing about the comments changes, and everyone but the owner
 * stops being able to ask for them.
 *
 * And one rule expressed by omission: **reported content stays visible.** There
 * is no code path here that hides anything in response to a report, because
 * auto-hide is trivially weaponised.
 */

/** 15 minutes. The one place the number lives; the API and the UI both import it. */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Plain text plus links. The cap is also a CHECK on the column. */
export const MAX_COMMENT_LENGTH = 2000;

export const MAX_REPORT_REASON_LENGTH = 1000;

/** Something the caller sent is wrong. A 400. */
export class CommentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentValidationError";
  }
}

/**
 * The caller is who they say they are and still may not do this — the comment
 * is frozen, or deleted. A 403, not a 404: pretending their own comment does
 * not exist would be a worse answer than telling them the window closed.
 */
export class CommentForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentForbiddenError";
  }
}

export interface CommentService {
  /** `null` when the bookmark does not exist or is not visible to the caller. */
  list(bookmarkId: string, viewerId: string): Promise<CommentsResponse | null>;

  /** `null` when the bookmark does not exist or is not visible to the caller. */
  create(
    bookmarkId: string,
    userId: string,
    input: { body: string; parentId?: string | null }
  ): Promise<Comment | null>;

  /** `null` when there is no such comment of the caller's. */
  update(id: string, userId: string, body: string): Promise<Comment | null>;

  /** `null` when there is no such comment of the caller's. */
  remove(id: string, userId: string): Promise<DeleteCommentResult | null>;

  /** `null` when the reported thing does not exist or is not visible. */
  report(
    reporterId: string,
    input: { bookmarkId?: string | null; commentId?: string | null; reason: string }
  ): Promise<CreateReportResult | null>;
}

export class CommentServiceImpl implements CommentService {
  constructor(private commentRepository: CommentRepository) {}

  async list(
    bookmarkId: string,
    viewerId: string
  ): Promise<CommentsResponse | null> {
    const bookmark = await this.commentRepository.findBookmarkVisibility(
      bookmarkId
    );
    if (!isVisible(bookmark, viewerId)) return null;

    const rows = await this.commentRepository.listByBookmark(bookmarkId);

    return {
      comments: orderThread(rows).map((row) => toComment(row, viewerId)),
      commentCount: bookmark!.comment_count,
    };
  }

  async create(
    bookmarkId: string,
    userId: string,
    input: { body: string; parentId?: string | null }
  ): Promise<Comment | null> {
    const body = normaliseBody(input.body);

    const bookmark = await this.commentRepository.findBookmarkVisibility(
      bookmarkId
    );
    if (!isVisible(bookmark, userId)) return null;

    const parentId = await this.resolveParent(bookmarkId, input.parentId);

    const row = await this.commentRepository.create({
      bookmarkId,
      userId,
      parentId,
      body,
    });

    return toComment(row, userId);
  }

  async update(
    id: string,
    userId: string,
    body: string
  ): Promise<Comment | null> {
    const normalised = normaliseBody(body);

    const updated = await this.commentRepository.updateOwn(
      id,
      userId,
      normalised,
      COMMENT_EDIT_WINDOW_MS
    );

    if (updated) return toComment(updated, userId);

    // The UPDATE matched nothing, and the three reasons need three different
    // answers. One extra read, only on the failure path — the successful edit
    // never pays for it.
    const existing = await this.commentRepository.findById(id);
    if (!existing || existing.user_id !== userId) return null;

    if (existing.deleted_at !== null) {
      throw new CommentForbiddenError("This comment has been deleted.");
    }

    throw new CommentForbiddenError(
      "Comments can only be edited for 15 minutes after they are posted."
    );
  }

  async remove(
    id: string,
    userId: string
  ): Promise<DeleteCommentResult | null> {
    const existing = await this.commentRepository.findById(id);
    if (!existing || existing.user_id !== userId) return null;

    const outcome = await this.commentRepository.deleteOwn(id, userId);
    if (!outcome) return null;

    // Read after the write: the count is maintained by trigger, so the value
    // the client needs only exists once the transaction has committed.
    const commentCount = await this.commentRepository.commentCountFor(
      existing.bookmark_id
    );

    return {
      // `deleted` means "gone entirely". A tombstone is not gone, and the
      // client has to leave something in the thread where it was.
      deleted: !outcome.softDeleted,
      ...(outcome.softDeleted && outcome.row
        ? { comment: toComment(outcome.row, userId) }
        : {}),
      commentCount,
    };
  }

  async report(
    reporterId: string,
    input: {
      bookmarkId?: string | null;
      commentId?: string | null;
      reason: string;
    }
  ): Promise<CreateReportResult | null> {
    const reason = input.reason?.trim() ?? "";
    if (reason.length === 0) {
      throw new CommentValidationError("A reason is required.");
    }
    if (reason.length > MAX_REPORT_REASON_LENGTH) {
      throw new CommentValidationError(
        `A reason must be at most ${MAX_REPORT_REASON_LENGTH} characters.`
      );
    }

    const bookmarkId = input.bookmarkId || null;
    const commentId = input.commentId || null;

    // Exactly one target, checked here as well as by the CHECK constraint —
    // a 400 explaining which is better than a 500 from a constraint violation.
    if ((bookmarkId === null) === (commentId === null)) {
      throw new CommentValidationError(
        "Report exactly one of bookmarkId or commentId."
      );
    }

    // A report of something the reporter cannot see is a report of nothing.
    // The check reuses the same visibility rule as reading, so there is no
    // second definition of "public" to drift.
    let targetBookmarkId: string;

    if (commentId) {
      const comment = await this.commentRepository.findById(commentId);
      if (!comment || comment.deleted_at !== null) return null;
      targetBookmarkId = comment.bookmark_id;
    } else {
      targetBookmarkId = bookmarkId!;
    }

    const bookmark = await this.commentRepository.findBookmarkVisibility(
      targetBookmarkId
    );
    if (!isVisible(bookmark, reporterId)) return null;

    const report = await this.commentRepository.createReport({
      reporterId,
      bookmarkId,
      commentId,
      reason,
    });

    // Nothing here hides anything. The report goes to a queue a person reads.
    return { reported: report !== null };
  }

  /**
   * The one-level rule, in one place.
   *
   * Returns the id the new comment should actually hang off:
   *  - nothing, for a top-level comment;
   *  - the parent's id, when the parent is top-level;
   *  - the **grandparent's** id, when the parent is itself a reply.
   *
   * A tombstone is a legal parent. Its replies are still a conversation, and
   * refusing to extend it would strand them.
   */
  private async resolveParent(
    bookmarkId: string,
    requestedParentId?: string | null
  ): Promise<string | null> {
    if (!requestedParentId) return null;

    const parent = await this.commentRepository.findById(requestedParentId);

    // A parent on a different bookmark is not a nesting question, it is a
    // malformed request: honouring it would move a comment into a thread its
    // author never saw.
    if (!parent || parent.bookmark_id !== bookmarkId) {
      throw new CommentValidationError(
        "The comment being replied to is not on this bookmark."
      );
    }

    return parent.parent_id ?? parent.id;
  }
}

/** Public or the reader's own. The only definition of comment visibility. */
function isVisible(
  bookmark: { user_id: string; is_public: boolean } | null,
  viewerId: string
): boolean {
  if (!bookmark) return false;
  return bookmark.is_public || bookmark.user_id === viewerId;
}

/**
 * Trim, then measure.
 *
 * A body of spaces is empty, and 2,000 characters plus a trailing newline is
 * not over the limit. Both of those are things a real client sends.
 */
function normaliseBody(raw: string): string {
  const body = typeof raw === "string" ? raw.trim() : "";

  if (body.length === 0) {
    throw new CommentValidationError("A comment cannot be empty.");
  }
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new CommentValidationError(
      `A comment must be at most ${MAX_COMMENT_LENGTH} characters.`
    );
  }

  return body;
}

/**
 * Chronological, with each comment's replies directly beneath it.
 *
 * The repository already returns the whole thread in creation order; this
 * regroups it so the client can render a flat list without holding a tree.
 * There is no ranking here and there is nowhere to put one — the only ordering
 * input is `created_at`.
 *
 * A tombstone whose replies were all deleted has nothing left to hold up, and
 * is dropped rather than rendered as "Comment deleted" over nothing.
 */
export function orderThread(
  rows: CommentWithAuthorRow[]
): CommentWithAuthorRow[] {
  const replies = new Map<string, CommentWithAuthorRow[]>();
  const roots: CommentWithAuthorRow[] = [];

  for (const row of rows) {
    if (row.parent_id) {
      const bucket = replies.get(row.parent_id);
      if (bucket) bucket.push(row);
      else replies.set(row.parent_id, [row]);
    } else {
      roots.push(row);
    }
  }

  const ordered: CommentWithAuthorRow[] = [];

  for (const root of roots) {
    const children = replies.get(root.id) ?? [];
    if (root.deleted_at !== null && children.length === 0) continue;

    ordered.push(root);
    ordered.push(...children);
  }

  // A reply whose parent is missing entirely — the parent was hard-deleted in
  // a race, or a row predates this rule — would otherwise vanish from the
  // thread. Append it as a top-level comment: visible in the wrong place beats
  // invisible.
  const placed = new Set(ordered.map((row) => row.id));
  for (const row of rows) {
    if (!placed.has(row.id) && row.deleted_at === null) ordered.push(row);
  }

  return ordered;
}

/**
 * The only function that produces a `Comment`.
 *
 * A tombstone loses its body and its author here as well as in the database.
 * Two locks, because this is the one that a future `listByBookmark` variant
 * would still have to go through.
 */
export function toComment(
  row: CommentWithAuthorRow,
  viewerId: string,
  now: Date = new Date()
): Comment {
  const isDeleted = row.deleted_at !== null;
  const createdAt = new Date(row.created_at);
  const updatedAt = new Date(row.updated_at);
  const isOwn = row.user_id === viewerId;

  return {
    id: row.id,
    bookmarkId: row.bookmark_id,
    ...(row.parent_id ? { parentId: row.parent_id } : {}),
    ...(isDeleted ? {} : { body: row.body }),
    ...(isDeleted ? {} : withAuthor(row)),
    createdAt,
    updatedAt,
    // Sub-second differences are the insert's own `now()` being read twice, not
    // an edit. A second of tolerance keeps a freshly posted comment from
    // rendering as "edited".
    isEdited: !isDeleted && updatedAt.getTime() - createdAt.getTime() > 1000,
    isDeleted,
    isOwn,
    canEdit:
      isOwn &&
      !isDeleted &&
      now.getTime() - createdAt.getTime() < COMMENT_EDIT_WINDOW_MS,
  };
}

function withAuthor(row: CommentWithAuthorRow): { author?: CommentAuthor } {
  // No profile row — deleted account. The comment stays; the byline does not
  // get invented.
  if (!row.author_id) return {};

  return {
    author: {
      id: row.author_id,
      ...(row.author_handle ? { handle: row.author_handle } : {}),
      ...(row.author_name ? { name: row.author_name } : {}),
      ...(row.author_picture_url ? { pictureUrl: row.author_picture_url } : {}),
    },
  };
}
