import { Injectable, Logger, Inject } from "@nestjs/common";
import { MessageHandler } from "../interfaces/message-handler.interface";
import { QueueMessage } from "../../types/queue.types";
import type {
  BookmarkQueuePayload,
  BookmarkProcessorService,
} from "@cosmic-dolphin/shared";
import { BookmarkNotFoundError } from "@cosmic-dolphin/shared";
import { BOOKMARK_PROCESSOR_SERVICE } from "../tokens";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

@Injectable()
export class BookmarkProcessorHandler implements MessageHandler {
  private readonly logger = new Logger(BookmarkProcessorHandler.name);

  constructor(
    @Inject(BOOKMARK_PROCESSOR_SERVICE)
    private readonly bookmarkProcessorService: BookmarkProcessorService,
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

  /**
   * Record that the message was delivered too often to run again.
   *
   * A payload that names no bookmark (or malformed ids), or a bookmark that no longer exists for
   * that user, leaves nothing to record: return and let the message be
   * archived. Any other failure propagates, so the processor keeps the message
   * and pgmq redelivers it once the database is back.
   */
  async onExhausted(message: QueueMessage): Promise<void> {
    const payload = message.message as BookmarkQueuePayload | undefined;
    const bookmarkId = payload?.data?.bookmarkId;
    const userId = payload?.data?.userId;
    if (!isUuid(bookmarkId) || !isUuid(userId)) {
      // Malformed ids would make the database raise a permanent error, which
      // would keep the message forever; archive it like an unreadable payload.
      this.logger.warn(
        `Exhausted bookmark message ${message.msg_id} has no valid bookmark to fail`,
      );
      return;
    }

    const recorded = await this.bookmarkProcessorService.failExhausted(
      bookmarkId,
      userId,
      "Processing stopped after repeated worker failures",
    );
    if (!recorded) {
      this.logger.warn(
        `Bookmark ${bookmarkId} no longer exists; archiving exhausted message ${message.msg_id}`,
      );
    }
  }

  getMessageType(): string {
    return "bookmark";
  }
}
