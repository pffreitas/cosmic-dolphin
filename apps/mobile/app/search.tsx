import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useSearch } from '@/hooks/useSearch';
import { useAISearch } from '@/hooks/useAISearch';
import { Bookmark } from '@/lib/api';
import { BookmarkCard } from '@/components/BookmarkCard';
import { AIResponseCard } from '@/components/AIResponseCard';
import { SearchResultCard } from '@/components/SearchResultCard';
import { TopBarAction } from '@/components/TopBar';
import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type SearchView = 'quick' | 'ai';

export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const [activeView, setActiveView] = React.useState<SearchView>('quick');

  const { query, setQuery, results: quickResults, isLoading: isQuickLoading } = useSearch();
  const aiSearch = useAISearch();

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleBookmarkPress = useCallback((bookmark: Bookmark) => {
    router.push(`/bookmark/${bookmark.id}`);
  }, [router]);

  const handleAISearchPress = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setActiveView('ai');
    aiSearch.executeSearch(trimmed);
  }, [query, aiSearch]);

  const handleBackToQuick = useCallback(() => {
    setActiveView('quick');
    aiSearch.reset();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [aiSearch]);

  const renderQuickItem = useCallback(
    ({ item }: { item: Bookmark | 'ai-search' }) => {
      if (item === 'ai-search') {
        return (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.aiSearchItem,
              {
                backgroundColor: pressed ? colors.bgSubtle : colors.aiBg,
                borderBottomColor: colors.aiBorder,
              },
            ]}
            onPress={handleAISearchPress}
          >
            <View style={[styles.aiSearchIcon, { backgroundColor: colors.aiChip }]}>
              <Ionicons name="sparkles" size={14} color={colors.ai} />
            </View>
            <Text
              style={[textStyle('body'), styles.aiSearchText, { color: colors.fg }]}
              numberOfLines={1}
            >
              AI Search: <Text style={{ fontWeight: '400', color: colors.fgSecondary }}>{query.trim()}</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.fgTertiary} />
          </Pressable>
        );
      }
      return <BookmarkCard bookmark={item} onPress={handleBookmarkPress} />;
    },
    [colors, handleAISearchPress, handleBookmarkPress, query]
  );

  const quickListData = React.useMemo(() => {
    const items: (Bookmark | 'ai-search')[] = [];
    if (query.trim()) {
      items.push('ai-search');
    }
    items.push(...quickResults);
    return items;
  }, [query, quickResults]);

  const keyExtractor = useCallback(
    (item: Bookmark | 'ai-search') => {
      if (item === 'ai-search') return '__ai-search__';
      return item.id;
    },
    []
  );

  const renderQuickEmpty = useCallback(() => {
    if (isQuickLoading) return null;
    if (!query.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgInset }]}>
            <Ionicons name="search-outline" size={space.s5} color={colors.fgTertiary} />
          </View>
          <Text style={[textStyle('title3'), { color: colors.fg }]}>
            Search your bookmarks
          </Text>
          <Text style={[textStyle('bodySm'), styles.emptySubtitle, { color: colors.fgSecondary }]}>
            Find saved articles, pages, and more.
          </Text>
        </View>
      );
    }
    return null;
  }, [isQuickLoading, query, colors]);

  // AI Search view
  if (activeView === 'ai') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
          <TopBarAction icon="arrow-back" label="Back to quick search" onPress={handleBackToQuick} />
          <View style={styles.aiQueryContainer}>
            <Ionicons name="sparkles" size={14} color={colors.ai} />
            <Text
              style={[textStyle('body'), styles.aiQueryText, { color: colors.fg }]}
              numberOfLines={1}
            >
              {query.trim()}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.aiScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AIResponseCard
            response={aiSearch.aiResponse}
            isStreaming={aiSearch.isStreaming}
            isLoading={aiSearch.isSearching && !aiSearch.aiResponse}
          />

          {aiSearch.results.length > 0 && (
            <View style={styles.aiResultsSection}>
              <Text style={[textStyle('label'), styles.aiResultsHeading, { color: colors.fgTertiary }]}>
                {aiSearch.results.length} result{aiSearch.results.length !== 1 ? 's' : ''} found
              </Text>
              {aiSearch.results.map((result) => (
                <SearchResultCard key={result.bookmark.id} result={result} />
              ))}
            </View>
          )}

          {aiSearch.hasSearched && !aiSearch.isSearching && !aiSearch.isStreaming && aiSearch.results.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgInset }]}>
                <Ionicons name="search-outline" size={space.s5} color={colors.fgTertiary} />
              </View>
              <Text style={[textStyle('title3'), { color: colors.fg }]}>
                No results found
              </Text>
              <Text style={[textStyle('bodySm'), styles.emptySubtitle, { color: colors.fgSecondary }]}>
                Try different keywords or save more content to your library.
              </Text>
            </View>
          )}

          {aiSearch.error && (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={space.s6} color={colors.danger} />
              <Text style={[textStyle('title3'), { color: colors.fg }]}>
                Something went wrong
              </Text>
              <Text style={[textStyle('bodySm'), styles.emptySubtitle, { color: colors.fgSecondary }]}>
                {aiSearch.error}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Quick Search view (default)
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
          <TopBarAction icon="arrow-back" label="Close search" onPress={handleClose} />
          <TextInput
            ref={inputRef}
            style={[textStyle('body'), styles.searchInput, { color: colors.fg }]}
            placeholder="Search bookmarks..."
            placeholderTextColor={colors.fgTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleAISearchPress}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TopBarAction icon="close-circle" label="Clear search" onPress={() => setQuery('')} />
          )}
        </View>

        {isQuickLoading && query.trim() ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : null}

        <FlatList
          data={quickListData}
          renderItem={renderQuickItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderQuickEmpty}
          contentContainerStyle={quickListData.length === 0 ? styles.emptyList : undefined}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s2,
    gap: space.s2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    paddingVertical: space.s2,
  },
  aiSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s4,
    paddingVertical: space.s3,
    gap: space.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aiSearchIcon: {
    width: space.s6,
    height: space.s6,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSearchText: {
    flex: 1,
    fontWeight: '600',
  },
  aiQueryContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  aiQueryText: {
    fontWeight: '600',
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: space.s3,
    alignItems: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.s6,
    paddingTop: space.s8,
    gap: space.s2,
  },
  emptyIconWrap: {
    width: space.s7 + space.s2,
    height: space.s7 + space.s2,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.s2,
  },
  emptySubtitle: {
    textAlign: 'center',
    maxWidth: 280,
  },
  aiScrollContent: {
    paddingBottom: space.s7,
  },
  aiResultsSection: {
    marginTop: space.s2,
  },
  aiResultsHeading: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
  },
});
