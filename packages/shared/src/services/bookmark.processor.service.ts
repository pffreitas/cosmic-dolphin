import { Bookmark, BookmarkImage, ScrapedUrlContents } from "../types";
import { BookmarkService } from "./bookmark.service";
import { AI } from "../ai";
import { z } from "zod";
import {
  GENERATE_TAGS_PROMPT,
  FILTER_IMAGES_PROMPT,
  SUMMARIZE_PROMPT,
  BRIEF_SUMMARY_PROMPT,
  SUMMARIZE_YOUTUBE_PROMPT,
  BRIEF_SUMMARY_YOUTUBE_PROMPT,
} from "../services/bookmark.processor.prompt";
import { Session } from "../ai/types";
import { Identifier } from "../ai/id";
import { EventBus } from "../ai/bus";
import { ContentChunkRepository } from "../repositories/content-chunk.repository";
import { HttpClient, CosmicHttpClient } from "./http-client";
import {
  BookmarkCategorizerService,
  BookmarkCategorizerServiceImpl,
} from "./bookmark.categorizer.service";
import { CollectionRepository } from "../repositories/collection.repository";
import { ChunkingService, ChunkingServiceImpl } from "./chunking.service";
import { EmbeddingService, EmbeddingServiceImpl } from "./embedding.service";

export interface BookmarkProcessorService {
  process(id: string, userId: string): Promise<void>;
}

export class BookmarkProcessorServiceImpl implements BookmarkProcessorService {
  private categorizerService: BookmarkCategorizerService;
  private chunkingService: ChunkingService;
  private embeddingService: EmbeddingService;

  constructor(
    private bookmarkService: BookmarkService,
    private contentChunkRepository: ContentChunkRepository,
    private collectionRepository: CollectionRepository,
    private ai: AI,
    private eventBus: EventBus,
    private httpClient: HttpClient = new CosmicHttpClient(),
    chunkingService?: ChunkingService,
    embeddingService?: EmbeddingService
  ) {
    this.categorizerService = new BookmarkCategorizerServiceImpl(
      collectionRepository,
      ai,
      eventBus
    );
    this.chunkingService = chunkingService ?? new ChunkingServiceImpl();
    this.embeddingService = embeddingService ?? new EmbeddingServiceImpl();
  }

