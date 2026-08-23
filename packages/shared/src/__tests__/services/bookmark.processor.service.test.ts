import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BookmarkProcessorServiceImpl } from "../../services/bookmark.processor.service";
import { BookmarkService } from "../../services/bookmark.service";
import { ContentChunkRepository } from "../../repositories/content-chunk.repository";
import { CollectionRepository } from "../../repositories/collection.repository";
import { AI } from "../../ai";
import { Session, Task } from "../../ai/types";
import { BookmarkProcessingRepository } from "../../repositories/bookmark-processing.repository";
import { TestDataFactory } from "../../test-utils/factories";
import { Bookmark, ScrapedUrlContents } from "../../types";
import { HttpClient } from "../../services/http-client";
import { ChunkingService } from "../../services/chunking.service";
import { EmbeddingService } from "../../services/embedding.service";

describe("BookmarkProcessorService", () => {
  let service: BookmarkProcessorServiceImpl;
  let mockBookmarkService: jest.Mocked<BookmarkService>;
  let mockContentChunkRepository: jest.Mocked<ContentChunkRepository>;
  let mockCollectionRepository: jest.Mocked<CollectionRepository>;
  let mockAI: jest.Mocked<AI>;
  let mockBookmarkProcessingRepository: jest.Mocked<BookmarkProcessingRepository>;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockChunkingService: jest.Mocked<ChunkingService>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let testBookmark: Bookmark;
  let testScrapedContent: ScrapedUrlContents;

  beforeEach(() => {
    // Mock HTTP client for image processing
    mockHttpClient = {
      fetch: jest.fn(),
    };

    (mockHttpClient.fetch as any).mockResolvedValue({
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
      findByIdAndUserWithLikeStatus: jest.fn(),
      getScrapedUrlContent: jest.fn(),
      update: jest.fn(),
      updateProcessingStatus: jest.fn(),
      create: jest.fn(),
      createPrivateLink: jest.fn(),
      convertToPrivateLink: jest.fn(),
      findByUserAndUrl: jest.fn(),
      findByUser: jest.fn(),
      searchByQuickAccess: jest.fn(),
      share: jest.fn(),
      unshare: jest.fn(),
      findByShareSlug: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<BookmarkService>;

    const generateObjectValue = async (input: any) => {
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
      } else if (
        input.prompt &&
        input.prompt.includes("Your task is to generate the tags")
      ) {
        return {
          tags: ["test", "bookmark"],
        };
      }
      return {
        existingCategoryId: null,
        newCategoryPath: ["Uncategorized"],
        confidence: 0.9,
        reasoning: "Default categorization",
      };
    };

    const mockUsage = {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    };

    mockAI = {
      newSession: jest.fn(),
      newTask: jest.fn(),
      newSubTask: jest.fn(),
      generateText: jest.fn<any>().mockResolvedValue({
        value: "Generated summary",
        text: "Generated summary",
        usage: mockUsage,
      }),
      generateObjectWithUsage: jest.fn().mockImplementation(async (input: any) => ({
        value: await generateObjectValue(input),
        usage: mockUsage,
      })),
      generateObject: jest.fn().mockImplementation(generateObjectValue),
      prompt: jest.fn(),
      processStream: jest.fn(),
    } as any;

    mockBookmarkProcessingRepository = {
      createRun: jest.fn(async (data: any) => ({
        id: "run-1",
        bookmarkId: data.bookmarkId,
        userId: data.userId,
        status: data.status,
        startedAt: data.startedAt,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        createdAt: data.startedAt,
        updatedAt: data.startedAt,
      })),
      updateRun: jest.fn(async (id: string, data: any) => ({
        id,
        bookmarkId: testBookmark.id,
        userId: testBookmark.userId,
        status: data.status,
        startedAt: new Date(),
        endedAt: data.endedAt,
        durationMs: data.durationMs,
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        totalTokens: data.totalTokens ?? 0,
        reasoningTokens: data.reasoningTokens ?? 0,
        cachedInputTokens: data.cachedInputTokens ?? 0,
        costUsd: data.costUsd ?? undefined,
        error: data.error ?? undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      createEvent: jest.fn(async (data: any) => ({
        id: `event-${data.sequence}`,
        runId: data.runId,
        parentEventId: data.parentEventId,
        kind: data.kind,
        phase: data.phase,
        name: data.name,
        status: data.status,
        sequence: data.sequence,
        startedAt: data.startedAt,
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        totalTokens: data.totalTokens ?? 0,
        reasoningTokens: data.reasoningTokens ?? 0,
        cachedInputTokens: data.cachedInputTokens ?? 0,
        costUsd: data.costUsd ?? undefined,
        providerMetadata: data.providerMetadata,
        metadata: data.metadata,
        error: data.error ?? undefined,
        createdAt: data.startedAt,
        updatedAt: data.startedAt,
      })),
      updateEvent: jest.fn(async (id: string, data: any) => ({
        id,
        runId: "run-1",
        kind: "phase",
        phase: "summarization",
        name: "test",
        status: data.status,
        sequence: 1,
        startedAt: new Date(),
        endedAt: data.endedAt,
        durationMs: data.durationMs,
        modelId: data.modelId,
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        totalTokens: data.totalTokens ?? 0,
        reasoningTokens: data.reasoningTokens ?? 0,
        cachedInputTokens: data.cachedInputTokens ?? 0,
        costUsd: data.costUsd ?? undefined,
        providerMetadata: data.providerMetadata,
        metadata: data.metadata,
        error: data.error ?? undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findLatestTimeline: jest.fn(async () => null),
    } as any;

    mockContentChunkRepository = {
      createTextChunk: jest.fn(),
      createImageChunk: jest.fn(),
      updateTextChunkEmbedding: jest.fn(),
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

    mockChunkingService = {
      chunkHtml: jest.fn<any>().mockReturnValue([]),
      stripHtml: jest.fn<any>().mockReturnValue(""),
    };

    mockEmbeddingService = {
      embedText: jest.fn<any>().mockResolvedValue([0.1, 0.2, 0.3]),
      embedTexts: jest.fn<any>().mockResolvedValue([[0.1, 0.2, 0.3]]),
      embedTextWithUsage: jest.fn<any>().mockResolvedValue({
        value: [0.1, 0.2, 0.3],
        usage: { inputTokens: 1, totalTokens: 1 },
      }),
      embedTextsWithUsage: jest.fn<any>().mockResolvedValue({
        value: [[0.1, 0.2, 0.3]],
        usage: { inputTokens: 1, totalTokens: 1 },
      }),
      getModelId: jest.fn<any>().mockReturnValue("openai/text-embedding-3-small"),
    };

    service = new BookmarkProcessorServiceImpl(
      mockBookmarkService,
      mockContentChunkRepository,
      mockCollectionRepository,
      mockAI,
      mockBookmarkProcessingRepository,
      mockHttpClient,
      mockChunkingService,
      mockEmbeddingService
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
      isPrivateLink: false,
      isPublic: false,
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
      expect(mockBookmarkProcessingRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarkId: testBookmark.id,
          userId: testBookmark.userId,
          status: "running",
        })
      );
    });

    it("records durable processing phases and does not publish realtime events", async () => {
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

      expect(mockBookmarkProcessingRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarkId: testBookmark.id,
          userId: testBookmark.userId,
          status: "running",
        })
      );
      expect(
        mockBookmarkProcessingRepository.createEvent.mock.calls.map(
          ([event]) => event.phase
        )
      ).toEqual(
        expect.arrayContaining([
          "summarization",
          "brief_summary",
          "tags",
          "images",
          "chunking",
          "embedding",
          "categorization",
          "finalization",
        ])
      );
      expect(mockBookmarkProcessingRepository.updateRun).toHaveBeenCalledWith(
        "run-1",
        expect.objectContaining({
          status: "completed",
        })
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

    it("should enrich private links without scraped content or chunks", async () => {
      const privateBookmark: Bookmark = {
        ...testBookmark,
        isPrivateLink: true,
        title: "Private Figma File",
        sourceUrl: "https://figma.com/file/private-design",
        cosmicBriefSummary: "Checkout design review",
        metadata: {
          openGraph: {
            site_name: "Figma",
            title: "Private Figma File",
            url: "https://figma.com/file/private-design",
          },
          privateLink: {
            userDescription: "Checkout design review",
            userProvidedTitle: "Private Figma File",
          },
        } as any,
      };
      const mockSession: Session = {
        sessionID: "test-session-id",
        refID: privateBookmark.id,
      };
      const mockTask: Task = {
        taskID: "test-task-id",
        sessionID: mockSession.sessionID,
        name: "test-task",
        status: "pending",
        subTasks: {},
      };

      mockBookmarkService.findByIdAndUser.mockResolvedValue(privateBookmark);
      mockBookmarkService.updateProcessingStatus.mockImplementation(
        async (_id, status) => ({
          ...privateBookmark,
          processingStatus: status,
        })
      );
      mockBookmarkService.update.mockImplementation(async (_id, data) => ({
        ...privateBookmark,
        ...data,
      }));
      mockAI.newSession.mockResolvedValue(mockSession);
      mockAI.newTask.mockResolvedValue(mockTask);
      mockAI.newSubTask.mockResolvedValue({
        taskID: "subtask-id",
        name: "test-subtask",
        status: "pending",
      });
      const privateLinkResult = async (input: any) => {
        if (input.prompt.includes("private link quick-access record")) {
          return {
            title: "Checkout Design Review",
            description:
              "Private Figma file for the checkout design review and payment polish handoff.",
            tags: ["figma", "checkout", "design-review"],
            quickAccessKeywords: ["payments polish", "handoff"],
          };
        }

        return {
          existingCategoryId: null,
          newCategoryPath: ["Design", "Reviews"],
          confidence: 0.91,
          reasoning: "The description is about a design review.",
        };
      };
      (mockAI.generateObject as jest.Mock).mockImplementation(privateLinkResult);
      (mockAI.generateObjectWithUsage as jest.Mock).mockImplementation(
        async (input: any) => ({
          value: await privateLinkResult(input),
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        })
      );
      mockCollectionRepository.createPath.mockResolvedValue({
        id: "design-reviews-id",
        name: "Reviews",
        parent_id: "design-id",
        user_id: privateBookmark.userId,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      await service.process(privateBookmark.id, privateBookmark.userId);

      expect(mockBookmarkService.getScrapedUrlContent).not.toHaveBeenCalled();
      expect(mockContentChunkRepository.createTextChunk).not.toHaveBeenCalled();
      expect(mockContentChunkRepository.updateTextChunkEmbedding).not.toHaveBeenCalled();

      const updateCall = mockBookmarkService.update.mock.calls[0];
      expect(updateCall[0]).toBe(privateBookmark.id);
      expect(updateCall[1]).toEqual(
        expect.objectContaining({
          title: "Checkout Design Review",
          cosmicBriefSummary:
            "Private Figma file for the checkout design review and payment polish handoff.",
          cosmicTags: ["figma", "checkout", "design-review"],
          collectionId: "design-reviews-id",
        })
      );
      expect(updateCall[1].cosmicSummary).toBeUndefined();
      expect(updateCall[1].searchDocument).toBeUndefined();
      expect(updateCall[1].quickAccess).toContain("payments polish");
      expect(updateCall[1].quickAccess).toContain("handoff");
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
      expect(mockBookmarkProcessingRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarkId: testBookmark.id,
          userId: testBookmark.userId,
        })
      );
    });

    it("uses the large model for full summaries and the small model for generated bookmark data", async () => {
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

      expect(mockAI.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "qwen/qwen3.7-plus",
        })
      );
      expect(
        mockAI.generateObjectWithUsage.mock.calls.map(([input]) => input.modelId)
      ).toEqual([
        "deepseek/deepseek-v4-flash",
        "deepseek/deepseek-v4-flash",
        "deepseek/deepseek-v4-flash",
        "deepseek/deepseek-v4-flash",
      ]);
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
      mockAI.newTask.mockResolvedValue({
        taskID: "test-task-id",
        sessionID: mockSession.sessionID,
        name: "test-task",
        status: "pending",
        subTasks: {},
      });
      mockAI.generateText.mockRejectedValueOnce(
        new Error("AI service unavailable")
      );

      await expect(
        service.process(testBookmark.id, testBookmark.userId)
      ).rejects.toThrow("AI service unavailable");

      expect(mockBookmarkProcessingRepository.updateRun).toHaveBeenCalledWith(
        "run-1",
        expect.objectContaining({
          status: "failed",
          error: "AI service unavailable",
        })
      );
    });

    it("marks the bookmark failed when the durable timeline cannot start", async () => {
      mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
      mockBookmarkService.getScrapedUrlContent.mockResolvedValue(
        testScrapedContent
      );
      mockBookmarkService.updateProcessingStatus.mockImplementation(
        async (_id, status, error) => ({
          ...testBookmark,
          processingStatus: status,
          processingError: error,
        })
      );
      mockBookmarkProcessingRepository.createRun.mockRejectedValueOnce(
        new Error("timeline unavailable")
      );

      await expect(
        service.process(testBookmark.id, testBookmark.userId)
      ).rejects.toThrow("timeline unavailable");

      expect(mockBookmarkService.updateProcessingStatus).toHaveBeenNthCalledWith(
        1,
        testBookmark.id,
        "processing"
      );
      expect(mockBookmarkService.updateProcessingStatus).toHaveBeenNthCalledWith(
        2,
        testBookmark.id,
        "failed",
        "timeline unavailable"
      );
    });

    it("completes the bookmark when embedding generation fails", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockSession: Session = {
        sessionID: "test-session-id",
        refID: testBookmark.id,
      };
      const completedBookmark = {
        ...testBookmark,
        processingStatus: "completed" as const,
      };

      mockBookmarkService.findByIdAndUser.mockResolvedValue(testBookmark);
      mockBookmarkService.getScrapedUrlContent.mockResolvedValue(
        testScrapedContent
      );
      mockBookmarkService.updateProcessingStatus.mockImplementation(
        async (_id, status, error) => ({
          ...testBookmark,
          processingStatus: status,
          processingError: error,
        })
      );
      mockBookmarkService.update.mockResolvedValue(completedBookmark);
      mockAI.newSession.mockResolvedValue(mockSession);
      mockChunkingService.chunkHtml.mockReturnValue([
        {
          content: "chunk text",
          index: 0,
          size: 10,
          startPosition: 0,
          endPosition: 10,
        },
      ]);
      mockContentChunkRepository.createTextChunk.mockResolvedValue({
        id: "chunk-1",
        scrapedContentId: testScrapedContent.id,
        chunkType: "text",
        content: "chunk text",
        index: 0,
        size: 10,
        startPosition: 0,
        endPosition: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockEmbeddingService.embedTextsWithUsage.mockRejectedValueOnce(
        new Error("embedding provider unavailable")
      );

      try {
        await expect(
          service.process(testBookmark.id, testBookmark.userId)
        ).resolves.toBeUndefined();

        expect(
          mockBookmarkService.updateProcessingStatus
        ).toHaveBeenLastCalledWith(testBookmark.id, "completed");
        expect(mockBookmarkProcessingRepository.updateRun).toHaveBeenCalledWith(
          "run-1",
          expect.objectContaining({
            status: "completed",
          })
        );
        expect(mockBookmarkProcessingRepository.updateEvent).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            status: "failed",
            error: "embedding provider unavailable",
          })
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
