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
import { useBookmarks } from '@/hooks/useBookmarks';
import { Bookmark } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type ReadStatus = 'all' | 'unread' | 'read';

const filters: { label: string; value: ReadStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
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
        <ActivityIndicator size="small" color={colors.tint} />
      </View>
    );
  }, [isLoadingMore, colors.tint]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="library-outline" size={32} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No bookmarks found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Your complete saved library will appear here.
        </Text>
      </View>
    );
  }, [isLoading, colors]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Header colors={colors} readStatus={readStatus} onFilterChange={setReadStatus} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Header colors={colors} readStatus={readStatus} onFilterChange={setReadStatus} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Something went wrong
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Header colors={colors} readStatus={readStatus} onFilterChange={setReadStatus} />
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
            tintColor={colors.tint}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function Header({
  colors,
  readStatus,
  onFilterChange,
}: {
  colors: typeof Colors.light;
  readStatus: ReadStatus;
  onFilterChange: (status: ReadStatus) => void;
}) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          All saved bookmarks
        </Text>
      </View>
      <View style={[styles.segmented, { backgroundColor: colors.backgroundSecondary }]}>
        {filters.map((filter) => {
          const isActive = readStatus === filter.value;
          return (
            <Pressable
              key={filter.value}
              onPress={() => onFilterChange(filter.value)}
              style={[
                styles.segment,
                isActive && { backgroundColor: colors.tint },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isActive ? '#fff' : colors.textSecondary },
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    alignSelf: 'flex-start',
  },
  segment: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentText: {
    fontSize: 13,
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
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
