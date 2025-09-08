export interface QueueMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: Date;
  vt: Date;
  message: any;
}

export interface QueueConfig {
  name: string;
  pollInterval: number;
  maxRetries: number;
  batchSize: number;
}

export interface ProcessingResult {
  success: boolean;
  error?: string;
  shouldRetry?: boolean;
}

export interface ProcessorOptions {
  queues: QueueConfig[];
  concurrency: number;
  gracefulShutdownTimeout: number;
}

export interface RetryableError extends Error {
  shouldRetry: boolean;
  retryAfter?: number;
}