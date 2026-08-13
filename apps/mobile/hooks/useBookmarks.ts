import { useState, useCallback, useEffect } from 'react';
import { BookmarksAPI, Bookmark } from '@/lib/api';

const PAGE_SIZE = 20;

interface UseBookmarksResult {
  bookmarks: Bookmark[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleRead: (bookmark: Bookmark) => Promise<void>;
}

interface UseBookmarksOptions {
  mode?: 'feed' | 'library';
  readStatus?: 'all' | 'unread' | 'read';
}

export function useBookmarks({
  mode = 'library',
  readStatus = 'all',
}: UseBookmarksOptions = {}): UseBookmarksResult {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchBookmarks = useCallback(async (reset: boolean = false) => {
    const currentOffset = reset ? 0 : offset;
    
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const newBookmarks =
        mode === 'feed'
          ? await BookmarksAPI.feed({
              limit: PAGE_SIZE,
              offset: currentOffset,
            })
          : await BookmarksAPI.list({
              limit: PAGE_SIZE,
              offset: currentOffset,
              read_status: readStatus,
            });

      if (reset) {
        setBookmarks(newBookmarks);
        setOffset(PAGE_SIZE);
      } else {
        setBookmarks((prev) => [...prev, ...newBookmarks]);
        setOffset((prev) => prev + PAGE_SIZE);
      }

      // If we received fewer than PAGE_SIZE items, there are no more
      setHasMore(newBookmarks.length === PAGE_SIZE);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bookmarks';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [mode, offset, readStatus]);

  const refresh = useCallback(async () => {
    setOffset(0);
    setHasMore(true);
    await fetchBookmarks(true);
  }, [fetchBookmarks]);

  const loadMore = useCallback(async () => {
    if (!isLoadingMore && hasMore && !isLoading) {
      await fetchBookmarks(false);
    }
  }, [isLoadingMore, hasMore, isLoading, fetchBookmarks]);

  // Initial load
  useEffect(() => {
    fetchBookmarks(true);
  }, [mode, readStatus]);

  const toggleRead = useCallback(async (bookmark: Bookmark) => {
    const currentIsRead = bookmark.isRead ?? Boolean(bookmark.readAt);
    const updated = currentIsRead
      ? await BookmarksAPI.markUnread(bookmark.id)
      : await BookmarksAPI.markRead(bookmark.id);

    setBookmarks((prev) => {
      if (mode === 'feed' && (updated.isRead ?? Boolean(updated.readAt))) {
        return prev.filter((item) => item.id !== bookmark.id);
      }

      if (mode === 'library' && readStatus !== 'all') {
        const updatedIsRead = updated.isRead ?? Boolean(updated.readAt);
        const matchesFilter =
          (readStatus === 'read' && updatedIsRead) ||
          (readStatus === 'unread' && !updatedIsRead);

        if (!matchesFilter) {
          return prev.filter((item) => item.id !== bookmark.id);
        }
      }

      return prev.map((item) => (item.id === bookmark.id ? updated : item));
    });
  }, [mode, readStatus]);

  return {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    toggleRead,
  };
}
