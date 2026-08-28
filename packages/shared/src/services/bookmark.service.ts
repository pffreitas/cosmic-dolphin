import {
  Bookmark,
  BookmarkMetadata,
  ScrapedUrlContents,
  SearchBookmarksQuery,
  ShareBookmarkResponse,
  ProcessingStatus,
  CollectionPathItem,
} from "../types";
import { nanoid } from "nanoid";
import {
  BookmarkLibraryCounts,
  BookmarkRepository,
  CollectionRepository,
  FindByUserOptions,
  SearchOptions,
} from "../repositories";
import { WebScrapingService } from "./web-scraping.service";
import { NewBookmark, BookmarkUpdate } from "../database/schema";

export interface PrivateLinkMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  collectionId?: string;
  /** The URL exactly as the user pasted it, before normalisation. */
  originalUrl?: string;
}

export interface CreateBookmarkOptions {
  /**
   * The URL exactly as the user pasted it. Stored in `metadata.originalUrl`;
   * defaults to the normalised URL when the paste was already normal.
   */
  originalUrl?: string;
  collectionId?: string;
  /**
   * Reshare provenance — the bookmark this save came from
   * (docs/functional-spec/06-social.md § Reshare).
   *
   * It is the *only* thing a reshare inherits beyond the URL. The summary,
   * tags, filing and thread are not copied: the pipeline runs again for the
   * new owner, against their tree.
   *
   * The column is `ON DELETE SET NULL`, so deleting the original leaves this
   * save intact with no provenance rather than deleting or orphaning it.
   */
  savedFromBookmarkId?: string;
  /**
   * A title already known — the original's, on a reshare. Saves the row
   * showing a bare URL until the `fetch` phase lands. The pipeline overwrites
   * it with the scraped title either way, so this is legibility, not data.
   */
  title?: string;
}

