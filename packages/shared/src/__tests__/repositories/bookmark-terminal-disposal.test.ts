import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { sql } from "kysely";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { PgmqRepositoryImpl } from "../../repositories/pgmq.repository";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";

const db = getTestDatabase();
const pgmq = new PgmqRepositoryImpl(db);

async function live(bookmarkId: string) {
  const result = await sql<{ msg_id: string }>`
    SELECT msg_id FROM pgmq.q_bookmarks
    WHERE message->'data'->>'bookmarkId' = ${bookmarkId}`.execute(db);
  return result.rows.map((row) => Number(row.msg_id));
}

describe("terminal write and message disposal share one transaction", () => {
  const repository = new BookmarkRepositoryImpl(db);
  let userId: string;

  /** A `processing` bookmark whose run's message the worker has read. */
  async function seed() {
    userId = TestDataFactory.generateUserId();
    const bookmark = await repository.create(
      TestDataFactory.createBookmark({
        user_id: userId,
        source_url: `https://example.com/${crypto.randomUUID()}`,
        processing_status: "processing",
      })
    );
    await pgmq.send("bookmarks", {
      type: "bookmark_process",
      data: { bookmarkId: bookmark.id, userId },
    });
    const [message] = (await pgmq.read("bookmarks", 300, 100)).filter(
      (m) => (m.message as any).data.bookmarkId === bookmark.id
    );
    return { bookmark, msgId: message.msg_id };
  }

  const status = async (id: string) =>
    (await repository.findByIdAndUser(id, userId))?.processing_status;

  beforeEach(() => {
    userId = TestDataFactory.generateUserId();
  });

  afterAll(async () => {
    await sql`DELETE FROM pgmq.q_bookmarks`.execute(db);
  });

  it.each([
    ["completed", "delete"],
    ["failed", "archive"],
  ] as const)("%s status and %s commit together, leaving exactly one live message after a Retry", async (to, how) => {
    const { bookmark, msgId } = await seed();

    await repository.update(
      bookmark.id,
      { processing_status: to, processing_error: to === "failed" ? "boom" : null },
      async (trx) => {
        const queue = new PgmqRepositoryImpl(trx);
        await (how === "delete" ? queue.delete("bookmarks", msgId) : queue.archive("bookmarks", msgId));
      }
    );

    expect(await status(bookmark.id)).toBe(to);
    expect(await live(bookmark.id)).toEqual([]);

    const retry = await repository.startReprocess(bookmark.id, userId);
    expect(retry?.queued).toBe(true);
    expect(await live(bookmark.id)).toHaveLength(1);
  });

  it("a failed disposal rolls the status back: still processing, still one message", async () => {
    const { bookmark, msgId } = await seed();

    await expect(
      repository.update(bookmark.id, { processing_status: "failed", processing_error: "boom" }, async (trx) => {
        await new PgmqRepositoryImpl(trx).archive("bookmarks", msgId);
        throw new Error("pgmq down");
      })
    ).rejects.toThrow("pgmq down");

    expect(await status(bookmark.id)).toBe("processing");
    expect(await live(bookmark.id)).toEqual([msgId]);
    // Retry sees `processing` and queues nothing: the old message is the only one.
    expect((await repository.startReprocess(bookmark.id, userId))?.queued).toBe(false);
    expect(await live(bookmark.id)).toEqual([msgId]);
  });

  it("a Retry racing the terminal transaction never sees a terminal bookmark with a live message", async () => {
    const { bookmark, msgId } = await seed();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const inside = new Promise<void>((resolve) => (entered = resolve));

    const terminal = repository.update(
      bookmark.id,
      { processing_status: "failed", processing_error: "boom" },
      async (trx) => {
        await new PgmqRepositoryImpl(trx).archive("bookmarks", msgId);
        entered();
        await held;
      }
    );
    await inside;

    // Before the commit the bookmark still reads `processing` with its message:
    // Retry queues nothing, so there is never a second live message.
    expect((await repository.startReprocess(bookmark.id, userId))?.queued).toBe(false);
    expect(await live(bookmark.id)).toEqual([msgId]);

    release();
    await terminal;

    // After it the bookmark is `failed` and the old message is gone.
    expect(await live(bookmark.id)).toEqual([]);
    expect((await repository.startReprocess(bookmark.id, userId))?.queued).toBe(true);
    const messages = await live(bookmark.id);
    expect(messages).toHaveLength(1);
    expect(messages).not.toContain(msgId);
  });
});
