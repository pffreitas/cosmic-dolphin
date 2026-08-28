// Placeholder for shared types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Queue message types
export interface QueueMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: Date;
  vt: Date;
  message: any;
}

export interface QueueTaskPayload {
  type: string;
  action?: string;
  data?: any;
  metadata?: {
    source?: string;
    priority?: "low" | "medium" | "high";
    retry_count?: number;
  };
}

/**
 * The caller's own profile — the private shape, and the only one that carries
 * an email. Anything anyone else can see is a `PublicProfile`, which is a
 * separate type on purpose (see its doc comment).
 */
export interface Profile {
  id: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
  /** The stable public identity. `/u/{handle}` is the canonical profile URL. */
  handle?: string;
  /**
   * False when the handle was reserved from the email local part and never
   * confirmed by a person. The web app prompts once on the strength of this.
   */
  handleClaimed: boolean;
  /**
   * When the handle may next be changed, or absent when it may be changed now.
   * A handle changes at most once every 30 days; confirming a reserved handle
   * unchanged is not a change and does not start the clock.
   */
  handleChangeAvailableAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Collection interface
export interface Collection extends BaseEntity {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  userId: string;
  isPublic?: boolean;
}

// Collection path item for breadcrumb navigation
export interface CollectionPathItem {
  id: string;
  name: string;
}

/**
 * Who chose a bookmark's collection.
 *
 * `ai` — the `file` phase did, and a later run may revise it.
 * `user` — a person did, and the pipeline never moves the bookmark again.
 *
 * The second is the override rule (docs/functional-spec/03-ai-pipeline.md
 * § Filing). It is enforced in SQL, on the write, not by whoever remembers to
 * check it before calling.
 */
export type FilingSource = "ai" | "user";

export type CollectionSuggestionStatus = "pending" | "accepted" | "dismissed";

/**
 * A collection the pipeline thinks should exist. It does not exist yet.
 *
 * The `file` phase never creates a collection. When the model proposes one,
 * the proposal accumulates supporting bookmarks here; once
 * `MIN_SUGGESTION_SUPPORT` of them agree it is offered in the Library rail with
 * Create / Not now. Until the user presses Create, the supporting bookmarks sit
 * in Inbox.
 */
export interface CollectionSuggestion {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
  bookmarkIds: string[];
  status: CollectionSuggestionStatus;
  dismissedUntil?: Date;
  createdAt: Date;
}

// Open Graph metadata interface
export interface OpenGraphMetadata {
  favicon?: string;
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  site_name?: string;
  type?: string;
  locale?: string;
  article_author?: string;
  article_published_time?: string;
  article_modified_time?: string;
  article_section?: string;
  article_tag?: string[];
  video_channel?: string;
  video_channel_url?: string;
  video_duration?: string;
}

// Bookmark metadata interface
export interface BookmarkMetadata {
  openGraph?: OpenGraphMetadata;
  wordCount?: number;
  readingTime?: number;
  /**
   * The URL exactly as the user pasted it. `sourceUrl` holds the normalised
   * form — see `normalizeUrl`. The paste is evidence and is never rewritten
   * out of existence.
   */
  originalUrl?: string;
  privateLink?: {
    userDescription: string;
    userProvidedTitle?: string;
    enrichedAt?: string;
  };
}

export interface BookmarkImage {
  url: string;
  title: string;
  description: string;
}

export interface BookmarkLink {
  url: string;
  relevance: string;
}

// Processing status type
export type ProcessingStatus = "idle" | "processing" | "completed" | "failed";
export type BookmarkProcessingTimelineStatus =
  | "running"
  | "completed"
  | "failed";
export type BookmarkProcessingEventKind = "run" | "phase" | "turn";

export interface BookmarkProcessingUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: string;
  providerMetadata?: Record<string, any>;
}

export interface BookmarkProcessingRun extends BaseEntity {
  bookmarkId: string;
  userId: string;
  status: BookmarkProcessingTimelineStatus;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  costUsd?: string;
  error?: string;
}

export interface BookmarkProcessingEvent extends BaseEntity {
  runId: string;
  parentEventId?: string;
  kind: BookmarkProcessingEventKind;
  phase?: string;
  name: string;
  status: BookmarkProcessingTimelineStatus;
  sequence: number;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  modelId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  costUsd?: string;
  providerMetadata?: Record<string, any>;
  metadata?: Record<string, any>;
  error?: string;
}

