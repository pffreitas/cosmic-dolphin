// Placeholder for shared types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Queue message types
export interface QueueMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: Date;
  vt: Date;
  message: any;
}

export interface QueueTaskPayload {
  type: string;
  action?: string;
  data?: any;
  metadata?: {
    source?: string;
    priority?: 'low' | 'medium' | 'high';
    retry_count?: number;
  };
}