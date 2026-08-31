import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { BookmarkCard } from '@/components/BookmarkCard';
import { TopBar } from '@/components/TopBar';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Bookmark } from '@/lib/api';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ThemeColors } from '@/constants/theme';

type ReadStatus = 'all' | 'unread' | 'read';

const filters: { label: string; value: ReadStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [readStatus, setReadStatus] = useState<ReadStatus>('all');
  const {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    toggleRead,
  } = useBookmarks({ mode: 'library', readStatus });

  const handleBookmarkPress = useCallback((bookmark: Bookmark) => {
    router.push(`/bookmark/${bookmark.id}`);
  }, [router]);

  const renderBookmark = useCallback(
    ({ item }: { item: Bookmark }) => (
      <BookmarkCard
        bookmark={item}
        onPress={handleBookmarkPress}
        onToggleRead={toggleRead}
        showReadStatus
      />
    ),
    [handleBookmarkPress, toggleRead]
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }, [isLoadingMore, colors.accent]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.bgInset }]}>
          <Ionicons name="library-outline" size={space.s6} color={colors.fgTertiary} />
        </View>
        <Text style={[textStyle('title3'), { color: colors.fg }]}>
          No bookmarks found
        </Text>
        <Text style={[textStyle('bodySm'), styles.centered, { color: colors.fgSecondary }]}>
          Your complete saved library will appear here.
        </Text>
      </View>
    );
  }, [isLoading, colors]);

  const header = (
    <>
      <TopBar title="Library" subtitle="All saved bookmarks" bordered={false} />
      <Filters colors={colors} readStatus={readStatus} onFilterChange={setReadStatus} />
    </>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        {header}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={space.s7} color={colors.danger} />
          <Text style={[textStyle('title3'), { color: colors.fg }]}>
            Something went wrong
          </Text>
          <Text style={[textStyle('bodySm'), styles.centered, { color: colors.fgSecondary }]}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {header}
      <FlatList
        data={bookmarks}
        renderItem={renderBookmark}
        keyExtractor={(item) => item.id}
        contentContainerStyle={bookmarks.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

/** Segmented filter: an inset trough, pill segments, accent on the active one. */
function Filters({
  colors,
  readStatus,
  onFilterChange,
}: {
  colors: ThemeColors;
  readStatus: ReadStatus;
  onFilterChange: (status: ReadStatus) => void;
}) {
  return (
    <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.segmented, { backgroundColor: colors.bgInset }]}>
        {filters.map((filter) => {
          const isActive = readStatus === filter.value;
          return (
            <Pressable
              key={filter.value}
              onPress={() => onFilterChange(filter.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.segment,
                isActive && { backgroundColor: colors.accent },
                !isActive && pressed && { backgroundColor: colors.bgSubtle },
              ]}
            >
              <Text
                style={[
                  textStyle('meta'),
                  styles.segmentText,
                  { color: isActive ? colors.accentFg : colors.fgSecondary },
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  filterRow: {
    paddingHorizontal: space.s4,
    paddingBottom: space.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: space.s1 / 2,
    alignSelf: 'flex-start',
  },
  segment: {
    borderRadius: radius.pill,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1 + 2,
  },
  segmentText: {
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
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.s6,
    gap: space.s2,
  },
  emptyIconContainer: {
    width: space.s8,
    height: space.s8,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.s2,
  },
  footerLoader: {
    paddingVertical: space.s5,
    alignItems: 'center',
  },
});
