import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseClientService } from "./supabase-client.service";
import { QueueService } from "./queue.service";
import { QueueProcessor } from "./queue.processor";
import { DefaultMessageHandler } from "./handlers/default-message.handler";
import { BookmarkProcessorHandler } from "./handlers/bookmark-processor.handler";
import { MessageHandler } from "./interfaces/message-handler.interface";

@Module({
  imports: [ConfigModule],
  providers: [
    SupabaseClientService,
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
