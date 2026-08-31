import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import { BookmarkCommentRow, ContentReportRow, Database } from "../database/schema";

/**
 * Comments and reports.
 *
 * Three rules live here, in SQL, because in a service they would each be a
 * read-then-write with a race in the middle:
 *
 *  - **Visibility is the parent bookmark's.** `findBookmarkVisibility` is the
 *    one question every read and write asks first, and it is one round trip.
 *    Un-sharing a bookmark therefore hides its whole thread on the next
 *    request — the comments are untouched, the bookmark stopped being public,
 *    and nothing had to walk the thread to make it so.
 *
 *  - **Editing is bounded by the row's own `created_at`.** The window is a
 *    predicate on the UPDATE, not a comparison in TypeScript against a clock
 *    the client can influence. A request that arrives at 15:01 updates no rows,
 *    whatever anyone's system time says.
 *
 *  - **A comment's own reply count decides how it dies.** `deleteOwn` counts
 *    live replies and either tombstones or removes the row **in one
 *    transaction**, so a reply arriving mid-delete cannot end up orphaned by a
 *    hard delete that was decided a moment before it landed.
 *
 * `bookmarks.comment_count` is not written here at all. It is maintained by the
 * `bookmark_comments_count_sync` trigger, which is the only observer of all six
 * ways a comment's liveness can change — including the two cascades no
 * statement in this file can see.
 */

/** What a bookmark's visibility comes down to. Nothing else is needed to answer it. */
export interface BookmarkVisibilityRow {
  id: string;
  user_id: string;
  is_public: boolean;
  comment_count: number;
}

/** A comment joined to the public identity behind it. */
export interface CommentWithAuthorRow extends BookmarkCommentRow {
  author_id: string | null;
  author_handle: string | null;
  author_name: string | null;
  author_picture_url: string | null;
}

export interface CommentRepository {
  /** `null` when there is no such bookmark. Visibility is the caller's to decide. */
  findBookmarkVisibility(bookmarkId: string): Promise<BookmarkVisibilityRow | null>;

  /**
   * The whole thread, oldest first, tombstones included — a tombstone is what
   * keeps a reply attached to something.
   */
  listByBookmark(bookmarkId: string): Promise<CommentWithAuthorRow[]>;

  findById(id: string): Promise<CommentWithAuthorRow | null>;

  create(data: {
    bookmarkId: string;
    userId: string;
    parentId: string | null;
    body: string;
  }): Promise<CommentWithAuthorRow>;

  /**
   * Edit, inside the window and only the author's own.
   *
   * Returns `null` when the row is not the caller's, is deleted, or is older
   * than `windowMs`. The caller cannot tell those apart from the return value
   * alone, which is why it also has `findById` — the distinction is a 403 or a
   * 404 and that is a routing decision, not a data one.
   */
  updateOwn(
    id: string,
    userId: string,
    body: string,
    windowMs: number
  ): Promise<CommentWithAuthorRow | null>;

  /**
   * Soft-delete when it has live replies, hard-delete when it does not.
   *
   * `null` when there was nothing of the caller's to delete.
   */
  deleteOwn(
    id: string,
    userId: string
  ): Promise<{ softDeleted: boolean; row: CommentWithAuthorRow | null } | null>;

  /** The bookmark's live comment count, straight off the denormalised column. */
  commentCountFor(bookmarkId: string): Promise<number>;

  /**
   * File a report. Idempotent per reporter per target: a second press returns
   * the first report rather than adding a row.
   */
  createReport(data: {
    reporterId: string;
    bookmarkId: string | null;
    commentId: string | null;
    reason: string;
  }): Promise<ContentReportRow | null>;
}

/**
 * Every read of a comment needs the author beside it, and a second query per
 * comment would be a thread-length fan-out. One join, one column list, and no
 * `email` in it — the same rule `PUBLIC_PROFILE_COLUMNS` enforces for profiles.
 */
const COMMENT_COLUMNS = [
  "bookmark_comments.id as id",
  "bookmark_comments.bookmark_id as bookmark_id",
  "bookmark_comments.user_id as user_id",
  "bookmark_comments.parent_id as parent_id",
  "bookmark_comments.body as body",
  "bookmark_comments.created_at as created_at",
  "bookmark_comments.updated_at as updated_at",
  "bookmark_comments.deleted_at as deleted_at",
  "profiles.id as author_id",
  "profiles.handle as author_handle",
  "profiles.name as author_name",
  "profiles.picture_url as author_picture_url",
] as const;

