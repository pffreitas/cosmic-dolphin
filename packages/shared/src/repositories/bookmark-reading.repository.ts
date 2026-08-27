import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  BookmarkHighlightRow,
  BookmarkReadingProgressRow,
  Bookmark as BookmarkRow,
} from "../database/schema";

/**
 * Reading progress and highlights, in one repository because they answer the
 * same question from two directions: what has been read, and what was worth
 * marking.
 *
 * Two rules are enforced *here*, in SQL, rather than in the routes above:
 *
 *  - **Progress is monotonic.** The upsert carries
 *    `WHERE excluded.percent >= bookmark_reading_progress.percent`, so a lower
 *    value cannot land — not from a stale request that overtook a fresh one,
 *    not from a second tab, not from a client that decided to be creative.
 *    A read-modify-write in a service would have a race between the read and
 *    the write; this has none.
 *
 *  - **Highlights are private, even on a public bookmark.** Every statement
 *    against `bookmark_highlights` names `user_id`. Sharing a bookmark makes
 *    the *page* public, and a highlight is a note about oneself, not part of
 *    the page. A route guard would put that rule one forgotten `if` away from
 *    being untrue; a predicate in every query cannot be forgotten, because
 *    without it the query has no reader to bind to.
 *
 * Every write is scoped to a bookmark the caller owns by selecting from
 * `bookmarks` inside the statement, so ownership is checked in the same round
 * trip and there is no window between the check and the write.
 */
export interface BookmarkReadingRepository {
  /**
   * Write progress, keeping the higher of the two values.
   *
   * Returns `null` when the bookmark does not exist or is not the caller's.
   * Otherwise returns the stored row and whether the submitted value was the
   * one kept.
   */
  saveProgress(
    bookmarkId: string,
    userId: string,
    percent: number,
    scrollOffset: number | null
  ): Promise<{ row: BookmarkReadingProgressRow; accepted: boolean } | null>;

  findProgress(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkReadingProgressRow | null>;

  /** In-flight reads for Home's Continue reading rail, newest activity first. */
  findContinueReading(
    userId: string,
    limit: number
  ): Promise<{ bookmark: BookmarkRow; progress: BookmarkReadingProgressRow }[]>;

  findHighlightsByBookmark(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkHighlightRow[]>;

  findHighlightById(
    id: string,
    userId: string
  ): Promise<BookmarkHighlightRow | null>;

  /** Returns `null` when the bookmark is not the caller's. */
  createHighlight(data: {
    bookmarkId: string;
    userId: string;
    quote: string;
    prefix: string | null;
    suffix: string | null;
    note: string | null;
  }): Promise<BookmarkHighlightRow | null>;

  /** The note is the only mutable field. Returns `null` when not the caller's. */
  updateHighlightNote(
    id: string,
    userId: string,
    note: string | null
  ): Promise<BookmarkHighlightRow | null>;

  /** False when there was nothing of the caller's to delete. */
  deleteHighlight(id: string, userId: string): Promise<boolean>;
}

/**
 * A bookmark is *in progress* between these bounds —
 * docs/functional-spec/04-library.md § Reading progress. Below the floor it was
 * opened, not started; above the ceiling the product offers to mark it read
 * instead of offering to resume it. They match the partial index's predicate,
 * so the rail's query is index-only over exactly the rows it wants.
 */
export const IN_PROGRESS_MIN_PERCENT = 5;
export const IN_PROGRESS_MAX_PERCENT = 95;

export class BookmarkReadingRepositoryImpl
  extends BaseRepository
  implements BookmarkReadingRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async saveProgress(
    bookmarkId: string,
    userId: string,
    percent: number,
    scrollOffset: number | null
  ): Promise<{ row: BookmarkReadingProgressRow; accepted: boolean } | null> {
    return this.executeQuery(async () => {
      // One statement does three things: proves the bookmark is the caller's
      // (the SELECT finds nothing otherwise), inserts or updates the cursor,
      // and refuses to move it backwards.
      //
      // `>=` rather than `>` so a resend at the same percent still refreshes
      // `updated_at` and the scroll offset. That is what keeps the Continue
      // reading rail ordered by actual activity while a reader lingers on a
      // long page, and it is the reason a repeated write is idempotent in
      // effect without being ignored in fact.
      const inserted = await sql<BookmarkReadingProgressRow>`
        INSERT INTO bookmark_reading_progress
            (user_id, bookmark_id, percent, scroll_offset, updated_at)
        SELECT ${userId}::uuid, b.id, ${percent}::smallint, ${scrollOffset}::integer, now()
        FROM bookmarks b
        WHERE b.id = ${bookmarkId}::uuid
          AND b.user_id = ${userId}::uuid
        ON CONFLICT (user_id, bookmark_id) DO UPDATE
        SET percent = excluded.percent,
            scroll_offset = excluded.scroll_offset,
            updated_at = now()
        WHERE excluded.percent >= bookmark_reading_progress.percent
        RETURNING *
      `.execute(this.db);

      const row = inserted.rows[0];
      if (row) return { row, accepted: true };

      // No row came back, which is two different situations: the conflict
      // target existed and the guard refused the update, or the bookmark is
      // not the caller's. One extra read tells them apart — and it only ever
      // runs on the cold path, because the overwhelming majority of writes
      // move progress forward.
      const stored = await this.findProgress(bookmarkId, userId);
      if (!stored) return null;

      return { row: stored, accepted: false };
    }, "saveProgress");
  }

  async findProgress(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkReadingProgressRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("bookmark_reading_progress")
        .selectAll()
        .where("bookmark_id", "=", bookmarkId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return row ?? null;
    }, "findProgress");
  }

