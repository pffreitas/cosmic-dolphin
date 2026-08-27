import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  CompiledQuery,
  DatabaseConnection,
  Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
} from "kysely";
import { Database } from "../database/schema";
import { BookmarkReadingRepositoryImpl } from "../repositories/bookmark-reading.repository";
import {
  ReadingServiceImpl,
  ReadingValidationError,
  clampPercent,
  isInProgress,
} from "../services/reading.service";
import type { BookmarkReadingRepository } from "../repositories/bookmark-reading.repository";

/**
 * These tests need no database, and that is deliberate — the two rules being
 * checked are properties of the SQL this repository emits, so the thing to
 * exercise is the SQL itself.
 *
 * The fake connection below stores rows and answers queries **only by what the
 * query actually asked for**: a row comes back only if its `user_id` was among
 * the statement's bound parameters. A repository that dropped the reader from
 * its `WHERE` would therefore fail the owner's case (their id was never
 * bound) — which is what keeps the second viewer's case from passing
 * vacuously. The pair of assertions is the test; either alone would prove
 * nothing.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";
const VIEWER = "22222222-2222-4222-8222-222222222222";
const PUBLIC_BOOKMARK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

interface HighlightRow {
  id: string;
  user_id: string;
  bookmark_id: string;
  quote: string;
  prefix: string | null;
  suffix: string | null;
  note: string | null;
  created_at: Date;
}

class RecordingConnection implements DatabaseConnection {
  constructor(
    private readonly highlights: HighlightRow[],
    private readonly log: CompiledQuery[]
  ) {}

  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    this.log.push(query);

    const parameters = query.parameters as unknown[];
    const bound = (value: string) => parameters.includes(value);

    if (/from\s+"bookmark_highlights"/i.test(query.sql)) {
      // The filter *is* the assertion: a row is visible only if the statement
      // named both the bookmark and the reader. Nothing here knows which
      // reader "should" see it.
      const rows = this.highlights.filter(
        (row) => bound(row.bookmark_id) && bound(row.user_id)
      );
      return { rows: rows as unknown as R[] };
    }

    return { rows: [] };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("not used");
  }
}

class RecordingDriver implements Driver {
  constructor(
    private readonly highlights: HighlightRow[],
    readonly log: CompiledQuery[]
  ) {}

  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new RecordingConnection(this.highlights, this.log);
  }
  async beginTransaction(): Promise<void> {}
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

function createRepository(highlights: HighlightRow[]) {
  const log: CompiledQuery[] = [];
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new RecordingDriver(highlights, log),
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, log, repository: new BookmarkReadingRepositoryImpl(db) };
}

function highlightRow(overrides: Partial<HighlightRow> = {}): HighlightRow {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    user_id: OWNER,
    bookmark_id: PUBLIC_BOOKMARK,
    quote: "Invalidation is a coordination problem",
    prefix: null,
    suffix: null,
    note: null,
    created_at: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

describe("Highlights are private even on a public bookmark", () => {
  it("gives the owner their own highlight on their bookmark", async () => {
    const { repository } = createRepository([highlightRow()]);

    const rows = await repository.findHighlightsByBookmark(
      PUBLIC_BOOKMARK,
      OWNER
    );

    expect(rows).toHaveLength(1);
  });

  it("gives a second viewer of the same public bookmark nothing", async () => {
    // Same bookmark, same query, different reader. The bookmark is public —
    // its title, its brief and its extracted content are all readable by this
    // person. The highlight is not, because it was never part of the page.
    const { repository } = createRepository([highlightRow()]);

    const rows = await repository.findHighlightsByBookmark(
      PUBLIC_BOOKMARK,
      VIEWER
    );

    expect(rows).toHaveLength(0);
  });

  it("scopes the read to the reader in SQL, not above it", async () => {
    const { repository, log } = createRepository([highlightRow()]);

    await repository.findHighlightsByBookmark(PUBLIC_BOOKMARK, VIEWER);

    const [query] = log;
    expect(query.sql).toContain('"user_id"');
    expect(query.parameters).toContain(VIEWER);
  });

  it("cannot edit or delete another reader's highlight", async () => {
    const { repository, log } = createRepository([highlightRow()]);

    await repository.updateHighlightNote(highlightRow().id, VIEWER, "mine now");
    await repository.deleteHighlight(highlightRow().id, VIEWER);

    // Every statement, not only the reads.
    for (const query of log) {
      expect(query.sql).toContain('"user_id"');
      expect(query.parameters).toContain(VIEWER);
    }
  });
});

describe("Reading progress is monotonic in SQL", () => {
  it("guards the upsert against a lower percent and against another user's bookmark", async () => {
    const { repository, log } = createRepository([]);

    await repository.saveProgress(PUBLIC_BOOKMARK, OWNER, 40, 1200);

    const upsert = log.find((query) => /INSERT INTO bookmark_reading_progress/i.test(query.sql));
    expect(upsert).toBeDefined();

    // The guarantee, verbatim. Written as an assertion on the statement
    // because that is the only place it exists — there is no comparison in a
    // service to unit-test, on purpose: one would have a read and a write with
    // a race between them.
    expect(upsert!.sql).toContain(
      "excluded.percent >= bookmark_reading_progress.percent"
    );
    // And the same statement proves ownership, so there is no window between
    // checking and writing.
    expect(upsert!.sql).toMatch(/FROM bookmarks b/i);
    expect(upsert!.sql).toMatch(/b\.user_id =/i);
  });
});

/**
 * A repository fake with the real upsert's semantics, so the service's own
 * behaviour — clamping, the `accepted` flag, the shape it returns — can be
 * checked without a database.
 */
