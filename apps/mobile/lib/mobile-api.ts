/** Native adapters around the generated contract. Never manufacture feed content. */
import {
  BookmarksApi,
  CollectionsApi,
  Configuration,
  DigestsApi,
  ExploreApi,
  ReadingApi,
  SocialApi,
  CommentsApi,
  type Bookmark as ContractBookmark,
  type BookmarkScope,
  type BookmarkSort,
  type FeedScope,
  type Collection,
  type FeedResponse,
  type ExploreResponse,
} from "@cosmic-dolphin/api-client";
import { supabase } from "./supabase";
import { cacheBookmarksInBackground } from "./bookmark-cache";
import type { Bookmark } from "./api";

export async function configuration() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return new Configuration({
    basePath: `${(process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "")}/api/v1`,
    accessToken: session?.access_token || "",
  });
}
export function nativeBookmark(bookmark: ContractBookmark): Bookmark {
  return {
    ...bookmark,
    createdAt: bookmark.createdAt.toISOString(),
    updatedAt: bookmark.updatedAt.toISOString(),
    readAt: bookmark.readAt?.toISOString(),
  };
}
function rememberBookmark(bookmark: ContractBookmark) {
  const result = nativeBookmark(bookmark);
  cacheBookmarksInBackground(result.userId, [result]);
  return result;
}
export const MobileAPI = {
  async comments(id: string) {
    return new CommentsApi(await configuration()).bookmarkCommentsList({ id });
  },
  async comment(id: string, body: string) {
    return new CommentsApi(await configuration()).bookmarkCommentsCreate({
      id,
      createCommentRequest: { body },
    });
  },
  async profile() {
    return new SocialApi(await configuration()).profilesGet();
  },
  async updateProfile(name: string, handle?: string) {
    return new SocialApi(await configuration()).profilesUpdate({
      updateProfileRequest: { name, ...(handle ? { handle } : {}) },
    });
  },
  async publicSaves(handle: string, cursor?: string) {
    return new SocialApi(await configuration()).usersGetSaves({
      handle,
      cursor,
    });
  },
  async feed(scope: FeedScope, cursor?: string): Promise<FeedResponse> {
    return new BookmarksApi(await configuration()).bookmarksFeed({
      scope,
      cursor,
      limit: 30,
    });
  },
  async explore(cursor?: string): Promise<ExploreResponse> {
    return new ExploreApi(await configuration()).exploreList({
      cursor,
      limit: 30,
    });
  },
  async digest(id: string) {
    return new DigestsApi(await configuration()).digestsGet({ id });
  },
  async resume() {
    return new ReadingApi(await configuration()).readingContinueReading({
      limit: 3,
    });
  },
  async collections() {
    return (await new CollectionsApi(await configuration()).collectionsList())
      .collections;
  },
  async createCollection(name: string, parentId?: string): Promise<Collection> {
    return new CollectionsApi(await configuration()).collectionsCreate({
      createCollectionRequest: { name, parentId },
    });
  },
  async counts() {
    return new BookmarksApi(await configuration()).bookmarksCounts();
  },
  async library(query: {
    collectionId?: string;
    scope?: BookmarkScope;
    sort?: BookmarkSort;
    readStatus?: "all" | "read" | "unread";
    offset?: number;
    limit?: number;
  }) {
    return (
      await new BookmarksApi(await configuration()).bookmarksList(query)
    ).bookmarks.map(nativeBookmark);
  },
  async saveRecommendation(id: string) {
    return rememberBookmark(
      (await new BookmarksApi(await configuration()).bookmarksReshare({ id }))
        .bookmark,
    );
  },
  async archive(id: string, isArchived: boolean) {
    return rememberBookmark(
      await new BookmarksApi(await configuration()).bookmarksUpdate({
        id,
        updateBookmarkRequest: { isArchived },
      }),
    );
  },
  async refile(id: string, collectionId?: string) {
    return rememberBookmark(
      await new BookmarksApi(await configuration()).bookmarksRefile({
        id,
        refileBookmarkRequest: { collectionId: collectionId ?? null },
      }),
    );
  },
  async retry(id: string) {
    return new BookmarksApi(await configuration()).bookmarksReprocess({
      id,
      reprocessBookmarkRequest: {},
    });
  },
  async highlights(id: string) {
    return (
      await new ReadingApi(await configuration()).readingListHighlights({ id })
    ).highlights;
  },
  async highlight(id: string, quote: string, note?: string) {
    return new ReadingApi(await configuration()).readingCreateHighlight({
      id,
      createHighlightRequest: { quote, note },
    });
  },
  async removeHighlight(id: string) {
    return new ReadingApi(await configuration()).highlightsRemove({ id });
  },
  async progress(id: string) {
    return (
      await new ReadingApi(await configuration()).readingGetProgress({ id })
    ).progress;
  },
  async saveProgress(id: string, percent: number, scrollOffset: number) {
    return new ReadingApi(await configuration()).readingSaveProgress({
      id,
      saveReadingProgressRequest: { percent, scrollOffset },
    });
  },
};
