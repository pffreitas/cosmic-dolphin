import React, { useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BookmarkCard } from '@/components/BookmarkCard';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Bookmark } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useBookmarks();

  const handleBookmarkPress = useCallback((bookmark: Bookmark) => {
    // TODO: Navigate to bookmark detail screen
    console.log('Bookmark pressed:', bookmark.id);
  }, []);

  const renderBookmark = useCallback(
    ({ item }: { item: Bookmark }) => (
      <BookmarkCard bookmark={item} onPress={handleBookmarkPress} />
    ),
    [handleBookmarkPress]
  );

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
          <Ionicons name="bookmark-outline" size={32} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No bookmarks yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Start saving articles and pages to build your personal library.
        </Text>
      </View>
    );
  }, [isLoading, colors]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const keyExtractor = useCallback((item: Bookmark) => item.id, []);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        </View>
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
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
      </View>
      <FlatList
        data={bookmarks}
        renderItem={renderBookmark}
        keyExtractor={keyExtractor}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
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
    maxWidth: 280,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
