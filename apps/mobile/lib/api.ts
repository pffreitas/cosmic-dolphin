import { supabase } from './supabase';

// API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const API_URL = `${API_BASE_URL}/api/v1`;

if (!API_BASE_URL) {
  console.warn('⚠️ API URL not set! Check your .env file.');
}

// Bookmark types matching the API response
export interface CollectionPathItem {
  id: string;
  name: string;
}

export interface OpenGraphMetadata {
  favicon?: string;
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

export interface BookmarkMetadata {
  openGraph?: OpenGraphMetadata;
  wordCount?: number;
  readingTime?: number;
}

export interface Bookmark {
  id: string;
  sourceUrl: string;
  collectionId?: string;
  collectionPath?: CollectionPathItem[];
  title?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  cosmicSummary?: string;
  cosmicBriefSummary?: string;
  cosmicTags?: string[];
  metadata?: BookmarkMetadata;
  userId: string;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  isLikedByCurrentUser?: boolean;
  isPublic?: boolean;
  shareSlug?: string;
}

export interface LikeResponse {
  likeCount: number;
  isLikedByCurrentUser: boolean;
}

export interface GetBookmarksResponse {
  bookmarks: Bookmark[];
}

export interface GetBookmarksParams {
  limit?: number;
  offset?: number;
  collection_id?: string;
}

export interface CreateBookmarkParams {
  source_url: string;
  collection_id?: string;
}

export interface CreateBookmarkResponse {
  bookmark: Bookmark;
  message: string;
}

export interface UrlPreviewMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  url?: string;
}

export interface PreviewUrlResponse {
  metadata: UrlPreviewMetadata;
}

export interface ShareBookmarkResponse {
  isPublic: boolean;
  shareUrl: string;
}

export interface HybridSearchResultItem {
  bookmark: Bookmark;
  score: number;
  matchedChunks: string[];
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || '';

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
}

export namespace BookmarksAPI {
  export async function list(params: GetBookmarksParams = {}): Promise<Bookmark[]> {
    const { limit = 20, offset = 0, collection_id } = params;
    
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());
      if (collection_id) {
        queryParams.append('collection_id', collection_id);
      }

      const url = `${API_URL}/bookmarks?${queryParams.toString()}`;
      console.log('Fetching bookmarks from:', url);
      const response = await fetch(
        `${API_URL}/bookmarks?${queryParams.toString()}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GetBookmarksResponse = await response.json();
      return data.bookmarks || [];
    } catch (error) {

      console.error('Error fetching bookmarks:', {error});
      throw error;
    }
  }

  export async function findById(id: string): Promise<Bookmark | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks/${id}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching bookmark by id:', error);
      throw error;
    }
  }

  export async function create(params: CreateBookmarkParams): Promise<CreateBookmarkResponse> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating bookmark:', error);
      throw error;
    }
  }

  export async function search(query: string, limit = 10, offset = 0): Promise<Bookmark[]> {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        query,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`${API_URL}/bookmarks/search?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GetBookmarksResponse = await response.json();
      return data.bookmarks || [];
    } catch (error) {
      console.error('Error searching bookmarks:', error);
      throw error;
    }
  }

  export async function preview(url: string): Promise<UrlPreviewMetadata> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data: PreviewUrlResponse = await response.json();
      return data.metadata;
    } catch (error) {
      console.error('Error fetching URL preview:', error);
      throw error;
    }
  }

  export async function like(id: string): Promise<LikeResponse> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks/${id}/like`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error liking bookmark:', error);
      throw error;
    }
  }

  export async function unlike(id: string): Promise<LikeResponse> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks/${id}/like`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unliking bookmark:', error);
      throw error;
    }
  }

  export async function share(id: string): Promise<ShareBookmarkResponse> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks/${id}/share`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sharing bookmark:', error);
      throw error;
    }
  }

  export async function unshare(id: string): Promise<ShareBookmarkResponse> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/bookmarks/${id}/share`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unsharing bookmark:', error);
      throw error;
    }
  }
}

export namespace SearchAPI {
  export interface SSECallbacks {
    onResults: (results: HybridSearchResultItem[]) => void;
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }

  export async function askWithStream(query: string, callbacks: SSECallbacks): Promise<void> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_URL}/search/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      callbacks.onError(`Search failed with status ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response stream available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);

            switch (currentEvent) {
              case 'results':
                callbacks.onResults(parsed.results);
                break;
              case 'chunk':
                callbacks.onChunk(parsed.text);
                break;
              case 'done':
                callbacks.onDone();
                break;
              case 'error':
                callbacks.onError(parsed.error);
                break;
            }
          } catch {
            // skip malformed data
          }
          currentEvent = '';
        }
      }
    }
  }
}
