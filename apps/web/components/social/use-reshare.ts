"use client";

import * as React from "react";

import { useCaptureToast } from "@/components/bookmark/capture-toast";
import { useOptionalToast } from "@/components/ui/toast";
import { BookmarksClientAPI, SaveRateLimitedError } from "@/lib/api/bookmarks-client";

/**
 * The feed's **Save** action, wired — docs/functional-spec/06-social.md
 * § Reshare.
 *
 * `ActionRow` is presentational and stays that way: this hook produces the
 * `saved` / `onSaveChange` pair it already takes, so the feed (D14/D16) binds
 * a reshare by spreading two props rather than by learning the endpoint.
 *
 * Three things it deliberately does not do:
 *
 *  - **It does not un-reshare.** There is no such endpoint, because there is
 *    no such action: undoing a save is deleting a bookmark, which happens in
 *    the Library where the consequences are visible. `onSaveChange(false)` is
 *    therefore ignored, and `ActionRow`'s `saveOnce` keeps the control from
 *    pretending otherwise.
 *  - **It does not invent the answer.** "Saved" or "Already in your library"
 *    comes from the server's `alreadySaved`, through the same toast a
 *    duplicate paste raises — one sentence, written once, in
 *    `useCaptureToast`.
 *  - **It does not swallow failures.** A save the user pressed for and did not
 *    get is said out loud, and the control goes back to "Save" so pressing it
 *    again is the obvious thing to do.
 */
export interface UseReshareOptions {
  bookmarkId: string;
  /** Server truth: the caller already has this URL. */
  saved?: boolean;
  /** Suppresses the network entirely — the pattern gallery and tests. */
  offline?: boolean;
  /** What `offline` should pretend the server said. */
  offlineOutcome?: "saved" | "alreadySaved";
}

export interface UseReshareResult {
  saved: boolean;
  /** In flight. The control stays pressable; the second press is dropped. */
  pending: boolean;
  onSaveChange: (next: boolean) => void;
}

export function useReshare({
  bookmarkId,
  saved: savedFromServer = false,
  offline = false,
  offlineOutcome = "saved",
}: UseReshareOptions): UseReshareResult {
  const toaster = useOptionalToast();
  const captureToast = useCaptureToast();

  const [saved, setSaved] = React.useState(savedFromServer);
  const [pending, setPending] = React.useState(false);

  // Server truth wins whenever it arrives, exactly as `ActionRow` re-syncs its
  // own optimistic like.
  React.useEffect(() => setSaved(savedFromServer), [savedFromServer]);

  const onSaveChange = React.useCallback(
    (next: boolean) => {
      if (!next || saved || pending) return;

      setSaved(true);
      setPending(true);

      const finish = (result: { bookmarkId: string; alreadySaved: boolean }) => {
        captureToast({
          captureId: result.bookmarkId,
          bookmarkId: result.bookmarkId,
          alreadySaved: result.alreadySaved,
        });
      };

      if (offline) {
        setPending(false);
        finish({
          bookmarkId,
          alreadySaved: offlineOutcome === "alreadySaved",
        });
        return;
      }

      BookmarksClientAPI.reshare(bookmarkId)
        .then((response) => {
          finish({
            bookmarkId: response.bookmark.id,
            alreadySaved: response.alreadySaved === true,
          });
        })
        .catch((error: unknown) => {
          // Back to "Save". The bookmark is not in the library, and the row
          // must not claim it is.
          setSaved(false);

          const description =
            error instanceof SaveRateLimitedError
              ? error.retryAfterSeconds
                ? `Try again in about ${Math.ceil(error.retryAfterSeconds / 60)} minutes.`
                : "You have hit today's save limit."
              : error instanceof Error
                ? error.message
                : "Something went wrong.";

          toaster?.toast({
            title: "Couldn't save this",
            description,
            variant: "danger",
          });
        })
        .finally(() => setPending(false));
    },
    [
      bookmarkId,
      captureToast,
      offline,
      offlineOutcome,
      pending,
      saved,
      toaster,
    ]
  );

  return { saved, pending, onSaveChange };
}
