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
}

export function createServiceContainer(
  supabaseClient: SupabaseClient,
  db: Kysely<Database>
): ServiceContainer {
  const webScrapingService = new WebScrapingServiceImpl();
  const bookmarkRepository = new BookmarkRepositoryImpl(db);
  const bookmarkLikeRepository = new BookmarkLikeRepositoryImpl(db);
  const collectionRepository = new CollectionRepositoryImpl(db);
  const profileRepository = new ProfileRepositoryImpl(db);
  const bookmarkProcessingRepository = new BookmarkProcessingRepositoryImpl(db);
  const bookmarkReadingRepository = new BookmarkReadingRepositoryImpl(db);

  const ai = new AI();
  const embeddingService = new EmbeddingServiceImpl();

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
    search: new SearchServiceImpl(bookmarkRepository, embeddingService, ai),
    bookmarkProcessing: bookmarkProcessingRepository,
    processingBudget: new ProcessingBudgetServiceImpl(
      bookmarkProcessingRepository
    ),
    reading: new ReadingServiceImpl(bookmarkReadingRepository),
  };
}
