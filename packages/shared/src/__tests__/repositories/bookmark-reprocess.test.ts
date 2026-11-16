import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { sql } from "kysely";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";

const db = getTestDatabase();

async function messagesFor(bookmarkId: string) {
  const result = await sql<{ message: any }>`
    SELECT message FROM pgmq.q_bookmarks
    WHERE message->'data'->>'bookmarkId' = ${bookmarkId}`.execute(db);
  return result.rows.map((row) => row.message);
}

const PASTE = "<p>Pasted article text.</p>";

describe("BookmarkRepository.startReprocess", () => {
  const repository = new BookmarkRepositoryImpl(db);
  let userId: string;
  const seed = (status: "idle" | "failed" | "processing" | "completed", url: string) =>
    repository.create(
      TestDataFactory.createBookmark({
        user_id: userId,
        source_url: url,
        processing_status: status,
        processing_failure_code: status === "failed" ? "paywall" : null,
        processing_error: status === "failed" ? "boom" : null,
      })
    );

  beforeEach(() => {
    userId = TestDataFactory.generateUserId();
  });

  afterAll(async () => {
    await sql`DELETE FROM pgmq.q_bookmarks`.execute(db);
  });

  it("reprocess starts exactly one run", async () => {
    const failed = await seed("failed", "https://example.com/failed");
    const result = await repository.startReprocess(failed.id, userId, { phase: "summarise" });

    expect(result?.queued).toBe(true);
    expect(result?.bookmark.processing_status).toBe("processing");
    expect(result?.bookmark.processing_failure_code).toBeNull();
    expect(result?.bookmark.processing_error).toBeNull();
    expect(result?.bookmark.processing_started_at).toBeInstanceOf(Date);
    const messages = await messagesFor(failed.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual({
      bookmarkId: failed.id,
      userId,
      phase: "summarise",
      resume: true,
    });

    const idle = await seed("idle", "https://example.com/idle");
    expect((await repository.startReprocess(idle.id, userId))?.queued).toBe(true);
    expect((await messagesFor(idle.id))[0].data).toEqual({
      bookmarkId: idle.id,
      userId,
      resume: true,
    });
  });

  it("two concurrent reprocess calls queue one message", async () => {
    const failed = await seed("failed", "https://example.com/concurrent");
    const results = await Promise.all([
      repository.startReprocess(failed.id, userId),
      repository.startReprocess(failed.id, userId),
    ]);

    expect(results.filter((r) => r?.queued)).toHaveLength(1);
    expect(results.filter((r) => r && !r.queued)).toHaveLength(1);
    expect(results.every((r) => r?.bookmark.processing_status === "processing")).toBe(true);
    expect(await messagesFor(failed.id)).toHaveLength(1);
  });

  it("a processing bookmark queues nothing and is returned unchanged", async () => {
    const processing = await seed("processing", "https://example.com/processing");
    const result = await repository.startReprocess(processing.id, userId);
    expect(result?.queued).toBe(false);
    expect(result?.bookmark.id).toBe(processing.id);
    expect(await messagesFor(processing.id)).toHaveLength(0);
  });

  it("another user's or a missing bookmark is null and changes nothing", async () => {
    const failed = await seed("failed", "https://example.com/theirs");
    expect(await repository.startReprocess(failed.id, TestDataFactory.generateUserId())).toBeNull();
    expect(await repository.startReprocess(crypto.randomUUID(), userId)).toBeNull();
    expect((await repository.findByIdAndUser(failed.id, userId))?.processing_status).toBe("failed");
    expect(await messagesFor(failed.id)).toHaveLength(0);
  });

  it("a failing send rolls the status change back", async () => {
    const failed = await seed("failed", "https://example.com/rollback");
    const failing = new BookmarkRepositoryImpl(db, () => ({
      sendMessage: async () => {},
      sendBookmarkProcessingMessage: async () => {
        throw new Error("send failed");
      },
    }));
    await expect(failing.startReprocess(failed.id, userId)).rejects.toThrow("send failed");
    expect((await repository.findByIdAndUser(failed.id, userId))?.processing_status).toBe("failed");
  });

  it("paste while processing is refused and changes nothing", async () => {
    const processing = await seed("processing", "https://example.com/paste-busy");
    const result = await repository.storePastedContent(processing.id, userId, PASTE);
    expect(result.queued).toBe(false);
    expect(result.bookmark.processing_status).toBe("processing");
    expect(await repository.getScrapedUrlContent(processing.id)).toBeNull();
    expect(await messagesFor(processing.id)).toHaveLength(0);
  });

  it("paste after a failure stores content and queues once", async () => {
    const failed = await seed("failed", "https://example.com/paste-failed");
    const results = await Promise.all([
      repository.storePastedContent(failed.id, userId, PASTE),
      repository.storePastedContent(failed.id, userId, PASTE),
    ]);
    expect(results.filter((r) => r.queued)).toHaveLength(1);
    expect(results.every((r) => r.bookmark.processing_status === "processing")).toBe(true);
    expect((await repository.getScrapedUrlContent(failed.id))?.content).toBe(PASTE);
    const messages = await messagesFor(failed.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual({ bookmarkId: failed.id, userId, resume: true });
  });

  it("paste for a missing bookmark still throws", async () => {
    await expect(
      repository.storePastedContent(crypto.randomUUID(), userId, PASTE)
    ).rejects.toThrow("Bookmark not found");
  });
});
