import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TasksService {
  constructor(@InjectQueue('tasks') private tasksQueue: Queue) {}

  async addExampleTask(data: any) {
    const job = await this.tasksQueue.add('example-task', data);
    return job.id;
  }
}