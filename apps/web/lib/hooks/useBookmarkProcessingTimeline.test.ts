import { describe, expect, it } from "vitest";
import {
  deriveProcessingSteps,
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

  it("labels the running phase from the vocabulary the checklist renders", () => {
    expect(
      getActivePhaseLabel([
        {
          kind: "phase",
          phase: "extract",
          name: "Extract content",
          status: "completed",
          sequence: 1,
        },
        {
          kind: "phase",
          phase: "summarise",
          name: "Summarise content",
          status: "running",
          sequence: 2,
        },
      ])
    ).toBe("Summarising…");
  });

  it("falls back to the event's own name for a phase the UI does not surface", () => {
    // `embed` has no line in the checklist, so there is no label to look up.
    expect(
      getActivePhaseLabel([
        {
          kind: "phase",
          phase: "embed",
          name: "Embed content chunks",
          status: "running",
          sequence: 1,
        },
      ])
    ).toBe("Embed content chunks");
  });
});

describe("deriveProcessingSteps", () => {
  it("renders five lines, filling unreached phases in as pending", () => {
    const steps = deriveProcessingSteps([
      {
        kind: "phase",
        phase: "fetch",
        name: "Fetch page",
        status: "completed",
        sequence: 2,
      },
      {
        kind: "phase",
        phase: "extract",
        name: "Extract content",
        status: "running",
        sequence: 3,
      },
    ]);

    expect(steps).toEqual([
      { phase: "fetch", state: "done", error: undefined },
      { phase: "extract", state: "active", error: undefined },
      { phase: "summarise", state: "pending", error: undefined },
      { phase: "tag", state: "pending", error: undefined },
      { phase: "file", state: "pending", error: undefined },
    ]);
  });

  it("shows a failed phase without hiding the phases that succeeded after it", () => {
    // Partial failure is normal: summarise broke, tagging and filing did not.
    const steps = deriveProcessingSteps([
      { kind: "phase", phase: "fetch", name: "f", status: "completed", sequence: 2 },
      { kind: "phase", phase: "extract", name: "e", status: "completed", sequence: 3 },
      {
        kind: "phase",
        phase: "summarise",
        name: "s",
        status: "failed",
        sequence: 4,
        error: "model unavailable",
      },
      { kind: "phase", phase: "tag", name: "t", status: "completed", sequence: 5 },
      { kind: "phase", phase: "file", name: "c", status: "completed", sequence: 6 },
    ]);

    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "failed",
      "done",
      "done",
    ]);
    expect(steps[2].error).toBe("model unavailable");
  });

  it("takes the last event for a phase, because a retry appends", () => {
    const steps = deriveProcessingSteps([
      {
        kind: "phase",
        phase: "summarise",
        name: "s",
        status: "failed",
        sequence: 4,
        error: "model unavailable",
      },
      { kind: "phase", phase: "summarise", name: "s", status: "completed", sequence: 7 },
    ]);

    expect(steps[2]).toEqual({
      phase: "summarise",
      state: "done",
      error: undefined,
    });
  });

  it("ignores run and turn spans, and the unsurfaced embed phase", () => {
    const steps = deriveProcessingSteps([
      { kind: "run", name: "Processing run", status: "running", sequence: 1 },
      {
        kind: "turn",
        phase: "summarise",
        name: "Generate summary",
        status: "failed",
        sequence: 5,
        error: "should not surface",
      },
      { kind: "phase", phase: "embed", name: "Embed", status: "failed", sequence: 6 },
      { kind: "phase", phase: "fetch", name: "Fetch", status: "completed", sequence: 2 },
    ]);

    expect(steps).toHaveLength(5);
    expect(steps.map((step) => step.phase)).not.toContain("embed");
    expect(steps[2].state).toBe("pending");
  });

  it("renders nothing when no run has started", () => {
    // A save the daily budget refused, or a private link. Five grey lines
    // would promise work that is not happening.
    expect(deriveProcessingSteps([], { processingStatus: "idle" } as any)).toEqual(
      []
    );
    expect(deriveProcessingSteps([], { processingStatus: "processing" } as any))
      .toHaveLength(5);
  });
});
