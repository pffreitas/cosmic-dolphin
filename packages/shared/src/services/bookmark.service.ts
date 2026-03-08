import {
  Bookmark,
  ScrapedUrlContents,
  SearchBookmarksQuery,
  ShareBookmarkResponse,
  ProcessingStatus,
  CollectionPathItem,
} from "../types";
import { nanoid } from "nanoid";
import {
  BookmarkRepository,
  CollectionRepository,
  FindByUserOptions,
  SearchOptions,
} from "../repositories";
import { WebScrapingService } from "./web-scraping.service";
import { NewBookmark, BookmarkUpdate } from "../database/schema";
import { AI } from "../ai";
import { z } from "zod";

export interface PrivateLinkMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  collectionId?: string;
}

const PRIVATE_LINK_INFERENCE_PROMPT = `You are analyzing a URL that cannot be fully scraped (it's behind authentication or otherwise inaccessible).
Based on the URL and any metadata available, infer a short description and relevant tags.

URL: {{URL}}
Title: {{TITLE}}
Site: {{SITE_NAME}}

Return a JSON object with:
- "description": A brief, useful description of what this link likely contains (1-2 sentences)
- "tags": An array of 2-5 relevant tags (lowercase, no spaces, use hyphens for multi-word tags)

Be specific based on URL patterns. For example:
- GitHub URLs: infer repo name, whether it's a PR, issue, etc.
- Jira/Linear URLs: infer it's a ticket/task
- Google Docs: infer it's a document
- Figma: infer it's a design file`;

export interface BookmarkService {
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
  create(url: string, userId: string): Promise<Bookmark>;
  createPrivateLink(
    url: string,
    userId: string,
    metadata: PrivateLinkMetadata
  ): Promise<Bookmark>;
  inferPrivateLinkMetadata(
    url: string,
    title?: string,
    siteName?: string
  ): Promise<{ tags: string[]; description: string }>;
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
  share(bookmarkId: string, userId: string): Promise<ShareBookmarkResponse>;
  unshare(bookmarkId: string, userId: string): Promise<ShareBookmarkResponse>;
  findByShareSlug(slug: string): Promise<Bookmark | null>;
  delete(id: string, userId: string): Promise<void>;
}

export class BookmarkServiceImpl implements BookmarkService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private webScrapingService: WebScrapingService,
    private collectionRepository?: CollectionRepository,
    private ai?: AI
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

  async createPrivateLink(
    url: string,
    userId: string,
    metadata: PrivateLinkMetadata
  ): Promise<Bookmark> {
    const title = metadata.title || url;
    const newBookmark: NewBookmark = {
      source_url: url,
      title,
      user_id: userId,
      collection_id: metadata.collectionId || null,
      cosmic_brief_summary: metadata.description || null,
      cosmic_tags: metadata.tags || null,
      quick_access: `${title} ${url}`,
      processing_status: "completed",
      processing_completed_at: new Date(),
      is_private_link: true,
    };

    const bookmark = await this.bookmarkRepository.create(newBookmark);
    return this.mapDatabaseToBookmark(bookmark);
  }

  async inferPrivateLinkMetadata(
    url: string,
    title?: string,
    siteName?: string
  ): Promise<{ tags: string[]; description: string }> {
    if (!this.ai) {
      return { tags: [], description: "" };
    }

    const prompt = PRIVATE_LINK_INFERENCE_PROMPT
      .replace("{{URL}}", url)
      .replace("{{TITLE}}", title || "Unknown")
      .replace("{{SITE_NAME}}", siteName || "Unknown");

    const result = await this.ai.generateObject({
      sessionID: "private-link-inference",
      modelId: "google/gemini-2.5-flash",
      prompt,
      schema: z.object({
        description: z.string().describe("Brief description of the link"),
        tags: z.array(z.string()).describe("Relevant tags for the link"),
      }),
    });

    return result;
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
    if (data.searchDocument !== undefined)
      updateData.search_document = data.searchDocument;

    const bookmark = await this.bookmarkRepository.update(id, updateData);
    return this.mapDatabaseToBookmark(bookmark);
  }

  async delete(id: string, userId: string): Promise<void> {
    const deleted = await this.bookmarkRepository.deleteByUser(id, userId);
    if (!deleted) {
      throw new Error("Bookmark not found");
    }
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

  async share(
    bookmarkId: string,
    userId: string
  ): Promise<ShareBookmarkResponse> {
    const bookmark = await this.bookmarkRepository.findByIdAndUser(
      bookmarkId,
      userId
    );
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    const shareSlug = bookmark.share_slug || nanoid(10);
    await this.bookmarkRepository.update(bookmarkId, {
      is_public: true,
      share_slug: shareSlug,
    });

    const webAppUrl = process.env.WEB_APP_URL || "https://cosmicdolphin.com";
    return {
      isPublic: true,
      shareUrl: `${webAppUrl}/s/${shareSlug}`,
    };
  }

  async unshare(
    bookmarkId: string,
    userId: string
  ): Promise<ShareBookmarkResponse> {
    const bookmark = await this.bookmarkRepository.findByIdAndUser(
      bookmarkId,
      userId
    );
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    await this.bookmarkRepository.update(bookmarkId, {
      is_public: false,
    });

    return {
      isPublic: false,
      shareUrl: "",
    };
  }

  async findByShareSlug(slug: string): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.findByShareSlug(slug);
    if (!bookmark) return null;
    const mapped = this.mapDatabaseToBookmark(bookmark);
    return this.enrichWithCollectionPath(mapped);
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
      searchDocument: data.search_document,
      isPrivateLink: data.is_private_link ?? false,
      likeCount: data.like_count ?? 0,
      isPublic: data.is_public ?? false,
      shareSlug: data.share_slug ?? undefined,
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
