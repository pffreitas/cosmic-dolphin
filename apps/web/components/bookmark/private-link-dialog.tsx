"use client";

import { useEffect, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import type { PreviewResponse } from "@cosmic-dolphin/api-client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  clearErrors,
  previewUrl,
  saveCapture,
} from "@/lib/store/slices/bookmarksSlice";
import { buildPrivateLinkCapture } from "./private-link-payload";
import { useCaptureToast } from "./capture-toast";

interface PrivateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The URL the user typed. Everything here works from this alone. */
  url: string;
}

/**
 * Save a link behind a login — docs/functional-spec/02-capture.md
 * § Private links.
 *
 * The dialog is built from the URL and nothing else. `POST /bookmarks/preview`
 * is fired when the dialog opens and is **never awaited**: a private link is by
 * definition one the fetcher may not be able to read, so a preview is a bonus.
 * If it lands while the note is being written it contributes a real title; if
 * it never lands, the save is identical.
 *
 * Saving does not block either. The dialog closes the moment Save is pressed,
 * the optimistic row is already on screen behind it, and the outcome arrives as
 * a toast. The single exception is a 429: the note and the URL are too
 * expensive to lose, so the dialog comes back with both and shows the wait.
 */
export default function PrivateLinkDialog({
  open,
  onOpenChange,
  url,
}: PrivateLinkDialogProps) {
  const dispatch = useAppDispatch();
  const announce = useCaptureToast();

  const [description, setDescription] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  // Keyed on the URL, not on `open`: a 429 re-opens this dialog and the note
  // the user already wrote has to survive that.
  useEffect(() => {
    setDescription("");
    setSaveError(null);
    setPreview(null);

    if (!url) return;

    let live = true;
    void dispatch(previewUrl(url))
      .then((result) => {
        if (live && previewUrl.fulfilled.match(result)) {
          setPreview(result.payload as PreviewResponse);
        }
      })
      .catch(() => {
        // Expected, often: the page is behind a login. Nothing is lost.
      });

    return () => {
      live = false;
    };
  }, [url, dispatch]);

  const handleSave = async () => {
    dispatch(clearErrors());
    setSaveError(null);

    if (!description.trim()) {
      setSaveError(
        "Add a brief description so this private link is findable later."
      );
      return;
    }

    const capture = buildPrivateLinkCapture({ url, preview, description });

    // Closed before the request is answered. The row is already on screen.
    onOpenChange(false);

    const result = await dispatch(saveCapture(capture));

    if (saveCapture.fulfilled.match(result)) {
      announce(result.payload);
      setDescription("");
      return;
    }

    if (result.payload?.retryIn) {
      setSaveError(
        `${result.payload.error} Your link and note are still here — try again in ${result.payload.retryIn}.`
      );
      onOpenChange(true);
    }
    // Every other failure is an inline error with Retry on the row itself,
    // and the row carries the note through the retry.
  };

  const errorId = "private-link-error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Save private link</DialogTitle>
          <DialogDescription>
            We can&apos;t read or summarize this page, but we can keep it at
            hand. Add a short note and Cosmic Dolphin will organize it for
            quick access.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 py-2">
          <div className="space-y-1.5">
            <p className="font-sans text-sm font-medium text-fg-secondary">
              Link
            </p>
            <div className="flex items-center gap-2 rounded-md border border-line bg-bg-subtle px-3 py-2">
              <LinkIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-fg-tertiary"
              />
              <span className="truncate font-sans text-sm text-fg">
                {preview?.metadata.title || url}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="private-link-description"
              className="font-sans text-sm font-medium text-fg"
            >
              Brief description
            </label>
            <Textarea
              id="private-link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this link, and why will you need it?"
              rows={3}
              aria-invalid={Boolean(saveError)}
              aria-describedby={saveError ? errorId : undefined}
            />
          </div>

          {saveError ? (
            <p
              id={errorId}
              className="font-sans text-[12.5px] leading-[1.4] text-[color:var(--cd-danger)]"
            >
              {saveError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={!description.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
