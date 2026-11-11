import AsyncStorage from "@react-native-async-storage/async-storage";
import { FeedItemFromJSON, TodayPicksResponseFromJSON, ContinueReadingItemFromJSON,
  type BookmarkLibraryCounts, type ContinueReadingItem, type FeedItem, type FeedScope, type TodayPicksResponse } from "@cosmic-dolphin/api-client";
export interface HomeFeedCache {
  userId: string;
  scope: FeedScope;
  items: FeedItem[];
  picks?: TodayPicksResponse;
  resume: ContinueReadingItem[];
  counts?: BookmarkLibraryCounts;
  cursor?: string;
}
const key = (userId: string, scope: FeedScope) => `home-feed:v1:${userId}:${scope}`;
export async function readHomeFeedCache(userId: string, scope: FeedScope): Promise<HomeFeedCache | undefined> {
  try {
    const stored = await AsyncStorage.getItem(key(userId, scope));
    if (!stored) return;
    const value = JSON.parse(stored);
    if (value.userId !== userId || value.scope !== scope || !Array.isArray(value.items) || !Array.isArray(value.resume)) return;
    return { ...value, items: value.items.map(FeedItemFromJSON),
      picks: value.picks ? TodayPicksResponseFromJSON(value.picks) : undefined,
      resume: value.resume.map(ContinueReadingItemFromJSON) };
  } catch { return; }
}
export async function writeHomeFeedCache(value: HomeFeedCache) {
  await AsyncStorage.setItem(key(value.userId, value.scope), JSON.stringify(value));
}
