import { QueueMessage } from "../../types/queue.types";

export interface MessageHandler {
  canHandle(messageType: string): boolean;
  handle(message: QueueMessage): Promise<void>;
  getMessageType(): string;
}
