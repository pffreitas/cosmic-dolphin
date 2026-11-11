import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { type FeedScope, type ContinueReadingItem, type FeedItem } from "@cosmic-dolphin/api-client";
import { CaptureStatus } from "@/components/CaptureStatus";
import { CaptureFailureToast } from "@/components/CaptureFailureToast";
import { TopBarAction } from "@/components/TopBar";
import { FeedCard } from "@/components/FeedCard";
import { Toast } from "@/components/Toast";
import { useBookmarkActions } from "@/lib/bookmark-actions";
import { BookmarkActionSheets, type ActionSheet } from "@/components/BookmarkActionSheets";
import { TodayProgress, TodaySkeleton } from "@/components/TodayProgress";
import { CopiedLink } from "@/components/CopiedLink";
import { Button, Chip, EmptyState, Notice, Screen, Segments, SkeletonRows } from "@/components/ui/Signal";
import { textStyle } from "@/constants/fonts";
import { space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useCaptures } from "@/contexts/CaptureContext";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeFeed } from "@/hooks/useHomeFeed";
import { nativeBookmark } from "@/lib/mobile-api";
import { useControlFocus } from "@/hooks/useControlFocus";
import { rememberEditions } from "@/lib/edition-store";
import { buildEditions, topicName } from "@/lib/home-editions";

