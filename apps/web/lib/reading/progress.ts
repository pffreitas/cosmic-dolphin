import { PROGRESS_WRITE_INTERVAL_MS } from "@/lib/reading/constants";

/**
 * The client half of reading progress.
 *
 * A scroll handler fires dozens of times a second and reading progress is the
 * one thing in this product a client writes on a timer, so the throttle lives
 * here: **the cheapest write is the one never sent**. The server is idempotent
 * and monotonic besides — a lower percent is refused in SQL, not trusted — but
 * that is a correctness guarantee, not a volume one. This is the volume one.
 *
 * Three rules, all of them there because of a specific way this goes wrong:
 *
 *  - **At most one write per `PROGRESS_WRITE_INTERVAL_MS`.** Leading edge, so
 *    opening an article and reading a paragraph records something immediately
 *    rather than five seconds later.
 *
 *  - **A trailing write, always.** A reader who scrolls and then stops would
 *    otherwise have their last position dropped by the throttle — the position
 *    that matters most, because it is where they stopped.
 *
 *  - **Never send a percent lower than the one already sent.** The server would
 *    refuse it anyway; sending it spends a request to be told so, and makes the
 *    "did my write land" question harder to answer than it needs to be.
 *
 * `flush()` is for unmount and for `visibilitychange` — the reader (D10) calls
 * it when the page goes away, and it bypasses the throttle because there will
 * be no later tick to carry the value.
 */

export type ProgressWriter = (
  percent: number,
  scrollOffset: number | null
) => Promise<unknown>;

export interface ReadingProgressTrackerOptions {
  /** What actually sends the write. Injected so this is testable and so the reader can swap in an optimistic store. */
  write: ProgressWriter;
  /** Defaults to the 5 seconds the API contract names. */
  intervalMs?: number;
  /** Injected for tests; defaults to `Date.now`. */
  now?: () => number;
  /** Reported rather than thrown: a dropped progress write is not worth interrupting a reader for. */
  onError?: (error: unknown) => void;
}

export class ReadingProgressTracker {
  private readonly intervalMs: number;
  private readonly now: () => number;

  private lastSentAt = 0;
  private lastSentPercent = -1;

  private pending: { percent: number; scrollOffset: number | null } | null =
    null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly options: ReadingProgressTrackerOptions) {
    this.intervalMs = options.intervalMs ?? PROGRESS_WRITE_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Called as often as the reader likes — on every scroll frame, if that is
   * convenient. Returns immediately; whether anything is sent is this class's
   * business.
   */
  record(percent: number, scrollOffset: number | null = null): void {
    if (this.stopped) return;

    const clamped = clampPercent(percent);

    // Monotonic on the client too. Not a duplicate of the server's guard — the
    // server's exists because clients cannot be trusted, this one exists so a
    // trustworthy client does not waste a request being corrected.
    if (clamped <= this.lastSentPercent && this.pending === null) return;
    if (this.pending && clamped <= this.pending.percent) return;

    this.pending = { percent: clamped, scrollOffset };

    const elapsed = this.now() - this.lastSentAt;
    if (elapsed >= this.intervalMs) {
      void this.send();
      return;
    }

    this.scheduleTrailing(this.intervalMs - elapsed);
  }

  /**
   * Send whatever is pending right now, ignoring the throttle.
   *
   * For unmount, route changes and `visibilitychange`. The last position is
   * the one worth having, and there is no later tick to carry it.
   */
  async flush(): Promise<void> {
    this.clearTimer();
    if (!this.pending) return;
    await this.send();
  }

  /** Flush and refuse further work. Safe to call twice. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    await this.flush();
    this.stopped = true;
    this.clearTimer();
  }

  private scheduleTrailing(delay: number): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.send();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private async send(): Promise<void> {
    const payload = this.pending;
    if (!payload) return;

    this.pending = null;
    this.lastSentAt = this.now();
    this.lastSentPercent = payload.percent;

    try {
      await this.options.write(payload.percent, payload.scrollOffset);
    } catch (error) {
      // Deliberately not retried and not re-thrown. Progress is advisory, the
      // next tick carries a newer value anyway, and a reader should never see
      // a toast because a bookkeeping write failed.
      this.options.onError?.(error);
    }
  }
}

/**
 * Percent from a scroll position over the reader's own height.
 *
 * Measured against the element, not the window: the reader is one column in a
 * page that also has a hero, a brief and a comment thread, and counting those
 * would report a reader as finished before they reached the article.
 */
export function percentFromScroll(
  scrollTop: number,
  viewportHeight: number,
  contentHeight: number
): number {
  const scrollable = contentHeight - viewportHeight;
  // Content shorter than the viewport is entirely on screen; there is nothing
  // to scroll and nothing partial about having seen it.
  if (scrollable <= 0) return 100;
  return clampPercent(((scrollTop + viewportHeight) / contentHeight) * 100);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
