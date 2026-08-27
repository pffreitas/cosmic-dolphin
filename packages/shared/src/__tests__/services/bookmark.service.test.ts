import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BookmarkServiceImpl } from "../../services/bookmark.service";
import { BookmarkRepository } from "../../repositories";
import { WebScrapingService } from "../../services/web-scraping.service";
import { TestDataFactory } from "../../test-utils/factories";
import { ScrapedUrlContents } from "../../types";

describe("BookmarkService", () => {
  let service: BookmarkServiceImpl;
  let mockRepository: jest.Mocked<BookmarkRepository>;
  let mockWebScrapingService: jest.Mocked<WebScrapingService>;
  let testUserId: string;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findByUserAndUrl: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByIdAndUserWithLikeStatus: jest.fn(),
      insertScrapedUrlContents: jest.fn(),
      getScrapedUrlContent: jest.fn(),
      findByUser: jest.fn(),
      searchByQuickAccess: jest.fn(),
      fullTextSearch: jest.fn(),
      vectorSearch: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      update: jest.fn(),
      updateAiFiling: jest.fn(),
      updateUserFiling: jest.fn(),
      findTopTags: jest.fn<any>(),
      deleteScrapedUrlContents: jest.fn(),
      deleteByUser: jest.fn(),
      findByShareSlug: jest.fn(),
    } as jest.Mocked<BookmarkRepository>;

    mockWebScrapingService = {
      scrape: jest.fn(),
      isValidUrl: jest.fn(),
      scrapeContent: jest.fn(),
      extractMetadataFromUrl: jest.fn(),
    } as jest.Mocked<WebScrapingService>;

    service = new BookmarkServiceImpl(mockRepository, mockWebScrapingService);
    testUserId = TestDataFactory.generateUserId();
  });

  describe("getScrapedUrlContent", () => {
    it("should delegate to repository and return scraped content", async () => {
      const bookmarkId = "test-bookmark-id";
      const mockScrapedContent: ScrapedUrlContents = {
        id: "test-scraped-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        bookmarkId,
        title: "Test Title",
        content: "Test content",
        metadata: {
          openGraph: TestDataFactory.createOpenGraphMetadata(),
          wordCount: 100,
          readingTime: 1,
        },
        images: [{ url: "https://example.com/image.jpg", alt: "Test image" }],
        links: [{ url: "https://example.com/link", text: "Test link" }],
      };

      mockRepository.getScrapedUrlContent.mockResolvedValue(mockScrapedContent);

      const result = await service.getScrapedUrlContent(bookmarkId);

      expect(mockRepository.getScrapedUrlContent).toHaveBeenCalledWith(
        bookmarkId
      );
      expect(result).toEqual(mockScrapedContent);
    });

    it("should return null when no scraped content exists", async () => {
      const bookmarkId = "non-existent-bookmark-id";

      mockRepository.getScrapedUrlContent.mockResolvedValue(null);

      const result = await service.getScrapedUrlContent(bookmarkId);

      expect(mockRepository.getScrapedUrlContent).toHaveBeenCalledWith(
        bookmarkId
      );
      expect(result).toBeNull();
    });

    it("should handle repository errors gracefully", async () => {
      const bookmarkId = "test-bookmark-id";
      const error = new Error("Database connection failed");

      mockRepository.getScrapedUrlContent.mockRejectedValue(error);

      await expect(service.getScrapedUrlContent(bookmarkId)).rejects.toThrow(
        "Database connection failed"
      );
      expect(mockRepository.getScrapedUrlContent).toHaveBeenCalledWith(
        bookmarkId
      );
    });
  });

  describe("create", () => {
    const URL = "https://every.to/p/agent-memory";

    function stubUrlMetadata() {
      mockWebScrapingService.extractMetadataFromUrl.mockReturnValue({
        title: "Agent Memory",
        favicon: "https://every.to/favicon.ico",
        siteName: "Every",
        url: URL,
      });
    }

    function createdRow(overrides: Record<string, unknown> = {}) {
      const now = new Date();
      return {
        id: "new-bookmark-id",
        source_url: URL,
        title: "Agent Memory",
        metadata: {},
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: null,
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access: null,
        search_document: null,
        is_private_link: false,
        is_public: false,
        share_slug: null,
        like_count: 0,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        created_at: now,
        updated_at: now,
        ...overrides,
      } as any;
    }

    it("never fetches the page — saving must not block on a third party", async () => {
      stubUrlMetadata();
      mockRepository.create.mockResolvedValue(createdRow());

      await service.create(URL, testUserId);

      expect(mockWebScrapingService.scrape).not.toHaveBeenCalled();
      expect(mockRepository.insertScrapedUrlContents).not.toHaveBeenCalled();
    });

    it("stores the paste in metadata.originalUrl and the normalised URL in source_url", async () => {
      stubUrlMetadata();
      mockRepository.create.mockResolvedValue(createdRow());

      await service.create(URL, testUserId, {
        originalUrl: "https://Every.to/p/agent-memory/?utm_source=twitter",
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source_url: URL,
          user_id: testUserId,
          metadata: expect.objectContaining({
            originalUrl: "https://Every.to/p/agent-memory/?utm_source=twitter",
          }),
        })
      );
    });

    it("falls back to the normalised URL when there was no separate paste", async () => {
      stubUrlMetadata();
      mockRepository.create.mockResolvedValue(createdRow());

      await service.create(URL, testUserId);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ originalUrl: URL }),
        })
      );
    });

    it("writes a provisional title and favicon derived from the URL alone", async () => {
      stubUrlMetadata();
      mockRepository.create.mockResolvedValue(createdRow());

      await service.create(URL, testUserId);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Agent Memory",
          quick_access: `Agent Memory ${URL}`,
          metadata: expect.objectContaining({
            openGraph: expect.objectContaining({
              title: "Agent Memory",
              favicon: "https://every.to/favicon.ico",
              site_name: "Every",
              url: URL,
            }),
          }),
        })
      );
    });

    it("files into the requested collection", async () => {
      stubUrlMetadata();
      mockRepository.create.mockResolvedValue(createdRow());

      await service.create(URL, testUserId, { collectionId: "collection-1" });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ collection_id: "collection-1" })
      );
    });
  });

  describe("ensureScrapedContent", () => {
    const bookmark = {
      id: "bookmark-1",
      sourceUrl: "https://every.to/p/agent-memory",
      userId: "user-1",
      title: "Agent Memory",
      metadata: { originalUrl: "https://every.to/p/agent-memory/?ref=hn" },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    it("reuses content already on disk rather than hitting the origin again", async () => {
      const existing = { id: "scraped-1" } as any;
      mockRepository.getScrapedUrlContent.mockResolvedValue(existing);

      const result = await service.ensureScrapedContent({ ...bookmark });

      expect(result).toBe(existing);
      expect(mockWebScrapingService.scrape).not.toHaveBeenCalled();
    });

    it("fetches, persists, and folds the real title back into the bookmark", async () => {
      const scraped = {
        title: "How agent memory actually works",
        content: "<p>…</p>",
        metadata: { openGraph: { title: "How agent memory actually works" } },
      } as any;
      const persisted = { id: "scraped-1", ...scraped } as any;

      mockRepository.getScrapedUrlContent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(persisted);
      mockWebScrapingService.scrape.mockResolvedValue(scraped);
      mockRepository.update.mockResolvedValue({} as any);

      const target = { ...bookmark };
      const result = await service.ensureScrapedContent(target);

      expect(mockWebScrapingService.scrape).toHaveBeenCalledWith(
        bookmark.sourceUrl
      );
      expect(mockRepository.insertScrapedUrlContents).toHaveBeenCalledWith(
        bookmark.id,
        scraped
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        bookmark.id,
        expect.objectContaining({
          title: "How agent memory actually works",
        })
      );
      expect(target.title).toBe("How agent memory actually works");
      expect(result).toBe(persisted);
    });

    it("keeps metadata.originalUrl, which the scrape knows nothing about", async () => {
      mockRepository.getScrapedUrlContent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "scraped-1" } as any);
      mockWebScrapingService.scrape.mockResolvedValue({
        title: "Real title",
        content: "",
        metadata: { openGraph: { title: "Real title" } },
      } as any);
      mockRepository.update.mockResolvedValue({} as any);

      await service.ensureScrapedContent({ ...bookmark });

      expect(mockRepository.update).toHaveBeenCalledWith(
        bookmark.id,
        expect.objectContaining({
          metadata: expect.objectContaining({
            originalUrl: "https://every.to/p/agent-memory/?ref=hn",
          }),
        })
      );
    });
  });

  describe("createPrivateLink", () => {
    it("should save private-link user context without scraped content", async () => {
      const now = new Date();
      const createdBookmark = {
        id: "private-bookmark-id",
        source_url: "https://figma.com/file/private-design",
        title: "Private Design File",
        metadata: {
          openGraph: {
            title: "Private Design File",
            description: "Design review for checkout",
            favicon: "https://figma.com/favicon.ico",
            site_name: "Figma",
            url: "https://figma.com/file/private-design",
          },
          privateLink: {
            userDescription: "Design review for checkout",
            userProvidedTitle: "Private Design File",
          },
        },
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: "Design review for checkout",
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access:
          "Private Design File https://figma.com/file/private-design Design review for checkout",
        search_document: null,
        is_private_link: true,
        is_public: false,
        share_slug: null,
        like_count: 0,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        created_at: now,
        updated_at: now,
      };

      mockWebScrapingService.extractMetadataFromUrl.mockReturnValue({
        title: "Private Design",
        favicon: "https://figma.com/favicon.ico",
        siteName: "Figma",
        url: "https://figma.com/file/private-design",
      });
      mockRepository.create.mockResolvedValue(createdBookmark as any);

      const result = await service.createPrivateLink(
        "https://figma.com/file/private-design",
        testUserId,
        {
          title: "Private Design File",
          description: "Design review for checkout",
        }
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source_url: "https://figma.com/file/private-design",
          title: "Private Design File",
          user_id: testUserId,
          is_private_link: true,
          processing_status: "idle",
          cosmic_summary: null,
          search_document: null,
          cosmic_brief_summary: "Design review for checkout",
          quick_access:
            "Private Design File https://figma.com/file/private-design Design review for checkout",
          metadata: expect.objectContaining({
            privateLink: {
              userDescription: "Design review for checkout",
              userProvidedTitle: "Private Design File",
            },
          }),
        })
      );
      expect(mockRepository.insertScrapedUrlContents).not.toHaveBeenCalled();
      expect(result.isPrivateLink).toBe(true);
      expect(result.cosmicSummary).toBeNull();
      expect((result.metadata as any).privateLink.userDescription).toBe(
        "Design review for checkout"
      );
      expect((result.metadata as any).privateLink).not.toHaveProperty(
        "quickAccessHint"
      );
    });

    it("should convert an existing empty scrape into a private-link record", async () => {
      const now = new Date();
      const existingBookmark = {
        id: "existing-bookmark-id",
        sourceUrl: "https://ab-inbev.atlassian.net/browse/BEESIP-33999",
        title: "Jira",
        userId: testUserId,
        isArchived: false,
        isFavorite: false,
        isPrivateLink: false,
        isPublic: false,
        processingStatus: "completed" as const,
        createdAt: now,
        updatedAt: now,
      };
      const updatedBookmark = {
        id: "existing-bookmark-id",
        source_url: "https://ab-inbev.atlassian.net/browse/BEESIP-33999",
        title: "BEESIP-33999 Jira ticket",
        metadata: {
          openGraph: {
            title: "BEESIP-33999 Jira ticket",
            description: "Private Jira ticket for importer failures",
            favicon: "https://ab-inbev.atlassian.net/favicon.ico",
            site_name: "Ab-inbev",
            url: "https://ab-inbev.atlassian.net/browse/BEESIP-33999",
          },
          privateLink: {
            userDescription: "Private Jira ticket for importer failures",
            userProvidedTitle: "BEESIP-33999 Jira ticket",
          },
        },
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: "Private Jira ticket for importer failures",
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access:
          "BEESIP-33999 Jira ticket https://ab-inbev.atlassian.net/browse/BEESIP-33999 Private Jira ticket for importer failures",
        search_document: null,
        is_private_link: true,
        is_public: false,
        share_slug: null,
        like_count: 0,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        created_at: now,
        updated_at: now,
      };

      mockWebScrapingService.extractMetadataFromUrl.mockReturnValue({
        title: "Browse / BEESIP 33999",
        favicon: "https://ab-inbev.atlassian.net/favicon.ico",
        siteName: "Ab-inbev",
        url: "https://ab-inbev.atlassian.net/browse/BEESIP-33999",
      });
      mockRepository.deleteScrapedUrlContents.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(updatedBookmark as any);

      const result = await service.convertToPrivateLink(
        existingBookmark,
        {
          title: "BEESIP-33999 Jira ticket",
          description: "Private Jira ticket for importer failures",
        }
      );

      expect(mockRepository.deleteScrapedUrlContents).toHaveBeenCalledWith(
        "existing-bookmark-id"
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        "existing-bookmark-id",
        expect.objectContaining({
          title: "BEESIP-33999 Jira ticket",
          is_private_link: true,
          cosmic_summary: null,
          cosmic_brief_summary: "Private Jira ticket for importer failures",
          search_document: null,
          processing_status: "idle",
          processing_started_at: null,
          processing_completed_at: null,
          processing_error: null,
        })
      );
      expect(result.isPrivateLink).toBe(true);
      expect(result.searchDocument).toBeNull();
      expect((result.metadata as any).privateLink).not.toHaveProperty(
        "quickAccessHint"
      );
    });
  });

  describe("mapDatabaseToBookmark", () => {
    it("should derive read fields from read_at", () => {
      const readAt = new Date("2026-06-16T12:00:00.000Z");
      const dbBookmark = {
        id: "test-id",
        source_url: "https://example.com",
        title: "Test Title",
        metadata: null,
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: null,
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access: null,
        search_document: null,
        is_private_link: false,
        like_count: 0,
        is_public: false,
        share_slug: null,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        read_at: readAt,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mappedBookmark = (service as any).mapDatabaseToBookmark(dbBookmark);

      expect(mappedBookmark.readAt).toEqual(readAt);
      expect(mappedBookmark.isRead).toBe(true);
    });

    it("should mark bookmarks without read_at as unread", () => {
      const dbBookmark = {
        id: "test-id",
        source_url: "https://example.com",
        title: "Test Title",
        metadata: null,
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: null,
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access: null,
        search_document: null,
        is_private_link: false,
        like_count: 0,
        is_public: false,
        share_slug: null,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        read_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mappedBookmark = (service as any).mapDatabaseToBookmark(dbBookmark);

      expect(mappedBookmark.readAt).toBeUndefined();
      expect(mappedBookmark.isRead).toBe(false);
    });

    it("should not include content field in mapped bookmark", () => {
      const dbBookmark = {
        id: "test-id",
        source_url: "https://example.com",
        title: "Test Title",
        content: "This should not be mapped", // This field should be ignored
        metadata: {
          openGraph: TestDataFactory.createOpenGraphMetadata(),
          wordCount: 100,
          readingTime: 1,
        },
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Use reflection to access the private method for testing
      const mappedBookmark = (service as any).mapDatabaseToBookmark(dbBookmark);

      expect(mappedBookmark.id).toBe(dbBookmark.id);
      expect(mappedBookmark.sourceUrl).toBe(dbBookmark.source_url);
      expect(mappedBookmark.title).toBe(dbBookmark.title);
      expect(mappedBookmark.userId).toBe(dbBookmark.user_id);
      expect(mappedBookmark).not.toHaveProperty("content");
    });
  });

  describe("read state", () => {
    it("should mark a bookmark read for the owning user", async () => {
      const readAt = new Date("2026-06-16T12:00:00.000Z");
      const dbBookmark = {
        id: "bookmark-id",
        source_url: "https://example.com",
        title: "Read bookmark",
        metadata: null,
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: null,
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access: null,
        search_document: null,
        is_private_link: false,
        like_count: 0,
        is_public: false,
        share_slug: null,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        read_at: readAt,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.markRead.mockResolvedValue(dbBookmark as any);

      const result = await service.markRead("bookmark-id", testUserId);

      expect(mockRepository.markRead).toHaveBeenCalledWith(
        "bookmark-id",
        testUserId
      );
      expect(result.isRead).toBe(true);
      expect(result.readAt).toEqual(readAt);
    });

    it("should throw Bookmark not found when marking read fails ownership check", async () => {
      mockRepository.markRead.mockResolvedValue(null);

      await expect(service.markRead("bookmark-id", testUserId)).rejects.toThrow(
        "Bookmark not found"
      );
    });

    it("should clear read state when marking unread", async () => {
      const dbBookmark = {
        id: "bookmark-id",
        source_url: "https://example.com",
        title: "Unread bookmark",
        metadata: null,
        collection_id: null,
        user_id: testUserId,
        is_archived: false,
        is_favorite: false,
        cosmic_summary: null,
        cosmic_brief_summary: null,
        cosmic_tags: null,
        cosmic_images: null,
        cosmic_links: null,
        quick_access: null,
        search_document: null,
        is_private_link: false,
        like_count: 0,
        is_public: false,
        share_slug: null,
        processing_status: "idle",
        processing_started_at: null,
        processing_completed_at: null,
        processing_error: null,
        read_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.markUnread.mockResolvedValue(dbBookmark as any);

      const result = await service.markUnread("bookmark-id", testUserId);

      expect(mockRepository.markUnread).toHaveBeenCalledWith(
        "bookmark-id",
        testUserId
      );
      expect(result.isRead).toBe(false);
      expect(result.readAt).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should call repository.deleteByUser with correct id and userId", async () => {
      const bookmarkId = "test-bookmark-id";
      mockRepository.deleteByUser.mockResolvedValue(true);

      await service.delete(bookmarkId, testUserId);

      expect(mockRepository.deleteByUser).toHaveBeenCalledWith(
        bookmarkId,
        testUserId
      );
    });

    it("should resolve without error when deletion succeeds", async () => {
      mockRepository.deleteByUser.mockResolvedValue(true);

      await expect(
        service.delete("test-bookmark-id", testUserId)
      ).resolves.toBeUndefined();
    });

    it("should throw 'Bookmark not found' when repository returns false (bookmark does not exist)", async () => {
      mockRepository.deleteByUser.mockResolvedValue(false);

      await expect(
        service.delete("non-existent-id", testUserId)
      ).rejects.toThrow("Bookmark not found");
    });

    it("should throw 'Bookmark not found' when repository returns false (wrong user)", async () => {
      const otherUserId = TestDataFactory.generateUserId();
      mockRepository.deleteByUser.mockResolvedValue(false);

      await expect(
        service.delete("test-bookmark-id", otherUserId)
      ).rejects.toThrow("Bookmark not found");
    });

    it("should propagate repository errors", async () => {
      const error = new Error("Database connection failed");
      mockRepository.deleteByUser.mockRejectedValue(error);

      await expect(
        service.delete("test-bookmark-id", testUserId)
      ).rejects.toThrow("Database connection failed");
    });

    it("should not catch unexpected errors from the repository", async () => {
      const error = new TypeError("Unexpected type error");
      mockRepository.deleteByUser.mockRejectedValue(error);

      await expect(
        service.delete("test-bookmark-id", testUserId)
      ).rejects.toThrow(TypeError);
    });
  });
});
