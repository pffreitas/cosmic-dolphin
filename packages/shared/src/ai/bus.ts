import { SupabaseClient } from "@supabase/supabase-js";
import { LLMResponse, LLMResponsePart } from "./types";
import { z } from "zod";

export const EventTypeSchema = z.enum([
  "session.started",
  "session.error",
  "message.updated",
  "tool.failed",
  "message.part.updated",
  "bookmark.updated",
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

export class EventBus {
  constructor(private supabaseClient: SupabaseClient) {}

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
