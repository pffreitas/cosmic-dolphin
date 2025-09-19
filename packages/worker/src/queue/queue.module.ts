import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseClientService } from "./supabase-client.service";
import { QueueService } from "./queue.service";
import { QueueProcessor } from "./queue.processor";
import { DefaultMessageHandler } from "./handlers/default-message.handler";
import { BookmarkProcessorHandler } from "./handlers/bookmark-processor.handler";
import { MessageHandler } from "./interfaces/message-handler.interface";
import {
  AI,
  EventBus,
  BookmarkProcessorServiceImpl,
  BookmarkServiceImpl,
  BookmarkService,
  WebScrapingServiceImpl,
} from "@cosmic-dolphin/shared";
import {
  BOOKMARK_SERVICE,
  BOOKMARK_PROCESSOR_SERVICE,
  WEB_SCRAPING_SERVICE,
} from "./tokens";

@Module({
  imports: [ConfigModule],
  providers: [
    SupabaseClientService,
    {
      provide: EventBus,
      useFactory: (supabaseClient: SupabaseClientService) =>
        new EventBus(supabaseClient.getClient()),
      inject: [SupabaseClientService],
    },
    {
      provide: AI,
      useFactory: (eventBus: EventBus) => new AI(eventBus),
      inject: [EventBus],
    },
    {
      provide: BOOKMARK_SERVICE,
      useFactory: (
        supabaseClient: SupabaseClientService,
        webScrapingService: WebScrapingServiceImpl
      ) =>
        new BookmarkServiceImpl(supabaseClient.getClient(), webScrapingService),
      inject: [SupabaseClientService, WEB_SCRAPING_SERVICE],
    },
    {
      provide: BOOKMARK_PROCESSOR_SERVICE,
      useFactory: (
        bookmarkService: BookmarkService,
        ai: AI,
        eventBus: EventBus
      ) => new BookmarkProcessorServiceImpl(bookmarkService, ai, eventBus),
      inject: [BOOKMARK_SERVICE, AI, EventBus],
    },
    {
      provide: WEB_SCRAPING_SERVICE,
      useFactory: () => new WebScrapingServiceImpl(),
    },
    QueueService,
    QueueProcessor,
    DefaultMessageHandler,
    BookmarkProcessorHandler,
    {
      provide: "MESSAGE_HANDLERS",
      useFactory: (
        defaultHandler: DefaultMessageHandler,
        bookmarkHandler: BookmarkProcessorHandler
      ): MessageHandler[] => [
        bookmarkHandler,
        defaultHandler, // Keep default handler last as fallback
      ],
      inject: [DefaultMessageHandler, BookmarkProcessorHandler],
    },
  ],
  exports: [QueueService, QueueProcessor],
})
export class QueueModule {}
