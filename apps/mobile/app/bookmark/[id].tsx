import React, { useEffect, useState, useMemo } from 'react';
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
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

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

  // Markdown styles based on color scheme - must be called before any early returns
  const markdownStyles = useMemo(() => ({
    body: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700' as const,
      marginTop: 16,
      marginBottom: 8,
    },
    heading2: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '600' as const,
      marginTop: 14,
      marginBottom: 6,
    },
    heading3: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600' as const,
      marginTop: 12,
      marginBottom: 4,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
    },
    bullet_list: {
      marginBottom: 12,
    },
    ordered_list: {
      marginBottom: 12,
    },
    list_item: {
      marginBottom: 4,
    },
    bullet_list_icon: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
    },
    ordered_list_icon: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
    },
    strong: {
      color: colors.text,
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    link: {
      color: colors.tint,
      textDecorationLine: 'underline' as const,
    },
    blockquote: {
      backgroundColor: colors.backgroundSecondary,
      borderLeftColor: colors.tint,
      borderLeftWidth: 4,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 12,
    },
    code_inline: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'SpaceMono',
    },
    code_block: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontFamily: 'SpaceMono',
      marginVertical: 12,
    },
    fence: {
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      fontFamily: 'SpaceMono',
      marginVertical: 12,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 16,
    },
  }), [colors]);

  useEffect(() => {
    if (id) {
      fetchBookmark(id);
    }
  }, [id]);

  const fetchBookmark = async (bookmarkId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await BookmarksAPI.findById(bookmarkId);
      if (data) {
        setBookmark(data);
        setIsLiked(data.isLikedByCurrentUser ?? false);
        setLikeCount(data.likeCount ?? 0);
        setIsShared(data.isPublic ?? false);
      } else {
        setError('Bookmark not found');
      }
    } catch (err) {
      console.error('Error fetching bookmark:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookmark');
    } finally {
      setIsLoading(false);
    }
  };

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
    } catch (err) {
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
    } catch (err) {
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !bookmark) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Something went wrong
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleLikeToggle}
            style={styles.likeButton}
            disabled={isLikeLoading}
            testID="like-button"
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={22}
              color={isLiked ? '#ef4444' : colors.textSecondary}
            />
            {likeCount > 0 && (
              <Text style={[styles.likeCountText, { color: isLiked ? '#ef4444' : colors.textSecondary }]}>
                {likeCount}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={handleShareToggle}
            style={styles.headerButton}
            disabled={isShareLoading}
          >
            <Ionicons
              name={isShared ? "share" : "share-outline"}
              size={22}
              color={isShared ? colors.tint : colors.textSecondary}
            />
          </Pressable>
          <Pressable onPress={handleOpenUrl} style={styles.headerButton}>
            <Ionicons name="open-outline" size={22} color={colors.tint} />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
            <View style={[styles.sourceIcon, { backgroundColor: colors.textSecondary }]}>
              <Text style={styles.sourceIconText}>
                {siteName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.sourceName, { color: colors.textSecondary }]}>
              {siteName}
            </Text>
            {readingTime && (
              <>
                <Text style={[styles.dot, { color: colors.textSecondary }]}>·</Text>
                <Text style={[styles.readingTime, { color: colors.textSecondary }]}>
                  {readingTime} min read
                </Text>
              </>
            )}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {bookmark.title || 'Untitled'}
          </Text>

          {/* Date */}
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            Saved on {formatDate(bookmark.createdAt)}
          </Text>

          {/* Tags */}
          {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
            <View style={styles.tagsContainer}>
              {bookmark.cosmicTags.map((tag) => (
                <View
                  key={tag}
                  style={[styles.tag, { backgroundColor: colors.backgroundSecondary }]}
                >
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Description
              </Text>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
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
          style={styles.modalOverlay}
          onPress={() => setIsShareModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Share bookmark
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Anyone with this link can view this bookmark.
            </Text>

            <View style={[styles.linkContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <Text
                style={[styles.linkText, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {shareUrl}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleCopyLink}
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
              >
                <Ionicons
                  name={isCopied ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.modalButtonText}>
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleNativeShare}
                style={[styles.modalButtonOutline, { borderColor: colors.border }]}
              >
                <Ionicons name="share-outline" size={18} color={colors.tint} />
                <Text style={[styles.modalButtonOutlineText, { color: colors.tint }]}>
                  Share via...
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleUnshare}
              disabled={isShareLoading}
              style={styles.unshareButton}
            >
              <Text style={styles.unshareButtonText}>Stop sharing</Text>
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 0,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
  },
  likeCountText: {
    fontSize: 14,
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
    paddingHorizontal: 32,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
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
    padding: 16,
    gap: 16,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  dot: {
    fontSize: 14,
  },
  readingTime: {
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  date: {
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryContainer: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: -8,
  },
  linkContainer: {
    padding: 12,
    borderRadius: 8,
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalButtonOutlineText: {
    fontSize: 15,
    fontWeight: '600',
  },
  unshareButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  unshareButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
});
