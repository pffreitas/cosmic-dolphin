import { Injectable, Logger, Inject } from "@nestjs/common";
import { MessageHandler } from "../interfaces/message-handler.interface";
import { QueueMessage } from "../../types/queue.types";
import {
  BookmarkQueuePayload,
  BookmarkProcessorService,
} from "@cosmic-dolphin/shared";
import { BOOKMARK_PROCESSOR_SERVICE } from "../tokens";

@Injectable()
export class BookmarkProcessorHandler implements MessageHandler {
  private readonly logger = new Logger(BookmarkProcessorHandler.name);

  constructor(
    @Inject(BOOKMARK_PROCESSOR_SERVICE)
    private readonly bookmarkProcessorService: BookmarkProcessorService,
  ) {}

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

      const { bookmarkId, userId } = payload.data;
      await this.bookmarkProcessorService.process(bookmarkId, userId);

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
}
