import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useRouter, useNavigation, useFocusEffect } from "expo-router";
import { type ContinueReadingItem, type FeedItem } from "@cosmic-dolphin/api-client";
import { CaptureStatus } from "@/components/CaptureStatus";
import { CaptureFailureToast } from "@/components/CaptureFailureToast";
import { TopBarAction } from "@/components/TopBar";
import { FeedCard } from "@/components/FeedCard";
import { Toast } from "@/components/Toast";
import { useBookmarkActions } from "@/lib/bookmark-actions";
import { BookmarkActionSheets, type ActionSheet } from "@/components/BookmarkActionSheets";
import { TodayProgress, TodaySkeleton } from "@/components/TodayProgress";
import { CopiedLink } from "@/components/CopiedLink";
import { Button, Chip, EmptyState, Notice, Screen } from "@/components/ui/Signal";
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
  useFocusEffect(useCallback(() => {
    const entry = StatusBar.pushStackEntry({ barStyle: "light-content", backgroundColor: colors.homeHeaderBg, translucent: false });
    return () => StatusBar.popStackEntry(entry);
  }, [colors.homeHeaderBg]));
  const { user } = useAuth();
  const { controller, state: actionState } = useBookmarkActions(user?.id);
  const [selection, setSelection] = useState<ActionSheet & { accountId?: string }>();
  const cardActions = (item: FeedItem) => ({
    done: item.bookmark ? () => controller.done(item.bookmark!, true) : undefined,
    later: () => setSelection({ item, mode: "later", accountId: user?.id }),
    tonight: item.bookmark ? () => controller.later(item.bookmark!) : undefined,
    more: () => setSelection({ item, mode: "menu", accountId: user?.id }),
    save: () => controller.save(item),
  });
  useEffect(() => { setSelection(undefined); }, [user?.id]);
  const currentSelection = selection?.accountId === user?.id ? selection : undefined;
  const [topicState, setTopicState] = useState({ owner: user?.id, value: "All topics" });
  const topic = topicState.owner === user?.id ? topicState.value : "All topics";
  if (topicState.owner !== user?.id) setTopicState({ owner: user?.id, value: "All topics" });
  const setTopic = (value: string) => setTopicState({ owner: user?.id, value });
  const feed = useHomeFeed("for_you");
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
  const topics = useMemo(() => [...new Set(feed.items.flatMap(item => (item.bookmark?.cosmicTags ?? []).map(topicName)))], [feed.items]);
  useEffect(() => {
    if (!feed.loading && !feed.refreshing && !feed.error && topic !== "All topics" && !topics.includes(topic)) setTopicState({ owner: user?.id, value: "All topics" });
  }, [feed.loading, feed.refreshing, feed.error, topic, topics, user?.id]);
  const visiblePicks = feed.picks?.items.map(pick => ({ ...pick, bookmark: controller.view(pick.bookmark) })).filter(pick => controller.isVisible({ type: "own_save", bookmark: pick.bookmark })) ?? [];
  const pickIds = new Set(feed.picks?.items.map(item => item.bookmark.id));
  const wholeFailure = !!feed.error && !!feed.picksError && !feed.items.length && !feed.picks;
  const firstRun = !feed.error && !feed.picksError && !feed.loading && !feed.picks?.computedAt && feed.counts?.all === 0 && feed.counts.archived === 0;
  const filtered = feed.items.filter(item => controller.isVisible(item) && !((item.type === "own_save" || item.type === "pending") && controller.view(item.bookmark!).readAt)).map(item => ({ ...item, bookmark: item.bookmark ? controller.view(item.bookmark) : undefined })).filter(item => topic === "All topics" || item.bookmark?.cosmicTags?.map(topicName).includes(topic));
  const visible = filtered.filter(item =>
    item.type !== "pending" && item.bookmark?.processingStatus !== "processing" &&
    (!item.bookmark || !pickIds.has(item.bookmark.id)) &&
    (!item.bookmark?.laterUntil || item.type === "followed_save" || item.type === "reshare" || new Date(item.bookmark.laterUntil).getTime() <= Date.now())
  ).slice(0, 10);
  return <Screen title="Cosmic Dolphin" appearance="home" actions={<>
    <TopBarAction appearance="home" icon="search-outline" label="Search" onPress={() => router.push("/search")} />
    <TopBarAction appearance="home" icon="person-outline" label="Your profile"
      avatar={{ uri: user?.user_metadata?.avatar_url || user?.user_metadata?.picture, initial: (user?.user_metadata?.full_name || user?.email || "You").slice(0, 1).toUpperCase() }}
      onPress={() => rootNavigation.navigate("profile" as never)} />
  </>}>
    <ScrollView horizontal style={{ flexGrow: 0, backgroundColor: colors.homeHeaderBg }} contentContainerStyle={{ paddingHorizontal: space.s4, paddingVertical: space.s3, gap: space.s2 }}>
      {["All topics", ...topics.filter(value => value !== "All topics")].map(value => <Chip appearance="home" key={value} label={value} selected={topic === value} onPress={() => setTopic(value)} />)}
    </ScrollView>
    <FlatList data={feed.loading ? [] : visible} keyExtractor={(item, index) => item.bookmark?.id || item.digest?.id || String(index)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={feed.refreshing && !feed.loading} onRefresh={() => { void drain().catch(() => {}).then(feed.refresh); }} tintColor={colors.accent} />}
      ListHeaderComponent={<View>
        {feed.offline ? <Notice message="You're offline. Previously loaded saves are shown. Connect to save changes." /> : null}
        {feed.error && !wholeFailure && !feed.offline ? <Notice message={feed.error} error action="Retry" onAction={feed.refresh} /> : null}
        {wholeFailure ? <EmptyState title="Your reading lists will be back" description="Try loading your feed again." action="Retry" onAction={feed.refresh} /> : null}
        <>
          <CaptureStatus loadedIds={feed.items.flatMap(item => item.bookmark ? [item.bookmark.id] : [])}
            pendingBookmarks={feed.items.filter(item => item.type === "pending").flatMap(item => item.bookmark ? [nativeBookmark(item.bookmark)] : [])}
            onCompleted={feed.refresh} failedActions={bookmark => cardActions({ type: "own_save", bookmark })} />
          {feed.picksError && !wholeFailure && !feed.offline ? <Notice message={feed.picksError} error action="Retry" onAction={feed.refresh} /> : null}
          {firstRun ? <View style={{ padding: space.s5, gap: space.s4 }}>
            <Text style={[textStyle("title2"), { color: colors.fg }]}>Close the tab. Cosmic will bring it back.</Text>
            <Text style={[textStyle("body"), { color: colors.fgSecondary }]}>Save a link and your first pick appears here as soon as Cosmic has read it.</Text>
            <CopiedLink onPaste={url => router.push({ pathname: "/save", params: { url, accountId: user?.id } })} />
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
        </>
        {feed.loading ? <TodaySkeleton /> : null}
      </View>}
      renderItem={({ item }) => <FeedCard item={item} actions={cardActions(item)} />}
      ListFooterComponent={<View style={{ gap: space.s4, padding: space.s4 }}>
        {!feed.loading && !firstRun && !feed.error && feed.counts ? <View style={{ gap: space.s4 }}>
          <Text style={[textStyle("title2"), { color: colors.fg }]}>{"You're caught up"}</Text>
          <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>{unreadCount} unread saves are in your Library.</Text>
          <Button title="Open Library" onPress={() => router.push("/library")} />
        </View> : null}
      </View>} />
    <CaptureFailureToast message={changeError} />
    <Toast message={actionState.toast?.message} undo={actionState.toast?.undo} close={controller.closeToast} />
    <BookmarkActionSheets key={user?.id ?? "signed-out"} selection={currentSelection} accountId={user?.id} controller={controller} onChange={value => setSelection({ ...value, accountId: user?.id })} onClose={() => setSelection(undefined)} />
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
const styles = StyleSheet.create({ content: { paddingBottom: space.s7 } });
