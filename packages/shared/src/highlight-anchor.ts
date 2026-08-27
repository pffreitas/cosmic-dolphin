/**
 * Where a highlight lives in a document that keeps changing under it.
 *
 * A highlight is stored as three strings — the `quote` the reader selected,
 * and a short `prefix`/`suffix` of the text either side — and never as a
 * character offset. Offsets are the obvious representation and the wrong one:
 * the pipeline re-extracts a page whenever it is reprocessed, and extraction is
 * not stable. A nav bar that used to survive the readability pass stops
 * surviving it, a cookie banner appears, a paragraph gets an em dash where it
 * had a hyphen — and every offset in the document moves. Stored offsets do not
 * *fail* in that case, which is the problem: they silently point at a different
 * sentence.
 *
 * So resolution is a search, and it is deliberately staged from most to least
 * certain. Each stage answers a different way the document can have changed:
 *
 *   1. **Exact quote, context-scored.** The quote still occurs verbatim. If it
 *      occurs once we are done; if it occurs several times — a repeated
 *      sentence, a pull-quote echoing the body — the stored prefix and suffix
 *      pick which one. This is the overwhelmingly common case, and it is the
 *      one plain offsets get wrong: the text is untouched, only its position
 *      moved.
 *
 *   2. **Context-anchored.** The quote's own words changed (a typo fix, a
 *      smart-quote substitution) but its surroundings did not. Find the prefix
 *      and suffix, and take what sits between them.
 *
 *   3. **Fuzzy.** Neither survived intact. Seed candidate positions from the
 *      quote's own head and tail shingles and from the context, then accept the
 *      best window within a bounded edit distance.
 *
 * A highlight that matches none of them resolves to `null` — *orphaned*, which
 * the reader can show as a note beside the text rather than a wrong stripe
 * through it. Reporting an orphan is a correct outcome; guessing is not.
 *
 * Everything here is pure and synchronous: no DOM, no database. The reader
 * (D10) calls `resolveHighlight` against the extracted content it is about to
 * render, and `createAnchor` when a new selection is made.
 */

/** ~32 characters either side of the quote. See `createAnchor`. */
export const HIGHLIGHT_CONTEXT_LENGTH = 32;

/** Longest quote we will store, and therefore search for. */
export const MAX_HIGHLIGHT_QUOTE_LENGTH = 2000;

/** Longest note attachable to a highlight. */
export const MAX_HIGHLIGHT_NOTE_LENGTH = 2000;

/**
 * How much of a quote may have changed and still be the same quote.
 *
 * A quarter is generous on purpose: the failure we are guarding against is a
 * *wrong* match, and stage 3 only runs after two stricter stages have declined,
 * with candidate positions already pinned by surviving text. A tighter
 * threshold orphans highlights over a single re-typeset dash.
 */
const FUZZY_MAX_ERROR_RATIO = 0.25;

/** Length of the head/tail shingles that seed fuzzy candidates. */
const SHINGLE_LENGTH = 24;

/** Guard rail: never score more than this many candidate windows. */
const MAX_FUZZY_CANDIDATES = 64;

/** The three strings a highlight is anchored by. */
export interface HighlightAnchor {
  quote: string;
  prefix?: string | null;
  suffix?: string | null;
}

/** How a highlight was re-found. Surfaced so the reader can say so. */
export type HighlightAnchorMethod = "exact" | "context" | "fuzzy";

export interface ResolvedHighlight {
  /** Index into the document string passed in, inclusive. */
  start: number;
  /** Index into the document string passed in, exclusive. */
  end: number;
  /** The text actually found, which may differ from the stored quote. */
  text: string;
  /** Which stage resolved it. */
  method: HighlightAnchorMethod;
  /**
   * 0–1. `1` is an exact quote whose context also matches exactly. Ranks
   * competing matches; it is not a probability of anything.
   */
  score: number;
}

/**
 * A normalised copy of a string, plus the way back.
 *
 * Matching has to ignore whitespace: extraction turns a wrapped paragraph into
 * one line, or one line into three, without changing a word. So we collapse
 * every run of whitespace to a single space before searching — and keep
 * `offsets[i]`, the index in the original string of normalised character `i`,
 * so a match can be reported in the caller's own coordinates. Without that map
 * this module would return positions into a string the caller never has.
 */
interface NormalisedText {
  text: string;
  /** `offsets[i]` — index in the source of normalised character `i`. */
  offsets: number[];
  /** Lower-cased `text`, character-for-character. Used for comparison only. */
  folded: string;
}

