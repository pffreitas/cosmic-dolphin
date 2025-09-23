import { Kysely } from "kysely";
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

export interface BookmarkRepository {
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  create(data: NewBookmark): Promise<Bookmark>;
  insertScrapedUrlContents(
    bookmarkId: string,
    contents: Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  ): Promise<void>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
  findByUser(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
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
    contents: Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
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
}
