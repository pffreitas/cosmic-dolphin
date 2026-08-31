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
  ContentReportStatus,
  // Feed impressions and digests (D14, D15). Exported for the same reason as
  // the comment rows above: the API's tests build fakes against these shapes,
  // and a fake typed against anything looser stops catching drift.
  FeedImpressionsTable,
  FeedImpressionRow,
  FeedImpressionItemType,
  FeedDigestsTable,
  FeedDigestRow,
  NewFeedDigest,
  FeedDigestUpdate,
  FeedDigestLikesTable,
  FeedDigestLikeRow
} from './schema';
export * from './connection';