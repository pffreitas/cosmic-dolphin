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

// Open Graph metadata interface
export interface OpenGraphMetadata {
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
  title?: string;
  description?: string;
  openGraph?: OpenGraphMetadata;
  favicon?: string;
  contentType?: string;
  wordCount?: number;
  readingTime?: number;
  images?: {
    url: string;
    description: string;
  }[];
  links?: {
    url: string;
    relevance: string;
  }[];
  tags?: string[];
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

// Bookmark interface
export interface Bookmark extends BaseEntity {
  sourceUrl: string;
  title?: string;
  metadata?: BookmarkMetadata;
  collectionId?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  content?: string;
  rawContent?: string;
  summary?: string;
  userId: string;
}

// Bookmark tag interface (for many-to-many relationship)
export interface BookmarkTag {
  bookmarkId: string;
  tag: string;
  createdAt: Date;
}

// Bookmark queue payload interface
export interface BookmarkQueuePayload extends QueueTaskPayload {
  type: "bookmark_process";
  data: {
    bookmarkId: string;
    sourceUrl: string;
    userId: string;
    collectionId?: string;
  };
}

// API Request/Response types
export interface CreateBookmarkRequest {
  source_url: string;
  collection_id?: string;
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

export interface ErrorResponse {
  error: string;
}

// Service result types
export interface FetchUrlResult {
  content: string;
  contentType: string;
}

export interface ValidationError {
  field: string;
  message: string;
}
