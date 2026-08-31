import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { QueueModule } from "./queue/queue.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // The worker's only scheduler, and it exists for one job: the per-user
    // digest tick. It enqueues onto pgmq and does no work itself, so the
    // execution path stays the poll loop it has always been.
    ScheduleModule.forRoot(),
    QueueModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
