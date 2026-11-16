import type { Kysely } from "kysely";
import type { Database } from "@cosmic-dolphin/shared";
import { QueueMessage } from "../../types/queue.types";

export interface MessageContext {
  /** No delivery is left after this one: a failure is terminal. */
  finalAttempt: boolean;
  /**
   * Aborted when the worker stops waiting for this run at shutdown. The handler
   * passes it down so the run ends instead of lingering past its message.
   */
  signal: AbortSignal;
  /**
   * Delete or archive this message on `transaction`: the handler calls it inside
   * the transaction that writes the run's terminal state, so the two commit
   * together. Once it has run, the processor does not dispose of the message
   * again. Rejects when the message was already released at shutdown.
   *
   * A failure that reaches the processor is treated as not committed unless the
   * handler's error carries `terminalPersisted: true`; a normal return counts
   * as committed.
   */
  dispose: (
    transaction: Kysely<Database>,
    how: "delete" | "archive",
  ) => Promise<void>;
}

export interface MessageHandler {
  canHandle(messageType: string): boolean;
  handle(
    message: QueueMessage,
    context?: MessageContext,
  ): Promise<void>;
  /**
   * Called instead of `handle` when the message has been delivered more times
   * than the retry limit allows. The processor archives it afterwards (unless
   * `context.dispose` already did, in the handler's transaction), or leaves it
   * for redelivery when this throws.
   */
  onExhausted?(
    message: QueueMessage,
    context?: Pick<MessageContext, "dispose">,
  ): Promise<void>;
  /**
   * The handler writes the message's terminal state and disposes of the message
   * in one transaction. The processor then never archives a failed message by
   * itself: only that transaction's commit does, so any other failure keeps the
   * message for redelivery.
   */
  readonly ownsTerminalState?: boolean;
  getMessageType(): string;
}
