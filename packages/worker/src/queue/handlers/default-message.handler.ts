import { Injectable, Logger } from '@nestjs/common';
import { MessageHandler } from '../interfaces/message-handler.interface';
import { QueueMessage } from '../../types/queue.types';

@Injectable()
export class DefaultMessageHandler implements MessageHandler {
  private readonly logger = new Logger(DefaultMessageHandler.name);

  canHandle(_messageType: string): boolean {
    return true; // Fallback handler for all unrecognized message types
  }

  async handle(message: QueueMessage): Promise<void> {
    this.logger.warn(`No specific handler found for message`, {
      msg_id: message.msg_id,
      message_type: message.message?.type || 'unknown',
      message: message.message,
    });

    // Just log the message for debugging purposes
    this.logger.debug('Processing unknown message type', {
      msg_id: message.msg_id,
      payload: message.message,
    });
  }

  getMessageType(): string {
    return 'default';
  }
}