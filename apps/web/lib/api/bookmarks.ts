import { Configuration, BookmarksApi, Bookmark } from "@cosmic-dolphin/api-client";
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
