import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  DEFAULT_DIGEST_CONFIG,
  DigestQueuePayload,
  DigestRepository,
} from "@cosmic-dolphin/shared";
import { QueueService } from "../queue/queue.service";
import { DIGEST_REPOSITORY } from "../queue/tokens";

/**
 * The per-user digest schedule — docs/plans/signal-revamp-plan.md, open
 * decision 1.
 *
 * The worker had no scheduler: it is a pgmq poll loop. The decision taken was
 * `@nestjs/schedule` **inside this worker, enqueueing onto pgmq**, so that the
 * job path stays identical to every other job in the product. That shape is
 * the point, and it is worth stating what it buys:
 *
 *  - **The tick enqueues; it never generates.** Everything below this class is
 *    the ordinary message path — the same poll loop, the same visibility
 *    timeout, the same retry and archive behaviour, the same handler
 *    dispatch. A scheduler that did the work itself would be a second
 *    execution path with none of that, and the first slow model call would
 *    block the tick.
 *  - **No second broker.** The conventions forbid one, and rightly: two
 *    delivery systems is two sets of failure modes for one product.
 *  - **The tick is cheap and bounded.** One indexed query, one message per
 *    user who has actually saved something, capped at `maxUsersPerTick`. It
 *    never walks the user table.
 *
 * The clock is `DIGEST_CRON`, defaulting to 06:00 daily. Read from the
 * environment at class-definition time because that is when the decorator
 * runs; the worker is started with its env file loaded, so it is there.
 */
@Injectable()
export class DigestSchedulerService {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    @Inject(DIGEST_REPOSITORY)
    private readonly digestRepository: DigestRepository,
  ) {}

  @Cron(process.env.DIGEST_CRON || CronExpression.EVERY_DAY_AT_6AM, {
    name: "digest-generation",
  })
  async tick(): Promise<void> {
    if (!this.enabled()) {
      this.logger.debug("Digest scheduler disabled, skipping tick");
      return;
    }

    await this.enqueueDue();
  }

  /**
   * Public and separate from the cron entry point so it can be triggered by
   * hand, and so the decorator is the only thing the schedule owns.
   */
  async enqueueDue(now: Date = new Date()): Promise<number> {
    const config = DEFAULT_DIGEST_CONFIG;
    const dayMs = 24 * 60 * 60 * 1000;

    try {
      const userIds = await this.digestRepository.findUsersDueForDigest({
        since: new Date(now.getTime() - config.windowDays * dayMs),
        minSaves: config.minSavesForJob,
        cooldownSince: new Date(
          now.getTime() - config.userCooldownDays * dayMs,
        ),
        limit: config.maxUsersPerTick,
      });

      if (userIds.length === 0) {
        this.logger.log("Digest tick: nobody due");
        return 0;
      }

      let enqueued = 0;
      for (const userId of userIds) {
        const payload: DigestQueuePayload = {
          type: "digest_generate",
          data: { userId, scheduledAt: now.toISOString() },
          metadata: { source: "scheduler", priority: "low" },
        };

        try {
          await this.queueService.sendMessage(DIGEST_QUEUE_NAME, payload);
          enqueued += 1;
        } catch (error) {
          // One user's message failing must not cost the rest of the tick.
          // The next tick will find them again — the cooldown check means a
          // missed day is a late digest, not a lost one.
          this.logger.error(
            `Failed to enqueue digest job for user ${userId}`,
            error,
          );
        }
      }

      this.logger.log(
        `Digest tick: enqueued ${enqueued}/${userIds.length} jobs`,
      );
      return enqueued;
    } catch (error) {
      this.logger.error("Digest tick failed", error);
      return 0;
    }
  }

  private enabled(): boolean {
    return this.configService.get<string>("DIGEST_SCHEDULER_ENABLED", "true") !==
      "false";
  }
}

/**
 * Its own queue, not `bookmarks`.
 *
 * Same broker, same message shape, same poll loop — but a backlog of link
 * processing must not delay digest generation, and a slow model call on a
 * six-document cluster must not sit in front of somebody's freshly saved link.
 */
export const DIGEST_QUEUE_NAME = "digests";
