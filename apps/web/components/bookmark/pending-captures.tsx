"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import type { Bookmark } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FeedItem } from "@/components/feed/feed-item";
import type {
  ProcessingPhase,
  ProcessingStep,
} from "@/components/ai/processing-steps";
import { useBookmarkProcessingTimeline } from "@/lib/hooks/useBookmarkProcessingTimeline";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  captureDismissed,
  saveCapture,
  type PendingCapture,
} from "@/lib/store/slices/bookmarksSlice";

/**
 * The optimistic capture row — docs/functional-spec/02-capture.md
 * § Optimistic display.
 *
 * A pasted link is a real row before the POST is answered: the domain and a
 * favicon chip in the provenance line, the URL as a provisional title, and
 * staged progress parked at *Fetching page*. It is the feed item's `pending`
 * variant, not a bespoke shape — the whole point of the pattern is that a
 * save looks like the thing it is becoming.
 *
 * Once the save lands, the same row follows the real run: the checklist stops
 * being a guess and starts being `bookmark_processing_events`, five named
 * phases deep (docs/functional-spec/03-ai-pipeline.md). Nothing about the row
 * changes shape when that happens — the staging was always the pipeline's own
 * vocabulary, so the handover is invisible.
 *
 * There is no full-screen spinner and no blocking modal anywhere in this
 * flow. The row IS the progress indicator.
 *
 * When the request fails the row turns into an inline error with **Retry**.
 * It is never silently removed: only the user dismisses it, and the URL is
 * still on screen either way.
 */

// Parked at *Fetching page* — the present tense matters: nothing has been
// fetched yet, the request is in flight. The rest of the vocabulary is the
// pipeline's own (docs/functional-spec/03-ai-pipeline.md), so the row's
// staging is the same list it will keep once the worker takes over.
const SAVING_STEPS: ProcessingStep[] = [
  { phase: "fetch", state: "active", label: "Fetching page" },
  { phase: "extract", state: "pending" },
  { phase: "summarise", state: "pending" },
  { phase: "tag", state: "pending" },
  { phase: "file", state: "pending" },
];

// Saved, but nothing is running: the daily processing budget refused the
// enqueue. Not a failure — the link is in the library, it simply has no brief
// yet, and **Summarise now** is how the user asks for one.
const UNPROCESSED_STEPS: ProcessingStep[] = [
  { phase: "fetch", state: "pending", label: "Saved. Not summarised yet." },
];

function failedSteps(error?: string): ProcessingStep[] {
  return [
    {
      phase: "fetch",
      state: "failed",
      label: "Could not save this link",
      error,
    },
  ];
}

/**
 * A seed for the timeline poller, built from what the client already knows.
 *
 * The hook replaces it with the server's own row on the first response; until
 * then the only fields that matter are the id and the processing status, which
 * are the two the save just told us.
 */
function seedBookmark(capture: PendingCapture): Bookmark {
  return {
    id: capture.bookmarkId!,
    sourceUrl: capture.url,
    title: capture.title,
    processingStatus: capture.processingStatus ?? "processing",
  } as Bookmark;
}

function CaptureRow({
  capture,
  steps,
  onRetry,
  action,
}: {
  capture: PendingCapture;
  steps: ProcessingStep[];
  onRetry?: (phase: ProcessingPhase) => void;
  action?: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const failed = capture.status === "failed";

  // The original link always opens, whatever the pipeline did or did not
  // manage. Before the save lands there is no detail route to point at, so
  // the row points at the source itself.
  const href = capture.bookmarkId
    ? `/bookmarks/${capture.bookmarkId}`
    : capture.url;

  return (
    <FeedItem
      variant="pending"
      href={href}
      title={capture.title}
      provenance={{
        sources: [{ domain: capture.domain, faviconUrl: capture.faviconUrl }],
        action: failed ? "could not be saved" : "saving",
        timestamp: "just now",
      }}
      menu={
        <span className="flex items-center gap-1">
          {action}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={() => dispatch(captureDismissed(capture.id))}
          >
            <X aria-hidden="true" />
          </Button>
        </span>
      }
      steps={steps}
      onRetry={onRetry}
      thumbnailUrl={capture.thumbnailUrl}
    />
  );
}

/**
 * A capture the server has accepted. The checklist is now the run's own
 * events, and **Retry** on a failed line reprocesses that phase alone.
 */
function SavedCaptureRow({ capture }: { capture: PendingCapture }) {
  const seed = React.useMemo(() => seedBookmark(capture), [capture]);
  const { bookmark, steps } = useBookmarkProcessingTimeline(
    capture.bookmarkId!,
    seed
  );

  const [requested, setRequested] = React.useState(false);

  const reprocess = React.useCallback(
    async (phase?: ProcessingPhase) => {
      setRequested(true);
      try {
        await BookmarksClientAPI.reprocess(capture.bookmarkId!, phase);
      } catch (error) {
        console.error("Failed to start reprocessing:", error);
        setRequested(false);
      }
    },
    [capture.bookmarkId]
  );

  const idle = bookmark.processingStatus === "idle";

  return (
    <CaptureRow
      capture={capture}
      steps={idle && !requested ? UNPROCESSED_STEPS : steps}
      onRetry={(phase) => void reprocess(phase)}
      action={
        idle && !requested ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Sparkles aria-hidden="true" />}
            onClick={() => void reprocess()}
          >
            Summarise now
          </Button>
        ) : null
      }
    />
  );
}

export function PendingCaptureRow({ capture }: { capture: PendingCapture }) {
  const dispatch = useAppDispatch();

  if (capture.status === "saved" && capture.bookmarkId) {
    return <SavedCaptureRow capture={capture} />;
  }

  const failed = capture.status === "failed";

  return (
    <CaptureRow
      capture={capture}
      steps={failed ? failedSteps(capture.error) : SAVING_STEPS}
      onRetry={
        failed
          ? () => {
              void dispatch(
                saveCapture({
                  url: capture.url,
                  captureId: capture.id,
                  isPrivateLink: capture.isPrivateLink,
                  description: capture.description,
                  title: capture.providedTitle,
                })
              );
            }
          : undefined
      }
    />
  );
}

/**
 * Every capture in flight, newest first. Renders nothing when there are none,
 * so it can sit above any list without reserving space.
 */
export function PendingCaptures({ className }: { className?: string }) {
  const captures = useAppSelector((state) => state.bookmarks.captures);

  if (captures.length === 0) return null;

  return (
    <div className={cn("mb-3", className)}>
      {captures.map((capture) => (
        <PendingCaptureRow key={capture.id} capture={capture} />
      ))}
    </div>
  );
}
