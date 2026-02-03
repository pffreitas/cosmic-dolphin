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
import { z } from "zod";

describe("BookmarkProcessorService Concurrency Benchmark", () => {
  let service: BookmarkProcessorServiceImpl;
  let mockBookmarkService: jest.Mocked<BookmarkService>;
  let mockContentChunkRepository: jest.Mocked<ContentChunkRepository>;
  let mockCollectionRepository: jest.Mocked<CollectionRepository>;
  let mockAI: jest.Mocked<AI>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let testBookmark: Bookmark;
  let testScrapedContent: ScrapedUrlContents;
  let concurrentRequests = 0;
  let maxConcurrentRequests = 0;

  beforeEach(() => {
    concurrentRequests = 0;
    maxConcurrentRequests = 0;

    // Mock HTTP client for image processing
    mockHttpClient = {
      fetch: jest.fn().mockImplementation(async () => {
        concurrentRequests++;
        if (concurrentRequests > maxConcurrentRequests) {
          maxConcurrentRequests = concurrentRequests;
        }
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate 50ms latency
        concurrentRequests--;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: {
            get: (name: string) => "image/jpeg",
          },
          body: "",
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        };
      }),
    } as any;

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
        // Summarize content
        yield { type: "text", part: { text: "Generated summary" } };
      } else if (callCount === 1) {
        // Generate metadata
        yield { type: "text", part: { text: '{"tags": ["tag1", "tag2"]}' } };
      }
      callCount++;
    };

    mockAI = {
      newSession: jest.fn(),
      newTask: jest.fn(),
      newSubTask: jest.fn(),
      generateObject: jest.fn().mockImplementation(async (input: any) => {
        if (
          input.prompt &&
          input.prompt.includes("Your task is to filter the images")
        ) {
          // Generate 50 images
          const images = Array.from({ length: 50 }, (_, i) => ({
            url: `https://example.com/image${i}.jpg`,
            title: `Test image ${i}`,
            description: `A test image ${i}`,
          }));
          return { images };
        } else if (input.schema) {
            // Assume it's categorization if schema is present (or brief summary which returns string)
            // Categorization schema is an object
            if (input.schema instanceof z.ZodObject) {
                 return {
                    existingCategoryId: "00000000-0000-0000-0000-000000000001",
                    newCategoryPath: null,
                    confidence: 0.9,
                    reasoning: "Test reasoning"
                 };
            }
            // Brief summary schema is string
             return "Brief summary";
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
        id: "00000000-0000-0000-0000-000000000001",
        name: "Uncategorized",
        parent_id: null,
        user_id: "test-user-id",
        created_at: new Date(),
        updated_at: new Date(),
      }),
      update: jest.fn<any>(),
      delete: jest.fn<any>(),
      getCollectionPath: jest.fn<any>().mockResolvedValue([]),
      getCollectionsByIds: jest.fn<any>().mockResolvedValue([]),
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
      images: Array.from({ length: 50 }, (_, i) => ({ url: `https://example.com/image${i}.jpg`, alt: `Test image ${i}` })),
      links: [{ url: "https://example.com/link", text: "Test link" }],
    };
  });

  it("should process images with limited concurrency", async () => {
    const mockSession: Session = {
      sessionID: "test-session-id",
      refID: testBookmark.id,
    };

    mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
    mockBookmarkService.getScrapedUrlContent.mockResolvedValue(testScrapedContent);
    mockBookmarkService.updateProcessingStatus.mockResolvedValue(testBookmark);
    mockBookmarkService.update.mockResolvedValue(testBookmark);
    mockAI.newSession.mockResolvedValue(mockSession);
    mockAI.newTask.mockResolvedValue({
      taskID: "test-task-id",
      sessionID: mockSession.sessionID,
      name: "test-task",
      status: "pending",
      subTasks: {},
    });
    mockAI.newSubTask.mockResolvedValue({
      taskID: "subtask-id",
      name: "test-subtask",
      status: "pending",
    });

    await service.process(testBookmark.id, testBookmark.userId);

    console.log(`Max concurrent requests: ${maxConcurrentRequests}`);
    expect(maxConcurrentRequests).toBeLessThanOrEqual(5); // Expect limited concurrency
  });
});
