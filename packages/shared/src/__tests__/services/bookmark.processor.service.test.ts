import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BookmarkProcessorServiceImpl } from "../../services/bookmark.processor.service";
import { BookmarkService } from "../../services/bookmark.service";
import { ContentChunkRepository } from "../../repositories/content-chunk.repository";
import { CollectionRepository } from "../../repositories/collection.repository";
import { AI } from "../../ai";
import { Session, Task } from "../../ai/types";
import { EventBus } from "../../ai/bus";
import { TestDataFactory } from "../../test-utils/factories";
import { Bookmark, ScrapedUrlContents } from "../../types";
import { HttpClient } from "../../services/http-client";

describe("BookmarkProcessorService", () => {
  let service: BookmarkProcessorServiceImpl;
  let mockBookmarkService: jest.Mocked<BookmarkService>;
  let mockContentChunkRepository: jest.Mocked<ContentChunkRepository>;
  let mockCollectionRepository: jest.Mocked<CollectionRepository>;
  let mockAI: jest.Mocked<AI>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let testBookmark: Bookmark;
  let testScrapedContent: ScrapedUrlContents;

  beforeEach(() => {
    // Mock HTTP client for image processing
    mockHttpClient = {
      fetch: jest.fn(),
    };

    // Configure fetch mock with proper function types
    jest.mocked(mockHttpClient.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) => "image/jpeg",
      },
      body: "",
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    mockBookmarkService = {
      findByIdAndUser: jest.fn(),
      getScrapedUrlContent: jest.fn(),
      update: jest.fn(),
      updateProcessingStatus: jest.fn(),
      create: jest.fn(),
      findByUserAndUrl: jest.fn(),
      findByUser: jest.fn(),
      searchByQuickAccess: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<BookmarkService>;

    let callCount = 0;
    const mockPromptGenerator = async function* () {
      if (callCount === 0) {
        // First call is for summarization
        yield { type: "text", part: { text: "Generated summary" } };
      } else if (callCount === 1) {
        // Second call is for tags generation (needs JSON)
        yield {
          type: "text",
          part: { text: '{"tags": ["test", "bookmark"]}' },
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
        if (
          input.prompt &&
          input.prompt.includes("Your task is to generate a brief summary")
        ) {
          return "Generated brief summary";
        } else if (
          input.prompt &&
          input.prompt.includes("Your task is to filter the images")
        ) {
          return {
            images: [
              {
                url: "https://example.com/image.jpg",
                title: "Test image",
                description: "A test image",
              },
            ],
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

    mockCollectionRepository = {
      findByIdAndUser: jest.fn<any>(),
      findByUser: jest.fn<any>(),
      findByNameAndParent: jest.fn<any>(),
      findTreeByUser: jest.fn<any>().mockResolvedValue([]),
      create: jest.fn<any>(),
      createPath: jest.fn<any>().mockResolvedValue({
        id: "mock-category-id",
        name: "Uncategorized",
        parent_id: null,
        user_id: "test-user-id",
        created_at: new Date(),
        updated_at: new Date(),
      }),
      update: jest.fn<any>(),
      delete: jest.fn<any>(),
    } as jest.Mocked<CollectionRepository>;

    service = new BookmarkProcessorServiceImpl(
      mockBookmarkService,
      mockContentChunkRepository,
      mockCollectionRepository,
      mockAI,
      mockEventBus,
      mockHttpClient
    );

    testBookmark = {
      id: "test-bookmark-id",
      sourceUrl: "https://example.com",
      title: "Test Article",
      metadata: {
        openGraph: TestDataFactory.createOpenGraphMetadata(),
        wordCount: 100,
        readingTime: 1,
      },
      collectionId: undefined,
      userId: "test-user-id",
      isArchived: false,
      isFavorite: false,
      cosmicSummary: undefined,
      cosmicTags: undefined,
      cosmicImages: undefined,
      cosmicLinks: undefined,
      processingStatus: "idle",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    testScrapedContent = {
      id: "test-scraped-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      bookmarkId: testBookmark.id,
      title: "Test Article",
      content: "This is the test article content for processing.",
      metadata: {
        openGraph: TestDataFactory.createOpenGraphMetadata(),
        wordCount: 100,
        readingTime: 1,
      },
      images: [{ url: "https://example.com/image.jpg", alt: "Test image" }],
      links: [{ url: "https://example.com/link", text: "Test link" }],
    };
  });

  describe("process", () => {
    it("should process bookmark with scraped content", async () => {
      const mockSession: Session = {
        sessionID: "test-session-id",
        refID: testBookmark.id,
      };

      mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
      mockBookmarkService.getScrapedUrlContent.mockResolvedValue(
        testScrapedContent
      );
      mockBookmarkService.updateProcessingStatus.mockResolvedValue(
        testBookmark
      );
      mockBookmarkService.update.mockResolvedValue(testBookmark);
      mockAI.newSession.mockResolvedValue(mockSession);

      // Mock the AI task responses
      const mockTask: Task = {
        taskID: "test-task-id",
        sessionID: mockSession.sessionID,
        name: "test-task",
        status: "pending",
        subTasks: {},
      };

      mockAI.newTask.mockResolvedValue(mockTask);
      mockAI.newSubTask.mockResolvedValue({
        taskID: "subtask-id",
        name: "test-subtask",
        status: "pending",
      });

      await service.process(testBookmark.id, testBookmark.userId);

      expect(mockBookmarkService.findByIdAndUser).toHaveBeenCalledWith(
        testBookmark.id,
        testBookmark.userId
      );
      expect(mockBookmarkService.getScrapedUrlContent).toHaveBeenCalledWith(
        testBookmark.id
      );
      expect(mockAI.newSession).toHaveBeenCalledWith(testBookmark.id);
      expect(mockEventBus.publishToBookmark).toHaveBeenCalledWith(
        testBookmark.id,
        "session.started",
        mockSession
      );
    });

    it("should throw error when bookmark is not found", async () => {
      mockBookmarkService.findByIdAndUser.mockResolvedValue(null);

      await expect(
        service.process("non-existent-id", "user-id")
      ).rejects.toThrow("Bookmark not found: non-existent-id");

      expect(mockBookmarkService.getScrapedUrlContent).not.toHaveBeenCalled();
      expect(mockAI.newSession).not.toHaveBeenCalled();
    });

    it("should throw error when scraped content is not found", async () => {
      mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
      mockBookmarkService.getScrapedUrlContent.mockResolvedValue(null);

      await expect(
        service.process(testBookmark.id, testBookmark.userId)
      ).rejects.toThrow(`Scraped url content not found: ${testBookmark.id}`);

      expect(mockBookmarkService.findByIdAndUser).toHaveBeenCalledWith(
        testBookmark.id,
        testBookmark.userId
      );
      expect(mockBookmarkService.getScrapedUrlContent).toHaveBeenCalledWith(
        testBookmark.id
      );
      expect(mockAI.newSession).not.toHaveBeenCalled();
    });

    it("should use scraped content for processing", async () => {
      const mockSession: Session = {
        sessionID: "test-session-id",
        refID: testBookmark.id,
      };

      const mockTask: Task = {
        taskID: "test-task-id",
        sessionID: mockSession.sessionID,
        name: "test-task",
        status: "pending",
        subTasks: {},
      };

      mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
      mockBookmarkService.getScrapedUrlContent.mockResolvedValue(
        testScrapedContent
      );
      mockBookmarkService.updateProcessingStatus.mockResolvedValue(
        testBookmark
      );
      mockBookmarkService.update.mockResolvedValue(testBookmark);
      mockAI.newSession.mockResolvedValue(mockSession);
      mockAI.newTask.mockResolvedValue(mockTask);
      mockAI.newSubTask.mockResolvedValue({
        taskID: "subtask-id",
        name: "test-subtask",
        status: "pending",
      });

      await service.process(testBookmark.id, testBookmark.userId);

      // Verify that the service was called with correct parameters
      expect(mockBookmarkService.getScrapedUrlContent).toHaveBeenCalledWith(
        testBookmark.id
      );
      expect(mockEventBus.publishToBookmark).toHaveBeenCalledWith(
        testBookmark.id,
        "session.started",
        mockSession
      );
    });

    it("should handle AI processing errors gracefully", async () => {
      const mockSession: Session = {
        sessionID: "test-session-id",
        refID: testBookmark.id,
      };

      mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
      mockBookmarkService.getScrapedUrlContent.mockResolvedValue(
        testScrapedContent
      );
      mockBookmarkService.updateProcessingStatus.mockResolvedValue(
        testBookmark
      );
      mockAI.newSession.mockResolvedValue(mockSession);
      mockAI.newSubTask.mockResolvedValue({
        taskID: "subtask-id",
        name: "test-subtask",
        status: "pending",
      });
      mockAI.newTask.mockRejectedValue(new Error("AI service unavailable"));

      await expect(
        service.process(testBookmark.id, testBookmark.userId)
      ).rejects.toThrow("AI service unavailable");

      expect(mockEventBus.publishToBookmark).toHaveBeenCalledWith(
        testBookmark.id,
        "session.started",
        mockSession
      );
    });
  });
});
