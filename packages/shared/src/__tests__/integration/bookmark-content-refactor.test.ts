import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { BookmarkServiceImpl } from "../../services/bookmark.service";
import { BookmarkProcessorServiceImpl } from "../../services/bookmark.processor.service";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";
import { WebScrapingService } from "../../services/web-scraping.service";
import { AI } from "../../ai";
import { EventBus } from "../../ai/bus";
import { ContentChunkRepository } from "../../repositories/content-chunk.repository";
import { CollectionRepositoryImpl } from "../../repositories/collection.repository";

describe("Bookmark Content Refactor Integration", () => {
  let repository: BookmarkRepositoryImpl;
  let collectionRepository: CollectionRepositoryImpl;
  let service: BookmarkServiceImpl;
  let processorService: BookmarkProcessorServiceImpl;
  let mockWebScrapingService: jest.Mocked<WebScrapingService>;
  let mockContentChunkRepository: jest.Mocked<ContentChunkRepository>;
  let mockAI: jest.Mocked<AI>;
  let mockEventBus: jest.Mocked<EventBus>;
  let testUserId: string;

  beforeEach(() => {
    // Note: This integration test doesn't directly test HTTP functionality,
    // so we don't need to mock the HTTP client here

    const db = getTestDatabase();
    repository = new BookmarkRepositoryImpl(db);
    collectionRepository = new CollectionRepositoryImpl(db);

    mockWebScrapingService = {
      scrape: jest.fn(),
      isValidUrl: jest.fn(),
      scrapeContent: jest.fn(),
    } as jest.Mocked<WebScrapingService>;

    mockContentChunkRepository = {
      createTextChunk: jest.fn(),
      createImageChunk: jest.fn(),
      findByScrapedContentId: jest.fn(),
      findTextChunksByScrapedContentId: jest.fn(),
      findImageChunksByScrapedContentId: jest.fn(),
      findById: jest.fn(),
      deleteByScrapedContentId: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<ContentChunkRepository>;

    let callCount = 0;
    const mockPromptGenerator = async function* () {
      if (callCount === 0) {
        // First call is for summarization
        yield { type: "text", part: { text: "Generated AI summary" } };
      } else if (callCount === 1) {
        // Second call is for tags generation (needs JSON)
        yield {
          type: "text",
          part: { text: '{"tags": ["ai", "processing"]}' },
        };
      } else {
        // Third call is for image processing (needs JSON)
        yield {
          type: "text",
          part: {
            text: '{"images": [{"url": "https://example.com/image.jpg", "alt": "Test image"}]}',
          },
        };
      }
      callCount++;
    };

    mockAI = {
      newSession: jest.fn(),
      newTask: jest.fn(),
      newSubTask: jest.fn(),
      generateObject: jest.fn().mockImplementation(async (input: any) => {
        // Return different mocked values based on what's being generated
        if (input.prompt && input.prompt.includes("Your task is to generate a brief summary")) {
          return "Generated brief summary";
        } else if (input.prompt && input.prompt.includes("Your task is to filter the images")) {
          return {
            images: [
              {
                url: "https://example.com/image.jpg",
                title: "Test image",
                description: "A test image"
              }
            ]
          };
        } else if (input.prompt && input.prompt.includes("bookmark categorization assistant")) {
          // Categorization prompt - suggest a new category path
          return {
            existingCategoryId: null,
            newCategoryPath: ["Test", "Category"],
            confidence: 0.85,
            reasoning: "Creating a new test category for this bookmark"
          };
        }
        return "Default generated object";
      }),
      prompt: jest.fn().mockImplementation(() => mockPromptGenerator()),
      processStream: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn(),
      publishEvent: jest.fn(),
      publishToBookmark: jest.fn(),
      cleanupBookmarkChannel: jest.fn(),
    } as any;

    service = new BookmarkServiceImpl(repository, mockWebScrapingService);
    processorService = new BookmarkProcessorServiceImpl(
      service,
      mockContentChunkRepository,
      collectionRepository,
      mockAI,
      mockEventBus
    );
    testUserId = TestDataFactory.generateUserId();
  });

  describe("content separation and retrieval", () => {
    it("should properly separate bookmark metadata from scraped content", async () => {
      // Create a bookmark without content field
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: "https://example.com/article",
        title: "Test Article",
      });

      const bookmark = await repository.create(bookmarkData);

      // Verify bookmark doesn't have content field
      expect(bookmark).not.toHaveProperty("content");

      // Add scraped content separately
      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
        title: "Scraped Article Title",
        content:
          "This is the actual scraped content that should be used for AI processing.",
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      // Retrieve and verify separation
      const retrievedBookmark = await service.findByIdAndUser(
        bookmark.id,
        testUserId
      );
      const retrievedContent = await service.getScrapedUrlContent(bookmark.id);

      expect(retrievedBookmark).toBeDefined();
      expect(retrievedBookmark!.id).toBe(bookmark.id);
      expect(retrievedBookmark).not.toHaveProperty("content");

      expect(retrievedContent).toBeDefined();
      expect(retrievedContent!.bookmarkId).toBe(bookmark.id);
      expect(retrievedContent!.content).toBe(scrapedContent.content);
      expect(retrievedContent!.title).toBe(scrapedContent.title);
    });

    it("should handle bookmark processing workflow with separated content", async () => {
      // Create bookmark and scraped content
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        source_url: "https://example.com/processing-test",
      });

      const bookmark = await repository.create(bookmarkData);

      const scrapedContent = TestDataFactory.createScrapedUrlContent({
        bookmark_id: bookmark.id,
        content: "Content for AI processing and analysis.",
      });

      await repository.insertScrapedUrlContents(bookmark.id, {
        title: scrapedContent.title,
        content: scrapedContent.content,
        metadata: scrapedContent.metadata,
        images: scrapedContent.images,
        links: scrapedContent.links,
      });

      // Mock AI services
      const mockSession = {
        sessionID: "test-session",
        refID: bookmark.id,
      };

      mockAI.newSession.mockResolvedValue(mockSession);

      mockAI.newTask.mockResolvedValue({
        taskID: "summary-task",
        sessionID: mockSession.sessionID,
        name: "summarize",
        status: "pending",
        subTasks: {},
      });

      mockAI.newSubTask.mockResolvedValue({
        taskID: "subtask-id",
        name: "test-subtask",
        status: "pending",
      });

      // Process the bookmark
      await processorService.process(bookmark.id, testUserId);

      // Verify the bookmark was updated with AI-generated content
      const updatedBookmark = await service.findByIdAndUser(
        bookmark.id,
        testUserId
      );
      expect(updatedBookmark!.cosmicSummary).toBe("Generated AI summary");
      expect(updatedBookmark!.cosmicTags).toEqual(["ai", "processing"]);

      // Verify original scraped content remains unchanged
      const unchangedContent = await service.getScrapedUrlContent(bookmark.id);
      expect(unchangedContent!.content).toBe(scrapedContent.content);
    });

    it("should maintain data integrity across bookmark and scraped content operations", async () => {
      // Create multiple bookmarks with their respective scraped content
      const bookmarks = [];
      const scrapedContents = [];

      for (let i = 0; i < 3; i++) {
        const bookmarkData = TestDataFactory.createBookmark({
          user_id: testUserId,
          source_url: `https://example.com/article-${i}`,
          title: `Article ${i}`,
        });

        const bookmark = await repository.create(bookmarkData);
        bookmarks.push(bookmark);

        const scrapedContent = TestDataFactory.createScrapedUrlContent({
          bookmark_id: bookmark.id,
          title: `Scraped Title ${i}`,
          content: `Scraped content for article ${i}`,
        });

        await repository.insertScrapedUrlContents(bookmark.id, {
          title: scrapedContent.title,
          content: scrapedContent.content,
          metadata: scrapedContent.metadata,
          images: scrapedContent.images,
          links: scrapedContent.links,
        });

        scrapedContents.push(scrapedContent);
      }

      // Verify all data is correctly stored and retrievable
      for (let i = 0; i < 3; i++) {
        const retrievedBookmark = await service.findByIdAndUser(
          bookmarks[i].id,
          testUserId
        );
        const retrievedContent = await service.getScrapedUrlContent(
          bookmarks[i].id
        );

        expect(retrievedBookmark).toBeDefined();
        expect(retrievedBookmark!.title).toBe(`Article ${i}`);
        expect(retrievedBookmark).not.toHaveProperty("content");

        expect(retrievedContent).toBeDefined();
        expect(retrievedContent!.title).toBe(`Scraped Title ${i}`);
        expect(retrievedContent!.content).toBe(
          `Scraped content for article ${i}`
        );
        expect(retrievedContent!.bookmarkId).toBe(bookmarks[i].id);
      }

      // Verify cross-contamination doesn't occur
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i !== j) {
            const content = await service.getScrapedUrlContent(bookmarks[i].id);
            expect(content!.content).not.toBe(
              `Scraped content for article ${j}`
            );
          }
        }
      }
    });

    it("should handle missing scraped content gracefully", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
      });

      const bookmark = await repository.create(bookmarkData);

      // Don't create scraped content
      const content = await service.getScrapedUrlContent(bookmark.id);
      expect(content).toBeNull();

      // Processing should fail gracefully
      await expect(
        processorService.process(bookmark.id, testUserId)
      ).rejects.toThrow(`Scraped url content not found: ${bookmark.id}`);
    });

    it("should support updating bookmark metadata without affecting scraped content", async () => {
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        is_favorite: false,
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

      // Update bookmark metadata
      const updatedBookmark = await service.update(bookmark.id, {
        isFavorite: true,
        cosmicSummary: "User-added summary",
      });

      expect(updatedBookmark.isFavorite).toBe(true);
      expect(updatedBookmark.cosmicSummary).toBe("User-added summary");

      // Verify scraped content remains unchanged
      const unchangedContent = await service.getScrapedUrlContent(bookmark.id);
      expect(unchangedContent!.content).toBe(scrapedContent.content);
      expect(unchangedContent!.title).toBe(scrapedContent.title);
    });
  });
});
