import { useState, useCallback, useEffect } from 'react';
import { BookmarksAPI, Bookmark } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  cacheLibraryPageInBackground,
  getCachedLibrary,
} from '@/lib/bookmark-cache';
import { isAuthError } from '@/lib/api-errors';

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
}

export function useBookmarks(): UseBookmarksResult {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchBookmarks = useCallback(async (reset: boolean = false) => {
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

      setIsOffline(false);
      cacheLibraryPageInBackground(userId, newBookmarks, { reset });

      // If we received fewer than PAGE_SIZE items, there are no more
      setHasMore(newBookmarks.length === PAGE_SIZE);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bookmarks';

      if (reset && !isAuthError(err)) {
        const cachedBookmarks = await getCachedLibrary(userId);
        if (cachedBookmarks.length > 0) {
          setBookmarks(cachedBookmarks);
          setOffset(cachedBookmarks.length);
          setHasMore(false);
          setIsOffline(true);
          setError(null);
          return;
        }
      }

      setError(errorMessage);
      setIsOffline(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [offset, user?.id]);

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
    if (user?.id) {
      fetchBookmarks(true);
    } else {
      setBookmarks([]);
      setIsLoading(false);
      setIsLoadingMore(false);
      setError(null);
      setIsOffline(false);
      setHasMore(false);
    }
    // Fetch only when the signed-in user changes; offset changes are handled by explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    isOffline,
    hasMore,
    refresh,
    loadMore,
  };
}
