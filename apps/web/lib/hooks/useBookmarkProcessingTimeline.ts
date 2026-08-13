"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark } from "@cosmic-dolphin/api-client";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import {
  BookmarkProcessingTimelineEvent,
  BookmarkProcessingTimelineResponse,
} from "@/lib/types/processing-timeline";

const DEFAULT_POLL_AFTER_MS = 2000;

const PHASE_LABELS: Record<string, string> = {
  private_link_enrichment: "Organizing private link",
  summarization: "Summarizing content",
  brief_summary: "Writing brief summary",
  tags: "Choosing tags",
  images: "Processing images",
  chunking: "Preparing content",
  embedding: "Building semantic search",
  categorization: "Choosing collection",
  finalization: "Finalizing bookmark",
};

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
  return runningPhase.phase
    ? PHASE_LABELS[runningPhase.phase] ?? runningPhase.name
    : runningPhase.name;
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

  return {
    bookmark,
    timeline,
    events,
    isPolling,
    activePhaseLabel,
    error,
  };
}
