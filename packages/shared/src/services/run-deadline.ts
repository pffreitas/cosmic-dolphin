/** A run must end before the queue's 300 s visibility timeout redelivers it. */
export const DEFAULT_RUN_DEADLINE_MS = 240_000;

/** The run deadline in milliseconds; `RUN_DEADLINE_MS` overrides it (tests). */
export function runDeadlineMs(): number {
  const parsed = Number(process.env.RUN_DEADLINE_MS);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RUN_DEADLINE_MS;
}

/**
 * A run that was aborted — by its deadline, or by the worker shutting down —
 * rather than failing on its own. The message goes back to the queue.
 */
export class RunDeadlineError extends Error {
  readonly shouldRetry = true;

  constructor(message = "Run stopped before it finished") {
    super(message);
    this.name = "RunDeadlineError";
  }
}

export interface RunDeadline {
  signal: AbortSignal;
  /** Stop the timer; call when the run ends so nothing keeps the process alive. */
  dispose(): void;
}

/** One signal for a whole run: its deadline combined with an optional outer one. */
export function createRunDeadline(outer?: AbortSignal): RunDeadline {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), runDeadlineMs());
  return {
    signal: outer
      ? AbortSignal.any([controller.signal, outer])
      : controller.signal,
    dispose: () => clearTimeout(timer),
  };
}
