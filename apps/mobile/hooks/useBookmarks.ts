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
}

export function useBookmarks(): UseBookmarksResult {
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
      const newBookmarks = await BookmarksAPI.list({
        limit: PAGE_SIZE,
        offset: currentOffset,
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
  }, [offset]);

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
  }, []);

  return {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
