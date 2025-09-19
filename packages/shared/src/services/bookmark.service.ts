import { Bookmark, ScrapedUrlContents } from "../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { WebScrapingService } from "./web-scraping.service";

export interface FindByUserOptions {
  collectionId?: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface BookmarkService {
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  create(url: string, userId: string): Promise<Bookmark>;
  findByUser(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
  update(id: string, data: Partial<Bookmark>): Promise<Bookmark>;
  delete(id: string): Promise<void>;
}

export class BookmarkServiceImpl implements BookmarkService {
  constructor(
    private supabaseClient: SupabaseClient,
    private webScrapingService: WebScrapingService
  ) {}

  async findByUserAndUrl(
    userId: string,
    sourceUrl: string
  ): Promise<Bookmark | null> {
    const { data, error } = await this.supabaseClient
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .eq("source_url", sourceUrl)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        console.log("Bookmark not found", error);
        return null;
      }
      throw new Error(`Failed to find bookmark: ${error.message}`);
    }

    return this.mapDatabaseToBookmark(data);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Bookmark | null> {
    const { data, error } = await this.supabaseClient
      .from("bookmarks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to find bookmark: ${error.message}`);
    }

    return this.mapDatabaseToBookmark(data);
  }

  async create(url: string, userId: string): Promise<Bookmark> {
    const scrapedUrlContents = await this.webScrapingService.scrape(url);

    const bookmark = await this.insertBookmark({
      sourceUrl: url,
      title: scrapedUrlContents.title,
      metadata: scrapedUrlContents.metadata,
      userId,
    });

    await this.insertScrapedUrlContents(bookmark.id, scrapedUrlContents);

    return bookmark;
  }

  private async insertBookmark(
    data: Omit<Bookmark, "id" | "createdAt" | "updatedAt">
  ): Promise<Bookmark> {
    const insertData = {
      source_url: data.sourceUrl,
      title: data.title,
      metadata: data.metadata,
      collection_id: data.collectionId,
      user_id: data.userId,
      is_archived: data.isArchived || false,
      is_favorite: data.isFavorite || false,
      content: data.content,
      cosmic_summary: data.cosmicSummary,
    };

    const { data: bookmark, error } = await this.supabaseClient
      .from("bookmarks")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bookmark: ${error.message}`);
    }

    return this.mapDatabaseToBookmark(bookmark);
  }

  private async insertScrapedUrlContents(
    bookmarkId: string,
    scrapedUrlContents: Omit<ScrapedUrlContents, "bookmarkId">
  ): Promise<void> {
    const insertData = {
      bookmark_id: bookmarkId,
      title: scrapedUrlContents.title,
      content: scrapedUrlContents.content,
      metadata: scrapedUrlContents.metadata,
      images: scrapedUrlContents.images || [],
      links: scrapedUrlContents.links || [],
    };

    const { error } = await this.supabaseClient
      .from("scraped_url_contents")
      .insert(insertData);

    if (error) {
      throw new Error(
        `Failed to insert scraped URL contents: ${error.message}`
      );
    }
  }

  async findByUser(
    userId: string,
    options: {
      collectionId?: string;
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<Bookmark[]> {
    const {
      collectionId,
      limit = 50,
      offset = 0,
      includeArchived = false,
    } = options;

    let query = this.supabaseClient
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    return data.map(this.mapDatabaseToBookmark);
  }

  async update(
    id: string,
    data: Omit<
      Bookmark,
      "id" | "createdAt" | "updatedAt" | "sourceUrl" | "userId"
    >
  ): Promise<Bookmark> {
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.collectionId !== undefined)
      updateData.collection_id = data.collectionId;
    if (data.isArchived !== undefined) updateData.is_archived = data.isArchived;
    if (data.isFavorite !== undefined) updateData.is_favorite = data.isFavorite;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.cosmicSummary !== undefined)
      updateData.summary = data.cosmicSummary;
    if (data.cosmicTags !== undefined) updateData.tags = data.cosmicTags;

    const { data: bookmark, error } = await this.supabaseClient
      .from("bookmarks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update bookmark: ${error.message}`);
    }

    return this.mapDatabaseToBookmark(bookmark);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from("bookmarks")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete bookmark: ${error.message}`);
    }
  }

  private mapDatabaseToBookmark(data: any): Bookmark {
    return {
      id: data.id,
      sourceUrl: data.source_url,
      title: data.title,
      metadata: data.metadata,
      collectionId: data.collection_id,
      userId: data.user_id,
      isArchived: data.is_archived,
      isFavorite: data.is_favorite,
      content: data.content,
      cosmicSummary: data.summary,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
