import {
  Bookmark,
  ContinueReadingItem,
  CreateHighlightRequest,
  Highlight,
  ReadingProgress,
  SaveReadingProgressResult,
} from "../types";
import {
  BookmarkReadingRepository,
  IN_PROGRESS_MAX_PERCENT,
  IN_PROGRESS_MIN_PERCENT,
} from "../repositories/bookmark-reading.repository";
import {
  BookmarkHighlightRow,
  BookmarkReadingProgressRow,
} from "../database/schema";
import {
  collapseWhitespace,
  MAX_HIGHLIGHT_NOTE_LENGTH,
  MAX_HIGHLIGHT_QUOTE_LENGTH,
} from "../highlight-anchor";
import { mapDatabaseRowToBookmark } from "./bookmark.service";

/**
 * Reading progress and highlights.
 *
 * The interesting rules are one layer down, in SQL: monotonic progress and
 * reader-scoped highlights. This layer normalises what goes in, maps rows to
 * the API's shapes, and refuses input the database should never be asked to
 * hold.
 */

/**
 * At most one progress write per bookmark per this interval.
 *
 * The primary throttle is on the client — `apps/web/lib/reading/progress.ts`,
 * which the reader in D10 uses — because the cheapest write is the one never
 * sent, and a scroll handler fires dozens of times a second. This constant is
 * exported so client and server agree on the number rather than each keeping
 * their own copy of "5 seconds".
 *
 * The server does not reject a faster write. It is already idempotent and
 * bounded: a repeat at or below the stored percent touches nothing meaningful,
 * a lower one is refused outright, and `RATE_LIMITS.progress` caps the volume
 * a single client can generate. Refusing on time instead would throw away the
 * one write that matters most — the one on unmount, which is precisely the one
 * likely to arrive within five seconds of the last periodic tick.
 */
export const PROGRESS_WRITE_INTERVAL_MS = 5_000;

/** How many in-flight reads Home's rail asks for by default. */
export const CONTINUE_READING_DEFAULT_LIMIT = 12;
export const CONTINUE_READING_MAX_LIMIT = 50;

export class ReadingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadingValidationError";
  }
}

export interface ReadingService {
  saveProgress(
    bookmarkId: string,
    userId: string,
    percent: number,
    scrollOffset?: number | null
  ): Promise<SaveReadingProgressResult | null>;

  getProgress(
    bookmarkId: string,
    userId: string
  ): Promise<ReadingProgress | null>;

  getContinueReading(
    userId: string,
    limit?: number
  ): Promise<ContinueReadingItem[]>;

  listHighlights(bookmarkId: string, userId: string): Promise<Highlight[]>;

  createHighlight(
    bookmarkId: string,
    userId: string,
    request: CreateHighlightRequest
  ): Promise<Highlight | null>;

  updateHighlightNote(
    id: string,
    userId: string,
    note: string | null
  ): Promise<Highlight | null>;

  deleteHighlight(id: string, userId: string): Promise<boolean>;
}

/**
 * Clamp rather than reject.
 *
 * Percent is derived on the client from scroll position over content height,
 * and both of those are measured against a layout that is still settling. A
 * 101 or a -1 is a rounding artefact, not a lie, and answering it with a 400
 * would make the reader's console noisy about something nobody can act on. A
 * value that is not a number at all is a different matter and is refused.
 */
export function clampPercent(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new ReadingValidationError("percent must be a number between 0 and 100");
  }
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

/** Whether a percent puts a bookmark in the Continue reading rail. */
export function isInProgress(percent: number): boolean {
  return percent >= IN_PROGRESS_MIN_PERCENT && percent <= IN_PROGRESS_MAX_PERCENT;
}

export class ReadingServiceImpl implements ReadingService {
  constructor(private readonly repository: BookmarkReadingRepository) {}

