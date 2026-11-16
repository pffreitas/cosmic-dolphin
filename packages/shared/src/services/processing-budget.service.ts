/**
 * The per-user daily processing budget: how many bookmarks a user may create
 * per UTC day and still have them queued for processing.
 *
 * The count is taken by `BookmarkRepository.createAndQueue` inside the
 * transaction that inserts and queues the bookmark, so a save counts whether
 * or not it was queued and a burst of saves crosses the limit at the right one.
 * Concurrent saves can overshoot by at most their own number; no lock is taken.
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
