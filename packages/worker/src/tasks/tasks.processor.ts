import { Injectable } from '@nestjs/common';

@Injectable()
export class TasksProcessor {
  async processExampleTask(data: any): Promise<any> {
    console.log('Processing example task:', data);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Example task completed');
    return { processed: true, data };
  }
}