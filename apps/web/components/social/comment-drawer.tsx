"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CommentThread } from "./comment-thread";

/**
 * The feed's comment action — patterns.md § Social action row, and
 * decisions.md #18: **never a full thread inline in the feed**.
 *
 * A feed is a list of things worth reading; a thread expanded in place turns
 * one item into a wall and pushes the next four off the screen. So the action
 * opens the conversation *over* the feed instead: a drawer on desktop, a sheet
 * on mobile.
 *
 * Both are one component because D2's `dialog` primitive already is both — it
 * becomes a bottom sheet below 640px on its own. The only thing added here is
 * the desktop geometry: right-edge, full height, fixed width. Rebuilding the
 * sheet half would mean two overlays, two focus traps and two escape-key
 * behaviours to keep in agreement.
 *
 * The detail page does **not** use this. There the thread is the end of the
 * page, in full, because the reader has finished reading and the conversation
 * is what comes next.
 */

export interface CommentDrawerProps {
  bookmarkId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The item being discussed, so the drawer can say what it is attached to. */
  title?: string;
  /** Server count, for the heading before the thread loads. */
  commentCount?: number;
  /** Keeps the feed item's action row in step with the server's count. */
  onCountChange?: (count: number) => void;
  /** Suppresses the network entirely — the pattern gallery and tests. */
  offline?: boolean;
}

export function CommentDrawer({
  bookmarkId,
  open,
  onOpenChange,
  title,
  commentCount = 0,
  onCountChange,
  offline = false,
}: CommentDrawerProps) {
  const heading =
    commentCount === 0
      ? "Comments"
      : `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          // Desktop: a drawer against the right edge, full height, its own
          // scroll. `sm:` throughout so the primitive's bottom-sheet geometry
          // is what survives below 640px, untouched.
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0",
          "sm:h-full sm:max-h-none sm:w-[420px] sm:max-w-[92vw]",
          "sm:translate-x-0 sm:translate-y-0 sm:rounded-none",
          "sm:overflow-y-auto",
          // The primitive's centred zoom would read as a modal; a drawer
          // arrives from the edge it lives on.
          "sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right",
          "sm:data-[state=closed]:zoom-out-100 sm:data-[state=open]:zoom-in-100",
          "gap-4",
        ].join(" ")}
      >
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          {title ? (
            <DialogDescription className="line-clamp-2">
              {title}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {/* Mounted only while open, so opening the drawer is what fetches the
            thread — a feed of twenty items must not make twenty requests for
            conversations nobody has asked to see. */}
        {open ? (
          <CommentThread
            bookmarkId={bookmarkId}
            initialCount={commentCount}
            onCountChange={onCountChange}
            offline={offline}
            hideHeading
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
