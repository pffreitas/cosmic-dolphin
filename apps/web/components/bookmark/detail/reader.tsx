"use client";

import * as React from "react";
import { Highlight } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalToast } from "@/components/ui/toast";
import {
  createAnchor,
  resolveHighlights,
  type HighlightAnchor,
} from "@/lib/reading/highlight-anchor";
import {
  documentOffset,
  mergeDisjoint,
  sliceSpan,
} from "./highlight-spans";
import { ReaderProse } from "./reader-prose";
import { SelectionPopover } from "./selection-popover";

/**
 * The reading surface.
 *
 * Three things happen here that do not happen anywhere else in the product,
 * and each of them is a reason this is a component rather than a `<div>`:
 *
 *  - **Highlights are painted into the rendered DOM**, not into the markdown.
 *    They are anchored by quote-plus-context against the *rendered text*, so
 *    they have to be resolved after the renderer has had its say. Painting is
 *    a `<mark>` per text node the span touches, and it is undone before it is
 *    redone, so the effect is idempotent under React's double-invoked effects.
 *
 *  - **A selection becomes an anchor** through `createAnchor` over the same
 *    flat text the resolver reads, which is what makes a highlight made now
 *    survive the next re-extraction.
 *
 *  - **Progress is measured against this element**, not the window. The page
 *    also carries a hero, a brief and a comment thread; counting those would
 *    report a reader as finished somewhere in the second paragraph.
 *
 * Progress writing itself is `ReadingProgressTracker`'s job — 5s throttle,
 * leading edge, trailing write, flush on unmount. This component only feeds it
 * numbers and tells its owner when 90% goes past, because what happens at 90%
 * is a product decision (a suggestion, never a silent write) and this
 * component should not be making it.
 */
export interface ReaderProps {
  /** Markdown. Absent while the pipeline is still working. */
  body?: string;
  /** The reader's own highlights. Empty on the shared route, always. */
  highlights?: Highlight[];
  /** Persist a new highlight. Absent ⇒ the Highlight action is not offered. */
  onCreateHighlight?: (anchor: HighlightAnchor) => void | Promise<void>;
  /** Opens the thread with the quote in hand. Absent ⇒ no Comment action. */
  onComment?: (quote: string) => void;
  /**
   * Percent as the reader scrolls, already clamped and rounded. Called on
   * every scroll frame; throttling is the caller's, so that one tracker owns
   * both the cadence and the flush.
   */
  onProgress?: (percent: number, scrollOffset: number) => void;
  /** Pixels from the top of the reader to restore before recording begins. */
  restoreScrollOffset?: number | null;
  /** Renders the skeleton instead of prose — the processing state. */
  loading?: boolean;
  className?: string;
}

/** Text nodes of the reader, in document order. */
function textRuns(root: HTMLElement): Text[] {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const runs: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    runs.push(node as Text);
    node = walker.nextNode();
  }
  return runs;
}

/** Undo a previous paint so the next one starts from the renderer's own DOM. */
function unpaint(root: HTMLElement): void {
  root.querySelectorAll("mark[data-cd-highlight]").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  // Splitting left a trail of adjacent text nodes; rejoin them so the run
  // list is the same one the renderer would have produced.
  root.normalize();
}

function paint(
  root: HTMLElement,
  spans: { start: number; end: number; id: string }[],
): void {
  const runs = textRuns(root);
  const lengths = runs.map((run) => run.data.length);

  const slices = spans
    .flatMap((span) =>
      sliceSpan(lengths, span).map((slice) => ({ ...slice, id: span.id })),
    )
    // Back to front. Splitting a text node invalidates every offset after the
    // split, so the last slice is applied first and the earlier ones are
    // still talking about the node they were measured against.
    .sort((a, b) => b.runIndex - a.runIndex || b.start - a.start);

  for (const slice of slices) {
    const run = runs[slice.runIndex];
    if (!run.parentNode) continue;

    const middle = run.splitText(slice.start);
    middle.splitText(slice.end - slice.start);

    const mark = root.ownerDocument.createElement("mark");
    mark.setAttribute("data-cd-highlight", slice.id);
    middle.parentNode?.replaceChild(mark, middle);
    mark.appendChild(middle);
  }
}

