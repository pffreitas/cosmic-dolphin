export * from "./web-scraping.service";
export * from "./youtube.service";
export * from "./queue.service";
export * from "./bookmark.service";
export * from "./bookmark-like.service";
export * from "./collection.service";
export * from "./profile.service";
export * from "./bookmark.processor.service";
export * from "./bookmark.filing.service";
export * from "./bookmark-processing-reporter.service";
export * from "./processing-budget.service";
export * from "./bookmark.model-ids";
export * from "./chunking.service";
export * from "./embedding.service";
export * from "./search.service";
export * from "./reading.service";
export * from "./social.service";
export * from "./explore.service";
export * from "./comment.service";
export * from "./digest.config";
export * from "./digest.prompt";
export * from "./digest.service";
export * from "./feed-ranking.config";
export * from "./feed-ranking.service";
export * from "./http-client";

import {
  WebScrapingService,
  WebScrapingServiceImpl,
} from "./web-scraping.service";
import { QueueService, QueueServiceImpl } from "./queue.service";
import { BookmarkService, BookmarkServiceImpl } from "./bookmark.service";
import {
  BookmarkLikeService,
  BookmarkLikeServiceImpl,
} from "./bookmark-like.service";
import { CollectionService, CollectionServiceImpl } from "./collection.service";
import { ProfileService, ProfileServiceImpl } from "./profile.service";
import { SearchService, SearchServiceImpl } from "./search.service";
import { ReadingService, ReadingServiceImpl } from "./reading.service";
import { SocialService, SocialServiceImpl } from "./social.service";
import { ExploreService, ExploreServiceImpl } from "./explore.service";
import { CommentService, CommentServiceImpl } from "./comment.service";
import {
  FeedRankingService,
  FeedRankingServiceImpl,
} from "./feed-ranking.service";
import { DigestService, DigestServiceImpl } from "./digest.service";
import {
  ProcessingBudgetService,
  ProcessingBudgetServiceImpl,
} from "./processing-budget.service";
import { EmbeddingServiceImpl } from "./embedding.service";
import { SupabaseClient } from "@supabase/supabase-js";
import { Kysely } from "kysely";
import { Database } from "../database/schema";
import {
  BookmarkRepositoryImpl,
  BookmarkLikeRepositoryImpl,
  CollectionRepositoryImpl,
  ProfileRepositoryImpl,
  BookmarkProcessingRepository,
  BookmarkProcessingRepositoryImpl,
  BookmarkReadingRepositoryImpl,
  SocialRepositoryImpl,
  CommentRepositoryImpl,
  DigestRepositoryImpl,
  FeedRepositoryImpl,
  ExploreRepositoryImpl,
} from "../repositories";
import { AI } from "../ai";

export interface ServiceContainer {
  webScraping: WebScrapingService;
  queue: QueueService;
  bookmark: BookmarkService;
  bookmarkLike: BookmarkLikeService;
  collection: CollectionService;
  profile: ProfileService;
  search: SearchService;
  bookmarkProcessing: BookmarkProcessingRepository;
  processingBudget: ProcessingBudgetService;
  reading: ReadingService;
  social: SocialService;
  comment: CommentService;
  feed: FeedRankingService;
  digest: DigestService;
  explore: ExploreService;
}

/**
 * @param environment Which `feed_ranking_config` row the ranker reads its
 *   weight overrides from. One row per environment, so staging can be tuned
 *   without moving production — see `docs/functional-spec/05-feed.md`.
 */
export function createServiceContainer(
  supabaseClient: SupabaseClient,
  db: Kysely<Database>,
  environment: string = process.env.NODE_ENV ?? "development"
): ServiceContainer {
  const webScrapingService = new WebScrapingServiceImpl();
  const bookmarkRepository = new BookmarkRepositoryImpl(db);
  const bookmarkLikeRepository = new BookmarkLikeRepositoryImpl(db);
  const collectionRepository = new CollectionRepositoryImpl(db);
  const profileRepository = new ProfileRepositoryImpl(db);
  const bookmarkProcessingRepository = new BookmarkProcessingRepositoryImpl(db);
  const bookmarkReadingRepository = new BookmarkReadingRepositoryImpl(db);
  const socialRepository = new SocialRepositoryImpl(db);
  const commentRepository = new CommentRepositoryImpl(db);
  const feedRepository = new FeedRepositoryImpl(db);
  const digestRepository = new DigestRepositoryImpl(db);
  const exploreRepository = new ExploreRepositoryImpl(db);

  const ai = new AI();
  const embeddingService = new EmbeddingServiceImpl();

  const socialService = new SocialServiceImpl(socialRepository);

  const bookmarkService = new BookmarkServiceImpl(
    bookmarkRepository,
    webScrapingService,
    collectionRepository
  );

  return {
    webScraping: webScrapingService,
    queue: new QueueServiceImpl(supabaseClient),
    bookmark: bookmarkService,
    bookmarkLike: new BookmarkLikeServiceImpl(bookmarkLikeRepository),
    // Accepting a collection suggestion creates the collection *and* moves its
    // supporting bookmarks, so the collection service needs the bookmark
    // service's guarded filing write.
    collection: new CollectionServiceImpl(collectionRepository, bookmarkService),
    profile: new ProfileServiceImpl(profileRepository),
    // The collection repository is what lets a search result carry the same
    // breadcrumb the Library row does — without it every hit reads "Inbox".
    search: new SearchServiceImpl(
      bookmarkRepository,
      embeddingService,
      ai,
      collectionRepository
    ),
    bookmarkProcessing: bookmarkProcessingRepository,
    processingBudget: new ProcessingBudgetServiceImpl(
      bookmarkProcessingRepository
    ),
    reading: new ReadingServiceImpl(bookmarkReadingRepository),
    social: socialService,
    comment: new CommentServiceImpl(commentRepository),
    // The ranker asks the social graph about each distinct author it got back,
    // once per author rather than once per item — so it takes the service, not
    // a second copy of the repository.
    feed: new FeedRankingServiceImpl(
      feedRepository,
      socialService,
      environment
    ),
    // The generation half of this service runs in the worker; the API only
    // ever reaches its read, like and share paths. Same object either way —
    // the AI call lives in `packages/shared`, never in an app.
    digest: new DigestServiceImpl(digestRepository, ai),
    // No social service and no ranker: Explore ranks over public rows with a
    // block filter of its own, and hands nothing to the personalised path.
    explore: new ExploreServiceImpl(exploreRepository),
  };
}
