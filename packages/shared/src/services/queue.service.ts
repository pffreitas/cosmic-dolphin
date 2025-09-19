import { QueueTaskPayload, BookmarkQueuePayload } from "../types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface QueueService {
  sendMessage<T extends QueueTaskPayload>(
    queueName: string,
    payload: T,
    delay?: number
  ): Promise<void>;
  sendBookmarkProcessingMessage(
    bookmarkId: string,
    userId: string
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
    userId: string
  ): Promise<void> {
    const payload: BookmarkQueuePayload = {
      type: "bookmark_process",
      data: {
        bookmarkId,
        userId,
      },
      metadata: {
        source: "api",
        priority: "medium",
      },
    };

    await this.sendMessage("bookmarks", payload);
  }
}
