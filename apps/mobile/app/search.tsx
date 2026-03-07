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
import { Bookmark, HybridSearchResultItem } from '@/lib/api';
import { BookmarkCard } from '@/components/BookmarkCard';
import { AIResponseCard } from '@/components/AIResponseCard';
import { SearchResultCard } from '@/components/SearchResultCard';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type SearchView = 'quick' | 'ai';

export default function SearchScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
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
    ({ item, index }: { item: Bookmark | 'ai-search'; index: number }) => {
      if (item === 'ai-search') {
        return (
          <Pressable
            style={({ pressed }) => [
              styles.aiSearchItem,
              {
                backgroundColor: pressed ? colors.backgroundSecondary : colors.cardBackground,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={handleAISearchPress}
          >
            <View style={[styles.aiSearchIcon, { backgroundColor: colors.tint }]}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <Text style={[styles.aiSearchText, { color: colors.text }]} numberOfLines={1}>
              AI Search: <Text style={{ fontWeight: '400', color: colors.textSecondary }}>"{query.trim()}"</Text>
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
    (item: Bookmark | 'ai-search', index: number) => {
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
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="search-outline" size={28} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Search your bookmarks
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleBackToQuick} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.aiQueryContainer}>
            <Ionicons name="sparkles" size={14} color={colors.tint} />
            <Text style={[styles.aiQueryText, { color: colors.text }]} numberOfLines={1}>
              {query.trim()}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.aiScrollView}
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
              <Text style={[styles.aiResultsHeading, { color: colors.textSecondary }]}>
                {aiSearch.results.length} result{aiSearch.results.length !== 1 ? 's' : ''} found
              </Text>
              {aiSearch.results.map((result) => (
                <SearchResultCard key={result.bookmark.id} result={result} />
              ))}
            </View>
          )}

          {aiSearch.hasSearched && !aiSearch.isSearching && !aiSearch.isStreaming && aiSearch.results.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="search-outline" size={28} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No results found
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Try different keywords or save more content to your library.
              </Text>
            </View>
          )}

          {aiSearch.error && (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Something went wrong
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search bookmarks..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleAISearchPress}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {isQuickLoading && query.trim() ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.tint} />
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 6,
  },
  aiSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  aiSearchIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSearchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  aiQueryContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiQueryText: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  aiScrollView: {
    flex: 1,
  },
  aiScrollContent: {
    paddingBottom: 40,
  },
  aiResultsSection: {
    marginTop: 8,
  },
  aiResultsHeading: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
