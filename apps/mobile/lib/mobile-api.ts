/** Native adapters around the generated contract. Never manufacture feed content. */
import {
  PicksApi,
  FeedApi,
  ShareKeysApi,
  BookmarksApi,
  SharedBookmarksApi,
  CollectionsApi,
  Configuration,
  DigestsApi,
  ExploreApi,
  ReadingApi,
  SocialApi,
  CommentsApi,
  type Bookmark as ContractBookmark,
  type CreateBookmarkRequest,
  type UpdateBookmarkRequest,
  type BookmarkScope,
  type BookmarkSort,
  type FeedScope,
  type Collection,
  type FeedResponse,
  type ExploreResponse,
} from "@cosmic-dolphin/api-client";
import { saveRequest } from "./save-request";
import { supabase } from "./supabase";
import { cacheBookmarksInBackground } from "./bookmark-cache";
import type { Bookmark } from "./api";

export async function configuration(expectedUserId?: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (expectedUserId && session?.user.id !== expectedUserId) throw { response: new Response(null, { status: 401 }) };
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
    laterUntil: bookmark.laterUntil == null ? bookmark.laterUntil : bookmark.laterUntil.toISOString(),
    captureQueuedAt: bookmark.captureQueuedAt == null ? bookmark.captureQueuedAt : bookmark.captureQueuedAt.toISOString(),
  };
}
function rememberBookmark(bookmark: ContractBookmark) {
  const result = nativeBookmark(bookmark);
  cacheBookmarksInBackground(result.userId, [result]);
  return result;
}
function rememberOwnedBookmark(bookmark: ContractBookmark, userId?: string) {
  if (userId && bookmark.userId !== userId) throw { response: new Response(null, { status: 401 }) };
  return rememberBookmark(bookmark);
}
export const MobileAPI = {
  async sharedBookmark(slug: string, signal?: AbortSignal) {
    const bookmark = await new SharedBookmarksApi(await configuration()).sharedBookmarksFindBySlug({ slug }, { signal });
    // Public responses never populate an account's private offline cache.
    return nativeBookmark(bookmark);
  },
  async pasteContent(id: string, text: string, signal?: AbortSignal, userId?: string) {
    const client = new BookmarksApi(await configuration(userId));
    const result = await saveRequest(requestSignal => client.bookmarksPutContent({ id, pasteBookmarkContentRequest: { text } }, { signal: requestSignal }), signal);
    return { ...result, bookmark: rememberOwnedBookmark(result.bookmark, userId) };
  },
  async content(id: string, signal?: AbortSignal, userId?: string) {
    return new BookmarksApi(await configuration(userId)).bookmarksGetContent({ id }, { signal });
  },
  async notInterested(id: string, userId?: string) {
    return new FeedApi(await configuration(userId)).feedFeedback({ feedFeedbackRequest: { kind: "not_interested", bookmarkId: id } });
  },
  async read(id: string, done: boolean, userId?: string) {
    const client = new BookmarksApi(await configuration(userId));
    return done ? client.bookmarksMarkRead({ id }) : client.bookmarksMarkUnread({ id });
  },
  async issueShareKey(deviceId: string, userId: string) {
    return new ShareKeysApi(await configuration(userId)).shareKeysIssue({ issueShareKeyRequest: { deviceId } });
  },
  async revokeShareKey(id: string, userId: string) {
    await new ShareKeysApi(await configuration(userId)).shareKeysRevoke({ id });
  },
  async create(params: CreateBookmarkRequest, signal?: AbortSignal, userId?: string) {
    const result = await new BookmarksApi(await configuration(userId)).bookmarksCreate({ createBookmarkRequest: params }, { signal });
    if (!("bookmark" in result) || !result.bookmark?.id) throw new Error("Expected owner bookmark response");
    return { ...result, bookmark: rememberOwnedBookmark(result.bookmark, userId) };
  },
  async update(id: string, params: UpdateBookmarkRequest, signal?: AbortSignal, userId?: string) {
    const client = new BookmarksApi(await configuration(userId));
    return rememberOwnedBookmark(await saveRequest(requestSignal => client.bookmarksUpdate({ id, updateBookmarkRequest: params }, { signal: requestSignal }), signal), userId);
  },
  async processingTimeline(id: string, signal?: AbortSignal, userId?: string) {
    const result = await new BookmarksApi(await configuration(userId)).bookmarksGetProcessingTimeline({ id }, { signal });
    return { ...result, bookmark: rememberOwnedBookmark(result.bookmark, userId) };
  },
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
  async picks() {
    const client = new PicksApi(await configuration());
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try { return await client.picksToday({ tz }); }
    catch (error) {
      if ((error as { response?: { status: number } }).response?.status === 400) return client.picksToday({ tz: "UTC" });
      throw error;
    }
  },
  async feed(scope: FeedScope, cursor?: string): Promise<FeedResponse> {
    return new BookmarksApi(await configuration()).bookmarksFeed({
      scope,
      cursor,
      limit: scope === "for_you" ? 15 : 30,
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
  async collections(userId?: string) {
    return (await new CollectionsApi(await configuration(userId)).collectionsList())
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
  async saveRecommendation(id: string, userId?: string) {
    return rememberOwnedBookmark(
      (await new BookmarksApi(await configuration(userId)).bookmarksReshare({ id }))
        .bookmark, userId,
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
  async refile(id: string, collectionId?: string, userId?: string) {
    return rememberOwnedBookmark(
      await new BookmarksApi(await configuration(userId)).bookmarksRefile({
        id,
        refileBookmarkRequest: { collectionId: collectionId ?? null },
      }), userId,
    );
  },
  async retry(id: string, userId?: string, signal?: AbortSignal) {
    const result = await new BookmarksApi(await configuration(userId)).bookmarksReprocess({
      id,
      reprocessBookmarkRequest: {},
    }, { signal });
    return { ...result, bookmark: rememberOwnedBookmark(result.bookmark, userId) };
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
