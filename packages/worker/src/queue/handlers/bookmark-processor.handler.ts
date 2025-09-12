import { Injectable, Logger } from "@nestjs/common";
import { MessageHandler } from "../interfaces/message-handler.interface";
import { QueueMessage } from "../../types/queue.types";
import { SupabaseClientService } from "../supabase-client.service";
import { BookmarkQueuePayload } from "@cosmic-dolphin/shared";

const TurndownService = require("turndown");

interface BookmarkContent {
  rawHtml: string;
  markdown: string;
}

@Injectable()
export class BookmarkProcessorHandler implements MessageHandler {
  private readonly logger = new Logger(BookmarkProcessorHandler.name);
  private readonly turndownService: any;

  constructor(private readonly supabaseClient: SupabaseClientService) {
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
  }

  canHandle(): boolean {
    return true;
  }

  async handle(message: QueueMessage): Promise<void> {
    this.logger.log(`Processing bookmark`, {
      msg_id: message.msg_id,
      message_type: message.message?.type,
    });

    try {
      const payload = message.message as BookmarkQueuePayload;

      if (!payload || !payload.data) {
        throw new Error("Invalid bookmark payload");
      }

      await this.processBookmark(payload);

      this.logger.log(`Successfully processed bookmark ${message.msg_id}`, {
        bookmarkId: payload.data.bookmarkId,
        userId: payload.data.userId,
      });
    } catch (error) {
      this.logger.error(`Failed to process bookmark ${message.msg_id}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        message: message.message,
      });
      throw error;
    }
  }

  getMessageType(): string {
    return "bookmark";
  }

  private async processBookmark(payload: BookmarkQueuePayload): Promise<void> {
    const { bookmarkId, sourceUrl, userId, collectionId } = payload.data;

    await this.sendBookmarkUpdate(
      bookmarkId,
      `Starting to process Bookmark ${bookmarkId}: ${sourceUrl}`
    );

    this.logger.debug("Processing bookmark payload", {
      bookmarkId,
      sourceUrl,
      userId,
      collectionId,
    });

    const bookmark = await this.fetchBookmarkFromDatabase(bookmarkId);

    await this.sendBookmarkUpdate(
      bookmarkId,
      `Fetching content for Bookmark ${bookmarkId}: ${sourceUrl}`
    );

    try {
      const content = await this.fetchAndConvertContent(sourceUrl);

      await this.sendBookmarkUpdate(
        bookmarkId,
        `Content converted, updating Bookmark ${bookmarkId}: ${sourceUrl}`
      );

      await this.updateBookmarkContent(bookmarkId, content);

      await this.sendBookmarkUpdate(
        bookmarkId,
        `Successfully processed Bookmark ${bookmarkId}: ${sourceUrl}`
      );
    } catch (error) {
      await this.sendBookmarkUpdate(
        bookmarkId,
        `Failed to process content for Bookmark ${bookmarkId}: ${error.message}`
      );
      throw error;
    }
  }

  private async sendBookmarkUpdate(
    bookmarkId: string,
    message: string
  ): Promise<void> {
    await this.supabaseClient
      .getClient()
      .channel("bookmarks")
      .send({
        type: "broadcast",
        event: "update",
        payload: {
          id: bookmarkId,
          updated_at: new Date().toISOString(),
          message,
        },
      });
  }

  private async fetchBookmarkFromDatabase(bookmarkId: string): Promise<any> {
    const { data: bookmark, error: fetchError } = await this.supabaseClient
      .getClient()
      .from("bookmarks")
      .select("*")
      .eq("id", bookmarkId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch bookmark: ${fetchError.message}`);
    }

    if (!bookmark) {
      throw new Error(`Bookmark not found: ${bookmarkId}`);
    }

    return bookmark;
  }

  private async fetchAndConvertContent(
    sourceUrl: string
  ): Promise<BookmarkContent> {
    try {
      const rawHtml = await this.fetchHtmlContent(sourceUrl);
      const markdown = this.convertHtmlToMarkdown(rawHtml);

      return {
        rawHtml,
        markdown,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch or convert content from ${sourceUrl}`,
        {
          error: error instanceof Error ? error.message : error,
        }
      );
      throw new Error(`Content processing failed: ${error.message}`);
    }
  }

  private async fetchHtmlContent(sourceUrl: string): Promise<string> {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CosmicDolphin/1.0; +https://cosmic-dolphin.com)",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("text/html")) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const html = await response.text();

      if (!html || html.trim().length === 0) {
        throw new Error("Empty content received");
      }

      return html;
    } catch (error) {
      this.logger.error(`Failed to fetch HTML content from ${sourceUrl}`, {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private convertHtmlToMarkdown(html: string): string {
    try {
      const markdown = this.turndownService.turndown(html);

      if (!markdown || markdown.trim().length === 0) {
        throw new Error(
          "HTML to Markdown conversion resulted in empty content"
        );
      }

      return markdown.trim();
    } catch (error) {
      this.logger.error("Failed to convert HTML to Markdown", {
        error: error instanceof Error ? error.message : error,
        htmlLength: html.length,
      });
      throw new Error(`Markdown conversion failed: ${error.message}`);
    }
  }

  private async updateBookmarkContent(
    bookmarkId: string,
    content: BookmarkContent
  ): Promise<void> {
    const { error: updateError } = await this.supabaseClient
      .getClient()
      .from("bookmarks")
      .update({
        content: content.markdown,
        raw_content: content.rawHtml,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId);

    if (updateError) {
      this.logger.error("Failed to update bookmark content", {
        bookmarkId,
        error: updateError.message,
      });
      throw new Error(`Database update failed: ${updateError.message}`);
    }
  }
}
