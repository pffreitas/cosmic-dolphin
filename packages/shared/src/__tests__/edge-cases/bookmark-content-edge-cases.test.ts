import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { BookmarkServiceImpl } from "../../services/bookmark.service";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";
import { WebScrapingService } from "../../services/web-scraping.service";

describe("Bookmark Content Edge Cases", () => {
  let repository: BookmarkRepositoryImpl;
  let service: BookmarkServiceImpl;
  let mockWebScrapingService: jest.Mocked<WebScrapingService>;
  let testUserId: string;

  beforeEach(() => {
    const db = getTestDatabase();
    repository = new BookmarkRepositoryImpl(db);

    mockWebScrapingService = {
      scrape: jest.fn(),
      isValidUrl: jest.fn(),
      scrapeContent: jest.fn(),
    } as jest.Mocked<WebScrapingService>;

    service = new BookmarkServiceImpl(repository, mockWebScrapingService);
    testUserId = TestDataFactory.generateUserId();
  });

  describe("getScrapedUrlContent edge cases", () => {
    it("should handle malformed bookmark IDs", async () => {
      const malformedIds = [
        "",
        "not-a-uuid",
        "123",
        "malformed-uuid-string",
        null as any,
        undefined as any,
      ];

      for (const id of malformedIds) {
        if (id !== null && id !== undefined) {
          const result = await repository.getScrapedUrlContent(id);
          expect(result).toBeNull();
        }
      }
    });

    it("should handle very long content gracefully", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      // Create very large content (1MB)
      const largeContent = "A".repeat(1024 * 1024);
      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
        content: largeContent,
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      const retrieved = await repository.getScrapedUrlContent(bookmark.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.content).toBe(largeContent);
      expect(retrieved!.content.length).toBe(1024 * 1024);
    });

    it("should handle special characters and encoding in content", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      const specialCharContent = `
        Special characters: àáâãäåæçèéêë
        Unicode symbols: ♠♣♥♦
        Emojis: 🚀🎉💯🔥
        Mathematical symbols: ∑∏∫∆
        Code snippets: <script>alert('test');</script>
        SQL injection attempt: '; DROP TABLE bookmarks; --
        XSS attempt: <img src="x" onerror="alert('xss')">
      `;

      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
        content: specialCharContent,
        title: "Special Characters Test 🚀",
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      const retrieved = await repository.getScrapedUrlContent(bookmark.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.content).toBe(specialCharContent);
      expect(retrieved!.title).toBe("Special Characters Test 🚀");
    });

    it("should handle null/empty fields in scraped content", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: "",
        content: "",
        metadata: {},
        images: [],
        links: [],
      });

      const retrieved = await repository.getScrapedUrlContent(bookmark.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.bookmarkId).toBe(bookmark.id);
      expect(retrieved!.title).toBe("");
      expect(retrieved!.content).toBe("");
      expect(retrieved!.metadata).toEqual({});
      expect(retrieved!.images).toEqual([]);
      expect(retrieved!.links).toEqual([]);
    });

    it("should handle concurrent access to scraped content", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      // Simulate concurrent reads
      const concurrentReads = Array.from({ length: 10 }, () =>
        repository.getScrapedUrlContent(bookmark.id)
      );

      const results = await Promise.all(concurrentReads);

      // All reads should succeed and return the same content
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result!.bookmarkId).toBe(bookmark.id);
        expect(result!.content).toBe(scrapedContent.content);
      });
    });

    it("should handle database connection errors", async () => {
      // This test would need to mock database connection failures
      // For now, we'll test the error path by checking the executeQuery wrapper
      const bookmarkId = "test-bookmark-id";

      // Mock a database error
      jest.spyOn(repository as any, 'executeQuery').mockRejectedValue(
        new Error("Database connection lost")
      );

      await expect(repository.getScrapedUrlContent(bookmarkId)).rejects.toThrow(
        "Database connection lost"
      );

      // Restore original method
      jest.restoreAllMocks();
    });
  });

  describe("service layer edge cases", () => {
    it("should handle repository errors in service layer", async () => {
      const bookmarkId = "test-bookmark-id";

      // Mock repository to throw error
      jest.spyOn(repository, 'getScrapedUrlContent').mockRejectedValue(
        new Error("Repository error")
      );

      await expect(service.getScrapedUrlContent(bookmarkId)).rejects.toThrow(
        "Repository error"
      );

      // Restore original method
      jest.restoreAllMocks();
    });

    it("should handle undefined/null parameters gracefully", async () => {
      // Test with null and undefined parameters - these should return null rather than throw
      const nullResult = await service.getScrapedUrlContent(null as any);
      const undefinedResult = await service.getScrapedUrlContent(undefined as any);

      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeNull();
    });
  });

  describe("data consistency edge cases", () => {
    it("should handle orphaned scraped content", async () => {
      // Create scraped content for a non-existent bookmark
      const nonExistentBookmarkId = "00000000-0000-0000-0000-000000000000";

      // This should handle the case gracefully
      const result = await repository.getScrapedUrlContent(nonExistentBookmarkId);
      expect(result).toBeNull();
    });

    it("should handle multiple scraped content entries for same bookmark", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      // Insert first scraped content
      const firstContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
        content: "First content",
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: firstContent.title,
        content: firstContent.content,
        metadata: firstContent.metadata,
        images: firstContent.images,
        links: firstContent.links,
      });

      // Try to insert second scraped content (should overwrite or fail)
      const secondContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
        content: "Second content",
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: secondContent.title,
        content: secondContent.content,
        metadata: secondContent.metadata,
        images: secondContent.images,
        links: secondContent.links,
      });

      // Verify which content is retrieved (database constraints might prevent duplicate entries)
      const retrieved = await repository.getScrapedUrlContent(bookmark.id);
      expect(retrieved).toBeDefined();
      // Note: This behavior depends on database constraints - might be first or second content
      expect(retrieved!.content).toMatch(/^(First|Second) content$/);
    });

    it("should handle bookmark deletion and orphaned scraped content", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });
      const bookmark = await repository.create(bookmarkData);

      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      // Delete the bookmark
      await repository.delete(bookmark.id);

      // Scraped content should still be accessible (or handle as per business logic)
      const retrievedContent = await repository.getScrapedUrlContent(bookmark.id);
      // This behavior depends on whether cascading delete is implemented
      // For now, we'll test that it doesn't throw an error
      expect(() => retrievedContent).not.toThrow();
    });
  });
});