/**
 * Lower-case without changing the length.
 *
 * A handful of characters (ß, İ, ﬁ) grow when lower-cased, which would break
 * the one-to-one index map that makes the offsets meaningful. Those keep their
 * original form: losing case-insensitivity on three characters is a far smaller
 * problem than a match reported at the wrong index.
 */
function foldChar(char: string): string {
  const lowered = char.toLowerCase();
  return lowered.length === 1 ? lowered : char;
}

export function normaliseText(source: string): NormalisedText {
  const chars: string[] = [];
  const offsets: number[] = [];
  let pendingSpace = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (/\s/.test(char)) {
      // A run of whitespace of any kind becomes one space — but only once we
      // know something follows it, so the normalised form never ends in one.
      if (chars.length > 0) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      chars.push(" ");
      // The space stands for the whole run; point it at the run's first
      // character so a match starting on it maps to a sensible place.
      offsets.push(i);
      pendingSpace = false;
    }
    chars.push(char);
    offsets.push(i);
  }

  const text = chars.join("");
  return {
    text,
    offsets,
    folded: chars.map(foldChar).join(""),
  };
}

/**
 * Map a span in normalised coordinates back to the source string.
 *
 * `end` is exclusive, so it maps through the *last included* character and then
 * runs one past it — `offsets[end]` would be the start of the next character,
 * which is not the same thing once whitespace has been collapsed.
 */
function toSourceSpan(
  normalised: NormalisedText,
  start: number,
  end: number,
  source: string
): { start: number; end: number } {
  if (end <= start) {
    const at = normalised.offsets[start] ?? source.length;
    return { start: at, end: at };
  }
  const sourceStart = normalised.offsets[start];
  const lastIndex = normalised.offsets[end - 1];
  return { start: sourceStart, end: lastIndex + 1 };
}

/** Every index at which `needle` occurs in `haystack`. */
function findAll(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + 1;
  }
}

/** Length of the longest common suffix of two strings. */
function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
    n++;
  }
  return n;
}

/** Length of the longest common prefix of two strings. */
function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * How well the document around `[start, end)` agrees with the stored context.
 *
 * Partial credit, not a yes/no: after a re-extraction the character
 * immediately before a quote is often the same while the one thirty characters
 * back is not, and a boolean would throw away the only signal that
 * distinguishes two otherwise identical candidates. Returns 1 when there is no
 * context to check, so an anchor stored without one is never penalised.
 *
 * The window is widened by one character and then trimmed, which is not
 * fussiness: `createAnchor` stores the context trimmed, so a stored prefix ends
 * on a word while the document at that point ends on the space before the
 * quote. Comparing the two as-is misaligns every anchor by that one space and
 * scores a perfect context as a total mismatch — which is exactly how the
 * "pick the right one of three identical sentences" case fails.
 */
function contextScore(
  documentFolded: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string
): number {
  const total = prefix.length + suffix.length;
  if (total === 0) return 1;

  const before = trimEnd(
    documentFolded.slice(Math.max(0, start - prefix.length - 1), start)
  );
  const after = trimStart(documentFolded.slice(end, end + suffix.length + 1));

  const matched =
    commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);

  return matched / total;
}

function trimStart(value: string): string {
  return value.replace(/^\s+/, "");
}

function trimEnd(value: string): string {
  return value.replace(/\s+$/, "");
}

/** First non-space index at or after `index`, in a whitespace-collapsed string. */
function skipSpaceForward(text: string, index: number): number {
  let at = index;
  while (at < text.length && text[at] === " ") at++;
  return at;
}

/** Index one past the last non-space character before `index`. */
function skipSpaceBackward(text: string, index: number): number {
  let at = index;
  while (at > 0 && text[at - 1] === " ") at--;
  return at;
}

/**
 * Levenshtein distance, abandoned as soon as it exceeds `maxDistance`.
 *
 * The bound is what makes stage 3 affordable: a candidate window that is
 * obviously not the quote is rejected after a few rows instead of a full
 * quadratic pass, and quotes are capped at `MAX_HIGHLIGHT_QUOTE_LENGTH` so the
 * worst case is bounded too.
 *
 * Returns `maxDistance + 1` to mean "further away than you asked about".
 */
export function boundedLevenshtein(
  a: string,
  b: string,
  maxDistance: number
): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = previous[j] + 1;
      const insertion = current[j - 1] + 1;
      current[j] = Math.min(substitution, deletion, insertion);
      if (current[j] < rowMin) rowMin = current[j];
    }

    // Every remaining row can only add to the minimum, so once the whole row
    // is past the bound no completion of this alignment can come back under it.
    if (rowMin > maxDistance) return maxDistance + 1;

    const swap = previous;
    previous = current;
    current = swap;
  }

  const distance = previous[b.length];
  return distance > maxDistance ? maxDistance + 1 : distance;
}

