import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

import { Bookmark } from './api';

const CACHE_VERSION = 1;
const CACHE_PREFIX = `bookmark-cache:v${CACHE_VERSION}`;

interface CachedBookmarkRecord {
  version: typeof CACHE_VERSION;
  userId: string;
  bookmark: Bookmark;
  sourceUpdatedAt: string;
  cachedAt: string;
}

interface CachedLibraryIndex {
  version: typeof CACHE_VERSION;
  userId: string;
  bookmarkIds: string[];
  cachedAt: string;
}

interface LibraryPageInfo {
  reset?: boolean;
}

function namespacePrefix(userId: string): string {
  return `${CACHE_PREFIX}:${userId}:`;
}

function indexKey(userId: string): string {
  return `${namespacePrefix(userId)}index`;
}

function bookmarkKey(userId: string, bookmarkId: string): string {
  return `${namespacePrefix(userId)}bookmark:${bookmarkId}`;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getBookmarkTimestamp(bookmark: Bookmark): number {
  const timestamp = Date.parse(bookmark.updatedAt || bookmark.createdAt || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRecordTimestamp(record: CachedBookmarkRecord): number {
  const timestamp = Date.parse(record.sourceUpdatedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

async function readIndex(userId: string): Promise<CachedLibraryIndex> {
  const parsed = parseJson<CachedLibraryIndex>(await AsyncStorage.getItem(indexKey(userId)));

  if (!parsed || parsed.version !== CACHE_VERSION || parsed.userId !== userId) {
    return {
      version: CACHE_VERSION,
      userId,
      bookmarkIds: [],
      cachedAt: new Date(0).toISOString(),
    };
  }

  return {
    ...parsed,
    bookmarkIds: uniqueIds(parsed.bookmarkIds || []),
  };
}

async function writeIndex(userId: string, bookmarkIds: string[]): Promise<void> {
  const index: CachedLibraryIndex = {
    version: CACHE_VERSION,
    userId,
    bookmarkIds: uniqueIds(bookmarkIds),
    cachedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(indexKey(userId), JSON.stringify(index));
}

async function readRecord(
  userId: string,
  bookmarkId: string
): Promise<CachedBookmarkRecord | null> {
  const parsed = parseJson<CachedBookmarkRecord>(
    await AsyncStorage.getItem(bookmarkKey(userId, bookmarkId))
  );

  if (!parsed || parsed.version !== CACHE_VERSION || parsed.userId !== userId) {
    return null;
  }

  return parsed;
}

function scheduleCacheWork(work: () => Promise<void>): void {
  InteractionManager.runAfterInteractions(() => {
    work().catch((error) => {
      console.warn('Failed to update bookmark cache:', error);
    });
  });
}

export async function getCachedBookmark(
  userId: string,
  bookmarkId: string
): Promise<Bookmark | null> {
  const record = await readRecord(userId, bookmarkId);
  return record?.bookmark ?? null;
}

export async function getCachedLibrary(userId: string): Promise<Bookmark[]> {
  const index = await readIndex(userId);
  const bookmarks = await Promise.all(
    index.bookmarkIds.map((bookmarkId) => getCachedBookmark(userId, bookmarkId))
  );

  return bookmarks.filter((bookmark): bookmark is Bookmark => bookmark !== null);
}

export async function cacheBookmarks(
  userId: string,
  bookmarks: Bookmark[]
): Promise<void> {
  await Promise.all(
    bookmarks.map(async (bookmark) => {
      const existingRecord = await readRecord(userId, bookmark.id);
      const incomingTimestamp = getBookmarkTimestamp(bookmark);

      if (
        existingRecord &&
        getRecordTimestamp(existingRecord) >= incomingTimestamp
      ) {
        return;
      }

      const record: CachedBookmarkRecord = {
        version: CACHE_VERSION,
        userId,
        bookmark,
        sourceUpdatedAt: bookmark.updatedAt || bookmark.createdAt,
        cachedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(
        bookmarkKey(userId, bookmark.id),
        JSON.stringify(record)
      );
    })
  );
}

export function cacheBookmarksInBackground(
  userId: string | undefined,
  bookmarks: Bookmark[]
): void {
  if (!userId || bookmarks.length === 0) return;
  scheduleCacheWork(() => cacheBookmarks(userId, bookmarks));
}

export async function cacheLibraryPage(
  userId: string,
  bookmarks: Bookmark[],
  pageInfo: LibraryPageInfo = {}
): Promise<void> {
  await cacheBookmarks(userId, bookmarks);

  const existingIndex = await readIndex(userId);
  const bookmarkIds = bookmarks.map((bookmark) => bookmark.id);
  const nextIds = pageInfo.reset
    ? bookmarkIds
    : uniqueIds([...existingIndex.bookmarkIds, ...bookmarkIds]);

  await writeIndex(userId, nextIds);
}

export function cacheLibraryPageInBackground(
  userId: string | undefined,
  bookmarks: Bookmark[],
  pageInfo: LibraryPageInfo = {}
): void {
  if (!userId) return;
  scheduleCacheWork(() => cacheLibraryPage(userId, bookmarks, pageInfo));
}

export async function removeCachedBookmark(
  userId: string,
  bookmarkId: string
): Promise<void> {
  const index = await readIndex(userId);
  const nextIds = index.bookmarkIds.filter((id) => id !== bookmarkId);

  await Promise.all([
    AsyncStorage.removeItem(bookmarkKey(userId, bookmarkId)),
    writeIndex(userId, nextIds),
  ]);
}

export async function clearBookmarkCache(userId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const userKeys = keys.filter((key) => key.startsWith(namespacePrefix(userId)));

  if (userKeys.length > 0) {
    await AsyncStorage.multiRemove(userKeys);
  }
}
