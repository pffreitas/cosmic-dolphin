import {
  BookmarkProcessingEvent,
  BookmarkProcessingTimelineStatus,
  BookmarkProcessingUsage,
} from "../types";
import {
  BookmarkProcessingRepository as BookmarkProcessingRepositoryContract,
  CreateBookmarkProcessingEventData,
  CreateBookmarkProcessingRunData,
  UpdateBookmarkProcessingEventData,
  UpdateBookmarkProcessingRunData,
} from "../repositories/bookmark-processing.repository";

type BookmarkProcessingReporterRepository = BookmarkProcessingRepositoryContract;

export type BookmarkProcessingPhaseName =
  | "private_link_enrichment"
  | "summarization"
  | "brief_summary"
  | "tags"
  | "images"
  | "chunking"
  | "embedding"
  | "categorization"
  | "finalization";

export interface BookmarkProcessingTurnResult<T> {
  value: T;
  usage?: BookmarkProcessingUsage;
  metadata?: Record<string, any>;
}

interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  costUsd?: string;
}

export class BookmarkProcessingReporter {
  private runId?: string;
  private runEventId?: string;
  private runStartedAt?: Date;
  private sequence = 0;
  private totals: UsageTotals = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
  };

  constructor(
    private repository: BookmarkProcessingReporterRepository,
    private now: () => Date = () => new Date()
  ) {}

  async startRun(bookmarkId: string, userId: string): Promise<void> {
    const startedAt = this.now();
    const data: CreateBookmarkProcessingRunData = {
      bookmarkId,
      userId,
      status: "running",
      startedAt,
    };
    const run = await this.repository.createRun(data);
    this.runId = run.id;
    this.runStartedAt = startedAt;
    this.sequence = 0;
    this.totals = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };
    const runEvent = await this.repository.createEvent({
      runId: run.id,
      kind: "run",
      name: "Processing run",
      status: "running",
      sequence: this.nextSequence(),
      startedAt,
    });
    this.runEventId = runEvent.id;
  }

  async trackPhase<T>(
    phase: BookmarkProcessingPhaseName,
    name: string,
    work: (phaseReporter: BookmarkProcessingPhaseReporter) => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.assertRunStarted();

    const startedAt = this.now();
    const event = await this.repository.createEvent({
      runId: this.runId!,
      parentEventId: this.runEventId,
      kind: "phase",
      phase,
      name,
      status: "running",
      sequence: this.nextSequence(),
      startedAt,
      metadata,
    });

    const phaseReporter = new BookmarkProcessingPhaseReporter(
      this,
      event,
      phase
    );

    try {
      const result = await work(phaseReporter);
      await this.completeEvent(event.id, startedAt);
      return result;
    } catch (error) {
      await this.failEvent(event.id, startedAt, this.getErrorMessage(error));
      throw error;
    }
  }

  async completeRun(): Promise<void> {
    this.assertRunStarted();
    await this.updateRun("completed");
  }

  async failRun(error: unknown): Promise<void> {
    this.assertRunStarted();
    await this.updateRun("failed", this.getErrorMessage(error));
  }

  async trackTurn<T>(
    parentEventId: string,
    phase: BookmarkProcessingPhaseName,
    name: string,
    modelId: string | undefined,
    work: () => Promise<BookmarkProcessingTurnResult<T>>
  ): Promise<T> {
    this.assertRunStarted();

    const startedAt = this.now();
    const event = await this.repository.createEvent({
      runId: this.runId!,
      parentEventId,
      kind: "turn",
      phase,
      name,
      status: "running",
      sequence: this.nextSequence(),
      startedAt,
      modelId,
    });

    try {
      const result = await work();
      const usage = result.usage;
      if (usage) {
        this.addUsage(usage);
      }
      await this.completeEvent(event.id, startedAt, {
        modelId,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
        reasoningTokens: usage?.reasoningTokens,
        cachedInputTokens: usage?.cachedInputTokens,
        costUsd: usage?.costUsd ?? null,
        providerMetadata: usage?.providerMetadata,
        metadata: result.metadata,
      });
      return result.value;
    } catch (error) {
      await this.failEvent(event.id, startedAt, this.getErrorMessage(error));
      throw error;
    }
  }

  private async updateRun(
    status: BookmarkProcessingTimelineStatus,
    error?: string
  ): Promise<void> {
    const endedAt = this.now();
    const data: UpdateBookmarkProcessingRunData = {
      status,
      endedAt,
      durationMs: this.durationSince(this.runStartedAt!, endedAt),
      inputTokens: this.totals.inputTokens,
      outputTokens: this.totals.outputTokens,
      totalTokens: this.totals.totalTokens,
      reasoningTokens: this.totals.reasoningTokens,
      cachedInputTokens: this.totals.cachedInputTokens,
      costUsd: this.totals.costUsd ?? null,
      error: error ?? null,
    };

    await this.repository.updateRun(this.runId!, data);
    if (this.runEventId) {
      await this.repository.updateEvent(this.runEventId, {
        status,
        endedAt,
        durationMs: data.durationMs,
        inputTokens: this.totals.inputTokens,
        outputTokens: this.totals.outputTokens,
        totalTokens: this.totals.totalTokens,
        reasoningTokens: this.totals.reasoningTokens,
        cachedInputTokens: this.totals.cachedInputTokens,
        costUsd: this.totals.costUsd ?? null,
        error: error ?? null,
      });
    }
  }

  private async completeEvent(
    eventId: string,
    startedAt: Date,
    data: Omit<UpdateBookmarkProcessingEventData, "status" | "endedAt" | "durationMs"> = {}
  ): Promise<void> {
    const endedAt = this.now();
    await this.repository.updateEvent(eventId, {
      ...data,
      status: "completed",
      endedAt,
      durationMs: this.durationSince(startedAt, endedAt),
    });
  }

  private async failEvent(
    eventId: string,
    startedAt: Date,
    error: string
  ): Promise<void> {
    const endedAt = this.now();
    await this.repository.updateEvent(eventId, {
      status: "failed",
      endedAt,
      durationMs: this.durationSince(startedAt, endedAt),
      error,
    });
  }

  private addUsage(usage: BookmarkProcessingUsage): void {
    this.totals.inputTokens += usage.inputTokens ?? 0;
    this.totals.outputTokens += usage.outputTokens ?? 0;
    this.totals.totalTokens += usage.totalTokens ?? 0;
    this.totals.reasoningTokens += usage.reasoningTokens ?? 0;
    this.totals.cachedInputTokens += usage.cachedInputTokens ?? 0;

    if (usage.costUsd !== undefined) {
      const current = Number(this.totals.costUsd ?? "0");
      const next = current + Number(usage.costUsd);
      this.totals.costUsd = this.formatCost(next);
    }
  }

  private formatCost(cost: number): string {
    return cost.toFixed(10).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private durationSince(startedAt: Date, endedAt: Date): number {
    return Math.max(0, endedAt.getTime() - startedAt.getTime());
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private assertRunStarted(): void {
    if (!this.runId || !this.runStartedAt) {
      throw new Error("Bookmark processing run has not started");
    }
  }
}

export class BookmarkProcessingPhaseReporter {
  constructor(
    private reporter: BookmarkProcessingReporter,
    private phaseEvent: BookmarkProcessingEvent,
    private phase: BookmarkProcessingPhaseName
  ) {}

  async trackTurn<T>(
    name: string,
    modelId: string | undefined,
    work: () => Promise<BookmarkProcessingTurnResult<T>>
  ): Promise<T> {
    return this.reporter.trackTurn(
      this.phaseEvent.id,
      this.phase,
      name,
      modelId,
      work
    );
  }
}