export class CommentRepositoryImpl
  extends BaseRepository
  implements CommentRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findBookmarkVisibility(
    bookmarkId: string
  ): Promise<BookmarkVisibilityRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("bookmarks")
        .select(["id", "user_id", "is_public", "comment_count"])
        .where("id", "=", bookmarkId)
        .executeTakeFirst();

      return row ?? null;
    }, "findBookmarkVisibility");
  }

  async listByBookmark(bookmarkId: string): Promise<CommentWithAuthorRow[]> {
    return this.executeQuery(async () => {
      // `leftJoin`, not `innerJoin`: a profile deleted out from under a comment
      // must not make the comment — and every reply hanging off it —
      // disappear from the thread. The service renders an authorless row the
      // same way it renders a tombstone.
      return (await this.db
        .selectFrom("bookmark_comments")
        .leftJoin("profiles", "profiles.id", "bookmark_comments.user_id")
        .select(COMMENT_COLUMNS)
        .where("bookmark_comments.bookmark_id", "=", bookmarkId)
        // Chronological, and `id` only as a tiebreaker for two comments in the
        // same microsecond. No score, no ranking — a conversation reads
        // forwards (docs/functional-spec/06-social.md § Comment).
        .orderBy("bookmark_comments.created_at", "asc")
        .orderBy("bookmark_comments.id", "asc")
        .execute()) as CommentWithAuthorRow[];
    }, "listCommentsByBookmark");
  }

  async findById(id: string): Promise<CommentWithAuthorRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("bookmark_comments")
        .leftJoin("profiles", "profiles.id", "bookmark_comments.user_id")
        .select(COMMENT_COLUMNS)
        .where("bookmark_comments.id", "=", id)
        .executeTakeFirst();

      return (row as CommentWithAuthorRow | undefined) ?? null;
    }, "findCommentById");
  }

  async create(data: {
    bookmarkId: string;
    userId: string;
    parentId: string | null;
    body: string;
  }): Promise<CommentWithAuthorRow> {
    return this.executeQuery(async () => {
      const inserted = await this.db
        .insertInto("bookmark_comments")
        .values({
          bookmark_id: data.bookmarkId,
          user_id: data.userId,
          parent_id: data.parentId,
          body: data.body,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Read back through the join rather than assembling the author from the
      // caller's session: the thread's author fields then come from exactly one
      // place, and a stale name in a token cannot show up in a thread.
      const row = await this.findById(inserted.id);
      if (!row) {
        throw new Error("Comment vanished immediately after insert");
      }
      return row;
    }, "createComment");
  }

  async updateOwn(
    id: string,
    userId: string,
    body: string,
    windowMs: number
  ): Promise<CommentWithAuthorRow | null> {
    return this.executeQuery(async () => {
      const seconds = Math.max(0, Math.floor(windowMs / 1000));

      const updated = await this.db
        .updateTable("bookmark_comments")
        .set({ body, updated_at: sql`now()` })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        // A tombstone is not editable back into a comment.
        .where("deleted_at", "is", null)
        // The window, as a predicate. `now()` is the database's clock, which is
        // the only one both parties share and neither party sets.
        .where(
          "created_at",
          ">",
          sql<Date>`now() - make_interval(secs => ${seconds})`
        )
        .returning("id")
        .executeTakeFirst();

      if (!updated) return null;

      return await this.findById(updated.id);
    }, "updateComment");
  }

  async deleteOwn(
    id: string,
    userId: string
  ): Promise<{ softDeleted: boolean; row: CommentWithAuthorRow | null } | null> {
    return this.executeQuery(async () => {
      const outcome = await this.db.transaction().execute(async (trx) => {
        // Lock the row for the duration, so "does it have replies?" and the
        // delete that depends on the answer cannot be separated by an insert.
        const own = await trx
          .selectFrom("bookmark_comments")
          .select(["id", "deleted_at"])
          .where("id", "=", id)
          .where("user_id", "=", userId)
          .forUpdate()
          .executeTakeFirst();

        if (!own || own.deleted_at !== null) return null;

        const replies = await trx
          .selectFrom("bookmark_comments")
          .select(({ fn }) => fn.countAll<string>().as("count"))
          .where("parent_id", "=", id)
          .where("deleted_at", "is", null)
          .executeTakeFirst();

        const hasReplies = Number(replies?.count ?? 0) > 0;

        if (hasReplies) {
          // A tombstone keeps the position and gives up everything else. The
          // body is emptied *in the database*, not just hidden by the mapper:
          // a soft delete that left the text on disk would be a soft delete in
          // name only.
          await trx
            .updateTable("bookmark_comments")
            .set({ body: "", deleted_at: sql`now()`, updated_at: sql`now()` })
            .where("id", "=", id)
            .execute();

          return { softDeleted: true };
        }

        await trx
          .deleteFrom("bookmark_comments")
          .where("id", "=", id)
          .execute();

        return { softDeleted: false };
      });

      if (!outcome) return null;

      return {
        softDeleted: outcome.softDeleted,
        row: outcome.softDeleted ? await this.findById(id) : null,
      };
    }, "deleteComment");
  }

  async commentCountFor(bookmarkId: string): Promise<number> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("bookmarks")
        .select("comment_count")
        .where("id", "=", bookmarkId)
        .executeTakeFirst();

      return row?.comment_count ?? 0;
    }, "commentCountFor");
  }

  async createReport(data: {
    reporterId: string;
    bookmarkId: string | null;
    commentId: string | null;
    reason: string;
  }): Promise<ContentReportRow | null> {
    return this.executeQuery(async () => {
      // `ON CONFLICT DO NOTHING` against the two partial unique indexes, then
      // read back. Reporting the same thing twice is one report and a 200 —
      // a 409 would tell the reporter their concern was rejected.
      const inserted = await this.db
        .insertInto("content_reports")
        .values({
          reporter_id: data.reporterId,
          bookmark_id: data.bookmarkId,
          comment_id: data.commentId,
          reason: data.reason,
        })
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .executeTakeFirst();

      if (inserted) return inserted;

      let existing = this.db
        .selectFrom("content_reports")
        .selectAll()
        .where("reporter_id", "=", data.reporterId);

      existing = data.bookmarkId
        ? existing.where("bookmark_id", "=", data.bookmarkId)
        : existing.where("comment_id", "=", data.commentId!);

      return (await existing.executeTakeFirst()) ?? null;
    }, "createReport");
  }
}
