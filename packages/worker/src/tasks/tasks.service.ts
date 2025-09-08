import { Injectable } from '@nestjs/common';

@Injectable()
export class TasksService {
  async addExampleTask(data: any) {
    console.log('Processing example task with data:', data);
    return Date.now().toString();
  }
}