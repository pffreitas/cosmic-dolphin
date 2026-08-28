"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOptionalToast } from "@/components/ui/toast";
import {
  CommentRequestError,
  CommentsClientAPI,
} from "@/lib/api/comments-client";

/**
 * Report a public bookmark or a comment.
 *
 * The copy is doing real work here. It says the report goes to a person, and it
 * says — plainly, in the dialog, before the user commits — that the content
 * **stays visible**. That is not a caveat buried in a help page: someone
 * reporting abuse and then watching it remain on screen would reasonably assume
 * the report failed, and would report it again, and again. Telling them what
 * will happen is what makes a queue with no auto-hide survivable.
 *
 * Auto-hide is what this deliberately does not do. A hide-on-report rule is
 * trivially weaponised — one motivated account silences anything — so nothing
 * in this component, or behind it, changes what anyone can see.
 *
 * Below 640px D2's dialog is already a bottom sheet, so this needs no mobile
 * variant of its own.
 */

export type ReportTarget = { bookmarkId: string } | { commentId: string };

export interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` while nothing is being reported; the dialog is then closed. */
  target: ReportTarget | null;
  /** What the user thinks they are reporting. Used in the copy only. */
  subject: "comment" | "bookmark";
}

export function ReportDialog({
  open,
  onOpenChange,
  target,
  subject,
}: ReportDialogProps) {
  const toast = useOptionalToast();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // A reason typed for one comment must not be waiting in the box for the
  // next one.
  React.useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const trimmed = reason.trim();

  const submit = async () => {
    if (!target || trimmed.length === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await CommentsClientAPI.report(target, trimmed);
      onOpenChange(false);
      toast?.toast({
        title: "Report received",
        description: "Someone will review it. Nothing changes in the meantime.",
      });
    } catch (caught) {
      setError(
        caught instanceof CommentRequestError
          ? caught.message
          : "Couldn't send that report. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Report this {subject}</DialogTitle>
          <DialogDescription>
            Tell us what is wrong with it. A person reads every report. The{" "}
            {subject} stays visible while it is reviewed.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          autoFocus
          maxLength={1000}
          placeholder="What is wrong with it?"
          aria-label="Reason for reporting"
          disabled={submitting}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-[96px]"
        />

        {error ? (
          <p className="font-sans text-[12.5px] leading-[1.4] text-[color:var(--cd-danger)]">
            {error}
          </p>
        ) : null}

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
            disabled={trimmed.length === 0 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
