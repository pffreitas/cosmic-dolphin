import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Bookmark } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onPress?: (bookmark: Bookmark) => void;
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return '';
  }
}

export function BookmarkCard({ bookmark, onPress }: BookmarkCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

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

  // Display collection name if available, otherwise fall back to site name
  const displayName = collectionName || siteName;

  const handlePress = () => {
    onPress?.(bookmark);
  };

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        { 
          backgroundColor: colors.cardBackground,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.7 : 1,
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
              <View style={[styles.sourceIcon, { backgroundColor: colors.textSecondary }]}>
                <Text style={styles.sourceIconText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.sourceName, { color: colors.textSecondary }]} numberOfLines={1}>
                In <Text style={[styles.sourceNameBold, { color: colors.text }]}>{displayName}</Text>
              </Text>
            </View>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {bookmark.title || 'Untitled'}
          </Text>

          {/* Description/Summary */}
          {description && (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {description}
            </Text>
          )}

          {/* Tags */}
          {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
            <View style={styles.tagsContainer}>
              {bookmark.cosmicTags.slice(0, 3).map((tag) => (
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
        </View>

        {/* Right side: Image */}
        {image && (
          <View style={styles.imageContainer}>
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    gap: 16,
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  sourceName: {
    fontSize: 13,
    flex: 1,
  },
  sourceNameBold: {
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
