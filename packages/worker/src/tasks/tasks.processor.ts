import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('tasks')
export class TasksProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'example-task':
        return this.handleExampleTask(job.data);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async handleExampleTask(data: any) {
    console.log('Processing example task:', data);
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Example task completed');
    return { processed: true, data };
  }
}