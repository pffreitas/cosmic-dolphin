import { QueueTaskPayload, BookmarkQueuePayload } from '../types';

export interface QueueService {
  sendMessage<T extends QueueTaskPayload>(queueName: string, payload: T, delay?: number): Promise<void>;
  sendBookmarkProcessingMessage(bookmarkId: string, sourceUrl: string, userId: string, collectionId?: string): Promise<void>;
}

export class QueueServiceImpl implements QueueService {
  constructor(private supabaseClient: any) {}

  async sendMessage<T extends QueueTaskPayload>(queueName: string, payload: T, delay: number = 0): Promise<void> {
    const { error } = await this.supabaseClient.rpc('pgmq_send', {
      queue_name: queueName,
      msg: payload,
      delay,
    });

    if (error) {
      throw new Error(`Failed to post to queue ${queueName}: ${error.message}`);
    }
  }

  async sendBookmarkProcessingMessage(
    bookmarkId: string,
    sourceUrl: string,
    userId: string,
    collectionId?: string
  ): Promise<void> {
    const payload: BookmarkQueuePayload = {
      type: 'bookmark_process',
      data: {
        bookmarkId,
        sourceUrl,
        userId,
        collectionId,
      },
      metadata: {
        source: 'api',
        priority: 'medium',
      },
    };

    await this.sendMessage('bookmarks', payload);
  }
}