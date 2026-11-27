import { Kysely, sql, type SqlBool } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  Bookmark,
  NewBookmark,
  BookmarkUpdate,
  NewScrapedUrlContent,
} from "../database/schema";
import { BookmarkMetadata, BookmarkProcessingPhase, ScrapedUrlContents } from "../types";
import { PgmqRepositoryImpl } from "./pgmq.repository";
import { QueueService, QueueServiceImpl } from "../services/queue.service";
import { startOfUtcDay } from "../services/processing-budget.service";

/** Today's processing budget, as the creating transaction needs it. */
export interface CreateBudget {
  dailyLimit: number;
  now: Date;
}

export interface CreateAndQueueResult {
  bookmark: Bookmark;
  /** False when the daily budget was spent: the row stands `idle`, nothing is queued. */
  queued: boolean;
}

export interface StartReprocessResult {
  bookmark: Bookmark;
  /** False when the bookmark was already `processing`: nothing changed, nothing queued. */
  queued: boolean;
}

export interface StorePastedContentResult {
  bookmark: Bookmark;
  /** False when the bookmark was already `processing`: nothing was stored or queued. */
  queued: boolean;
}

/** Builds the queue a transaction sends through, so a send commits or rolls back with it. */
export type QueueForTransaction = (transaction: Kysely<Database>) => QueueService;

/**
 * Library ordering — docs/functional-spec/04-library.md § Ordering.
 *
 * `newest` is the default everywhere, because chronological is the order the
 * Library falls back to and the one every other ordering is an overlay on.
 */
export type BookmarkSort =
  | "newest"
  | "oldest"
  | "recently_read"
  | "longest_unread";

/**
 * The last row of the previous page, decoded.
 *
 * Keyset rather than offset: a library is written to while it is being paged,
 * and an offset silently duplicates rows across the seam and drops others
 * entirely. Encoding and decoding the opaque cursor string is the API layer's
 * job; the repository only ever sees the three columns every ordering sorts on.
 */
export interface BookmarkKeyset {
  createdAt: Date;
  readAt: Date | null;
  id: string;
}

/**
 * The Library rail's rows, as a query.
 *
 * `archive` is the only scope that returns archived rows — which is what makes
 * archiving a way out of the list rather than a delete.
 */
export type BookmarkScope = "all" | "inbox" | "archive";

export interface FindByUserOptions {
  collectionId?: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  readStatus?: "all" | "unread" | "read";
  scope?: BookmarkScope;
  sort?: BookmarkSort;
  /** Resume after this row. When present, `offset` is ignored. */
  cursor?: BookmarkKeyset | null;
}

