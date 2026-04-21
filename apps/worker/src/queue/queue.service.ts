import { Injectable, Logger } from "@nestjs/common";
import { SupabaseClientService } from "./supabase-client.service";
import { QueueMessage } from "../types/queue.types";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private supabaseClient: SupabaseClientService) {}

  async popMessage(queueName: string): Promise<QueueMessage | null> {
    try {
      const { data, error } = await this.supabaseClient
        .getClient()
        .schema("pgmq_public")
        .rpc("pop", { queue_name: queueName });

      if (error) {
        this.logger.error(
          `Failed to pop message from queue ${queueName}`,
          error,
        );
        throw new Error(`Queue pop failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return null;
      }

      const message = data[0];
      return {
        msg_id: message.msg_id,
        read_ct: message.read_ct,
        enqueued_at: new Date(message.enqueued_at),
        vt: new Date(message.vt),
        message: message.message,
      };
    } catch (error) {
      this.logger.error(`Error popping message from queue ${queueName}`, error);
      throw error;
    }
  }

  async popMessages(queueName: string, count: number): Promise<QueueMessage[]> {
    // Use `read` instead of `pop` so messages stay in the queue with a visibility
    // timeout. If the worker crashes mid-processing they become visible again
    // automatically, enabling true retry. Explicit `deleteMessage` / `archiveMessage`
    // after processing removes them from the queue.
    const VISIBILITY_TIMEOUT_SECONDS = 300; // 5 min — enough for a full bookmark run
    try {
      const { data, error } = await this.supabaseClient
        .getClient()
        .schema("pgmq_public")
        .rpc("read", {
          queue_name: queueName,
          sleep_seconds: VISIBILITY_TIMEOUT_SECONDS,
          n: count,
        });

      if (error) {
        this.logger.error(
          `Failed to read messages from queue ${queueName}`,
          error,
        );
        throw new Error(`Queue read failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((msg: any) => ({
        msg_id: msg.msg_id,
        read_ct: msg.read_ct,
        enqueued_at: new Date(msg.enqueued_at),
        vt: new Date(msg.vt),
        message: msg.message,
      }));
    } catch (error) {
      this.logger.error(
        `Error reading messages from queue ${queueName}`,
        error,
      );
      throw error;
    }
  }

  async archiveMessage(queueName: string, msgId: number): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .getClient()
        .schema("pgmq_public")
        .rpc("archive", {
          queue_name: queueName,
          msg_id: msgId,
        });

      if (error) {
        this.logger.error(
          `Failed to archive message ${msgId} from queue ${queueName}`,
          error,
        );
        throw new Error(`Message archive failed: ${error.message}`);
      }

      this.logger.debug(`Archived message ${msgId} from queue ${queueName}`);
    } catch (error) {
      this.logger.error(
        `Error archiving message ${msgId} from queue ${queueName}`,
        error,
      );
      throw error;
    }
  }

  async deleteMessage(queueName: string, msgId: number): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .getClient()
        .schema("pgmq_public")
        .rpc("delete", {
          message_id: msgId,
          queue_name: queueName,
        });

      if (error) {
        this.logger.error(
          `Failed to delete message ${msgId} from queue ${queueName}`,
          error,
        );
        throw new Error(`Message delete failed: ${error.message}`);
      }

      this.logger.debug(`Deleted message ${msgId} from queue ${queueName}`);
    } catch (error) {
      this.logger.error(
        `Error deleting message ${msgId} from queue ${queueName}`,
        error,
      );
      throw error;
    }
  }

  async sendMessage(
    queueName: string,
    message: any,
    delaySeconds?: number,
  ): Promise<number> {
    try {
      const { data, error } = await this.supabaseClient
        .getClient()
        .schema("pgmq_public")
        .rpc("send", {
          queue_name: queueName,
          message: JSON.stringify(message),
          sleep_seconds: delaySeconds || 0,
        });

      if (error) {
        this.logger.error(
          `Failed to send message to queue ${queueName}`,
          error,
        );
        throw new Error(`Message send failed: ${error.message}`);
      }

      this.logger.debug(`Sent message to queue ${queueName}, msg_id: ${data}`);
      return data;
    } catch (error) {
      this.logger.error(`Error sending message to queue ${queueName}`, error);
      throw error;
    }
  }
}
