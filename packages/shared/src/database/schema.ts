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
  /**
   * Live comments, tombstones excluded. `Generated` because it is maintained
   * by the `bookmark_comments_count_sync` trigger and never written by
   * application code — an INSERT that tried to set it would be overwritten by
   * the first comment anyway.
   */
  comment_count: Generated<number>;
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

  /**
   * Public identity, unique, `^[a-z0-9_]{3,30}$`. Nullable only because a
   * profile row is created by a trigger on `auth.users` and sign-in must never
   * fail over a handle that could not be minted.
   */
  handle: string | null;

  /**
   * When a human last *changed* the handle. `null` means never — the reserved
   * handle came from the email local part, which is not a change the user made
   * and does not consume their 30-day allowance.
   */
  handle_changed_at: Date | null;

  /**
   * When a human confirmed the handle. `null` means reserved-and-unclaimed:
   * the value in `handle` is a guess and the user has never been asked.
   */
  handle_claimed_at: Date | null;

  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

/**
 * A directed follow edge. No approval, no reciprocity, two states: the row
 * exists or it does not — docs/functional-spec/06-social.md § Follow.
 */
export interface FollowsTable {
  follower_id: string;
  following_id: string;
  created_at: Generated<Date>;
}

/**
 * `blocker_id` blocked `blocked_id`. Blocking drops both follow edges and
 * hides the blocker's public saves from the blocked user.
 */
export interface UserBlocksTable {
  blocker_id: string;
  blocked_id: string;
  created_at: Generated<Date>;
}

/**
 * A comment on a bookmark.
 *
 * `parent_id` is only ever NULL or a *top-level* comment's id. The database
 * cannot express that — the column references its own table and a reply's
 * parent is a legal value as far as the FK is concerned — so the rule lives in
 * `CommentService`, which re-points a reply-to-a-reply at its grandparent
 * rather than refusing it.
 *
 * `deleted_at` marks a tombstone: a comment whose author removed it while
 * replies still hung off it. A comment with no replies is hard-deleted and
 * this table has no row for it at all.
 */
export interface BookmarkCommentsTable {
  id: Generated<string>;
  bookmark_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

/**
 * A report of a bookmark or a comment. Exactly one target, enforced by a CHECK.
 *
 * `status` is a marker for the internal review queue. Nothing on the serving
 * path reads it: reported content stays visible pending review, because
 * auto-hide is trivially weaponised.
 */
export interface ContentReportsTable {
  id: Generated<string>;
  reporter_id: string;
  bookmark_id: string | null;
  comment_id: string | null;
  reason: string;
  status: Generated<ContentReportStatus>;
  created_at: Generated<Date>;
}

export type ContentReportStatus = "open" | "reviewed" | "actioned";

/**
 * How far into a bookmark a reader got. A cursor, not a history: one row per
 * (user, bookmark), and `percent` only ever moves up — the guard is on the
 * upsert in `BookmarkReadingRepository`, not here.
 *
 * Distinct from `bookmarks.read_at`, which stays the only record of *read*.
 */
export interface BookmarkReadingProgressTable {
  user_id: string;
  bookmark_id: string;
  percent: Generated<number>;
  scroll_offset: number | null;
  updated_at: Generated<Date>;
}

/**
 * A span of extracted content the reader kept, anchored by quote plus context
 * rather than by offsets — see `packages/shared/src/highlight-anchor.ts`.
 *
 * Private to `user_id` even when the bookmark is public. Every query against
 * this table is scoped to the reader in SQL.
 */
export interface BookmarkHighlightsTable {
  id: Generated<string>;
  user_id: string;
  bookmark_id: string;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  note: string | null;
  created_at: Generated<Date>;
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
  bookmark_reading_progress: BookmarkReadingProgressTable;
  bookmark_highlights: BookmarkHighlightsTable;
  follows: FollowsTable;
  user_blocks: UserBlocksTable;
  bookmark_comments: BookmarkCommentsTable;
  content_reports: ContentReportsTable;
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

export type FollowRow = Selectable<FollowsTable>;
export type NewFollow = Insertable<FollowsTable>;

export type UserBlockRow = Selectable<UserBlocksTable>;
export type NewUserBlock = Insertable<UserBlocksTable>;

export type BookmarkCommentRow = Selectable<BookmarkCommentsTable>;
export type NewBookmarkComment = Insertable<BookmarkCommentsTable>;
export type BookmarkCommentUpdate = Updateable<BookmarkCommentsTable>;

export type ContentReportRow = Selectable<ContentReportsTable>;
export type NewContentReport = Insertable<ContentReportsTable>;

export type BookmarkProcessingRun = Selectable<BookmarkProcessingRunsTable>;
export type NewBookmarkProcessingRun = Insertable<BookmarkProcessingRunsTable>;
export type BookmarkProcessingRunUpdate = Updateable<BookmarkProcessingRunsTable>;

export type BookmarkReadingProgressRow =
  Selectable<BookmarkReadingProgressTable>;
export type NewBookmarkReadingProgress =
  Insertable<BookmarkReadingProgressTable>;
export type BookmarkReadingProgressUpdate =
  Updateable<BookmarkReadingProgressTable>;

export type BookmarkHighlightRow = Selectable<BookmarkHighlightsTable>;
export type NewBookmarkHighlight = Insertable<BookmarkHighlightsTable>;
export type BookmarkHighlightUpdate = Updateable<BookmarkHighlightsTable>;

export type BookmarkProcessingEvent = Selectable<BookmarkProcessingEventsTable>;
export type NewBookmarkProcessingEvent =
  Insertable<BookmarkProcessingEventsTable>;
export type BookmarkProcessingEventUpdate =
  Updateable<BookmarkProcessingEventsTable>;
