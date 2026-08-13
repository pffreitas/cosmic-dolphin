import { Bookmark } from "@cosmic-dolphin/api-client";

export type BookmarkProcessingTimelineStatus =
  | "running"
  | "completed"
  | "failed";

export type BookmarkProcessingEventKind = "run" | "phase" | "turn";

export interface BookmarkProcessingTimelineEvent {
  id?: string;
  runId?: string;
  parentEventId?: string;
  kind: BookmarkProcessingEventKind;
  phase?: string;
  name: string;
  status: BookmarkProcessingTimelineStatus;
  sequence: number;
  startedAt?: string | Date;
  endedAt?: string | Date;
  durationMs?: number;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: string;
  providerMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface BookmarkProcessingTimelineRun {
  id: string;
  bookmarkId: string;
  userId: string;
  status: BookmarkProcessingTimelineStatus;
  startedAt: string | Date;
  endedAt?: string | Date;
  durationMs?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  costUsd?: string;
  error?: string;
}

export interface BookmarkProcessingTimelineResponse {
  bookmark: Bookmark;
  run?: BookmarkProcessingTimelineRun;
  events: BookmarkProcessingTimelineEvent[];
  pollAfterMs: number;
}