/** What the Library rail renders beside each of its rows. */
export interface BookmarkLibraryCounts {
  all: number;
  inbox: number;
  unread: number;
  archived: number;
  /** Direct members only — rolling children into a parent is the client's call. */
  collections: { collectionId: string; count: number }[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface FullTextSearchResult {
  bookmark: Bookmark;
  score: number;
}

export interface VectorSearchResult {
  bookmark: Bookmark;
  score: number;
  matchedChunk: string;
}

export interface BookmarkRepository {
  /**
   * Insert a bookmark and queue its processing message in one transaction.
   * `null` when the user already has this URL (nothing is written or queued).
   */
  createAndQueue(
    data: NewBookmark,
    budget: CreateBudget
  ): Promise<CreateAndQueueResult | null>;
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  /**
   * A row by id, whoever owns it. The caller decides whether it may be seen —
   * this is the read behind a reshare, where the bookmark being saved belongs
   * to someone else by definition.
   *
   * Every other read here is scoped to a user in SQL, which is what makes
   * "not yours" a 404 without a second query. Use that one unless the point is
   * explicitly cross-user.
   */
  findById(id: string): Promise<Bookmark | null>;
  findByIdAndUserWithLikeStatus(
    id: string,
    userId: string
  ): Promise<{ bookmark: Bookmark; isLikedByCurrentUser: boolean } | null>;
  create(data: NewBookmark): Promise<Bookmark>;
  updateOwned(id: string, userId: string, data: BookmarkUpdate): Promise<Bookmark>;
  mergeCapture(id: string, userId: string, note?: string, laterUntil?: Date | null): Promise<Bookmark>;
  insertScrapedUrlContents(
    bookmarkId: string,
    contents: Omit<
      ScrapedUrlContents,
      "id" | "createdAt" | "updatedAt" | "bookmarkId"
    >
  ): Promise<void>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
  getOwnedScrapedUrlContent(bookmarkId: string, userId: string): Promise<ScrapedUrlContents | null>;
  /**
   * Move the bookmark to `processing` and queue one message, in one
   * transaction, only if it was not already `processing`. `null` when the
   * bookmark does not exist for this user.
   */
  startReprocess(
    id: string,
    userId: string,
    options?: { phase?: BookmarkProcessingPhase }
  ): Promise<StartReprocessResult | null>;
  /**
   * Store pasted article text, start processing and queue one message in one
   * transaction. A bookmark that is already `processing` stores nothing.
   */
  storePastedContent(bookmarkId: string, userId: string, content: string): Promise<StorePastedContentResult>;
  updateScrapedUrlContents(
    id: string,
    contents: Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  ): Promise<void>;
  deleteScrapedUrlContents(bookmarkId: string): Promise<void>;
  findByUser(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
  countLibrary(userId: string): Promise<BookmarkLibraryCounts>;
  searchByQuickAccess(
    userId: string,
    query: string,
    options?: SearchOptions
  ): Promise<Bookmark[]>;
  fullTextSearch(
    userId: string,
    query: string,
    options?: SearchOptions
  ): Promise<FullTextSearchResult[]>;
  vectorSearch(
    userId: string,
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<VectorSearchResult[]>;
  findByShareSlug(slug: string): Promise<Bookmark | null>;
  markRead(id: string, userId: string): Promise<Bookmark | null>;
  markUnread(id: string, userId: string): Promise<Bookmark | null>;
  /**
   * Everything about a bookmark except where it is filed.
   *
   * `collection_id` and `filing_source` are deliberately not writable here.
   * Moving a bookmark goes through `updateAiFiling` or `updateUserFiling`, and
   * the override rule lives inside the first of those, in SQL. A generic update
   * that could also set `collection_id` is exactly the door a later refactor
   * would walk through without noticing.
   */
  update(
    id: string,
    data: Omit<BookmarkUpdate, "collection_id" | "filing_source">,
    within?: (transaction: Kysely<Database>) => Promise<void>
  ): Promise<Bookmark>;
  /**
   * Replace a placeholder title with the one the page declared.
   *
   * `WHERE title IS NOT DISTINCT FROM provisional` is the rule, as a predicate
   * on the write: an owner who retitles while the first fetch is in flight
   * changed the title away from the placeholder this call read, so the write
   * matches nothing. The title must also still be the pipeline's
   * (`metadata.titleOrigin = 'pipeline'`): an owner's title, even one equal to
   * the placeholder, and a legacy row with no recorded origin are never
   * replaced. Returns `false` when it was refused; that is not an error.
   * `quick_access` is derived from the title, so it moves with it or not at all.
   */
  replaceProvisionalTitle(
    id: string,
    provisionalTitle: string | null,
    title: string,
    quickAccess: string
  ): Promise<boolean>;
  /**
   * Keep only the post of an X row whose linked page proved unreadable, in one
   * transaction: the post-only body, links and `linked.status: unreadable` on
   * the content row, the public reading counts, cleared summary fields and
   * search text on the bookmark, and no chunks. Guarded on the linked status
   * still being `complete`; `false` when another run already did it.
   */
  downgradeLinkedSource(
    contentId: string,
    bookmarkId: string,
    postOnly: { content: string; links: Array<{ url: string; text: string }>; wordCount: number; readingTime: number }
  ): Promise<boolean>;
  /**
   * File a bookmark from the pipeline.
   *
   * `WHERE filing_source = 'ai'` **is** the override rule
   * (docs/functional-spec/03-ai-pipeline.md § Filing). It is a predicate on the
   * write rather than a check before it, so a run that reads a bookmark, thinks
   * for thirty seconds, and writes after the user has refiled it still cannot
   * move the row. Returns `null` when the write was refused — the caller
   * reports that as an override, not as a failure.
   */
  updateAiFiling(id: string, collectionId: string | null): Promise<Bookmark | null>;
  /**
   * File a bookmark on a person's behalf, and mark it theirs.
   *
   * One statement: the move and `filing_source = 'user'` cannot come apart,
   * so there is no window in which a bookmark is where the user put it but
   * still flagged as the pipeline's to move.
   */
  updateUserFiling(
    id: string,
    userId: string,
    collectionId: string | null
  ): Promise<Bookmark | null>;
  /**
   * The user's most-used tags, most-used first. Passed to the `tag` phase as
   * candidates so the vocabulary converges instead of fragmenting — see
   * docs/functional-spec/03-ai-pipeline.md § Outputs.
   */
  findTopTags(userId: string, limit: number): Promise<string[]>;
  deleteByUser(id: string, userId: string): Promise<boolean>;
}

/**
 * The four orderings, spelled out once.
 *
 * `recently_read` puts the never-read last rather than first — a bookmark with
 * no `read_at` has not been read recently, it has not been read at all.
 * `longest_unread` is its mirror: unread first, oldest first, which is the
 * order in which a backlog is most usefully worked through.
 */
const ORDER_BY: Record<BookmarkSort, ReturnType<typeof sql>[]> = {
  newest: [sql`created_at desc`, sql`id desc`],
  oldest: [sql`created_at asc`, sql`id asc`],
  recently_read: [
    sql`read_at desc nulls last`,
    sql`created_at desc`,
    sql`id desc`,
  ],
  longest_unread: [
    sql`(read_at is not null) asc`,
    sql`created_at asc`,
    sql`id asc`,
  ],
};

/**
 * "Everything strictly after this row, in this ordering."
 *
 * The null-handling is the whole difficulty: `read_at` is null for anything
 * never read, and a tuple comparison against null is null, not false — so the
 * bucket the cursor sits in decides the shape of the predicate rather than
 * being folded into it.
 */
function keysetPredicate(
  sort: BookmarkSort,
  cursor: BookmarkKeyset
): ReturnType<typeof sql<SqlBool>> {
  const { createdAt, readAt, id } = cursor;

  switch (sort) {
    case "newest":
      return sql<SqlBool>`(created_at, id) < (${createdAt}, ${id})`;
    case "oldest":
      return sql<SqlBool>`(created_at, id) > (${createdAt}, ${id})`;
    case "recently_read":
      return readAt === null
        ? sql<SqlBool>`read_at is null and (created_at, id) < (${createdAt}, ${id})`
        : sql<SqlBool>`read_at is null or (read_at, created_at, id) < (${readAt}, ${createdAt}, ${id})`;
    case "longest_unread":
      return readAt === null
        ? sql<SqlBool>`read_at is not null or (read_at is null and (created_at, id) > (${createdAt}, ${id}))`
        : sql<SqlBool>`read_at is not null and (created_at, id) > (${createdAt}, ${id})`;
  }
}

export class BookmarkRepositoryImpl
  extends BaseRepository
  implements BookmarkRepository
{
  constructor(
    db: Kysely<Database>,
    private queueFor: QueueForTransaction = (transaction) =>
      new QueueServiceImpl(new PgmqRepositoryImpl(transaction))
  ) {
    super(db);
  }

  async createAndQueue(
    data: NewBookmark,
    budget: CreateBudget
  ): Promise<CreateAndQueueResult | null> {
    return this.executeQuery(
      () =>
        this.db.transaction().execute(async (transaction) => {
          // D-7: the budget is the bookmarks created today, counted before this
          // insert. No lock: concurrent saves may overshoot by their own number.
          const dayStart = startOfUtcDay(budget.now);
          const created = await transaction
            .selectFrom("bookmarks")
            .select(({ fn }) => fn.countAll<string>().as("count"))
            .where("user_id", "=", data.user_id)
            .where("created_at", ">=", dayStart)
            .executeTakeFirstOrThrow();
          const queued = Number(created.count) < budget.dailyLimit;

          const bookmark = await transaction
            .insertInto("bookmarks")
            .values({
              ...data,
              processing_status: queued ? "processing" : "idle",
              processing_started_at: queued ? budget.now : null,
            })
            .onConflict((conflict) => conflict.columns(["user_id", "source_url"]).doNothing())
            .returningAll()
            .executeTakeFirst();
          if (!bookmark) return null;

          if (queued) {
            await this.queueFor(transaction).sendBookmarkProcessingMessage(
              bookmark.id,
              data.user_id
            );
          }
          return { bookmark, queued };
        }),
      "createAndQueue"
    );
  }

  async findByUserAndUrl(
    userId: string,
    sourceUrl: string
  ): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        .where("source_url", "=", sourceUrl)
        .executeTakeFirst();

      return result || null;
    }, "findByUserAndUrl");
  }

  async findById(id: string): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      return result || null;
    }, "findById");
  }

  async findByIdAndUser(id: string, userId: string): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return result || null;
    }, "findByIdAndUser");
  }

  async findByIdAndUserWithLikeStatus(
    id: string,
    userId: string
  ): Promise<{ bookmark: Bookmark; isLikedByCurrentUser: boolean } | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmarks")
        .leftJoin("bookmark_likes", (join) =>
          join
            .onRef("bookmark_likes.bookmark_id", "=", "bookmarks.id")
            .on("bookmark_likes.user_id", "=", userId)
        )
        .selectAll("bookmarks")
        .select("bookmark_likes.id as like_id")
        .where("bookmarks.id", "=", id)
        .where("bookmarks.user_id", "=", userId)
        .executeTakeFirst();

      if (!result) return null;

      const { like_id, ...bookmark } = result;
      return { bookmark, isLikedByCurrentUser: like_id !== null };
    }, "findByIdAndUserWithLikeStatus");
  }

  async updateOwned(id: string, userId: string, data: BookmarkUpdate): Promise<Bookmark> {
    // An owner's title, even one equal to the current title, is theirs from now on.
    const titleOrigin = data.title === undefined ? {} : { metadata: sql<any>`coalesce(metadata, '{}'::jsonb) || '{"titleOrigin":"owner"}'::jsonb` };
    return this.db.updateTable("bookmarks").set({ ...data, ...titleOrigin, updated_at: new Date() }).where("id", "=", id).where("user_id", "=", userId).returningAll().executeTakeFirstOrThrow();
  }

  async mergeCapture(id: string, userId: string, note?: string, laterUntil?: Date | null): Promise<Bookmark> {
    return this.db.updateTable("bookmarks").set({
      ...(note === undefined ? {} : { user_note: sql<string>`coalesce(user_note, ${note})` }),
      ...(laterUntil === undefined ? {} : { later_until: laterUntil }),
      updated_at: new Date(),
    }).where("id", "=", id).where("user_id", "=", userId).returningAll().executeTakeFirstOrThrow();
  }

  async create(data: NewBookmark): Promise<Bookmark> {
    return this.executeQuery(async () => {
      const result = await this.db
        .insertInto("bookmarks")
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, "create");
  }

  async insertScrapedUrlContents(
    bookmarkId: string,
    contents: Omit<
      ScrapedUrlContents,
      "id" | "createdAt" | "updatedAt" | "bookmarkId"
    >
  ): Promise<void> {
    return this.executeQuery(async () => {
      const insertData: NewScrapedUrlContent = {
        bookmark_id: bookmarkId,
        title: contents.title,
        content: contents.content,
        metadata: contents.metadata,
        images: contents.images ? JSON.stringify(contents.images) : null,
        links: contents.links ? JSON.stringify(contents.links) : null,
      };

      await this.db
        .insertInto("scraped_url_contents")
        .values(insertData)
        .execute();
    }, "insertScrapedUrlContents");
  }

  async getScrapedUrlContent(
    bookmarkId: string
  ): Promise<ScrapedUrlContents | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("scraped_url_contents")
        .selectAll()
        .where("bookmark_id", "=", bookmarkId)
        .executeTakeFirst();

      if (!result) return null;

      return {
        id: result.id,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        bookmarkId,
        title: result.title,
        content: result.content,
        metadata: result.metadata,
        images: result.images,
        links: result.links,
      };
    }, "getScrapedUrlContent");
  }

  async startReprocess(
    id: string,
    userId: string,
    options: { phase?: BookmarkProcessingPhase } = {}
  ): Promise<StartReprocessResult | null> {
    return this.executeQuery(
      () =>
        this.db.transaction().execute(async (transaction) => {
          // The guard is in the UPDATE, so two concurrent calls cannot both win.
          const started = await transaction
            .updateTable("bookmarks")
            .set({
              processing_status: "processing",
              processing_failure_code: null,
              processing_started_at: new Date(),
              processing_completed_at: null,
              processing_error: null,
              updated_at: new Date(),
            })
            .where("id", "=", id)
            .where("user_id", "=", userId)
            .where("processing_status", "<>", "processing")
            .returningAll()
            .executeTakeFirst();

          if (!started) {
            const current = await transaction
              .selectFrom("bookmarks")
              .selectAll()
              .where("id", "=", id)
              .where("user_id", "=", userId)
              .executeTakeFirst();
            return current ? { bookmark: current, queued: false } : null;
          }

          await this.queueFor(transaction).sendBookmarkProcessingMessage(id, userId, {
            phase: options.phase,
            resume: true,
          });
          return { bookmark: started, queued: true };
        }),
      "startReprocess"
    );
  }

  async storePastedContent(bookmarkId: string, userId: string, content: string): Promise<StorePastedContentResult> {
    return this.db.transaction().execute(async transaction => {
      const bookmark = await transaction.selectFrom("bookmarks").selectAll().where("id", "=", bookmarkId).where("user_id", "=", userId).forUpdate().executeTakeFirst();
      if (!bookmark) throw new Error("Bookmark not found");
      if (bookmark.is_private_link) throw new Error("Private links cannot accept article text");
      if (bookmark.processing_status === "processing") return { bookmark, queued: false };
      const existing = await transaction.selectFrom("scraped_url_contents").select("id").where("bookmark_id", "=", bookmarkId).executeTakeFirst();
      const data = { title: bookmark.title || bookmark.source_url, content, metadata: { extraction: { status: "complete", provider: "user_paste" } }, images: null, links: null, updated_at: new Date() };
      if (existing) await transaction.updateTable("scraped_url_contents").set(data).where("id", "=", existing.id).execute();
      else await transaction.insertInto("scraped_url_contents").values({ ...data, bookmark_id: bookmarkId }).execute();
      const updated = await transaction.updateTable("bookmarks").set({ processing_failure_code: null, processing_status: "processing", processing_error: null, processing_started_at: new Date(), processing_completed_at: null, updated_at: new Date() }).where("id", "=", bookmarkId).returningAll().executeTakeFirstOrThrow();
      await this.queueFor(transaction).sendBookmarkProcessingMessage(bookmarkId, userId, { resume: true });
      return { bookmark: updated, queued: true };
    });
  }

  async getOwnedScrapedUrlContent(bookmarkId: string, userId: string): Promise<ScrapedUrlContents | null> {
    const row = await this.db.selectFrom("scraped_url_contents as content")
      .innerJoin("bookmarks as bookmark", "bookmark.id", "content.bookmark_id")
      .selectAll("content")
      .where("bookmark.id", "=", bookmarkId)
      .where("bookmark.user_id", "=", userId)
      .where("bookmark.is_private_link", "=", false)
      .executeTakeFirst();
    return row ? { id: row.id, bookmarkId, title: row.title, content: row.content,
      metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at,
      images: row.images, links: row.links } : null;
  }

  async updateScrapedUrlContents(
    id: string,
    contents: Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  ): Promise<void> {
    // Keep the content id stable: highlights and chunks reference this row.
    return this.executeQuery(async () => {
      await this.db.updateTable("scraped_url_contents").set({
        title: contents.title,
        content: contents.content,
        metadata: contents.metadata,
        images: contents.images ? JSON.stringify(contents.images) : null,
        links: contents.links ? JSON.stringify(contents.links) : null,
      }).where("id", "=", id).execute();
    }, "updateScrapedUrlContents");
  }

  async deleteScrapedUrlContents(bookmarkId: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db
        .deleteFrom("scraped_url_contents")
        .where("bookmark_id", "=", bookmarkId)
        .execute();
    }, "deleteScrapedUrlContents");
  }

  async findByUser(
    userId: string,
    options: FindByUserOptions = {}
  ): Promise<Bookmark[]> {
    return this.executeQuery(async () => {
      const {
        collectionId,
        limit = 50,
        offset = 0,
        includeArchived = false,
        readStatus = "all",
        scope = "all",
        sort = "newest",
        cursor,
      } = options;

      let query = this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        .limit(limit);

      // Every ordering ends on `id` so the sort is total. Without that last
      // key, two rows saved in the same millisecond can swap places between
      // requests and the keyset cursor either repeats one or steps over it.
      for (const term of ORDER_BY[sort]) {
        query = query.orderBy(term);
      }

      if (cursor) {
        query = query.where(keysetPredicate(sort, cursor));
      } else if (offset) {
        query = query.offset(offset);
      }

      if (scope === "archive") {
        query = query.where("is_archived", "=", true);
      } else if (!includeArchived) {
        query = query.where("is_archived", "=", false);
      }

      if (scope === "inbox") {
        query = query.where("collection_id", "is", null);
      }

      if (collectionId) {
        query = query.where("collection_id", "=", collectionId);
      }

      if (readStatus === "unread") {
        query = query.where("read_at", "is", null);
      } else if (readStatus === "read") {
        query = query.where("read_at", "is not", null);
      }

      return await query.execute();
    }, "findByUser");
  }

  /**
   * Every number the Library rail shows, in two statements rather than one per
   * row. A count per tree node would be a request per collection, and the rail
   * has as many rows as the user has collections.
   */
  async countLibrary(userId: string): Promise<BookmarkLibraryCounts> {
    return this.executeQuery(async () => {
      const totals = await sql<{
        all: string | number;
        inbox: string | number;
        unread: string | number;
        archived: string | number;
      }>`
        SELECT
          count(*) FILTER (WHERE NOT is_archived) AS "all",
          count(*) FILTER (WHERE NOT is_archived AND collection_id IS NULL) AS "inbox",
          count(*) FILTER (WHERE NOT is_archived AND read_at IS NULL) AS "unread",
          count(*) FILTER (WHERE is_archived) AS "archived"
        FROM bookmarks
        WHERE user_id = ${userId}
      `.execute(this.db);

      const perCollection = await sql<{
        collection_id: string;
        count: string | number;
      }>`
        SELECT collection_id, count(*) AS count
        FROM bookmarks
        WHERE user_id = ${userId}
          AND NOT is_archived
          AND collection_id IS NOT NULL
        GROUP BY collection_id
      `.execute(this.db);

      const row = totals.rows[0];

      return {
        all: Number(row?.all ?? 0),
        inbox: Number(row?.inbox ?? 0),
        unread: Number(row?.unread ?? 0),
        archived: Number(row?.archived ?? 0),
        collections: perCollection.rows.map((entry) => ({
          collectionId: entry.collection_id,
          count: Number(entry.count),
        })),
      };
    }, "countLibrary");
  }

  async findByShareSlug(slug: string): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("share_slug", "=", slug)
        .where("is_public", "=", true)
        .executeTakeFirst();

      return result || null;
    }, "findByShareSlug");
  }

  async update(
    id: string,
    data: Omit<BookmarkUpdate, "collection_id" | "filing_source">,
    within?: (transaction: Kysely<Database>) => Promise<void>
  ): Promise<Bookmark> {
    return this.executeQuery(async () => {
      const updateData: BookmarkUpdate = { ...data };
      if (
        updateData.cosmic_images &&
        typeof updateData.cosmic_images === "object"
      ) {
        updateData.cosmic_images = JSON.stringify(updateData.cosmic_images);
      }
      if (
        updateData.cosmic_links &&
        typeof updateData.cosmic_links === "object"
      ) {
        updateData.cosmic_links = JSON.stringify(updateData.cosmic_links);
      }
      if (
        updateData.cosmic_key_points &&
        typeof updateData.cosmic_key_points === "object"
      ) {
        updateData.cosmic_key_points = JSON.stringify(
          updateData.cosmic_key_points
        );
      }

      if (updateData.metadata !== undefined && updateData.metadata !== null) {
        // Merge atomically: whatever the writer read, the stored title origin stands.
        const { titleOrigin: _ignored, ...metadata } = updateData.metadata as BookmarkMetadata;
        updateData.metadata = sql<any>`${JSON.stringify(metadata)}::jsonb || jsonb_strip_nulls(jsonb_build_object('titleOrigin', metadata->'titleOrigin'))`;
      }

      const write = (db: Kysely<Database>) =>
        db
          .updateTable("bookmarks")
          .set(updateData)
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirstOrThrow();

      if (!within) return write(this.db);
      // `within` commits or rolls back with the row: the worker closes the run
      // and disposes of its queue message in the same transaction.
      return this.db.transaction().execute(async (transaction) => {
        const result = await write(transaction);
        await within(transaction);
        return result;
      });
    }, "update");
  }

  async replaceProvisionalTitle(
    id: string,
    provisionalTitle: string | null,
    title: string,
    quickAccess: string
  ): Promise<boolean> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("bookmarks")
        .set({ title, quick_access: quickAccess })
        .where("id", "=", id)
        .where("title", "is not distinct from", provisionalTitle)
        .where(sql<string>`metadata->>'titleOrigin'`, "=", "pipeline")
        .returning("id")
        .executeTakeFirst();

      return result !== undefined;
    }, "replaceProvisionalTitle");
  }

  async downgradeLinkedSource(
    contentId: string,
    bookmarkId: string,
    postOnly: { content: string; links: Array<{ url: string; text: string }>; wordCount: number; readingTime: number }
  ): Promise<boolean> {
    return this.executeQuery(
      () =>
        this.db.transaction().execute(async (transaction) => {
          const downgraded = await transaction
            .updateTable("scraped_url_contents")
            .set({
              content: postOnly.content,
              links: JSON.stringify(postOnly.links),
              metadata: sql<any>`jsonb_set(metadata, '{extraction,linked,status}', '"unreadable"')`,
              updated_at: new Date(),
            })
            .where("id", "=", contentId)
            .where(sql<string>`metadata #>> '{extraction,linked,status}'`, "=", "complete")
            .returning("id")
            .executeTakeFirst();
          if (!downgraded) return false;
          await transaction
            .updateTable("bookmarks")
            .set({
              metadata: sql<any>`coalesce(metadata, '{}'::jsonb) || ${JSON.stringify({ wordCount: postOnly.wordCount, readingTime: postOnly.readingTime })}::jsonb`,
              cosmic_summary: "",
              cosmic_brief_summary: "",
              cosmic_key_points: JSON.stringify([]) as any,
              search_document: null,
              updated_at: new Date(),
            })
            .where("id", "=", bookmarkId)
            .execute();
          await transaction.deleteFrom("content_chunks").where("scraped_content_id", "=", contentId).execute();
          return true;
        }),
      "downgradeLinkedSource"
    );
  }

  async markRead(id: string, userId: string): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("bookmarks")
        .set({ read_at: new Date() })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return result || null;
    }, "markRead");
  }

  async markUnread(id: string, userId: string): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("bookmarks")
        .set({ read_at: null })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return result || null;
    }, "markUnread");
  }

  /**
   * The override rule, as a predicate.
   *
   * See the interface for why this is a `WHERE` and not an `if`. A refused
   * write returns `null`; it is not an error, and the pipeline must not treat
   * it as one.
   */
  async updateAiFiling(
    id: string,
    collectionId: string | null
  ): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("bookmarks")
        .set({ collection_id: collectionId })
        .where("id", "=", id)
        .where("filing_source", "=", "ai")
        .returningAll()
        .executeTakeFirst();

      return result || null;
    }, "updateAiFiling");
  }

  async updateUserFiling(
    id: string,
    userId: string,
    collectionId: string | null
  ): Promise<Bookmark | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("bookmarks")
        .set({ collection_id: collectionId, filing_source: "user" })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return result || null;
    }, "updateUserFiling");
  }

  async findTopTags(userId: string, limit: number): Promise<string[]> {
    if (limit <= 0) return [];

    return this.executeQuery(async () => {
      const result = await sql<{ tag: string }>`
        SELECT tag, count(*) AS uses
        FROM bookmarks, unnest(cosmic_tags) AS tag
        WHERE user_id = ${userId}
          AND cosmic_tags IS NOT NULL
        GROUP BY tag
        ORDER BY uses DESC, tag ASC
        LIMIT ${limit}
      `.execute(this.db);

      return result.rows.map((row) => row.tag);
    }, "findTopTags");
  }

  async deleteByUser(id: string, userId: string): Promise<boolean> {
    return this.executeQuery(async () => {
      const result = await this.db
        .deleteFrom("bookmarks")
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      return BigInt(result.numDeletedRows) > 0;
    }, "deleteByUser");
  }

  async searchByQuickAccess(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<Bookmark[]> {
    return this.executeQuery(async () => {
      const { limit = 50, offset = 0, includeArchived = false } = options;

      let sqlQuery = this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        .where(sql<boolean>`quick_access &@~ ${query}`)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);

      if (!includeArchived) {
        sqlQuery = sqlQuery.where("is_archived", "=", false);
      }

      return await sqlQuery.execute();
    }, "searchByQuickAccess");
  }

  async fullTextSearch(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<FullTextSearchResult[]> {
    return this.executeQuery(async () => {
      const { limit = 20, offset = 0, includeArchived = false } = options;

      const results = await sql<
        Bookmark & { pgroonga_score: number }
      >`SELECT *, pgroonga_score(tableoid, ctid) AS pgroonga_score
        FROM bookmarks
        WHERE user_id = ${userId}
          AND search_document &@~ ${query}
          AND is_private_link = false
          ${includeArchived ? sql`` : sql`AND is_archived = false`}
        ORDER BY pgroonga_score DESC
        LIMIT ${limit}
        OFFSET ${offset}`.execute(this.db);

      return results.rows.map((row) => ({
        bookmark: row,
        score: row.pgroonga_score,
      }));
    }, "fullTextSearch");
  }

  async vectorSearch(
    userId: string,
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    return this.executeQuery(async () => {
      const { limit = 20, includeArchived = false } = options;

      const vectorStr = `[${queryEmbedding.join(",")}]`;

      const results = await sql<{
        bookmark_id: string;
        chunk_content: string;
        similarity: number;
      }>`SELECT
          b.id AS bookmark_id,
          tc.content AS chunk_content,
          1 - (tc.embedding <=> ${vectorStr}::vector) AS similarity
        FROM text_chunks tc
        INNER JOIN content_chunks cc ON cc.id = tc.chunk_id
        INNER JOIN scraped_url_contents suc ON suc.id = cc.scraped_content_id
        INNER JOIN bookmarks b ON b.id = suc.bookmark_id
        WHERE b.user_id = ${userId}
          AND tc.embedding IS NOT NULL
          AND b.is_private_link = false
          ${includeArchived ? sql`` : sql`AND b.is_archived = false`}
        ORDER BY tc.embedding <=> ${vectorStr}::vector
        LIMIT ${limit}`.execute(this.db);

      const bookmarkIds = [
        ...new Set(results.rows.map((r) => r.bookmark_id)),
      ];

      if (bookmarkIds.length === 0) return [];

      const bookmarks = await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("id", "in", bookmarkIds)
        .execute();

      const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]));

      const seen = new Set<string>();
      const searchResults: VectorSearchResult[] = [];

      for (const row of results.rows) {
        const bookmark = bookmarkMap.get(row.bookmark_id);
        if (!bookmark || seen.has(row.bookmark_id)) continue;
        seen.add(row.bookmark_id);

        searchResults.push({
          bookmark,
          score: row.similarity,
          matchedChunk: row.chunk_content,
        });
      }

      return searchResults;
    }, "vectorSearch");
  }
}