export function Reader({
  body,
  highlights,
  onCreateHighlight,
  onComment,
  onProgress,
  restoreScrollOffset,
  loading = false,
  className,
}: ReaderProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const toast = useOptionalToast();

  const [selection, setSelection] = React.useState<{
    anchor: { x: number; y: number };
    quote: string;
    range: { start: number; end: number };
    document: string;
  } | null>(null);

  // ---- highlights ------------------------------------------------------
  //
  // A layout effect, so a highlight is never on screen unpainted for a frame.
  // It re-runs on `body` because the renderer replaces the DOM underneath us
  // when the content changes, and on `highlights` because that is the point.
  React.useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || loading) return;
    // Captured, not re-read in the cleanup: by then the ref may already point
    // at the next mount's element, and unpainting that one would strip marks
    // the new effect just applied.

    unpaint(root);
    if (!highlights?.length) return;

    const documentText = textRuns(root)
      .map((run) => run.data)
      .join("");

    const resolved = resolveHighlights(documentText, highlights)
      .filter((entry) => entry.resolved !== null)
      .map((entry) => ({
        id: entry.anchor.id,
        start: entry.resolved!.start,
        end: entry.resolved!.end,
      }));

    // An orphaned highlight is simply not painted. That is the honest
    // outcome — the anchoring module went to some trouble to be able to say
    // "I could not place this" instead of guessing, and painting a guess here
    // would throw that away.
    paint(root, mergeDisjoint(resolved));

    return () => unpaint(root);
  }, [body, highlights, loading]);

  // ---- selection -------------------------------------------------------
  const readSelection = React.useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    const active = root.ownerDocument.getSelection();
    if (!active || active.isCollapsed || active.rangeCount === 0) {
      setSelection(null);
      return;
    }

    const range = active.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      setSelection(null);
      return;
    }

    const runs = textRuns(root);
    const lengths = runs.map((run) => run.data.length);
    const startIndex = runs.indexOf(range.startContainer as Text);
    const endIndex = runs.indexOf(range.endContainer as Text);

    const start = documentOffset(lengths, startIndex, range.startOffset);
    const end = documentOffset(lengths, endIndex, range.endOffset);
    if (start === null || end === null || end <= start) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setSelection({
      anchor: { x: rect.left + rect.width / 2, y: rect.top - 8 },
      quote: active.toString(),
      range: { start, end },
      document: runs.map((run) => run.data).join(""),
    });
  }, []);

  const dismiss = React.useCallback(() => setSelection(null), []);

  const copy = React.useCallback(async () => {
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection.quote);
      toast?.toast({ title: "Copied" });
    } catch {
      toast?.toast({ title: "Couldn't copy that", variant: "danger" });
    }
    dismiss();
  }, [dismiss, selection, toast]);

  const highlight = React.useCallback(() => {
    if (!selection || !onCreateHighlight) return;
    void onCreateHighlight(
      createAnchor(selection.document, selection.range.start, selection.range.end),
    );
    containerRef.current?.ownerDocument.getSelection()?.removeAllRanges();
    dismiss();
  }, [dismiss, onCreateHighlight, selection]);

  // ---- restore ---------------------------------------------------------
  //
  // Declared BEFORE the progress effect on purpose. Effects run in order, so
  // if recording started first its opening report would be "the reader is at
  // the top of the page" — written at the moment the reader is about to be
  // put back where they left off, and overwriting the very position being
  // restored. This is the ordering that makes progress survive a reload.
  //
  // Exactly once, too: a second restore would drag a reader who had already
  // moved on back to where they were an hour ago.
  const restored = React.useRef(false);
  React.useEffect(() => {
    if (restored.current || loading) return;
    const root = containerRef.current;
    if (!root || !restoreScrollOffset) return;

    // A detached node measures as a zero rect, and a zero rect turns the
    // absolute position below into "wherever the page happens to be scrolled
    // to" — which scrolls a second time by the offset instead of landing on
    // it. Dev remounts hand us exactly that node, so the guard is not
    // theoretical.
    if (!root.isConnected) return;

    restored.current = true;

    // The browser restores a scroll position on reload too, asynchronously
    // and from its own record — which on this page is a second opinion about
    // where the reader was, arriving after ours and disagreeing with it. We
    // have the authoritative answer, so we take the job.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    // Measured in a frame of its own, and then checked against where we
    // already are. Both halves matter:
    //
    //   - The rect is viewport-relative, so it only becomes an absolute
    //     position when added to a scroll offset read at the same instant. In
    //     an effect that fires while a previous scroll is still settling,
    //     those two numbers come from different moments and their sum is a
    //     position that never existed.
    //
    //   - A remount — dev double-mounts, Fast Refresh — runs this again with
    //     a ref that has been reset. Recomputing the same absolute target and
    //     finding we are already on it is what makes the second run a no-op
    //     rather than a second scroll of the same distance.
    const frame = requestAnimationFrame(() => {
      if (!root.isConnected) return;
      const target =
        window.scrollY + root.getBoundingClientRect().top + restoreScrollOffset;
      if (Math.abs(window.scrollY - target) < 2) return;

      window.scrollTo({
        top: target,
        // Jumping, not gliding: this is where the reader already was, and
        // animating to it makes a restore look like the page moving on its
        // own.
        behavior: "auto",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [loading, restoreScrollOffset]);

  // ---- progress --------------------------------------------------------
  //
  // One listener, no throttle: the tracker the caller owns decides what is
  // worth sending, and a `passive` handler that only reads two numbers is
  // cheaper than the bookkeeping needed to skip it.
  React.useEffect(() => {
    const root = containerRef.current;
    if (!root || !onProgress || loading) return;

    const report = () => {
      const box = root.getBoundingClientRect();
      const height = root.offsetHeight;
      if (height <= 0) return;

      // How far past the top of the reader the viewport's bottom edge is.
      const seen = window.innerHeight - box.top;
      const percent = Math.round(
        Math.min(100, Math.max(0, (seen / height) * 100)),
      );
      onProgress(percent, Math.max(0, Math.round(-box.top)));
    };

    report();
    window.addEventListener("scroll", report, { passive: true });
    window.addEventListener("resize", report);
    return () => {
      window.removeEventListener("scroll", report);
      window.removeEventListener("resize", report);
    };
  }, [loading, onProgress]);

  if (loading) {
    return (
      <div className={cn("max-w-[var(--cd-measure)]", className)} aria-hidden="true">
        <ReaderSkeleton />
      </div>
    );
  }

  if (!body) return null;

  return (
    <div className={className}>
      <div
        ref={containerRef}
        data-detail-slot="reader"
        onMouseUp={readSelection}
        onKeyUp={readSelection}
        onBlur={dismiss}
      >
        <ReaderProse body={body} />
      </div>
      <SelectionPopover
        anchor={selection?.anchor ?? null}
        canHighlight={Boolean(onCreateHighlight)}
        onHighlight={highlight}
        onCopy={copy}
        onComment={
          onComment && selection
            ? () => {
                onComment(selection.quote);
                dismiss();
              }
            : undefined
        }
        onDismiss={dismiss}
      />
    </div>
  );
}

/**
 * The reader while the pipeline is still working.
 *
 * Paragraph-shaped rather than a grey block, and with a short last line in
 * each group, because the thing arriving is prose and the skeleton's job is
 * to reserve the space it will take.
 */
export function ReaderSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      {[0, 1, 2].map((group) => (
        <div key={group} className="flex flex-col gap-[11px]">
          <Skeleton shape="line" />
          <Skeleton shape="line" />
          <Skeleton shape="line" />
          <Skeleton shape="line" className="w-[62%]" />
        </div>
      ))}
    </div>
  );
}