  async saveProgress(
    bookmarkId: string,
    userId: string,
    percent: number,
    scrollOffset?: number | null
  ): Promise<SaveReadingProgressResult | null> {
    const clamped = clampPercent(percent);
    const offset =
      scrollOffset === undefined || scrollOffset === null
        ? null
        : Math.max(0, Math.round(Number(scrollOffset) || 0));

    const result = await this.repository.saveProgress(
      bookmarkId,
      userId,
      clamped,
      offset
    );

    if (!result) return null;

    return {
      progress: mapProgress(result.row),
      accepted: result.accepted,
    };
  }

  async getProgress(
    bookmarkId: string,
    userId: string
  ): Promise<ReadingProgress | null> {
    const row = await this.repository.findProgress(bookmarkId, userId);
    return row ? mapProgress(row) : null;
  }

  async getContinueReading(
    userId: string,
    limit: number = CONTINUE_READING_DEFAULT_LIMIT
  ): Promise<ContinueReadingItem[]> {
    const bounded = Math.min(
      CONTINUE_READING_MAX_LIMIT,
      Math.max(1, Math.floor(limit) || CONTINUE_READING_DEFAULT_LIMIT)
    );

    const rows = await this.repository.findContinueReading(userId, bounded);

    return rows.map(({ bookmark, progress }) => ({
      bookmark: mapDatabaseRowToBookmark(bookmark),
      progress: mapProgress(progress),
    }));
  }

  async listHighlights(
    bookmarkId: string,
    userId: string
  ): Promise<Highlight[]> {
    const rows = await this.repository.findHighlightsByBookmark(
      bookmarkId,
      userId
    );
    return rows.map(mapHighlight);
  }

  async createHighlight(
    bookmarkId: string,
    userId: string,
    request: CreateHighlightRequest
  ): Promise<Highlight | null> {
    // Normalised before it is stored, not on the way out: the anchoring pass
    // normalises the document it searches, so storing the raw selection would
    // mean re-normalising the same quote on every render, and two highlights
    // of the same sentence taken from differently wrapped extractions would
    // not compare equal.
    const quote = collapseWhitespace(request.quote ?? "");
    if (!quote) {
      throw new ReadingValidationError("quote is required");
    }
    if (quote.length > MAX_HIGHLIGHT_QUOTE_LENGTH) {
      throw new ReadingValidationError(
        `quote must be at most ${MAX_HIGHLIGHT_QUOTE_LENGTH} characters`
      );
    }

    const note = normaliseNote(request.note);

    const row = await this.repository.createHighlight({
      bookmarkId,
      userId,
      quote,
      prefix: collapseWhitespace(request.prefix ?? "") || null,
      suffix: collapseWhitespace(request.suffix ?? "") || null,
      note,
    });

    return row ? mapHighlight(row) : null;
  }

  async updateHighlightNote(
    id: string,
    userId: string,
    note: string | null
  ): Promise<Highlight | null> {
    const row = await this.repository.updateHighlightNote(
      id,
      userId,
      normaliseNote(note)
    );
    return row ? mapHighlight(row) : null;
  }

  async deleteHighlight(id: string, userId: string): Promise<boolean> {
    return this.repository.deleteHighlight(id, userId);
  }
}

/**
 * The note is the one free-text field a highlight carries, and the one thing
 * about a highlight that can be edited. Clearing it is `null`, not `""` — an
 * empty string in the column would make "has a note" a length check everywhere
 * it is asked.
 */
function normaliseNote(note: string | null | undefined): string | null {
  if (note === null || note === undefined) return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_HIGHLIGHT_NOTE_LENGTH) {
    throw new ReadingValidationError(
      `note must be at most ${MAX_HIGHLIGHT_NOTE_LENGTH} characters`
    );
  }
  return trimmed;
}

function mapProgress(row: BookmarkReadingProgressRow): ReadingProgress {
  return {
    bookmarkId: row.bookmark_id,
    percent: Number(row.percent),
    scrollOffset: row.scroll_offset ?? undefined,
    updatedAt: new Date(row.updated_at),
  };
}

function mapHighlight(row: BookmarkHighlightRow): Highlight {
  return {
    id: row.id,
    bookmarkId: row.bookmark_id,
    userId: row.user_id,
    quote: row.quote,
    prefix: row.prefix ?? undefined,
    suffix: row.suffix ?? undefined,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at),
  };
}
