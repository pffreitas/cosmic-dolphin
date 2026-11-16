import { describe, it, expect, mock } from "bun:test";
import { buildBookmarkProcessingTimelineResponse } from "../routes/bookmarks";
import { Bookmark } from "@cosmic-dolphin/shared";

describe("GET /bookmarks/:id/processing-timeline", () => {
  const bookmark: Bookmark = {
    id: "bookmark-1",
    sourceUrl: "https://example.com",
    userId: "user-1",
    isPrivateLink: false,
    isPublic: false,
    processingStatus: "processing",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  function createServices(overrides: {
    bookmarkResult?: any;
    timeline?: any;
  } = {}) {
    return {
      bookmark: {
        findByIdAndUserWithLikeStatus: mock(async () =>
          overrides.bookmarkResult === undefined
            ? { bookmark, isLikedByCurrentUser: true }
            : overrides.bookmarkResult
        ),
        updateProcessingStatus: mock(async (_id, status, error) => ({
          ...bookmark,
          processingStatus: status,
          processingError: error,
        })),
      },
      bookmarkProcessing: {
        findLatestTimeline: mock(async () => overrides.timeline ?? null),
      },
    } as any;
  }

  it("enforces bookmark ownership with a 404", async () => {
    const services = createServices({ bookmarkResult: null });

    const response = await buildBookmarkProcessingTimelineResponse(
      services,
      "bookmark-1",
      "other-user"
    );

    expect(response).toEqual({
      statusCode: 404,
      body: { error: "Bookmark not found" },
    });
    expect(
      services.bookmarkProcessing.findLatestTimeline
    ).not.toHaveBeenCalled();
  });

  it("returns the latest run events in repository order", async () => {
    const run = {
      id: "run-1",
      bookmarkId: "bookmark-1",
      userId: "user-1",
      status: "running" as const,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const events = [
      {
        id: "event-1",
        runId: "run-1",
        sequence: 1,
        kind: "phase" as const,
        phase: "summarise",
        name: "Summarize content",
        status: "completed" as const,
        startedAt: new Date("2026-01-01T00:00:00Z"),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "event-2",
        runId: "run-1",
        parentEventId: "event-1",
        sequence: 2,
        kind: "turn" as const,
        phase: "summarise",
        name: "Generate summary",
        status: "running" as const,
        startedAt: new Date("2026-01-01T00:00:01Z"),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        createdAt: new Date("2026-01-01T00:00:01Z"),
        updatedAt: new Date("2026-01-01T00:00:01Z"),
      },
    ];
    const services = createServices({ timeline: { run, events } });

    const response = await buildBookmarkProcessingTimelineResponse(
      services,
      "bookmark-1",
      "user-1"
    );

    expect(response.body).toEqual({
      bookmark: { ...bookmark, isLikedByCurrentUser: true },
      run,
      events,
      pollAfterMs: 2000,
    });
    expect(
      services.bookmarkProcessing.findLatestTimeline
    ).toHaveBeenCalledWith("bookmark-1", "user-1");
  });

  it("stops polling once processing is terminal", async () => {
    const completedBookmark = {
      ...bookmark,
      processingStatus: "completed" as const,
    };
    const services = createServices({
      bookmarkResult: {
        bookmark: completedBookmark,
        isLikedByCurrentUser: false,
      },
    });

    const response = await buildBookmarkProcessingTimelineResponse(
      services,
      "bookmark-1",
      "user-1"
    );

    expect(response.body).toEqual({
      bookmark: {
        ...completedBookmark,
        isLikedByCurrentUser: false,
      },
      events: [],
      pollAfterMs: 0,
      run: undefined,
    });
  });

  it.each(["completed", "failed"] as const)(
    "does not poll a %s bookmark even if the timeline still shows a running event",
    async (processingStatus) => {
      const completedBookmark = {
        ...bookmark,
        processingStatus,
      };
      const services = createServices({
        bookmarkResult: {
          bookmark: completedBookmark,
          isLikedByCurrentUser: false,
        },
        timeline: {
          run: {
            id: "run-1",
            bookmarkId: "bookmark-1",
            userId: "user-1",
            status: "running" as const,
            startedAt: new Date("2026-01-01T00:00:00Z"),
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            reasoningTokens: 0,
            cachedInputTokens: 0,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
          events: [
            {
              id: "event-1",
              runId: "run-1",
              kind: "phase" as const,
              name: "Summarise",
              status: "running" as const,
              sequence: 1,
              startedAt: new Date("2026-01-01T00:00:00Z"),
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              reasoningTokens: 0,
              cachedInputTokens: 0,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              updatedAt: new Date("2026-01-01T00:00:00Z"),
            },
          ],
        },
      });

      const response = await buildBookmarkProcessingTimelineResponse(
        services,
        "bookmark-1",
        "user-1"
      );

      if (response.statusCode) {
        throw new Error("Expected timeline response");
      }

      expect(response.body.pollAfterMs).toBe(0);
    }
  );

  it("polls while the bookmark is processing", async () => {
    const services = createServices({
      bookmarkResult: {
        bookmark: { ...bookmark, processingStatus: "processing" as const },
        isLikedByCurrentUser: false,
      },
      timeline: null,
    });

    const response = await buildBookmarkProcessingTimelineResponse(
      services,
      "bookmark-1",
      "user-1"
    );

    if (response.statusCode) {
      throw new Error("Expected timeline response");
    }

    expect(response.body.pollAfterMs).toBe(2000);
  });

  it("timeline of a long-waiting processing bookmark is unchanged and read-only", async () => {
    const waiting = {
      ...bookmark,
      processingStartedAt: new Date(Date.now() - 60 * 60 * 1000),
    };
    const services = createServices({
      bookmarkResult: { bookmark: waiting, isLikedByCurrentUser: true },
    });

    const response = await buildBookmarkProcessingTimelineResponse(
      services,
      "bookmark-1",
      "user-1"
    );
    if (response.statusCode) throw new Error("Expected timeline response");

    expect(services.bookmark.updateProcessingStatus).not.toHaveBeenCalled();
    expect(response.body.bookmark).toEqual({ ...waiting, isLikedByCurrentUser: true });
    expect(response.body.bookmark.processingStatus).toBe("processing");
    expect(response.body.pollAfterMs).toBe(2000);
  });

  it("keeps polling a recently started processing bookmark", async () => {
    const recentBookmark = {
      ...bookmark,
      processingStartedAt: new Date(Date.now() - 60 * 1000),
    };
    const services = createServices({
      bookmarkResult: { bookmark: recentBookmark, isLikedByCurrentUser: false },
    });

    const response = await buildBookmarkProcessingTimelineResponse(
      services,
      "bookmark-1",
      "user-1"
    );
    if (response.statusCode) throw new Error("Expected timeline response");

    expect(services.bookmark.updateProcessingStatus).not.toHaveBeenCalled();
    expect(response.body.bookmark.processingStatus).toBe("processing");
    expect(response.body.pollAfterMs).toBe(2000);
  });
});
