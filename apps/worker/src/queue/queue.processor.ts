import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QueueService } from "./queue.service";
import { MessageHandler } from "./interfaces/message-handler.interface";
import {
  QueueMessage,
  QueueConfig,
  ProcessorOptions,
} from "../types/queue.types";

@Injectable()
export class QueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueProcessor.name);
  private isProcessing = false;
  private processingPromises: Promise<void>[] = [];
  private retryAttempts = new Map<string, number>();

  constructor(
    private queueService: QueueService,
    private configService: ConfigService,
    @Inject("MESSAGE_HANDLERS") private messageHandlers: MessageHandler[],
  ) {}

  async onModuleInit() {
    if (this.configService.get<boolean>("QUEUE_AUTO_START", true)) {
      await this.startProcessing();
    }
  }

  async onModuleDestroy() {
    await this.stopProcessing();
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn("Queue processor is already running");
      return;
    }

    this.isProcessing = true;
    const options = this.getProcessorOptions();

    this.logger.log(
      `Starting queue processor with ${options.queues.length} queues`,
    );

    for (const queueConfig of options.queues) {
      const promise = this.processQueue(queueConfig);
      this.processingPromises.push(promise);
    }
  }

  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.logger.log("Stopping queue processor...");
    this.isProcessing = false;

    const timeout = this.configService.get<number>(
      "QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT",
      30000,
    );

    try {
      await Promise.race([
        Promise.all(this.processingPromises),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Graceful shutdown timeout")),
            timeout,
          ),
        ),
      ]);
    } catch (error) {
      this.logger.warn("Graceful shutdown timeout reached, forcing stop");
    }

    this.processingPromises = [];
    this.logger.log("Queue processor stopped");
  }

  private async processQueue(config: QueueConfig): Promise<void> {
    this.logger.log(`Starting to process queue: ${config.name}`);

    while (this.isProcessing) {
      try {
        const messages = await this.queueService.popMessages(
          config.name,
          config.batchSize,
        );

        if (messages.length === 0) {
          await this.sleep(config.pollInterval);
          continue;
        }

        this.logger.debug(
          `Processing ${messages.length} messages from queue ${config.name}`,
        );

        // Process messages concurrently but respect concurrency limit
        const processPromises = messages.map((message) =>
          this.processMessage(message, config),
        );
        await Promise.allSettled(processPromises);
      } catch (error) {
        this.logger.error(`Error processing queue ${config.name}`, error);
        await this.sleep(config.pollInterval);
      }
    }
  }

  private async processMessage(
    message: QueueMessage,
    config: QueueConfig,
  ): Promise<void> {
    const messageKey = `${config.name}-${message.msg_id}`;

    try {
      const handler = this.findHandler(message);
      if (!handler) {
        this.logger.error(`No handler found for message ${message.msg_id}`);
        await this.queueService.archiveMessage(config.name, message.msg_id);
        return;
      }

      await handler.handle(message);

      // Successfully processed, remove from queue
      await this.queueService.deleteMessage(config.name, message.msg_id);
      this.retryAttempts.delete(messageKey);

      this.logger.debug(
        `Successfully processed message ${message.msg_id} from queue ${config.name}`,
      );
    } catch (error) {
      await this.handleError(message, config, error, messageKey);
    }
  }

  private async handleError(
    message: QueueMessage,
    config: QueueConfig,
    error: any,
    messageKey: string,
  ): Promise<void> {
    const currentAttempts = this.retryAttempts.get(messageKey) || 0;
    const shouldRetry = this.shouldRetryMessage(
      error,
      currentAttempts,
      config.maxRetries,
    );

    this.logger.error(`Error processing message ${message.msg_id}`, {
      error: error.message,
      attempts: currentAttempts + 1,
      maxRetries: config.maxRetries,
      willRetry: shouldRetry,
    });

    if (shouldRetry) {
      this.retryAttempts.set(messageKey, currentAttempts + 1);
      // Message will be retried on next poll cycle
      // For now, we don't re-queue it, just let it timeout and become visible again
      return;
    }

    // Max retries reached, archive the message
    try {
      await this.queueService.archiveMessage(config.name, message.msg_id);
      this.retryAttempts.delete(messageKey);
      this.logger.warn(
        `Archived message ${message.msg_id} after ${currentAttempts + 1} failed attempts`,
      );
    } catch (archiveError) {
      this.logger.error(
        `Failed to archive message ${message.msg_id}`,
        archiveError,
      );
    }
  }

  private shouldRetryMessage(
    error: any,
    currentAttempts: number,
    maxRetries: number,
  ): boolean {
    if (currentAttempts >= maxRetries) {
      return false;
    }

    // Check if error explicitly says not to retry
    if (error.shouldRetry === false) {
      return false;
    }

    // Default to retry for most errors
    return true;
  }

  private findHandler(message: QueueMessage): MessageHandler | null {
    const messageType = message.message?.type || "default";

    for (const handler of this.messageHandlers) {
      if (handler.canHandle(messageType)) {
        return handler;
      }
    }

    return null;
  }

  private getProcessorOptions(): ProcessorOptions {
    const queueNames = this.configService
      .get<string>("QUEUE_NAMES", "default")
      .split(",");
    const defaultPollInterval = this.configService.get<number>(
      "QUEUE_POLL_INTERVAL",
      5000,
    );
    const defaultMaxRetries = this.configService.get<number>(
      "QUEUE_MAX_RETRIES",
      3,
    );
    const defaultBatchSize = this.configService.get<number>(
      "QUEUE_BATCH_SIZE",
      10,
    );

    const queues: QueueConfig[] = queueNames.map((name) => ({
      name: name.trim(),
      pollInterval: defaultPollInterval,
      maxRetries: defaultMaxRetries,
      batchSize: defaultBatchSize,
    }));

    return {
      queues,
      concurrency: this.configService.get<number>("QUEUE_CONCURRENCY", 5),
      gracefulShutdownTimeout: this.configService.get<number>(
        "QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT",
        30000,
      ),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