export interface BookmarkProcessingTimeline {
  bookmark: Bookmark;
  run?: BookmarkProcessingRun;
  events: BookmarkProcessingEvent[];
  pollAfterMs: number;
}

export interface Bookmark extends BaseEntity {
  sourceUrl: string;
  collectionId?: string;
  collectionPath?: CollectionPathItem[];
  /**
   * Defaults to `ai`. Once it is `user`, no pipeline run may change
   * `collectionId` again — see `FilingSource`.
   */
  filingSource?: FilingSource;
  /** The bookmark this one was saved from, when it came from a reshare (D13). */
  savedFromBookmarkId?: string;
  title?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  cosmicImages?: BookmarkImage[];
  cosmicLinks?: BookmarkLink[];
  cosmicSummary?: string;
  cosmicBriefSummary?: string;
  /**
   * The full brief's key points, 2–5 findings of ≤ 140 characters each, parsed
   * out of `cosmicSummary` once by the pipeline. Stored so the reader never
   * has to parse markdown to draw three bullets — see
   * docs/functional-spec/03-ai-pipeline.md § Outputs.
   */
  cosmicKeyPoints?: string[];
  cosmicTags?: string[];
  metadata?: BookmarkMetadata;
  userId: string;
  quickAccess?: string;
  searchDocument?: string;
  isPrivateLink: boolean;
  likeCount?: number;
  isLikedByCurrentUser?: boolean;
  /** Live comments, tombstones excluded. Maintained by trigger. */
  commentCount?: number;
  isPublic: boolean;
  shareSlug?: string;
  readAt?: Date;
  isRead?: boolean;
  processingStatus: ProcessingStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingError?: string;
}

/**
 * How far into a bookmark the reader has got.
 *
 * Deliberately not part of `Bookmark`: progress is written far more often than
 * a bookmark is read, and folding it into the bookmark row would make every
 * library query join a table that only the reader and the Home rail care
 * about.
 */
export interface ReadingProgress {
  bookmarkId: string;
  /** 0–100. Monotonic — see `SaveReadingProgressResult.accepted`. */
  percent: number;
  scrollOffset?: number;
  updatedAt: Date;
}

export interface SaveReadingProgressResult {
  progress: ReadingProgress;
  /**
   * False when the submitted percent was below what is already stored, and the
   * stored value was kept. Not an error: a reader scrolling back up has not
   * un-read anything. The client uses it to stop resending a stale value.
   */
  accepted: boolean;
}

/** A bookmark the reader is part-way through, for Home's Continue reading rail. */
export interface ContinueReadingItem {
  bookmark: Bookmark;
  progress: ReadingProgress;
}

/**
 * A span of extracted content the reader kept.
 *
 * `quote`/`prefix`/`suffix` are the anchor — never offsets. Resolution against
 * the current extraction lives in `highlight-anchor.ts`, so a re-extraction
 * moves a highlight instead of orphaning it.
 *
 * Private to `userId` even when the bookmark is public.
 */
export interface Highlight {
  id: string;
  bookmarkId: string;
  userId: string;
  quote: string;
  prefix?: string;
  suffix?: string;
  note?: string;
  createdAt: Date;
}

export interface CreateHighlightRequest {
  quote: string;
  prefix?: string;
  suffix?: string;
  note?: string;
}

// TODO rename to ScrapedContent
export interface ScrapedUrlContents extends BaseEntity {
  bookmarkId: string;
  title: string;
  content: string;
  metadata: BookmarkMetadata;
  images?: {
    url: string;
    alt: string;
  }[];
  links?: {
    url: string;
    text: string;
  }[];
}

export interface BaseContentChunk extends BaseEntity {
  scrapedContentId: string;
  chunkType: "text" | "image";
  index: number;
  size: number;
  startPosition: number;
  endPosition: number;
}

export interface TextChunk extends BaseContentChunk {
  chunkType: "text";
  content: string;
}

export interface ImageChunk extends BaseContentChunk {
  chunkType: "image";
  imageData: Buffer;
  mimeType: string;
  altText?: string;
  originalUrl?: string;
}

export type ContentChunk = TextChunk | ImageChunk;

export interface BookmarkQueuePayload extends QueueTaskPayload {
  type: "bookmark_process";
  data: {
    bookmarkId: string;
    userId: string;
    /**
     * Reprocess one phase instead of the whole pipeline. Set by
     * `POST /bookmarks/{id}/reprocess`; absent on a first save.
     */
    phase?: BookmarkProcessingPhase;
    /** Append to the bookmark's existing timeline rather than opening a run. */
    resume?: boolean;
  };
}

