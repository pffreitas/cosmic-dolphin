import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from "react-native";
import type { Bookmark as ContractBookmark, BookmarkContent, BookmarkProcessingEvent, Comment, TodayPicksResponse } from "@cosmic-dolphin/api-client";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";

import { TopBarAction } from "@/components/TopBar";
import {
  Button,
  EmptyState,
  layout,
  Notice,
  Screen,
  Sheet,
  SkeletonRows,
} from "@/components/ui/Signal";
import { MobileAPI } from "@/lib/mobile-api";
import { Bookmark, BookmarksAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import {
  cacheBookmarksInBackground,
  getCachedBookmark,
  removeCachedBookmark,
} from "@/lib/bookmark-cache";
import { useBookmarkActions } from "@/lib/bookmark-actions";
import { nextReadingSequence } from "@/lib/reading-sequence";
import { ReadingTools } from "@/components/ReadingTools";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { BookmarkFailure, openOriginal } from "@/components/BookmarkFailure";
import { PendingPhases } from "@/components/PendingPhases";
import { BookmarkActionSheets, type ActionSheet } from "@/components/BookmarkActionSheets";
import { Toast } from "@/components/Toast";
import { isAuthError } from "@/lib/api-errors";
import { fontFamily, textStyle } from "@/constants/fonts";
import { radius, space, type } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

function readingBookmark(value: Bookmark): ContractBookmark {
  return { ...value, createdAt: new Date(value.createdAt), updatedAt: new Date(value.updatedAt),
    readAt: value.readAt ? new Date(value.readAt) : undefined,
    laterUntil: value.laterUntil ? new Date(value.laterUntil) : value.laterUntil,
    captureQueuedAt: value.captureQueuedAt ? new Date(value.captureQueuedAt) : value.captureQueuedAt } as ContractBookmark;
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "";
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function BookmarkDetailScreen() {
  const { id, slug, mode: requestedMode, paste: requestedPaste, retry: requestedRetry } = useLocalSearchParams<{ id: string; slug?: string; mode?: string; paste?: string; retry?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const preferences = usePreferences();
  const readingSize = preferences.readingSize === "larger" ? type.title1.fontSize : preferences.readingSize === "large" ? space.s5 : type.title2.fontSize;

  const pageIdentity = useRef("");
  pageIdentity.current = `${user?.id ?? ""}:${id}:${slug ?? "owner"}`;
  const bookmarkRequest = useRef(0);
  const cancelBookmarkRequest = useCallback(() => { bookmarkRequest.current++; }, []);

  const [conversation, setConversation] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [commentsError, setCommentsError] = useState("");
  const [posting, setPosting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState(false);
  const recoveryHandled = useRef("");
  const [retryBusy, setRetryBusy] = useState(false);
  const pasteRequest = useRef(0);
  const pasteAbort = useRef<AbortController>();
  const cancelRecovery = useCallback(() => { ++pasteRequest.current; pasteAbort.current?.abort(); }, []);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [selection, setSelection] = useState<ActionSheet>();
  const [storedBookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState("");
  const { controller, state: actionState } = useBookmarkActions(user?.id);
  const viewed = storedBookmark && loadedIdentity === pageIdentity.current ? controller.view(readingBookmark(storedBookmark)) : undefined;
  const bookmark = viewed ? { ...storedBookmark!, ...viewed, createdAt: viewed.createdAt.toISOString(), updatedAt: viewed.updatedAt.toISOString(), readAt: viewed.readAt?.toISOString(), laterUntil: viewed.laterUntil?.toISOString() } : null;
  const bookmarkRef = useRef(bookmark);
  bookmarkRef.current = bookmark;
  const [picks, setPicks] = useState<TodayPicksResponse>();
  useEffect(() => {
    let active = true;
    const sequence = nextReadingSequence();
    void MobileAPI.picks().then(value => {
      if (!active) return;
      controller.synchronize(value.items.map(pick => pick.bookmark), sequence);
      setPicks(value);
    }).catch(() => {});
    return () => { active = false; };
  }, [controller]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("brief");
  useEffect(() => { setMode(requestedMode === "read" || requestedMode === "original" ? requestedMode : "brief"); }, [id, requestedMode]);
  const [events, setEvents] = useState<BookmarkProcessingEvent[]>([]);
  const [content, setContent] = useState<BookmarkContent>();
  const [contentOffline, setContentOffline] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const reading = useReadingProgress(id, bookmark?.userId === user?.id ? user?.id : undefined, mode === "read" && !!content?.blocks.length);
  const contentBookmarkId = bookmark?.id;
  const contentOwnerId = bookmark?.userId;
  const contentPrivate = bookmark?.isPrivateLink;
  const contentProcessing = bookmark?.processingStatus;
  useEffect(() => {
    let active = true;
    setContent(undefined);
    setContentOffline(false);
    setContentLoading(false);
    if (contentOwnerId === user?.id && contentBookmarkId && !contentPrivate) {
      setContentLoading(true);
      void MobileAPI.content(contentBookmarkId, undefined, user?.id).then(value => { if (active) setContent(value); }).catch(error => { if (active) setContentOffline(!error?.response?.status); }).finally(() => { if (active) setContentLoading(false); });
    }
    return () => { active = false; };
  }, [contentBookmarkId, contentOwnerId, contentPrivate, contentProcessing, user?.id]);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isReadLoading, setIsReadLoading] = useState(false);
  useEffect(() => {
    setNoteOpen(false); setNoteDraft(""); setSelection(undefined);
    cancelRecovery();
    setPasteOpen(false); setPasteText(""); setPasteBusy(false); setPasteError(false); setRetryBusy(false);
    return cancelRecovery;
  }, [id, slug, user?.id, cancelRecovery]);

  // Markdown styles based on color scheme - must be called before any early returns
  const markdownStyles = useMemo(
    () => ({
      body: {
        ...textStyle("body"),
        color: colors.fgSecondary,
      },
      heading1: {
        ...textStyle("title2"),
        color: colors.fg,
        marginTop: space.s4,
        marginBottom: space.s2,
      },
      heading2: {
        ...textStyle("title3"),
        color: colors.fg,
        marginTop: space.s3,
        marginBottom: space.s2,
      },
      heading3: {
        ...textStyle("title3"),
        color: colors.fg,
        marginTop: space.s3,
        marginBottom: space.s1,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: space.s3,
      },
      bullet_list: {
        marginBottom: space.s3,
      },
      ordered_list: {
        marginBottom: space.s3,
      },
      list_item: {
        marginBottom: space.s1,
      },
      bullet_list_icon: {
        ...textStyle("body"),
        color: colors.fgSecondary,
      },
      ordered_list_icon: {
        ...textStyle("body"),
        color: colors.fgSecondary,
      },
      strong: {
        color: colors.fg,
        fontWeight: "600" as const,
      },
      em: {
        fontStyle: "italic" as const,
      },
      link: {
        color: colors.accent,
        textDecorationLine: "underline" as const,
      },
      blockquote: {
        ...textStyle("quote"),
        backgroundColor: colors.hlBg,
        borderLeftColor: colors.hlLine,
        borderLeftWidth: space.s1,
        paddingLeft: space.s3,
        paddingVertical: space.s2,
        marginVertical: space.s3,
      },
      code_inline: {
        ...textStyle("bodySm"),
        backgroundColor: colors.bgInset,
        color: colors.fg,
        paddingHorizontal: space.s2,
        paddingVertical: space.s1 / 2,
        borderRadius: radius.xs,
      },
      code_block: {
        ...textStyle("bodySm"),
        backgroundColor: colors.bgInset,
        color: colors.fg,
        padding: space.s3,
        borderRadius: radius.md,
        marginVertical: space.s3,
      },
      fence: {
        ...textStyle("bodySm"),
        backgroundColor: colors.bgInset,
        color: colors.fg,
        padding: space.s3,
        borderRadius: radius.md,
        marginVertical: space.s3,
      },
      hr: {
        backgroundColor: colors.border,
        height: StyleSheet.hairlineWidth,
        marginVertical: space.s4,
      },
    }),
    [colors],
  );

  const applyBookmark = useCallback((data: Bookmark) => {
    const identity = `${user?.id ?? ""}:${id}:${slug ?? "owner"}`;
    if (identity !== pageIdentity.current || data.id !== id) return;
    setLoadedIdentity(identity);
    setBookmark(data);
    setIsLiked(data.isLikedByCurrentUser ?? false);
    setLikeCount(data.likeCount ?? 0);
    setIsShared(data.isPublic ?? false);
  }, [id, slug, user?.id]);

  const fetchBookmark = useCallback(
    async (bookmarkId: string) => {
      setIsLoading(true);
      setError(null);

      const sequence = nextReadingSequence();
      const request = ++bookmarkRequest.current;
      const identity = `${user?.id ?? ""}:${bookmarkId}:${slug ?? "owner"}`;
      const isCurrent = () => request === bookmarkRequest.current && identity === pageIdentity.current;
      try {
        const data = slug === undefined ? await BookmarksAPI.findById(bookmarkId) : await MobileAPI.sharedBookmark(slug);
        if (!isCurrent()) return;
        if (data) {
          controller.synchronize([readingBookmark(data)], sequence);
          applyBookmark(data);
          if (slug === undefined) cacheBookmarksInBackground(user?.id, [data]);
        } else {
          if (slug === undefined && user?.id) {
            await removeCachedBookmark(user.id, bookmarkId);
          }
          setError("Bookmark not found");
        }
      } catch (err) {
        if (!isCurrent()) return;
        if (slug === undefined && user?.id && !isAuthError(err)) {
          const cachedBookmark = await getCachedBookmark(user.id, bookmarkId);
          if (!isCurrent()) return;
          if (cachedBookmark) {
            applyBookmark(cachedBookmark);
            setError(null);
            return;
          }
        }

        console.error("Error fetching bookmark:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load bookmark",
        );
      } finally {
        if (isCurrent()) { setLoadedIdentity(identity); setIsLoading(false); }
      }
    },
    [applyBookmark, slug, user?.id, controller],
  );

  useEffect(() => {
    if (id) {
      void fetchBookmark(id);
    }
    return cancelBookmarkRequest;
  }, [fetchBookmark, id, cancelBookmarkRequest]);

  const processingId = bookmark?.id;
  const processingStatus = bookmark?.processingStatus;
  useEffect(() => {
    if (
      slug !== undefined || !processingId ||
      !["idle", "processing"].includes(processingStatus || "")
    )
      return;
    let active = true;
    const load = async () => {
      const sequence = nextReadingSequence();
      try {
        const timeline = await MobileAPI.processingTimeline(processingId, undefined, user?.id);
        if (active) {
          controller.synchronize([readingBookmark(timeline.bookmark)], sequence);
          setEvents(timeline.events);
          applyBookmark(timeline.bookmark);
          cacheBookmarksInBackground(user?.id, [timeline.bookmark]);
        }
      } catch { /* Keep the saved link and reported phases usable on failure. */ }
    };
    setEvents([]);
    void load();
    const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [processingId, processingStatus, applyBookmark, slug, user?.id, controller]);

  const handleOpenUrl = () => {
    if (bookmark?.sourceUrl) openOriginal(bookmark.sourceUrl);
  };

  const submitPaste = async () => {
    if (!bookmark || bookmark.userId !== user?.id || bookmark.isPrivateLink || pasteBusy || pasteText.length < 200 || pasteText.length > 100000) return;
    const identity = pageIdentity.current;
    const request = ++pasteRequest.current;
    const abort = new AbortController(); pasteAbort.current = abort;
    const current = () => identity === pageIdentity.current && request === pasteRequest.current && !abort.signal.aborted;
    cancelBookmarkRequest();
    const sequence = nextReadingSequence();
    setPasteBusy(true); setPasteError(false);
    try {
      const result = await MobileAPI.pasteContent(bookmark.id, pasteText, abort.signal, user.id);
      if (!current()) return;
      controller.synchronize([readingBookmark(result.bookmark)], sequence);
      applyBookmark(result.bookmark);
      setMode("brief"); setPasteOpen(false); setPasteText("");
    } catch { if (current()) setPasteError(true); }
    finally { if (current()) setPasteBusy(false); }
  };

  const retryProcessing = useCallback(async () => {
    const bookmark = bookmarkRef.current;
    if (!bookmark || bookmark.userId !== user?.id || retryBusy) return;
    const identity = pageIdentity.current;
    const request = ++pasteRequest.current;
    const abort = new AbortController(); pasteAbort.current = abort;
    const current = () => identity === pageIdentity.current && request === pasteRequest.current && !abort.signal.aborted;
    cancelBookmarkRequest();
    const sequence = nextReadingSequence(); setRetryBusy(true);
    try {
      const result = await MobileAPI.retry(bookmark.id, user.id, abort.signal);
      if (!current()) return;
      controller.synchronize([readingBookmark(result.bookmark)], sequence);
      applyBookmark(result.bookmark); setMode("brief");
    } catch { if (current()) Alert.alert("Could not retry", "Please try again."); }
    finally { if (current()) setRetryBusy(false); }
  }, [user?.id, retryBusy, controller, applyBookmark, cancelBookmarkRequest]);
  const recoveryOwner = bookmark?.userId, recoveryStatus = bookmark?.processingStatus, recoveryCode = bookmark?.processingFailureCode, recoveryPrivate = bookmark?.isPrivateLink;
  useEffect(() => {
    if (recoveryOwner !== user?.id || recoveryStatus !== "failed") return;
    const intent = `${pageIdentity.current}:${requestedPaste || ""}:${requestedRetry || ""}`;
    if (recoveryHandled.current === intent) return;
    recoveryHandled.current = intent;
    if (requestedPaste === "1" && !recoveryPrivate && recoveryCode && recoveryCode !== "provider") setPasteOpen(true);
    if (requestedRetry === "1") void retryProcessing();
  }, [recoveryOwner, recoveryStatus, recoveryCode, recoveryPrivate, user?.id, requestedPaste, requestedRetry, retryProcessing]);

  const handleBack = () => {
    router.back();
  };

  const handleLikeToggle = async () => {
    if (!bookmark || isLikeLoading) return;

    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;

    setIsLiked(!isLiked);
    setLikeCount(isLiked ? Math.max(likeCount - 1, 0) : likeCount + 1);
    setIsLikeLoading(true);

    try {
      const result = isLiked
        ? await BookmarksAPI.unlike(bookmark.id)
        : await BookmarksAPI.like(bookmark.id);

      setLikeCount(result.likeCount);
      setIsLiked(result.isLikedByCurrentUser);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
      Alert.alert(
        "Error",
        "Failed to update like status. Please try again later.",
        [{ text: "OK" }],
      );
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleShareToggle = () => {
    setIsShareModalVisible(true);
  };
  const publishBookmark = async () => {
    if (!bookmark || isShareLoading) return;
    setIsShareLoading(true);
    try {
      const result = await BookmarksAPI.share(bookmark.id);
      setIsShared(result.isPublic);
      setShareUrl(result.shareUrl);
      setIsShareModalVisible(true);
    } catch {
      Alert.alert("Error", "Failed to share bookmark. Please try again.");
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleUnshare = async () => {
    if (!bookmark || isShareLoading) return;

    setIsShareLoading(true);
    try {
      const result = await BookmarksAPI.unshare(bookmark.id);
      setIsShared(result.isPublic);
      setShareUrl("");
      setIsShareModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to unshare bookmark. Please try again.");
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({ url: shareUrl, message: shareUrl });
    } catch {
      // user cancelled
    }
  };

  if (isLoading || loadedIdentity !== pageIdentity.current)
    return (
      <Screen title="Your save" onBack={handleBack}>
        <View style={layout.content}>
          <SkeletonRows />
        </View>
      </Screen>
    );
  if (error || !bookmark)
    return (
      <Screen title="Your save" onBack={handleBack}>
        <View style={layout.content}>
          <EmptyState
            title="Something went wrong"
            description={error || "Bookmark not found"}
            action="Try again"
            onAction={() => {
              if (id) void fetchBookmark(id);
            }}
          />
        </View>
      </Screen>
    );
  const siteName = extractDomain(bookmark.sourceUrl);
  const ownsBookmark = bookmark.userId === user?.id;
  const processing =
    bookmark.processingStatus === "processing" ||
    bookmark.processingStatus === "idle";
  const failedPage = ownsBookmark && bookmark.processingStatus === "failed" && !bookmark.isPrivateLink;
  const visiblePicks = (picks?.items ?? []).filter(pick => controller.isVisible({ type: "own_save", bookmark: pick.bookmark })).sort((a, b) => a.position - b.position);
  const isPick = visiblePicks.some(pick => pick.bookmark.id === bookmark.id);
  const doneCount = visiblePicks.filter(pick => controller.view(pick.bookmark).readAt).length;
  const nextPick = visiblePicks.find(pick => pick.bookmark.id !== bookmark.id && !controller.view(pick.bookmark).readAt);
  const done = !!viewed?.readAt;
  const selectAction = (mode: ActionSheet["mode"]) => {
    if (viewed) setSelection({ mode, item: { type: "own_save", bookmark: viewed } });
  };
  return (
    <Screen
      title={ownsBookmark ? "Your save" : "Article"}
      onBack={handleBack}
      actions={
        <>
          {ownsBookmark ? <TopBarAction icon="ellipsis-horizontal" label="More actions" onPress={() => selectAction("menu")} /> : null}
          <Pressable
            onPress={handleLikeToggle}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? "Unlike" : "Like"}
            accessibilityState={{ selected: isLiked }}
            disabled={isLikeLoading}
            testID="like-button"
            style={styles.like}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={20}
              color={isLiked ? colors.like : colors.fgSecondary}
            />
            {likeCount > 0 ? (
              <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>
                {likeCount}
              </Text>
            ) : null}
          </Pressable>
          <TopBarAction
            icon="share-outline"
            label="Share"
            onPress={handleShareToggle}
          />
        </>
      }
    >
      {mode === "read" && content?.blocks.length ? <View accessibilityLabel={`${Math.round(reading.percent)}% read`} style={{ height: 2, backgroundColor: colors.bgInset }}>
        <View style={{ height: 2, width: `${reading.percent}%`, backgroundColor: colors.accent }} />
      </View> : null}
      <ScrollView ref={reading.scroll} accessibilityLabel="Saved article" contentContainerStyle={layout.content} scrollEventThrottle={100} onScroll={reading.onScroll} onContentSizeChange={reading.onContentSizeChange}>
        {reading.error ? <Notice message={reading.error} error /> : null}
        {ownsBookmark ? <Button title={bookmark.collectionPath?.map(part => part.name).join(" / ") || "Inbox"} detail="Move to topic" icon="folder-outline" onPress={() => selectAction("move")} /> : null}
        <Text
          accessibilityRole="header"
          style={[textStyle("title1"), { color: colors.fg }]}
        >
          {bookmark.title || siteName}
        </Text>
        <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>
          {siteName}
          {bookmark.metadata?.readingTime
            ? ` · ${bookmark.metadata.readingTime} min read`
            : ""}
          {ownsBookmark ? ` · Saved ${formatDate(bookmark.createdAt)}` : ""}
        </Text>
        {ownsBookmark ? <>
          {bookmark.userNote ? <View style={[layout.panel, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}>
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>Why you saved it</Text>
            <Text selectable style={[textStyle("body"), { color: colors.fg }]}>{bookmark.userNote}</Text>
          </View> : null}
          <Button title={bookmark.userNote ? "Edit note" : "Add a note"} icon="create-outline" onPress={() => { setNoteDraft(bookmark.userNote ?? ""); setNoteOpen(true); }} />
        </> : null}
        <View style={layout.row}>
          {!ownsBookmark ? (
            <Button
              title="Save to Library"
              icon="add"
              primary
              busy={isReadLoading}
              onPress={async () => {
                setIsReadLoading(true);
                try {
                  const saved = await MobileAPI.saveRecommendation(bookmark.id);
                  router.replace(`/bookmark/${saved.id}`);
                } catch {
                  Alert.alert(
                    "Link was not saved",
                    "Check your connection and try again.",
                  );
                } finally {
                  setIsReadLoading(false);
                }
              }}
            />
          ) : null}
          <TopBarAction
            icon="open-outline"
            label="Open original"
            onPress={handleOpenUrl}
          />
        </View>
        {ownsBookmark && bookmark.processingStatus === "failed" ? <BookmarkFailure code={bookmark.processingFailureCode} url={bookmark.sourceUrl} page privateLink={bookmark.isPrivateLink}
          onPaste={() => setPasteOpen(true)} onRetry={retryProcessing} /> : null}
        {!failedPage ? <>
        <View style={layout.row} accessibilityRole="tablist">
          {[["brief", "Brief"], ["read", "Read"], ["original", "Original"]].map(([value, label]) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)} style={{ minHeight: 44, padding: space.s3 }}>
              <Text maxFontSizeMultiplier={1.3} style={[textStyle("bodySm"), { color: mode === value ? colors.accent : colors.fgSecondary }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {mode === "read" ? <ReadingTools key={bookmark.id} id={bookmark.id} userId={ownsBookmark ? user?.id : undefined} body={content?.blocks.map(block => block.text).join("\n\n") ?? ""} /> : null}
        {mode === "read" ? contentLoading ? <View accessibilityLabel="Loading full text"><SkeletonRows /></View> : content?.blocks.length ? <>
          {content.truncated ? <Notice message="Showing the opening part of this article. Open the original for the complete text." action="Open original" onAction={handleOpenUrl} /> : null}
          {content.blocks.map((block, index) => (
          <Text key={index} selectable accessibilityRole={block.kind === "heading" ? "header" : undefined} style={[block.kind === "heading" ? textStyle("title2") : { fontFamily: fontFamily.serif, fontSize: readingSize, lineHeight: readingSize * 1.7 }, { color: colors.fg }]}>{block.kind === "list_item" ? `• ${block.text}` : block.text}</Text>
        ))}</> : <Notice message={contentOffline ? "Connect to load the full text." : "Full text isn't available for this save."} action="Open original" onAction={handleOpenUrl} /> : mode === "brief" ? <View
          style={[
            layout.panel,
            { borderColor: colors.border, backgroundColor: colors.bgPanel },
          ]}
        >
          <View style={layout.between}>
            <Text
              accessibilityRole="header"
              style={[
                textStyle("bodySm"),
                { color: colors.fg, fontFamily: "InterSemibold" },
              ]}
            >
              {bookmark.isPrivateLink ? "From your description" : "Cosmic brief"}
            </Text>
            {bookmark.cosmicBriefSummary ? (
              <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
                1 min read
              </Text>
            ) : null}
          </View>
          {processing && !bookmark.cosmicBriefSummary ? <>
            <Notice message={content?.source === "pasted" ? "Cosmic is reading the text you pasted" : bookmark.isPrivateLink ? "Cosmic is preparing your description. You can keep browsing." : "Cosmic is reading it. You can keep browsing while the brief is prepared."} />
            <PendingPhases events={events} privateLink={bookmark.isPrivateLink} />
          </> : null}
          {bookmark.cosmicBriefSummary ? (
            <Text selectable style={[textStyle("body"), { color: colors.fg }]}>
              {bookmark.cosmicBriefSummary}
            </Text>
          ) : bookmark.cosmicSummary ? (
            <Markdown style={markdownStyles}>{bookmark.cosmicSummary}</Markdown>
          ) : (
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
              {(bookmark.isPrivateLink
                  ? "Open the original to read this private page."
                  : "No brief is available yet. You can still open the original.")}
            </Text>
          )}
          {bookmark.cosmicKeyPoints?.length ? (
            <>
              <Text style={[textStyle("bodySm"), { color: colors.fg }]}>
                Key points
              </Text>
              {bookmark.cosmicKeyPoints.map((point, index) => (
                <Text
                  key={index}
                  style={[textStyle("bodySm"), { color: colors.fgSecondary }]}
                >
                  • {point}
                </Text>
              ))}
            </>
          ) : null}
          <Text
            style={[
              textStyle("meta"),
              {
                color: colors.fgTertiary,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                paddingTop: space.s3,
              },
            ]}
          >
            {bookmark.isPrivateLink
              ? "From your description; no article text was fetched."
              : content ? content.source === "pasted" ? `Summarised from the text you pasted · ${siteName}` : `Summarised from the full article (${content.wordCount.toLocaleString("en-US")} words) · ${siteName}` : `Source: ${siteName}`}
          </Text>
        </View> : <>
          <Notice message="The original page opens in the in-app browser." />
          <Button title={`Open ${siteName}`} icon="open-outline" onPress={handleOpenUrl} />
        </>}
        {bookmark.cosmicSummary ? (
          <Button
            title="Continue reading"
            icon="arrow-forward"
            primary
            onPress={() => router.push(`/reader/${bookmark.id}`)}
          />
        ) : (
          <Button
            title="Read the original"
            icon="open-outline"
            primary
            onPress={handleOpenUrl}
          />
        )}
        </> : null}
        {bookmark.isPublic || isShared ? (
          <Button
            title="Read the conversation"
            icon="chatbubble-outline"
            onPress={async () => {
              setConversation(true);
              setCommentsError("");
              try {
                setComments((await MobileAPI.comments(bookmark.id)).comments);
              } catch {
                setCommentsError(
                  "The conversation could not be loaded. Close and try again.",
                );
              }
            }}
          />
        ) : null}
        {ownsBookmark ? (
          <Notice message="Your library and highlights are private, even when you share this save." />
        ) : null}
      </ScrollView>
      {ownsBookmark && (done || !processing) ? <View style={[layout.row, { padding: space.s3, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
        {done ? <>
          <Text accessibilityLiveRegion="polite" style={[textStyle("bodySm"), { color: colors.fg, width: "100%" }]}>{isPick ? doneCount === visiblePicks.length ? `All ${visiblePicks.length} done` : `Done · ${doneCount} of ${visiblePicks.length}` : "Done"}</Text>
          {actionState.toast?.message === "Marked done" && actionState.toast.undo ? <Button title="Undo" onPress={actionState.toast.undo} /> : null}
          {isPick && nextPick ? <Button title="Next pick" primary onPress={() => { controller.navigationAway(); router.replace(`/bookmark/${nextPick.bookmark.id}`); }} /> : <Button title="Back" onPress={handleBack} />}
        </> : <>
          <Button title="Later" icon="time-outline" onPress={() => selectAction("later")} />
          <Button title="Mark done" primary onPress={() => { if (viewed) controller.done(viewed, true); }} />
        </>}
      </View> : null}
      <Toast message={actionState.toast?.message} undo={done && actionState.toast?.message === "Marked done" ? undefined : actionState.toast?.undo} close={controller.closeToast} />
      <BookmarkActionSheets key={user?.id ?? "signed-out"} accountId={user?.id} selection={selection} controller={controller} onChange={setSelection} onClose={() => setSelection(undefined)} />
      <Sheet title="Why you saved it" visible={noteOpen && ownsBookmark} onClose={() => setNoteOpen(false)}>
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>This note is private. It is never added to the public conversation.</Text>
        <TextInput accessibilityLabel="Why you saved it" multiline value={noteDraft} onChangeText={setNoteDraft} style={[layout.input, { color: colors.fg, borderColor: colors.borderStrong }]} />
        <Text style={[textStyle("meta"), { color: noteDraft.length > 500 ? colors.danger : colors.fgSecondary }]}>{noteDraft.length} / 500 characters</Text>
        <Button title="Save note" primary disabled={noteDraft.length > 500} onPress={() => { if (viewed) controller.note(viewed, noteDraft.trim() ? noteDraft : null); setNoteOpen(false); }} />
        <Button title="Clear note" disabled={!bookmark.userNote} onPress={() => { if (viewed) controller.note(viewed, null); setNoteOpen(false); }} />
      </Sheet>
      <Sheet
        title="Conversation"
        visible={conversation}
        onClose={() => setConversation(false)}
      >
        {commentsError ? <Notice message={commentsError} error /> : null}
        {comments.map((value) => (
          <View
            key={value.id}
            style={[layout.panel, { borderColor: colors.border }]}
          >
            <Text style={[textStyle("bodySm"), { color: colors.fg }]}>
              {value.author?.name || value.author?.handle || "Reader"}
            </Text>
            <Text style={[textStyle("body"), { color: colors.fgSecondary }]}>
              {value.isDeleted ? "Comment removed" : value.body}
            </Text>
          </View>
        ))}
        <TextInput
          accessibilityLabel="Add a public comment"
          placeholder="What did this make you think about?"
          placeholderTextColor={colors.fgTertiary}
          multiline
          value={comment}
          onChangeText={setComment}
          style={[
            layout.input,
            { color: colors.fg, borderColor: colors.borderStrong },
          ]}
        />
        <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
          Comments are public. Your highlights remain private.
        </Text>
        <Button
          title="Post comment"
          primary
          busy={posting}
          disabled={!comment.trim()}
          onPress={async () => {
            setPosting(true);
            try {
              const created = await MobileAPI.comment(
                bookmark.id,
                comment.trim(),
              );
              setComments((previous) => [...previous, created]);
              setComment("");
              setCommentsError("");
            } catch {
              setCommentsError("Your comment was not posted. Try again.");
            } finally {
              setPosting(false);
            }
          }}
        />
      </Sheet>
      <Sheet title="Paste the article text" visible={pasteOpen && ownsBookmark && !bookmark.isPrivateLink} onClose={() => { ++pasteRequest.current; pasteAbort.current?.abort(); setPasteBusy(false); setPasteOpen(false); }}>
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>Copy the article where you can read it and paste it here. Cosmic writes the brief from this text only.</Text>
        <TextInput accessibilityLabel="Article text" multiline editable={!pasteBusy} value={pasteText} onChangeText={setPasteText} placeholder="Paste at least a few paragraphs" placeholderTextColor={colors.fgTertiary} style={[textStyle("body"), { color: colors.fg, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.s3, minHeight: space.s6 * 4, textAlignVertical: "top" }]} />
        <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>{pasteText.length.toLocaleString("en-US")} characters · at least 200</Text>
        {pasteError ? <Notice message="Change was not saved. Check your connection." error action="Retry" onAction={submitPaste} /> : null}
        <Button title="Write the brief" primary busy={pasteBusy} disabled={pasteText.length < 200 || pasteText.length > 100000} onPress={submitPaste} />
      </Sheet>
      <Sheet
        title="Share this save"
        visible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
      >
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
          A public link shares the save and its brief. Your highlights stay
          private.
        </Text>
        {isShared && shareUrl ? (
          <>
            <Text selectable style={[textStyle("meta"), { color: colors.fg }]}>
              {shareUrl}
            </Text>
            <Button
              title={isCopied ? "Copied!" : "Copy public link"}
              primary
              onPress={handleCopyLink}
            />
            <Button title="Share via…" onPress={handleNativeShare} />
            <Button
              title="Turn off public access"
              busy={isShareLoading}
              onPress={handleUnshare}
            />
          </>
        ) : ownsBookmark && isShared ? (
          <>
            <Notice message="This save is already public. You can retrieve its link or turn off public access." />
            <Button
              title="Get public link"
              primary
              busy={isShareLoading}
              onPress={publishBookmark}
            />
            <Button
              title="Turn off public access"
              busy={isShareLoading}
              onPress={handleUnshare}
            />
          </>
        ) : ownsBookmark ? (
          <>
            <Notice message="This save is currently private. Creating a public link makes it accessible to anyone with the link." />
            <Button
              title="Make public & create link"
              primary
              busy={isShareLoading}
              onPress={publishBookmark}
            />
          </>
        ) : (
          <Button
            title="Share original link"
            onPress={() => {
              void Share.share({
                message: bookmark.sourceUrl,
                url: bookmark.sourceUrl,
              });
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}
const styles = StyleSheet.create({
  like: {
    flexDirection: "row",
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: space.s1,
  },
});
