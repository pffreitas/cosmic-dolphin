"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchInput } from "@/components/search/search-input";
import { AIResponseCard } from "@/components/search/ai-response-card";
import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchClientAPI } from "@/lib/api/search-client";
import { Search } from "lucide-react";
import type { HybridSearchResultItem } from "@cosmic-dolphin/api-client";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState<HybridSearchResultItem[]>([]);
  const [aiResponse, setAiResponse] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  const executeSearch = React.useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      setResults([]);
      setAiResponse("");
      setIsSearching(true);
      setIsStreaming(true);
      setHasSearched(true);

      router.replace(`/search?q=${encodeURIComponent(searchQuery)}`, {
        scroll: false,
      });

      try {
        await SearchClientAPI.askWithStream(searchQuery, {
          onResults: (searchResults) => {
            setResults(searchResults);
            setIsSearching(false);
          },
          onChunk: (text) => {
            setAiResponse((prev) => prev + text);
          },
          onDone: () => {
            setIsStreaming(false);
            setIsSearching(false);
          },
          onError: (error) => {
            console.error("Search error:", error);
            setIsStreaming(false);
            setIsSearching(false);
          },
        });
      } catch (error) {
        console.error("Search failed:", error);
        setIsSearching(false);
        setIsStreaming(false);
      }
    },
    [router]
  );

  React.useEffect(() => {
    if (initialQuery && !hasSearched) {
      executeSearch(initialQuery);
    }
  }, [initialQuery, hasSearched, executeSearch]);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="space-y-6">
        <SearchInput
          defaultValue={query}
          isSearching={isSearching}
          onSearch={executeSearch}
        />

        <AIResponseCard
          response={aiResponse}
          isStreaming={isStreaming}
          isLoading={isSearching && !aiResponse}
        />

        {results.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </h2>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((result) => (
                <SearchResultCard key={result.bookmark.id} result={result} />
              ))}
            </div>
          </div>
        )}

        {hasSearched &&
          !isSearching &&
          !isStreaming &&
          results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No results found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Try different keywords or save more content to your library.
              </p>
            </div>
          )}

        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Search your bookmarks with AI
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              Ask a question and get an AI-powered answer based on your saved
              content, along with matching bookmarks.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
