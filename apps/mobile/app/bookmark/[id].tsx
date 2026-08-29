import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
  Linking,
  Alert,
  Modal,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

import { Bookmark, BookmarksAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  cacheBookmarksInBackground,
  getCachedBookmark,
  removeCachedBookmark,
} from '@/lib/bookmark-cache';
import { isAuthError } from '@/lib/api-errors';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return '';
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function BookmarkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [readAt, setReadAt] = useState<string | undefined>(undefined);
  const [isReadLoading, setIsReadLoading] = useState(false);
  const [suppressAutoRead, setSuppressAutoRead] = useState(false);
  const autoReadTriggeredRef = useRef(false);

  // Markdown styles based on color scheme - must be called before any early returns
  const markdownStyles = useMemo(() => ({
    body: {
      ...textStyle('body'),
      color: colors.fgSecondary,
    },
    heading1: {
      ...textStyle('title2'),
      color: colors.fg,
      marginTop: space.s4,
      marginBottom: space.s2,
    },
    heading2: {
      ...textStyle('title3'),
      color: colors.fg,
      marginTop: space.s3,
      marginBottom: space.s2,
    },
    heading3: {
      ...textStyle('title3'),
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
      ...textStyle('body'),
      color: colors.fgSecondary,
    },
    ordered_list_icon: {
      ...textStyle('body'),
      color: colors.fgSecondary,
    },
    strong: {
      color: colors.fg,
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    link: {
      color: colors.accent,
      textDecorationLine: 'underline' as const,
    },
    blockquote: {
      ...textStyle('quote'),
      backgroundColor: colors.hlBg,
      borderLeftColor: colors.hlLine,
      borderLeftWidth: space.s1,
      paddingLeft: space.s3,
      paddingVertical: space.s2,
      marginVertical: space.s3,
    },
    code_inline: {
      ...textStyle('bodySm'),
      backgroundColor: colors.bgInset,
      color: colors.fg,
      paddingHorizontal: space.s2,
      paddingVertical: space.s1 / 2,
      borderRadius: radius.xs,
    },
    code_block: {
      ...textStyle('bodySm'),
      backgroundColor: colors.bgInset,
      color: colors.fg,
      padding: space.s3,
      borderRadius: radius.md,
      marginVertical: space.s3,
    },
    fence: {
      ...textStyle('bodySm'),
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
  }), [colors]);

  const applyBookmark = useCallback((data: Bookmark) => {
    setBookmark(data);
    setIsLiked(data.isLikedByCurrentUser ?? false);
    setLikeCount(data.likeCount ?? 0);
    setIsShared(data.isPublic ?? false);
    setIsRead(data.isRead ?? Boolean(data.readAt));
    setReadAt(data.readAt);
    setSuppressAutoRead(false);
    autoReadTriggeredRef.current = false;
  }, []);

  const fetchBookmark = useCallback(async (bookmarkId: string) => {
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
        setError('Bookmark not found');
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

      console.error('Error fetching bookmark:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookmark');
    } finally {
      setIsLoading(false);
    }
  }, [applyBookmark, user?.id]);

  useEffect(() => {
    if (id) {
      fetchBookmark(id);
    }
  }, [fetchBookmark, id]);

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
      console.error('Failed to toggle like:', error);
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
      Alert.alert(
        "Error",
        "Failed to update like status. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLikeLoading(false);
    }
  };

  const applyReadState = useCallback((updated: Bookmark) => {
    setBookmark(updated);
    setIsRead(updated.isRead ?? Boolean(updated.readAt));
    setReadAt(updated.readAt);
  }, []);

  const markReadAutomatically = useCallback(async () => {
    if (!bookmark || isRead || suppressAutoRead || autoReadTriggeredRef.current) {
      return;
    }

    autoReadTriggeredRef.current = true;
    try {
      const updated = await BookmarksAPI.markRead(bookmark.id);
      applyReadState(updated);
    } catch (error) {
      autoReadTriggeredRef.current = false;
      console.error('Failed to automatically mark bookmark read:', error);
    }
  }, [applyReadState, bookmark, isRead, suppressAutoRead]);

  useEffect(() => {
    if (!bookmark || isRead || suppressAutoRead) return;

    const timeoutId = setTimeout(() => {
      markReadAutomatically();
    }, 20000);

    return () => clearTimeout(timeoutId);
  }, [bookmark, isRead, markReadAutomatically, suppressAutoRead]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (!contentSize?.height || contentSize.height <= layoutMeasurement.height) {
      return;
    }

    const scrollRatio =
      (contentOffset.y + layoutMeasurement.height) / contentSize.height;

    if (scrollRatio >= 0.7) {
      markReadAutomatically();
    }
  }, [markReadAutomatically]);

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
      setSuppressAutoRead(isRead);
    } catch (error) {
      console.error('Failed to update read state:', error);
      setBookmark(previousBookmark);
      setIsRead(previousIsRead);
      setReadAt(previousReadAt);
      Alert.alert(
        "Error",
        "Failed to update read status. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setIsReadLoading(false);
    }
  };

  const handleShareToggle = async () => {
    if (!bookmark || isShareLoading) return;

    if (isShared) {
      setIsShareModalVisible(true);
      return;
    }

    setIsShareLoading(true);
    try {
      const result = await BookmarksAPI.share(bookmark.id);
      setIsShared(result.isPublic);
      setShareUrl(result.shareUrl);
      setIsShareModalVisible(true);
    } catch {
      Alert.alert('Error', 'Failed to share bookmark. Please try again.');
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
      setShareUrl('');
      setIsShareModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to unshare bookmark. Please try again.');
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
          >
            <Ionicons name="chevron-back" size={28} color={colors.fg} />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !bookmark) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
          >
            <Ionicons name="chevron-back" size={28} color={colors.fg} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={space.s7} color={colors.danger} />
          <Text style={[textStyle('title3'), { color: colors.fg }]}>
            Something went wrong
          </Text>
          <Text style={[textStyle('bodySm'), styles.errorSubtitle, { color: colors.fgSecondary }]}>
            {error || 'Bookmark not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const siteName = bookmark.metadata?.openGraph?.siteName || extractDomain(bookmark.sourceUrl || '');
  const image = bookmark.metadata?.openGraph?.image;
  const cosmicSummary = bookmark.cosmicSummary;
  const fallbackDescription = bookmark.metadata?.openGraph?.description;
  const readingTime = bookmark.metadata?.readingTime;
  const isPrivateProcessing =
    bookmark.isPrivateLink && bookmark.processingStatus === 'processing';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        ]}
      >
        <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
          >
          <Ionicons name="chevron-back" size={28} color={colors.fg} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleLikeToggle}
            accessibilityRole="button"
            accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
            accessibilityState={{ selected: isLiked }}
            style={({ pressed }) => [
              styles.likeButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
            disabled={isLikeLoading}
            testID="like-button"
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={22}
              color={isLiked ? colors.like : colors.fgSecondary}
            />
            {likeCount > 0 && (
              <Text
                style={[
                  textStyle('meta'),
                  styles.likeCountText,
                  { color: isLiked ? colors.like : colors.fgSecondary },
                ]}
              >
                {likeCount}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={handleReadToggle}
            accessibilityRole="button"
            accessibilityLabel={isRead ? 'Mark unread' : 'Mark read'}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
            disabled={isReadLoading}
          >
            <Ionicons
              name={isRead ? "return-up-back-outline" : "checkmark-done-outline"}
              size={22}
              color={isRead ? colors.accent : colors.fgSecondary}
            />
          </Pressable>
          <Pressable
            onPress={handleShareToggle}
            accessibilityRole="button"
            accessibilityLabel={isShared ? 'Stop sharing' : 'Share'}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
            disabled={isShareLoading}
          >
            <Ionicons
              name={isShared ? "share" : "share-outline"}
              size={22}
              color={isShared ? colors.accent : colors.fgSecondary}
            />
          </Pressable>
          <Pressable
            onPress={handleOpenUrl}
            accessibilityRole="button"
            accessibilityLabel="Open original"
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: pressed ? colors.bgInset : 'transparent' },
            ]}
          >
            <Ionicons name="open-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Hero Image */}
        {image && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: image }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Source */}
          <View style={styles.sourceContainer}>
            <View style={[styles.sourceIcon, { backgroundColor: colors.bgInset }]}>
              <Text style={[textStyle('label'), styles.sourceIconText, { color: colors.fgSecondary }]}>
                {siteName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[textStyle('meta'), { color: colors.fgSecondary }]}>
              {siteName}
            </Text>
            {readingTime && (
              <>
                <Text style={[textStyle('meta'), { color: colors.fgTertiary }]}>·</Text>
                <Text style={[textStyle('meta'), { color: colors.fgTertiary }]}>
                  {readingTime} min read
                </Text>
              </>
            )}
          </View>

          {/* Title */}
          <Text style={[textStyle('title1'), { color: colors.fg }]}>
            {bookmark.title || 'Untitled'}
          </Text>

          {/* Date */}
          <Text style={[textStyle('meta'), { color: colors.fgTertiary }]}>
            Saved on {formatDate(bookmark.createdAt)}
          </Text>

          {isRead && (
            <View style={[styles.readBadge, { borderColor: colors.border }]}>
              <Text style={[textStyle('label'), { color: colors.fgTertiary }]}>
                Read
              </Text>
            </View>
          )}

          {/* Tags */}
          {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
            <View style={styles.tagsContainer}>
              {bookmark.cosmicTags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
                  ]}
                >
                  <Text style={[textStyle('meta'), { color: colors.accent }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {isPrivateProcessing && (
            <View
              accessibilityLiveRegion="polite"
              style={[
                styles.processingContainer,
                { backgroundColor: colors.aiBg, borderColor: colors.aiBorder },
              ]}
            >
              <ActivityIndicator size="small" color={colors.ai} />
              <Text style={[textStyle('bodySm'), styles.processingText, { color: colors.ai }]}>
                Organizing for quick access...
              </Text>
            </View>
          )}

          {/* Summary */}
          {cosmicSummary && (
            <View style={styles.summaryContainer}>
              <Markdown style={markdownStyles} onLinkPress={(url) => {
                Linking.openURL(url);
                return false;
              }}>
                {cosmicSummary}
              </Markdown>
            </View>
          )}

          {/* Fallback description (non-markdown) */}
          {!cosmicSummary && fallbackDescription && (
            <View style={styles.summaryContainer}>
              <Text style={[textStyle('title3'), { color: colors.fg }]}>
                Description
              </Text>
              <Text style={[textStyle('body'), { color: colors.fgSecondary }]}>
                {fallbackDescription}
              </Text>
            </View>
          )}

        
        </View>
      </ScrollView>

      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setIsShareModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[textStyle('title2'), { color: colors.fg }]}>
              Share bookmark
            </Text>
            <Text style={[textStyle('bodySm'), styles.modalSubtitle, { color: colors.fgSecondary }]}>
              Anyone with this link can view this bookmark.
            </Text>

            <View style={[styles.linkContainer, { backgroundColor: colors.bgInset }]}>
              <Text
                style={[textStyle('meta'), styles.linkText, { color: colors.fg }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {shareUrl}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleCopyLink}
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
              >
                <Ionicons
                  name={isCopied ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color={colors.accentFg}
                />
                <Text style={[textStyle('bodySm'), styles.modalButtonText, { color: colors.accentFg }]}>
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleNativeShare}
                style={[styles.modalButtonOutline, { borderColor: colors.border }]}
              >
                <Ionicons name="share-outline" size={18} color={colors.accent} />
                <Text style={[textStyle('bodySm'), styles.modalButtonOutlineText, { color: colors.accent }]}>
                  Share via...
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleUnshare}
              disabled={isShareLoading}
              style={styles.unshareButton}
            >
              <Text style={[textStyle('bodySm'), styles.unshareButtonText, { color: colors.danger }]}>
                Stop sharing
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s2,
    paddingVertical: space.s1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: 44,
    paddingHorizontal: space.s2,
    borderRadius: radius.sm,
    gap: space.s1,
  },
  likeCountText: {
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.s6,
    gap: space.s2,
  },
  errorSubtitle: {
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: space.s6,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: space.s4,
    gap: space.s4,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  sourceIcon: {
    width: space.s5,
    height: space.s5,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceIconText: {
    letterSpacing: 0,
  },
  readBadge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xs,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1 / 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
  },
  tag: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.s1,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3,
  },
  processingText: {
    fontWeight: '600',
  },
  summaryContainer: {
    marginTop: space.s2,
    gap: space.s2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.s5,
  },
  modalContent: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.s5,
    gap: space.s4,
  },
  modalSubtitle: {
    marginTop: -space.s2,
  },
  linkContainer: {
    padding: space.s3,
    borderRadius: radius.sm,
  },
  linkText: {
    fontFamily: 'SpaceMono',
  },
  modalActions: {
    flexDirection: 'row',
    gap: space.s3,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: space.s2,
    paddingVertical: space.s3,
    borderRadius: radius.pill,
  },
  modalButtonText: {
    fontWeight: '600',
  },
  modalButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: space.s2,
    paddingVertical: space.s3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalButtonOutlineText: {
    fontWeight: '600',
  },
  unshareButton: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: space.s2,
    paddingHorizontal: space.s4,
  },
  unshareButtonText: {
    fontWeight: '600',
  },
});
