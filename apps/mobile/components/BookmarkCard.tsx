import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';

import { Bookmark } from '@/lib/api';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onPress?: (bookmark: Bookmark) => void;
  onToggleRead?: (bookmark: Bookmark) => void;
  showReadStatus?: boolean;
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return '';
  }
}

/**
 * A library row: separator, not a panel, and never a shadow. The title is the
 * one thing here the user is evaluating, so it is the one thing set in serif.
 */
export function BookmarkCard({
  bookmark,
  onPress,
  onToggleRead,
  showReadStatus = false,
}: BookmarkCardProps) {
  const { colors } = useTheme();

  // Get the immediate (last) collection from the path
  const immediateCollection = bookmark.collectionPath?.length
    ? bookmark.collectionPath[bookmark.collectionPath.length - 1]
    : null;
  const collectionName = immediateCollection?.name;

  const siteName =
    bookmark.metadata?.openGraph?.siteName ||
    extractDomain(bookmark.sourceUrl || '');
  const image = bookmark.metadata?.openGraph?.image;
  const description = bookmark.cosmicBriefSummary || bookmark.metadata?.openGraph?.description || '';
  const isRead = bookmark.isRead ?? Boolean(bookmark.readAt);

  // Display collection name if available, otherwise fall back to site name
  const displayName = collectionName || siteName;

  const handlePress = () => {
    onPress?.(bookmark);
  };

  const handleToggleRead = (event: any) => {
    event.stopPropagation?.();
    onToggleRead?.(bookmark);
  };

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.container,
        {
          // Row hover on the web becomes the pressed ground here.
          backgroundColor: pressed ? colors.bgSubtle : colors.bgPanel,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={handlePress}
    >
      <View style={styles.content}>
        {/* Left side: Text content */}
        <View style={styles.textContainer}>
          {/* Source/Collection indicator */}
          {displayName && (
            <View style={styles.sourceContainer}>
              <View style={[styles.sourceIcon, { backgroundColor: colors.bgInset }]}>
                <Text style={[textStyle('label'), styles.sourceIconText, { color: colors.fgSecondary }]}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text
                style={[textStyle('meta'), styles.sourceName, { color: colors.fgTertiary }]}
                numberOfLines={1}
              >
                In <Text style={[styles.sourceNameBold, { color: colors.fgSecondary }]}>{displayName}</Text>
              </Text>
            </View>
          )}

          {showReadStatus && isRead && (
            <View style={[styles.readBadge, { borderColor: colors.border }]}>
              <Text style={[textStyle('label'), { color: colors.fgTertiary }]}>
                Read
              </Text>
            </View>
          )}

          {/* Title — serif, because this is content being evaluated */}
          <Text style={[textStyle('title3'), { color: colors.fg }]} numberOfLines={2}>
            {bookmark.title || 'Untitled'}
          </Text>

          {/* Description/Summary */}
          {description && (
            <Text
              style={[textStyle('bodySm'), { color: colors.fgSecondary }]}
              numberOfLines={2}
            >
              {description}
            </Text>
          )}

          {/* Tags */}
          {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
            <View style={styles.tagsContainer}>
              {bookmark.cosmicTags.slice(0, 3).map((tag) => (
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

          {onToggleRead && (
            <Pressable
              onPress={handleToggleRead}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.readButton,
                {
                  borderColor: colors.borderStrong,
                  backgroundColor: pressed ? colors.bgInset : 'transparent',
                },
              ]}
              hitSlop={space.s2}
            >
              <Text style={[textStyle('meta'), styles.readButtonText, { color: colors.fgSecondary }]}>
                {isRead ? 'Mark unread' : 'Mark read'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Right side: Image */}
        {image && (
          <View style={[styles.imageContainer, { backgroundColor: colors.bgInset }]}>
            <Image
              source={{ uri: image }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: space.s4,
    paddingHorizontal: space.s4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  readBadge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xs,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1 / 2,
  },
  content: {
    flexDirection: 'row',
    gap: space.s4,
  },
  textContainer: {
    flex: 1,
    gap: space.s2,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  sourceIcon: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceIconText: {
    letterSpacing: 0,
  },
  sourceName: {
    flex: 1,
  },
  sourceNameBold: {
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s1 + 2,
    marginTop: space.s1,
  },
  tag: {
    paddingHorizontal: space.s2,
    paddingVertical: space.s1 / 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  readButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1 + 2,
    marginTop: space.s1 / 2,
  },
  readButtonText: {
    fontWeight: '600',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
