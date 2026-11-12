import { useState, useCallback, useEffect, useRef } from "react";
import { BookmarksAPI, Bookmark } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  cacheBookmarksInBackground,
  cacheLibraryPageInBackground,
  getCachedLibrary,
} from "@/lib/bookmark-cache";
import { isAuthError } from "@/lib/api-errors";

const PAGE_SIZE = 20;

interface UseBookmarksResult {
  bookmarks: Bookmark[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  isOffline: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleRead: (bookmark: Bookmark) => Promise<void>;
}

interface UseBookmarksOptions {
  mode?: "feed" | "library";
  readStatus?: "all" | "unread" | "read";
  collectionId?: string;
  scope?: "all" | "inbox" | "archive";
  sort?: "newest" | "oldest";
}

function bookmarkIsRead(bookmark: Bookmark): boolean {
  return bookmark.isRead ?? Boolean(bookmark.readAt);
}

function filterCachedBookmarks(
  bookmarks: Bookmark[],
  mode: UseBookmarksOptions["mode"],
  readStatus: UseBookmarksOptions["readStatus"],
): Bookmark[] {
  if (mode === "feed" || readStatus === "unread") {
    return bookmarks.filter((bookmark) => !bookmarkIsRead(bookmark));
  }

  if (readStatus === "read") {
    return bookmarks.filter(bookmarkIsRead);
  }

  return bookmarks;
}

export function useBookmarks({
  mode = "library",
  readStatus = "all",
  collectionId,
  scope = "all",
  sort = "newest",
}: UseBookmarksOptions = {}): UseBookmarksResult {
  const { user } = useAuth();
  const generation = useRef(0);
  const paginationBusy = useRef(false);
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  // The feed pages by cursor, not offset: it is re-ranked between requests, so
  // an offset into it duplicates and skips. The library still pages by offset,
  // because it is a stable ordering and a keyset there is D19's problem.
  const [feedCursor, setFeedCursor] = useState<string | undefined>(undefined);

  const fetchBookmarks = useCallback(
    async (reset: boolean = false) => {
      const userId = user?.id;
      if (!userId) {
        setBookmarks([]);
        setIsLoading(false);
        setIsLoadingMore(false);
        setError(null);
        setIsOffline(false);
        setHasMore(false);
        return;
      }

      const token = reset ? ++generation.current : generation.current;
      const currentOffset = reset ? 0 : offset;

      if (reset) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        let newBookmarks: Bookmark[];
        let nextFeedCursor: string | undefined;

        if (mode === "feed") {
          const page = await BookmarksAPI.feed({
            limit: PAGE_SIZE,
            cursor: reset ? undefined : feedCursor,
          });
          newBookmarks = page.bookmarks;
          nextFeedCursor = page.nextCursor;
        } else {
          newBookmarks = await BookmarksAPI.list({
            limit: PAGE_SIZE,
            offset: currentOffset,
            read_status: readStatus,
            collection_id: collectionId,
            scope,
            sort,
          });
        }

        if (token !== generation.current || activeUser.current !== userId)
          return;
        if (reset) {
          setBookmarks(newBookmarks);
          setOffset(PAGE_SIZE);
        } else {
          setBookmarks((prev) => [
            ...new Map(
              [...prev, ...newBookmarks].map((bookmark) => [
                bookmark.id,
                bookmark,
              ]),
            ).values(),
          ]);
          setOffset((prev) => prev + PAGE_SIZE);
        }

        if (mode === "feed") setFeedCursor(nextFeedCursor);

        setIsOffline(false);
        if (
          mode === "library" &&
          readStatus === "all" &&
          scope === "all" &&
          !collectionId &&
          sort === "newest"
        ) {
          cacheLibraryPageInBackground(userId, newBookmarks, { reset });
        } else {
          cacheBookmarksInBackground(userId, newBookmarks);
        }

        // The feed says so explicitly; the library infers it from a short page.
        setHasMore(
          mode === "feed"
            ? Boolean(nextFeedCursor)
            : newBookmarks.length === PAGE_SIZE,
        );
      } catch (err) {
        if (token !== generation.current || activeUser.current !== userId)
          return;
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch bookmarks";

        if (reset && !isAuthError(err)) {
          const cachedBookmarks = filterCachedBookmarks(
            (await getCachedLibrary(userId)).filter(
              (bookmark) =>
                (scope === "archive"
                  ? bookmark.isArchived
                  : !bookmark.isArchived) &&
                (scope !== "inbox" || !bookmark.collectionId) &&
                (!collectionId || bookmark.collectionId === collectionId),
            ),
            mode,
            readStatus,
          );
          if (sort === "oldest") cachedBookmarks.reverse();
          if (token !== generation.current || activeUser.current !== userId)
            return;
          if (cachedBookmarks.length > 0) {
            setBookmarks(cachedBookmarks);
            setOffset(cachedBookmarks.length);
            setFeedCursor(undefined);
            setHasMore(false);
            setIsOffline(true);
            setError(null);
            return;
          }
        }

        setError(errorMessage);
        setIsOffline(false);
      } finally {
        if (token === generation.current && activeUser.current === userId) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [feedCursor, mode, offset, readStatus, user?.id, collectionId, scope, sort],
  );

  const refresh = useCallback(async () => {
    setOffset(0);
    setFeedCursor(undefined);
    setHasMore(true);
    await fetchBookmarks(true);
  }, [fetchBookmarks]);

  const loadMore = useCallback(async () => {
    if (!paginationBusy.current && !isLoadingMore && hasMore && !isLoading) {
      paginationBusy.current = true;
      try {
        await fetchBookmarks(false);
      } finally {
        paginationBusy.current = false;
      }
    }
  }, [isLoadingMore, hasMore, isLoading, fetchBookmarks]);

  // Initial load
  useEffect(() => {
    if (user?.id) {
      setBookmarks([]);
      fetchBookmarks(true);
    } else {
      setBookmarks([]);
      setIsLoading(false);
      setIsLoadingMore(false);
      setError(null);
      setIsOffline(false);
      setHasMore(false);
    }
    return () => {
      generation.current++;
    };
    // Fetch when the signed-in user, mode, or filter changes; offset changes are handled by explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, readStatus, collectionId, scope, sort]);

  const toggleRead = useCallback(
    async (bookmark: Bookmark) => {
      const currentIsRead = bookmark.isRead ?? Boolean(bookmark.readAt);
      const updated = currentIsRead
        ? await BookmarksAPI.markUnread(bookmark.id)
        : await BookmarksAPI.markRead(bookmark.id);

      cacheBookmarksInBackground(user?.id, [updated]);

      setBookmarks((prev) => {
        if (mode === "feed" && bookmarkIsRead(updated)) {
          return prev.filter((item) => item.id !== bookmark.id);
        }

        if (mode === "library" && readStatus !== "all") {
          const updatedIsRead = bookmarkIsRead(updated);
          const matchesFilter =
            (readStatus === "read" && updatedIsRead) ||
            (readStatus === "unread" && !updatedIsRead);

          if (!matchesFilter) {
            return prev.filter((item) => item.id !== bookmark.id);
          }
        }

        return prev.map((item) => (item.id === bookmark.id ? updated : item));
      });
    },
    [mode, readStatus, user?.id],
  );

  return {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    isOffline,
    hasMore,
    refresh,
    loadMore,
    toggleRead,
  };
}
