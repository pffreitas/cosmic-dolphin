"use client";

import { useEffect, useState } from "react";
import { Bookmark, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearErrors, saveCapture } from "@/lib/store/slices/bookmarksSlice";
import { isCaptureUrl } from "@/lib/capture";
import PrivateLinkDialog from "./private-link-dialog";
import { useCaptureToast } from "./capture-toast";

/**
 * Save a link.
 *
 * The rule, from docs/functional-spec/02-capture.md: **saving never blocks**.
 * So this dialog does exactly one thing on submit — hands the URL to
 * `saveCapture` and closes. The optimistic row appears immediately
 * (`<PendingCaptures />`), `POST /bookmarks/preview` is fired and never
 * awaited, and the answer arrives as a toast.
 *
 * What this replaced: a full-screen `fixed inset-0` overlay that disabled the
 * field, awaited the preview, then awaited the save, then navigated. Three
 * round trips of dead time in front of the most-used action in the product.
 *
 * The URL field is the one pill input in the product — see
 * docs/design-system/components.md#input-textarea-select.
 *
 * Two things keep the dialog open rather than closing it:
 *
 *   - a malformed URL, rejected inline at the field before any request;
 *   - a 429, which keeps the URL in the field and shows the wait.
 */
export default function NewBookmarkButton() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [privateLinkDialogOpen, setPrivateLinkDialogOpen] = useState(false);
  const [privateLinkUrl, setPrivateLinkUrl] = useState("");
  /**
   * Whether this field has submitted anything yet. The rate-limit message is
   * the store's, and the store outlives the dialog — without this the wait
   * could greet a user who has not pressed Save.
   */
  const [submitted, setSubmitted] = useState(false);

  const dispatch = useAppDispatch();
  const announce = useCaptureToast();
  const rateLimit = useAppSelector((state) => state.bookmarks.createRateLimit);

  const openDialog = () => {
    setInvalid(false);
    setSubmitted(false);
    dispatch(clearErrors());
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setUrl("");
      setInvalid(false);
      setSubmitted(false);
      dispatch(clearErrors());
    }
  };

  /**
   * The one submit path. Typing Enter, pressing Save and pasting into an empty
   * field all end up here so they cannot drift apart.
   */
  const submit = async (candidate: string) => {
    // Malformed URLs are rejected at the field, before a request exists.
    if (!isCaptureUrl(candidate)) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    setSubmitted(true);
    dispatch(clearErrors());

    // Closed optimistically. The row is already on screen behind it, and the
    // outcome arrives as a toast — there is nothing here left to watch.
    setOpen(false);
    setUrl("");

    const result = await dispatch(saveCapture({ url: candidate }));

    if (saveCapture.fulfilled.match(result)) {
      announce(result.payload);
      return;
    }

    // A 429 is the one failure that belongs at the field: the user still has
    // the URL and the only useful thing to say is how long to wait.
    if (result.payload?.retryIn) {
      setUrl(candidate);
      setOpen(true);
    }
    // Every other failure is already an inline error with Retry on the row.
  };

  const handleSubmit = () => {
    void submit(url);
  };

  const handlePrivateLink = () => {
    if (!isCaptureUrl(url)) {
      setInvalid(true);
      return;
    }
    setPrivateLinkUrl(url);
    setOpen(false);
    setPrivateLinkDialogOpen(true);
  };

  const handlePrivateLinkDialogChange = (next: boolean) => {
    setPrivateLinkDialogOpen(next);
    if (!next) {
      // `privateLinkUrl` deliberately survives the close: a rate-limited save
      // re-opens the dialog with the URL and the note the user already wrote.
      setUrl("");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        openDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const helperId = "new-bookmark-help";
  const showRateLimit = Boolean(rateLimit) && submitted;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          onOpenAutoFocus={(event) => {
            // Radix focuses the panel; the field is the only thing here.
            event.preventDefault();
            (
              document.getElementById("new-bookmark-url") as HTMLInputElement | null
            )?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Save a link</DialogTitle>
            <DialogDescription>
              Paste a URL. It appears in your library straight away — the
              summary catches up.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Input
              id="new-bookmark-url"
              shape="pill"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={url}
              aria-invalid={invalid || showRateLimit}
              aria-describedby={
                invalid || showRateLimit ? helperId : undefined
              }
              onChange={(event) => {
                setUrl(event.target.value);
                if (invalid) setInvalid(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              // ⌘V into an empty field submits on paste.
              onPaste={(event) => {
                if (url.trim()) return;
                const pasted = event.clipboardData.getData("text");
                if (!isCaptureUrl(pasted)) return;
                event.preventDefault();
                void submit(pasted);
              }}
            />

            {invalid ? (
              <p
                id={helperId}
                className="font-sans text-[12.5px] leading-[1.4] text-[color:var(--cd-danger)]"
              >
                That does not look like a link. Check the address and try again.
              </p>
            ) : showRateLimit ? (
              <p
                id={helperId}
                className="font-sans text-[12.5px] leading-[1.4] text-[color:var(--cd-warning)]"
              >
                {rateLimit!.message} Your link is still here — try again in{" "}
                {rateLimit!.retryIn}.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              icon={<Lock aria-hidden="true" />}
              onClick={handlePrivateLink}
            >
              Behind a login
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrivateLinkDialog
        open={privateLinkDialogOpen}
        onOpenChange={handlePrivateLinkDialogChange}
        url={privateLinkUrl}
      />

      <Button
        id="new-bookmark-button"
        type="button"
        variant="primary"
        icon={<Bookmark aria-hidden="true" />}
        onClick={openDialog}
      >
        Save Bookmark
      </Button>
    </>
  );
}
