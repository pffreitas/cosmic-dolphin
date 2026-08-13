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
  BookmarkProcessingRepositoryImpl,
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
      provide: AI,
      useFactory: () => new AI(),
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
        webScrapingService: WebScrapingServiceImpl,
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
        db: Kysely<Database>,
      ) => {
        const contentChunkRepository = new ContentChunkRepositoryImpl(db);
        const collectionRepository = new CollectionRepositoryImpl(db);
        const bookmarkProcessingRepository =
          new BookmarkProcessingRepositoryImpl(db);
        return new BookmarkProcessorServiceImpl(
          bookmarkService,
          contentChunkRepository,
          collectionRepository,
          ai,
          bookmarkProcessingRepository,
        );
      },
      inject: [BOOKMARK_SERVICE, AI, DATABASE_INSTANCE],
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
        bookmarkHandler: BookmarkProcessorHandler,
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
