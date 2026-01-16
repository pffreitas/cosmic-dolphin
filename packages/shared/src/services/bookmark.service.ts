import {
  Bookmark,
  ScrapedUrlContents,
  SearchBookmarksQuery,
  ProcessingStatus,
  CollectionPathItem,
} from "../types";
import {
  BookmarkRepository,
  CollectionRepository,
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
    private webScrapingService: WebScrapingService,
    private collectionRepository?: CollectionRepository
  ) {}

  async findByUserAndUrl(
    userId: string,
    sourceUrl: string
  ): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.findByUserAndUrl(
      userId,
      sourceUrl
    );
    if (!bookmark) return null;
    const mapped = this.mapDatabaseToBookmark(bookmark);
    return this.enrichWithCollectionPath(mapped);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.findByIdAndUser(id, userId);
    if (!bookmark) return null;
    const mapped = this.mapDatabaseToBookmark(bookmark);
    return this.enrichWithCollectionPath(mapped);
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
    const mapped = bookmarks.map((b) => this.mapDatabaseToBookmark(b));
    return this.enrichManyWithCollectionInfo(mapped);
  }

  async update(
    id: string,
    data: Partial<
      Omit<Bookmark, "id" | "createdAt" | "updatedAt" | "sourceUrl" | "userId">
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
    if (data.cosmicBriefSummary !== undefined)
      updateData.cosmic_brief_summary = data.cosmicBriefSummary;
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
    const mapped = bookmarks.map((b) => this.mapDatabaseToBookmark(b));
    return this.enrichManyWithCollectionInfo(mapped);
  }

  private async enrichWithCollectionPath(
    bookmark: Bookmark
  ): Promise<Bookmark> {
    if (!bookmark.collectionId || !this.collectionRepository) {
      return bookmark;
    }

    const collectionPath = await this.collectionRepository.getCollectionPath(
      bookmark.collectionId
    );

    return {
      ...bookmark,
      collectionPath,
    };
  }

  private async enrichManyWithCollectionInfo(
    bookmarks: Bookmark[]
  ): Promise<Bookmark[]> {
    if (!this.collectionRepository) {
      return bookmarks;
    }

    // Collect unique collection IDs
    const collectionIds = [
      ...new Set(
        bookmarks
          .map((b) => b.collectionId)
          .filter((id): id is string => id !== undefined && id !== null)
      ),
    ];

    if (collectionIds.length === 0) {
      return bookmarks;
    }

    try {
      // Fetch all collections in one batch (just id and name, no hierarchy)
      const collectionsMap =
        await this.collectionRepository.getCollectionsByIds(collectionIds);

      // Enrich bookmarks with collection info (single-element array for consistency)
      return bookmarks.map((bookmark) => {
        if (!bookmark.collectionId) {
          return bookmark;
        }

        const collection = collectionsMap.get(bookmark.collectionId);
        return {
          ...bookmark,
          collectionPath: collection ? [collection] : undefined,
        };
      });
    } catch (error) {
      // If collection enrichment fails, return bookmarks without collection paths
      console.error("Failed to enrich bookmarks with collection info:", error);
      return bookmarks;
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
      cosmicSummary: data.cosmic_summary,
      cosmicBriefSummary: data.cosmic_brief_summary,
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
