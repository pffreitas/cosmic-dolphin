import { Injectable, Logger } from '@nestjs/common';
import { MessageHandler } from '../interfaces/message-handler.interface';
import { QueueMessage } from '../../types/queue.types';

@Injectable()
export class ExampleTaskHandler implements MessageHandler {
  private readonly logger = new Logger(ExampleTaskHandler.name);

  canHandle(messageType: string): boolean {
    return messageType === 'example_task' || messageType === 'process_file';
  }

  async handle(message: QueueMessage): Promise<void> {
    this.logger.log(`Processing example task`, {
      msg_id: message.msg_id,
      message_type: message.message?.type,
    });

    try {
      // Simulate some work
      await this.processTask(message.message);
      
      this.logger.log(`Successfully processed example task ${message.msg_id}`);
    } catch (error) {
      this.logger.error(`Failed to process example task ${message.msg_id}`, error);
      throw error;
    }
  }

  getMessageType(): string {
    return 'example_task';
  }

  private async processTask(payload: any): Promise<void> {
    // Example task processing logic
    this.logger.debug('Processing task payload', payload);
    
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add your actual task processing logic here
    if (payload?.action === 'process_file') {
      await this.processFile(payload.filename);
    } else if (payload?.action === 'send_notification') {
      await this.sendNotification(payload.recipient, payload.message);
    }
  }

  private async processFile(filename: string): Promise<void> {
    this.logger.debug(`Processing file: ${filename}`);
    // Add file processing logic here
  }

  private async sendNotification(recipient: string, message: string): Promise<void> {
    this.logger.debug(`Sending notification to ${recipient}: ${message}`);
    // Add notification sending logic here
  }
}