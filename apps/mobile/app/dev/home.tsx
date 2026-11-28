import React from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { HomeFeedFixtureContext } from "@/hooks/HomeFeedFixtureContext";
import HomeScreen from "../(tabs)/index";
import { FeedItemFromJSON, type Bookmark, type ContinueReadingItem, type FeedItem } from "@cosmic-dolphin/api-client";
import data from "../../dev/home-fixture.json";

const bookmark = (value: typeof data.items[number]["bookmark"]): Bookmark => ({
  ...value, createdAt: new Date(value.createdAt), updatedAt: new Date(value.updatedAt), processingStatus: "completed",
});
const items = data.items.map(item => ({ ...item, bookmark: bookmark(item.bookmark) })) as FeedItem[];
const resume = data.resume.map(item => ({ ...item, bookmark: bookmark(item.bookmark), progress: { ...item.progress, updatedAt: new Date(item.progress.updatedAt) } })) as ContinueReadingItem[];
/** Matched sample content. No session or production-data proof is implied. */
export default function HomeGallery() {
  const { state, nav } = useLocalSearchParams<{ state?: string; nav?: string }>();
  if (!__DEV__) return <Text>Not found</Text>;
  const empty = state === "empty" || state === "new-user";
  const fixture = { collections: nav === "populated" ? data.navigation.collections : [], readerEmail: data.navigation.email, items: empty ? [] : state === "full" ? data.fullItems.map(FeedItemFromJSON) : items, resume: empty ? [] : resume,
    computedAt: new Date(data.computedAt), now: new Date(data.now), readerName: data.readerName,
    counts: state === "new-user" ? { ...data.counts, all: 0, unread: 0 } : nav === "populated" ? data.navigation.counts : data.counts, loading: state === "loading" };
  return <HomeFeedFixtureContext.Provider value={fixture}><View style={{ flex: 1 }}><HomeScreen key={state ?? "populated"} /></View></HomeFeedFixtureContext.Provider>;
}
