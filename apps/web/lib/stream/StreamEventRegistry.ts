import {
  StreamEvent,
  StreamEventHandlerFunction,
  StreamEventHandlerRegistry,
  StreamingTask,
  StreamProgressDetail,
} from "./types";

export class StreamEventRegistry {
  private handlers: StreamEventHandlerRegistry = {};

  /**
   * Register a handler for a specific event type
   */
  register<T extends StreamEvent>(
    eventType: T["event"],
    handler: StreamEventHandlerFunction<T>
  ): void {
    this.handlers[eventType] = handler as StreamEventHandlerFunction;
  }

  /**
   * Process an event using the registered handler
   */
  process(event: StreamEvent, state: any): void {
    const handler = this.handlers[event.event];
    if (handler) {
      handler(event, state);
    }
  }

  /**
   * Get all registered event types
   */
  getRegisteredEvents(): string[] {
    return Object.keys(this.handlers);
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers = {};
  }

  /**
   * Register default handlers for common stream events
   */
  registerDefaultHandlers(): void {
    // Note updated handler
    this.register("note_updated", (_event, _state) => {
      // Currently no-op, but can be extended
    });

    // Pipeline status handler
    this.register("pipeline_status", (event, state) => {
      state.streamStatus = event.status || "Processing...";
    });

    // Pipeline complete handler
    this.register("pipeline_complete", (_event, state) => {
      state.streamStatus = "Processing complete";
    });

    // Content streaming handler
    this.register("content", (event, state) => {
      if (event.data) {
        state.streamingTokens.push(event.data);
      }
    });

    // Task start handler
    this.register("task_start", (event, state) => {
      let taskId: string | null = null;
      let taskName: string | undefined = undefined;
      let metadata: Record<string, any> | undefined = undefined;

      // Handle both possible data structures
      if (typeof event.data === "string") {
        // Case: data is directly the task_id string
        taskId = event.data;
      } else if (event.data?.task_id) {
        // Case: data is an object with task_id property
        taskId = event.data.task_id;
        taskName = event.data.task_name;
        metadata = event.data.metadata;
      }

      if (taskId) {
        const task: StreamingTask = {
          id: taskId,
          status: "Running",
          name: taskName || taskId,
          startTime: event.timestamp || Date.now(),
          metadata: metadata,
          progressDetails: [],
        };
        state.streamingTasks.push(task);
        // Force immutable update to ensure React detects the change
        state.streamingTasks = [...state.streamingTasks];
      }
    });

    // Task complete handler
    this.register("task_complete", (event, state) => {
      let taskId: string | null = null;

      // Handle both possible data structures
      if (typeof event.data === "string") {
        taskId = event.data;
      } else if (event.data?.task_id) {
        taskId = event.data.task_id;
      }

      if (taskId) {
        const task = state.streamingTasks.find(
          (t: StreamingTask) => t.id === taskId
        );
        if (task) {
          const currentTime = event.timestamp || Date.now();
          const taskDuration = currentTime - (task.startTime || currentTime);

          // Mark task as completed immediately but add metadata for fast tasks
          task.status = "Completed";
          task.endTime = currentTime;

          // Force immutable update to ensure React detects the change
          state.streamingTasks = [...state.streamingTasks];

          // For very fast tasks, add a flag to help with debugging
          if (taskDuration < 100) {
            task.metadata = {
              ...task.metadata,
              fastCompletion: true,
              duration: taskDuration,
            };
          }
        }
      }
    });

    // Task error handler
    this.register("task_error", (event, state) => {
      let taskId: string | null = null;
      let errorMessage: string | undefined = undefined;

      // Handle both possible data structures
      if (typeof event.data === "string") {
        taskId = event.data;
      } else if (event.data?.task_id) {
        taskId = event.data.task_id;
        errorMessage = event.data.error;
      }

      if (taskId) {
        const task = state.streamingTasks.find(
          (t: StreamingTask) => t.id === taskId
        );
        if (task) {
          task.status = "Error";
          task.endTime = event.timestamp || Date.now();
          task.error = errorMessage || "Task failed";
        }
      }
    });

    // Tool call handler - adds progress detail to most recent running task
    this.register("tool_call", (event, state) => {
      const task = this.findMostRecentRunningTask(state);

      if (task && event.data?.tool_name) {
        const progressDetail: StreamProgressDetail = {
          id: event.data.call_id || `tool_call_${Date.now()}`,
          type: "tool_call",
          timestamp: event.timestamp || Date.now(),
          data: {
            tool_name: event.data.tool_name,
            parameters: event.data.parameters,
          },
          message: `Calling tool: ${event.data.tool_name}`,
        };
        task.progressDetails.push(progressDetail);
      }
    });

    // Calling LLM handler - adds progress detail to most recent running task
    this.register("calling_llm", (event, state) => {
      const task = this.findMostRecentRunningTask(state);

      if (task) {
        const progressDetail: StreamProgressDetail = {
          id: `calling_llm_${Date.now()}`,
          type: "calling_llm",
          timestamp: event.timestamp || Date.now(),
          data: {
            request: JSON.parse(event.data?.request || "{}"),
          },
          message: `Calling LLM${event.data?.model ? ` (${event.data.model})` : ""}`,
        };
        task.progressDetails.push(progressDetail);
      }
    });

    // LLM response handler - adds progress detail to most recent running task
    this.register("llm_response", (event, state) => {
      const task = this.findMostRecentRunningTask(state);

      if (task) {
        const progressDetail: StreamProgressDetail = {
          id: `llm_response_${Date.now()}`,
          type: "llm_response",
          timestamp: event.timestamp || Date.now(),
          data: {
            response: JSON.parse(event.data?.response || "{}"),
          },
          message: `LLM response received${event.data?.total_tokens ? ` (${event.data.total_tokens} tokens)` : ""}`,
        };
        task.progressDetails.push(progressDetail);
      }
    });
  }

  /**
   * Helper method to find the most recently started running task
   */
  private findMostRecentRunningTask(state: any): StreamingTask | null {
    const runningTasks = state.streamingTasks.filter(
      (t: StreamingTask) => t.status === "Running"
    );

    if (runningTasks.length === 0) {
      return null;
    }

    // Sort by start time (most recent first)
    return runningTasks.sort(
      (a: StreamingTask, b: StreamingTask) =>
        (b.startTime || 0) - (a.startTime || 0)
    )[0];
  }
}

// Create a default registry instance
export const defaultStreamRegistry = new StreamEventRegistry();
defaultStreamRegistry.registerDefaultHandlers();
