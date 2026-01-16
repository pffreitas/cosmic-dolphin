export * from "./web-scraping.service";
export * from "./queue.service";
export * from "./bookmark.service";
export * from "./collection.service";
export * from "./bookmark.processor.service";
export * from "./bookmark.categorizer.service";
export * from "./http-client";

import {
  WebScrapingService,
  WebScrapingServiceImpl,
} from "./web-scraping.service";
import { QueueService, QueueServiceImpl } from "./queue.service";
import { BookmarkService, BookmarkServiceImpl } from "./bookmark.service";
import { CollectionService, CollectionServiceImpl } from "./collection.service";
import { SupabaseClient } from "@supabase/supabase-js";
import { Kysely } from "kysely";
import { Database } from "../database/schema";
import {
  BookmarkRepositoryImpl,
  CollectionRepositoryImpl,
} from "../repositories";

export interface ServiceContainer {
  webScraping: WebScrapingService;
  queue: QueueService;
  bookmark: BookmarkService;
  collection: CollectionService;
}

export function createServiceContainer(
  supabaseClient: SupabaseClient,
  db: Kysely<Database>
): ServiceContainer {
  const webScrapingService = new WebScrapingServiceImpl();
  const bookmarkRepository = new BookmarkRepositoryImpl(db);
  const collectionRepository = new CollectionRepositoryImpl(db);

  return {
    webScraping: webScrapingService,
    queue: new QueueServiceImpl(supabaseClient),
    bookmark: new BookmarkServiceImpl(
      bookmarkRepository,
      webScrapingService,
      collectionRepository
    ),
    collection: new CollectionServiceImpl(collectionRepository),
  };
}
