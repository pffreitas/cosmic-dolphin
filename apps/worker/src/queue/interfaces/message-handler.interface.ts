import { QueueMessage } from "../../types/queue.types";

export interface MessageHandler {
  canHandle(messageType: string): boolean;
  handle(message: QueueMessage): Promise<void>;
  /**
   * Called instead of `handle` when the message has been delivered more times
   * than the retry limit allows. The processor archives it afterwards.
   */
  onExhausted?(message: QueueMessage): Promise<void>;
  getMessageType(): string;
}
