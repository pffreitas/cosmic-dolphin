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
}

// Bookmark metadata interface
export interface BookmarkMetadata {
  openGraph?: OpenGraphMetadata;
  wordCount?: number;
  readingTime?: number;
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

export interface Bookmark extends BaseEntity {
  sourceUrl: string;
  collectionId?: string;
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
}

export interface CreateBookmarkResponse {
  bookmark: Bookmark;
  message: string;
}

export interface GetBookmarksQuery {
  collection_id?: string;
  limit?: number;
  offset?: number;
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
