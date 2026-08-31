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
import { SupabaseClient } from "@supabase/supabase-js";

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
  constructor(private supabaseClient: SupabaseClient) {}

  async sendMessage<T extends QueueTaskPayload>(
    queueName: string,
    payload: T,
    delay: number = 0
  ): Promise<void> {
    const { data, error } = await this.supabaseClient
      .schema("pgmq_public")
      .rpc("send", {
        queue_name: queueName,
        message: payload,
        sleep_seconds: delay,
      });

    if (error) {
      throw new Error(`Failed to post to queue ${queueName}: ${error.message}`);
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