  async findContinueReading(
    userId: string,
    limit: number
  ): Promise<
    { bookmark: BookmarkRow; progress: BookmarkReadingProgressRow }[]
  > {
    return this.executeQuery(async () => {
      // `read_at IS NULL` is how this composes with the read state that
      // already exists (20260617000001) instead of contradicting it. A person
      // who marked a half-read article read has finished with it, whatever the
      // scroll position says — the rail is for things they mean to return to,
      // and leaving a dismissed article in it is how a "continue" rail becomes
      // a nag. Archived saves are out for the same reason.
      const rows = await this.db
        .selectFrom("bookmark_reading_progress as p")
        .innerJoin("bookmarks as b", "b.id", "p.bookmark_id")
        .selectAll("b")
        .select([
          "p.percent as progress_percent",
          "p.scroll_offset as progress_scroll_offset",
          "p.updated_at as progress_updated_at",
          "p.bookmark_id as progress_bookmark_id",
          "p.user_id as progress_user_id",
        ])
        .where("p.user_id", "=", userId)
        .where("b.user_id", "=", userId)
        .where("p.percent", ">=", IN_PROGRESS_MIN_PERCENT)
        .where("p.percent", "<=", IN_PROGRESS_MAX_PERCENT)
        .where("b.read_at", "is", null)
        .where("b.is_archived", "=", false)
        .orderBy("p.updated_at", "desc")
        .limit(limit)
        .execute();

      return rows.map((row) => {
        const {
          progress_percent,
          progress_scroll_offset,
          progress_updated_at,
          progress_bookmark_id,
          progress_user_id,
          ...bookmark
        } = row as typeof row & Record<string, unknown>;

        return {
          bookmark: bookmark as unknown as BookmarkRow,
          progress: {
            user_id: progress_user_id as string,
            bookmark_id: progress_bookmark_id as string,
            percent: progress_percent as number,
            scroll_offset: progress_scroll_offset as number | null,
            updated_at: progress_updated_at as Date,
          },
        };
      });
    }, "findContinueReading");
  }

  async findHighlightsByBookmark(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkHighlightRow[]> {
    return this.executeQuery(async () => {
      // `user_id` is not an optimisation here. It is the privacy rule: a
      // second viewer of a public bookmark runs this same query with their own
      // id and gets their own highlights, which is usually none.
      return await this.db
        .selectFrom("bookmark_highlights")
        .selectAll()
        .where("bookmark_id", "=", bookmarkId)
        .where("user_id", "=", userId)
        .orderBy("created_at", "asc")
        .execute();
    }, "findHighlightsByBookmark");
  }

  async findHighlightById(
    id: string,
    userId: string
  ): Promise<BookmarkHighlightRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("bookmark_highlights")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return row ?? null;
    }, "findHighlightById");
  }

  async createHighlight(data: {
    bookmarkId: string;
    userId: string;
    quote: string;
    prefix: string | null;
    suffix: string | null;
    note: string | null;
  }): Promise<BookmarkHighlightRow | null> {
    return this.executeQuery(async () => {
      // Ownership is the SELECT's job. Highlighting is an act on your own copy
      // of a page, so a public bookmark someone else saved is not highlightable
      // — there is nowhere private to put the result.
      const result = await sql<BookmarkHighlightRow>`
        INSERT INTO bookmark_highlights
            (user_id, bookmark_id, quote, prefix, suffix, note)
        SELECT ${data.userId}::uuid, b.id, ${data.quote}::text, ${data.prefix}::text, ${data.suffix}::text, ${data.note}::text
        FROM bookmarks b
        WHERE b.id = ${data.bookmarkId}::uuid
          AND b.user_id = ${data.userId}::uuid
        RETURNING *
      `.execute(this.db);

      return result.rows[0] ?? null;
    }, "createHighlight");
  }

  async updateHighlightNote(
    id: string,
    userId: string,
    note: string | null
  ): Promise<BookmarkHighlightRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .updateTable("bookmark_highlights")
        .set({ note })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return row ?? null;
    }, "updateHighlightNote");
  }

  async deleteHighlight(id: string, userId: string): Promise<boolean> {
    return this.executeQuery(async () => {
      const row = await this.db
        .deleteFrom("bookmark_highlights")
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returning("id")
        .executeTakeFirst();

      return row !== undefined;
    }, "deleteHighlight");
  }
}
