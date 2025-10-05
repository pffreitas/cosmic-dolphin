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

export interface BookmarkProcessorService {
  process(id: string, userId: string): Promise<void>;
}

export class BookmarkProcessorServiceImpl implements BookmarkProcessorService {
  constructor(
    private bookmarkService: BookmarkService,
    private contentChunkRepository: ContentChunkRepository,
    private ai: AI,
    private eventBus: EventBus,
    private httpClient: HttpClient = new CosmicHttpClient()
  ) {}

  async process(id: string, userId: string): Promise<void> {
    const bookmark = await this.bookmarkService.findByIdAndUser(id, userId);
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${id}`);
    }

    const content = await this.bookmarkService.getScrapedUrlContent(
      bookmark.id
    );
    if (!content) {
      throw new Error(`Scraped url content not found: ${bookmark.id}`);
    }

    const session = await this.ai.newSession(bookmark.id);
    this.eventBus.publishEvent({
      type: "session.started",
      data: session,
      timestamp: new Date(),
    });

    const { summary, briefSummary } = await this.summarizeContent(
      session,
      bookmark,
      content
    );
    bookmark.cosmicSummary = summary;
    // bookmark.cosmicBriefSummary = briefSummary;

    const tags = await this.generateMetadata(session, bookmark, content);
    bookmark.cosmicTags = tags;

    await this.bookmarkService.update(bookmark.id, bookmark);
    this.eventBus.publishEvent({
      type: "bookmark.updated",
      data: bookmark,
      timestamp: new Date(),
    });

    const images = await this.processImages(session, bookmark, content);
    bookmark.cosmicImages = images;

    await this.bookmarkService.update(bookmark.id, bookmark);
    this.eventBus.publishEvent({
      type: "bookmark.updated",
      data: bookmark,
      timestamp: new Date(),
    });
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
    this.eventBus.publishEvent({
      type: "task.started",
      data: task,
      timestamp: new Date(),
    });

    try {
      for await (const part of this.ai.prompt({
        sessionID: session.sessionID,
        taskID: task.taskID,
        messageID: Identifier.ascending("message"),
        modelId: "x-ai/grok-code-fast-1",
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

          this.eventBus.publishEvent({
            type: "bookmark.updated",
            data: bookmark,
            timestamp: new Date(),
          });
        }
      }

      briefSummary = await this.ai.generateObject({
        sessionID: session.sessionID,
        modelId: "x-ai/grok-code-fast-1",
        prompt: BRIEF_SUMMARY_PROMPT.replace(
          "{{CONTENT}}",
          content.content ?? ""
        ),
        schema: z.string().describe("The summary of the content"),
      });
    } catch (error) {
      console.error("Failed to summarize content", error);
      this.eventBus.publishEvent({
        type: "task.failed",
        data: task,
        timestamp: new Date(),
      });
      throw error;
    } finally {
      task.subTasks[subTask.taskID].status = "completed";
      this.eventBus.publishEvent({
        type: "task.completed",
        data: task,
        timestamp: new Date(),
      });
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
    this.eventBus.publishEvent({
      type: "task.started",
      data: task,
      timestamp: new Date(),
    });

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
      this.eventBus.publishEvent({
        type: "task.failed",
        data: task,
        timestamp: new Date(),
      });
      throw error;
    } finally {
      task.status = "completed";
      task.subTasks[subTask.taskID].status = "completed";
      this.eventBus.publishEvent({
        type: "task.completed",
        data: task,
        timestamp: new Date(),
      });
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
    this.eventBus.publishEvent({
      type: "task.started",
      data: task,
      timestamp: new Date(),
    });

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

      for (let index = 0; index < relevantImages.images.length; index++) {
        const image = relevantImages.images[index];
        const imageSubTask = await this.ai.newSubTask("Processing image");
        task.subTasks[imageSubTask.taskID] = imageSubTask;
        this.eventBus.publishEvent({
          type: "task.updated",
          data: task,
          timestamp: new Date(),
        });

        try {
          const response = await this.httpClient.fetch(image.url);
          if (!response.ok) {
            // TODO: fail subtask and continue
            throw new Error(`Failed to download image: ${response.statusText}`);
          }

          const imageBuffer = await response.arrayBuffer();
          const imageByteArray = Buffer.from(imageBuffer);
          const mimeType = response.headers.get("content-type") || "image/jpeg";
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

          images.push({
            url: image.url,
            title: image.title,
            description: image.description,
          });

          task.subTasks[imageSubTask.taskID].status = "completed";
          this.eventBus.publishEvent({
            type: "task.updated",
            data: task,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error(`Failed to process image ${image.url}:`, error);
          task.subTasks[imageSubTask.taskID].status = "failed";
          this.eventBus.publishEvent({
            type: "task.updated",
            data: task,
            timestamp: new Date(),
          });
        }
      }

      task.status = "completed";
      this.eventBus.publishEvent({
        type: "task.completed",
        data: task,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to process images:", error);
      task.status = "failed";
      this.eventBus.publishEvent({
        type: "task.failed",
        data: task,
        timestamp: new Date(),
      });
      throw error;
    }
    return images;
  }
}
