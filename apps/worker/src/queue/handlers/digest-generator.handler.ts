import { Injectable, Logger, Inject } from "@nestjs/common";
import { DigestQueuePayload, DigestService } from "@cosmic-dolphin/shared";
import { MessageHandler } from "../interfaces/message-handler.interface";
import { QueueMessage } from "../../types/queue.types";
import { DIGEST_SERVICE } from "../tokens";

/**
 * The digest generation job.
 *
 * An ordinary message handler, which is the whole design: the scheduled tick
 * enqueues, this drains, and everything between — the visibility timeout, the
 * retries, the archive on give-up — is the machinery every other job already
 * uses.
 *
 * **A run that produces no digest is a success.** `skipped` is the common
 * outcome, not the error path: most fortnights of reading do not contain a
 * coherent cluster, and throwing on one would put a healthy job into retry and
 * then into the archive. The reason is logged so an operator can tell "this
 * person saves unrelated things" from "the model refused".
 */
@Injectable()
export class DigestGeneratorHandler implements MessageHandler {
  private readonly logger = new Logger(DigestGeneratorHandler.name);

  constructor(
    @Inject(DIGEST_SERVICE)
    private readonly digestService: DigestService,
  ) {}

  canHandle(messageType: string): boolean {
    return messageType === "digest_generate";
  }

  async handle(message: QueueMessage): Promise<void> {
    const payload = message.message as DigestQueuePayload;

    if (!payload?.data?.userId) {
      throw new Error("Invalid digest payload: no userId");
    }

    const { userId, scheduledAt } = payload.data;

    // The window is measured from when the tick fired, not from when the
    // message was picked up. A queue backlog must not silently widen "the last
    // 14 days" into the last 16.
    const now = scheduledAt ? new Date(scheduledAt) : new Date();
    const at = Number.isNaN(now.getTime()) ? new Date() : now;

    const result = await this.digestService.generateForUser(userId, { now: at });

    if (result.outcome === "created") {
      this.logger.log(`Digest created for user ${userId}`, {
        digestId: result.digest.id,
        sources: result.digest.sources.length,
        coherence: result.digest.coherence,
      });
      return;
    }

    this.logger.log(`No digest for user ${userId}`, {
      reason: result.reason,
      coherence: result.coherence,
      clusterSize: result.clusterSize,
    });
  }

  getMessageType(): string {
    return "digest";
  }
}
