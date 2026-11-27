import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { HomeFeedFixtureContext } from "@/hooks/HomeFeedFixtureContext";
import { FlatList, Platform, RefreshControl, ScrollView, StatusBar, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import type { ContinueReadingItem, FeedItem, FeedScope } from "@cosmic-dolphin/api-client";
import { Inbox, Link2, FileText, FolderTree } from "lucide-react-native";
import { radius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCaptures } from "@/contexts/CaptureContext";
import { useHomeFeed } from "@/hooks/useHomeFeed";
import { useBookmarkActions } from "@/lib/bookmark-actions";
import { nativeBookmark } from "@/lib/mobile-api";
import { CaptureStatus } from "@/components/CaptureStatus";
import { CaptureFailureToast } from "@/components/CaptureFailureToast";
import { BookmarkActionSheets, type ActionSheet } from "@/components/BookmarkActionSheets";
import { Toast } from "@/components/Toast";
import { HomeComments } from "@/components/web-home/Comments";
import { HomeToolbar } from "@/components/web-home/Chrome";
import { Action, Copy, Segmented } from "@/components/web-home/Primitives";
import { NativeFeedItem } from "@/components/web-home/FeedItem";
import { HOME_SCOPES, captureUrl, greeting, scopeCopy, splitHome, updatedAt } from "@/components/web-home/data";
import { useWebTheme, webText } from "@/components/web-home/theme";

/** Key every private field/request/confirmation by owner before the next paint. */
export default function HomeScreen() {
  const { user } = useAuth();
  return <HomeEdition key={user?.id ?? "signed-out"} />;
}
function HomeEdition() {
  const { user } = useAuth();
  const { colors, scheme } = useWebTheme();
  const [scope, setScope] = useState<FeedScope>("for_you");
  const feed = useHomeFeed(scope, { edition: true });
  const { controller, state: actionState } = useBookmarkActions(user?.id);
  const [commentsFor, setCommentsFor] = useState<FeedItem>();
  const [selection, setSelection] = useState<ActionSheet>();
  const [error, setError] = useState<string>();
  const fixture = useContext(HomeFeedFixtureContext);
  const [clock, setNow] = useState(() => new Date());
  const now = __DEV__ && fixture?.now ? fixture.now : clock;
  const list = useRef<FlatList<FeedItem>>(null);
  const { drain, changeError, captures } = useCaptures();
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useFocusEffect(useCallback(() => {
    if (Platform.OS === "web") return;
    const entry = StatusBar.pushStackEntry({ barStyle: scheme === "dark" ? "light-content" : "dark-content", backgroundColor: colors.bg, translucent: false });
    return () => StatusBar.popStackEntry(entry);
  }, [scheme, colors.bg]));
  useEffect(() => {
    if (feed.serverRead) controller.synchronize(feed.serverRead.bookmarks, feed.serverRead.sequence);
  }, [controller, feed.serverRead]);
  const actions = (item: FeedItem) => ({
    done: item.bookmark ? () => controller.done(item.bookmark!, true) : undefined,
    later: () => setSelection({ item, mode: "later" }),
    tonight: item.bookmark ? () => controller.later(item.bookmark!) : undefined,
    more: () => setSelection({ item, mode: "menu" }),
    save: () => controller.save(item),
  });
  const visible = feed.items.filter(item => controller.isVisible(item)).map(item => ({ ...item, bookmark: item.bookmark ? controller.view(item.bookmark) : undefined }))
    .filter(item => (item.type !== "own_save" && item.type !== "pending") || !item.bookmark?.readAt);
  const edition = splitHome(visible);
  const hasCaptures = captures?.some(capture => !capture.bookmark || capture.bookmark.processingStatus === "processing" || !feed.items.some(item => item.bookmark?.id === capture.bookmark?.id)) || edition.saving.length > 0;
  const firstRun = scope === "for_you" && !hasCaptures && !feed.loading && !feed.error && feed.counts?.all === 0 && feed.counts.archived === 0;
  const readerName = feed.readerName ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0];
  const refresh = () => { void drain().catch(() => {}).then(feed.refresh); };
  const entries = feed.loading ? [] : edition.rest;
  const openScope = (next: FeedScope) => { setCommentsFor(undefined); setSelection(undefined); setError(undefined); setScope(next); list.current?.scrollToOffset({ offset: 0, animated: false }); };
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.bg }}>
    <HomeToolbar onError={setError} counts={feed.counts ?? null} />
    <FlatList ref={list} data={entries} keyExtractor={item => item.bookmark ? `bookmark:${item.bookmark.id}` : `digest:${item.digest?.id}`}
      style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: firstRun ? 48 : 40, paddingBottom: 112, backgroundColor: colors.bg }}
      refreshControl={<RefreshControl refreshing={feed.refreshing && !feed.loading} onRefresh={refresh} tintColor={colors.accent} />}
      onEndReached={() => { if (!feed.error) void feed.loadMore(); }} onEndReachedThreshold={0.5}
      ListHeaderComponent={<>
        {firstRun ? <FirstSave /> : <View style={{ gap: 28 }}>
          {feed.offline ? <InlineNotice message="You're offline. These are the items already loaded. Nothing new arrives, and likes and saves wait until you're back." /> : null}
          <View style={{ gap: 16, alignItems: "flex-start" }}>
            <View style={{ gap: 6, width: "100%" }}>
              <Copy style={{ fontFamily: "InterMedium", fontSize: 13, lineHeight: 13, minHeight: 14, color: colors.fgTertiary }}>{new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(now)}</Copy>
              <Text accessibilityRole="header" style={[webText("edition"), { color: colors.fg }]}>{greeting(now, readerName)}</Text>
              <Copy style={{ fontSize: 13.5, lineHeight: 20.25 }}>{scopeCopy(scope)}{updatedAt(feed.computedAt, now) ? ` · ${updatedAt(feed.computedAt, now)}`.replaceAll(" ", "\u00a0") : ""}</Copy>
            </View>
            <Segmented value={scope} options={HOME_SCOPES} onChange={openScope} />
          </View>
          {hasCaptures ? <CaptureStatus appearance="web" loadedIds={feed.items.flatMap(item => item.bookmark ? [item.bookmark.id] : [])}
            pendingBookmarks={edition.saving.flatMap(item => item.bookmark ? [nativeBookmark(item.bookmark)] : [])}
            onCompleted={feed.refresh} failedActions={bookmark => actions({ type: "own_save", bookmark })} /> : null}
          {feed.resume.length ? <ContinueReading items={feed.resume.slice(0, 3)} /> : null}
          <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 28 }}>
            {feed.loading ? <HomeSkeleton /> : edition.lead ? <NativeFeedItem key={edition.lead.bookmark?.id} item={edition.lead} onComment={() => setCommentsFor(edition.lead)} variant="lead" actions={actions(edition.lead)} offline={feed.offline} onError={setError} /> : !entries.length && !feed.error ? <ScopeEmpty scope={scope} onReset={() => openScope("for_you")} /> : null}
            {edition.lead && entries.length ? <Copy role="section" style={{ color: colors.fg, paddingBottom: 4 }}>More for you</Copy> : null}
          </View>
        </View>}
      </>}
      renderItem={({ item }) => <NativeFeedItem item={item} onComment={() => setCommentsFor(item)} actions={actions(item)} offline={feed.offline} onError={setError} />}
      ListFooterComponent={<View>
        {feed.error ? <InlineNotice message={feed.error} retry={feed.refresh} /> : null}
        {error ? <InlineNotice message={error} retry={() => setError(undefined)} /> : null}
        {feed.more ? <HomeSkeleton /> : !feed.loading && !firstRun && !feed.hasMore && !feed.error && (edition.lead || entries.length) ? <Copy role="meta" style={{ paddingTop: 24, color: colors.fgTertiary }}>{"That's everything for now."}</Copy> : null}
      </View>} />
    {commentsFor?.bookmark ? <HomeComments key={commentsFor.bookmark.id} item={commentsFor} offline={feed.offline} onClose={() => setCommentsFor(undefined)} /> : null}
    <CaptureFailureToast message={changeError} />
    <Toast message={actionState.toast?.message} undo={actionState.toast?.undo} close={controller.closeToast} />
    <BookmarkActionSheets selection={selection} accountId={user?.id} controller={controller} onChange={setSelection} onClose={() => setSelection(undefined)} />
  </SafeAreaView>;
}
function ContinueReading({ items }: { items: ContinueReadingItem[] }) {
  const { colors } = useWebTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  return <View style={{ gap: 12 }}>
    <Copy role="section" style={{ color: colors.fg }}>Pick up where you left off</Copy>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={(width - 32) * 0.78 + 12} decelerationRate="fast" style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
      {items.map(item => {
        const percent = Math.max(0, Math.min(100, item.progress.percent));
        const minutes = item.bookmark.metadata?.readingTime;
        const left = minutes ? Math.max(1, Math.ceil(minutes * (1 - percent / 100))) : undefined;
        return <View key={item.bookmark.id} style={{ flexShrink: 0, width: (width - 32) * 0.78, minWidth: (width - 32) * 0.78, maxWidth: (width - 32) * 0.78, minHeight: 102, borderWidth: 1, borderRadius: radius.md, borderColor: colors.border, backgroundColor: colors.bgPanel, paddingHorizontal: 16, paddingVertical: 14, gap: 14 }}>
          <Action label={`Continue reading: ${item.bookmark.title}`} onPress={() => router.push(`/reader/${item.bookmark.id}`)} style={{ width: "100%", paddingHorizontal: 0, justifyContent: "flex-start", minHeight: 0 }}><Text numberOfLines={2} style={[webText("title3"), { flexShrink: 1, color: colors.fg }]}>{item.bookmark.title}</Text></Action>
          <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.bgInset }}><View style={{ height: 4, borderRadius: radius.pill, width: `${percent}%`, backgroundColor: colors.accent }} /></View>
            <Copy role="meta" style={{ lineHeight: 12.5, color: colors.fgTertiary }}>{left ? `${left} min left` : `${percent}% read`}</Copy>
          </View>
        </View>;
      })}
    </ScrollView>
  </View>;
}
function InlineNotice({ message, retry }: { message: string; retry?: () => void }) {
  const { colors } = useWebTheme();
  return <View accessibilityRole="alert" style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bgSubtle, gap: 8 }}><Copy>{message}</Copy>{retry ? <Action label="Retry" onPress={retry}>Retry</Action> : null}</View>;
}
function ScopeEmpty({ scope, onReset }: { scope: FeedScope; onReset: () => void }) {
  const router = useRouter();
  const { colors } = useWebTheme();
  const title = scope === "following" ? "Nobody you follow has shared anything yet." : scope === "unread" ? "You're caught up." : "Nothing ranked for you right now.";
  const description = scope === "following" ? "Following shows public saves from the people you follow. Explore is where you find them." : scope === "unread" ? "Unread is every save you haven't opened, newest first. Read ones stay in your library." : "For you mixes your unread saves, the people you follow, and this week's digests. Save something and it appears here.";
  return <View style={{ paddingHorizontal: 24, paddingVertical: 48, backgroundColor: colors.bgSubtle, borderRadius: radius.md, gap: 12, alignItems: "center" }}>
    <Inbox size={20} strokeWidth={1.7} color={colors.fgTertiary} />
    <View style={{ gap: 6 }}><Copy role="title3" style={{ color: colors.fg, textAlign: "center" }}>{title}</Copy><Copy style={{ textAlign: "center" }}>{description}</Copy></View>
    {scope !== "for_you" ? <View style={{ paddingTop: 4 }}><Action primary label={scope === "following" ? "Find people on Explore" : "Back to For you"} onPress={scope === "following" ? () => router.push("/explore") : onReset}>{scope === "following" ? "Find people on Explore" : "Back to For you"}</Action></View> : null}
  </View>;
}
function FirstSave() {
  const { colors } = useWebTheme();
  const { save } = useCaptures();
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    const normalized = captureUrl(url);
    if (!normalized) { setInvalid(true); return; }
    setUrl("");
    try { await save({ sourceUrl: normalized, captureSource: "save_sheet", capturePlatform: "unknown" }); }
    catch { setError("Couldn't save this link. Try again."); }
  };
  const steps = [
    { Icon: Link2, title: "It lands in your library", body: "A row appears the moment you paste — readable before anything else happens." },
    { Icon: FileText, title: "Cosmic writes a brief", body: "A short summary and the points worth keeping, naming the page it came from." },
    { Icon: FolderTree, title: "It gets filed, and Home fills in", body: "Collections form as you save; move anything and it stays where you put it." },
  ];
  return <View style={{ paddingVertical: 40, gap: 48 }}>
    <View style={{ gap: 24 }}>
      <View style={{ gap: 12 }}><Text accessibilityRole="header" style={[webText("display"), { color: colors.fg }]}>Save your first link.</Text>
        <Copy role="body" style={{ lineHeight: 24 }}>Paste a URL and it is yours in a second — summarised, tagged and filed while you carry on. Home fills in as you save.</Copy></View>
      <View style={{ flexDirection: "row", gap: 8 }}><TextInput accessibilityLabel="Link to save" placeholder="https://" placeholderTextColor={colors.fgTertiary} value={url} onChangeText={text => { setUrl(text); setInvalid(false); }} onSubmitEditing={() => { void submit(); }} autoCapitalize="none" keyboardType="url" returnKeyType="go"
        style={{ flex: 1, minWidth: 0, height: 40, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.bgPanel, borderColor: invalid ? colors.danger : colors.borderStrong, fontFamily: "Inter", fontSize: 14, color: colors.fg }} />
        <Action label="Save link" primary onPress={() => { void submit(); }} style={{ paddingHorizontal: 24, minHeight: 40 }}><Copy maxFontSizeMultiplier={1.3} style={{ fontFamily: "InterMedium", fontSize: 14, lineHeight: 14, color: colors.accentFg }}>Save link</Copy></Action></View>
      {invalid || error ? <Copy role="meta" style={{ color: colors.danger }}>{error || "That doesn't look like a link. It needs a domain, like example.com/article."}</Copy> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}><Copy role="meta" style={{ color: colors.fgTertiary }}>Try one of these</Copy>
        {["every.to", "stratechery.com", "arxiv.org"].map(source => <Action key={source} label={source} onPress={() => setUrl(`https://${source}`)} style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSubtle, paddingHorizontal: 12 }}>{source}</Action>)}
      </View>
    </View>
    <View accessibilityLabel="What happens when you save" style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSubtle, overflow: "hidden" }}>
      {steps.map(({ Icon, title, body }, index) => <View key={title} style={{ flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: index === 2 ? 0 : 1, borderColor: colors.border }}>
        <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgPanel }}><Icon size={16} strokeWidth={1.7} color={colors.accent} /></View>
        <View style={{ flex: 1, gap: 2 }}><Copy style={{ fontFamily: "InterSemibold", lineHeight: 20.25, color: colors.fg }}><Text style={{ color: colors.fgTertiary }}>{index + 1}.</Text> {title}</Copy><Copy style={{ fontSize: 13, lineHeight: 19.5 }}>{body}</Copy></View>
      </View>)}
    </View>
  </View>;
}
function HomeSkeleton() {
  const { colors } = useWebTheme();
  return <View accessibilityLabel="Loading your feed" style={{ gap: 16, paddingVertical: 8 }}>
    {[0.86, 0.52, 0.9, 0.76].map((width, i) => <View key={i} style={{ width: `${width * 100}%`, height: i < 2 ? 28 : 11, borderRadius: radius.xs, backgroundColor: colors.bgInset }} />)}
  </View>;
}
