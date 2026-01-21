import { Bookmark } from "@cosmic-dolphin/api-client";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface Task {
  taskID: string;
  name: string;
  status: "running" | "completed" | "error" | "pending";
  subTasks: Record<string, SubTask>;
  messages: Record<string, Message>;
}

export interface SubTask {
  taskID: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  messages: Record<string, Message>;
}

export interface Session {
  sessionID: string;
  refID: string;
  tasks: Record<string, Task>;
  eventCount: number;
  lastEventTimestamp: number;
  usage: UsagePart;
  error?: string;
  isLoading: boolean;
}

export interface Message {
  sessionID: string;
  messageID: string;
  taskID: string;
  parts: Record<string, MessagePart>;
}

export interface BaseMessagePart {
  partID: string;
  type: "text" | "tool";
}

export interface TextPart extends BaseMessagePart {
  partID: string;
  type: "text";
  text: string;
}

export interface ToolPart extends BaseMessagePart {
  partID: string;
  type: "tool";
  toolName: string;
  callID: string;
  status: "pending" | "running" | "completed" | "error";
  input: string;
  output: string;
  metadata: Record<string, any>;
  title: string;
}

export type MessagePart = TextPart | ToolPart | UsagePart;

export interface UsagePart {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export type RealtimeEventType =
  | "bookmark.updated"
  | "bookmark.processing.started"
  | "bookmark.processing.completed"
  | "bookmark.processing.failed"
  | "task.started"
  | "task.completed"
  | "task.updated"
  | "task.failed"
  | "session.started"
  | "session.error"
  | "message.updated"
  | "message.part.updated";

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: any;
  timestamp?: number;
}

export interface BookmarkUpdatedEvent {
  type: "bookmark.updated";
  data: Bookmark;
}

export interface BookmarkProcessingStartedEvent {
  type: "bookmark.processing.started";
  data: {
    bookmark: Bookmark;
  };
}

export interface BookmarkProcessingCompletedEvent {
  type: "bookmark.processing.completed";
  data: {
    bookmark: Bookmark;
  };
}

export interface BookmarkProcessingFailedEvent {
  type: "bookmark.processing.failed";
  data: {
    bookmark: Bookmark;
    error: string;
  };
}

export interface TaskStartedEvent {
  type: "task.started";
  data: {
    sessionID: string;
    taskID: string;
    name: string;
  };
}

export interface TaskCompletedEvent {
  type: "task.completed";
  data: {
    sessionID: string;
    taskID: string;
    subTasks: Record<string, SubTask>;
  };
}

export interface TaskUpdatedEvent {
  type: "task.updated";
  data: {
    sessionID: string;
    taskID: string;
    name: string;
    status: Task["status"];
    subTasks: Record<string, SubTask>;
  };
}

export interface TaskFailedEvent {
  type: "task.failed";
  data: {
    sessionID: string;
    taskID: string;
    name: string;
    status: Task["status"];
    subTasks: Record<string, SubTask>;
    error?: string;
  };
}

export interface SessionStartedEvent {
  type: "session.started";
  data: {
    sessionID: string;
    refID: string;
  };
}

export interface SessionErrorEvent {
  type: "session.error";
  data: {
    sessionID: string;
    error: string;
    context?: Record<string, any>;
  };
}

export interface MessageUpdatedEvent {
  type: "message.updated";
  data: {
    sessionID: string;
    taskID: string;
    messageID: string;
    metadata?: Record<string, any>;
  };
}

export interface MessagePartUpdatedEvent {
  type: "message.part.updated";
  data: {
    sessionID: string;
    taskID: string;
    messageID: string;
    partID: string;
    part: MessagePart;
  };
}

export type RealtimeEventPayload =
  | BookmarkUpdatedEvent
  | BookmarkProcessingStartedEvent
  | BookmarkProcessingCompletedEvent
  | BookmarkProcessingFailedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskUpdatedEvent
  | TaskFailedEvent
  | SessionStartedEvent
  | SessionErrorEvent
  | MessageUpdatedEvent
  | MessagePartUpdatedEvent;

export interface ConnectionState {
  status: ConnectionStatus;
  attempts: number;
  lastConnected: number | null;
  lastError: string | null;
  isOnline: boolean;
}

export interface RealtimeConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

export const DEFAULT_REALTIME_CONFIG: RealtimeConfig = {
  maxRetries: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  heartbeatInterval: 30000,
  connectionTimeout: 30000,
};