export interface BookmarkService {
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  findByIdAndUser(id: string, userId: string): Promise<Bookmark | null>;
  /**
   * A bookmark someone else may own, if the viewer is allowed to see it at
   * all: public, or the viewer's own. `null` otherwise — never a "you are not
   * allowed" distinguishable from "it does not exist".
   *
   * The same rule `CommentService` reads a thread by. It is deliberately *not*
   * the whole of "may this caller reshare it": a block is a property of the
   * two people, not of the bookmark, and lives in `SocialService`.
   */
  findVisibleById(id: string, viewerId: string): Promise<Bookmark | null>;
  findByIdAndUserWithLikeStatus(
    id: string,
    userId: string
  ): Promise<{ bookmark: Bookmark; isLikedByCurrentUser: boolean } | null>;
  getScrapedUrlContent(bookmarkId: string): Promise<ScrapedUrlContents | null>;
  create(
    url: string,
    userId: string,
    options?: CreateBookmarkOptions
  ): Promise<Bookmark>;
  ensureScrapedContent(bookmark: Bookmark): Promise<ScrapedUrlContents | null>;
  createPrivateLink(
    url: string,
    userId: string,
    metadata: PrivateLinkMetadata
  ): Promise<Bookmark>;
  convertToPrivateLink(
    bookmark: Bookmark,
    metadata: PrivateLinkMetadata
  ): Promise<Bookmark>;
  findByUser(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
  countLibrary(userId: string): Promise<BookmarkLibraryCounts>;
  findFeed(userId: string, options?: FindByUserOptions): Promise<Bookmark[]>;
  searchByQuickAccess(
    userId: string,
    query: string,
    options?: SearchOptions
  ): Promise<Bookmark[]>;
  /**
   * Everything except where the bookmark is filed. `collectionId` and
   * `filingSource` are absent from the accepted shape on purpose — moving a
   * bookmark is `fileByPipeline` or `refileByUser`, never a side effect of
   * writing something else.
   */
  update(
    id: string,
    data: Partial<Omit<Bookmark, "collectionId" | "filingSource">>
  ): Promise<Bookmark>;
  /**
   * File a bookmark from the pipeline. Refused, and returns `null`, when the
   * bookmark's `filingSource` is `'user'`.
   *
   * The refusal happens in SQL (`BookmarkRepository.updateAiFiling`), so it
   * holds even when the decision was taken before the user refiled.
   */
  fileByPipeline(id: string, collectionId: string | null): Promise<Bookmark | null>;
  /**
   * File a bookmark on the user's behalf and mark it theirs, permanently.
   * The move and `filing_source = 'user'` happen in one statement.
   */
  refileByUser(
    id: string,
    userId: string,
    collectionId: string | null
  ): Promise<Bookmark | null>;
  /** The user's most-used tags — candidates for the `tag` phase. */
  getTopTags(userId: string, limit?: number): Promise<string[]>;
  updateProcessingStatus(
    id: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<Bookmark>;
  share(bookmarkId: string, userId: string): Promise<ShareBookmarkResponse>;
  unshare(bookmarkId: string, userId: string): Promise<ShareBookmarkResponse>;
  markRead(bookmarkId: string, userId: string): Promise<Bookmark>;
  markUnread(bookmarkId: string, userId: string): Promise<Bookmark>;
  findByShareSlug(slug: string): Promise<Bookmark | null>;
  delete(id: string, userId: string): Promise<void>;
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

  async findVisibleById(
    id: string,
    viewerId: string
  ): Promise<Bookmark | null> {
    const row = await this.bookmarkRepository.findById(id);
    if (!row) return null;

    const mapped = this.mapDatabaseToBookmark(row);
    if (!mapped.isPublic && mapped.userId !== viewerId) return null;

    return mapped;
  }

  async findByIdAndUserWithLikeStatus(
    id: string,
    userId: string
  ): Promise<{ bookmark: Bookmark; isLikedByCurrentUser: boolean } | null> {
    const result =
      await this.bookmarkRepository.findByIdAndUserWithLikeStatus(id, userId);
    if (!result) return null;
    const mapped = this.mapDatabaseToBookmark(result.bookmark);
    const bookmark = await this.enrichWithCollectionPath(mapped);
    return { bookmark, isLikedByCurrentUser: result.isLikedByCurrentUser };
  }

  /**
   * Write the row and return. Nothing here touches the network.
   *
   * Saving never blocks (docs/functional-spec/02-capture.md): the page fetch
   * used to happen here, inline, which put a third-party server's latency on
   * the critical path of the single most-used action in the product. It now
   * happens in the worker via `ensureScrapedContent`, and the only metadata
   * this writes is what can be derived from the URL string itself — a
   * provisional title from the path, a favicon guess from the host — so the
   * row is legible the instant it exists.
   *
   * `url` is expected to be normalised already; `originalUrl` is the paste.
   */
  async create(
    url: string,
    userId: string,
    options: CreateBookmarkOptions = {}
  ): Promise<Bookmark> {
    const urlMetadata = this.webScrapingService.extractMetadataFromUrl(url);
    const provisionalTitle = options.title || urlMetadata.title || url;

    const metadata: BookmarkMetadata = {
      openGraph: {
        title: provisionalTitle,
        favicon: urlMetadata.favicon,
        site_name: urlMetadata.siteName,
        url,
      },
      originalUrl: options.originalUrl ?? url,
    };

    const newBookmark: NewBookmark = {
      source_url: url,
      title: provisionalTitle,
      metadata,
      user_id: userId,
      collection_id: options.collectionId || null,
      // A collection named at save time was named by a person, so the pipeline
      // does not get to second-guess it — same rule as a manual refile.
      filing_source: options.collectionId ? "user" : "ai",
      // Provenance only. A reshare lands in Inbox like any other save, so the
      // `file` phase files it against the resharer's tree — the original
      // owner's collection is not theirs and must not travel with the URL.
      saved_from_bookmark_id: options.savedFromBookmarkId ?? null,
      quick_access: `${provisionalTitle} ${url}`,
    };

    const bookmark = await this.bookmarkRepository.create(newBookmark);

    return this.mapDatabaseToBookmark(bookmark);
  }

  /**
   * Fetch the page if it has not been fetched yet, and fold what came back
   * into the bookmark.
   *
   * Called by the pipeline, never by the create path. Idempotent: a reprocess
   * or a redelivered queue message reuses the content already on disk rather
   * than hitting the origin again.
   */
  async ensureScrapedContent(
    bookmark: Bookmark
  ): Promise<ScrapedUrlContents | null> {
    const existing = await this.bookmarkRepository.getScrapedUrlContent(
      bookmark.id
    );
    if (existing) return existing;

    const scraped = await this.webScrapingService.scrape(bookmark.sourceUrl);
    await this.bookmarkRepository.insertScrapedUrlContents(
      bookmark.id,
      scraped
    );

    // The provisional title and the URL-derived favicon were placeholders.
    // Now that the real page has been read, replace them — but keep
    // `originalUrl`, which the scrape knows nothing about.
    const metadata: BookmarkMetadata = {
      ...scraped.metadata,
      originalUrl: bookmark.metadata?.originalUrl,
    };
    const title = scraped.title || bookmark.title || bookmark.sourceUrl;

    await this.bookmarkRepository.update(bookmark.id, {
      title,
      metadata,
      quick_access: `${title} ${bookmark.sourceUrl}`,
    });

    bookmark.title = title;
    bookmark.metadata = metadata;

    return this.bookmarkRepository.getScrapedUrlContent(bookmark.id);
  }

  async createPrivateLink(
    url: string,
    userId: string,
    metadata: PrivateLinkMetadata
  ): Promise<Bookmark> {
    const newBookmark = this.buildPrivateLinkBookmarkData(
      url,
      userId,
      metadata
    );

    const bookmark = await this.bookmarkRepository.create(newBookmark);
    return this.mapDatabaseToBookmark(bookmark);
  }

  async convertToPrivateLink(
    bookmark: Bookmark,
    metadata: PrivateLinkMetadata
  ): Promise<Bookmark> {
    const privateLinkData = this.buildPrivateLinkBookmarkData(
      bookmark.sourceUrl,
      bookmark.userId,
      // The paste that created this row is already recorded; converting it to
      // a private link must not overwrite it with the normalised form.
      { ...metadata, originalUrl: metadata.originalUrl ?? bookmark.metadata?.originalUrl },
      bookmark.title
    );
    // Filing is not part of a generic update — see `BookmarkRepository.update`.
    // A collection named in the conversion form was named by a person, so it
    // goes through the user path and takes the override flag with it.
    const { source_url, user_id, collection_id, filing_source, ...updateData } =
      privateLinkData;

    await this.bookmarkRepository.deleteScrapedUrlContents(bookmark.id);
    let updatedBookmark = await this.bookmarkRepository.update(bookmark.id, {
      ...updateData,
      processing_started_at: null,
      processing_completed_at: null,
      processing_error: null,
    });

    if (metadata.collectionId) {
      updatedBookmark =
        (await this.bookmarkRepository.updateUserFiling(
          bookmark.id,
          bookmark.userId,
          metadata.collectionId
        )) ?? updatedBookmark;
    }

    return this.mapDatabaseToBookmark(updatedBookmark);
  }

  private buildPrivateLinkBookmarkData(
    url: string,
    userId: string,
    metadata: PrivateLinkMetadata,
    fallbackTitle?: string
  ): NewBookmark {
    const title = metadata.title || fallbackTitle || url;
    const urlMetadata = this.webScrapingService.extractMetadataFromUrl(url);
    const description = metadata.description?.trim() || "";
    const bookmarkMetadata: BookmarkMetadata = {
      openGraph: {
        title,
        description: description || undefined,
        favicon: urlMetadata.favicon,
        site_name: urlMetadata.siteName,
        url,
      },
      privateLink: {
        userDescription: description,
        userProvidedTitle: metadata.title,
      },
      originalUrl: metadata.originalUrl ?? url,
    };

    return {
      source_url: url,
      title,
      metadata: bookmarkMetadata,
      user_id: userId,
      collection_id: metadata.collectionId || null,
      filing_source: metadata.collectionId ? "user" : "ai",
      cosmic_summary: null,
      cosmic_brief_summary: description || null,
      cosmic_tags: metadata.tags || null,
      quick_access: [title, url, description].filter(Boolean).join(" "),
      search_document: null,
      processing_status: "idle",
      is_private_link: true,
    };
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

  /** The Library rail's mono counts. Straight through — no enrichment to do. */
  async countLibrary(userId: string): Promise<BookmarkLibraryCounts> {
    return this.bookmarkRepository.countLibrary(userId);
  }

  async findFeed(
    userId: string,
    options: FindByUserOptions = {}
  ): Promise<Bookmark[]> {
    return this.findByUser(userId, {
      ...options,
      readStatus: "unread",
      includeArchived: false,
    });
  }

  /**
   * Everything a run produces except where the bookmark is filed.
   *
   * `collectionId` and `filingSource` are absent by design: the pipeline hands
   * this method a whole `Bookmark`, and if filing were part of it, every
   * unrelated write would carry a move with it — including on a bookmark the
   * user had refiled by hand. Moving a bookmark is `fileByPipeline` or
   * `refileByUser`, and the repository will not accept it any other way.
   */
  async update(
    id: string,
    data: Partial<
      Omit<
        Bookmark,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "sourceUrl"
        | "userId"
        | "collectionId"
        | "filingSource"
      >
    >
  ): Promise<Bookmark> {
    const updateData: Omit<
      BookmarkUpdate,
      "collection_id" | "filing_source"
    > = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.isArchived !== undefined) updateData.is_archived = data.isArchived;
    if (data.isFavorite !== undefined) updateData.is_favorite = data.isFavorite;
    if (data.cosmicSummary !== undefined)
      updateData.cosmic_summary = data.cosmicSummary;
    if (data.cosmicBriefSummary !== undefined)
      updateData.cosmic_brief_summary = data.cosmicBriefSummary;
    if (data.cosmicKeyPoints !== undefined)
      updateData.cosmic_key_points = data.cosmicKeyPoints;
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

  async fileByPipeline(
    id: string,
    collectionId: string | null
  ): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.updateAiFiling(
      id,
      collectionId
    );
    return bookmark ? this.mapDatabaseToBookmark(bookmark) : null;
  }

  async refileByUser(
    id: string,
    userId: string,
    collectionId: string | null
  ): Promise<Bookmark | null> {
    const bookmark = await this.bookmarkRepository.updateUserFiling(
      id,
      userId,
      collectionId
    );
    return bookmark ? this.mapDatabaseToBookmark(bookmark) : null;
  }

  async getTopTags(userId: string, limit = 50): Promise<string[]> {
    return this.bookmarkRepository.findTopTags(userId, limit);
  }

  async delete(id: string, userId: string): Promise<void> {
    const deleted = await this.bookmarkRepository.deleteByUser(id, userId);
    if (!deleted) {
      throw new Error("Bookmark not found");
    }
  }

  async markRead(bookmarkId: string, userId: string): Promise<Bookmark> {
    const bookmark = await this.bookmarkRepository.markRead(bookmarkId, userId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }
    return this.mapDatabaseToBookmark(bookmark);
  }

  async markUnread(bookmarkId: string, userId: string): Promise<Bookmark> {
    const bookmark = await this.bookmarkRepository.markUnread(
      bookmarkId,
      userId
    );
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }
    return this.mapDatabaseToBookmark(bookmark);
  }

  async updateProcessingStatus(
    id: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<Bookmark> {
    const updateData: BookmarkUpdate = {
      processing_status: status,
    };

    if (status === "idle") {
      // No run has started. Anything left over from a previous one would read
      // as a run in progress or a failure that is no longer true.
      updateData.processing_started_at = null;
      updateData.processing_completed_at = null;
      updateData.processing_error = null;
    } else if (status === "processing") {
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
    return mapDatabaseRowToBookmark(data);
  }
}

/**
 * A bookmark row as the API's `Bookmark`.
 *
 * Lifted out of `BookmarkServiceImpl` so the reading service can map the rows
 * its Continue reading join returns without either depending on the other. The
 * mapping is pure and has no business being a method.
 */
export function mapDatabaseRowToBookmark(data: any): Bookmark {
  return {
    id: data.id,
    sourceUrl: data.source_url,
    title: data.title,
    metadata: data.metadata,
    collectionId: data.collection_id,
    filingSource: data.filing_source ?? "ai",
    savedFromBookmarkId: data.saved_from_bookmark_id ?? undefined,
    userId: data.user_id,
    isArchived: data.is_archived,
    isFavorite: data.is_favorite,
    cosmicSummary: data.cosmic_summary,
    cosmicBriefSummary: data.cosmic_brief_summary,
    cosmicKeyPoints: data.cosmic_key_points ?? undefined,
    cosmicTags: data.cosmic_tags,
    cosmicImages: data.cosmic_images,
    cosmicLinks: data.cosmic_links,
    quickAccess: data.quick_access,
    searchDocument: data.search_document,
    isPrivateLink: data.is_private_link ?? false,
    likeCount: data.like_count ?? 0,
    commentCount: data.comment_count ?? 0,
    isPublic: data.is_public ?? false,
    shareSlug: data.share_slug ?? undefined,
    readAt: data.read_at ? new Date(data.read_at) : undefined,
    isRead: data.read_at != null,
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
