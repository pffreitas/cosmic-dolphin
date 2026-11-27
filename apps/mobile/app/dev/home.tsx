import React from "react";
import { Text, View } from "react-native";
import { HomeFeedFixtureContext } from "@/hooks/HomeFeedFixtureContext";
import HomeScreen from "../(tabs)/index";
import { HomeTabBar } from "@/components/web-home/Chrome";
import type { Bookmark, ContinueReadingItem, FeedItem } from "@cosmic-dolphin/api-client";

const date = new Date("2026-11-26T23:00:00Z");
const bookmark = (id: string, title: string, url: string, summary: string, tags: string[]): Bookmark => ({
  id, userId: "fixture-reader", title, sourceUrl: url, createdAt: new Date(date.getTime() - 2 * 86400000), updatedAt: date,
  cosmicBriefSummary: summary, cosmicTags: tags, processingStatus: "completed", metadata: { readingTime: 9 },
});
const lead = bookmark("bk_8f2a", "The Bottleneck Was Never Retrieval", "https://every.to", "Agents don't fail because they can't find the right document — they fail because they can't remember what they already tried. A case for episodic memory over bigger context windows.", ["agent memory", "retrieval"]);
lead.likeCount = 128; lead.commentCount = 14;
const items: FeedItem[] = [
  { type: "followed_save", bookmark: lead, actor: { id: "maya", handle: "maya", name: "Maya Okafor" }, rankingReason: "You saved several pieces about agent memory this week." },
  { type: "own_save", bookmark: bookmark("bk_3e77", "The cost of a perfect index", "https://stratechery.com", "Retrieval quality has a price curve, and most teams are buying the flat part of it.", ["retrieval", "cost"]), rankingReason: "You have been reading about retrieval." },
];
const resume: ContinueReadingItem[] = [
  { bookmark: bookmark("bk_1", "What agents forget, and when", "https://every.to", "", []), progress: { percent: 64 } },
  { bookmark: bookmark("bk_2", "A short history of retrieval-augmented generation", "https://arxiv.org", "", []), progress: { percent: 22 } },
  { bookmark: bookmark("bk_3", "Typography for long-form reading on screens", "https://example.com", "", []), progress: { percent: 91 } },
] as ContinueReadingItem[];
const fixture = { items, resume, computedAt: date, readerName: "Paulo Freitas", counts: { all: 24, unread: 12, archived: 0, inbox: 3, collections: [] } };
export default function HomeGallery() {
  if (!__DEV__) return <Text>Not found</Text>;
  return <HomeFeedFixtureContext.Provider value={fixture}><View style={{ flex: 1 }}><HomeScreen /><HomeTabBar /></View></HomeFeedFixtureContext.Provider>;
}
