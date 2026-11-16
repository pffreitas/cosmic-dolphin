import { Injectable, Logger, Inject } from "@nestjs/common";
import { MessageHandler } from "../interfaces/message-handler.interface";
import { QueueMessage } from "../../types/queue.types";
import type {
  BookmarkQueuePayload,
  BookmarkProcessorService,
  BookmarkService,
} from "@cosmic-dolphin/shared";
import { BookmarkNotFoundError } from "@cosmic-dolphin/shared";
import { BOOKMARK_PROCESSOR_SERVICE, BOOKMARK_SERVICE } from "../tokens";

@Injectable()
export class BookmarkProcessorHandler implements MessageHandler {
  private readonly logger = new Logger(BookmarkProcessorHandler.name);

  constructor(
    @Inject(BOOKMARK_PROCESSOR_SERVICE)
    private readonly bookmarkProcessorService: BookmarkProcessorService,
    @Inject(BOOKMARK_SERVICE)
    private readonly bookmarkService: BookmarkService,
  ) {}

  canHandle(messageType: string): boolean {
    return messageType === "bookmark_process";
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

      // `phase` and `resume` arrive only from `POST /bookmarks/{id}/reprocess`
      // — a retry of one line of the checklist, appended to the timeline the
      // user is already looking at.
      const { bookmarkId, userId, phase, resume } = payload.data;
      await this.bookmarkProcessorService.process(bookmarkId, userId, {
        phase,
        resume: resume || message.read_ct > 1,
      });

      this.logger.log(`Successfully processed bookmark ${message.msg_id}`, {
        bookmarkId: payload.data.bookmarkId,
        userId: payload.data.userId,
      });
    } catch (error) {
      if (error instanceof BookmarkNotFoundError) {
        // Deleted while queued: nothing can succeed later, so acknowledge the
        // message by returning instead of spending retries on it.
        this.logger.log(
          `Bookmark ${error.bookmarkId} no longer exists; dropping message ${message.msg_id}`,
        );
        return;
      }
      this.logger.error(`Failed to process bookmark ${message.msg_id}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        message: message.message,
      });
      throw error;
    }
  }

  async onExhausted(message: QueueMessage): Promise<void> {
    const payload = message.message as BookmarkQueuePayload | undefined;
    const bookmarkId = payload?.data?.bookmarkId;
    if (!bookmarkId) {
      this.logger.warn(
        `Exhausted bookmark message ${message.msg_id} has no bookmark to fail`,
      );
      return;
    }

    try {
      await this.bookmarkService.updateProcessingStatus(
        bookmarkId,
        "failed",
        "Processing stopped after repeated worker failures",
      );
    } catch (error) {
      // The bookmark may have been deleted while the message kept crashing.
      this.logger.warn(
        `Could not mark bookmark ${bookmarkId} failed for exhausted message ${message.msg_id}`,
        { error: error instanceof Error ? error.message : error },
      );
    }
  }

  getMessageType(): string {
    return "bookmark";
  }
}
