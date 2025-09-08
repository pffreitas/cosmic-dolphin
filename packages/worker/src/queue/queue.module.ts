import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseClientService } from './supabase-client.service';
import { QueueService } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { DefaultMessageHandler } from './handlers/default-message.handler';
import { ExampleTaskHandler } from './handlers/example-task.handler';
import { MessageHandler } from './interfaces/message-handler.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    SupabaseClientService,
    QueueService,
    QueueProcessor,
    DefaultMessageHandler,
    ExampleTaskHandler,
    {
      provide: 'MESSAGE_HANDLERS',
      useFactory: (
        defaultHandler: DefaultMessageHandler,
        exampleHandler: ExampleTaskHandler,
      ): MessageHandler[] => [
        exampleHandler,
        defaultHandler, // Keep default handler last as fallback
      ],
      inject: [DefaultMessageHandler, ExampleTaskHandler],
    },
  ],
  exports: [QueueService, QueueProcessor],
})
export class QueueModule {}