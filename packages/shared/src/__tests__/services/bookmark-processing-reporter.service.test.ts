import { describe, it, expect, jest } from "@jest/globals";
import {
  BookmarkProcessingReporter,
  mapBookmarkProcessingPhase,
} from "../../services/bookmark-processing-reporter.service";
import { BookmarkProcessingRepository } from "../../repositories/bookmark-processing.repository";

function createMockRepository(): jest.Mocked<BookmarkProcessingRepository> {
  let runCounter = 0;
  let eventCounter = 0;

  return {
    createRun: jest.fn(async (data) => ({
      id: `run-${++runCounter}`,
      bookmarkId: data.bookmarkId,
      userId: data.userId,
      status: data.status,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      durationMs: data.durationMs,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      costUsd: undefined,
      error: undefined,
      createdAt: data.startedAt,
      updatedAt: data.startedAt,
    })),
    updateRun: jest.fn(async (id, data) => ({
      id,
      bookmarkId: "bookmark-1",
      userId: "user-1",
      status: data.status ?? "running",
      startedAt: new Date("2026-06-21T10:00:00.000Z"),
      endedAt: data.endedAt,
      durationMs: data.durationMs,
      inputTokens: data.inputTokens ?? 0,
      outputTokens: data.outputTokens ?? 0,
      totalTokens: data.totalTokens ?? 0,
      reasoningTokens: data.reasoningTokens ?? 0,
      cachedInputTokens: data.cachedInputTokens ?? 0,
      costUsd: data.costUsd ?? undefined,
      error: data.error ?? undefined,
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
      updatedAt: data.endedAt ?? new Date("2026-06-21T10:00:00.000Z"),
    })),
    createEvent: jest.fn(async (data) => ({
      id: `event-${++eventCounter}`,
      runId: data.runId,
      parentEventId: data.parentEventId,
      kind: data.kind,
      phase: data.phase,
      name: data.name,
      status: data.status,
      sequence: data.sequence,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      durationMs: data.durationMs,
      modelId: data.modelId,
      inputTokens: data.inputTokens ?? 0,
      outputTokens: data.outputTokens ?? 0,
      totalTokens: data.totalTokens ?? 0,
      reasoningTokens: data.reasoningTokens ?? 0,
      cachedInputTokens: data.cachedInputTokens ?? 0,
      costUsd: data.costUsd ?? undefined,
      providerMetadata: data.providerMetadata,
      metadata: data.metadata,
      error: data.error ?? undefined,
      createdAt: data.startedAt,
      updatedAt: data.startedAt,
    })),
    updateEvent: jest.fn(async (id, data) => ({
      id,
      runId: "run-1",
      kind: "phase",
      phase: "summarise",
      name: "Summarise content",
      status: data.status ?? "running",
      sequence: 1,
      startedAt: new Date("2026-06-21T10:00:00.000Z"),
      endedAt: data.endedAt,
      durationMs: data.durationMs,
      modelId: data.modelId,
      inputTokens: data.inputTokens ?? 0,
      outputTokens: data.outputTokens ?? 0,
      totalTokens: data.totalTokens ?? 0,
      reasoningTokens: data.reasoningTokens ?? 0,
      cachedInputTokens: data.cachedInputTokens ?? 0,
      costUsd: data.costUsd ?? undefined,
      providerMetadata: data.providerMetadata,
      metadata: data.metadata,
      error: data.error ?? undefined,
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
      updatedAt: data.endedAt ?? new Date("2026-06-21T10:00:00.000Z"),
    })),
    findLatestTimeline: jest.fn(async () => null),
    countRunsSince: jest.fn(async () => 0),
  };
}

