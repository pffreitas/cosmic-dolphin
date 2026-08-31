import { describe, expect, it, vi } from "vitest";
import type {
  Bookmark,
  SearchBookmarksResponse,
} from "@cosmic-dolphin/api-client";

vi.mock("@/lib/api/bookmarks-client", () => ({
  BookmarksClientAPI: {},
}));

import bookmarksReducer, {
  captureDismissed,
  capturePreviewResolved,
  captureStarted,
  fetchBookmarks,
  saveCapture,
  searchBookmarks,
  type PendingCapture,
} from "./bookmarksSlice";

const pending: PendingCapture = {
  id: "capture-1",
  url: "https://every.to/p/the-post",
  domain: "every.to",
  faviconUrl: "https://every.to/favicon.ico",
  title: "every.to/p/the-post",
  status: "saving",
};

function withCapture(capture: PendingCapture = pending) {
  return bookmarksReducer(undefined, captureStarted(capture));
}

const fixtureCreatedAt = new Date("2026-06-17T00:00:00.000Z");
const fixtureUpdatedAt = new Date("2026-06-17T00:00:00.000Z");

describe("bookmarksSlice", () => {
  it("stores search result processing dates as serializable strings", () => {
    const processingStartedAt = new Date("2026-06-17T02:34:24.000Z");
    const response: SearchBookmarksResponse = {
      bookmarks: [
        {
          id: "bookmark-1",
          sourceUrl: "https://example.com",
          userId: "user-1",
          title: "Example",
          processingStartedAt,
          createdAt: fixtureCreatedAt,
          updatedAt: fixtureUpdatedAt,
        } satisfies Bookmark,
      ],
      total: 1,
    };

    const state = bookmarksReducer(
      undefined,
      searchBookmarks.fulfilled(response, "request-1", {
        query: "knowledge bas",
      })
    );

    expect(state.searchResults[0].processingStartedAt).toBe(
      "2026-06-17T02:34:24.000Z"
    );
    expect(state.searchResults[0].processingStartedAt).not.toBeInstanceOf(
      Date
    );
  });

  it("stores fetched bookmark processing dates as serializable strings", () => {
    const processingCompletedAt = new Date("2026-06-17T03:10:00.000Z");
    const bookmarks = [
      {
        id: "bookmark-2",
        sourceUrl: "https://example.com/done",
        userId: "user-1",
        title: "Done",
        processingCompletedAt,
        createdAt: fixtureCreatedAt,
        updatedAt: fixtureUpdatedAt,
      } satisfies Bookmark,
    ];

    const state = bookmarksReducer(
      undefined,
      fetchBookmarks.fulfilled(bookmarks, "request-2", undefined)
    );

    expect(state.bookmarks[0].processingCompletedAt).toBe(
      "2026-06-17T03:10:00.000Z"
    );
    expect(state.bookmarks[0].processingCompletedAt).not.toBeInstanceOf(Date);
  });

  it("keeps a failed capture on screen as an inline error", () => {
    const state = bookmarksReducer(
      withCapture(),
      saveCapture.rejected(
        null,
        "request-3",
        { url: pending.url },
        { captureId: pending.id, error: "Could not save that link." }
      )
    );

    expect(state.captures).toHaveLength(1);
    expect(state.captures[0].status).toBe("failed");
    expect(state.captures[0].error).toBe("Could not save that link.");
    // The URL is the durable part — a retry has to be able to re-send it.
    expect(state.captures[0].url).toBe(pending.url);
  });

  it("returns a retried capture to saving rather than adding a second row", () => {
    const failed = bookmarksReducer(
      withCapture(),
      saveCapture.rejected(
        null,
        "request-3",
        { url: pending.url },
        { captureId: pending.id, error: "Could not save that link." }
      )
    );

    const state = bookmarksReducer(
      failed,
      captureStarted({ ...pending, status: "saving" })
    );

    expect(state.captures).toHaveLength(1);
    expect(state.captures[0].status).toBe("saving");
    expect(state.captures[0].error).toBeUndefined();
  });

  it("answers a rate limit at the field and keeps the wait", () => {
    const state = bookmarksReducer(
      withCapture(),
      saveCapture.rejected(
        null,
        "request-4",
        { url: pending.url },
        {
          captureId: pending.id,
          error: "You have saved 100 links today.",
          retryIn: "2 hours",
        }
      )
    );

    expect(state.captures).toHaveLength(0);
    expect(state.createRateLimit).toEqual({
      message: "You have saved 100 links today.",
      retryIn: "2 hours",
    });
  });

  it("retires the pending row on a duplicate, because nothing is processing", () => {
    const state = bookmarksReducer(
      withCapture(),
      saveCapture.fulfilled(
        {
          captureId: pending.id,
          bookmarkId: "bookmark-9",
          alreadySaved: true,
          title: "The post",
        },
        "request-5",
        { url: pending.url }
      )
    );

    expect(state.captures).toHaveLength(0);
  });

  it("keeps the row and records the bookmark id on a real save", () => {
    const state = bookmarksReducer(
      withCapture(),
      saveCapture.fulfilled(
        {
          captureId: pending.id,
          bookmarkId: "bookmark-9",
          alreadySaved: false,
          title: "The post",
        },
        "request-6",
        { url: pending.url }
      )
    );

    expect(state.captures[0].status).toBe("saved");
    expect(state.captures[0].bookmarkId).toBe("bookmark-9");
    expect(state.captures[0].title).toBe("The post");
  });

  it("upgrades a saving row when a preview lands, and ignores a late one", () => {
    const preview = {
      scrapable: true,
      metadata: {
        url: pending.url,
        title: "The post",
        image: "https://every.to/og.png",
      },
    };

    const upgraded = bookmarksReducer(
      withCapture(),
      capturePreviewResolved({ id: pending.id, preview })
    );
    expect(upgraded.captures[0].title).toBe("The post");
    expect(upgraded.captures[0].thumbnailUrl).toBe("https://every.to/og.png");

    const saved = bookmarksReducer(
      withCapture({ ...pending, status: "saved", title: "Real title" }),
      capturePreviewResolved({ id: pending.id, preview })
    );
    expect(saved.captures[0].title).toBe("Real title");
  });

  it("removes a capture only on an explicit dismissal", () => {
    const state = bookmarksReducer(withCapture(), captureDismissed(pending.id));
    expect(state.captures).toHaveLength(0);
  });
});
