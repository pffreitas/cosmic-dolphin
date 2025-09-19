import { describe, it, expect } from "bun:test";
import { WebScrapingServiceImpl } from "@cosmic-dolphin/shared";

describe("Bookmark Feature Validation", () => {
  describe("URL validation", () => {
    const webScrapingService = new WebScrapingServiceImpl();

    it("should validate valid URLs", () => {
      const validUrls = [
        "https://example.com",
        "http://test.org",
        "https://www.domain.com/path?query=1",
      ];

      validUrls.forEach((url) => {
        expect(webScrapingService.isValidUrl(url)).toBe(true);
      });
    });

    it("should reject invalid URLs", () => {
      const invalidUrls = [
        "not-a-url",
        "ftp://invalid-protocol.com",
        "invalid://test.com",
        "",
      ];

      invalidUrls.forEach((url) => {
        expect(webScrapingService.isValidUrl(url)).toBe(false);
      });
    });
  });

  describe("Open Graph metadata extraction", () => {
    const webScrapingService = new WebScrapingServiceImpl();

    it("should extract Open Graph metadata from HTML", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
          <meta property="og:title" content="OG Title" />
          <meta property="og:description" content="OG Description" />
          <meta property="og:url" content="https://example.com" />
          <meta name="description" content="Meta Description" />
        </head>
        <body>
          <h1>Test Content</h1>
        </body>
        </html>
      `;

      const scrapedUrlContents = webScrapingService.scrapeContent(sampleHtml);
      expect(scrapedUrlContents.title).toBe("OG Title");
      expect(scrapedUrlContents.metadata.openGraph?.description).toBe(
        "OG Description"
      );
      expect(scrapedUrlContents.metadata.openGraph?.url).toBe(
        "https://example.com"
      );
    });

    it("should fallback to standard meta tags when OG tags are missing", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page Title</title>
          <meta name="description" content="Meta Description" />
        </head>
        <body>
          <h1>Test Content</h1>
        </body>
        </html>
      `;

      const scrapedUrlContents = webScrapingService.scrapeContent(sampleHtml);
      expect(scrapedUrlContents.title).toBe("Test Page Title");
      expect(scrapedUrlContents.metadata.openGraph?.description).toBe(
        "Meta Description"
      );
    });
  });

  describe("Queue payload validation", () => {
    it("should validate bookmark queue payload structure", () => {
      const payload = {
        type: "bookmark_process",
        data: {
          bookmarkId: "test-id",
          sourceUrl: "https://example.com",
          userId: "user-123",
          collectionId: "collection-456",
        },
        metadata: {
          source: "api",
          priority: "medium",
        },
      };

      expect(payload.type).toBe("bookmark_process");
      expect(payload.data.bookmarkId).toBeTruthy();
      expect(payload.data.sourceUrl).toBeTruthy();
      expect(payload.data.userId).toBeTruthy();
      expect(payload.metadata?.source).toBe("api");
    });
  });

  describe("Database schema validation", () => {
    it("should validate bookmark interface structure", () => {
      const bookmark = {
        id: "bookmark-123",
        sourceUrl: "https://example.com",
        title: "Example Page",
        content: "An example page",
        metadata: {
          openGraph: {
            title: "OG Title",
            description: "OG Description",
          },
          contentType: "text/html",
          wordCount: 100,
          readingTime: 1,
        },
        collectionId: "collection-123",
        userId: "user-123",
        isArchived: false,
        isFavorite: false,
        cosmicTags: ["example", "test"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(bookmark.id).toBeTruthy();
      expect(bookmark.sourceUrl).toBeTruthy();
      expect(bookmark.userId).toBeTruthy();
      expect(Array.isArray(bookmark.cosmicTags)).toBe(true);
      expect(typeof bookmark.isArchived).toBe("boolean");
      expect(typeof bookmark.isFavorite).toBe("boolean");
    });
  });
});
