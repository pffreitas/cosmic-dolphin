import { HomeFeedFixtureContext } from "./HomeFeedFixtureContext";
import { useCallback, useContext, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Bookmark, BookmarkLibraryCounts, ContinueReadingItem, FeedItem, FeedScope, TodayPicksResponse } from "@cosmic-dolphin/api-client";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { readHomeFeedCache, writeHomeFeedCache, type HomeFeedCache } from "@/lib/home-feed-cache";
import { MobileAPI } from "@/lib/mobile-api";
import { nextReadingSequence } from "@/lib/reading-sequence";
export function useHomeFeed(scope: FeedScope, options?: { edition?: boolean }) {
  const fixtureValue = useContext(HomeFeedFixtureContext);
  const fixture = __DEV__ ? fixtureValue : undefined;
  const edition = options?.edition ?? false;
  const { user } = useAuth();
  const userId = user?.id;
  const { revision } = useCaptures();
  const generation = useRef(0);
  const busy = useRef<symbol>();
  const key = `${userId}:${scope}:${edition}`;
  const activeKey = useRef(key);
  // Fence the render and old continuations before focus-effect cleanup runs.
  if (activeKey.current !== key) {
    activeKey.current = key;
    generation.current++;
    busy.current = undefined;
  }
  const currentKey = useRef<string>();
  const cached = useRef<HomeFeedCache>();
  const [offline, setOffline] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [picks, setPicks] = useState<TodayPicksResponse>();
  const [counts, setCounts] = useState<BookmarkLibraryCounts>();
  const [resume, setResume] = useState<ContinueReadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [picksError, setPicksError] = useState<string>();
  const [serverRead, setServerRead] = useState<{ sequence: number; bookmarks: Bookmark[] }>();
  const [computedAt, setComputedAt] = useState<Date>();
  const refresh = useCallback(async () => {
    if (fixture) return;
    if (activeKey.current !== `${userId}:${scope}:${edition}`) return;
    const token = ++generation.current;
    busy.current = undefined;
    setMore(false);
    if (!userId) { setItems([]); setPicks(undefined); setLoading(false); return; }
    setRefreshing(true);
    if (!cached.current) {
      const stored = await readHomeFeedCache(userId, scope);
      if (token !== generation.current) return;
      cached.current = stored;
    }
    if (token !== generation.current) return;
    const readSequence = nextReadingSequence();
    const results = await Promise.allSettled([
      MobileAPI.feed(scope),
      !edition && scope === "for_you" ? MobileAPI.picks() : Promise.resolve(undefined),
      edition || scope === "for_you" ? MobileAPI.resume() : Promise.resolve({ items: [] }),
      edition || scope === "for_you" ? MobileAPI.counts() : Promise.resolve(undefined),
    ]);
    if (token !== generation.current) return;
    const [feed, daily, reading, totals] = results;
    setServerRead({ sequence: readSequence, bookmarks: [
      ...(feed.status === "fulfilled" ? feed.value.items.flatMap(item => item.bookmark ? [item.bookmark] : []) : []),
      ...(daily.status === "fulfilled" ? daily.value?.items.map(pick => pick.bookmark) ?? [] : []),
    ] });
    const previous = cached.current;
    const next: HomeFeedCache = { userId, scope,
      items: feed.status === "fulfilled" ? feed.value.items : (previous?.items ?? []),
      cursor: feed.status === "fulfilled" ? feed.value.nextCursor : previous?.cursor,
      picks: daily.status === "fulfilled" ? daily.value : previous?.picks,
      resume: reading.status === "fulfilled" ? reading.value.items : (previous?.resume ?? []),
      counts: totals.status === "fulfilled" ? totals.value : previous?.counts,
    };
    const connectionFailed = [feed, daily].some(result =>
      result.status === "rejected" && !result.reason?.response?.status,
    );
    setOffline(!!previous && connectionFailed);
    setItems(next.items); setCursor(next.cursor); setPicks(next.picks); setResume(next.resume); setCounts(next.counts);
    if (feed.status === "fulfilled" || daily.status === "fulfilled" && daily.value) {
      cached.current = next;
      void writeHomeFeedCache(next).catch(() => {});
    }
    if (feed.status === "fulfilled") { setItems(feed.value.items); setCursor(feed.value.nextCursor); setComputedAt(feed.value.computedAt); setError(undefined); }
    else setError("Some reading suggestions could not be loaded. Pull to refresh or try again.");
    if (daily.status === "fulfilled") { setPicks(daily.value); setPicksError(undefined); }
    else setPicksError("Today's picks couldn't load.");
    if (reading.status === "fulfilled") setResume(reading.value.items);
    if (totals.status === "fulfilled") setCounts(totals.value);
    setLoading(false); setRefreshing(false);
  }, [scope, userId, revision, edition, fixture]);
  useFocusEffect(useCallback(() => {
    const key = `${userId}:${scope}:${edition}`;
    if (currentKey.current !== key) {
      currentKey.current = key; cached.current = undefined;
      setLoading(true); setItems([]); setPicks(undefined); setResume([]); setCursor(undefined); setCounts(undefined); setOffline(false); setError(undefined); setPicksError(undefined);
      setServerRead(undefined);
      setComputedAt(undefined);
    }
    void refresh();
    return () => { generation.current++; };
  }, [refresh, userId, scope, edition]));
  const loadMore = async () => {
    if (fixture) return;
    if (busy.current || !cursor || !edition && scope === "for_you") return;
    const job = Symbol(); busy.current = job; setMore(true);
    const token = generation.current;
    try {
      const page = await MobileAPI.feed(scope, cursor);
      if (token !== generation.current) return;
      setItems(previous => {
        const seen = new Set(previous.map(item => item.bookmark?.id ?? item.digest?.id));
        return [...previous, ...page.items.filter(item => !seen.has(item.bookmark?.id ?? item.digest?.id))];
      }); setCursor(page.nextCursor); setError(undefined);
    } catch { if (token === generation.current) setError("The next reading lists could not be loaded. Try again."); }
    finally { if (busy.current === job) busy.current = undefined; if (token === generation.current) setMore(false); }
  };
  const owned = currentKey.current === key;
  return { items: owned ? items : [], picks: owned ? picks : undefined,
    picksError: owned ? picksError : undefined, counts: owned ? counts : undefined,
    offline: owned && offline, resume: owned ? resume : [], serverRead: owned ? serverRead : undefined,
    loading: !owned || loading, refreshing: owned && refreshing, refresh, loadMore,
    computedAt: owned ? computedAt : undefined,
    more: owned && more, hasMore: owned && Boolean(cursor) && (edition || scope !== "for_you"), error: owned ? error : undefined,
    readerName: fixture?.readerName,
    ...(fixture ? { ...fixture, loading: fixture.loading ?? false, refreshing: false, error: undefined, offline: false, more: false, hasMore: false } : {}) };
}
