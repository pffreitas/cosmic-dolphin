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
  CollectionServiceImpl,
  WebScrapingServiceImpl,
  BookmarkRepositoryImpl,
  CollectionRepositoryImpl,
  createDatabase,
  Database,
  ContentChunkRepositoryImpl,
} from "@cosmic-dolphin/shared";
import { ConfigService } from "@nestjs/config";
import {
  DATABASE_INSTANCE,
  BOOKMARK_SERVICE,
  COLLECTION_SERVICE,
  BOOKMARK_PROCESSOR_SERVICE,
  WEB_SCRAPING_SERVICE,
} from "./tokens";
import { Kysely } from "kysely";

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
      provide: DATABASE_INSTANCE,
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>("DATABASE_URL");
        if (!databaseUrl) {
          throw new Error("DATABASE_URL is required");
        }
        return createDatabase(databaseUrl);
      },
      inject: [ConfigService],
    },
    {
      provide: BOOKMARK_SERVICE,
      useFactory: (
        db: Kysely<Database>,
        webScrapingService: WebScrapingServiceImpl
      ) => {
        const bookmarkRepository = new BookmarkRepositoryImpl(db);
        return new BookmarkServiceImpl(bookmarkRepository, webScrapingService);
      },
      inject: [DATABASE_INSTANCE, WEB_SCRAPING_SERVICE],
    },
    {
      provide: COLLECTION_SERVICE,
      useFactory: (db: Kysely<Database>) => {
        const collectionRepository = new CollectionRepositoryImpl(db);
        return new CollectionServiceImpl(collectionRepository);
      },
      inject: [DATABASE_INSTANCE],
    },
    {
      provide: BOOKMARK_PROCESSOR_SERVICE,
      useFactory: (
        bookmarkService: BookmarkService,
        ai: AI,
        eventBus: EventBus,
        db: Kysely<Database>
      ) => {
        const contentChunkRepository = new ContentChunkRepositoryImpl(db);
        const collectionRepository = new CollectionRepositoryImpl(db);
        return new BookmarkProcessorServiceImpl(
          bookmarkService,
          contentChunkRepository,
          collectionRepository,
          ai,
          eventBus
        );
      },
      inject: [BOOKMARK_SERVICE, AI, EventBus, DATABASE_INSTANCE],
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
