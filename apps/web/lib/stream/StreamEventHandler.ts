import { StreamEventRegistry } from "./StreamEventRegistry";
import { StreamEvent, StreamState } from "./types";
import { SSEParser, createStreamParser } from "./parsers";

export interface StreamHandlerOptions {
  /** Custom event registry to use */
  registry?: StreamEventRegistry;
  /** Maximum number of retry attempts for failed connections */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay?: number;
  /** Custom SSE parser options */
  parserOptions?: {
    maxBufferSize?: number;
    addTimestamps?: boolean;
  };
}

export class StreamEventHandler {
  private registry: StreamEventRegistry;
  private options: StreamHandlerOptions;
  private retryCount: number = 0;

  constructor(options: StreamHandlerOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };

    // Use provided registry or create a new one with default handlers
    this.registry = options.registry || new StreamEventRegistry();
    if (!options.registry) {
      this.registry.registerDefaultHandlers();
    }
  }

  /**
   * Process a single stream event
   */
  processEvent(event: StreamEvent, state: StreamState): void {
    try {
      this.registry.process(event, state);
    } catch (error) {
      console.error("Error processing stream event:", error, event);

      // Update stream state with error
      state.streamError =
        error instanceof Error
          ? error.message
          : "Unknown error processing stream event";
    }
  }

  /**
   * Handle a streaming response using the fetch API
   */
  async handleStreamResponse(
    response: Response,
    onStateUpdate: (state: StreamState) => void,
    initialState?: Partial<StreamState>
  ): Promise<void> {
    // Initialize state
    const state: StreamState = {
      isStreaming: true,
      streamStatus: "Processing your request...",
      streamError: null,
      streamingTokens: [],
      streamingTasks: [],
      ...initialState,
    };

    // Update initial state
    onStateUpdate(state);

    try {
      await createStreamParser(response, (event) =>
        this.processEvent(event, state)
      );

      // Mark streaming as complete
      state.isStreaming = false;
      state.streamStatus = "";
      onStateUpdate(state);
    } catch (error) {
      console.error("Stream processing error:", error);

      // Handle retry logic
      if (this.retryCount < (this.options.maxRetries || 3)) {
        this.retryCount++;
        console.log(`Retrying stream connection (attempt ${this.retryCount})`);

        // Update state to show retry
        state.streamStatus = `Retrying connection (${this.retryCount}/${this.options.maxRetries})...`;
        onStateUpdate(state);

        // Wait before retry
        await this.delay(this.options.retryDelay || 1000);

        // Note: In a real implementation, you would retry the entire request
        // This is just updating the state to indicate retry attempt
        throw error; // Re-throw to let caller handle retry
      } else {
        // Max retries exceeded
        state.isStreaming = false;
        state.streamError =
          error instanceof Error ? error.message : "Failed to stream data";
        state.streamStatus = "";
        onStateUpdate(state);
      }
    }
  }

  /**
   * Register a custom event handler
   */
  registerHandler<T extends StreamEvent>(
    eventType: T["event"],
    handler: (event: T, state: StreamState) => void
  ): void {
    this.registry.register(eventType, handler);
  }

  /**
   * Get the event registry
   */
  getRegistry(): StreamEventRegistry {
    return this.registry;
  }

  /**
   * Reset retry count
   */
  resetRetries(): void {
    this.retryCount = 0;
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Utility method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a Redux-compatible event processor
   * Returns a function that can be used directly in Redux actions
   */
  createReduxProcessor(): (event: StreamEvent, state: any) => void {
    return (event: StreamEvent, state: any) => {
      this.processEvent(event, state);
    };
  }

  /**
   * Create a streaming thunk helper for Redux
   */
  createStreamingThunk<T extends { accessToken: string }>(
    streamFunction: (params: T) => Promise<Response>
  ) {
    return async (
      params: T,
      dispatch: (action: any) => void,
      getState: () => any
    ): Promise<{ success: boolean }> => {
      try {
        this.resetRetries();
        const response = await streamFunction(params);

        await this.handleStreamResponse(response, (state) => {
          // Dispatch state updates to Redux
          // Note: This would need to be adapted to your specific Redux actions
          dispatch({ type: "stream/stateUpdate", payload: state });
        });

        return { success: true };
      } catch (error) {
        console.error("Streaming thunk error:", error);
        dispatch({
          type: "stream/error",
          payload: error instanceof Error ? error.message : "Streaming failed",
        });
        return { success: false };
      }
    };
  }
}
