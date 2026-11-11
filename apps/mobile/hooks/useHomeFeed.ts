import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { BookmarkLibraryCounts, ContinueReadingItem, FeedItem, FeedScope, TodayPicksResponse } from "@cosmic-dolphin/api-client";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { readHomeFeedCache, writeHomeFeedCache, type HomeFeedCache } from "@/lib/home-feed-cache";
import { MobileAPI } from "@/lib/mobile-api";
export function useHomeFeed(scope: FeedScope) {
  const { user } = useAuth();
  const userId = user?.id;
  const { revision } = useCaptures();
  const generation = useRef(0);
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
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    if (!userId) { setItems([]); setPicks(undefined); setLoading(false); return; }
    setRefreshing(true);
    if (!cached.current) {
      const stored = await readHomeFeedCache(userId, scope);
      if (token !== generation.current) return;
      cached.current = stored;
    }
    if (token !== generation.current) return;
    const results = await Promise.allSettled([
      MobileAPI.feed(scope),
      scope === "for_you" ? MobileAPI.picks() : Promise.resolve(undefined),
      scope === "for_you" ? MobileAPI.resume() : Promise.resolve({ items: [] }),
      scope === "for_you" ? MobileAPI.counts() : Promise.resolve(undefined),
    ]);
    if (token !== generation.current) return;
    const [feed, daily, reading, totals] = results;
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
    if (feed.status === "fulfilled") { setItems(feed.value.items); setCursor(feed.value.nextCursor); setError(undefined); }
    else setError("Some reading suggestions could not be loaded. Pull to refresh or try again.");
    if (daily.status === "fulfilled") { setPicks(daily.value); setPicksError(undefined); }
    else setPicksError("Today's picks couldn't load.");
    if (reading.status === "fulfilled") setResume(reading.value.items);
    if (totals.status === "fulfilled") setCounts(totals.value);
    setLoading(false); setRefreshing(false);
  }, [scope, userId, revision]);
  useFocusEffect(useCallback(() => {
    const key = `${userId}:${scope}`;
    if (currentKey.current !== key) {
      currentKey.current = key; cached.current = undefined;
      setLoading(true); setItems([]); setPicks(undefined); setResume([]); setCursor(undefined); setCounts(undefined); setOffline(false); setError(undefined); setPicksError(undefined);
    }
    void refresh();
    return () => { generation.current++; };
  }, [refresh, userId, scope]));
  const loadMore = async () => {
    if (busy.current || !cursor || scope === "for_you") return;
    busy.current = true; setMore(true);
    const token = generation.current;
    try {
      const page = await MobileAPI.feed(scope, cursor);
      if (token !== generation.current) return;
      setItems(previous => [...previous, ...page.items]); setCursor(page.nextCursor); setError(undefined);
    } catch { if (token === generation.current) setError("The next reading lists could not be loaded. Try again."); }
    finally { busy.current = false; setMore(false); }
  };
  return { items, picks, picksError, counts, offline, resume, loading, refreshing, refresh, loadMore, more, hasMore: Boolean(cursor) && scope !== "for_you", error };
}
