export { Database, BaseTable } from './schema';
export type {
  CollectionsTable,
  BookmarksTable,
  ProfilesTable,
  ScrapedUrlContentsTable,
  NewCollection,
  CollectionUpdate,
  NewBookmark,
  BookmarkUpdate,
  NewProfile,
  ProfileUpdate,
  NewScrapedUrlContent,
  ScrapedUrlContentUpdate,
  // Comments and reports (D12). Exported because the API's tests build a fake
  // repository against these row shapes, and a fake typed against anything
  // looser would stop catching the drift it exists to catch.
  BookmarkCommentsTable,
  BookmarkCommentRow,
  NewBookmarkComment,
  BookmarkCommentUpdate,
  ContentReportsTable,
  ContentReportRow,
  NewContentReport,
  ContentReportStatus
} from './schema';
export * from './connection';