export default function HomeScreen() {
  const router = useRouter();
  const rootNavigation = useNavigation("/");
  const { colors } = useTheme();
  const { user } = useAuth();
  const { controller, state: actionState } = useBookmarkActions(user?.id);
  const [selection, setSelection] = useState<ActionSheet>();
  const cardActions = (item: FeedItem) => ({
    done: item.bookmark ? () => controller.done(item.bookmark!, true) : undefined,
    later: () => setSelection({ item, mode: "later" }),
    tonight: item.bookmark ? () => controller.later(item.bookmark!) : undefined,
    more: () => setSelection({ item, mode: "menu" }),
    save: () => controller.save(item),
  });
  const [scope, setScope] = useState<FeedScope>("for_you");
  const [topic, setTopic] = useState("All topics");
  const feed = useHomeFeed(scope);
  const { drain, changeError } = useCaptures();
  useEffect(() => {
    if (feed.serverRead) controller.synchronize(feed.serverRead.bookmarks, feed.serverRead.sequence);
  }, [controller, feed.serverRead]);
  useEffect(() => { if (user) rememberEditions(user.id, buildEditions(feed.items)); }, [user, feed.items]);
  const originalBookmarks = new Map([...(feed.picks?.items.map(pick => pick.bookmark) ?? []), ...feed.items.flatMap(item => item.bookmark ? [item.bookmark] : [])].map(bookmark => [bookmark.id, bookmark]));
  const unreadDelta = [...originalBookmarks.values()].filter(bookmark => bookmark.userId === user?.id).reduce((delta, bookmark) => {
    const current = controller.view(bookmark);
    return delta + Number(!current.isArchived && !current.readAt) - Number(!bookmark.isArchived && !bookmark.readAt);
  }, 0);
  const unreadCount = Math.max(0, (feed.counts?.unread ?? 0) + unreadDelta);
  const topics = [...new Set(feed.items.flatMap(item => (item.bookmark?.cosmicTags ?? []).map(topicName)))];
  const visiblePicks = feed.picks?.items.map(pick => ({ ...pick, bookmark: controller.view(pick.bookmark) })).filter(pick => controller.isVisible({ type: "own_save", bookmark: pick.bookmark })) ?? [];
  const pickIds = new Set(feed.picks?.items.map(item => item.bookmark.id));
  const wholeFailure = scope === "for_you" && !!feed.error && !!feed.picksError && !feed.items.length && !feed.picks;
  const firstRun = !feed.error && !feed.picksError && scope === "for_you" && !feed.loading && !feed.picks?.computedAt && feed.counts?.all === 0 && feed.counts.archived === 0;
  const filtered = feed.items.filter(item => controller.isVisible(item) && !((item.type === "own_save" || item.type === "pending") && controller.view(item.bookmark!).readAt)).map(item => ({ ...item, bookmark: item.bookmark ? controller.view(item.bookmark) : undefined })).filter(item => topic === "All topics" || item.bookmark?.cosmicTags?.map(topicName).includes(topic));
  const visible = scope === "for_you" ? filtered.filter(item =>
    item.type !== "pending" && item.bookmark?.processingStatus !== "processing" &&
    (!item.bookmark || !pickIds.has(item.bookmark.id)) &&
    (!item.bookmark?.laterUntil || item.type === "followed_save" || item.type === "reshare" || new Date(item.bookmark.laterUntil).getTime() <= Date.now())
  ).slice(0, 10) : filtered;
  return <Screen title="Cosmic Dolphin" actions={<>
    <TopBarAction icon="search-outline" label="Search" onPress={() => router.push("/search")} />
    <TopBarAction icon="person-outline" label="Your profile"
      avatar={{ uri: user?.user_metadata?.avatar_url || user?.user_metadata?.picture, initial: (user?.user_metadata?.full_name || user?.email || "You").slice(0, 1).toUpperCase() }}
      onPress={() => rootNavigation.navigate("profile" as never)} />
  </>}>
    <FlatList data={feed.loading ? [] : visible} keyExtractor={(item, index) => item.bookmark?.id || item.digest?.id || String(index)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={feed.refreshing && !feed.loading} onRefresh={() => { void drain().catch(() => {}).then(feed.refresh); }} tintColor={colors.accent} />}
      ListHeaderComponent={<View>
        <View style={styles.scopes}><Segments options={[
          { label: "For you", value: "for_you" }, { label: "Following", value: "following" }, { label: "Unread", value: "unread" },
        ]} value={scope} onChange={value => { setTopic("All topics"); setScope(value); }} /></View>
        {topics.length ? <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: space.s4, gap: space.s2 }}>
          {["All topics", ...topics].map(value => <Chip key={value} label={value} selected={topic === value} onPress={() => setTopic(value)} />)}
        </ScrollView> : null}
        {feed.offline ? <Notice message="You're offline. Previously loaded saves are shown. Connect to save changes." /> : null}
        {feed.error && !wholeFailure && !feed.offline ? <Notice message={feed.error} error action="Retry" onAction={feed.refresh} /> : null}
        {wholeFailure ? <EmptyState title="Your reading lists will be back" description="Try loading your feed again." action="Retry" onAction={feed.refresh} /> : null}
        {scope === "for_you" ? <>
          <CaptureStatus loadedIds={feed.items.flatMap(item => item.bookmark ? [item.bookmark.id] : [])}
            pendingBookmarks={feed.items.filter(item => item.type === "pending").flatMap(item => item.bookmark ? [nativeBookmark(item.bookmark)] : [])}
            onCompleted={feed.refresh} failedActions={bookmark => cardActions({ type: "own_save", bookmark })} />
          {feed.picksError && !wholeFailure && !feed.offline ? <Notice message={feed.picksError} error action="Retry" onAction={feed.refresh} /> : null}
          {firstRun ? <View style={{ padding: space.s5, gap: space.s4 }}>
            <Text style={[textStyle("title2"), { color: colors.fg }]}>Close the tab. Cosmic will bring it back.</Text>
            <Text style={[textStyle("body"), { color: colors.fgSecondary }]}>Save a link and your first pick appears here as soon as Cosmic has read it.</Text>
            <CopiedLink onPaste={url => router.push({ pathname: "/save", params: { url } })} />
            <Button title="Save a link" primary onPress={() => router.push("/save")} />
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>Share from any app: tap Share, then Cosmic Dolphin.</Text>
          </View> : null}
          {!feed.loading && feed.picks && !feed.picks.computedAt && !firstRun ? <EmptyState
            title="No picks right now"
            description="No saved links are ready for a pick right now. A new save can become a pick once Cosmic has read it." /> : null}
          {!feed.loading && feed.picks?.computedAt && visiblePicks.length === 0 ? <EmptyState
            title="No picks to show"
            description="Today's picks are set for later or no longer in your Library. New saves appear below." /> : null}
          {feed.picks ? <>
            <TodayProgress items={visiblePicks} />
            {visiblePicks.map(pick => <FeedCard key={pick.position} today item={{ type: "own_save", bookmark: pick.bookmark, rankingReason: pick.reason }} actions={cardActions({ type: "own_save", bookmark: pick.bookmark })} />)}
          </> : null}
          {feed.resume.map(item => <ContinueReading key={item.bookmark.id} item={item} />)}
          {visible.length ? <Text style={[textStyle("meta"), { color: colors.fgTertiary, padding: space.s4 }]}>More for you</Text> : null}
        </> : null}
        {feed.loading ? (scope === "for_you" ? <TodaySkeleton /> : <SkeletonRows />) : null}
        {scope !== "for_you" && !feed.loading && !feed.error && !visible.length ? <EmptyState
          title={scope === "following" ? "Good reading travels through people" : "A fresh starting point"}
          description="Save a link to start shaping your feed. Public discoveries and connected reading lists will appear as they become available."
          action={scope === "unread" ? "Save a link" : undefined}
          onAction={() => router.push("/save")} /> : null}
      </View>}
      renderItem={({ item }) => <FeedCard item={item} actions={cardActions(item)} />}
      ListFooterComponent={<View style={{ gap: space.s4, padding: space.s4 }}>
        {feed.hasMore ? <Button title={scope === "unread" ? "More saves" : "More reading lists"} busy={feed.more} onPress={feed.loadMore} /> : null}
        {scope === "for_you" && !feed.loading && !firstRun && !feed.error && feed.counts ? <View style={{ gap: space.s4 }}>
          <Text style={[textStyle("title2"), { color: colors.fg }]}>{"You're caught up"}</Text>
          <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{unreadCount} unread saves are in your Library.</Text>
          <Button title="Open Library" onPress={() => router.push("/library")} />
        </View> : null}
      </View>} />
    <CaptureFailureToast message={changeError} />
    <Toast message={actionState.toast?.message} undo={actionState.toast?.undo} close={controller.closeToast} />
    <BookmarkActionSheets selection={selection} controller={controller} onChange={setSelection} onClose={() => setSelection(undefined)} />
  </Screen>;
}
function ContinueReading({ item }: { item: ContinueReadingItem }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { focusStyle, ...focusEvents } = useControlFocus();
  const minutes = item.bookmark.metadata?.readingTime;
  const left = minutes == null ? undefined : Math.round(minutes * (1 - item.progress.percent / 100));
  return <Pressable {...focusEvents} accessibilityRole="button" accessibilityLabel={`Continue reading: ${item.bookmark.title}${left == null ? "" : `, ${left} min left`}`}
    onPress={() => router.push(`/reader/${item.bookmark.id}`)} style={[focusStyle, { minHeight: 64, padding: space.s4, gap: space.s2, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
    <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>Continue reading{left == null ? "" : ` · ${left} min left`}</Text>
    <Text style={[textStyle("title3"), { color: colors.fg }]}>{item.bookmark.title}</Text>
    <View style={{ height: 2, backgroundColor: colors.bgInset }}><View style={{ height: 2, width: `${Math.max(0, Math.min(100, item.progress.percent))}%`, backgroundColor: colors.accent }} /></View>
  </Pressable>;
}
const styles = StyleSheet.create({ content: { paddingBottom: space.s7 }, scopes: { paddingVertical: space.s3, paddingHorizontal: space.s4 } });
