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
  create(data: NewBookmark): Promise<Bookmark>;
  insertScrapedUrlContents(
    bookmarkId: string,
    contents: Omit<
      ScrapedUrlContents,
      "id" | "createdAt" | "updatedAt" | "bookmarkId"
    >
  ): Promise<void>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
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
  update(id: string, data: BookmarkUpdate): Promise<Bookmark>;
  delete(id: string): Promise<void>;
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

  async update(id: string, data: BookmarkUpdate): Promise<Bookmark> {
    return this.executeQuery(async () => {
      const updateData = { ...data };
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

      const result = await this.db
        .updateTable("bookmarks")
        .set(updateData)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, "update");
  }

  async delete(id: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db.deleteFrom("bookmarks").where("id", "=", id).execute();
    }, "delete");
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
