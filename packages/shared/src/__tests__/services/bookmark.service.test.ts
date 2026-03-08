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
      insertScrapedUrlContents: jest.fn(),
      getScrapedUrlContent: jest.fn(),
      findByUser: jest.fn(),
      searchByQuickAccess: jest.fn(),
      fullTextSearch: jest.fn(),
      vectorSearch: jest.fn(),
      update: jest.fn(),
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

  describe("mapDatabaseToBookmark", () => {
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