interface Candidate {
  start: number;
  end: number;
  score: number;
  method: HighlightAnchorMethod;
}

/** Stage 1 — the quote still occurs verbatim; context breaks any tie. */
function resolveExact(
  document: NormalisedText,
  quote: string,
  prefix: string,
  suffix: string
): Candidate | null {
  const occurrences = findAll(document.folded, quote);
  if (occurrences.length === 0) return null;

  let best: Candidate | null = null;
  for (const start of occurrences) {
    const end = start + quote.length;
    // Weighted so an exact quote always outranks anything stage 2 or 3 can
    // produce, however good that one's context is.
    const score =
      0.75 + 0.25 * contextScore(document.folded, start, end, prefix, suffix);
    if (!best || score > best.score) {
      best = { start, end, score, method: "exact" };
    }
  }
  return best;
}

/**
 * Stage 2 — the surroundings survived even though the quote did not.
 *
 * Takes the text sitting between a prefix occurrence and the next suffix
 * occurrence, and only accepts it if its length is in the same neighbourhood as
 * the quote's. Without that length check this stage will happily "resolve" a
 * highlight to three paragraphs because the prefix and suffix drifted apart.
 */
function resolveByContext(
  document: NormalisedText,
  quote: string,
  prefix: string,
  suffix: string
): Candidate | null {
  if (!prefix && !suffix) return null;

  const slack = Math.max(16, Math.ceil(quote.length * 0.5));
  let best: Candidate | null = null;

  const prefixHits = prefix ? findAll(document.folded, prefix) : [];
  const suffixHits = suffix ? findAll(document.folded, suffix) : [];

  if (prefix && suffix) {
    for (const p of prefixHits) {
      // The stored context is trimmed and the document is not, so the
      // character after a prefix match is the space the quote starts after.
      // Same, mirrored, at the suffix end.
      const from = skipSpaceForward(document.folded, p + prefix.length);
      const hit = suffixHits.find((at) => at >= from);
      if (hit === undefined) continue;
      const s = skipSpaceBackward(document.folded, hit);
      const length = s - from;
      if (Math.abs(length - quote.length) > slack) continue;
      const score = 0.5 + 0.2 * (1 - Math.abs(length - quote.length) / (slack || 1));
      if (!best || score > best.score) {
        best = { start: from, end: s, score, method: "context" };
      }
    }
    if (best) return best;
  }

  // One side only: take the quote's length on faith from the side we have.
  //
  // This is the weakest evidence in the module — 32 characters on one side and
  // a guessed length — so it carries a loose similarity gate the two-sided
  // branch does not need. Without it, a prefix that happens to survive
  // somewhere else in the document hands back whatever text follows it,
  // confidently and wrongly. Half the quote may have changed and still pass;
  // an unrelated paragraph will not.
  const single = prefix
    ? prefixHits.map((p) => {
        const start = skipSpaceForward(document.folded, p + prefix.length);
        return { start, end: start + quote.length };
      })
    : suffixHits.map((hit) => {
        const end = skipSpaceBackward(document.folded, hit);
        return { start: end - quote.length, end };
      });

  const looseBound = Math.floor(quote.length * 0.6);

  for (const span of single) {
    if (span.start < 0 || span.end > document.folded.length) continue;
    const window = document.folded.slice(span.start, span.end);
    if (boundedLevenshtein(window, quote, looseBound) > looseBound) continue;
    const score = 0.45;
    if (!best || score > best.score) {
      best = { ...span, score, method: "context" };
    }
  }

  return best;
}

/**
 * Candidate start positions for the fuzzy pass.
 *
 * Seeded rather than scanned: sliding a bounded-Levenshtein window across a
 * whole article is affordable but wasteful, and the seeds are better signal
 * anyway. A quote whose middle was edited still begins or ends the same way; a
 * quote edited at both ends still sits where its context puts it.
 */
function fuzzyCandidateStarts(
  document: NormalisedText,
  quote: string,
  prefix: string,
  suffix: string
): number[] {
  const starts = new Set<number>();
  const shingle = Math.min(SHINGLE_LENGTH, quote.length);

  for (const at of findAll(document.folded, quote.slice(0, shingle))) {
    starts.add(at);
  }
  for (const at of findAll(document.folded, quote.slice(quote.length - shingle))) {
    starts.add(Math.max(0, at + shingle - quote.length));
  }
  if (prefix) {
    for (const at of findAll(document.folded, prefix)) {
      starts.add(skipSpaceForward(document.folded, at + prefix.length));
    }
  }
  if (suffix) {
    for (const at of findAll(document.folded, suffix)) {
      const end = skipSpaceBackward(document.folded, at);
      starts.add(Math.max(0, end - quote.length));
    }
  }

  return [...starts].slice(0, MAX_FUZZY_CANDIDATES);
}

