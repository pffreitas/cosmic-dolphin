import { Kysely } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  BookmarkProcessingEvent as DatabaseBookmarkProcessingEvent,
  BookmarkProcessingEventUpdate,
  BookmarkProcessingRun as DatabaseBookmarkProcessingRun,
  BookmarkProcessingRunUpdate,
  Database,
  NewBookmarkProcessingEvent,
  NewBookmarkProcessingRun,
} from "../database/schema";
import {
  BookmarkProcessingEvent,
  BookmarkProcessingEventKind,
  BookmarkProcessingRun,
  BookmarkProcessingTimelineStatus,
} from "../types";

export interface CreateBookmarkProcessingRunData {
  bookmarkId: string;
  userId: string;
  status: BookmarkProcessingTimelineStatus;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  error?: string;
}

export interface UpdateBookmarkProcessingRunData {
  status?: BookmarkProcessingTimelineStatus;
  endedAt?: Date;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: string | null;
  error?: string | null;
}

export interface CreateBookmarkProcessingEventData {
  runId: string;
  parentEventId?: string;
  kind: BookmarkProcessingEventKind;
  phase?: string;
  name: string;
  status: BookmarkProcessingTimelineStatus;
  sequence: number;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: string | null;
  providerMetadata?: Record<string, any>;
  metadata?: Record<string, any>;
  error?: string;
}

export interface UpdateBookmarkProcessingEventData {
  status?: BookmarkProcessingTimelineStatus;
  endedAt?: Date;
  durationMs?: number;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: string | null;
  providerMetadata?: Record<string, any>;
  metadata?: Record<string, any>;
  error?: string | null;
}

export interface BookmarkProcessingTimelineRecord {
  run: BookmarkProcessingRun;
  events: BookmarkProcessingEvent[];
}

export interface BookmarkProcessingRepository {
  createRun(
    data: CreateBookmarkProcessingRunData
  ): Promise<BookmarkProcessingRun>;
  updateRun(
    id: string,
    data: UpdateBookmarkProcessingRunData
  ): Promise<BookmarkProcessingRun>;
  createEvent(
    data: CreateBookmarkProcessingEventData
  ): Promise<BookmarkProcessingEvent>;
  updateEvent(
    id: string,
    data: UpdateBookmarkProcessingEventData
  ): Promise<BookmarkProcessingEvent>;
  findLatestTimeline(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkProcessingTimelineRecord | null>;
  countRunsSince(userId: string, since: Date): Promise<number>;
}

export class BookmarkProcessingRepositoryImpl
  extends BaseRepository
  implements BookmarkProcessingRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async createRun(
    data: CreateBookmarkProcessingRunData
  ): Promise<BookmarkProcessingRun> {
    return this.executeQuery(async () => {
      const insertData: NewBookmarkProcessingRun = {
        bookmark_id: data.bookmarkId,
        user_id: data.userId,
        status: data.status,
        started_at: data.startedAt,
        ended_at: data.endedAt ?? null,
        duration_ms: data.durationMs ?? null,
        error: data.error ?? null,
      };

      const row = await this.db
        .insertInto("bookmark_processing_runs")
        .values(insertData)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapRun(row);
    }, "createBookmarkProcessingRun");
  }

  async updateRun(
    id: string,
    data: UpdateBookmarkProcessingRunData
  ): Promise<BookmarkProcessingRun> {
    return this.executeQuery(async () => {
      const updateData: BookmarkProcessingRunUpdate = {};

      if (data.status !== undefined) updateData.status = data.status;
      if (data.endedAt !== undefined) updateData.ended_at = data.endedAt;
      if (data.durationMs !== undefined) updateData.duration_ms = data.durationMs;
      if (data.inputTokens !== undefined)
        updateData.input_tokens = data.inputTokens;
      if (data.outputTokens !== undefined)
        updateData.output_tokens = data.outputTokens;
      if (data.totalTokens !== undefined)
        updateData.total_tokens = data.totalTokens;
      if (data.reasoningTokens !== undefined)
        updateData.reasoning_tokens = data.reasoningTokens;
      if (data.cachedInputTokens !== undefined)
        updateData.cached_input_tokens = data.cachedInputTokens;
      if (data.costUsd !== undefined) updateData.cost_usd = data.costUsd;
      if (data.error !== undefined) updateData.error = data.error;

      const row = await this.db
        .updateTable("bookmark_processing_runs")
        .set(updateData)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapRun(row);
    }, "updateBookmarkProcessingRun");
  }

