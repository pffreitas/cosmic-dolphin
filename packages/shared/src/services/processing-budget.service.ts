import { BookmarkProcessingRepository } from "../repositories/bookmark-processing.repository";

/**
 * The per-user daily processing budget.
 *
 * docs/functional-spec/03-ai-pipeline.md § Cost: the pipeline is the expensive
 * half of the product, and a runaway import or a stuck client can spend a
 * month of model budget in an afternoon. This is enforced **before enqueue**,
 * not inside the worker — a job that will be refused should never reach the
 * queue at all.
 *
 * Over budget, the save still succeeds. The bookmark lands with
 * `processing_status = 'idle'` and the row offers **Summarise now**, which is
 * an explicit request the user made and is therefore not refused: the budget
 * exists to stop the machine spending on its own, not to stop a person asking
 * for one thing.
 *
 * This is deliberately not the same mechanism as `plugins/rate-limit.ts`. That
 * one shapes HTTP traffic and lives in an in-process LRU; this one counts
 * durable work in the database, so it is exact across replicas and survives a
 * restart. Both express their limits as configuration with an env override, so
 * a limit can be raised for an incident without a deploy.
 */

export interface ProcessingBudgetDecision {
  withinBudget: boolean;
  /** Runs started in the current window. */
  used: number;
  limit: number;
  /** When the window rolls over. UTC midnight. */
  resetsAt: Date;
}

export interface ProcessingBudgetService {
  check(userId: string): Promise<ProcessingBudgetDecision>;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const DEFAULT_DAILY_PROCESSING_BUDGET = 200;

export function dailyProcessingBudget(): number {
  return envInt("PROCESSING_BUDGET_DAILY", DEFAULT_DAILY_PROCESSING_BUDGET);
}

/** Start of the current UTC day. The window every user shares. */
export function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function nextUtcDay(now: Date): Date {
  const start = startOfUtcDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export class ProcessingBudgetServiceImpl implements ProcessingBudgetService {
  constructor(
    private repository: BookmarkProcessingRepository,
    private limit: number = dailyProcessingBudget(),
    private now: () => Date = () => new Date()
  ) {}

  async check(userId: string): Promise<ProcessingBudgetDecision> {
    const now = this.now();
    const resetsAt = nextUtcDay(now);

    if (this.limit <= 0) {
      // A zero budget means "processing is off", which is a legitimate
      // configuration and must not be read as "unlimited".
      return { withinBudget: false, used: 0, limit: this.limit, resetsAt };
    }

    const used = await this.repository.countRunsSince(
      userId,
      startOfUtcDay(now)
    );

    return { withinBudget: used < this.limit, used, limit: this.limit, resetsAt };
  }
}
