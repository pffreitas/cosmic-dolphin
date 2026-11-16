import { QueueMessage } from "../../types/queue.types";

export interface MessageContext {
  /** No delivery is left after this one: a failure is terminal. */
  finalAttempt: boolean;
}

export interface MessageHandler {
  canHandle(messageType: string): boolean;
  handle(
    message: QueueMessage,
    context?: MessageContext,
  ): Promise<void>;
  /**
   * Called instead of `handle` when the message has been delivered more times
   * than the retry limit allows. The processor archives it afterwards, unless
   * this throws: then the message is left for redelivery.
   */
  onExhausted?(message: QueueMessage): Promise<void>;
  getMessageType(): string;
}
