import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ReadingProgressTracker,
  percentFromScroll,
} from "@/lib/reading/progress";

/**
 * The "at most once per 5 seconds per bookmark" half of D8's definition of
 * done. The other half — a lower percent is refused — is enforced in SQL and
 * tested in `packages/shared`; this is about volume, which is a client
 * property and only testable here.
 */
describe("ReadingProgressTracker", () => {
  let now = 0;
  let writes: { percent: number; scrollOffset: number | null }[];
  let tracker: ReadingProgressTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000_000;
    writes = [];
    tracker = new ReadingProgressTracker({
      write: async (percent, scrollOffset) => {
        writes.push({ percent, scrollOffset });
      },
      now: () => now,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(ms: number) {
    now += ms;
    vi.advanceTimersByTime(ms);
  }

  it("writes once for a burst of scroll events, then not again inside 5s", async () => {
    // A real scroll produces this many events in well under a second.
    for (let i = 1; i <= 40; i++) {
      tracker.record(i, i * 30);
    }
    await vi.advanceTimersByTimeAsync(0);

    // Leading edge: the first record goes immediately, so opening an article
    // and reading a paragraph is recorded rather than waiting five seconds.
    expect(writes).toHaveLength(1);
    expect(writes[0].percent).toBe(1);

    advance(4_000);
    tracker.record(50, 2_000);
    await vi.advanceTimersByTimeAsync(0);

    // Still inside the window.
    expect(writes).toHaveLength(1);
  });

  it("sends the latest pending value once the window is up", async () => {
    tracker.record(10, 100);
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(1);

    tracker.record(20, 200);
    tracker.record(30, 300);
    tracker.record(40, 400);

    await vi.advanceTimersByTimeAsync(5_000);
    now += 5_000;

    // One write for the whole window, carrying the newest position — not the
    // first one seen after the window opened.
    expect(writes).toHaveLength(2);
    expect(writes[1]).toEqual({ percent: 40, scrollOffset: 400 });
  });

  it("never sends a percent lower than the one already sent", async () => {
    tracker.record(60, 3_000);
    await vi.advanceTimersByTimeAsync(0);

    advance(10_000);
    // The reader scrolled back up to re-read something. They have not un-read
    // it, and the server would refuse the value anyway — so do not spend a
    // request finding that out.
    tracker.record(20, 800);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(writes).toHaveLength(1);
    expect(writes[0].percent).toBe(60);
  });

  it("flushes the last position on unmount, throttle or no throttle", async () => {
    tracker.record(10, 100);
    await vi.advanceTimersByTimeAsync(0);

    advance(1_000);
    tracker.record(35, 900);

    // The reader navigated away one second later. Without this the position
    // they actually stopped at — the only one that matters — is dropped.
    await tracker.flush();

    expect(writes).toHaveLength(2);
    expect(writes[1].percent).toBe(35);
  });

  it("does not write again after stop()", async () => {
    tracker.record(10, 100);
    await vi.advanceTimersByTimeAsync(0);
    await tracker.stop();

    const before = writes.length;
    tracker.record(90, 5_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(writes).toHaveLength(before);
  });

  it("swallows a failed write instead of interrupting the reader", async () => {
    const errors: unknown[] = [];
    const failing = new ReadingProgressTracker({
      write: async () => {
        throw new Error("network");
      },
      now: () => now,
      onError: (error) => errors.push(error),
    });

    failing.record(10, 100);
    await vi.advanceTimersByTimeAsync(0);

    expect(errors).toHaveLength(1);
  });
});

describe("percentFromScroll", () => {
  it("counts the bottom of the viewport, not the top", () => {
    // Half way down a document twice the viewport's height means the reader
    // has seen three quarters of it.
    expect(percentFromScroll(400, 800, 1600)).toBe(75);
  });

  it("is 100 when the whole document fits on screen", () => {
    expect(percentFromScroll(0, 800, 500)).toBe(100);
  });

  it("clamps rather than overshooting on elastic scroll", () => {
    expect(percentFromScroll(2_000, 800, 1_600)).toBe(100);
  });
});
