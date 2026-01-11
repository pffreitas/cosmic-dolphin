import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { LLMResponse, LLMResponsePart } from "./types";
import { z } from "zod";

export const EventTypeSchema = z.enum([
  "session.started",
  "session.error",
  "message.updated",
  "tool.failed",
  "message.part.updated",
  "bookmark.updated",
  "bookmark.processing.started",
  "bookmark.processing.completed",
  "bookmark.processing.failed",
  "task.started",
  "task.updated",
  "task.completed",
  "task.failed",
]);

export type EventType = z.infer<typeof EventTypeSchema>;

interface PublishableEvent<T = any> {
  type: EventType;
  data: T;
  timestamp: Date;
}

interface BookmarkPublishableEvent<T = any> extends PublishableEvent<T> {
  bookmarkId: string;
}

export class EventBus {
  private bookmarkChannels: Map<string, RealtimeChannel> = new Map();

  constructor(private supabaseClient: SupabaseClient) {}

  /**
   * Get or create a channel for a specific bookmark
   */
  private getBookmarkChannel(bookmarkId: string): RealtimeChannel {
    const channelName = `bookmark:${bookmarkId}`;

    if (!this.bookmarkChannels.has(bookmarkId)) {
      const channel = this.supabaseClient.channel(channelName);
      this.bookmarkChannels.set(bookmarkId, channel);
    }

    return this.bookmarkChannels.get(bookmarkId)!;
  }

  /**
   * Publish an event to a bookmark-specific channel
   * Only users subscribed to this specific bookmark will receive the event
   */
  async publishToBookmark<T>(
    bookmarkId: string,
    type: EventType,
    data: T
  ): Promise<void> {
    const event: BookmarkPublishableEvent<T> = {
      bookmarkId,
      type,
      data,
      timestamp: new Date(),
    };

    try {
      console.log(`Publishing to bookmark:${bookmarkId}:`, event.type);
      const channel = this.getBookmarkChannel(bookmarkId);

      await channel.send({
        type: "broadcast",
        event: "update",
        payload: {
          bookmarkId,
          type: event.type,
          data: event.data,
          timestamp: event.timestamp.toISOString(),
        },
      });
    } catch (error) {
      console.error(`Failed to publish to bookmark:${bookmarkId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup a bookmark channel when processing is complete
   */
  async cleanupBookmarkChannel(bookmarkId: string): Promise<void> {
    const channel = this.bookmarkChannels.get(bookmarkId);
    if (channel) {
      await this.supabaseClient.removeChannel(channel);
      this.bookmarkChannels.delete(bookmarkId);
    }
  }

  /**
   * @deprecated Use publishToBookmark for bookmark-specific events
   * Publish to the global bookmarks channel (kept for backward compatibility)
   */
  async publish(
    type: EventType,
    data: LLMResponse | LLMResponsePart
  ): Promise<void> {
    await this.publishEvent<LLMResponse | LLMResponsePart>({
      type,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * @deprecated Use publishToBookmark for bookmark-specific events
   * Publish to the global bookmarks channel (kept for backward compatibility)
   */
  async publishEvent<T>(event: PublishableEvent<T>): Promise<void> {
    try {
      console.log("Publishing event:", event.type, event.data);
      await this.supabaseClient.channel("bookmarks").send({
        type: "broadcast",
        event: "update",
        payload: {
          type: event.type,
          data: event.data,
          timestamp: event.timestamp.toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to publish event:", error);
      throw error;
    }
  }
}