/**
 * The pipeline's phase vocabulary — docs/functional-spec/03-ai-pipeline.md.
 * Kept here as well as on the reporter so clients and queue payloads can name
 * a phase without importing the worker's machinery.
 */
export type BookmarkProcessingPhase =
  | "fetch"
  | "extract"
  | "summarise"
  | "tag"
  | "file"
  | "embed";

export interface CreateBookmarkRequest {
  source_url: string;
  collection_id?: string;
  title?: string;
  description?: string;
  tags?: string[];
  is_private_link?: boolean;
}

export interface PreviewMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  url: string;
}

export interface PreviewResponse {
  metadata: PreviewMetadata;
  scrapable: boolean;
}

export interface CreateBookmarkResponse {
  bookmark: Bookmark;
  message: string;
  /**
   * The user already had this URL. The bookmark is the existing one — nothing
   * was created and nothing was re-queued. A duplicate paste is not an error.
   */
  alreadySaved?: boolean;
}

export interface GetBookmarksQuery {
  collection_id?: string;
  limit?: number;
  offset?: number;
  read_status?: "all" | "unread" | "read";
  /** Which rail row this is. Ignored when `collection_id` names a collection. */
  scope?: "all" | "inbox" | "archive";
  /** Defaults to `newest` — chronological, the Library's resting order. */
  sort?: "newest" | "oldest" | "recently_read" | "longest_unread";
  /** Opaque keyset cursor from the previous page. Beats `offset`. */
  cursor?: string;
}

export interface GetBookmarksResponse {
  bookmarks: Bookmark[];
  /** Absent when this page is the last one. */
  nextCursor?: string;
}

