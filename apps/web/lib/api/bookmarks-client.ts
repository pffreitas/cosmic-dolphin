import {
  Configuration,
  BookmarksApi,
  CollectionsApi,
  Bookmark,
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
  Collection,
  CollectionSuggestion,
  CreateBookmarkRequest,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
  PreviewResponse,
  GetCollectionsResponse,
  SearchBookmarksResponse,
  LikeResponse,
  ShareBookmarkResponse,
  BookmarkProcessingPhase,
  ReprocessBookmarkResponse,
} from "@cosmic-dolphin/api-client";
import { SearchBookmarksQuery } from "@/lib/types/bookmark";
import { createClient } from "@/utils/supabase/client";
import { BookmarkProcessingTimelineResponse } from "@/lib/types/processing-timeline";

export class ProcessingTimelineFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProcessingTimelineFetchError";
  }
}

/**
 * A save refused by the daily limit.
 *
 * Carries the wait so the field can show it. The URL stays in the field — a
 * rate limit is a "not yet", not a "no", and throwing the user's paste away
 * would make it a "no".
 */
export class SaveRateLimitedError extends Error {
  constructor(
    message: string,
    /** Seconds, from the `Retry-After` header. */
    public readonly retryAfterSeconds: number | null
  ) {
    super(message);
    this.name = "SaveRateLimitedError";
  }
}

/**
 * Pull what we can out of whatever the generated runtime threw.
 *
 * `ResponseError` carries the raw `Response`; older call sites in this file
 * expect an axios-ish `error.response.data.error`. Handle both rather than
 * betting on one.
 */
async function readApiError(
  error: any
): Promise<{ status: number | null; message: string | null; response: Response | null }> {
  const response: Response | null =
    error?.response && typeof error.response.status === "number"
      ? (error.response as Response)
      : null;

  if (error?.response?.data?.error) {
    return {
      status: response?.status ?? null,
      message: error.response.data.error,
      response,
    };
  }

  if (response) {
    try {
      const body = await response.clone().json();
      if (body?.error) {
        return { status: response.status, message: body.error, response };
      }
    } catch {
      // Not JSON, or already consumed. Fall through to the thrown message.
    }
    return { status: response.status, message: null, response };
  }

  return { status: null, message: null, response: null };
}

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables.",
    );
  }
  return basePath;
}

/**
 * Exported so sibling clients (`reading-client.ts`) share one place that knows
 * the base path and how to get a token, rather than each growing its own copy.
 */
