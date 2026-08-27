"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark } from "@cosmic-dolphin/api-client";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import {
  BookmarkProcessingTimelineEvent,
  BookmarkProcessingTimelineResponse,
} from "@/lib/types/processing-timeline";
import {
  PROCESSING_PHASE_LABELS,
  type ProcessingPhase,
  type ProcessingStep,
  type ProcessingStepState,
} from "@/components/ai/processing-steps";

const DEFAULT_POLL_AFTER_MS = 2000;

/**
 * The five phases the checklist shows, in order.
 *
 * `embed` is deliberately absent: the pipeline runs it and the timeline
 * records it, but it has no user-legible output and a line for it would pad
 * the list with noise — docs/functional-spec/03-ai-pipeline.md § Phases.
 */
export const SURFACED_PROCESSING_PHASES: ProcessingPhase[] = [
  "fetch",
  "extract",
  "summarise",
  "tag",
  "file",
];

function isSurfacedPhase(phase?: string): phase is ProcessingPhase {
  return (
    phase !== undefined &&
    (SURFACED_PROCESSING_PHASES as string[]).includes(phase)
  );
}

export function shouldPollProcessingTimeline(
  bookmark?: Pick<Bookmark, "processingStatus"> | null,
  timeline?: Pick<
    BookmarkProcessingTimelineResponse,
    "pollAfterMs" | "run" | "events"
  >
): boolean {
  return (
    bookmark?.processingStatus === "processing" ||
    (timeline?.pollAfterMs ?? 0) > 0 ||
    timeline?.run?.status === "running" ||
    timeline?.events?.some((event) => event.status === "running") === true
  );
}

export function shouldRetryProcessingTimelineError(error: unknown): boolean {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;

  return (
    typeof statusCode !== "number" ||
    ![401, 403, 404].includes(statusCode)
  );
}

export function getActivePhaseLabel(
  events: BookmarkProcessingTimelineEvent[] = []
): string | undefined {
  const runningPhase = [...events]
    .reverse()
    .find((event) => event.kind === "phase" && event.status === "running");

  if (!runningPhase) return undefined;
  return isSurfacedPhase(runningPhase.phase)
    ? PROCESSING_PHASE_LABELS[runningPhase.phase]
    : runningPhase.name;
}

/**
 * The timeline, as the five-line checklist.
 *
 * A phase can appear more than once on a run — a Retry appends rather than
 * replacing, so `summarise` may be there twice, failed and then done. The last
 * event for a phase is the one that is true now, which is why this reads
 * forwards and lets later events overwrite earlier ones.
 *
 * Phases with no event yet are `pending`, so the list is five lines from the
 * first paint and nothing reflows as the worker moves through it.
 */
export function deriveProcessingSteps(
  events: BookmarkProcessingTimelineEvent[] = [],
  bookmark?: Pick<Bookmark, "processingStatus"> | null
): ProcessingStep[] {
  const latest = new Map<
    ProcessingPhase,
    { state: ProcessingStepState; error?: string }
  >();

  for (const event of events) {
    if (event.kind !== "phase" || !isSurfacedPhase(event.phase)) continue;
    latest.set(event.phase, {
      state:
        event.status === "completed"
          ? "done"
          : event.status === "failed"
            ? "failed"
            : "active",
      error: event.status === "failed" ? event.error : undefined,
    });
  }

  // Nothing has been recorded and nothing is running: the pipeline has not
  // started on this bookmark (a save over the daily budget, or a private
  // link). An empty checklist says that better than five grey lines.
  if (latest.size === 0 && bookmark?.processingStatus !== "processing") {
    return [];
  }

  return SURFACED_PROCESSING_PHASES.map((phase) => ({
    phase,
    state: latest.get(phase)?.state ?? "pending",
    error: latest.get(phase)?.error,
  }));
}

interface UseBookmarkProcessingTimelineOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

interface UseBookmarkProcessingTimelineResult {
  bookmark: Bookmark;
  timeline?: BookmarkProcessingTimelineResponse;
  events: BookmarkProcessingTimelineEvent[];
  isPolling: boolean;
  activePhaseLabel?: string;
  /** Ready to hand straight to `<ProcessingSteps steps={...} />`. */
  steps: ProcessingStep[];
  error?: string;
}

export function useBookmarkProcessingTimeline(
  bookmarkId: string,
  initialBookmark: Bookmark,
  options: UseBookmarkProcessingTimelineOptions = {}
): UseBookmarkProcessingTimelineResult {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_AFTER_MS } = options;
  const [bookmark, setBookmark] = useState(initialBookmark);
  const [timeline, setTimeline] =
    useState<BookmarkProcessingTimelineResponse>();
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setBookmark(initialBookmark);
  }, [initialBookmark]);

  useEffect(() => {
    if (
      !enabled ||
      !bookmarkId ||
      !shouldPollProcessingTimeline(initialBookmark)
    ) {
      setIsPolling(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      setIsPolling(true);
      try {
        const response = await BookmarksClientAPI.getProcessingTimeline(
          bookmarkId
        );
        if (cancelled) return;

        setError(undefined);
        setTimeline(response);
        setBookmark(response.bookmark);

        if (shouldPollProcessingTimeline(response.bookmark, response)) {
          timeoutId = setTimeout(
            poll,
            response.pollAfterMs || pollIntervalMs
          );
        } else {
          setIsPolling(false);
        }
      } catch (pollError) {
        if (cancelled) return;

        setError(
          pollError instanceof Error
            ? pollError.message
            : "Failed to load processing timeline"
        );
        if (!shouldRetryProcessingTimelineError(pollError)) {
          setIsPolling(false);
          return;
        }
        timeoutId = setTimeout(poll, pollIntervalMs);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [initialBookmark, bookmarkId, enabled, pollIntervalMs]);

  const events = useMemo(() => timeline?.events ?? [], [timeline?.events]);
  const activePhaseLabel = useMemo(() => getActivePhaseLabel(events), [events]);
  const steps = useMemo(
    () => deriveProcessingSteps(events, bookmark),
    [events, bookmark]
  );

  return {
    bookmark,
    timeline,
    events,
    isPolling,
    activePhaseLabel,
    steps,
    error,
  };
}
