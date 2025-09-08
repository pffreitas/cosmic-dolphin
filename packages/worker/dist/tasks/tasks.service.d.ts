import { Queue } from 'bullmq';
export declare class TasksService {
    private tasksQueue;
    constructor(tasksQueue: Queue);
    addExampleTask(data: any): Promise<string>;
}
