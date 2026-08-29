import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { HybridSearchResultItem } from '@/lib/api';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

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
  const { colors } = useTheme();
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
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.bgSubtle : colors.bgPanel,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={() => router.push(`/bookmark/${bookmark.id}`)}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          {siteName ? (
            <Text style={[textStyle('meta'), { color: colors.fgTertiary }]} numberOfLines={1}>
              {siteName}
            </Text>
          ) : null}

          <Text style={[textStyle('title3'), { color: colors.fg }]} numberOfLines={2}>
            {bookmark.title || 'Untitled'}
          </Text>

          {snippet ? (
            <Text
              style={[textStyle('bodySm'), { color: colors.fgSecondary }]}
              numberOfLines={3}
            >
              {snippet}
            </Text>
          ) : null}

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
        </View>

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
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    gap: space.s3,
  },
  textContainer: {
    flex: 1,
    gap: space.s1,
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
  imageContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
