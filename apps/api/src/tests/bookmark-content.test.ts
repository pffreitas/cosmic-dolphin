/** Isolated fictional owner authentication; real stored content and HTTP routes. */
import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
import Fastify, { type FastifyInstance } from "fastify";
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
  await registerBookmarkRoutes(app, { bookmark, feed: { recordOpen: async () => {} } } as unknown as ServiceContainer,
    async request => { request.userId = request.headers["x-fixture-owner"] as string; });
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => { await utils.truncateAll(); owner = crypto.randomUUID(); });
afterAll(async () => { await app?.close(); await closeTestDatabase(); });
async function request(path: string, method = "GET", user = owner) {
  const response = await fetch(address + path, { method, headers: { "x-fixture-owner": user } });
  return { status: response.status, body: await response.json() as any };
}
async function stored(content = "<h1>Article heading</h1><p>Actual article text, separate from the brief.</p>", metadata: Parameters<typeof repository.insertScrapedUrlContents>[1]["metadata"] = { extraction: { status: "complete", provider: "readability", fetchedAt: "2026-11-09T00:00:00Z" } }) {
  const saved = await bookmark.create("https://content.example/article", owner);
  await bookmark.update(saved.id, { cosmicBriefSummary: "SHORT BRIEF SENTINEL" });
  await repository.insertScrapedUrlContents(saved.id, { title: "Stored article", content, metadata });
  return saved;
}
it("serves stored article blocks to the owner, separate from the brief, and keeps the explicit read action", async () => {
  const saved = await stored();
  const content = await request(`/bookmarks/${saved.id}/content`);
  expect(content.status).toBe(200);
  expect(content.body.blocks).toEqual([
    { kind: "heading", text: "Article heading" },
    { kind: "paragraph", text: "Actual article text, separate from the brief." },
  ]);
  expect(content.body.wordCount).toBe(9);
  expect(JSON.stringify(content.body)).not.toContain("SHORT BRIEF SENTINEL");
  expect((await request(`/bookmarks/${saved.id}/read`, "PUT")).body.isRead).toBe(true);
});
it("returns indistinguishable 404s for missing, other-owner, private and incomplete content", async () => {
  const saved = await stored();
  const paths = [
    await request(`/bookmarks/${crypto.randomUUID()}/content`),
    await request(`/bookmarks/${saved.id}/content`, "GET", crypto.randomUUID()),
  ];
  await db.updateTable("bookmarks").set({ is_private_link: true }).where("id", "=", saved.id).execute();
  paths.push(await request(`/bookmarks/${saved.id}/content`));
  await db.updateTable("bookmarks").set({ is_private_link: false }).where("id", "=", saved.id).execute();
  for (const status of ["pending", "failed"]) {
    await db.updateTable("scraped_url_contents").set({ metadata: { extraction: { status } } }).where("bookmark_id", "=", saved.id).execute();
    paths.push(await request(`/bookmarks/${saved.id}/content`));
  }
  for (const result of paths) expect(result).toEqual({ status: 404, body: { error: "Bookmark content not found" } });
});
it("uses the actual stored extraction provider for provenance and its update timestamp", async () => {
  const saved = await stored("<p>User supplied article text.</p>", { extraction: { status: "complete", provider: "user_paste", fetchedAt: "2026-11-09T00:00:00Z" } });
  const updatedAt = new Date("2026-11-09T12:34:56Z");
  await db.updateTable("scraped_url_contents").set({ updated_at: updatedAt }).where("bookmark_id", "=", saved.id).execute();
  const storedTimestamp = (await repository.getScrapedUrlContent(saved.id))!.updatedAt;
  expect((await request(`/bookmarks/${saved.id}/content`)).body).toMatchObject({ source: "pasted", updatedAt: storedTimestamp.toISOString(), wordCount: 4 });
  await db.updateTable("scraped_url_contents").set({ metadata: { extraction: { status: "complete", provider: "firecrawl" } } }).where("bookmark_id", "=", saved.id).execute();
  expect((await request(`/bookmarks/${saved.id}/content`)).body.source).toBe("extracted");
});
it("serves a deterministic 20,000-word owner article within the serialized size and HTTP p95 budgets", async () => {
  const words = Array.from({ length: 20000 }, (_, index) => `word${index}`);
  const saved = await stored(`<p>${words.join(" ")}</p>`);
  async function sample() {
    const started = performance.now();
    const response = await fetch(`${address}/bookmarks/${saved.id}/content`, { headers: { "x-fixture-owner": owner } });
    const text = await response.text();
    const body = JSON.parse(text);
    const elapsed = performance.now() - started;
    expect(response.status).toBe(200);
    expect(body.wordCount).toBe(20000);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(500000);
    return elapsed;
  }
  for (let n = 0; n < 10; n++) await sample();
  const timings: number[] = [];
  for (let n = 0; n < 100; n++) timings.push(await sample());
  expect([...timings].sort((a, b) => a - b)[Math.ceil(.95 * timings.length) - 1]).toBeLessThanOrEqual(400);
});
