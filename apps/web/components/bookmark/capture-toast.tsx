"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";
import { useOptionalToast } from "@/components/ui/toast";
import type { CaptureResult } from "@/lib/store/slices/bookmarksSlice";

/**
 * The answer to a save, said once, in a toast.
 *
 * A duplicate paste is not an error — docs/functional-spec/02-capture.md
 * § Create. `POST /bookmarks` answers a collision with the bookmark that is
 * already there plus `alreadySaved: true`, and the only thing worth saying is
 * "Already in your library", with a link to the one you already have.
 *
 * `useOptionalToast` rather than `useToast`: a surface that has not mounted a
 * `<ToastProvider>` still saves the link. The toast is the confirmation, not
 * the save.
 */
export function useCaptureToast() {
  const toaster = useOptionalToast();

  return React.useCallback(
    (result: CaptureResult) => {
      const { alreadySaved, bookmarkId } = result;

      toaster?.toast({
        title: alreadySaved ? "Already in your library" : "Saved",
        description: (
          <Link
            href={`/bookmarks/${bookmarkId}`}
            className={cn(
              "rounded-xs text-accent underline underline-offset-2",
              focusRing,
            )}
          >
            {alreadySaved ? "Open it" : "Open"}
          </Link>
        ),
      });
    },
    [toaster]
  );
}
