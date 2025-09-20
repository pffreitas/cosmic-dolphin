import { Generated, Insertable, Selectable, Updateable } from 'kysely';

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

// Bookmarks table
export interface BookmarksTable extends BaseTable {
  source_url: string;
  title: string | null;
  content: string | null;
  metadata: any | null; // JSONB
  collection_id: string | null;
  user_id: string;
  is_archived: Generated<boolean>;
  is_favorite: Generated<boolean>;
  cosmic_summary: string | null;
  cosmic_tags: string[] | null;
  cosmic_images: any | null; // JSONB
  cosmic_links: any | null; // JSONB
}

// Scraped URL contents table
export interface ScrapedUrlContentsTable {
  id: Generated<string>;
  bookmark_id: string;
  title: string;
  content: string;
  metadata: any | null; // JSONB
  images: any | null; // JSONB
  links: any | null; // JSONB
  created_at: Generated<Date>;
}

// Database schema interface
export interface Database {
  collections: CollectionsTable;
  bookmarks: BookmarksTable;
  scraped_url_contents: ScrapedUrlContentsTable;
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