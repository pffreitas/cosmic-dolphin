import {
  Configuration,
  BookmarksApi,
  Bookmark,
  BookmarkLibraryCounts,
  BookmarkReadStatus,
  BookmarkScope,
  BookmarkSort,
  Collection,
  CollectionsApi,
  CollectionSuggestion,
} from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/server";

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables.",
    );
  }
  return basePath;
}

export namespace BookmarksAPI {
  async function getApiInstance(): Promise<BookmarksApi> {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token || "";

    return new BookmarksApi(
      new Configuration({
        basePath: getApiBasePath(),
        accessToken,
      }),
    );
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

  /**
   * A page of the library, with the failure kept rather than swallowed.
   *
   * `list` above returns `[]` on an error, which is fine for a rail but wrong
   * for the Library: an empty list and a failed request look identical to the
   * user, and one of them needs a **Retry** rather than a "nothing here yet".
   */
  export async function listPage(query: {
    collection_id?: string;
    scope?: BookmarkScope;
    read_status?: BookmarkReadStatus;
    sort?: BookmarkSort;
    limit?: number;
    cursor?: string;
  }): Promise<
    | { ok: true; bookmarks: Bookmark[]; nextCursor?: string }
    | { ok: false; error: string }
  > {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksList({
        collectionId: query.collection_id,
        scope: query.scope,
        readStatus: query.read_status,
        sort: query.sort,
        limit: query.limit,
        cursor: query.cursor,
      });
      return {
        ok: true,
        bookmarks: response.bookmarks ?? [],
        nextCursor: response.nextCursor,
      };
    } catch (error) {
      console.error("Error fetching bookmarks page", error);
      return { ok: false, error: "We couldn't load your library." };
    }
  }

  /** The rail's mono counts. A failure here dims the counts, not the page. */
  export async function counts(): Promise<BookmarkLibraryCounts | null> {
    const bookmarksApi = await getApiInstance();

    try {
      return await bookmarksApi.bookmarksCounts();
    } catch (error) {
      console.error("Error fetching library counts", error);
      return null;
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

  export async function create(bookmarkData: any): Promise<any> {
    const bookmarksApi = await getApiInstance();

    try {
      const response = await bookmarksApi.bookmarksCreate({
        createBookmarkRequest: bookmarkData,
      });
      return response;
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
}

export namespace CollectionsAPI {
  async function getApiInstance(): Promise<CollectionsApi> {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return new CollectionsApi(
      new Configuration({
        basePath: getApiBasePath(),
        accessToken: session?.access_token || "",
      }),
    );
  }

  export async function list(): Promise<Collection[]> {
    try {
      const response = await (await getApiInstance()).collectionsList();
      return response.collections ?? [];
    } catch (error) {
      console.error("Error fetching collections", error);
      return [];
    }
  }

  /**
   * Only the proposals worth answering — the endpoint already filters to
   * pending ones with enough support, so whatever comes back is offerable and
   * the rail can render the first of them without deciding anything itself.
   */
  export async function listSuggestions(): Promise<CollectionSuggestion[]> {
    try {
      const response = await (
        await getApiInstance()
      ).collectionsListSuggestions();
      return response.suggestions ?? [];
    } catch (error) {
      console.error("Error fetching collection suggestions", error);
      return [];
    }
  }
}
