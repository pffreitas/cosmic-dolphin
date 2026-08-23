import { describe, expect, it } from "vitest";
import {
  getActivePhaseLabel,
  shouldRetryProcessingTimelineError,
  shouldPollProcessingTimeline,
} from "./useBookmarkProcessingTimeline";

describe("useBookmarkProcessingTimeline helpers", () => {
  it("polls only while the bookmark is processing", () => {
    expect(shouldPollProcessingTimeline({ processingStatus: "processing" })).toBe(
      true
    );
    expect(shouldPollProcessingTimeline({ processingStatus: "completed" })).toBe(
      false
    );
    expect(shouldPollProcessingTimeline({ processingStatus: "failed" })).toBe(
      false
    );
  });

  it("keeps polling while the server reports an active timeline", () => {
    expect(
      shouldPollProcessingTimeline(
        { processingStatus: "completed" },
        {
          pollAfterMs: 2000,
          events: [],
          run: {
            id: "run-1",
            bookmarkId: "bookmark-1",
            userId: "user-1",
            status: "running",
            startedAt: "2026-01-01T00:00:00Z",
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            reasoningTokens: 0,
            cachedInputTokens: 0,
          },
        } as any
      )
    ).toBe(true);
  });

  it("does not retry terminal timeline fetch errors", () => {
    expect(shouldRetryProcessingTimelineError({ statusCode: 401 })).toBe(false);
    expect(shouldRetryProcessingTimelineError({ statusCode: 403 })).toBe(false);
    expect(shouldRetryProcessingTimelineError({ statusCode: 404 })).toBe(false);
    expect(
      shouldRetryProcessingTimelineError(new Error("network unavailable"))
    ).toBe(true);
  });

  it("returns the current business phase label", () => {
    expect(
      getActivePhaseLabel([
        {
          kind: "phase",
          phase: "summarization",
          name: "Summarize content",
          status: "completed",
          sequence: 1,
        },
        {
          kind: "phase",
          phase: "embedding",
          name: "Embed content chunks",
          status: "running",
          sequence: 2,
        },
      ])
    ).toBe("Building semantic search");
  });
});
