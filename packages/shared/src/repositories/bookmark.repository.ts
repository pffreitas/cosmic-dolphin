import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  Bookmark,
  NewBookmark,
  BookmarkUpdate,
  NewScrapedUrlContent,
} from "../database/schema";
import { ScrapedUrlContents } from "../types";

export interface FindByUserOptions {
  collectionId?: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  readStatus?: "all" | "unread" | "read";
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
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  findByIdAndUserWithLikeStatus(
    id: string,
    userId: string
  ): Promise<{ bookmark: Bookmark; isLikedByCurrentUser: boolean } | null>;
  create(data: NewBookmark): Promise<Bookmark>;
  insertScrapedUrlContents(
    bookmarkId: string,
    contents: Omit<
      ScrapedUrlContents,
      "id" | "createdAt" | "updatedAt" | "bookmarkId"
    >
  ): Promise<void>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
  deleteScrapedUrlContents(bookmarkId: string): Promise<void>;
  findByUser(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
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
    data: Omit<BookmarkUpdate, "collection_id" | "filing_source">
  ): Promise<Bookmark>;
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

export class BookmarkRepositoryImpl
  extends BaseRepository
  implements BookmarkRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
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
      } = options;

      let query = this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);

      if (!includeArchived) {
        query = query.where("is_archived", "=", false);
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
    data: Omit<BookmarkUpdate, "collection_id" | "filing_source">
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

      const result = await this.db
        .updateTable("bookmarks")
        .set(updateData)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, "update");
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
