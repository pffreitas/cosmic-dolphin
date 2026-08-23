import { describe, it, expect, beforeEach } from "@jest/globals";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { BookmarkProcessingRepositoryImpl } from "../../repositories/bookmark-processing.repository";

describe("BookmarkProcessingRepository", () => {
  const db = getTestDatabase();
  const bookmarkRepository = new BookmarkRepositoryImpl(db);
  const repository = new BookmarkProcessingRepositoryImpl(db);

  let bookmarkId: string;
  let userId: string;

  beforeEach(async () => {
    userId = TestDataFactory.generateUserId();
    const bookmark = await bookmarkRepository.create(
      TestDataFactory.createBookmark({
        user_id: userId,
        source_url: "https://example.com/timeline",
      })
    );
    bookmarkId = bookmark.id;
  });

  it("creates a run and records ordered processing events", async () => {
    const run = await repository.createRun({
      bookmarkId,
      userId,
      status: "running",
      startedAt: new Date("2026-06-21T10:00:00.000Z"),
    });

    const phase = await repository.createEvent({
      runId: run.id,
      kind: "phase",
      phase: "summarization",
      name: "Summarization",
      status: "running",
      sequence: 1,
      startedAt: new Date("2026-06-21T10:00:01.000Z"),
      metadata: { input: "scraped-content" },
    });

    await repository.createEvent({
      runId: run.id,
      parentEventId: phase.id,
      kind: "turn",
      phase: "summarization",
      name: "Generate summary",
      status: "completed",
      sequence: 2,
      startedAt: new Date("2026-06-21T10:00:02.000Z"),
      endedAt: new Date("2026-06-21T10:00:04.500Z"),
      durationMs: 2500,
      modelId: "qwen/qwen3.7-plus",
      inputTokens: 11,
      outputTokens: 17,
      totalTokens: 28,
      reasoningTokens: 3,
      cachedInputTokens: 5,
      costUsd: "0.00042",
      providerMetadata: { openrouter: { usage: { cost: 0.00042 } } },
    });

    const timeline = await repository.findLatestTimeline(bookmarkId, userId);

    expect(timeline?.run).toEqual(
      expect.objectContaining({
        id: run.id,
        bookmarkId,
        userId,
        status: "running",
      })
    );
    expect(timeline?.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(timeline?.events[0]).toEqual(
      expect.objectContaining({
        kind: "phase",
        phase: "summarization",
        name: "Summarization",
      })
    );
    expect(timeline?.events[1]).toEqual(
      expect.objectContaining({
        parentEventId: phase.id,
        kind: "turn",
        modelId: "qwen/qwen3.7-plus",
        inputTokens: 11,
        outputTokens: 17,
        totalTokens: 28,
        reasoningTokens: 3,
        cachedInputTokens: 5,
        costUsd: "0.00042",
      })
    );
  });

  it("updates run and event completion fields", async () => {
    const run = await repository.createRun({
      bookmarkId,
      userId,
      status: "running",
      startedAt: new Date("2026-06-21T10:00:00.000Z"),
    });
    const event = await repository.createEvent({
      runId: run.id,
      kind: "phase",
      phase: "tags",
      name: "Tags",
      status: "running",
      sequence: 1,
      startedAt: new Date("2026-06-21T10:00:01.000Z"),
    });

    const completedEvent = await repository.updateEvent(event.id, {
      status: "completed",
      endedAt: new Date("2026-06-21T10:00:03.000Z"),
      durationMs: 2000,
    });
    const completedRun = await repository.updateRun(run.id, {
      status: "completed",
      endedAt: new Date("2026-06-21T10:00:04.000Z"),
      durationMs: 4000,
      inputTokens: 11,
      outputTokens: 17,
      totalTokens: 28,
      reasoningTokens: 3,
      cachedInputTokens: 5,
      costUsd: "0.00042",
    });

    expect(completedEvent).toEqual(
      expect.objectContaining({
        status: "completed",
        durationMs: 2000,
      })
    );
    expect(completedRun).toEqual(
      expect.objectContaining({
        status: "completed",
        durationMs: 4000,
        inputTokens: 11,
        outputTokens: 17,
        totalTokens: 28,
        costUsd: "0.00042",
      })
    );
  });

  it("returns null when the bookmark does not belong to the user", async () => {
    await repository.createRun({
      bookmarkId,
      userId,
      status: "running",
      startedAt: new Date("2026-06-21T10:00:00.000Z"),
    });

    await expect(
      repository.findLatestTimeline(bookmarkId, TestDataFactory.generateUserId())
    ).resolves.toBeNull();
  });
});
