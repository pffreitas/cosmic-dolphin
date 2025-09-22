import { Bookmark, ScrapedUrlContents } from "../types";
import { BookmarkService } from "./bookmark.service";
import { AI } from "../ai";
import { z } from "zod";
import {
  GENERATE_TAGS_PROMPT,
  SUMMARIZE_PROMPT,
} from "../services/bookmark.processor.prompt";
import { Session } from "../ai/types";
import { Identifier } from "../ai/id";
import { EventBus } from "../ai/bus";

export interface BookmarkProcessorService {
  process(id: string, userId: string): Promise<void>;
}

export class BookmarkProcessorServiceImpl implements BookmarkProcessorService {
  constructor(
    private bookmarkService: BookmarkService,
    private ai: AI,
    private eventBus: EventBus
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

    bookmark.cosmicSummary = await this.summarizeContent(
      session,
      bookmark,
      content
    );

    const tags = await this.generateMetadata(session, bookmark, content);
    bookmark.cosmicTags = tags;

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
  ): Promise<string> {
    let summary = "";

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

    return summary;
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
}
