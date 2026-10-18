import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type {
  ContinueReadingItem,
  FeedItem,
  FeedScope,
} from "@cosmic-dolphin/api-client";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { MobileAPI } from "@/lib/mobile-api";
export function useHomeFeed(scope: FeedScope) {
  const { user } = useAuth();
  const userId = user?.id;
  const { revision } = useCaptures();
  const generation = useRef(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [resume, setResume] = useState<ContinueReadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [exploreCursor, setExploreCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(undefined);
    const results = await Promise.allSettled([
      MobileAPI.feed(scope),
      scope === "for_you" ? MobileAPI.explore() : Promise.resolve(null),
      MobileAPI.resume(),
    ]);
    if (token !== generation.current) return;
    const [feed, explore, reading] = results;
    const next = feed.status === "fulfilled" ? feed.value.items : [];
    const discovered =
      explore.status === "fulfilled" ? (explore.value?.items ?? []) : [];
    setItems([...next, ...discovered]);
    setCursor(feed.status === "fulfilled" ? feed.value.nextCursor : undefined);
    setExploreCursor(
      explore.status === "fulfilled" ? explore.value?.nextCursor : undefined,
    );
    setResume(reading.status === "fulfilled" ? reading.value.items : []);
    if (feed.status === "rejected" || explore.status === "rejected")
      setError(
        "Some reading suggestions could not be loaded. Pull to refresh or try again.",
      );
    setLoading(false);
    setRefreshing(false);
  }, [scope, userId, revision]);
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setItems([]);
      setResume([]);
      setCursor(undefined);
      setExploreCursor(undefined);
      void refresh();
      return () => {
        generation.current++;
      };
    }, [refresh]),
  );
  const loadMore = async () => {
    if (busy.current || (!cursor && !exploreCursor)) return;
    busy.current = true;
    setMore(true);
    const token = generation.current;
    try {
      const pages = await Promise.all([
        cursor ? MobileAPI.feed(scope, cursor) : Promise.resolve(null),
        exploreCursor
          ? MobileAPI.explore(exploreCursor)
          : Promise.resolve(null),
      ]);
      if (token !== generation.current) return;
      setItems((previous) => [
        ...previous,
        ...pages.flatMap((page) => page?.items ?? []),
      ]);
      setCursor(pages[0]?.nextCursor);
      setExploreCursor(pages[1]?.nextCursor);
      setError(undefined);
    } catch {
      if (token === generation.current)
        setError("The next reading lists could not be loaded. Try again.");
    } finally {
      busy.current = false;
      setMore(false);
    }
  };
  return {
    items,
    resume,
    loading,
    refreshing,
    refresh,
    loadMore,
    more,
    hasMore: Boolean(cursor || exploreCursor),
    error,
  };
}
