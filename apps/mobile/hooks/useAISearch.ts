import { useState, useCallback, useRef } from 'react';
import { SearchAPI, HybridSearchResultItem } from '@/lib/api';

interface UseAISearchResult {
  results: HybridSearchResultItem[];
  aiResponse: string;
  isSearching: boolean;
  isStreaming: boolean;
  hasSearched: boolean;
  error: string | null;
  executeSearch: (query: string) => void;
  reset: () => void;
}

export function useAISearch(): UseAISearchResult {
  const [results, setResults] = useState<HybridSearchResultItem[]>([]);
  const [aiResponse, setAiResponse] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setResults([]);
    setAiResponse('');
    setIsSearching(false);
    setIsStreaming(false);
    setHasSearched(false);
    setError(null);
  }, []);

  const executeSearch = useCallback((query: string) => {
    abortRef.current = false;
    setResults([]);
    setAiResponse('');
    setIsSearching(true);
    setIsStreaming(true);
    setHasSearched(true);
    setError(null);

    SearchAPI.askWithStream(query, {
      onResults: (searchResults) => {
        if (!abortRef.current) {
          setResults(searchResults);
          setIsSearching(false);
        }
      },
      onChunk: (text) => {
        if (!abortRef.current) {
          setAiResponse((prev) => prev + text);
        }
      },
      onDone: () => {
        if (!abortRef.current) {
          setIsStreaming(false);
          setIsSearching(false);
        }
      },
      onError: (errorMsg) => {
        if (!abortRef.current) {
          setError(errorMsg);
          setIsStreaming(false);
          setIsSearching(false);
        }
      },
    }).catch((err) => {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'AI search failed');
        setIsSearching(false);
        setIsStreaming(false);
      }
    });
  }, []);

  return {
    results,
    aiResponse,
    isSearching,
    isStreaming,
    hasSearched,
    error,
    executeSearch,
    reset,
  };
}
