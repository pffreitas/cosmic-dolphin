import {
  QueueTaskPayload,
  BookmarkQueuePayload,
  BookmarkProcessingPhase,
} from "../types";

export interface BookmarkProcessingMessageOptions {
  /** Reprocess one phase only. Absent runs the whole pipeline. */
  phase?: BookmarkProcessingPhase;
  /** Append to the bookmark's existing timeline instead of opening a run. */
  resume?: boolean;
}
import { PgmqRepository } from "../repositories/pgmq.repository";

export interface QueueService {
  sendMessage<T extends QueueTaskPayload>(
    queueName: string,
    payload: T,
    delay?: number
  ): Promise<void>;
  sendBookmarkProcessingMessage(
    bookmarkId: string,
    userId: string,
    options?: BookmarkProcessingMessageOptions
  ): Promise<void>;
}

export class QueueServiceImpl implements QueueService {
  constructor(private pgmq: PgmqRepository) {}

  async sendMessage<T extends QueueTaskPayload>(
    queueName: string,
    payload: T,
    delay: number = 0
  ): Promise<void> {
    try {
      await this.pgmq.send(queueName, payload, delay);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to post to queue ${queueName}: ${message}`);
    }
  }

  async sendBookmarkProcessingMessage(
    bookmarkId: string,
    userId: string,
    options: BookmarkProcessingMessageOptions = {}
  ): Promise<void> {
    const payload: BookmarkQueuePayload = {
      type: "bookmark_process",
      data: {
        bookmarkId,
        userId,
        ...(options.phase ? { phase: options.phase } : {}),
        ...(options.resume ? { resume: true } : {}),
      },
      metadata: {
        source: "api",
        priority: "medium",
      },
    };

    await this.sendMessage("bookmarks", payload);
  }
}
