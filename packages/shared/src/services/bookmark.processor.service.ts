import { Bookmark, BookmarkImage, ScrapedUrlContents } from "../types";
import { BookmarkService } from "./bookmark.service";
import { AI } from "../ai";
import { z } from "zod";
import {
  GENERATE_TAGS_PROMPT,
  FILTER_IMAGES_PROMPT,
  SUMMARIZE_PROMPT,
  BRIEF_SUMMARY_PROMPT,
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
import pLimit from "p-limit";

export interface BookmarkProcessorService {
  process(id: string, userId: string): Promise<void>;
}

export class BookmarkProcessorServiceImpl implements BookmarkProcessorService {
  private categorizerService: BookmarkCategorizerService;

  constructor(
    private bookmarkService: BookmarkService,
    private contentChunkRepository: ContentChunkRepository,
    private collectionRepository: CollectionRepository,
    private ai: AI,
    private eventBus: EventBus,
    private httpClient: HttpClient = new CosmicHttpClient()
  ) {
    this.categorizerService = new BookmarkCategorizerServiceImpl(
      collectionRepository,
      ai,
      eventBus
    );
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

  private async summarizeContent(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<{ summary: string; briefSummary: string }> {
    let summary = "";
    let briefSummary = "";

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
          content: SUMMARIZE_PROMPT.replace(
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
        prompt: BRIEF_SUMMARY_PROMPT.replace(
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

      const limit = pLimit(5); // Limit to 5 concurrent image downloads

      const imageProcessingPromises = relevantImages.images.map((image, index) =>
        limit(async () => {
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
        })
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
