import { useState, useEffect, useRef } from 'react';
import { BookmarksAPI, Bookmark } from '@/lib/api';
import { useDebounce } from './useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import { cacheBookmarksInBackground } from '@/lib/bookmark-cache';

interface UseSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: Bookmark[];
  isLoading: boolean;
  error: string | null;
}

export function useSearch(): UseSearchResult {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    BookmarksAPI.search(trimmed, 10)
      .then((bookmarks) => {
        if (requestId === requestIdRef.current) {
          setResults(bookmarks);
          cacheBookmarksInBackground(user?.id, bookmarks);
        }
      })
      .catch((err) => {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      });
  }, [debouncedQuery, user?.id]);

  return { query, setQuery, results, isLoading, error };
}
