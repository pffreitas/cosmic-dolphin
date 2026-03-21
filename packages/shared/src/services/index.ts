export * from "./web-scraping.service";
export * from "./youtube.service";
export * from "./queue.service";
export * from "./bookmark.service";
export * from "./bookmark-like.service";
export * from "./collection.service";
export * from "./profile.service";
export * from "./bookmark.processor.service";
export * from "./bookmark.categorizer.service";
export * from "./chunking.service";
export * from "./embedding.service";
export * from "./search.service";
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
import { EmbeddingServiceImpl } from "./embedding.service";
import { SupabaseClient } from "@supabase/supabase-js";
import { Kysely } from "kysely";
import { Database } from "../database/schema";
import {
  BookmarkRepositoryImpl,
  BookmarkLikeRepositoryImpl,
  CollectionRepositoryImpl,
  ProfileRepositoryImpl,
} from "../repositories";
import { AI } from "../ai";
import { EventBus } from "../ai/bus";

export interface ServiceContainer {
  webScraping: WebScrapingService;
  queue: QueueService;
  bookmark: BookmarkService;
  bookmarkLike: BookmarkLikeService;
  collection: CollectionService;
  profile: ProfileService;
  search: SearchService;
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

  const eventBus = new EventBus(supabaseClient);
  const ai = new AI(eventBus);
  const embeddingService = new EmbeddingServiceImpl();

  return {
    webScraping: webScrapingService,
    queue: new QueueServiceImpl(supabaseClient),
    bookmark: new BookmarkServiceImpl(
      bookmarkRepository,
      webScrapingService,
      collectionRepository,
      ai
    ),
    bookmarkLike: new BookmarkLikeServiceImpl(bookmarkLikeRepository),
    collection: new CollectionServiceImpl(collectionRepository),
    profile: new ProfileServiceImpl(profileRepository),
    search: new SearchServiceImpl(bookmarkRepository, embeddingService, ai),
  };
}
