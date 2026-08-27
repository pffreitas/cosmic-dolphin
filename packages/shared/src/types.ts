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
  title?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  cosmicImages?: BookmarkImage[];
  cosmicLinks?: BookmarkLink[];
  cosmicSummary?: string;
  cosmicBriefSummary?: string;
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
  };
}

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
}

export interface GetBookmarksResponse {
  bookmarks: Bookmark[];
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
