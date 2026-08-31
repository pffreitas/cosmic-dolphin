"use client";

import * as React from "react";
import { PencilLine } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { PrivateLinkNote } from "@/components/bookmark/private-link-note";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";

/**
 * The private-link state: the `--cd-warning` note, and the invitation.
 *
 * A page behind auth has no AI summary and never will — the fetcher cannot
 * read it, and no amount of retrying changes that, which is why this carries
 * the warning colour and not the danger one and never offers Retry. What it
 * does offer is the only thing that helps: somewhere to write the summary
 * yourself.
 *
 * It writes `cosmicSummary`, the same field the pipeline would have filled, so
 * what the user types is rendered by the same reader as everything else and
 * searched by the same index. There is no second "user notes" field to keep in
 * sync, and on a private link there is nothing for it to collide with.
 */
export interface OwnSummaryProps {
  bookmarkId: string;
  /** What is already there, AI-written or hand-written. */
  initialSummary?: string;
  /** A stranger reading a shared private link gets the note and no editor. */
  editable?: boolean;
  /** Lets the reader repaint with what was just written. */
  onSaved?: (summary: string) => void;
  className?: string;
}

export function OwnSummary({
  bookmarkId,
  initialSummary,
  editable = true,
  onSaved,
  className,
}: OwnSummaryProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(initialSummary ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await BookmarksClientAPI.update(bookmarkId, { cosmicSummary: draft });
      onSaved?.(draft);
      setOpen(false);
      toast({ title: "Summary saved", variant: "success" });
    } catch {
      toast({ title: "Couldn't save that summary", variant: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <PrivateLinkNote
        action={
          editable && !open ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              icon={<PencilLine aria-hidden="true" />}
            >
              {initialSummary ? "Edit your summary" : "Write your own"}
            </Button>
          ) : undefined
        }
      >
        <span className="font-medium text-fg">Private link.</span> Cosmic
        couldn&apos;t read this page, so there is no brief — but your own words
        about it are worth more than one anyway.
      </PrivateLinkNote>

      {open ? (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`own-summary-${bookmarkId}`}
            className="font-sans text-[12.5px] font-medium text-fg-secondary"
          >
            Your summary
          </label>
          <Textarea
            id={`own-summary-${bookmarkId}`}
            value={draft}
            autoFocus
            rows={6}
            placeholder="What is worth remembering about this page?"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void save()}
              loading={saving}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(initialSummary ?? "");
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
