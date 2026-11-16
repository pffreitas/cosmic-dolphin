/** Retry, Summarise now and paste: real routes, services and database, pgmq read back. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import Fastify, { type FastifyInstance } from "fastify";
import { sql } from "kysely";
import { BookmarkRepositoryImpl, BookmarkServiceImpl, WebScrapingServiceImpl, type ServiceContainer } from "@cosmic-dolphin/shared";
import { DatabaseTestUtils, getTestDatabase, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../routes/bookmarks";

const db = getTestDatabase();
const utils = new DatabaseTestUtils(db);
const repository = new BookmarkRepositoryImpl(db);
const bookmark = new BookmarkServiceImpl(repository, new WebScrapingServiceImpl());
let app: FastifyInstance;
let address: string;
let owner: string;

beforeAll(async () => {
  await utils.waitForConnection();
  app = Fastify();
  await registerBookmarkRoutes(
    app,
    { bookmark, feed: { recordOpen: async () => {} } } as unknown as ServiceContainer,
    async (request) => { request.userId = request.headers["x-fixture-owner"] as string; }
  );
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => {
  await utils.truncateAll();
  await sql`DELETE FROM pgmq.q_bookmarks`.execute(db);
  owner = crypto.randomUUID();
});
afterAll(async () => {
  await sql`DELETE FROM pgmq.q_bookmarks`.execute(db);
  await app?.close();
  await closeTestDatabase();
});

async function call(path: string, method: string, body?: unknown, user = owner) {
  const response = await fetch(address + path, {
    method,
    headers: { "x-fixture-owner": user, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: (await response.json()) as any };
}
async function seed(status: "idle" | "failed" | "processing") {
  const saved = await bookmark.create("https://reprocess.example/a", owner);
  await db.updateTable("bookmarks").set({ processing_status: status }).where("id", "=", saved.id).execute();
  return saved;
}
async function queued(id: string) {
  const result = await sql<{ message: any }>`
    SELECT message FROM pgmq.q_bookmarks WHERE message->'data'->>'bookmarkId' = ${id}`.execute(db);
  return result.rows.map((row) => row.message.data);
}
const text = "Careful reading helps people understand the evidence. ".repeat(5);

describe("POST /bookmarks/:id/reprocess", () => {
  it("starts a failed or idle bookmark and queues one message", async () => {
    for (const status of ["failed", "idle"] as const) {
      await utils.truncateAll();
      const saved = await seed(status);
      const result = await call(`/bookmarks/${saved.id}/reprocess`, "POST", { phase: "summarise" });
      expect(result.status).toBe(202);
      expect(result.body.message).toBe("Retrying summarise");
      expect(result.body.bookmark.processingStatus).toBe("processing");
      expect(await queued(saved.id)).toEqual([
        { bookmarkId: saved.id, userId: owner, phase: "summarise", resume: true },
      ]);
    }
  });

  it("answers a whole-pipeline reprocess with the original message", async () => {
    const saved = await seed("idle");
    const result = await call(`/bookmarks/${saved.id}/reprocess`, "POST", {});
    expect(result.status).toBe(202);
    expect(result.body.message).toBe("Reprocessing this bookmark");
  });

  it("a second Retry is a no-op: both answer 202 and one message is queued", async () => {
    const saved = await seed("failed");
    const first = await call(`/bookmarks/${saved.id}/reprocess`, "POST", {});
    const second = await call(`/bookmarks/${saved.id}/reprocess`, "POST", {});
    expect(first.status).toBe(202);
    expect(first.body.message).toBe("Reprocessing this bookmark");
    expect(second.status).toBe(202);
    expect(second.body.message).toBe("Already processing");
    expect(second.body.bookmark).toMatchObject({ id: saved.id, processingStatus: "processing" });
    expect(await queued(saved.id)).toHaveLength(1);
  });

  it("answers 404 for a missing or another user's bookmark and changes nothing", async () => {
    const saved = await seed("failed");
    expect((await call(`/bookmarks/${saved.id}/reprocess`, "POST", {}, crypto.randomUUID())).status).toBe(404);
    expect((await call(`/bookmarks/${crypto.randomUUID()}/reprocess`, "POST", {})).status).toBe(404);
    expect(await queued(saved.id)).toHaveLength(0);
    expect((await repository.findByIdAndUser(saved.id, owner))?.processing_status).toBe("failed");
  });
});

describe("PUT /bookmarks/:id/content", () => {
  it("paste while processing is refused with 409 and changes nothing", async () => {
    const saved = await seed("processing");
    const result = await call(`/bookmarks/${saved.id}/content`, "PUT", { text });
    expect(result).toEqual({ status: 409, body: { error: "Still processing. Try again when it finishes." } });
    expect(await repository.getScrapedUrlContent(saved.id)).toBeNull();
    expect(await queued(saved.id)).toHaveLength(0);
  });

  it("paste after a failure stores content and queues once", async () => {
    const saved = await seed("failed");
    const result = await call(`/bookmarks/${saved.id}/content`, "PUT", { text });
    expect(result.status).toBe(200);
    expect(result.body.message).toBe("Reprocessing this bookmark");
    expect(result.body.bookmark.processingStatus).toBe("processing");
    expect(await queued(saved.id)).toEqual([{ bookmarkId: saved.id, userId: owner, resume: true }]);
    expect((await repository.getScrapedUrlContent(saved.id))?.metadata.extraction).toEqual({ status: "complete", provider: "user_paste" });
  });

  it("answers 404 for a missing or another user's bookmark", async () => {
    const saved = await seed("failed");
    expect((await call(`/bookmarks/${saved.id}/content`, "PUT", { text }, crypto.randomUUID())).status).toBe(404);
    expect((await call(`/bookmarks/${crypto.randomUUID()}/content`, "PUT", { text })).status).toBe(404);
    expect(await queued(saved.id)).toHaveLength(0);
  });
});
