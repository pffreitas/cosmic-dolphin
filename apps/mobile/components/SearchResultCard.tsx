import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { HybridSearchResultItem } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface SearchResultCardProps {
  result: HybridSearchResultItem;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { bookmark, matchedChunks } = result;

  const siteName =
    bookmark.metadata?.openGraph?.siteName ||
    extractDomain(bookmark.sourceUrl || '');

  const snippet =
    matchedChunks && matchedChunks.length > 0
      ? matchedChunks[0].slice(0, 200) + (matchedChunks[0].length > 200 ? '...' : '')
      : bookmark.cosmicBriefSummary || bookmark.metadata?.openGraph?.description || '';

  const image = bookmark.metadata?.openGraph?.image;

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
      onPress={() => router.push(`/bookmark/${bookmark.id}`)}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          {siteName ? (
            <Text style={[styles.siteName, { color: colors.textSecondary }]} numberOfLines={1}>
              {siteName}
            </Text>
          ) : null}

          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {bookmark.title || 'Untitled'}
          </Text>

          {snippet ? (
            <Text style={[styles.snippet, { color: colors.textSecondary }]} numberOfLines={3}>
              {snippet}
            </Text>
          ) : null}

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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    gap: 14,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  siteName: {
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
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
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
