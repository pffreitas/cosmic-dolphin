import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import type {
  Bookmark as ContractBookmark,
  BookmarkContent,
  BookmarkProcessingEvent,
  TodayPicksResponse,
} from "@cosmic-dolphin/api-client";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  Button,
  EmptyState,
  layout,
  Notice,
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
import {
  BookmarkActionSheets,
  type ActionSheet,
} from "@/components/BookmarkActionSheets";
import { Toast } from "@/components/Toast";
import { isAuthError } from "@/lib/api-errors";
import { textStyle } from "@/constants/fonts";
import { radius, space, type } from "@/constants/theme";
import { useWebTheme, webText, webSansFont } from "@/components/web-home/theme";
import { Action, Copy, Tag } from "@/components/web-home/Primitives";
import { Favicon } from "@/components/web-home/FeedItem";
import { BalancedTitle } from "@/components/web-home/BalancedTitle";
import { DetailProvenance } from "@/components/web-bookmark/Provenance";
import { ReaderImage } from "@/components/web-bookmark/ReaderImage";
import { SheetButton } from "@/components/web-save/SaveSheet";
import { DetailFrame } from "@/components/web-bookmark/Frame";
import { DetailReader, detailProse } from "@/components/web-bookmark/Reader";
import { DetailComments } from "@/components/web-bookmark/Comments";
import {
  Check,
  BookmarkPlus,
  RotateCcw,
  ExternalLink,
  Share as ShareIcon,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Bookmark as BookmarkIcon,
  ChevronRight,
  RotateCw,
  Lock,
} from "lucide-react-native";

function readingBookmark(value: Bookmark): ContractBookmark {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    readAt: value.readAt ? new Date(value.readAt) : undefined,
    laterUntil: value.laterUntil
      ? new Date(value.laterUntil)
      : value.laterUntil,
    captureQueuedAt: value.captureQueuedAt
      ? new Date(value.captureQueuedAt)
      : value.captureQueuedAt,
  } as ContractBookmark;
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "";
  }
}

