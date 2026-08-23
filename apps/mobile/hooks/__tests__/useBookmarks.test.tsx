import { renderHook, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/contexts/AuthContext';
import { BookmarksAPI, Bookmark } from '@/lib/api';
import {
  cacheLibraryPageInBackground,
  getCachedLibrary,
} from '@/lib/bookmark-cache';
import { useBookmarks } from '../useBookmarks';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  BookmarksAPI: {
    list: jest.fn(),
  },
}));

jest.mock('@/lib/bookmark-cache', () => ({
  cacheLibraryPageInBackground: jest.fn(),
  getCachedLibrary: jest.fn(),
}));

const userId = 'user-1';

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bookmark-1',
    sourceUrl: 'https://example.com/article',
    title: 'Library Article',
    userId,
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    isPrivateLink: false,
    isPublic: false,
    processingStatus: 'completed',
    ...overrides,
  };
}

describe('useBookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: userId },
    });
    (getCachedLibrary as jest.Mock).mockResolvedValue([]);
  });

  it('renders online bookmarks and caches the refreshed page in the background', async () => {
    const bookmark = makeBookmark();
    (BookmarksAPI.list as jest.Mock).mockResolvedValue([bookmark]);

    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks).toEqual([bookmark]);
    expect(result.current.isOffline).toBe(false);
    expect(cacheLibraryPageInBackground).toHaveBeenCalledWith(userId, [bookmark], {
      reset: true,
    });
  });

  it('serves cached bookmarks when the initial online fetch fails', async () => {
    const cachedBookmark = makeBookmark({ title: 'Offline Article' });
    (BookmarksAPI.list as jest.Mock).mockRejectedValue(new Error('Network error'));
    (getCachedLibrary as jest.Mock).mockResolvedValue([cachedBookmark]);

    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks).toEqual([cachedBookmark]);
    expect(result.current.error).toBeNull();
    expect(result.current.isOffline).toBe(true);
  });

  it('returns an error when online fetch fails and no cached bookmarks exist', async () => {
    (BookmarksAPI.list as jest.Mock).mockRejectedValue(new Error('Network error'));
    (getCachedLibrary as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks).toEqual([]);
    expect(result.current.error).toBe('Network error');
    expect(result.current.isOffline).toBe(false);
  });

  it('does not serve cached bookmarks when the online fetch fails with an auth error', async () => {
    const cachedBookmark = makeBookmark({ title: 'Offline Article' });
    const authError = Object.assign(new Error('HTTP error! status: 401'), {
      status: 401,
    });
    (BookmarksAPI.list as jest.Mock).mockRejectedValue(authError);
    (getCachedLibrary as jest.Mock).mockResolvedValue([cachedBookmark]);

    const { result } = renderHook(() => useBookmarks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks).toEqual([]);
    expect(result.current.error).toBe('HTTP error! status: 401');
    expect(result.current.isOffline).toBe(false);
  });
});
