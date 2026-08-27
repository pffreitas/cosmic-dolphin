import {
  BookmarkProcessingEvent,
  BookmarkProcessingPhase,
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

/**
 * The pipeline's phase vocabulary — docs/functional-spec/03-ai-pipeline.md.
 *
 * Six phases, in order. Five of them are surfaced in the UI, which labels them
 * from `PROCESSING_PHASE_LABELS` in `apps/web/components/ai/processing-steps`;
 * `embed` runs silently because it has no user-legible output.
 *
 * These names are a contract with the client, not an implementation detail. A
 * phase is a thing the user can be told about and can retry — never a unit of
 * work that happens to be convenient here.
 */
export const BOOKMARK_PROCESSING_PHASES = [
  "fetch",
  "extract",
  "summarise",
  "tag",
  "file",
  "embed",
] as const satisfies readonly BookmarkProcessingPhase[];

/** The union lives in `../types` so queue payloads and clients can name a
 *  phase without pulling in the reporter. This is the same set. */
export type BookmarkProcessingPhaseName = BookmarkProcessingPhase;

export function isBookmarkProcessingPhase(
  value: string
): value is BookmarkProcessingPhaseName {
  return (BOOKMARK_PROCESSING_PHASES as readonly string[]).includes(value);
}

/**
 * What the pipeline used to call its phases, and where each one lands now.
 *
 * The old vocabulary was the worker's internal task list — nine names, several
 * of them for a single user-visible step ("summarization" and "brief_summary"
 * are one *Summarising…* line) and one, "finalization", for bookkeeping the
 * user has no business reading about. That one maps to `null`: it stays in the
 * timeline under its own name for cost accounting, with no phase to label.
 *
 * This table is mirrored by the backfill in
 * `supabase/migrations/20260827000002_backfill_bookmark_processing_phases.sql`,
 * so timelines written before the rename read the same as timelines written
 * after it. Change one and you must change the other.
 */
export const LEGACY_BOOKMARK_PROCESSING_PHASES = {
  fetch: "fetch",
  private_link_enrichment: "extract",
  images: "extract",
  summarization: "summarise",
  brief_summary: "summarise",
  tags: "tag",
  categorization: "file",
  chunking: "embed",
  embedding: "embed",
  finalization: null,
} as const satisfies Record<string, BookmarkProcessingPhaseName | null>;

export type LegacyBookmarkProcessingPhaseName =
  keyof typeof LEGACY_BOOKMARK_PROCESSING_PHASES;

/**
 * Normalises anything the pipeline hands in to the six-phase vocabulary.
 *
 * Returns `undefined` for a name with no user-facing phase, which is written
 * to the event as a null `phase` — the span is still recorded, it just has no
 * line in the checklist.
 */
export function mapBookmarkProcessingPhase(
  phase: BookmarkProcessingPhaseName | LegacyBookmarkProcessingPhaseName
): BookmarkProcessingPhaseName | undefined {
  if (isBookmarkProcessingPhase(phase)) return phase;
  return LEGACY_BOOKMARK_PROCESSING_PHASES[phase] ?? undefined;
}

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

  /**
   * Continue the bookmark's most recent run instead of opening a new one.
   *
   * A manual **Retry** *appends to* the existing timeline rather than replacing
   * it (docs/functional-spec/03-ai-pipeline.md § Retries). The timeline
   * endpoint returns the latest run and its events, so a fresh run row would
   * make everything the user had already watched vanish — which reads as "that
   * never happened" rather than "we tried again". Resuming re-opens the run,
   * carries its sequence counter and its token totals forward, and adds the new
   * attempt's phases after the ones already there.
   *
   * Falls back to `startRun` when there is nothing to resume: a bookmark whose
   * first run never got off the ground still needs a run.
   */
  async resumeRun(bookmarkId: string, userId: string): Promise<void> {
    const timeline = await this.repository.findLatestTimeline(
      bookmarkId,
      userId
    );

    if (!timeline) {
      await this.startRun(bookmarkId, userId);
      return;
    }

    const { run, events } = timeline;
    this.runId = run.id;
    this.runStartedAt = run.startedAt;
    this.sequence = events.reduce(
      (highest, event) => Math.max(highest, event.sequence),
      0
    );
    // Seed from what the run already spent. `updateRun` writes absolute totals,
    // so starting from zero would silently erase the first attempt's cost.
    this.totals = {
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      totalTokens: run.totalTokens,
      reasoningTokens: run.reasoningTokens,
      cachedInputTokens: run.cachedInputTokens,
      costUsd: run.costUsd,
    };

    const runEvent = events.find((event) => event.kind === "run");
    this.runEventId = runEvent?.id;

    await this.repository.updateRun(run.id, { status: "running", error: null });
    if (runEvent) {
      await this.repository.updateEvent(runEvent.id, {
        status: "running",
        error: null,
      });
    }
  }

  hasStarted(): boolean {
    return Boolean(this.runId && this.runStartedAt);
  }

  /**
   * One event per phase — created when the phase starts and closed when it
   * ends. Two writes, at the two moments the UI cares about.
   *
   * Deliberately not per token: the checklist is five lines, and streaming a
   * model's output into it would rewrite the same line hundreds of times,
   * flickering the row and burning realtime quota for nothing the reader can
   * use. Token accounting lives on the child `turn` events, one per model
   * call — see docs/functional-spec/03-ai-pipeline.md § Progress delivery.
   */
  async trackPhase<T>(
    phase: BookmarkProcessingPhaseName | LegacyBookmarkProcessingPhaseName,
    name: string,
    work: (phaseReporter: BookmarkProcessingPhaseReporter) => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.assertRunStarted();

    const mappedPhase = mapBookmarkProcessingPhase(phase);
    const startedAt = this.now();
    const event = await this.repository.createEvent({
      runId: this.runId!,
      parentEventId: this.runEventId,
      kind: "phase",
      phase: mappedPhase,
      name,
      status: "running",
      sequence: this.nextSequence(),
      startedAt,
      metadata,
    });

    const phaseReporter = new BookmarkProcessingPhaseReporter(
      this,
      event,
      mappedPhase
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
    phase: BookmarkProcessingPhaseName | undefined,
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
    private phase: BookmarkProcessingPhaseName | undefined
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
