import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QueueService } from "./queue.service";
import type { MessageHandler } from "./interfaces/message-handler.interface";
import type {
  QueueMessage,
  QueueConfig,
  ProcessorOptions,
} from "../types/queue.types";

/** Wait before a retryable failure is delivered again, by delivery count (D-8). */
const RETRY_BACKOFF_SECONDS = [30, 120, 600];
const DEFAULT_POLL_INTERVAL_MS = 1000;

interface InFlightMessage {
  config: QueueConfig;
  message: QueueMessage;
  /** Returned to the queue at shutdown; its late result must not touch it. */
  released: boolean;
}

@Injectable()
export class QueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueProcessor.name);
  private isProcessing = false;
  private processingPromises: Promise<void>[] = [];
  private concurrency = 5;
  /** Slots promised to a read that has not returned yet. */
  private reserved = 0;
  private inFlight = new Map<string, InFlightMessage>();
  private inFlightPromises = new Set<Promise<void>>();
  private slotWaiters: Array<() => void> = [];
  private sleepers = new Set<() => void>();

  constructor(
    private queueService: QueueService,
    private configService: ConfigService,
    @Inject("MESSAGE_HANDLERS") private messageHandlers: MessageHandler[],
  ) {}

  async onModuleInit() {
    if (this.getBooleanConfig("QUEUE_AUTO_START", true)) {
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
    this.concurrency = options.concurrency;

    this.logger.log(
      `Starting queue processor with ${options.queues.length} queues, concurrency=${options.concurrency}`,
    );

    const configuredNames = options.queues.map((q) => q.name);
    if (!configuredNames.includes("bookmarks")) {
      this.logger.warn(
        `"bookmarks" queue is not in QUEUE_NAMES (${configuredNames.join(", ")}). Bookmark AI processing will not run.`,
      );
    }

    for (const queueConfig of options.queues) {
      this.processingPromises.push(this.processQueue(queueConfig));
    }
  }

  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.logger.log("Stopping queue processor...");
    this.isProcessing = false;
    for (const wake of [...this.sleepers]) wake();
    this.wakeSlotWaiters();

    const timeout = this.configService.get<number>(
      "QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT",
      30000,
    );

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([...this.processingPromises, ...this.inFlightPromises]),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Graceful shutdown timeout")),
            timeout,
          );
        }),
      ]);
    } catch (error) {
      this.logger.warn("Graceful shutdown timeout reached, forcing stop");
    } finally {
      clearTimeout(timer);
    }

    await this.releaseUnfinished();

    this.processingPromises = [];
    this.logger.log("Queue processor stopped");
  }

  /** Make every message still in flight readable at once by another worker. */
  private async releaseUnfinished(): Promise<void> {
    const unfinished = [...this.inFlight.values()];
    for (const entry of unfinished) entry.released = true;
    await Promise.all(
      unfinished.map(async ({ config, message }) => {
        try {
          await this.queueService.setVisibility(config.name, message.msg_id, 0);
        } catch (error) {
          this.logger.error(
            `Failed to release message ${message.msg_id} of queue ${config.name}`,
            error,
          );
        }
      }),
    );
  }

  private freeSlots(): number {
    return this.concurrency - this.inFlight.size - this.reserved;
  }

  /**
   * Keep every slot busy: read only as many messages as there are free slots,
   * start each as soon as it is read, and read again whenever a slot frees.
   */
  private async processQueue(config: QueueConfig): Promise<void> {
    this.logger.log(`Starting to process queue: ${config.name}`);

    while (this.isProcessing) {
      const free = this.freeSlots();
      if (free <= 0) {
        await this.waitForSlot();
        continue;
      }

      const count = Math.min(free, config.batchSize);
      this.reserved += count;
      let messages: QueueMessage[] = [];
      let failed = false;
      try {
        messages = await this.queueService.popMessages(config.name, count);
      } catch (error) {
        failed = true;
        this.logger.error(`Error processing queue ${config.name}`, error);
      } finally {
        this.reserved -= count;
      }

      if (failed || messages.length === 0) {
        if (this.isProcessing) await this.sleep(config.pollInterval);
        continue;
      }

      for (const message of messages) {
        this.startMessage(message, config);
      }
    }
  }

  private startMessage(message: QueueMessage, config: QueueConfig): void {
    const key = `${config.name}-${message.msg_id}`;
    this.inFlight.set(key, { config, message, released: false });
    const promise = this.processMessage(message, config)
      .catch((error) =>
        this.logger.error(`Unhandled error for message ${message.msg_id}`, error),
      )
      .finally(() => {
        this.inFlight.delete(key);
        this.inFlightPromises.delete(promise);
        this.wakeSlotWaiters();
      });
    this.inFlightPromises.add(promise);
  }

  private isReleased(message: QueueMessage, config: QueueConfig): boolean {
    return (
      this.inFlight.get(`${config.name}-${message.msg_id}`)?.released === true
    );
  }

  private async processMessage(
    message: QueueMessage,
    config: QueueConfig,
  ): Promise<void> {
    try {
      const handler = this.findHandler(message);
      if (!handler) {
        this.logger.error(`No handler found for message ${message.msg_id}`);
        await this.queueService.archiveMessage(config.name, message.msg_id);
        return;
      }

      // The last allowed run is read_ct = maxRetries + 1. A delivery past that
      // has already crashed the worker too often to be tried again: a crash
      // never reaches handleError, so pgmq would redeliver it forever.
      if (message.read_ct > config.maxRetries + 1) {
        this.logger.warn(
          `Message ${message.msg_id} was delivered ${message.read_ct} times; failing it without running`,
        );
        try {
          await handler.onExhausted?.(message);
        } catch (exhaustedError) {
          // The failure is not recorded, and archiving now would leave the
          // bookmark `processing` with no message to recover it. Keep the
          // message: pgmq redelivers it after the visibility timeout and only
          // this terminal write is retried.
          this.logger.error(
            `Failed to record exhaustion of message ${message.msg_id}; leaving it for redelivery`,
            exhaustedError,
          );
          return;
        }
        await this.queueService.archiveMessage(config.name, message.msg_id);
        return;
      }

      await handler.handle(message, {
        finalAttempt: message.read_ct > config.maxRetries,
      });

      // Successfully processed (or acknowledged by the handler), remove it
      if (this.isReleased(message, config)) return;
      await this.queueService.deleteMessage(config.name, message.msg_id);

      this.logger.debug(
        `Successfully processed message ${message.msg_id} from queue ${config.name}`,
      );
    } catch (error) {
      await this.handleError(message, config, error);
    }
  }

  private async handleError(
    message: QueueMessage,
    config: QueueConfig,
    error: any,
  ): Promise<void> {
    // pgmq owns the durable delivery count, so it survives deploys.
    // `read_ct` includes the current delivery.
    const deliveries = Math.max(1, message.read_ct || 1);
    const shouldRetry = this.shouldRetryMessage(
      error,
      deliveries - 1,
      config.maxRetries,
    );

    this.logger.error(`Error processing message ${message.msg_id}`, {
      error: error?.message,
      attempts: deliveries,
      maxRetries: config.maxRetries,
      willRetry: shouldRetry,
    });

    if (this.isReleased(message, config)) return;

    try {
      if (shouldRetry) {
        const delay =
          RETRY_BACKOFF_SECONDS[
            Math.min(deliveries, RETRY_BACKOFF_SECONDS.length) - 1
          ];
        await this.queueService.setVisibility(
          config.name,
          message.msg_id,
          delay,
        );
        return;
      }

      await this.queueService.archiveMessage(config.name, message.msg_id);
      this.logger.warn(
        `Archived message ${message.msg_id} after ${deliveries} failed attempts`,
      );
    } catch (dispositionError) {
      // The message stays under its visibility timeout and reappears.
      this.logger.error(
        `Failed to dispose of message ${message.msg_id}`,
        dispositionError,
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
    if (error?.shouldRetry === false) {
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
      .get<string>("QUEUE_NAMES", "bookmarks,digests")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const defaultPollInterval = this.getPositiveIntegerConfig(
      "QUEUE_POLL_INTERVAL",
      DEFAULT_POLL_INTERVAL_MS,
    );
    const defaultMaxRetries = this.getPositiveIntegerConfig(
      "QUEUE_MAX_RETRIES",
      3,
    );
    const defaultBatchSize = this.getPositiveIntegerConfig(
      "QUEUE_BATCH_SIZE",
      10,
    );

    const queues: QueueConfig[] = queueNames.map((name) => ({
      name,
      pollInterval: defaultPollInterval,
      maxRetries: defaultMaxRetries,
      batchSize: defaultBatchSize,
    }));

    return {
      queues,
      concurrency: this.getPositiveIntegerConfig("QUEUE_CONCURRENCY", 5),
      gracefulShutdownTimeout: this.getPositiveIntegerConfig(
        "QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT",
        30000,
      ),
    };
  }

  private getBooleanConfig(name: string, fallback: boolean): boolean {
    const value = this.configService.get<string | boolean>(name);
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return fallback;

    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    return fallback;
  }

  private getPositiveIntegerConfig(name: string, fallback: number): number {
    const value = this.configService.get<string | number>(name);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  /** Sleep, but wake at once when the processor is asked to stop. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.sleepers.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, ms);
      this.sleepers.add(wake);
    });
  }

  private waitForSlot(): Promise<void> {
    return new Promise((resolve) => this.slotWaiters.push(resolve));
  }

  private wakeSlotWaiters(): void {
    const waiters = this.slotWaiters;
    this.slotWaiters = [];
    for (const wake of waiters) wake();
  }
}
