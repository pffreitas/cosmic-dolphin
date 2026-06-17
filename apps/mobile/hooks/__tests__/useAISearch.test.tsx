import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAuth } from '@/contexts/AuthContext';
import { HybridSearchResultItem, SearchAPI, Bookmark } from '@/lib/api';
import { cacheBookmarksInBackground } from '@/lib/bookmark-cache';
import { useAISearch } from '../useAISearch';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  SearchAPI: {
    askWithStream: jest.fn(),
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
    title: 'AI Result Article',
    userId,
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    isPrivateLink: false,
    isPublic: false,
    processingStatus: 'completed',
    ...overrides,
  };
}

describe('useAISearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: userId },
    });
  });

  it('returns streamed search results and caches their bookmarks in the background', async () => {
    const bookmark = makeBookmark();
    const searchResult: HybridSearchResultItem = {
      bookmark,
      score: 0.9,
      matchedChunks: ['matched text'],
    };

    (SearchAPI.askWithStream as jest.Mock).mockImplementation(async (_query, callbacks) => {
      callbacks.onResults([searchResult]);
      callbacks.onDone();
    });

    const { result } = renderHook(() => useAISearch());

    act(() => {
      result.current.executeSearch('article');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(result.current.results).toEqual([searchResult]);
    expect(cacheBookmarksInBackground).toHaveBeenCalledWith(userId, [bookmark]);
  });
});