export interface SearchBookmarksQuery {
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchBookmarksResponse {
  bookmarks: Bookmark[];
  total?: number;
}

export interface ShareBookmarkResponse {
  isPublic: boolean;
  shareUrl: string;
}

export interface ErrorResponse {
  error: string;
}

export interface UrlContents {
  content: string;
  contentType: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Social graph — docs/functional-spec/06-social.md
// ---------------------------------------------------------------------------

/**
 * A profile as anyone is allowed to see it.
 *
 * **There is no `email` here, and there must never be one.** This is not a
 * convention to remember at the call site — it is the type every public route
 * returns, the repository selects an explicit column list that omits `email`
 * so the value is not even in scope on the way out, and `assertPublicProfileHasNoEmail`
 * below fails the build if the field is ever added back.
 *
 * `PublicProfile` is deliberately *not* derived from `Profile` with an `Omit`.
 * An `Omit` keeps the two shapes coupled: a field added to `Profile` appears
 * here for free, which is exactly the accident this type exists to prevent.
 */
export interface PublicProfile {
  id: string;
  /** The stable public identity. `/u/{handle}` is the canonical URL. */
  handle: string;
  name?: string;
  pictureUrl?: string;
  /** When the account was created. The only date a public profile carries. */
  joinedAt: Date;
  counts: PublicProfileCounts;
  /** True when this profile is the caller's own. */
  isSelf: boolean;
  /** True when the caller follows this profile. Absent for anonymous callers. */
  isFollowedByViewer?: boolean;
  /** True when this profile follows the caller. */
  followsViewer?: boolean;
  /** True when the caller has blocked this profile. */
  isBlockedByViewer?: boolean;
}

export interface PublicProfileCounts {
  followers: number;
  following: number;
  /** Public saves only. The size of someone's private library is theirs. */
  publicSaves: number;
  /** Public collections only, for the same reason. */
  collections: number;
}

/**
 * A compile-time guard, not documentation.
 *
 * `Assert<false>` does not satisfy `Assert<T extends true>`, so the moment
 * `email` appears anywhere in `PublicProfile` this file stops compiling and the
 * leak is caught before it is written, let alone deployed.
 */
type Assert<T extends true> = T;
export type assertPublicProfileHasNoEmail = Assert<
  "email" extends keyof PublicProfile ? false : true
>;

export interface UpdateProfileRequest {
  name?: string | null;
  pictureUrl?: string | null;
  handle?: string;
}

// ---------------------------------------------------------------------------
// The Home feed — docs/functional-spec/05-feed.md
// ---------------------------------------------------------------------------

/**
 * Which slice of the feed. `unread` is the only one that does not rank, which
 * is what makes it the place an item the ranker has stopped serving is still
 * reachable.
 */
export type FeedScope = "for_you" | "following" | "unread";

export const FEED_SCOPES: FeedScope[] = ["for_you", "following", "unread"];

export function isFeedScope(value: string): value is FeedScope {
  return (FEED_SCOPES as string[]).includes(value);
}

export type FeedItemType =
  | "own_save"
  | "followed_save"
  | "reshare"
  | "digest"
  | "pending";

/**
 * One signal's contribution to one item. Debugging only — the API omits these
 * in production. Never the source of `rankingReason`: the sentence is written
 * from the signals by the ranker, because only the ranker knows what it
 * actually weighted.
 */
export interface RankingSignal {
  name: string;
  /** The configured weight for this signal. */
  weight: number;
  /** The signal's own value for this item, normalised to 0..1. */
  value: number;
  /** `weight * value`. */
  contribution: number;
}

/**
 * The person a feed item reached the viewer through.
 *
 * Deliberately not `PublicProfile`: a page of 20 items can carry 20 distinct
 * authors, and a `PublicProfile` carries four counts that cost a query each.
 * The handle is here, so the full profile is one link away.
 */
export interface FeedActor {
  id: string;
  handle: string;
  name?: string;
  pictureUrl?: string;
}

export interface FeedItem {
  type: FeedItemType;
  /** Present on every type except `digest`. */
  bookmark?: Bookmark;
  /** Who this reached the viewer through. Absent on their own saves. */
  actor?: FeedActor;
  /** "Why this appeared", server-generated. Absent on `pending`, which is pinned. */
  rankingReason?: string;
  signals?: RankingSignal[];
}

export interface FeedResponse {
  items: FeedItem[];
  /** Opaque. Carries the ranking session, not a position in a list. */
  nextCursor?: string;
  /** When this ranking was computed. Drives "Updated n min ago". */
  computedAt: Date;
}

export interface FollowResponse {
  /** The state after the call, so an optimistic client can reconcile. */
  following: boolean;
  /** The target's follower count after the call. */
  followerCount: number;
}

export interface BlockResponse {
  blocked: boolean;
}

export interface PublicSavesResponse {
  bookmarks: Bookmark[];
  /** Absent when this page is the last one. */
  nextCursor?: string;
}

export interface PublicProfileListResponse {
  profiles: PublicProfile[];
  /** Absent when this page is the last one. */
  nextCursor?: string;
}

/**
 * A comment on a bookmark.
 *
 * One level of nesting: `parentId` is absent, or it is a *top-level* comment's
 * id. It is never a reply's id — `CommentService` re-points a reply-to-a-reply
 * at its grandparent rather than refusing the request.
 *
 * A deleted comment that still has replies survives as a tombstone: no body, no
 * author, `isDeleted: true`. Everything that identifies the person who wrote it
 * is gone; only the position in the thread remains, so its replies still have
 * something to hang off.
 */
export interface Comment {
  id: string;
  bookmarkId: string;
  parentId?: string;
  /** Absent on a tombstone. */
  body?: string;
  /** Absent on a tombstone. */
  author?: CommentAuthor;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  isDeleted: boolean;
  isOwn: boolean;
  /** Still inside the 15-minute edit window. Re-checked server-side on PATCH. */
  canEdit: boolean;
}

/** The public identity behind a comment. Structurally incapable of holding an email. */
export interface CommentAuthor {
  id: string;
  handle?: string;
  name?: string;
  pictureUrl?: string;
}

/** A thread, chronological. There is no field here in which to express a ranking. */
export interface CommentsResponse {
  comments: Comment[];
  commentCount: number;
}

export interface CreateCommentRequest {
  body: string;
  parentId?: string;
}

export interface UpdateCommentRequest {
  body: string;
}

/**
 * A delete is one of two different outcomes, and the client renders them
 * differently: `deleted: false` means the comment had replies and became a
 * tombstone, which `comment` carries.
 */
export interface DeleteCommentResult {
  deleted: boolean;
  comment?: Comment;
  commentCount: number;
}

export interface CreateReportRequest {
  bookmarkId?: string;
  commentId?: string;
  reason: string;
}

export interface CreateReportResult {
  reported: boolean;
}

/**
 * The same guard as `assertPublicProfileHasNoEmail`, one model further out.
 *
 * A comment author is a public identity attached to public text. If `email`
 * ever appears on `CommentAuthor`, this file stops compiling.
 */
export type assertCommentAuthorHasNoEmail = Assert<
  "email" extends keyof CommentAuthor ? false : true
>;
