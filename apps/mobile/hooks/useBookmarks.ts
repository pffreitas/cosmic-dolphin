import { useState, useCallback, useEffect } from 'react';
import { BookmarksAPI, Bookmark } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  cacheBookmarksInBackground,
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
  toggleRead: (bookmark: Bookmark) => Promise<void>;
}

interface UseBookmarksOptions {
  mode?: 'feed' | 'library';
  readStatus?: 'all' | 'unread' | 'read';
}

function bookmarkIsRead(bookmark: Bookmark): boolean {
  return bookmark.isRead ?? Boolean(bookmark.readAt);
}

function filterCachedBookmarks(
  bookmarks: Bookmark[],
  mode: UseBookmarksOptions['mode'],
  readStatus: UseBookmarksOptions['readStatus']
): Bookmark[] {
  if (mode === 'feed' || readStatus === 'unread') {
    return bookmarks.filter((bookmark) => !bookmarkIsRead(bookmark));
  }

  if (readStatus === 'read') {
    return bookmarks.filter(bookmarkIsRead);
  }

  return bookmarks;
}

export function useBookmarks({
  mode = 'library',
  readStatus = 'all',
}: UseBookmarksOptions = {}): UseBookmarksResult {
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

      setIsOffline(false);
      if (mode === 'library' && readStatus === 'all') {
        cacheLibraryPageInBackground(userId, newBookmarks, { reset });
      } else {
        cacheBookmarksInBackground(userId, newBookmarks);
      }

      // If we received fewer than PAGE_SIZE items, there are no more
      setHasMore(newBookmarks.length === PAGE_SIZE);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bookmarks';

      if (reset && !isAuthError(err)) {
        const cachedBookmarks = filterCachedBookmarks(
          await getCachedLibrary(userId),
          mode,
          readStatus
        );
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
  }, [mode, offset, readStatus, user?.id]);

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
    // Fetch when the signed-in user, mode, or filter changes; offset changes are handled by explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, readStatus]);

  const toggleRead = useCallback(async (bookmark: Bookmark) => {
    const currentIsRead = bookmark.isRead ?? Boolean(bookmark.readAt);
    const updated = currentIsRead
      ? await BookmarksAPI.markUnread(bookmark.id)
      : await BookmarksAPI.markRead(bookmark.id);

    cacheBookmarksInBackground(user?.id, [updated]);

    setBookmarks((prev) => {
      if (mode === 'feed' && bookmarkIsRead(updated)) {
        return prev.filter((item) => item.id !== bookmark.id);
      }

      if (mode === 'library' && readStatus !== 'all') {
        const updatedIsRead = bookmarkIsRead(updated);
        const matchesFilter =
          (readStatus === 'read' && updatedIsRead) ||
          (readStatus === 'unread' && !updatedIsRead);

        if (!matchesFilter) {
          return prev.filter((item) => item.id !== bookmark.id);
        }
      }

      return prev.map((item) => (item.id === bookmark.id ? updated : item));
    });
  }, [mode, readStatus, user?.id]);

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
