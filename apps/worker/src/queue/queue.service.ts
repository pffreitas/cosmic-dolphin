import { Inject, Injectable, Logger } from "@nestjs/common";
import { Kysely } from "kysely";
import {
  Database,
  PgmqRepository,
  PgmqRepositoryImpl,
  QUEUE_VISIBILITY_TIMEOUT_SECONDS,
} from "@cosmic-dolphin/shared";
import { QueueMessage } from "../types/queue.types";
import { DATABASE_INSTANCE } from "./tokens";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly pgmq: PgmqRepository;

  constructor(@Inject(DATABASE_INSTANCE) db: Kysely<Database>) {
    this.pgmq = new PgmqRepositoryImpl(db);
  }

  // `read`, not `pop`: a message stays in the queue under a visibility timeout,
  // so a crashed worker's message reappears. `deleteMessage` / `archiveMessage`
  // remove it after processing.
  async popMessages(queueName: string, count: number): Promise<QueueMessage[]> {
    try {
      return (await this.pgmq.read(
        queueName,
        QUEUE_VISIBILITY_TIMEOUT_SECONDS,
        count,
      )) as QueueMessage[];
    } catch (error) {
      this.logger.error(`Error reading messages from queue ${queueName}`, error);
      throw error;
    }
  }

  async archiveMessage(queueName: string, msgId: number): Promise<void> {
    try {
      await this.pgmq.archive(queueName, msgId);
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
      await this.pgmq.delete(queueName, msgId);
      this.logger.debug(`Deleted message ${msgId} from queue ${queueName}`);
    } catch (error) {
      this.logger.error(
        `Error deleting message ${msgId} from queue ${queueName}`,
        error,
      );
      throw error;
    }
  }

  async setVisibility(
    queueName: string,
    msgId: number,
    seconds: number,
  ): Promise<void> {
    try {
      await this.pgmq.setVisibility(queueName, msgId, seconds);
    } catch (error) {
      this.logger.error(
        `Error setting visibility of message ${msgId} in queue ${queueName}`,
        error,
      );
      throw error;
    }
  }

  async sendMessage(
    queueName: string,
    message: object,
    delaySeconds?: number,
  ): Promise<number> {
    try {
      const id = await this.pgmq.send(queueName, message, delaySeconds || 0);
      this.logger.debug(`Sent message to queue ${queueName}, msg_id: ${id}`);
      return id;
    } catch (error) {
      this.logger.error(`Error sending message to queue ${queueName}`, error);
      throw error;
    }
  }
}
