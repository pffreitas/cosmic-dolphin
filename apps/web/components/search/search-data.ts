import type {
  HybridSearchResultItem,
  SearchAnswerSource,
  SearchDateRange,
  SearchMatchKind,
  SearchReadStatus,
} from "@cosmic-dolphin/api-client";

import {
  extractDomain,
  formatSavedAt,
  toLibraryItem,
  type LibraryItem,
} from "@/components/bookmark/library/row-data";
import type { ProvenanceRowProps } from "@/components/provenance-row";
import { parseCaptureUrl } from "@/lib/capture";

/**
 * Everything `/search` and the `⌘K` palette need to draw one result.
 *
 * Both surfaces build this and hand it to the same `SearchRow`, which is what
 * "one vocabulary across the search route and ⌘K" comes down to in code: not
 * two components that happen to look alike, but one component that cannot
 * drift from itself.
 *
 * `row` is the *library* row's own view model — `toLibraryItem`, unchanged —
 * so a save looks the same in search as it does in the Library, down to the
 * breadcrumb and the unread dot.
 */
export interface SearchItem {
  key: string;
  row: LibraryItem;
  /** `keyword` or `semantic`. The semantic ones earn a `Related` tag. */
  match: SearchMatchKind;
  /** Favicon, domain and time — the feed's provenance line, own-save shape. */
  provenance: ProvenanceRowProps;
  /**
   * The passage the vector search actually matched, when there is one. Shown
   * instead of the brief summary: it is the reason this row is here, and the
   * brief is one click away on a row whose whole job is to be clicked.
   */
  snippet?: string;
}

export interface SearchView {
  q: string;
  collectionId?: string;
  tag?: string;
  readStatus: SearchReadStatus;
  dateRange: SearchDateRange;
}

export const EMPTY_SEARCH_VIEW: SearchView = {
  q: "",
  readStatus: "all",
  dateRange: "any",
};

const READ_STATUSES: SearchReadStatus[] = ["all", "unread", "read"];
const DATE_RANGES: SearchDateRange[] = ["any", "week", "month", "year"];

export const READ_STATUS_OPTIONS: { value: SearchReadStatus; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "read", label: "Read" },
  ];

export const DATE_RANGE_OPTIONS: { value: SearchDateRange; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

/** The whole view lives in the query string, so a filtered search is a link. */
export function parseSearchView(params: {
  q?: string;
  collection_id?: string;
  tag?: string;
  read_status?: string;
  date?: string;
}): SearchView {
  return {
    q: params.q?.trim() ?? "",
    collectionId: params.collection_id || undefined,
    tag: params.tag || undefined,
    readStatus: READ_STATUSES.includes(params.read_status as SearchReadStatus)
      ? (params.read_status as SearchReadStatus)
      : "all",
    dateRange: DATE_RANGES.includes(params.date as SearchDateRange)
      ? (params.date as SearchDateRange)
      : "any",
  };
}

export function searchHref(view: SearchView): string {
  const params = new URLSearchParams();
  if (view.q) params.set("q", view.q);
  if (view.collectionId) params.set("collection_id", view.collectionId);
  if (view.tag) params.set("tag", view.tag);
  if (view.readStatus !== "all") params.set("read_status", view.readStatus);
  if (view.dateRange !== "any") params.set("date", view.dateRange);

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export function hasActiveFilters(view: SearchView): boolean {
  return Boolean(
    view.collectionId ||
      view.tag ||
      view.readStatus !== "all" ||
      view.dateRange !== "any"
  );
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------

/** One run of text, and whether the reader's query put it there. */
export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/**
 * Terms worth highlighting.
 *
 * One character is not a match, it is a coincidence, and highlighting every
 * "a" in a paragraph tells the reader nothing while making the row unreadable.
 */
export function queryTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);

  return Array.from(new Set(terms));
}

/**
 * Split `text` into runs, marking the spans the query matched.
 *
 * Pure and returning data rather than markup, so the rule it encodes — the
 * matched span, and only the matched span, gets `--cd-hl-bg` — can be asserted
 * without rendering anything.
 */
export function highlightSegments(
  text: string,
  query: string
): HighlightSegment[] {
  if (!text) return [];

  const terms = queryTerms(query);
  if (terms.length === 0) return [{ text, hit: false }];

  const haystack = text.toLowerCase();
  const ranges: [number, number][] = [];

  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(term, from);
      if (at === -1) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }

  if (ranges.length === 0) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Overlapping terms ("agent" and "agents") would otherwise nest one mark
  // inside another and double the tint.
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), hit: false });
    }
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }

  return segments;
}

