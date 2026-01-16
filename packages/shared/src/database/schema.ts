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

// Processing status type
export type ProcessingStatus = "idle" | "processing" | "completed" | "failed";

// Bookmarks table
export interface BookmarksTable extends BaseTable {
  source_url: string;
  title: string | null;
  metadata: any | null; // JSONB
  collection_id: string | null;
  user_id: string;
  is_archived: Generated<boolean>;
  is_favorite: Generated<boolean>;
  cosmic_summary: string | null;
  cosmic_brief_summary: string | null;
  cosmic_tags: string[] | null;
  cosmic_images: any | null; // JSONB
  cosmic_links: any | null; // JSONB
  quick_access: string | null; // PGroonga searchable text
  processing_status: Generated<ProcessingStatus>;
  processing_started_at: Date | null;
  processing_completed_at: Date | null;
  processing_error: string | null;
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
}

// Image chunks table
export interface ImageChunksTable {
  chunk_id: string;
  image_data: Buffer;
  mime_type: string;
  alt_text: string | null;
  original_url: string | null;
}

// Database schema interface
export interface Database {
  collections: CollectionsTable;
  bookmarks: BookmarksTable;
  scraped_url_contents: ScrapedUrlContentsTable;
  content_chunks: ContentChunksTable;
  text_chunks: TextChunksTable;
  image_chunks: ImageChunksTable;
}

// Type helpers for each table
export type Collection = Selectable<CollectionsTable>;
export type NewCollection = Insertable<CollectionsTable>;
export type CollectionUpdate = Updateable<CollectionsTable>;

export type Bookmark = Selectable<BookmarksTable>;
export type NewBookmark = Insertable<BookmarksTable>;
export type BookmarkUpdate = Updateable<BookmarksTable>;

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
