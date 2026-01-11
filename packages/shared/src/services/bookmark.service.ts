import {
  Bookmark,
  ScrapedUrlContents,
  SearchBookmarksQuery,
  ProcessingStatus,
} from "../types";
import {
  BookmarkRepository,
  FindByUserOptions,
  SearchOptions,
} from "../repositories";
import { WebScrapingService } from "./web-scraping.service";
import { NewBookmark, BookmarkUpdate } from "../database/schema";

export interface BookmarkService {
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
  create(url: string, userId: string): Promise<Bookmark>;
  findByUser(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
  searchByQuickAccess(
    userId: string,
    query: string,
    options?: SearchOptions
  ): Promise<Bookmark[]>;
  update(id: string, data: Partial<Bookmark>): Promise<Bookmark>;
  updateProcessingStatus(
    id: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<Bookmark>;
  delete(id: string): Promise<void>;
}

export class BookmarkServiceImpl implements BookmarkService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private webScrapingService: WebScrapingService
  ) {}

  async findByUserAndUrl(
    userId: string,
    sourceUrl: string
  ): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.findByUserAndUrl(
      userId,
      sourceUrl
    );
    return bookmark ? this.mapDatabaseToBookmark(bookmark) : null;
  }

  async findByIdAndUser(id: string, userId: string): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.findByIdAndUser(id, userId);
    return bookmark ? this.mapDatabaseToBookmark(bookmark) : null;
  }

  async create(url: string, userId: string): Promise<Bookmark> {
    const scrapedUrlContents = await this.webScrapingService.scrape(url);

    const newBookmark: NewBookmark = {
      source_url: url,
      title: scrapedUrlContents.title,
      metadata: scrapedUrlContents.metadata,
      user_id: userId,
      quick_access: `${scrapedUrlContents.title} ${url}`,
    };

    const bookmark = await this.bookmarkRepository.create(newBookmark);
    await this.bookmarkRepository.insertScrapedUrlContents(
      bookmark.id,
      scrapedUrlContents
    );

    return this.mapDatabaseToBookmark(bookmark);
  }

  async getScrapedUrlContent(
    bookmarkId: string
  ): Promise<ScrapedUrlContents | null> {
    return this.bookmarkRepository.getScrapedUrlContent(bookmarkId);
  }

  async findByUser(
    userId: string,
    options: FindByUserOptions = {}
  ): Promise<Bookmark[]> {
    const bookmarks = await this.bookmarkRepository.findByUser(userId, options);
    return bookmarks.map(this.mapDatabaseToBookmark);
  }

  async update(
    id: string,
    data: Omit<
      Bookmark,
      "id" | "createdAt" | "updatedAt" | "sourceUrl" | "userId"
    >
  ): Promise<Bookmark> {
    const updateData: BookmarkUpdate = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.collectionId !== undefined)
      updateData.collection_id = data.collectionId;
    if (data.isArchived !== undefined) updateData.is_archived = data.isArchived;
    if (data.isFavorite !== undefined) updateData.is_favorite = data.isFavorite;
    if (data.cosmicSummary !== undefined)
      updateData.cosmic_summary = data.cosmicSummary;
    if (data.cosmicTags !== undefined) updateData.cosmic_tags = data.cosmicTags;
    if (data.cosmicImages !== undefined)
      updateData.cosmic_images = data.cosmicImages;
    if (data.cosmicLinks !== undefined)
      updateData.cosmic_links = data.cosmicLinks;
    if (data.quickAccess !== undefined)
      updateData.quick_access = data.quickAccess;

    const bookmark = await this.bookmarkRepository.update(id, updateData);
    return this.mapDatabaseToBookmark(bookmark);
  }

  async delete(id: string): Promise<void> {
    await this.bookmarkRepository.delete(id);
  }

  async updateProcessingStatus(
    id: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<Bookmark> {
    const updateData: BookmarkUpdate = {
      processing_status: status,
    };

    if (status === "processing") {
      updateData.processing_started_at = new Date();
      updateData.processing_completed_at = null;
      updateData.processing_error = null;
    } else if (status === "completed") {
      updateData.processing_completed_at = new Date();
      updateData.processing_error = null;
    } else if (status === "failed") {
      updateData.processing_completed_at = new Date();
      updateData.processing_error = error || "Unknown error";
    }

    const bookmark = await this.bookmarkRepository.update(id, updateData);
    return this.mapDatabaseToBookmark(bookmark);
  }

  async searchByQuickAccess(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<Bookmark[]> {
    const bookmarks = await this.bookmarkRepository.searchByQuickAccess(
      userId,
      query,
      options
    );
    return bookmarks.map(this.mapDatabaseToBookmark);
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
      cosmicSummary: data.cosmic_summary,
      cosmicTags: data.cosmic_tags,
      cosmicImages: data.cosmic_images,
      cosmicLinks: data.cosmic_links,
      quickAccess: data.quick_access,
      processingStatus: data.processing_status || "idle",
      processingStartedAt: data.processing_started_at
        ? new Date(data.processing_started_at)
        : undefined,
      processingCompletedAt: data.processing_completed_at
        ? new Date(data.processing_completed_at)
        : undefined,
      processingError: data.processing_error,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