export async function getConfiguration(): Promise<Configuration> {
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
    read_status?: BookmarkReadStatus;
  }): Promise<Bookmark[]> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksList({
        collectionId: query?.collection_id,
        limit: query?.limit,
        offset: query?.offset,
        readStatus: query?.read_status,
      });
      return response.bookmarks || [];
    } catch (error) {
      console.error("Error fetching bookmarks", error);
      return [];
    }
  }

  export async function feed(query?: {
    limit?: number;
    offset?: number;
  }): Promise<Bookmark[]> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksFeed(query);
      return response.bookmarks || [];
    } catch (error) {
      console.error("Error fetching bookmark feed", error);
      return [];
    }
  }

  /**
   * Returns the whole response, not just the id: the caller needs
   * `alreadySaved` to decide between "Saved" and "Already in your library".
   */
  export async function create(
    bookmarkData: CreateBookmarkRequest
  ): Promise<CreateBookmarkResponse> {
    const bookmarksApi = await getApiInstance();

    try {
      return await bookmarksApi.bookmarksCreate({
        createBookmarkRequest: bookmarkData,
      });
    } catch (error: any) {
      const { status, message, response } = await readApiError(error);

      if (status === 429) {
        const header = response?.headers?.get("retry-after");
        const seconds = header ? Number.parseInt(header, 10) : NaN;
        throw new SaveRateLimitedError(
          message ?? "You have hit today's save limit.",
          Number.isFinite(seconds) ? seconds : null
        );
      }

      if (message) throw new Error(message);
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
      throw new ProcessingTimelineFetchError(
        body.error || "Failed to fetch processing timeline",
        response.status
      );
    }

    return response.json();
  }

  /**
   * Start a fresh run, optionally for one phase.
   *
   * Backs both **Retry** on a failed line and **Summarise now** on a bookmark
   * the daily processing budget left idle. The server appends to the existing
   * timeline, so the phases already on screen stay there.
   */
  export async function reprocess(
    id: string,
    phase?: BookmarkProcessingPhase
  ): Promise<ReprocessBookmarkResponse> {
    const bookmarksApi = await getApiInstance();

    return bookmarksApi.bookmarksReprocess({
      id,
      reprocessBookmarkRequest: phase ? { phase } : {},
    });
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

  export async function markRead(bookmarkId: string): Promise<Bookmark> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksMarkRead({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error marking bookmark read", error);
      if (error?.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  export async function markUnread(bookmarkId: string): Promise<Bookmark> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksMarkUnread({ id: bookmarkId });
    } catch (error: any) {
      console.error("Error marking bookmark unread", error);
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

  /**
   * The next page, by cursor.
   *
   * Not `offset`: the Library is written to while it is being paged — a save
   * lands, the pipeline files something — and an offset silently repeats rows
   * across the seam and steps over others.
   */
  export async function listPage(query: {
    collection_id?: string;
    scope?: BookmarkScope;
    read_status?: BookmarkReadStatus;
    sort?: BookmarkSort;
    limit?: number;
    cursor?: string;
  }): Promise<{ bookmarks: Bookmark[]; nextCursor?: string }> {
    const bookmarksApi = await getApiInstance();

    const response = await bookmarksApi.bookmarksList({
      collectionId: query.collection_id,
      scope: query.scope,
      readStatus: query.read_status,
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      bookmarks: response.bookmarks ?? [],
      nextCursor: response.nextCursor,
    };
  }

  /**
   * Move a bookmark, or send it back to Inbox with `null`.
   *
   * The server writes `filing_source = 'user'` in the same statement, so this
   * placement outlives every later run of the pipeline. `collectionId` is
   * optional in the generated types only because TypeSpec makes PATCH bodies
   * implicitly optional — it is required server-side, so `null` is passed
   * explicitly rather than omitted.
   */
  export async function refile(
    bookmarkId: string,
    collectionId: string | null
  ): Promise<Bookmark> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksRefile({
        id: bookmarkId,
        refileBookmarkRequest: { collectionId },
      });
    } catch (error: any) {
      const { message } = await readApiError(error);
      if (message) throw new Error(message);
      throw error;
    }
  }

  /** Title, tags, archived. Tags are the whole list, so an undo can restore it. */
  export async function update(
    bookmarkId: string,
    changes: {
      title?: string;
      isArchived?: boolean;
      tags?: string[];
      /** The reader's own summary — private links only. See the detail page. */
      cosmicSummary?: string;
    }
  ): Promise<Bookmark> {
    const bookmarksApi = await getApiInstance();
    try {
      return await bookmarksApi.bookmarksUpdate({
        id: bookmarkId,
        updateBookmarkRequest: changes,
      });
    } catch (error: any) {
      const { message } = await readApiError(error);
      if (message) throw new Error(message);
      throw error;
    }
  }

  export async function acceptCollectionSuggestion(
    suggestionId: string
  ): Promise<Collection> {
    const collectionsApi = new CollectionsApi(await getConfiguration());
    const response = await collectionsApi.collectionsAcceptSuggestion({
      id: suggestionId,
    });
    return response.collection;
  }

  export async function dismissCollectionSuggestion(
    suggestionId: string
  ): Promise<CollectionSuggestion> {
    const collectionsApi = new CollectionsApi(await getConfiguration());
    const response = await collectionsApi.collectionsDismissSuggestion({
      id: suggestionId,
    });
    return response.suggestion;
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