function createFakeRepository() {
  const store = new Map<string, { percent: number; scroll_offset: number | null; updated_at: Date }>();

  const repository: BookmarkReadingRepository = {
    async saveProgress(bookmarkId, userId, percent, scrollOffset) {
      const key = `${userId}:${bookmarkId}`;
      const existing = store.get(key);

      if (existing && percent < existing.percent) {
        return {
          row: {
            user_id: userId,
            bookmark_id: bookmarkId,
            percent: existing.percent,
            scroll_offset: existing.scroll_offset,
            updated_at: existing.updated_at,
          },
          accepted: false,
        };
      }

      const row = {
        percent,
        scroll_offset: scrollOffset,
        updated_at: new Date("2026-08-27T00:00:00Z"),
      };
      store.set(key, row);
      return {
        row: { user_id: userId, bookmark_id: bookmarkId, ...row },
        accepted: true,
      };
    },
    async findProgress() {
      return null;
    },
    async findContinueReading() {
      return [];
    },
    async findHighlightsByBookmark() {
      return [];
    },
    async findHighlightById() {
      return null;
    },
    async createHighlight(data) {
      return {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        user_id: data.userId,
        bookmark_id: data.bookmarkId,
        quote: data.quote,
        prefix: data.prefix,
        suffix: data.suffix,
        note: data.note,
        created_at: new Date("2026-08-27T00:00:00Z"),
      };
    },
    async updateHighlightNote() {
      return null;
    },
    async deleteHighlight() {
      return false;
    },
  };

  return { repository, service: new ReadingServiceImpl(repository) };
}

describe("ReadingService", () => {
  let service: ReadingServiceImpl;

  beforeEach(() => {
    service = createFakeRepository().service as ReadingServiceImpl;
  });

  it("keeps the higher percent and says the lower one was not accepted", async () => {
    await service.saveProgress(PUBLIC_BOOKMARK, OWNER, 62, 2400);

    const backUp = await service.saveProgress(PUBLIC_BOOKMARK, OWNER, 11, 300);

    expect(backUp).not.toBeNull();
    expect(backUp!.accepted).toBe(false);
    // Scrolling back up has not un-read anything.
    expect(backUp!.progress.percent).toBe(62);
  });

  it("accepts a resend at the same percent, so activity keeps its recency", async () => {
    await service.saveProgress(PUBLIC_BOOKMARK, OWNER, 62, 2400);
    const again = await service.saveProgress(PUBLIC_BOOKMARK, OWNER, 62, 2405);

    expect(again!.accepted).toBe(true);
  });

  it("clamps a percent that overshot instead of refusing it", async () => {
    const result = await service.saveProgress(PUBLIC_BOOKMARK, OWNER, 100.4, 0);
    expect(result!.progress.percent).toBe(100);

    expect(clampPercent(-3)).toBe(0);
    expect(() => clampPercent("nonsense")).toThrow(ReadingValidationError);
  });

  it("normalises a quote's whitespace and refuses an empty one", async () => {
    const highlight = await service.createHighlight(PUBLIC_BOOKMARK, OWNER, {
      quote: "  Invalidation is\n  a coordination problem  ",
    });

    expect(highlight!.quote).toBe("Invalidation is a coordination problem");

    await expect(
      service.createHighlight(PUBLIC_BOOKMARK, OWNER, { quote: "   " })
    ).rejects.toBeInstanceOf(ReadingValidationError);
  });

  it("stores a blank note as absent rather than as an empty string", async () => {
    const highlight = await service.createHighlight(PUBLIC_BOOKMARK, OWNER, {
      quote: "something",
      note: "   ",
    });

    expect(highlight!.note).toBeUndefined();
  });

  it("agrees with the rail on what in progress means", () => {
    expect(isInProgress(4)).toBe(false);
    expect(isInProgress(5)).toBe(true);
    expect(isInProgress(95)).toBe(true);
    expect(isInProgress(96)).toBe(false);
  });
});
