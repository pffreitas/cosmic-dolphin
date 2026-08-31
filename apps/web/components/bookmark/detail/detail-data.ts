import { Bookmark } from "@cosmic-dolphin/api-client";

import { extractDomain, formatSavedAt } from "@/components/bookmark/library/row-data";
import { libraryHref } from "@/components/bookmark/library/params";

/**
 * The bookmark detail page, reduced to what it renders.
 *
 * Two routes compose the same page — `/bookmarks/[bookmarkId]` and `/s/[slug]`
 * — and the difference between them is a handful of booleans, not a second
 * layout. Deriving both from one function is what keeps them the same page:
 * a field added for the private surface shows up in the shared one's type
 * immediately, and the shared one has to say out loud that it does not want
 * it.
 *
 * Relative times are formatted here, on the server, for the same reason the
 * library row formats them there: a save made 59 seconds ago is "just now" in
 * the server render and "1m ago" in the hydration, and React calls that a
 * mismatch.
 */

/** Which of the four states the page is in. Not found is a route concern. */
export type DetailState = "ready" | "processing" | "failed" | "private";

export type DetailMode = "owner" | "shared";

export interface DetailCollectionCrumb {
  id: string;
  name: string;
  href: string;
}

export interface BookmarkDetailModel {
  id: string;
  mode: DetailMode;
  state: DetailState;

  title: string;
  sourceUrl: string;
  domain?: string;
  faviconUrl?: string;
  /** Author or publication credit, when the page declared one. */
  attribution?: string;
  savedAt: string;
  /** "9 min", or absent when extraction never reported a word count. */
  readingTime?: string;

  /** Deepest-first collection path. Empty on the shared route. */
  collectionPath: DetailCollectionCrumb[];

  /** The brief's paragraph. */
  briefSummary?: string;
  /**
   * D5 stores these as an array on `bookmarks.cosmic_key_points`. They are
   * never parsed back out of the summary markdown at render time: the model
   * already answered this question once, and re-deriving it in the client
   * means a bulleted list in the prose becomes a key point.
   */
  keyPoints: string[];
  /** The long-form content the reader paints. Markdown. */
  readerBody?: string;
  images: { url: string; title?: string; description?: string }[];
  tags: string[];

  isRead: boolean;
  isPrivateLink: boolean;
  /** Why the pipeline gave up, in the pipeline's own words. */
  processingError?: string;

  likeCount: number;
  /** Live comments on this save. The thread's own fetch is the later truth. */
  commentCount: number;
  isLiked: boolean;
  /** Absolute share URL, when the save has been shared. */
  shareUrl?: string;
  isPublic: boolean;

  /** Who shared it, on the shared route. */
  sharedByName?: string;
}

/** Reachable from the shared route's data, which has no `Bookmark` typing. */
export type BookmarkWithSharer = Bookmark & { sharedByUserName?: string };

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://cosmicdolphin.com"
  );
}

export function shareUrlForSlug(slug: string): string {
  return `${siteUrl()}/s/${slug}`;
}

/**
 * Precedence between the states, which is the only judgement in this file.
 *
 * Failed wins over private: a private link whose tagging fell over still has
 * something retryable, and hiding that behind the reassuring warning note
 * would leave the user with no way to ask again. Private wins over
 * processing, because the pipeline's remaining phases on a page it cannot
 * read are not what the reader is waiting for.
 */
export function detailState(bookmark: Pick<Bookmark, "processingStatus" | "isPrivateLink">): DetailState {
  if (bookmark.processingStatus === "failed") return "failed";
  if (bookmark.isPrivateLink) return "private";
  if (bookmark.processingStatus === "processing") return "processing";
  return "ready";
}

export function toDetailModel(
  bookmark: BookmarkWithSharer,
  options: { mode: DetailMode; now?: Date; shareSlug?: string }
): BookmarkDetailModel {
  const { mode, now = new Date() } = options;
  const shared = mode === "shared";
  const og = bookmark.metadata?.openGraph;
  const slug = options.shareSlug ?? bookmark.shareSlug;

  return {
    id: bookmark.id,
    mode,
    state: detailState(bookmark),

    title: bookmark.title?.trim() || "Untitled",
    sourceUrl: bookmark.sourceUrl,
    domain: extractDomain(bookmark.sourceUrl ?? ""),
    faviconUrl: og?.favicon || undefined,
    attribution: og?.articleAuthor || og?.siteName || undefined,
    savedAt: formatSavedAt(bookmark.createdAt, now),
    readingTime: bookmark.metadata?.readingTime
      ? `${bookmark.metadata.readingTime} min`
      : undefined,

    // The shared route drops the breadcrumb: a stranger has no Library to
    // navigate into, and the collection name is the owner's filing, not
    // theirs to read.
    collectionPath: shared
      ? []
      : (bookmark.collectionPath ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          href: libraryHref({ collectionId: item.id }),
        })),

    briefSummary: bookmark.cosmicBriefSummary || og?.description || undefined,
    keyPoints: bookmark.cosmicKeyPoints ?? [],
    readerBody: bookmark.cosmicSummary || undefined,
    images: (bookmark.cosmicImages ?? []).map((image) => ({
      url: image.url,
      title: image.title,
      description: image.description,
    })),
    tags: bookmark.cosmicTags ?? [],

    isRead: bookmark.isRead ?? Boolean(bookmark.readAt),
    isPrivateLink: Boolean(bookmark.isPrivateLink),
    processingError: bookmark.processingError || undefined,

    likeCount: bookmark.likeCount ?? 0,
    commentCount: bookmark.commentCount ?? 0,
    isLiked: Boolean(bookmark.isLikedByCurrentUser),
    shareUrl: slug ? shareUrlForSlug(slug) : undefined,
    isPublic: Boolean(bookmark.isPublic),

    sharedByName: shared ? bookmark.sharedByUserName : undefined,
  };
}
