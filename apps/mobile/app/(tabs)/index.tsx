import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import { BookmarkCard } from '@/components/BookmarkCard';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Bookmark } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const HEADER_HEIGHT = 56;
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function HomeScreen() {
  const router = useRouter();
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

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerBlurStyle = useAnimatedStyle(() => {
    const intensity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: intensity,
    };
  });

  const headerBorderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      opacity,
    };
  });

  const handleBookmarkPress = useCallback((bookmark: Bookmark) => {
    router.push(`/bookmark/${bookmark.id}`);
  }, [router]);

  const handleSearchPress = useCallback(() => {
    router.push('/search');
  }, [router]);

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

  const headerContent = (
    <View style={styles.headerInner}>
      <View style={styles.brandContainer}>
        <Text style={styles.brandEmoji}>🐬</Text>
        <Text style={[styles.brandTitle, { color: colors.text }]}>Cosmic Dolphin</Text>
      </View>
      <Pressable
        onPress={handleSearchPress}
        style={({ pressed }) => [
          styles.searchButton,
          { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
        ]}
        hitSlop={8}
      >
        <Ionicons name="search-outline" size={20} color={colors.text} />
      </Pressable>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          {headerContent}
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
          {headerContent}
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
      <View style={styles.headerWrapper}>
        <AnimatedBlurView
          intensity={80}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, headerBlurStyle]}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.7 }]} />
        {headerContent}
        <Animated.View style={[styles.headerBorder, headerBorderStyle]} />
      </View>

      <Animated.FlatList
        data={bookmarks}
        renderItem={renderBookmark}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          { paddingTop: HEADER_HEIGHT },
          bookmarks.length === 0 ? styles.emptyList : undefined,
        ]}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={colors.tint}
            progressViewOffset={HEADER_HEIGHT}
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
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    zIndex: 10,
    overflow: 'hidden',
  },
  header: {
    height: HEADER_HEIGHT,
  },
  headerInner: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandEmoji: {
    fontSize: 24,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
