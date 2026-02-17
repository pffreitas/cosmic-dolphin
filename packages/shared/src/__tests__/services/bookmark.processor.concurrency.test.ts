import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BookmarkProcessorServiceImpl } from "../../services/bookmark.processor.service";
import { BookmarkService } from "../../services/bookmark.service";
import { ContentChunkRepository } from "../../repositories/content-chunk.repository";
import { CollectionRepository } from "../../repositories/collection.repository";
import { AI } from "../../ai";
import { Session } from "../../ai/types";
import { EventBus } from "../../ai/bus";
import { HttpClient } from "../../services/http-client";
import { Bookmark, ScrapedUrlContents } from "../../types";

describe("BookmarkProcessorService Concurrency Benchmark", () => {
  let service: BookmarkProcessorServiceImpl;
  let mockBookmarkService: any;
  let mockContentChunkRepository: any;
  let mockCollectionRepository: any;
  let mockAI: any;
  let mockEventBus: any;
  let mockHttpClient: any;

  beforeEach(() => {
    mockBookmarkService = {
      findByIdAndUser: jest.fn(),
      getScrapedUrlContent: jest.fn(),
      update: jest.fn(),
      updateProcessingStatus: jest.fn(),
    };

    mockContentChunkRepository = {
        createImageChunk: jest.fn()
    };

    mockCollectionRepository = {
        createPath: jest.fn<any>().mockResolvedValue({ id: "uncategorized-id" }),
        findTreeByUser: jest.fn<any>().mockResolvedValue([]),
        findByNameAndParent: jest.fn<any>().mockResolvedValue(null)
    };

    mockAI = {
      newSession: jest.fn(),
      newTask: jest.fn(),
      newSubTask: jest.fn(),
      generateObject: jest.fn(),
      prompt: jest.fn(),
    };

    mockEventBus = {
      publishToBookmark: jest.fn(),
      cleanupBookmarkChannel: jest.fn(),
    };

    mockHttpClient = {
      fetch: jest.fn(),
    };

    service = new BookmarkProcessorServiceImpl(
      mockBookmarkService,
      mockContentChunkRepository,
      mockCollectionRepository,
      mockAI,
      mockEventBus,
      mockHttpClient
    );
  });

  it("should demonstrate limited concurrency", async () => {
    const imageCount = 50;
    const images = Array.from({ length: imageCount }, (_, i) => ({
      url: `http://example.com/img${i}.jpg`,
      title: `Image ${i}`,
      description: `Desc ${i}`,
    }));

    // Setup Mocks
    const bookmark = { id: "b1", userId: "u1" } as unknown as Bookmark;
    const content = { id: "c1", images: images, content: "content" } as unknown as ScrapedUrlContents;
    const session = { sessionID: "s1" } as unknown as Session;

    mockBookmarkService.findByIdAndUser.mockResolvedValue(bookmark);
    mockBookmarkService.getScrapedUrlContent.mockResolvedValue(content);
    mockBookmarkService.updateProcessingStatus.mockResolvedValue(bookmark);
    mockBookmarkService.update.mockResolvedValue(bookmark);
    mockAI.newSession.mockResolvedValue(session);

    mockAI.newTask.mockResolvedValue({ taskID: "t1", subTasks: {} });
    mockAI.newSubTask.mockResolvedValue({ taskID: "st1" });

    // Mock summarization to be fast
    mockAI.prompt.mockImplementation(async function* () {
        yield { type: "text", part: { text: "summary" } };
    });
    mockAI.generateObject.mockImplementation(async (input: any) => {
        if (input.prompt && input.prompt.includes("summarize")) {
            return "brief summary";
        }
        if (input.prompt && input.prompt.includes("filter the images")) {
             return { images };
        }
        return {};
    });

    // Mock metadata generation
    // It seems generateMetadata also calls ai.prompt. I need to handle that.
    // The service calls prompt for summary, then prompt for tags.
    // I need to distinguish calls.
    // But for this test, I can just make prompt always yield something valid for both.
    // Tags prompt expects JSON output.

    let promptCallCount = 0;
    mockAI.prompt.mockImplementation(async function* () {
        promptCallCount++;
        // 1st call: Summary
        // 2nd call: Tags
        if (promptCallCount === 2) {
             yield { type: "text", part: { text: JSON.stringify({ tags: ["tag1"] }) } };
        } else {
             yield { type: "text", part: { text: "summary text" } };
        }
    });

    // Track concurrent requests
    let concurrentRequests = 0;
    let maxConcurrentRequests = 0;

    mockHttpClient.fetch.mockImplementation(async () => {
      concurrentRequests++;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, concurrentRequests);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate network delay
      concurrentRequests--;
      return {
        ok: true,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => new ArrayBuffer(10),
      };
    });

    // Run process
    try {
        await service.process("b1", "u1");
    } catch (e) {
        console.error(e);
    }

    console.log(`Max concurrent requests: ${maxConcurrentRequests}`);
    expect(maxConcurrentRequests).toBeLessThanOrEqual(6); // Expect limited concurrency
  });
});
