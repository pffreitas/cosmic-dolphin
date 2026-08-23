import { describe, expect, it, vi } from "vitest";
import type {
  Bookmark,
  SearchBookmarksResponse,
} from "@cosmic-dolphin/api-client";

vi.mock("@/lib/api/bookmarks-client", () => ({
  BookmarksClientAPI: {},
}));

import bookmarksReducer, {
  fetchBookmarks,
  searchBookmarks,
} from "./bookmarksSlice";

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
});