/** True when any run of `text` matched — how a row knows it has nothing to show. */
export function hasHighlight(text: string, query: string): boolean {
  return highlightSegments(text, query).some((segment) => segment.hit);
}

const SNIPPET_LENGTH = 220;

/**
 * Trim a matched passage to something that fits two clamped lines, keeping the
 * first match inside the window rather than blindly taking the head.
 */
export function snippetAround(chunk: string, query: string): string {
  const text = chunk.replace(/\s+/g, " ").trim();
  if (text.length <= SNIPPET_LENGTH) return text;

  const terms = queryTerms(query);
  const haystack = text.toLowerCase();
  const at = terms
    .map((term) => haystack.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (at === undefined || at < SNIPPET_LENGTH / 2) {
    return `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
  }

  const start = Math.max(0, at - Math.floor(SNIPPET_LENGTH / 3));
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${
    end < text.length ? "…" : ""
  }`;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export function toSearchItem(
  result: HybridSearchResultItem,
  query: string,
  now: Date = new Date()
): SearchItem {
  const row = toLibraryItem(result.bookmark, now);
  const chunk = result.matchedChunks?.find((entry) => entry?.trim());

  return {
    key: row.id,
    row,
    match: result.match,
    provenance: ownSaveProvenance(result.bookmark, row),
    snippet: chunk ? snippetAround(chunk, query) : undefined,
  };
}

/**
 * The feed's provenance line, in its own-save shape:
 * `favicon · domain · you saved this · 2d ago`.
 *
 * Search only ever looks at the reader's own library, so there is no actor and
 * no attribution — but it is the same component, in the same order, with the
 * same separators, which is the point: the palette teaches the vocabulary the
 * rest of the product uses.
 */
export function ownSaveProvenance(
  bookmark: HybridSearchResultItem["bookmark"],
  row: Pick<LibraryItem, "domain" | "savedAt">
): ProvenanceRowProps {
  const domain = row.domain ?? extractDomain(bookmark.sourceUrl ?? "");

  return {
    sources: domain
      ? [
          {
            domain,
            faviconUrl: bookmark.metadata?.openGraph?.favicon ?? undefined,
            href: `/bookmarks/${bookmark.id}`,
          },
        ]
      : [],
    action: "you saved this",
    timestamp: row.savedAt,
  };
}

/** The tags present in a result set — the tag filter's options, and no others. */
export function tagOptions(items: SearchItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    for (const tag of item.row.tags) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

/**
 * What the palette and `/search` need to draw the `.ai-foot` of an answer.
 *
 * A source that is not a link is not provenance, so every one of these carries
 * the detail route it points at.
 */
export interface AnswerSourceLink {
  bookmarkId: string;
  domain: string;
  href: string;
  faviconUrl?: string;
  title: string;
}

/**
 * Every source, always — never a `+n more` tail.
 *
 * The digest's foot may truncate because a digest's sources are also its
 * content and the whole list is a click away. An answer's are not: "it names
 * the bookmarks it drew from, each as a link" is the rule, and a bookmark
 * folded into "+2 more" is neither named nor a link.
 */
export function toAnswerSources(
  sources: SearchAnswerSource[]
): AnswerSourceLink[] {
  return sources.map((source) => ({
    bookmarkId: source.bookmarkId,
    domain: source.domain || "saved link",
    href: `/bookmarks/${source.bookmarkId}`,
    faviconUrl: source.faviconUrl ?? undefined,
    title: source.title,
  }));
}

// ---------------------------------------------------------------------------
// "Save this link"
// ---------------------------------------------------------------------------

/**
 * Is what the reader typed a link rather than a query?
 *
 * Answered by `parseCaptureUrl` — the product's one definition of a link, the
 * same one the Save a link field uses. The palette must not have a second
 * opinion about what a URL is: a string the capture field would accept and the
 * palette would not is a paste that silently becomes a search.
 *
 * The extra rule here is whitespace. A sentence with a URL somewhere in it is
 * a search, and `parseCaptureUrl` never sees it.
 */
export function urlFromQuery(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return undefined;

  return parseCaptureUrl(trimmed)?.url;
}

export { formatSavedAt };
