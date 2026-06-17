import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/contexts/AuthContext';
import { BookmarksAPI, Bookmark } from '@/lib/api';
import { cacheBookmarksInBackground } from '@/lib/bookmark-cache';
import { useSearch } from '../useSearch';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  BookmarksAPI: {
    search: jest.fn(),
  },
}));

jest.mock('@/lib/bookmark-cache', () => ({
  cacheBookmarksInBackground: jest.fn(),
}));

const userId = 'user-1';

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bookmark-1',
    sourceUrl: 'https://example.com/article',
    title: 'Search Article',
    userId,
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    isPrivateLink: false,
    isPublic: false,
    processingStatus: 'completed',
    ...overrides,
  };
}

describe('useSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: userId },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns online search results and caches them in the background', async () => {
    const bookmark = makeBookmark();
    (BookmarksAPI.search as jest.Mock).mockResolvedValue([bookmark]);

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('article');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(result.current.results).toEqual([bookmark]));
    expect(cacheBookmarksInBackground).toHaveBeenCalledWith(userId, [bookmark]);
  });
});