  async process(id: string, userId: string): Promise<void> {
    let bookmark = await this.bookmarkService.findByIdAndUser(id, userId);
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${id}`);
    }

    const content = await this.bookmarkService.getScrapedUrlContent(
      bookmark.id
    );
    if (!content) {
      throw new Error(`Scraped url content not found: ${bookmark.id}`);
    }

    // Update processing status to 'processing'
    bookmark = await this.bookmarkService.updateProcessingStatus(
      bookmark.id,
      "processing"
    );

    // Publish processing started event to bookmark-specific channel
    await this.eventBus.publishToBookmark(
      bookmark.id,
      "bookmark.processing.started",
      {
        bookmark,
      }
    );

    try {
      const session = await this.ai.newSession(bookmark.id);
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "session.started",
        session
      );

      const { summary, briefSummary } = await this.summarizeContent(
        session,
        bookmark,
        content
      );
      bookmark.cosmicSummary = summary;
      bookmark.cosmicBriefSummary = briefSummary;

      const tags = await this.generateMetadata(session, bookmark, content);
      bookmark.cosmicTags = tags;

      bookmark = await this.bookmarkService.update(bookmark.id, bookmark);
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "bookmark.updated",
        bookmark
      );

      // Categorize the bookmark using AI
      const categorization = await this.categorizerService.categorize(
        session,
        bookmark,
        content
      );
      bookmark.collectionId = categorization.categoryId;

      bookmark = await this.bookmarkService.update(bookmark.id, bookmark);
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "bookmark.updated",
        bookmark
      );

      const images = await this.processImages(session, bookmark, content);
      bookmark.cosmicImages = images;

      bookmark = await this.bookmarkService.update(bookmark.id, bookmark);
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "bookmark.updated",
        bookmark
      );

      await this.chunkAndEmbed(session, bookmark, content);

      const searchDocument = this.buildSearchDocument(bookmark, content);
      bookmark.searchDocument = searchDocument;
      bookmark = await this.bookmarkService.update(bookmark.id, bookmark);

      // Update processing status to 'completed'
      bookmark = await this.bookmarkService.updateProcessingStatus(
        bookmark.id,
        "completed"
      );
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "bookmark.processing.completed",
        {
          bookmark,
        }
      );
    } catch (error) {
      // Update processing status to 'failed'
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      bookmark = await this.bookmarkService.updateProcessingStatus(
        bookmark.id,
        "failed",
        errorMessage
      );
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "bookmark.processing.failed",
        {
          bookmark,
          error: errorMessage,
        }
      );
      throw error;
    } finally {
      // Cleanup the bookmark channel
      await this.eventBus.cleanupBookmarkChannel(bookmark.id);
    }
  }

  private isYouTubeBookmark(bookmark: Bookmark): boolean {
    return bookmark.metadata?.openGraph?.site_name === "YouTube";
  }

  private async summarizeContent(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<{ summary: string; briefSummary: string }> {
    let summary = "";
    let briefSummary = "";

    const isYouTube = this.isYouTubeBookmark(bookmark);
    const summarizePrompt = isYouTube ? SUMMARIZE_YOUTUBE_PROMPT : SUMMARIZE_PROMPT;
    const briefPrompt = isYouTube ? BRIEF_SUMMARY_YOUTUBE_PROMPT : BRIEF_SUMMARY_PROMPT;

    const task = await this.ai.newTask(
      session.sessionID,
      "Summarizing content"
    );
    const subTask = await this.ai.newSubTask("Summarizing content");
    task.subTasks[subTask.taskID] = subTask;
    await this.eventBus.publishToBookmark(bookmark.id, "task.started", task);

    try {
      for await (const part of this.ai.prompt({
        sessionID: session.sessionID,
        taskID: task.taskID,
        messageID: Identifier.ascending("message"),
        modelId: "google/gemini-2.5-pro",
        context: [],
        tools: [],
        message: {
          role: "user",
          content: summarizePrompt.replace(
            "{{CONTENT}}",
            content.content ?? ""
          ),
        },
      })) {
        if (part.type === "text") {
          summary = part.part.text;
          bookmark.cosmicSummary = summary;

          // Stream the updated bookmark content to the client
          await this.eventBus.publishToBookmark(
            bookmark.id,
            "bookmark.updated",
            bookmark
          );
        }
      }

      briefSummary = await this.ai.generateObject({
        sessionID: session.sessionID,
        modelId: "google/gemini-2.5-flash",
        prompt: briefPrompt.replace(
          "{{CONTENT}}",
          content.content ?? ""
        ),
        schema: z.string().describe("The summary of the content"),
      });
    } catch (error) {
      console.error("Failed to summarize content", error);
      await this.eventBus.publishToBookmark(bookmark.id, "task.failed", task);
      throw error;
    } finally {
      task.subTasks[subTask.taskID].status = "completed";
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "task.completed",
        task
      );
    }

    return { summary, briefSummary };
  }

  private async generateMetadata(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<string[]> {
    const task = await this.ai.newTask(
      session.sessionID,
      "Generating metadata"
    );
    const subTask = await this.ai.newSubTask("Generating tags");
    task.subTasks[subTask.taskID] = subTask;
    await this.eventBus.publishToBookmark(bookmark.id, "task.started", task);

    try {
      let output = "";
      for await (const part of this.ai.prompt({
        sessionID: session.sessionID,
        taskID: task.taskID,
        messageID: Identifier.ascending("message"),
        modelId: "x-ai/grok-code-fast-1",
        context: [],
        tools: [],
        message: {
          role: "user",
          content: GENERATE_TAGS_PROMPT.replace(
            "{{CONTENT}}",
            content.content ?? ""
          ),
        },
      })) {
        if (part.type === "text") {
          output = part.part.text;
        }
      }

      // TODO: handle error and retry
      const parsed = z
        .object({
          tags: z.array(z.string()).describe("The array of tag strings"),
        })
        .parse(JSON.parse(output));

      return parsed.tags;
    } catch (error) {
      console.error("Failed to generate metadata", error);
      await this.eventBus.publishToBookmark(bookmark.id, "task.failed", task);
      throw error;
    } finally {
      task.status = "completed";
      task.subTasks[subTask.taskID].status = "completed";
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "task.completed",
        task
      );
    }
  }

  private buildSearchDocument(
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): string {
    const cleanedText = this.chunkingService.stripHtml(content.content ?? "");
    const truncated = cleanedText.slice(0, 5000);

    const parts = [
      bookmark.title ?? "",
      bookmark.sourceUrl,
      bookmark.cosmicBriefSummary ?? "",
      bookmark.cosmicTags?.join(" ") ?? "",
      truncated,
    ];

    return parts.filter(Boolean).join("\n");
  }

  private async chunkAndEmbed(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<void> {
    const task = await this.ai.newTask(
      session.sessionID,
      "Chunking and embedding content"
    );
    await this.eventBus.publishToBookmark(bookmark.id, "task.started", task);

    try {
      const scrapedContent =
        await this.bookmarkService.getScrapedUrlContent(bookmark.id);
      if (!scrapedContent) {
        throw new Error(
          `Scraped content not found for bookmark ${bookmark.id}`
        );
      }

      const chunks = this.chunkingService.chunkHtml(content.content ?? "");

      if (chunks.length === 0) {
        task.status = "completed";
        await this.eventBus.publishToBookmark(
          bookmark.id,
          "task.completed",
          task
        );
        return;
      }

      const textChunkIds: string[] = [];
      for (const chunk of chunks) {
        const textChunk = await this.contentChunkRepository.createTextChunk({
          scrapedContentId: scrapedContent.id,
          content: chunk.content,
          index: chunk.index,
          size: chunk.size,
          startPosition: chunk.startPosition,
          endPosition: chunk.endPosition,
        });
        textChunkIds.push(textChunk.id);
      }

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingService.embedTexts(chunkTexts);

      for (let i = 0; i < textChunkIds.length; i++) {
        await this.contentChunkRepository.updateTextChunkEmbedding(
          textChunkIds[i],
          embeddings[i]
        );
      }

      task.status = "completed";
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "task.completed",
        task
      );
    } catch (error) {
      console.error("Failed to chunk and embed content:", error);
      task.status = "failed";
      await this.eventBus.publishToBookmark(bookmark.id, "task.failed", task);
    }
  }

  private async processImages(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<BookmarkImage[]> {
    const images: BookmarkImage[] = [];

    if (!content.images || content.images.length === 0) {
      return images;
    }

    const task = await this.ai.newTask(session.sessionID, "Processing images");
    await this.eventBus.publishToBookmark(bookmark.id, "task.started", task);

    try {
      const relevantImages = await this.ai.generateObject({
        sessionID: session.sessionID,
        modelId: "x-ai/grok-code-fast-1",
        prompt: FILTER_IMAGES_PROMPT.replace(
          "{{CONTENT}}",
          content.content ?? ""
        ),
        schema: z.object({
          images: z
            .array(
              z.object({
                url: z.string().describe("The image URL"),
                title: z.string().describe("The image title"),
                description: z.string().describe("The image description"),
              })
            )
            .describe("The array of image URLs"),
        }),
      });

      const imageProcessingPromises = relevantImages.images.map(
        async (image, index) => {
          const imageSubTask = await this.ai.newSubTask("Processing image");
          task.subTasks[imageSubTask.taskID] = imageSubTask;
          await this.eventBus.publishToBookmark(
            bookmark.id,
            "task.updated",
            task
          );

          try {
            const response = await this.httpClient.fetch(image.url);
            if (!response.ok) {
              throw new Error(
                `Failed to download image: ${response.statusText}`
              );
            }

            const imageBuffer = await response.arrayBuffer();
            const imageByteArray = Buffer.from(imageBuffer);
            const mimeType =
              response.headers.get("content-type") || "image/jpeg";
            const imageSize = imageByteArray.length;

            await this.contentChunkRepository.createImageChunk({
              scrapedContentId: content.id,
              imageData: imageByteArray,
              mimeType: mimeType,
              altText: image.title,
              originalUrl: image.url,
              index: index,
              size: imageSize,
              startPosition: 0,
              endPosition: imageSize,
            });

            task.subTasks[imageSubTask.taskID].status = "completed";
            await this.eventBus.publishToBookmark(
              bookmark.id,
              "task.updated",
              task
            );

            return {
              url: image.url,
              title: image.title,
              description: image.description,
            };
          } catch (error) {
            console.error(`Failed to process image ${image.url}:`, error);
            task.subTasks[imageSubTask.taskID].status = "failed";
            await this.eventBus.publishToBookmark(
              bookmark.id,
              "task.updated",
              task
            );
            return null;
          }
        }
      );

      const processedImages = await Promise.all(imageProcessingPromises);
      images.push(...processedImages.filter((img) => img !== null));

      task.status = "completed";
      await this.eventBus.publishToBookmark(
        bookmark.id,
        "task.completed",
        task
      );
    } catch (error) {
      console.error("Failed to process images:", error);
      task.status = "failed";
      await this.eventBus.publishToBookmark(bookmark.id, "task.failed", task);
      throw error;
    }
    return images;
  }
}
