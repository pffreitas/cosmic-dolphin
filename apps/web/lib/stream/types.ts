// Stream event types and interfaces

export interface StreamProgressDetail {
  id: string;
  type: "tool_call" | "calling_llm" | "llm_response" | "info" | "error";
  timestamp: number;
  data?: any;
  message?: string;
}

export interface StreamingTask {
  id: string;
  status: "Running" | "Completed" | "Error";
  name?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
  metadata?: Record<string, any>;
  progressDetails: StreamProgressDetail[];
}

// Base stream event structure
export interface BaseStreamEvent {
  event: string;
  timestamp?: number;
  data?: any;
  status?: string;
}

// Specific event types
export interface NoteUpdatedEvent extends BaseStreamEvent {
  event: "note_updated";
  data: {
    noteId: number;
  };
}

export interface PipelineStatusEvent extends BaseStreamEvent {
  event: "pipeline_status";
  status: string;
}

export interface PipelineCompleteEvent extends BaseStreamEvent {
  event: "pipeline_complete";
}

export interface ContentEvent extends BaseStreamEvent {
  event: "content";
  data: string;
}

export interface TaskStartEvent extends BaseStreamEvent {
  event: "task_start";
  data: {
    task_id: string;
    task_name?: string;
    metadata?: Record<string, any>;
  };
}

export interface TaskCompleteEvent extends BaseStreamEvent {
  event: "task_complete";
  data: {
    task_id: string;
  };
}

export interface TaskErrorEvent extends BaseStreamEvent {
  event: "task_error";
  data: {
    task_id: string;
    error?: string;
  };
}

export interface ToolCallEvent extends BaseStreamEvent {
  event: "tool_call";
  data: {
    tool_name: string;
    parameters?: Record<string, any>;
    call_id?: string;
  };
}

export interface CallingLlmEvent extends BaseStreamEvent {
  event: "calling_llm";
  data: {
    model?: string;
    prompt_tokens?: number;
    request?: string;
  };
}

export interface LlmResponseEvent extends BaseStreamEvent {
  event: "llm_response";
  data: {
    response?: string;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// Union type for all possible stream events
export type StreamEvent =
  | NoteUpdatedEvent
  | PipelineStatusEvent
  | PipelineCompleteEvent
  | ContentEvent
  | TaskStartEvent
  | TaskCompleteEvent
  | TaskErrorEvent
  | ToolCallEvent
  | CallingLlmEvent
  | LlmResponseEvent;

// Event handler function type
export type StreamEventHandlerFunction<T extends StreamEvent = StreamEvent> = (
  event: T,
  state: any
) => void;

// Event handler registry type
export type StreamEventHandlerRegistry = {
  [eventType: string]: StreamEventHandlerFunction<any>;
};

// Stream state interface for Redux
export interface StreamState {
  isStreaming: boolean;
  streamStatus: string;
  streamError: string | null;
  streamingTokens: string[];
  streamingTasks: StreamingTask[];
}
