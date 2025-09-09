import { Injectable, Logger } from '@nestjs/common';
import { MessageHandler } from '../interfaces/message-handler.interface';
import { QueueMessage } from '../../types/queue.types';
import { SupabaseClientService } from '../supabase-client.service';
import { BookmarkQueuePayload } from '@cosmic-dolphin/shared';

@Injectable()
export class BookmarkProcessorHandler implements MessageHandler {
  private readonly logger = new Logger(BookmarkProcessorHandler.name);

  constructor(private readonly supabaseClient: SupabaseClientService) {}

  canHandle(messageType: string): boolean {
    return messageType === 'bookmark_process';
  }

  async handle(message: QueueMessage): Promise<void> {
    this.logger.log(`Processing bookmark`, {
      msg_id: message.msg_id,
      message_type: message.message?.type,
    });

    try {
      const payload = message.message as BookmarkQueuePayload;
      
      if (!payload || !payload.data) {
        throw new Error('Invalid bookmark payload');
      }

      await this.processBookmark(payload);
      
      this.logger.log(`Successfully processed bookmark ${message.msg_id}`, {
        bookmarkId: payload.data.bookmarkId,
        userId: payload.data.userId,
      });
    } catch (error) {
      this.logger.error(`Failed to process bookmark ${message.msg_id}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        message: message.message,
      });
      throw error;
    }
  }

  getMessageType(): string {
    return 'bookmark_process';
  }

  private async processBookmark(payload: BookmarkQueuePayload): Promise<void> {
    const { bookmarkId, sourceUrl, userId, collectionId } = payload.data;

    this.logger.debug('Processing bookmark payload', {
      bookmarkId,
      sourceUrl,
      userId,
      collectionId,
    });

    // Get the current bookmark from database
    const { data: bookmark, error: fetchError } = await this.supabaseClient
      .getClient()
      .from('bookmarks')
      .select('*')
      .eq('id', bookmarkId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch bookmark: ${fetchError.message}`);
    }

    if (!bookmark) {
      throw new Error(`Bookmark not found: ${bookmarkId}`);
    }

    // Here we would add enhanced processing logic in the future:
    // 1. Full content extraction using readability algorithms
    // 2. Text summarization using LLM integration
    // 3. Automatic tag suggestion based on content
    // 4. Content archiving for offline access
    // 5. Image and asset archiving

    // For now, we'll just log that processing is complete
    // and could update a processing status field if it existed
    this.logger.debug('Bookmark processing completed', {
      bookmarkId,
      title: bookmark.title,
      url: bookmark.source_url,
    });

    // Example: Update bookmark with processing completion timestamp
    // This is optional and shows how we might track processing status
    const { error: updateError } = await this.supabaseClient
      .getClient()
      .from('bookmarks')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookmarkId);

    if (updateError) {
      this.logger.warn('Failed to update bookmark timestamp', {
        bookmarkId,
        error: updateError.message,
      });
      // Don't throw here as this is not critical
    }

    // Future enhancements could include:
    // - Extracting full page content with readability algorithms
    // - Generating AI summaries of the content
    // - Suggesting tags based on content analysis
    // - Archiving images and other assets
    // - Checking for broken links periodically
    // - Generating thumbnails or previews
  }
}