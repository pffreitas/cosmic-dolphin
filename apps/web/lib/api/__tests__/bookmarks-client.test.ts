import { describe, it, expect, beforeEach, mock } from "bun:test";

const mockBookmarksRemove = mock();
const mockGetSession = mock();

mock.module("@cosmic-dolphin/api-client", () => {
  function MockConfiguration() {}
  function MockBookmarksApi() {
    return {
      bookmarksRemove: mockBookmarksRemove,
      bookmarksList: mock(),
      bookmarksCreate: mock(),
      bookmarksFindById: mock(),
      bookmarksSearch: mock(),
      bookmarksLike: mock(),
      bookmarksUnlike: mock(),
      bookmarksShare: mock(),
      bookmarksUnshare: mock(),
      bookmarksPreview: mock(),
    };
  }
  function MockCollectionsApi() {
    return { collectionsList: mock() };
  }
  return {
    Configuration: MockConfiguration,
    BookmarksApi: MockBookmarksApi,
    CollectionsApi: MockCollectionsApi,
  };
});

mock.module("@/utils/supabase/client", () => ({
  createClient: mock(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

process.env.NEXT_PUBLIC_API_URL = "https://api.test.com";

import { BookmarksClientAPI } from "../bookmarks-client";

describe("BookmarksClientAPI.remove", () => {
  beforeEach(() => {
    mockBookmarksRemove.mockReset();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
  });

  describe("happy path", () => {
    it("should call bookmarksApi.bookmarksRemove with the correct bookmark ID", async () => {
      mockBookmarksRemove.mockResolvedValue({ message: "Bookmark deleted successfully" });

      await BookmarksClientAPI.remove("bookmark-123");

      expect(mockBookmarksRemove).toHaveBeenCalledWith({ id: "bookmark-123" });
    });

    it("should resolve without returning a value on success", async () => {
      mockBookmarksRemove.mockResolvedValue({ message: "Bookmark deleted successfully" });

      const result = await BookmarksClientAPI.remove("bookmark-456");

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw when the API returns a 404 error", async () => {
      const error = new Error("Not Found") as any;
      error.response = { data: { error: "Bookmark not found" } };
      mockBookmarksRemove.mockRejectedValue(error);

      await expect(BookmarksClientAPI.remove("nonexistent-id")).rejects.toThrow(
        "Bookmark not found"
      );
    });

    it("should throw when the API returns a 401 error", async () => {
      const error = new Error("Unauthorized") as any;
      error.response = { data: { error: "Invalid or expired token" } };
      mockBookmarksRemove.mockRejectedValue(error);

      await expect(BookmarksClientAPI.remove("some-id")).rejects.toThrow(
        "Invalid or expired token"
      );
    });

    it("should throw when the API returns a 500 error", async () => {
      const error = new Error("Server Error") as any;
      error.response = { data: { error: "Internal server error" } };
      mockBookmarksRemove.mockRejectedValue(error);

      await expect(BookmarksClientAPI.remove("some-id")).rejects.toThrow(
        "Internal server error"
      );
    });

    it("should throw with the server error message when response contains error.response.data.error", async () => {
      const error = new Error("Request failed") as any;
      error.response = { data: { error: "Custom error message from server" } };
      mockBookmarksRemove.mockRejectedValue(error);

      await expect(BookmarksClientAPI.remove("some-id")).rejects.toThrow(
        "Custom error message from server"
      );
    });

    it("should re-throw the original error when no structured error message is available", async () => {
      const error = new Error("Network failure");
      mockBookmarksRemove.mockRejectedValue(error);

      await expect(BookmarksClientAPI.remove("some-id")).rejects.toThrow(
        "Network failure"
      );
    });

    it("should throw on network failure", async () => {
      mockBookmarksRemove.mockRejectedValue(new TypeError("fetch failed"));

      await expect(BookmarksClientAPI.remove("some-id")).rejects.toThrow(
        "fetch failed"
      );
    });
  });
});
