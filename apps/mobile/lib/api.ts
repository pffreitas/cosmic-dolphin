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
}