export default function BookmarkDetailScreen() {
  const { user } = useAuth();
  const { id, slug } = useLocalSearchParams<{ id: string; slug?: string }>();
  // Reset private drafts synchronously at the route/account boundary.
  return (
    <BookmarkDetailController
      key={`${user?.id ?? ""}:${id}:${slug ?? "owner"}`}
    />
  );
}
function BookmarkDetailController() {
  const {
    id,
    slug,
    mode: requestedMode,
    paste: requestedPaste,
    retry: requestedRetry,
  } = useLocalSearchParams<{
    id: string;
    slug?: string;
    mode?: string;
    paste?: string;
    retry?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useWebTheme();
  const preferences = usePreferences();
  const readingSize =
    preferences.readingSize === "larger"
      ? type.title1.fontSize
      : preferences.readingSize === "large"
        ? space.s5
        : type.title2.fontSize;

  const pageIdentity = useRef("");
  pageIdentity.current = `${user?.id ?? ""}:${id}:${slug ?? "owner"}`;
  const bookmarkRequest = useRef(0);
  const cancelBookmarkRequest = useCallback(() => {
    bookmarkRequest.current++;
  }, []);

  const [moreOpen, setMoreOpen] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState(false);
  const recoveryHandled = useRef("");
  const [retryBusy, setRetryBusy] = useState(false);
  const pasteRequest = useRef(0);
  const pasteAbort = useRef<AbortController>();
  const cancelRecovery = useCallback(() => {
    ++pasteRequest.current;
    pasteAbort.current?.abort();
  }, []);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const detailMutationAbort = useRef<AbortController>();
  useEffect(() => () => detailMutationAbort.current?.abort(), []);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [selection, setSelection] = useState<ActionSheet>();
  const [storedBookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState("");
  const { controller, state: actionState } = useBookmarkActions(user?.id);
  const viewed =
    storedBookmark && loadedIdentity === pageIdentity.current
      ? controller.view(readingBookmark(storedBookmark))
      : undefined;
  const bookmark = viewed
    ? {
        ...storedBookmark!,
        ...viewed,
        createdAt: viewed.createdAt.toISOString(),
        updatedAt: viewed.updatedAt.toISOString(),
        readAt: viewed.readAt?.toISOString(),
        laterUntil: viewed.laterUntil?.toISOString(),
      }
    : null;
  const bookmarkRef = useRef(bookmark);
  bookmarkRef.current = bookmark;
  const [picks, setPicks] = useState<TodayPicksResponse>();
  useEffect(() => {
    let active = true;
    const sequence = nextReadingSequence();
    void MobileAPI.picks()
      .then((value) => {
        if (!active) return;
        controller.synchronize(
          value.items.map((pick) => pick.bookmark),
          sequence,
        );
        setPicks(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [controller]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("article");
  useEffect(() => {
    setMode(
      requestedMode === "read" || requestedMode === "original"
        ? requestedMode
        : "article",
    );
  }, [id, requestedMode]);
  const [events, setEvents] = useState<BookmarkProcessingEvent[]>([]);
  const [content, setContent] = useState<BookmarkContent>();
  const [contentOffline, setContentOffline] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const reading = useReadingProgress(
    id,
    bookmark?.userId === user?.id ? user?.id : undefined,
    (mode === "read" && !!content?.blocks.length) ||
      (mode === "article" && !!bookmark?.cosmicSummary),
  );
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
      void MobileAPI.content(contentBookmarkId, undefined, user?.id)
        .then((value) => {
          if (active) setContent(value);
        })
        .catch((error) => {
          if (active) setContentOffline(!error?.response?.status);
        })
        .finally(() => {
          if (active) setContentLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [
    contentBookmarkId,
    contentOwnerId,
    contentPrivate,
    contentProcessing,
    user?.id,
  ]);

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
    setNoteOpen(false);
    setNoteDraft("");
    setSelection(undefined);
    cancelRecovery();
    setPasteOpen(false);
    setPasteText("");
    setPasteBusy(false);
    setPasteError(false);
    setRetryBusy(false);
    return cancelRecovery;
  }, [id, slug, user?.id, cancelRecovery]);

  const applyBookmark = useCallback(
    (data: Bookmark) => {
      const identity = `${user?.id ?? ""}:${id}:${slug ?? "owner"}`;
      if (identity !== pageIdentity.current || data.id !== id) return;
      setLoadedIdentity(identity);
      setBookmark(data);
      setIsLiked(data.isLikedByCurrentUser ?? false);
      setLikeCount(data.likeCount ?? 0);
      setIsShared(data.isPublic ?? false);
    },
    [id, slug, user?.id],
  );

  const fetchBookmark = useCallback(
    async (bookmarkId: string) => {
      setIsLoading(true);
      setError(null);

      const sequence = nextReadingSequence();
      const request = ++bookmarkRequest.current;
      const identity = `${user?.id ?? ""}:${bookmarkId}:${slug ?? "owner"}`;
      const isCurrent = () =>
        request === bookmarkRequest.current &&
        identity === pageIdentity.current;
      try {
        const data =
          slug === undefined
            ? await MobileAPI.bookmark(bookmarkId, user?.id)
            : await MobileAPI.sharedBookmark(slug);
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
        if (isCurrent()) {
          setLoadedIdentity(identity);
          setIsLoading(false);
        }
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
      slug !== undefined ||
      !processingId ||
      !["idle", "processing"].includes(processingStatus || "")
    )
      return;
    let active = true;
    const load = async () => {
      const sequence = nextReadingSequence();
      try {
        const timeline = await MobileAPI.processingTimeline(
          processingId,
          undefined,
          user?.id,
        );
        if (active) {
          controller.synchronize(
            [readingBookmark(timeline.bookmark)],
            sequence,
          );
          setEvents(timeline.events);
          applyBookmark(timeline.bookmark);
          cacheBookmarksInBackground(user?.id, [timeline.bookmark]);
        }
      } catch {
        /* Keep the saved link and reported phases usable on failure. */
      }
    };
    setEvents([]);
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    processingId,
    processingStatus,
    applyBookmark,
    slug,
    user?.id,
    controller,
  ]);

  const handleOpenUrl = () => {
    if (bookmark?.sourceUrl) openOriginal(bookmark.sourceUrl);
  };

  const submitPaste = async () => {
    if (
      !bookmark ||
      bookmark.userId !== user?.id ||
      bookmark.isPrivateLink ||
      pasteBusy ||
      pasteText.length < 200 ||
      pasteText.length > 100000
    )
      return;
    const identity = pageIdentity.current;
    const request = ++pasteRequest.current;
    const abort = new AbortController();
    pasteAbort.current = abort;
    const current = () =>
      identity === pageIdentity.current &&
      request === pasteRequest.current &&
      !abort.signal.aborted;
    cancelBookmarkRequest();
    const sequence = nextReadingSequence();
    setPasteBusy(true);
    setPasteError(false);
    try {
      const result = await MobileAPI.pasteContent(
        bookmark.id,
        pasteText,
        abort.signal,
        user.id,
      );
      if (!current()) return;
      controller.synchronize([readingBookmark(result.bookmark)], sequence);
      applyBookmark(result.bookmark);
      setMode("article");
      setPasteOpen(false);
      setPasteText("");
    } catch {
      if (current()) setPasteError(true);
    } finally {
      if (current()) setPasteBusy(false);
    }
  };

  const retryProcessing = useCallback(async () => {
    const bookmark = bookmarkRef.current;
    if (!bookmark || bookmark.userId !== user?.id || retryBusy) return;
    const identity = pageIdentity.current;
    const request = ++pasteRequest.current;
    const abort = new AbortController();
    pasteAbort.current = abort;
    const current = () =>
      identity === pageIdentity.current &&
      request === pasteRequest.current &&
      !abort.signal.aborted;
    cancelBookmarkRequest();
    const sequence = nextReadingSequence();
    setRetryBusy(true);
    try {
      const result = await MobileAPI.retry(bookmark.id, user.id, abort.signal);
      if (!current()) return;
      controller.synchronize([readingBookmark(result.bookmark)], sequence);
      applyBookmark(result.bookmark);
      setMode("article");
    } catch {
      if (current()) Alert.alert("Could not retry", "Please try again.");
    } finally {
      if (current()) setRetryBusy(false);
    }
  }, [user?.id, retryBusy, controller, applyBookmark, cancelBookmarkRequest]);
  const recoveryOwner = bookmark?.userId,
    recoveryStatus = bookmark?.processingStatus,
    recoveryCode = bookmark?.processingFailureCode,
    recoveryPrivate = bookmark?.isPrivateLink;
  useEffect(() => {
    if (recoveryOwner !== user?.id || recoveryStatus !== "failed") return;
    const intent = `${pageIdentity.current}:${requestedPaste || ""}:${requestedRetry || ""}`;
    if (recoveryHandled.current === intent) return;
    recoveryHandled.current = intent;
    if (
      requestedPaste === "1" &&
      !recoveryPrivate &&
      recoveryCode &&
      recoveryCode !== "provider"
    )
      setPasteOpen(true);
    if (requestedRetry === "1") void retryProcessing();
  }, [
    recoveryOwner,
    recoveryStatus,
    recoveryCode,
    recoveryPrivate,
    user?.id,
    requestedPaste,
    requestedRetry,
    retryProcessing,
  ]);

  const saveSummary = async () => {
    const current = bookmarkRef.current;
    if (
      !current ||
      current.userId !== user?.id ||
      !current.isPrivateLink ||
      summaryBusy
    )
      return;
    const abort = new AbortController();
    detailMutationAbort.current = abort;
    const sequence = nextReadingSequence();
    setSummaryBusy(true);
    setSummaryError("");
    try {
      const result = await MobileAPI.update(
        current.id,
        { cosmicSummary: summaryDraft },
        abort.signal,
        user.id,
      );
      if (!alive.current || abort.signal.aborted) return;
      controller.synchronize([readingBookmark(result)], sequence);
      applyBookmark(result);
      setSummaryOpen(false);
    } catch {
      if (alive.current && !abort.signal.aborted)
        setSummaryError("Couldn't save that summary. Try again.");
    } finally {
      if (alive.current) setSummaryBusy(false);
    }
  };
  const deleteBookmark = async () => {
    const current = bookmarkRef.current;
    if (!current || current.userId !== user?.id || deleting) return;
    const abort = new AbortController();
    detailMutationAbort.current = abort;
    setDeleting(true);
    try {
      await MobileAPI.remove(current.id, user.id, abort.signal);
      if (alive.current && !abort.signal.aborted) {
        controller.navigationAway();
        router.replace("/library");
      }
    } catch {
      if (alive.current && !abort.signal.aborted)
        Alert.alert(
          "Couldn't delete this save",
          "Check your connection and try again.",
        );
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

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
        ? await BookmarksAPI.unlike(bookmark.id, user?.id)
        : await BookmarksAPI.like(bookmark.id, user?.id);

      if (!alive.current) return;
      setLikeCount(result.likeCount);
      setIsLiked(result.isLikedByCurrentUser);
    } catch (error) {
      if (!alive.current) return;
      console.error("Failed to toggle like:", error);
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
      Alert.alert(
        "Error",
        "Failed to update like status. Please try again later.",
        [{ text: "OK" }],
      );
    } finally {
      if (alive.current) setIsLikeLoading(false);
    }
  };

  const handleShareToggle = () => {
    setIsShareModalVisible(true);
  };
  const publishBookmark = async () => {
    if (!bookmark || isShareLoading) return;
    setIsShareLoading(true);
    try {
      const result = await BookmarksAPI.share(bookmark.id, user?.id);
      if (!alive.current) return;
      setIsShared(result.isPublic);
      setShareUrl(result.shareUrl);
      setIsShareModalVisible(true);
    } catch {
      if (alive.current)
        Alert.alert("Error", "Failed to share bookmark. Please try again.");
    } finally {
      if (alive.current) setIsShareLoading(false);
    }
  };

  const handleUnshare = async () => {
    if (!bookmark || isShareLoading) return;

    setIsShareLoading(true);
    try {
      const result = await BookmarksAPI.unshare(bookmark.id, user?.id);
      if (!alive.current) return;
      setIsShared(result.isPublic);
      setShareUrl("");
      setIsShareModalVisible(false);
    } catch {
      if (alive.current)
        Alert.alert("Error", "Failed to unshare bookmark. Please try again.");
    } finally {
      if (alive.current) setIsShareLoading(false);
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
      <DetailFrame>
        <View style={{ padding: 16 }}>
          <SkeletonRows />
        </View>
      </DetailFrame>
    );
  if (error || !bookmark)
    return (
      <DetailFrame>
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Something went wrong"
            description={error || "Bookmark not found"}
            action="Try again"
            onAction={() => {
              if (id) void fetchBookmark(id);
            }}
          />
        </View>
      </DetailFrame>
    );
  const siteName = extractDomain(bookmark.sourceUrl);
  const ownsBookmark = bookmark.userId === user?.id;
  const processing =
    bookmark.processingStatus === "processing" ||
    bookmark.processingStatus === "idle";
  const failedPage =
    ownsBookmark &&
    bookmark.processingStatus === "failed" &&
    !bookmark.isPrivateLink;
  const visiblePicks = (picks?.items ?? [])
    .filter((pick) =>
      controller.isVisible({ type: "own_save", bookmark: pick.bookmark }),
    )
    .sort((a, b) => a.position - b.position);
  const isPick = visiblePicks.some((pick) => pick.bookmark.id === bookmark.id);
  const doneCount = visiblePicks.filter(
    (pick) => controller.view(pick.bookmark).readAt,
  ).length;
  const nextPick = visiblePicks.find(
    (pick) =>
      pick.bookmark.id !== bookmark.id &&
      !controller.view(pick.bookmark).readAt,
  );
  const done = !!viewed?.readAt;
  const selectAction = (mode: ActionSheet["mode"]) => {
    if (viewed)
      setSelection({ mode, item: { type: "own_save", bookmark: viewed } });
  };
  const brief = bookmark.cosmicBriefSummary;
  return (
    <DetailFrame>
      {mode === "read" && content?.blocks.length ? (
        <View
          accessibilityLabel={`${Math.round(reading.percent)}% read`}
          style={{ height: 2, backgroundColor: colors.bgInset }}
        >
          <View
            style={{
              height: 2,
              width: `${reading.percent}%`,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      ) : null}
      <ScrollView
        ref={reading.scroll}
        accessibilityLabel="Saved article"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 40,
          paddingBottom: 112,
          gap: 64,
        }}
        scrollEventThrottle={100}
        onScroll={reading.onScroll}
        onContentSizeChange={reading.onContentSizeChange}
      >
        <View
          style={{ width: "100%", maxWidth: 680, alignSelf: "center", gap: 32 }}
        >
          <View style={{ gap: 24 }}>
            <View style={{ gap: 12 }}>
              {ownsBookmark ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Action
                    label="Library"
                    onPress={() => router.push("/library")}
                    style={{ paddingHorizontal: 0, minHeight: 18 }}
                  >
                    <Copy role="meta" maxFontSizeMultiplier={1.3}>
                      Library
                    </Copy>
                  </Action>
                  {bookmark.collectionPath?.map((part) => (
                    <React.Fragment key={part.id}>
                      <ChevronRight size={10} color={colors.fgTertiary} />
                      <Action
                        label={part.name}
                        style={{ paddingHorizontal: 0, minHeight: 18 }}
                        onPress={() =>
                          router.push({
                            pathname: "/library",
                            params: { collectionId: part.id },
                          })
                        }
                      >
                        <Copy role="meta" maxFontSizeMultiplier={1.3}>
                          {part.name}
                        </Copy>
                      </Action>
                    </React.Fragment>
                  ))}
                </View>
              ) : null}
              <BalancedTitle
                maxLines={0}
                style={[webText("title1"), { color: colors.fg }]}
              >
                {bookmark.title?.trim() || "Untitled"}
              </BalancedTitle>
              <DetailProvenance
                bookmark={bookmark}
                domain={siteName}
                owner={ownsBookmark}
                onOriginal={handleOpenUrl}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <SheetButton
                label={
                  ownsBookmark
                    ? done
                      ? "Mark as unread"
                      : "Mark as read"
                    : "Save to your library"
                }
                icon={ownsBookmark ? (done ? RotateCcw : Check) : BookmarkPlus}
                primary={!ownsBookmark || !done}
                secondary={ownsBookmark && done}
                busy={isReadLoading}
                onPress={() => {
                  if (ownsBookmark && viewed) controller.done(viewed, !done);
                  else {
                    setIsReadLoading(true);
                    void MobileAPI.saveRecommendation(bookmark.id, user?.id)
                      .then((saved) => {
                        if (alive.current)
                          router.replace(`/bookmark/${saved.id}`);
                      })
                      .catch(() => {
                        if (alive.current)
                          Alert.alert(
                            "Link was not saved",
                            "Check your connection and try again.",
                          );
                      })
                      .finally(() => {
                        if (alive.current) setIsReadLoading(false);
                      });
                  }
                }}
              />
              <SheetButton
                label="Open original"
                secondary
                onPress={handleOpenUrl}
              />
              {ownsBookmark ? (
                <View
                  style={{
                    marginLeft: "auto",
                    marginRight: -8,
                    flexDirection: "row",
                    gap: 2,
                    alignItems: "center",
                  }}
                >
                  <Action
                    label="Share"
                    icon={ShareIcon}
                    onPress={handleShareToggle}
                    style={{ width: 34, height: 36, paddingHorizontal: 0 }}
                  />
                  <Action
                    label="More actions"
                    icon={MoreHorizontal}
                    onPress={() => setMoreOpen(true)}
                    style={{ width: 34, height: 34, paddingHorizontal: 0 }}
                  />
                </View>
              ) : null}
            </View>
            {done && actionState.toast?.message === "Marked done" ? (
              <View style={{ gap: 8 }}>
                <Copy>
                  {isPick
                    ? doneCount === visiblePicks.length
                      ? `All ${visiblePicks.length} done`
                      : `Done · ${doneCount} of ${visiblePicks.length}`
                    : "Done"}
                </Copy>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {actionState.toast.undo ? (
                    <Action label="Undo" onPress={actionState.toast.undo}>
                      Undo
                    </Action>
                  ) : null}
                  {isPick && nextPick ? (
                    <Action
                      label="Next pick"
                      onPress={() => {
                        controller.navigationAway();
                        router.replace(`/bookmark/${nextPick.bookmark.id}`);
                      }}
                    >
                      Next pick
                    </Action>
                  ) : (
                    <Action label="Back" onPress={handleBack}>
                      Back
                    </Action>
                  )}
                </View>
              </View>
            ) : null}
          </View>
          {reading.error ? <Notice message={reading.error} error /> : null}
          {ownsBookmark && bookmark.processingStatus === "failed" ? (
            <BookmarkFailure
              code={bookmark.processingFailureCode}
              url={bookmark.sourceUrl}
              page
              privateLink={bookmark.isPrivateLink}
              onPaste={() => setPasteOpen(true)}
              onRetry={retryProcessing}
            />
          ) : null}
          {!failedPage ? (
            mode === "read" ? (
              <View style={{ gap: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Copy role="meta">Saved full text</Copy>
                  <Action
                    label="Back to article"
                    onPress={() => setMode("article")}
                  >
                    Back to article
                  </Action>
                </View>
                <ReadingTools
                  key={bookmark.id}
                  id={bookmark.id}
                  userId={ownsBookmark ? user?.id : undefined}
                  body={
                    content?.blocks.map((block) => block.text).join("\n\n") ??
                    ""
                  }
                />
                {contentLoading ? (
                  <View accessibilityLabel="Loading full text">
                    <SkeletonRows />
                  </View>
                ) : content?.blocks.length ? (
                  <>
                    {content.truncated ? (
                      <Notice
                        message="Showing the opening part of this article. Open the original for the complete text."
                        action="Open original"
                        onAction={handleOpenUrl}
                      />
                    ) : null}
                    {content.blocks.map((block, index) => (
                      <Text
                        key={index}
                        selectable
                        accessibilityRole={
                          block.kind === "heading" ? "header" : undefined
                        }
                        style={[
                          block.kind === "heading"
                            ? webText("title2")
                            : detailProse(readingSize),
                          { color: colors.fg },
                        ]}
                      >
                        {block.kind === "list_item"
                          ? `• ${block.text}`
                          : block.text}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Notice
                    message={
                      contentOffline
                        ? "Connect to load the full text."
                        : "Full text isn't available for this save."
                    }
                    action="Open original"
                    onAction={handleOpenUrl}
                  />
                )}
              </View>
            ) : mode === "original" ? (
              <View style={{ gap: 16 }}>
                <Copy>The original page opens in the in-app browser.</Copy>
                <SheetButton
                  label={`Open ${siteName}`}
                  icon={ExternalLink}
                  onPress={handleOpenUrl}
                />
                <Action
                  label="Back to article"
                  onPress={() => setMode("article")}
                >
                  Back to article
                </Action>
              </View>
            ) : (
              <>
                {bookmark.isPrivateLink ? (
                  <View
                    style={{
                      gap: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      backgroundColor: colors.bgSubtle,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Lock size={16} color={colors.warning} />
                      <View style={{ flex: 1, gap: 8 }}>
                        <Copy style={{ color: colors.fg }}>
                          Private link. Cosmic couldn&apos;t read this page, so
                          there is no brief — but your own words about it are
                          worth more than one anyway.
                        </Copy>
                        <Copy role="meta">
                          From your description; no article text was fetched.
                        </Copy>
                        {bookmark.cosmicBriefSummary ? (
                          <Copy>{bookmark.cosmicBriefSummary}</Copy>
                        ) : null}
                        {ownsBookmark ? (
                          <Action
                            label={
                              bookmark.cosmicSummary
                                ? "Edit your summary"
                                : "Write your own"
                            }
                            onPress={() => {
                              setSummaryDraft(bookmark.cosmicSummary ?? "");
                              setSummaryError("");
                              setSummaryOpen(true);
                            }}
                          >
                            {bookmark.cosmicSummary
                              ? "Edit your summary"
                              : "Write your own"}
                          </Action>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : processing && !bookmark.cosmicBriefSummary ? (
                  <View style={{ gap: 16 }}>
                    <Notice
                      message={
                        content?.source === "pasted"
                          ? "Cosmic is reading the text you pasted"
                          : "Cosmic is reading it. You can keep browsing while the brief is prepared."
                      }
                    />
                    <PendingPhases events={events} />
                  </View>
                ) : brief || bookmark.cosmicKeyPoints?.length ? (
                  <View
                    style={{
                      padding: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      backgroundColor: colors.bgPanel,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <Copy
                        role="meta"
                        style={{ fontFamily: webSansFont(600) }}
                      >
                        Cosmic brief
                      </Copy>
                      <View style={{ flex: 1 }} />
                      {bookmark.metadata?.readingTime ? (
                        <Copy role="meta">{`${bookmark.metadata.readingTime} min article`}</Copy>
                      ) : null}
                    </View>
                    {!brief ? (
                      <Copy>
                        No brief is available yet. You can still open the
                        original.
                      </Copy>
                    ) : null}
                    {brief ? (
                      <Text
                        selectable
                        style={[
                          webText("briefSummary"),
                          {
                            color: colors.fgSecondary,
                            marginBottom: bookmark.cosmicKeyPoints?.length
                              ? 16
                              : 0,
                          },
                        ]}
                      >
                        {brief}
                      </Text>
                    ) : null}
                    {bookmark.cosmicKeyPoints?.length ? (
                      <>
                        <Copy
                          role="meta"
                          style={{
                            fontFamily: webSansFont(600), color: colors.fg,
                            marginBottom: 10,
                          }}
                        >
                          Key points
                        </Copy>
                        <View style={{ gap: 11 }}>
                          {bookmark.cosmicKeyPoints.map((point, index) => (
                            <View
                              key={index}
                              style={{ flexDirection: "row", gap: 11 }}
                            >
                              <View
                                style={{
                                  width: 5,
                                  height: 5,
                                  marginTop: 9,
                                  borderRadius: radius.pill,
                                  backgroundColor: colors.fgTertiary,
                                }}
                              />
                              <Text
                                style={[
                                  webText("briefKeyPoint"),
                                  { flex: 1, color: colors.fgSecondary },
                                ]}
                              >
                                {point}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}
                    <View
                      style={{
                        marginTop: 16,
                        paddingTop: 14,
                        borderTopWidth: 1,
                        borderColor: colors.border,
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <Favicon
                          domain={siteName}
                          uri={bookmark.metadata?.openGraph?.favicon}
                        />
                        <Copy
                          role="meta"
                          style={{
                            color: colors.fg,
                            fontFamily: webSansFont(500),
                          }}
                        >
                          {siteName}
                        </Copy>
                      </View>
                      <View
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: radius.pill,
                          backgroundColor: colors.fgTertiary,
                        }}
                      />
                      <Text
                        accessibilityLabel={
                          content
                            ? content.source === "pasted"
                              ? `Summarised from the text you pasted · ${siteName}`
                              : `Summarised from the full article (${content.wordCount.toLocaleString("en-US")} words) · ${siteName}`
                            : `Source: ${siteName}`
                        }
                        style={[webText("meta"), { color: colors.fgSecondary }]}
                      >
                        {content?.source === "pasted"
                          ? "summarised from the text you pasted"
                          : "summarised from the full article"}
                      </Text>
                      {ownsBookmark ? (
                        <View style={{ marginLeft: "auto" }}>
                          <Action
                            label="Regenerate brief"
                            icon={RotateCw}
                            iconSize={14}
                            disabled={retryBusy}
                            onPress={retryProcessing}
                          >
                            Regenerate
                          </Action>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Copy>
                    No brief is available yet. You can still open the original.
                  </Copy>
                )}
                {bookmark.cosmicSummary ? (
                  <View style={{ marginTop: 16, gap: 24 }}>
                    <DetailReader body={bookmark.cosmicSummary} />
                    {bookmark.cosmicImages?.length ? (
                      <View style={{ gap: 16 }}>
                        {bookmark.cosmicImages.map((image, index) => (
                          <ReaderImage key={index} image={image} />
                        ))}
                      </View>
                    ) : null}
                    {bookmark.cosmicTags?.length ? (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        {bookmark.cosmicTags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : processing ? (
                  <SkeletonRows />
                ) : null}
              </>
            )
          ) : null}
          {ownsBookmark && bookmark.userNote ? (
            <View style={{ gap: 8 }}>
              <Copy role="meta">Why you saved it</Copy>
              <Copy>{bookmark.userNote}</Copy>
              <Action
                label="Edit note"
                onPress={() => {
                  setNoteDraft(bookmark.userNote ?? "");
                  setNoteOpen(true);
                }}
              >
                Edit note
              </Action>
            </View>
          ) : null}
        </View>
        <View
          style={{
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 16,
            gap: 32,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 2,
              marginLeft: -8,
              alignItems: "center",
            }}
          >
            <Action
              testID="like-button"
              label={isLiked ? "Unlike" : "Like"}
              icon={Heart}
              tone="like"
              selected={isLiked}
              disabled={isLikeLoading}
              onPress={handleLikeToggle}
            >
              {likeCount}
            </Action>
            <Action
              label="Comments"
              icon={MessageCircle}
              onPress={() =>
                reading.scroll.current?.scrollToEnd({ animated: true })
              }
            >
              {bookmark.commentCount ?? 0}
            </Action>
            {ownsBookmark ? (
              <Action
                label="Saved"
                icon={BookmarkIcon}
                onPress={() => setMoreOpen(true)}
              >
                Saved
              </Action>
            ) : null}
            <Action
              label="Share save"
              icon={ShareIcon}
              onPress={handleShareToggle}
            />
          </View>
          <DetailComments
            key={`${user?.id ?? ""}:${bookmark.id}`}
            id={bookmark.id}
            accountId={user?.id}
          />
        </View>
      </ScrollView>
      <Toast
        message={actionState.toast?.message}
        undo={
          done && actionState.toast?.message === "Marked done"
            ? undefined
            : actionState.toast?.undo
        }
        close={controller.closeToast}
      />
      <BookmarkActionSheets
        key={user?.id ?? "signed-out"}
        accountId={user?.id}
        selection={selection}
        controller={controller}
        onChange={setSelection}
        onClose={() => setSelection(undefined)}
      />
      <Sheet
        title="Save actions"
        visible={moreOpen && ownsBookmark}
        onClose={() => setMoreOpen(false)}
      >
        <Button
          title={done ? "Mark as unread" : "Mark as read"}
          onPress={() => {
            if (viewed) controller.done(viewed, !done);
            setMoreOpen(false);
          }}
        />
        <Button
          title={bookmark.userNote ? "Edit note" : "Add a note"}
          onPress={() => {
            setMoreOpen(false);
            setNoteDraft(bookmark.userNote ?? "");
            setNoteOpen(true);
          }}
        />
        {
          <Button
            title="Read saved text"
            onPress={() => {
              setMoreOpen(false);
              setMode("read");
            }}
          />
        }
        <Button
          title="Article"
          onPress={() => {
            setMoreOpen(false);
            setMode("article");
          }}
        />
        <Button
          title="Original"
          onPress={() => {
            setMoreOpen(false);
            setMode("original");
          }}
        />
        <Button
          title="Later"
          onPress={() => {
            setMoreOpen(false);
            selectAction("later");
          }}
        />
        <Button
          title="Move to topic"
          onPress={() => {
            setMoreOpen(false);
            selectAction("move");
          }}
        />
        <Button
          title="Not for me"
          onPress={() => {
            if (viewed)
              controller.reject({ type: "own_save", bookmark: viewed });
            setMoreOpen(false);
          }}
        />
        <Button title="Delete" busy={deleting} onPress={deleteBookmark} />
        <Button
          title="Regenerate brief"
          busy={retryBusy}
          onPress={() => {
            setMoreOpen(false);
            void retryProcessing();
          }}
        />
      </Sheet>
      <Sheet
        title="Your own summary"
        visible={summaryOpen && ownsBookmark && !!bookmark.isPrivateLink}
        onClose={() => {
          if (!summaryBusy) setSummaryOpen(false);
        }}
      >
        <TextInput
          accessibilityLabel="Your summary"
          multiline
          editable={!summaryBusy}
          value={summaryDraft}
          onChangeText={setSummaryDraft}
          style={[
            layout.input,
            { color: colors.fg, borderColor: colors.borderStrong },
          ]}
        />
        {summaryError ? <Notice message={summaryError} error /> : null}
        <Button
          title="Save summary"
          primary
          busy={summaryBusy}
          onPress={saveSummary}
        />
      </Sheet>
      <Sheet
        title="Why you saved it"
        visible={noteOpen && ownsBookmark}
        onClose={() => setNoteOpen(false)}
      >
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
          This note is private. It is never added to the public conversation.
        </Text>
        <TextInput
          accessibilityLabel="Why you saved it"
          multiline
          value={noteDraft}
          onChangeText={setNoteDraft}
          style={[
            layout.input,
            { color: colors.fg, borderColor: colors.borderStrong },
          ]}
        />
        <Text
          style={[
            textStyle("meta"),
            {
              color:
                noteDraft.length > 500 ? colors.danger : colors.fgSecondary,
            },
          ]}
        >
          {noteDraft.length} / 500 characters
        </Text>
        <Button
          title="Save note"
          primary
          disabled={noteDraft.length > 500}
          onPress={() => {
            if (viewed)
              controller.note(viewed, noteDraft.trim() ? noteDraft : null);
            setNoteOpen(false);
          }}
        />
        <Button
          title="Clear note"
          disabled={!bookmark.userNote}
          onPress={() => {
            if (viewed) controller.note(viewed, null);
            setNoteOpen(false);
          }}
        />
      </Sheet>
      <Sheet
        title="Paste the article text"
        visible={pasteOpen && ownsBookmark && !bookmark.isPrivateLink}
        onClose={() => {
          ++pasteRequest.current;
          pasteAbort.current?.abort();
          setPasteBusy(false);
          setPasteOpen(false);
        }}
      >
        <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
          Copy the article where you can read it and paste it here. Cosmic
          writes the brief from this text only.
        </Text>
        <TextInput
          accessibilityLabel="Article text"
          multiline
          editable={!pasteBusy}
          value={pasteText}
          onChangeText={setPasteText}
          placeholder="Paste at least a few paragraphs"
          placeholderTextColor={colors.fgTertiary}
          style={[
            textStyle("body"),
            {
              color: colors.fg,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              padding: space.s3,
              minHeight: space.s6 * 4,
              textAlignVertical: "top",
            },
          ]}
        />
        <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>
          {pasteText.length.toLocaleString("en-US")} characters · at least 200
        </Text>
        {pasteError ? (
          <Notice
            message="Change was not saved. Check your connection."
            error
            action="Retry"
            onAction={submitPaste}
          />
        ) : null}
        <Button
          title="Write the brief"
          primary
          busy={pasteBusy}
          disabled={pasteText.length < 200 || pasteText.length > 100000}
          onPress={submitPaste}
        />
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
    </DetailFrame>
  );
}
