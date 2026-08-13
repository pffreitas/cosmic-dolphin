import {
  Configuration,
  BookmarksApi,
  CollectionsApi,
  Bookmark,
  Collection,
  CreateBookmarkRequest,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
  PreviewResponse,
  GetCollectionsResponse,
  SearchBookmarksResponse,
  LikeResponse,
  ShareBookmarkResponse,
} from "@cosmic-dolphin/api-client";
import { SearchBookmarksQuery } from "@/lib/types/bookmark";
import { createClient } from "@/utils/supabase/client";
import { BookmarkProcessingTimelineResponse } from "@/lib/types/processing-timeline";

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables.",
    );
  }
  return basePath;
}

async function getConfiguration(): Promise<Configuration> {
  const accessToken = await getAccessToken();

  return new Configuration({
    basePath: getApiBasePath(),
    accessToken,
  });
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || "";
}

export namespace BookmarksClientAPI {
  async function getApiInstance(): Promise<BookmarksApi> {
    return new BookmarksApi(await getConfiguration());
  }

  export async function list(query?: {
    collection_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Bookmark[]> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksList(query);
      return response.bookmarks || [];
    } catch (error) {
      console.error("Error fetching bookmarks", error);
      return [];
    }
  }

  export async function create(
    bookmarkData: CreateBookmarkRequest
  ): Promise<string> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksCreate({
        createBookmarkRequest: bookmarkData,
      });
      return response.bookmark.id;
    } catch (error: any) {
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function findById(id: string): Promise<Bookmark | null> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksFindById({ id });
      return response;
    } catch (error) {
      console.error("Error fetching bookmark by id", error);
      return null;
    }
  }

  export async function getProcessingTimeline(
    id: string
  ): Promise<BookmarkProcessingTimelineResponse> {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `${getApiBasePath()}/bookmarks/${id}/processing-timeline`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to fetch processing timeline");
    }

    return response.json();
  }

  export async function search(
    params: SearchBookmarksQuery
  ): Promise<SearchBookmarksResponse> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksSearch({
        query: params.query,
        limit: params.limit,
        offset: params.offset,
      });
      return response;
    } catch (error) {
      console.error("Error searching bookmarks", error);
      return { bookmarks: [], total: 0 };
    }
  }

  export async function like(bookmarkId: string): Promise<LikeResponse> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksLike({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error liking bookmark", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function unlike(bookmarkId: string): Promise<LikeResponse> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksUnlike({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error unliking bookmark", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function share(
    bookmarkId: string
  ): Promise<ShareBookmarkResponse> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksShare({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error sharing bookmark", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function unshare(
    bookmarkId: string
  ): Promise<ShareBookmarkResponse> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksUnshare({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error unsharing bookmark", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function preview(url: string): Promise<PreviewResponse> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksPreview({
        previewRequest: { url },
      });
    } catch (error: any) {
      console.error("Error previewing URL", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function remove(bookmarkId: string): Promise<void> {
    const bookmarksApi = await getApiInstance();
    try {
      await bookmarksApi.bookmarksRemove({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error deleting bookmark", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function listCollections(): Promise<Collection[]> {
    const collectionsApi = new CollectionsApi(await getConfiguration());
    try {
      const response = await collectionsApi.collectionsList();
      return response.collections || [];
    } catch (error) {
      console.error("Error fetching collections", error);
      return [];
    }
  }
}
