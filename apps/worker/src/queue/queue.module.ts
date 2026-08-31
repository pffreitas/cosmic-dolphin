import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseClientService } from "./supabase-client.service";
import { QueueService } from "./queue.service";
import { QueueProcessor } from "./queue.processor";
import { DefaultMessageHandler } from "./handlers/default-message.handler";
import { BookmarkProcessorHandler } from "./handlers/bookmark-processor.handler";
import { DigestGeneratorHandler } from "./handlers/digest-generator.handler";
import { DigestSchedulerService } from "../digest/digest-scheduler.service";
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
  DigestRepository,
  DigestRepositoryImpl,
  DigestServiceImpl,
} from "@cosmic-dolphin/shared";
import { ConfigService } from "@nestjs/config";
import {
  DATABASE_INSTANCE,
  BOOKMARK_SERVICE,
  COLLECTION_SERVICE,
  BOOKMARK_PROCESSOR_SERVICE,
  WEB_SCRAPING_SERVICE,
  DIGEST_REPOSITORY,
  DIGEST_SERVICE,
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
      useFactory: (db: Kysely<Database>, bookmarkService: BookmarkService) => {
        const collectionRepository = new CollectionRepositoryImpl(db);
        return new CollectionServiceImpl(collectionRepository, bookmarkService);
      },
      inject: [DATABASE_INSTANCE, BOOKMARK_SERVICE],
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
    // Digests. The repository is provided on its own because the scheduler
    // needs it without needing the service: a tick decides *who* gets a job,
    // and only the handler decides what is in one.
    {
      provide: DIGEST_REPOSITORY,
      useFactory: (db: Kysely<Database>) => new DigestRepositoryImpl(db),
      inject: [DATABASE_INSTANCE],
    },
    {
      provide: DIGEST_SERVICE,
      useFactory: (digestRepository: DigestRepository, ai: AI) =>
        new DigestServiceImpl(digestRepository, ai),
      inject: [DIGEST_REPOSITORY, AI],
    },
    DigestSchedulerService,
    QueueService,
    QueueProcessor,
    DefaultMessageHandler,
    BookmarkProcessorHandler,
    DigestGeneratorHandler,
    {
      provide: "MESSAGE_HANDLERS",
      useFactory: (
        defaultHandler: DefaultMessageHandler,
        bookmarkHandler: BookmarkProcessorHandler,
        digestHandler: DigestGeneratorHandler,
      ): MessageHandler[] => [
        bookmarkHandler,
        digestHandler,
        defaultHandler, // Keep default handler last as fallback
      ],
      inject: [
        DefaultMessageHandler,
        BookmarkProcessorHandler,
        DigestGeneratorHandler,
      ],
    },
  ],
  exports: [QueueService, QueueProcessor, DigestSchedulerService],
})
export class QueueModule {}
