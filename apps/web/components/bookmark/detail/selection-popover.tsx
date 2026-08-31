"use client";

import * as React from "react";
import { Copy, Highlighter, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * The three things a reader can do with a span of text: **Highlight**, **Copy**
 * and **Comment** — functional-spec/04-library.md § Highlights.
 *
 * Positioned over the selection rather than beside the column, because the
 * selection is what it is about and a control that appears somewhere else has
 * to be found. It is a `<div role="toolbar">` of real buttons, so it is
 * reachable from the keyboard once the selection exists; Escape dismisses it
 * and returns the reader to the text.
 *
 * Deliberately not a Radix popover: those manage focus, and stealing focus
 * from a selection collapses it in Safari — the popover would close the moment
 * it opened.
 */
export interface SelectionPopoverProps {
  /** Viewport coordinates of the selection's top-centre. */
  anchor: { x: number; y: number } | null;
  onHighlight: () => void;
  onCopy: () => void;
  /** Omitted where there is no thread to add to — the shared route. */
  onComment?: () => void;
  onDismiss: () => void;
  /** The Highlight action is the owner's; a stranger's reader hides it. */
  canHighlight?: boolean;
}

const ITEM = cn(
  "inline-flex items-center gap-1.5 rounded-xs px-2 py-1.5",
  "font-sans text-[12.5px] font-medium leading-none text-fg-secondary",
  "transition-colors duration-cd-fast ease-cd hover:bg-bg-inset hover:text-fg",
  "[&_svg]:size-[14px] [&_svg]:shrink-0 [&_svg]:[stroke-width:1.7]",
  focusRing,
);

export function SelectionPopover({
  anchor,
  onHighlight,
  onCopy,
  onComment,
  onDismiss,
  canHighlight = true,
}: SelectionPopoverProps) {
  React.useEffect(() => {
    if (!anchor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anchor, onDismiss]);

  if (!anchor) return null;

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      // `fixed`, so the coordinates are the ones the browser just gave us for
      // the selection rect and no ancestor's transform can move them.
      style={{ left: anchor.x, top: anchor.y }}
      className={cn(
        "fixed z-50 -translate-x-1/2 -translate-y-full",
        "flex items-center gap-0.5 rounded-md border border-line",
        "bg-bg-panel p-1 shadow-[var(--cd-shadow-popover)]",
      )}
      // The pointer-down that would otherwise clear the selection before the
      // click lands on the button.
      onMouseDown={(event) => event.preventDefault()}
    >
      {canHighlight ? (
        <button type="button" className={ITEM} onClick={onHighlight}>
          <Highlighter aria-hidden="true" />
          Highlight
        </button>
      ) : null}
      <button type="button" className={ITEM} onClick={onCopy}>
        <Copy aria-hidden="true" />
        Copy
      </button>
      {onComment ? (
        <button type="button" className={ITEM} onClick={onComment}>
          <MessageCircle aria-hidden="true" />
          Comment
        </button>
      ) : null}
    </div>
  );
}
