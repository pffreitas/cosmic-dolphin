import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  Share,
} from "react-native";
import type { Comment } from "@cosmic-dolphin/api-client";
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
import {
  cacheBookmarksInBackground,
  getCachedBookmark,
  removeCachedBookmark,
} from "@/lib/bookmark-cache";
import { isAuthError } from "@/lib/api-errors";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [conversation, setConversation] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [commentsError, setCommentsError] = useState("");
  const [posting, setPosting] = useState(false);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [readAt, setReadAt] = useState<string | undefined>(undefined);
  const [isReadLoading, setIsReadLoading] = useState(false);

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
    setBookmark(data);
    setIsLiked(data.isLikedByCurrentUser ?? false);
    setLikeCount(data.likeCount ?? 0);
    setIsShared(data.isPublic ?? false);
    setIsRead(data.isRead ?? Boolean(data.readAt));
    setReadAt(data.readAt);
  }, []);

  const fetchBookmark = useCallback(
    async (bookmarkId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await BookmarksAPI.findById(bookmarkId);
        if (data) {
          applyBookmark(data);
          cacheBookmarksInBackground(user?.id, [data]);
        } else {
          if (user?.id) {
            await removeCachedBookmark(user.id, bookmarkId);
          }
          setError("Bookmark not found");
        }
      } catch (err) {
        if (user?.id && !isAuthError(err)) {
          const cachedBookmark = await getCachedBookmark(user.id, bookmarkId);
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
        setIsLoading(false);
      }
    },
    [applyBookmark, user?.id],
  );

  useEffect(() => {
    if (id) {
      fetchBookmark(id);
    }
  }, [fetchBookmark, id]);

  const processingId = bookmark?.id;
  const processingStatus = bookmark?.processingStatus;
  useEffect(() => {
    if (
      !processingId ||
      !["idle", "processing"].includes(processingStatus || "")
    )
      return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const next = await BookmarksAPI.findById(processingId);
        if (active && next) {
          applyBookmark(next);
          cacheBookmarksInBackground(user?.id, [next]);
        }
      } catch {
        /* Keep the original usable while background processing catches up. */
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [processingId, processingStatus, applyBookmark, user?.id]);

  const handleOpenUrl = () => {
    if (bookmark?.sourceUrl) {
      Linking.openURL(bookmark.sourceUrl);
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

  const applyReadState = useCallback(
    (updated: Bookmark) => {
      setBookmark(updated);
      cacheBookmarksInBackground(user?.id, [updated]);
      setIsRead(updated.isRead ?? Boolean(updated.readAt));
      setReadAt(updated.readAt);
    },
    [user?.id],
  );

  const handleReadToggle = async () => {
    if (!bookmark || isReadLoading) return;

    const previousBookmark = bookmark;
    const previousIsRead = isRead;
    const previousReadAt = readAt;

    setIsRead(!isRead);
    setReadAt(isRead ? undefined : new Date().toISOString());
    setIsReadLoading(true);

    try {
      const updated = isRead
        ? await BookmarksAPI.markUnread(bookmark.id)
        : await BookmarksAPI.markRead(bookmark.id);
      applyReadState(updated);
    } catch (error) {
      console.error("Failed to update read state:", error);
      setBookmark(previousBookmark);
      setIsRead(previousIsRead);
      setReadAt(previousReadAt);
      Alert.alert(
        "Error",
        "Failed to update read status. Please try again later.",
        [{ text: "OK" }],
      );
    } finally {
      setIsReadLoading(false);
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

  if (isLoading)
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
  return (
    <Screen
      title={ownsBookmark ? "Your save" : "Article"}
      onBack={handleBack}
      actions={
        <>
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
      <ScrollView contentContainerStyle={layout.content}>
        {bookmark.collectionPath?.length && ownsBookmark ? (
          <Text style={[textStyle("meta"), { color: colors.fgSecondary }]}>
            {bookmark.collectionPath.map((part) => part.name).join(" / ")}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[textStyle("display"), { color: colors.fg }]}
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
        <View style={layout.row}>
          {ownsBookmark ? (
            <Button
              title={isRead ? "Mark unread" : "Mark as read"}
              icon={isRead ? "checkmark" : "bookmark-outline"}
              primary
              busy={isReadLoading}
              onPress={handleReadToggle}
            />
          ) : (
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
          )}
          <TopBarAction
            icon="open-outline"
            label="Open original"
            onPress={handleOpenUrl}
          />
        </View>
        {bookmark.processingStatus === "failed" ? (
          <Notice
            message="The brief could not be prepared. Your original link is still available."
            error
            action="Retry"
            onAction={async () => {
              try {
                await MobileAPI.retry(bookmark.id);
                await fetchBookmark(bookmark.id);
              } catch {
                Alert.alert("Could not retry", "Please try again.");
              }
            }}
          />
        ) : null}
        <View
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
              {bookmark.isPrivateLink ? "Your notes" : "Cosmic brief"}
            </Text>
            {bookmark.cosmicBriefSummary ? (
              <Text style={[textStyle("meta"), { color: colors.fgTertiary }]}>
                1 min read
              </Text>
            ) : null}
          </View>
          {processing && !bookmark.cosmicBriefSummary ? (
            <Notice message="Cosmic is reading it. You can keep browsing while the brief is prepared." />
          ) : null}
          {bookmark.cosmicBriefSummary ? (
            <Text selectable style={[textStyle("body"), { color: colors.fg }]}>
              {bookmark.cosmicBriefSummary}
            </Text>
          ) : bookmark.cosmicSummary ? (
            <Markdown style={markdownStyles}>{bookmark.cosmicSummary}</Markdown>
          ) : (
            <Text style={[textStyle("bodySm"), { color: colors.fgSecondary }]}>
              {bookmark.metadata?.openGraph?.description ||
                (bookmark.isPrivateLink
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
              ? `Your notes · ${siteName} was not fetched`
              : `Source: ${siteName}`}
          </Text>
        </View>
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
