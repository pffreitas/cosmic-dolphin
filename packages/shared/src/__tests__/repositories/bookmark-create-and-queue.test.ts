import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { sql } from "kysely";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";

const db = getTestDatabase();
const NOW = new Date();

async function queuedFor(bookmarkId: string): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT count(*) AS count FROM pgmq.q_bookmarks
    WHERE message->'data'->>'bookmarkId' = ${bookmarkId}`.execute(db);
  return Number(result.rows[0].count);
}

async function bookmarkRows(userId: string): Promise<number> {
  const result = await db
    .selectFrom("bookmarks")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("user_id", "=", userId)
    .executeTakeFirstOrThrow();
  return Number(result.count);
}

describe("BookmarkRepository.createAndQueue", () => {
  const repository = new BookmarkRepositoryImpl(db);
  let userId: string;
  const data = (url: string) =>
    TestDataFactory.createBookmark({ user_id: userId, source_url: url });

  beforeEach(() => {
    userId = TestDataFactory.generateUserId();
  });

  afterAll(async () => {
    await sql`DELETE FROM pgmq.q_bookmarks`.execute(db);
  });

  it("new save is processing with exactly one queued message", async () => {
    const result = await repository.createAndQueue(data("https://example.com/a"), {
      dailyLimit: 5,
      now: NOW,
    });

    expect(result?.queued).toBe(true);
    expect(result?.bookmark.processing_status).toBe("processing");
    expect(result?.bookmark.processing_started_at).toBeInstanceOf(Date);
    expect(await queuedFor(result!.bookmark.id)).toBe(1);
    const message = await sql<{ message: unknown }>`
      SELECT message FROM pgmq.q_bookmarks
      WHERE message->'data'->>'bookmarkId' = ${result!.bookmark.id}`.execute(db);
    expect(message.rows[0].message).toEqual({
      type: "bookmark_process",
      data: { bookmarkId: result!.bookmark.id, userId },
      metadata: { source: "api", priority: "medium" },
    });
  });

  it("duplicate and concurrent saves queue once", async () => {
    const url = "https://example.com/dup";
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        repository.createAndQueue(data(url), { dailyLimit: 5, now: NOW })
      )
    );
    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(2);
    expect(await bookmarkRows(userId)).toBe(1);
    expect(await queuedFor(winners[0]!.bookmark.id)).toBe(1);

    const again = await repository.createAndQueue(data(url), { dailyLimit: 5, now: NOW });
    expect(again).toBeNull();
    expect(await queuedFor(winners[0]!.bookmark.id)).toBe(1);
  });

  it("over-budget save is idle and queues nothing", async () => {
    const result = await repository.createAndQueue(data("https://example.com/idle"), {
      dailyLimit: 0,
      now: NOW,
    });
    expect(result?.queued).toBe(false);
    expect(result?.bookmark.processing_status).toBe("idle");
    expect(await queuedFor(result!.bookmark.id)).toBe(0);
  });

  it("a burst crosses the limit at the right save", async () => {
    const outcomes: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const result = await repository.createAndQueue(data(`https://example.com/b${i}`), {
        dailyLimit: 2,
        now: NOW,
      });
      outcomes.push(result!.queued);
    }
    expect(outcomes).toEqual([true, true, false, false]);
  });

  it("counts only bookmarks created since UTC midnight", async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    await repository.create({ ...data("https://example.com/old"), created_at: yesterday });
    const result = await repository.createAndQueue(data("https://example.com/today"), {
      dailyLimit: 1,
      now: NOW,
    });
    expect(result?.queued).toBe(true);
  });

  it("a failing send rolls back the insert", async () => {
    const failing = new BookmarkRepositoryImpl(db, () => ({
      sendMessage: async () => {},
      sendBookmarkProcessingMessage: async () => {
        throw new Error("send failed");
      },
    }));
    await expect(
      failing.createAndQueue(data("https://example.com/rollback"), { dailyLimit: 5, now: NOW })
    ).rejects.toThrow("send failed");
    expect(await bookmarkRows(userId)).toBe(0);
  });
});
