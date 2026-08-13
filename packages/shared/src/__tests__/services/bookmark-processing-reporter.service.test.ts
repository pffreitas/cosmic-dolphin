import { describe, it, expect, jest } from "@jest/globals";
import { BookmarkProcessingReporter } from "../../services/bookmark-processing-reporter.service";
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
      phase: "summarization",
      name: "Summarization",
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
    await reporter.trackPhase("summarization", "Summarization", async (phase) => {
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
        phase: "summarization",
        sequence: 2,
      })
    );
    expect(repository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        parentEventId: "event-2",
        kind: "turn",
        phase: "summarization",
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
      reporter.trackPhase("tags", "Tags", async () => {
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
});
