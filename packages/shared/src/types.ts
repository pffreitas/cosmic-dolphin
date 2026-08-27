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

// Profile interface
export interface Profile {
  id: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
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