/** Stage 3 — best bounded-edit-distance window among the seeded candidates. */
function resolveFuzzy(
  document: NormalisedText,
  quote: string,
  prefix: string,
  suffix: string
): Candidate | null {
  const maxDistance = Math.floor(quote.length * FUZZY_MAX_ERROR_RATIO);
  if (maxDistance < 1) return null;

  const starts = fuzzyCandidateStarts(document, quote, prefix, suffix);
  if (starts.length === 0) return null;

  // The re-extracted span may be a little shorter or longer than what was
  // stored, so try a few lengths around it rather than only the exact one.
  const lengths = [
    quote.length,
    quote.length - maxDistance,
    quote.length + maxDistance,
  ].filter((length) => length > 0);

  let best: Candidate | null = null;

  for (const start of starts) {
    for (const length of lengths) {
      const end = Math.min(document.folded.length, start + length);
      if (end <= start) continue;
      const window = document.folded.slice(start, end);
      const distance = boundedLevenshtein(window, quote, maxDistance);
      if (distance > maxDistance) continue;

      const similarity = 1 - distance / quote.length;
      const score =
        0.4 *
        (0.7 * similarity +
          0.3 * contextScore(document.folded, start, end, prefix, suffix));

      if (!best || score > best.score) {
        best = { start, end, score, method: "fuzzy" };
      }
    }
  }

  return best;
}

/**
 * Find a stored highlight in a document, or report that it is orphaned.
 *
 * `document` is the extracted content as it stands *now*; the anchor is what
 * was stored, possibly against an earlier extraction of the same page. Returns
 * positions in `document`'s own coordinates, or `null` when no stage could
 * place it — which is the honest answer, and the one the reader renders as an
 * orphaned highlight rather than as a stripe through the wrong sentence.
 */
export function resolveHighlight(
  document: string,
  anchor: HighlightAnchor
): ResolvedHighlight | null {
  const quoteNormalised = normaliseText(anchor.quote ?? "");
  const quote = quoteNormalised.folded;
  if (!quote) return null;

  const normalisedDocument = normaliseText(document);
  if (!normalisedDocument.folded) return null;

  const prefix = normaliseText(anchor.prefix ?? "").folded;
  const suffix = normaliseText(anchor.suffix ?? "").folded;

  const candidate =
    resolveExact(normalisedDocument, quote, prefix, suffix) ??
    resolveByContext(normalisedDocument, quote, prefix, suffix) ??
    resolveFuzzy(normalisedDocument, quote, prefix, suffix);

  if (!candidate) return null;

  const span = toSourceSpan(
    normalisedDocument,
    candidate.start,
    candidate.end,
    document
  );

  return {
    start: span.start,
    end: span.end,
    text: document.slice(span.start, span.end),
    method: candidate.method,
    score: candidate.score,
  };
}

/**
 * Resolve a whole page's worth of highlights in one pass, keeping the caller's
 * order and reporting the orphans alongside the hits.
 *
 * The reader needs both halves: the resolved ones to paint, and the orphaned
 * ones to list. Returning `null` in place would make the caller re-derive which
 * is which on every render.
 */
export function resolveHighlights<T extends HighlightAnchor>(
  document: string,
  anchors: T[]
): { anchor: T; resolved: ResolvedHighlight | null }[] {
  return anchors.map((anchor) => ({
    anchor,
    resolved: resolveHighlight(document, anchor),
  }));
}

/**
 * Build the three strings to store from a selection in a document.
 *
 * The counterpart to `resolveHighlight`: the reader (D10) has a start and an
 * end from the DOM selection, and this turns them into something that survives
 * the next re-extraction. The context length is a compromise — long enough to
 * tell two occurrences of a sentence apart, short enough that an edit near the
 * quote does not invalidate it.
 */
export function createAnchor(
  document: string,
  start: number,
  end: number,
  contextLength: number = HIGHLIGHT_CONTEXT_LENGTH
): HighlightAnchor {
  const from = Math.max(0, Math.min(start, document.length));
  const to = Math.max(from, Math.min(end, document.length));

  return {
    quote: collapseWhitespace(document.slice(from, to)),
    prefix: collapseWhitespace(document.slice(Math.max(0, from - contextLength), from)),
    suffix: collapseWhitespace(document.slice(to, to + contextLength)),
  };
}

/** The stored form of any anchor string: whitespace collapsed, trimmed. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
