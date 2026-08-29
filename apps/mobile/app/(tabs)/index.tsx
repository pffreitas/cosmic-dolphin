import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { BookmarkCard } from '@/components/BookmarkCard';
import { TopBar, TopBarAction } from '@/components/TopBar';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Bookmark } from '@/lib/api';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    bookmarks,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    toggleRead,
  } = useBookmarks({ mode: 'feed' });

  const handleBookmarkPress = useCallback((bookmark: Bookmark) => {
    router.push(`/bookmark/${bookmark.id}`);
  }, [router]);

  const handleSearchPress = useCallback(() => {
    router.push('/search');
  }, [router]);

  const renderBookmark = useCallback(
    ({ item }: { item: Bookmark }) => (
      <BookmarkCard
        bookmark={item}
        onPress={handleBookmarkPress}
        onToggleRead={toggleRead}
      />
    ),
    [handleBookmarkPress, toggleRead]
  );

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
          <Ionicons name="bookmark-outline" size={space.s6} color={colors.fgTertiary} />
        </View>
        <Text style={[textStyle('title3'), { color: colors.fg }]}>
          No bookmarks yet
        </Text>
        <Text style={[textStyle('bodySm'), styles.centered, { color: colors.fgSecondary }]}>
          Unread bookmarks appear here. Read bookmarks stay in your library.
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

  const header = (
    <TopBar
      title="Home"
      actions={
        <TopBarAction icon="search-outline" label="Search" onPress={handleSearchPress} />
      }
    />
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
            tintColor={colors.accent}
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
  centered: {
    textAlign: 'center',
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
