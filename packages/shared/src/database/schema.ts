import { Generated, Insertable, Selectable, Updateable } from "kysely";

// Base table interface
export interface BaseTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// Collections table
export interface CollectionsTable extends BaseTable {
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  user_id: string;
  is_public: Generated<boolean>;
}

// Collection suggestions table — a proposed collection, not a created one.
// The file phase never creates a collection; it accumulates support here until
// the user accepts. See docs/functional-spec/03-ai-pipeline.md § Filing.
export interface CollectionSuggestionsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  parent_id: string | null;
  bookmark_ids: string[];
  status: Generated<CollectionSuggestionStatus>;
  dismissed_until: Date | null;
  created_at: Generated<Date>;
}

// Processing status type
export type ProcessingStatus = "idle" | "processing" | "completed" | "failed";
export type BookmarkProcessingTimelineStatus = "running" | "completed" | "failed";
export type BookmarkProcessingEventKind = "run" | "phase" | "turn";

/** Who chose a bookmark's collection. `user` is the override flag. */
export type FilingSource = "ai" | "user";

export type CollectionSuggestionStatus = "pending" | "accepted" | "dismissed";

// Bookmarks table
export interface BookmarksTable extends BaseTable {
  source_url: string;
  title: string | null;
  metadata: any | null; // JSONB
  collection_id: string | null;
  /**
   * `ai` — the file phase chose `collection_id` and a later run may revise it.
   * `user` — a human chose it, and the pipeline never moves the row again.
   */
  filing_source: Generated<FilingSource>;
  /** Reshare provenance: the bookmark this one was saved from (D13). */
  saved_from_bookmark_id: string | null;
  user_id: string;
  is_archived: Generated<boolean>;
  is_favorite: Generated<boolean>;
  cosmic_summary: string | null;
  cosmic_brief_summary: string | null;
  cosmic_key_points: any | null; // JSONB — string[]
  cosmic_tags: string[] | null;
  cosmic_images: any | null; // JSONB
  cosmic_links: any | null; // JSONB
  quick_access: string | null;
  search_document: string | null;
  processing_status: Generated<ProcessingStatus>;
  processing_started_at: Date | null;
  processing_completed_at: Date | null;
  processing_error: string | null;
  is_private_link: Generated<boolean>;
  like_count: Generated<number>;
  is_public: Generated<boolean>;
  share_slug: string | null;
  read_at: Date | null;
}

// Bookmark likes table (user x bookmark junction)
export interface BookmarkLikesTable {
  id: Generated<string>;
  user_id: string;
  bookmark_id: string;
  created_at: Generated<Date>;
}

// Scraped URL contents table
export interface ScrapedUrlContentsTable extends BaseTable {
  bookmark_id: string;
  title: string;
  content: string;
  metadata: any | null; // JSONB
  images: any | null; // JSONB
  links: any | null; // JSONB
}

// Content chunks base table
export interface ContentChunksTable extends BaseTable {
  scraped_content_id: string;
  chunk_type: "text" | "image";
  index: number;
  size: number;
  start_position: number;
  end_position: number;
}

// Text chunks table
export interface TextChunksTable {
  chunk_id: string;
  content: string;
  embedding: number[] | null;
}

// Image chunks table
export interface ImageChunksTable {
  chunk_id: string;
  image_data: Buffer;
  mime_type: string;
  alt_text: string | null;
  original_url: string | null;
}

// Profiles table
export interface ProfilesTable {
  id: string;
  name: string | null;
  email: string | null;
  picture_url: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface BookmarkProcessingRunsTable extends BaseTable {
  bookmark_id: string;
  user_id: string;
  status: BookmarkProcessingTimelineStatus;
  started_at: Date;
  ended_at: Date | null;
  duration_ms: number | null;
  input_tokens: Generated<number>;
  output_tokens: Generated<number>;
  total_tokens: Generated<number>;
  reasoning_tokens: Generated<number>;
  cached_input_tokens: Generated<number>;
  cost_usd: string | null;
  error: string | null;
}

export interface BookmarkProcessingEventsTable extends BaseTable {
  run_id: string;
  parent_event_id: string | null;
  kind: BookmarkProcessingEventKind;
  phase: string | null;
  name: string;
  status: BookmarkProcessingTimelineStatus;
  sequence: number;
  started_at: Date;
  ended_at: Date | null;
  duration_ms: number | null;
  model_id: string | null;
  input_tokens: Generated<number>;
  output_tokens: Generated<number>;
  total_tokens: Generated<number>;
  reasoning_tokens: Generated<number>;
  cached_input_tokens: Generated<number>;
  cost_usd: string | null;
  provider_metadata: any | null;
  metadata: any | null;
  error: string | null;
}

// Database schema interface
export interface Database {
  collections: CollectionsTable;
  collection_suggestions: CollectionSuggestionsTable;
  bookmarks: BookmarksTable;
  bookmark_likes: BookmarkLikesTable;
  scraped_url_contents: ScrapedUrlContentsTable;
  content_chunks: ContentChunksTable;
  text_chunks: TextChunksTable;
  image_chunks: ImageChunksTable;
  profiles: ProfilesTable;
  bookmark_processing_runs: BookmarkProcessingRunsTable;
  bookmark_processing_events: BookmarkProcessingEventsTable;
}

// Type helpers for each table
export type Collection = Selectable<CollectionsTable>;
export type NewCollection = Insertable<CollectionsTable>;
export type CollectionUpdate = Updateable<CollectionsTable>;

export type CollectionSuggestionRow = Selectable<CollectionSuggestionsTable>;
export type NewCollectionSuggestion = Insertable<CollectionSuggestionsTable>;
export type CollectionSuggestionUpdate =
  Updateable<CollectionSuggestionsTable>;

export type Bookmark = Selectable<BookmarksTable>;
export type NewBookmark = Insertable<BookmarksTable>;
export type BookmarkUpdate = Updateable<BookmarksTable>;

export type BookmarkLike = Selectable<BookmarkLikesTable>;
export type NewBookmarkLike = Insertable<BookmarkLikesTable>;

export type ScrapedUrlContent = Selectable<ScrapedUrlContentsTable>;
export type NewScrapedUrlContent = Insertable<ScrapedUrlContentsTable>;
export type ScrapedUrlContentUpdate = Updateable<ScrapedUrlContentsTable>;

export type ContentChunk = Selectable<ContentChunksTable>;
export type NewContentChunk = Insertable<ContentChunksTable>;
export type ContentChunkUpdate = Updateable<ContentChunksTable>;

export type TextChunk = Selectable<TextChunksTable>;
export type NewTextChunk = Insertable<TextChunksTable>;
export type TextChunkUpdate = Updateable<TextChunksTable>;

export type ImageChunk = Selectable<ImageChunksTable>;
export type NewImageChunk = Insertable<ImageChunksTable>;
export type ImageChunkUpdate = Updateable<ImageChunksTable>;

export type Profile = Selectable<ProfilesTable>;
export type NewProfile = Insertable<ProfilesTable>;
export type ProfileUpdate = Updateable<ProfilesTable>;

export type BookmarkProcessingRun = Selectable<BookmarkProcessingRunsTable>;
export type NewBookmarkProcessingRun = Insertable<BookmarkProcessingRunsTable>;
export type BookmarkProcessingRunUpdate = Updateable<BookmarkProcessingRunsTable>;

export type BookmarkProcessingEvent = Selectable<BookmarkProcessingEventsTable>;
export type NewBookmarkProcessingEvent =
  Insertable<BookmarkProcessingEventsTable>;
export type BookmarkProcessingEventUpdate =
  Updateable<BookmarkProcessingEventsTable>;