  async createEvent(
    data: CreateBookmarkProcessingEventData
  ): Promise<BookmarkProcessingEvent> {
    return this.executeQuery(async () => {
      const insertData: NewBookmarkProcessingEvent = {
        run_id: data.runId,
        parent_event_id: data.parentEventId ?? null,
        kind: data.kind,
        phase: data.phase ?? null,
        name: data.name,
        status: data.status,
        sequence: data.sequence,
        started_at: data.startedAt,
        ended_at: data.endedAt ?? null,
        duration_ms: data.durationMs ?? null,
        model_id: data.modelId ?? null,
        input_tokens: data.inputTokens ?? 0,
        output_tokens: data.outputTokens ?? 0,
        total_tokens: data.totalTokens ?? 0,
        reasoning_tokens: data.reasoningTokens ?? 0,
        cached_input_tokens: data.cachedInputTokens ?? 0,
        cost_usd: data.costUsd ?? null,
        provider_metadata: data.providerMetadata ?? null,
        metadata: data.metadata ?? null,
        error: data.error ?? null,
      };

      const row = await this.db
        .insertInto("bookmark_processing_events")
        .values(insertData)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapEvent(row);
    }, "createBookmarkProcessingEvent");
  }

  async updateEvent(
    id: string,
    data: UpdateBookmarkProcessingEventData
  ): Promise<BookmarkProcessingEvent> {
    return this.executeQuery(async () => {
      const updateData: BookmarkProcessingEventUpdate = {};

      if (data.status !== undefined) updateData.status = data.status;
      if (data.endedAt !== undefined) updateData.ended_at = data.endedAt;
      if (data.durationMs !== undefined) updateData.duration_ms = data.durationMs;
      if (data.modelId !== undefined) updateData.model_id = data.modelId;
      if (data.inputTokens !== undefined)
        updateData.input_tokens = data.inputTokens;
      if (data.outputTokens !== undefined)
        updateData.output_tokens = data.outputTokens;
      if (data.totalTokens !== undefined)
        updateData.total_tokens = data.totalTokens;
      if (data.reasoningTokens !== undefined)
        updateData.reasoning_tokens = data.reasoningTokens;
      if (data.cachedInputTokens !== undefined)
        updateData.cached_input_tokens = data.cachedInputTokens;
      if (data.costUsd !== undefined) updateData.cost_usd = data.costUsd;
      if (data.providerMetadata !== undefined)
        updateData.provider_metadata = data.providerMetadata;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;
      if (data.error !== undefined) updateData.error = data.error;

      const row = await this.db
        .updateTable("bookmark_processing_events")
        .set(updateData)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapEvent(row);
    }, "updateBookmarkProcessingEvent");
  }

  async findLatestTimeline(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkProcessingTimelineRecord | null> {
    return this.executeQuery(async () => {
      const run = await this.db
        .selectFrom("bookmark_processing_runs")
        .selectAll()
        .where("bookmark_id", "=", bookmarkId)
        .where("user_id", "=", userId)
        .orderBy("started_at", "desc")
        .orderBy("created_at", "desc")
        .executeTakeFirst();

      if (!run) return null;

      const events = await this.db
        .selectFrom("bookmark_processing_events")
        .selectAll()
        .where("run_id", "=", run.id)
        .orderBy("sequence", "asc")
        .execute();

      return {
        run: this.mapRun(run),
        events: events.map((event) => this.mapEvent(event)),
      };
    }, "findLatestBookmarkProcessingTimeline");
  }

  /**
   * How many runs this user has started since `since`.
   *
   * The unit the daily processing budget is spent in: one run is one trip
   * through the model calls, whether it came from a save or a reprocess. Served
   * by `idx_bookmark_processing_runs_user_started`.
   */
  async countRunsSince(userId: string, since: Date): Promise<number> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("bookmark_processing_runs")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("user_id", "=", userId)
        .where("started_at", ">=", since)
        .executeTakeFirst();

      return Number(row?.count ?? 0);
    }, "countBookmarkProcessingRunsSince");
  }

  private mapRun(row: DatabaseBookmarkProcessingRun): BookmarkProcessingRun {
    return {
      id: row.id,
      bookmarkId: row.bookmark_id,
      userId: row.user_id,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      reasoningTokens: row.reasoning_tokens,
      cachedInputTokens: row.cached_input_tokens,
      costUsd: this.normalizeCost(row.cost_usd),
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEvent(
    row: DatabaseBookmarkProcessingEvent
  ): BookmarkProcessingEvent {
    return {
      id: row.id,
      runId: row.run_id,
      parentEventId: row.parent_event_id ?? undefined,
      kind: row.kind,
      phase: row.phase ?? undefined,
      name: row.name,
      status: row.status,
      sequence: row.sequence,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      modelId: row.model_id ?? undefined,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      reasoningTokens: row.reasoning_tokens,
      cachedInputTokens: row.cached_input_tokens,
      costUsd: this.normalizeCost(row.cost_usd),
      providerMetadata: row.provider_metadata ?? undefined,
      metadata: row.metadata ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizeCost(cost: string | null): string | undefined {
    if (cost === null) return undefined;
    return cost.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }
}
