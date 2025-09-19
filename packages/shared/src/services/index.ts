export * from "./web-scraping.service";
export * from "./queue.service";
export * from "./bookmark.service";
export * from "./collection.service";
export * from "./bookmark.processor.service";

import {
  WebScrapingService,
  WebScrapingServiceImpl,
} from "./web-scraping.service";
import { QueueService, QueueServiceImpl } from "./queue.service";
import { BookmarkService, BookmarkServiceImpl } from "./bookmark.service";
import { CollectionService, CollectionServiceImpl } from "./collection.service";
import { BookmarkProcessorService, BookmarkProcessorServiceImpl } from "./bookmark.processor.service";
import { SupabaseClient } from "@supabase/supabase-js";

export interface ServiceContainer {
  webScraping: WebScrapingService;
  queue: QueueService;
  bookmark: BookmarkService;
  collection: CollectionService;
}

export function createServiceContainer(
  supabaseClient: SupabaseClient
): ServiceContainer {
  return {
    webScraping: new WebScrapingServiceImpl(),
    queue: new QueueServiceImpl(supabaseClient),
    bookmark: new BookmarkServiceImpl(supabaseClient),
    collection: new CollectionServiceImpl(supabaseClient),
  };
}
