import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksProcessor } from './tasks.processor';

@Module({
  providers: [TasksService, TasksProcessor],
  exports: [TasksService],
})
export class TasksModule {}