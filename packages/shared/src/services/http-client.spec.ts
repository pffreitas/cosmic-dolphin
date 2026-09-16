import { describe, expect, test } from "bun:test";
import { calculateHttpRetryDelay } from "./http-client";

describe("HTTP retry delay", () => {
  test("does not override Got's terminal status or exhausted-limit decision", () => {
    expect(
      calculateHttpRetryDelay({ attemptCount: 1, computedValue: 0 }),
    ).toBe(0);
    expect(
      calculateHttpRetryDelay({ attemptCount: 101, computedValue: 0 }),
    ).toBe(0);
  });

  test("backs off retryable failures with a ten-second cap", () => {
    const firstDelay = calculateHttpRetryDelay({
      attemptCount: 1,
      computedValue: 1000,
    });
    expect(firstDelay).toBeGreaterThanOrEqual(1000);
    expect(firstDelay).toBeLessThan(2000);

    expect(
      calculateHttpRetryDelay({
        attemptCount: 20,
        computedValue: 10000,
      }),
    ).toBe(10000);
  });
});