describe("BookmarkProcessingReporter", () => {
  it("tracks a phase with a child turn and aggregates usage into the run", async () => {
    const repository = createMockRepository();
    const clockValues = [
      new Date("2026-06-21T10:00:00.000Z"),
      new Date("2026-06-21T10:00:01.000Z"),
      new Date("2026-06-21T10:00:02.000Z"),
      new Date("2026-06-21T10:00:04.000Z"),
      new Date("2026-06-21T10:00:05.000Z"),
      new Date("2026-06-21T10:00:06.000Z"),
    ];
    const reporter = new BookmarkProcessingReporter(repository, () => {
      const value = clockValues.shift();
      if (!value) throw new Error("clock exhausted");
      return value;
    });

    await reporter.startRun("bookmark-1", "user-1");
    await reporter.trackPhase("summarise", "Summarise content", async (phase) => {
      await phase.trackTurn("Generate summary", "model-large", async () => ({
        value: "summary",
        usage: {
          inputTokens: 10,
          outputTokens: 15,
          totalTokens: 25,
          reasoningTokens: 2,
          cachedInputTokens: 4,
          costUsd: "0.00037",
          providerMetadata: { openrouter: { usage: { cost: 0.00037 } } },
        },
      }));
    });
    await reporter.completeRun();

    expect(repository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "run",
        sequence: 1,
      })
    );
    expect(repository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        parentEventId: "event-1",
        kind: "phase",
        phase: "summarise",
        sequence: 2,
      })
    );
    expect(repository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        parentEventId: "event-2",
        kind: "turn",
        phase: "summarise",
        sequence: 3,
        modelId: "model-large",
      })
    );
    expect(repository.updateEvent).toHaveBeenCalledWith(
      "event-3",
      expect.objectContaining({
        status: "completed",
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        costUsd: "0.00037",
      })
    );
    expect(repository.updateRun).toHaveBeenLastCalledWith(
      "run-1",
      expect.objectContaining({
        status: "completed",
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        reasoningTokens: 2,
        cachedInputTokens: 4,
        costUsd: "0.00037",
      })
    );
  });

  it("marks the active phase and run failed when tracked work throws", async () => {
    const repository = createMockRepository();
    const reporter = new BookmarkProcessingReporter(repository, () => new Date());

    await reporter.startRun("bookmark-1", "user-1");

    await expect(
      reporter.trackPhase("tag", "Generate tags", async () => {
        throw new Error("tag generation failed");
      })
    ).rejects.toThrow("tag generation failed");

    expect(repository.updateEvent).toHaveBeenCalledWith(
      "event-2",
      expect.objectContaining({
        status: "failed",
        error: "tag generation failed",
      })
    );

    await reporter.failRun("tag generation failed");

    expect(repository.updateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        status: "failed",
        error: "tag generation failed",
      })
    );
  });

  it("maps the old nine-name vocabulary onto the six phases the UI renders", () => {
    // The pipeline no longer emits these, but a redelivered queue message or a
    // caller that has not been redeployed still might — and the backfill
    // migration applies exactly this table to history.
    expect(mapBookmarkProcessingPhase("summarization")).toBe("summarise");
    expect(mapBookmarkProcessingPhase("brief_summary")).toBe("summarise");
    expect(mapBookmarkProcessingPhase("tags")).toBe("tag");
    expect(mapBookmarkProcessingPhase("images")).toBe("extract");
    expect(mapBookmarkProcessingPhase("private_link_enrichment")).toBe("extract");
    expect(mapBookmarkProcessingPhase("categorization")).toBe("file");
    expect(mapBookmarkProcessingPhase("chunking")).toBe("embed");
    expect(mapBookmarkProcessingPhase("embedding")).toBe("embed");
    // Bookkeeping, never a user-facing phase.
    expect(mapBookmarkProcessingPhase("finalization")).toBeUndefined();
    // The new names pass through untouched.
    expect(mapBookmarkProcessingPhase("fetch")).toBe("fetch");
  });

  it("writes a legacy phase name to the timeline under its new name", async () => {
    const repository = createMockRepository();
    const reporter = new BookmarkProcessingReporter(repository, () => new Date());

    await reporter.startRun("bookmark-1", "user-1");
    await reporter.trackPhase("categorization", "Categorize", async () => "ok");

    expect(repository.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "phase", phase: "file" })
    );
  });

  it("appends to the existing run when resuming, keeping sequence and totals", async () => {
    // A Retry adds to the timeline the user is already watching. A fresh run
    // would make the phases they saw succeed disappear.
    const repository = createMockRepository();
    repository.findLatestTimeline.mockResolvedValueOnce({
      run: {
        id: "run-7",
        bookmarkId: "bookmark-1",
        userId: "user-1",
        status: "failed",
        startedAt: new Date("2026-06-21T10:00:00.000Z"),
        inputTokens: 100,
        outputTokens: 40,
        totalTokens: 140,
        reasoningTokens: 3,
        cachedInputTokens: 5,
        costUsd: "0.001",
        error: "summarise: model unavailable",
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
        updatedAt: new Date("2026-06-21T10:00:00.000Z"),
      },
      events: [
        {
          id: "event-run",
          runId: "run-7",
          kind: "run",
          name: "Processing run",
          status: "failed",
          sequence: 1,
          startedAt: new Date("2026-06-21T10:00:00.000Z"),
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          reasoningTokens: 0,
          cachedInputTokens: 0,
          createdAt: new Date("2026-06-21T10:00:00.000Z"),
          updatedAt: new Date("2026-06-21T10:00:00.000Z"),
        },
        {
          id: "event-summarise",
          runId: "run-7",
          kind: "phase",
          phase: "summarise",
          name: "Summarise content",
          status: "failed",
          sequence: 4,
          startedAt: new Date("2026-06-21T10:00:01.000Z"),
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          reasoningTokens: 0,
          cachedInputTokens: 0,
          createdAt: new Date("2026-06-21T10:00:01.000Z"),
          updatedAt: new Date("2026-06-21T10:00:01.000Z"),
        },
      ],
    });

    const reporter = new BookmarkProcessingReporter(repository, () => new Date());
    await reporter.resumeRun("bookmark-1", "user-1");

    expect(repository.createRun).not.toHaveBeenCalled();
    expect(repository.updateRun).toHaveBeenCalledWith(
      "run-7",
      expect.objectContaining({ status: "running", error: null })
    );
    expect(repository.updateEvent).toHaveBeenCalledWith(
      "event-run",
      expect.objectContaining({ status: "running", error: null })
    );

    await reporter.trackPhase("summarise", "Summarise content", async () => "ok");

    // Continues after the highest sequence already on the run.
    expect(repository.createEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runId: "run-7",
        kind: "phase",
        phase: "summarise",
        sequence: 5,
      })
    );

    await reporter.completeRun();

    // The first attempt's spend is carried forward, not erased.
    expect(repository.updateRun).toHaveBeenLastCalledWith(
      "run-7",
      expect.objectContaining({
        status: "completed",
        inputTokens: 100,
        totalTokens: 140,
        costUsd: "0.001",
      })
    );
  });

  it("opens a run when there is nothing to resume", async () => {
    const repository = createMockRepository();
    const reporter = new BookmarkProcessingReporter(repository, () => new Date());

    await reporter.resumeRun("bookmark-1", "user-1");

    expect(repository.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ bookmarkId: "bookmark-1", status: "running" })
    );
  });
});
