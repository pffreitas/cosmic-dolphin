"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FeedItem } from "@/components/feed/feed-item";
import type { ProcessingStep } from "@/components/ai/processing-steps";
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

export function PendingCaptureRow({ capture }: { capture: PendingCapture }) {
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={() => dispatch(captureDismissed(capture.id))}
        >
          <X aria-hidden="true" />
        </Button>
      }
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
      thumbnailUrl={capture.thumbnailUrl}
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
