/**
 * The arithmetic between a document offset and a run of text nodes.
 *
 * Highlights are resolved against one flat string — the reader's text, in
 * document order — but they have to be painted into a tree of elements, where
 * a single sentence can straddle an `<em>`, a link and two paragraphs. The
 * translation between the two is index bookkeeping and nothing else, so it
 * lives here, in a module with no DOM in it, and the reader is left holding
 * only the four lines that actually touch a `Range`.
 *
 * Keeping it separate is not tidiness: off-by-one errors in this direction
 * paint a stripe through the wrong words, which is the exact failure the
 * anchoring module exists to prevent, and a bug that can only be reproduced by
 * selecting text in a browser is a bug nobody reproduces.
 */

/** A span in the reader's flat text. Half-open, like every other range here. */
export interface DocumentSpan {
  start: number;
  end: number;
}

/** The part of one text node a span covers. */
export interface RunSlice {
  /** Index into the runs array that was passed in. */
  runIndex: number;
  /** Offsets within that run, not within the document. */
  start: number;
  end: number;
}

/**
 * Cut a document span into per-run slices, dropping the runs it misses.
 *
 * An empty result means the span fell entirely outside the runs — a highlight
 * anchored to content that is no longer rendered — and the caller paints
 * nothing rather than guessing.
 */
export function sliceSpan(runLengths: number[], span: DocumentSpan): RunSlice[] {
  const slices: RunSlice[] = [];
  if (span.end <= span.start) return slices;

  let offset = 0;
  for (let index = 0; index < runLengths.length; index++) {
    const length = runLengths[index];
    const runStart = offset;
    const runEnd = offset + length;
    offset = runEnd;

    if (length === 0) continue;
    if (runEnd <= span.start) continue;
    if (runStart >= span.end) break;

    slices.push({
      runIndex: index,
      start: Math.max(0, span.start - runStart),
      end: Math.min(length, span.end - runStart),
    });
  }

  return slices;
}

/**
 * Document offset for a position given as (run, offset within run).
 *
 * The direction a DOM selection arrives in. Returns `null` for a run the
 * caller does not know about, because a selection that started outside the
 * reader is not a selection of the reader's text.
 */
export function documentOffset(
  runLengths: number[],
  runIndex: number,
  offsetInRun: number
): number | null {
  if (runIndex < 0 || runIndex >= runLengths.length) return null;

  let offset = 0;
  for (let index = 0; index < runIndex; index++) offset += runLengths[index];
  return offset + Math.max(0, Math.min(runLengths[runIndex], offsetInRun));
}

/**
 * Drop overlaps so no character is painted twice.
 *
 * Two highlights over the same sentence — a re-highlight of a span already
 * kept, or two that the fuzzy stage landed on top of each other — would nest
 * `<mark>`s and double the background, which reads as a third, darker
 * highlight the reader never made. Earlier spans win; the later one keeps
 * whatever tail is still free.
 */
export function mergeDisjoint<T extends DocumentSpan>(spans: T[]): T[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const kept: T[] = [];
  let cursor = -1;

  for (const span of sorted) {
    const start = Math.max(span.start, cursor);
    if (span.end <= start) continue;
    kept.push({ ...span, start, end: span.end });
    cursor = span.end;
  }

  return kept;
}
