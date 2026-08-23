import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  cacheBookmarks,
  cacheLibraryPage,
  clearBookmarkCache,
  getCachedBookmark,
  getCachedLibrary,
  removeCachedBookmark,
} from '../bookmark-cache';
import { Bookmark } from '../api';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const userId = 'user-1';

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bookmark-1',
    sourceUrl: 'https://example.com/article',
    title: 'Cached Article',
    userId,
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    isPrivateLink: false,
    isPublic: false,
    processingStatus: 'completed',
    ...overrides,
  };
}

describe('bookmark cache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('persists a refreshed library page and returns bookmarks in library order', async () => {
    const first = makeBookmark({ id: 'bookmark-1', title: 'First' });
    const second = makeBookmark({ id: 'bookmark-2', title: 'Second' });

    await cacheLibraryPage(userId, [first, second], { reset: true });

    await expect(getCachedLibrary(userId)).resolves.toEqual([first, second]);
    await expect(getCachedBookmark(userId, 'bookmark-1')).resolves.toEqual(first);
  });

  it('appends loaded pages without duplicating existing bookmarks', async () => {
    const first = makeBookmark({ id: 'bookmark-1', title: 'First' });
    const second = makeBookmark({ id: 'bookmark-2', title: 'Second' });
    const updatedFirst = makeBookmark({
      id: 'bookmark-1',
      title: 'First updated',
      updatedAt: '2026-06-03T12:00:00.000Z',
    });

    await cacheLibraryPage(userId, [first], { reset: true });
    await cacheLibraryPage(userId, [second, updatedFirst], { reset: false });

    await expect(getCachedLibrary(userId)).resolves.toEqual([updatedFirst, second]);
  });

  it('does not overwrite a newer cached bookmark with stale data', async () => {
    const newer = makeBookmark({
      title: 'Newer cached title',
      updatedAt: '2026-06-03T12:00:00.000Z',
    });
    const older = makeBookmark({
      title: 'Older network title',
      updatedAt: '2026-06-02T12:00:00.000Z',
    });

    await cacheBookmarks(userId, [newer]);
    await cacheBookmarks(userId, [older]);

    await expect(getCachedBookmark(userId, newer.id)).resolves.toEqual(newer);
  });

  it('removes individual bookmarks from records and the library index', async () => {
    const first = makeBookmark({ id: 'bookmark-1', title: 'First' });
    const second = makeBookmark({ id: 'bookmark-2', title: 'Second' });

    await cacheLibraryPage(userId, [first, second], { reset: true });
    await removeCachedBookmark(userId, 'bookmark-1');

    await expect(getCachedBookmark(userId, 'bookmark-1')).resolves.toBeNull();
    await expect(getCachedLibrary(userId)).resolves.toEqual([second]);
  });

  it('clears only the signed-in user namespace', async () => {
    const otherUserId = 'user-2';
    const first = makeBookmark({ id: 'bookmark-1', userId });
    const other = makeBookmark({ id: 'bookmark-2', userId: otherUserId });

    await cacheLibraryPage(userId, [first], { reset: true });
    await cacheLibraryPage(otherUserId, [other], { reset: true });

    await clearBookmarkCache(userId);

    await expect(getCachedLibrary(userId)).resolves.toEqual([]);
    await expect(getCachedLibrary(otherUserId)).resolves.toEqual([other]);
  });
});
