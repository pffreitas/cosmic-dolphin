/** Isolated fictional owner authentication; real stored content and HTTP routes. */
import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
import Fastify, { type FastifyInstance } from "fastify";
import { BookmarkRepositoryImpl, BookmarkServiceImpl, WebScrapingServiceImpl, BookmarkProcessorServiceImpl, ContentChunkRepositoryImpl, CollectionRepositoryImpl, BookmarkProcessingRepositoryImpl, type AI, type ServiceContainer } from "@cosmic-dolphin/shared";
import { DatabaseTestUtils, getTestDatabase, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../routes/bookmarks";

const db = getTestDatabase();
const utils = new DatabaseTestUtils(db);
const repository = new BookmarkRepositoryImpl(db);
const bookmark = new BookmarkServiceImpl(repository, new WebScrapingServiceImpl());
let app: FastifyInstance;
let address: string;
let owner: string;
const jobs: { id: string; user: string; options: any }[] = [];
beforeAll(async () => {
  await utils.waitForConnection();
  app = Fastify();
  await registerBookmarkRoutes(app, { bookmark, queue: { sendBookmarkProcessingMessage: async (id: string, user: string, options: any) => { jobs.push({ id, user, options }); } }, feed: { recordOpen: async () => {} } } as unknown as ServiceContainer,
    async request => { request.userId = request.headers["x-fixture-owner"] as string; });
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => { await utils.truncateAll(); owner = crypto.randomUUID(); jobs.length = 0; });
afterAll(async () => { await app?.close(); await closeTestDatabase(); });
async function request(path: string, method = "GET", user = owner, body?: unknown) {
  const response = await fetch(address + path, { method, headers: { "x-fixture-owner": user, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
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

/** Deterministic LLM boundary; real pipeline, storage and HTTP, no hosted queue. */
function pipeline(usable = false, onStart?: () => Promise<void>) {
  const turns: string[] = [];
  const sources: string[] = [];
  const ai = {
    newSession: async (refID: string) => { await onStart?.(); return { sessionID: "fictional-t9", refID }; },
    generateObjectWithUsage: async (input: { schema: { shape: Record<string, unknown> }; prompt: string }) => {
      const shape = input.schema.shape;
      if (!shape) { turns.push("file"); return { value: { existingCollectionId: null, newCollection: null, confidence: 0, reasoning: "Fictional inbox" } }; }
      turns.push(Object.keys(shape).join(","));
      if ("contentStatus" in shape && usable) {
        const source = JSON.parse(input.prompt.match(/<content>\n([\s\S]*?)\n<\/content>/)![1]) as string;
        sources.push(source);
        return { value: { contentStatus: "ok", unusableReason: null, brief: source.includes("Careful reading helps") ? "PASTED SOURCE BRIEF" : "NORMAL SOURCE BRIEF", overview: "Fictional article explains careful reading.", sections: [], keyPoints: ["Careful reading helps."] } };
      }
      if ("contentStatus" in shape) return { value: { contentStatus: "unusable", unusableReason: "paywall", brief: "Invented claim", overview: "Invented article", sections: [], keyPoints: ["Invented point"] } };
      if ("tags" in shape) return { value: { tags: ["fictional-tag"], quickAccessKeywords: ["reading"], title: "Private page", summary: "A fictional description brief." } };
      if ("collectionId" in shape) return { value: { collectionId: null, confidence: 0, reason: "No suitable collection" } };
      throw new Error("Unexpected fictional turn");
    },
  } as unknown as AI;
  const processor = new BookmarkProcessorServiceImpl(bookmark, new ContentChunkRepositoryImpl(db), new CollectionRepositoryImpl(db), ai, new BookmarkProcessingRepositoryImpl(db), undefined, undefined,
    { getModelId: () => "fictional-embedding", embedTextsWithUsage: async (texts: string[]) => ({ value: texts.map(() => Array(1536).fill(0)) }) } as any);
  return { processor, turns, sources };
}
it("T9 paywall plus Open Graph becomes an empty failed owner bookmark and skips enrichment", async () => {
  const saved = await stored("<p>Subscribe to read this article.</p>");
  await bookmark.update(saved.id, { metadata: { openGraph: { description: "OG MUST NOT BECOME THE BRIEF" } }, cosmicSummary: "OLD ARTICLE", cosmicKeyPoints: ["OLD CLAIM"] });
  const { processor, turns } = pipeline();
  await processor.process(saved.id, owner);
  const result = await request(`/bookmarks/${saved.id}`);
  expect(result.status).toBe(200);
  expect(result.body.cosmicBriefSummary).toBe("");
  expect(result.body.cosmicSummary).toBe("");
  expect(result.body.cosmicKeyPoints).toEqual([]);
  expect(result.body.processingStatus).toBe("failed");
  expect(result.body.processingFailureCode).toBe("paywall");
  expect(turns).toEqual(["contentStatus,unusableReason,brief,overview,keyPoints,sections"]);
  const timeline = await new BookmarkProcessingRepositoryImpl(db).findLatestTimeline(saved.id, owner);
  expect(timeline!.events.filter(event => event.kind === "phase").map(event => event.phase)).toEqual(["fetch", "extract", "summarise"]);
});

it("T9 recovers a paywall with 200 pasted characters through the full stored-content pipeline", async () => {
  const saved = await stored("<p>Subscribe to read this article.</p>");
  await pipeline().processor.process(saved.id, owner);
  const text = "Careful reading helps people understand the evidence. ".repeat(4).slice(0, 200);
  const paste = await request(`/bookmarks/${saved.id}/content`, "PUT", owner, { text });
  expect(paste.status).toBe(200);
  expect(paste.body.bookmark).toMatchObject({ id: saved.id, processingStatus: "processing", processingFailureCode: null });
  expect(jobs).toEqual([{ id: saved.id, user: owner, options: { resume: true } }]);
  const { processor, turns, sources } = pipeline(true);
  // Isolated deterministic pgmq registration/drain; actual service and repository consume the stored extraction.
  await processor.process(jobs[0].id, jobs[0].user, jobs[0].options);
  const result = await request(`/bookmarks/${saved.id}`);
  expect(result.body).toMatchObject({ cosmicBriefSummary: "PASTED SOURCE BRIEF", processingStatus: "completed", processingFailureCode: null });
  expect((await request(`/bookmarks/${saved.id}/content`)).body).toMatchObject({ source: "pasted", blocks: [{ kind: "paragraph", text: text.trim() }] });
  expect(sources).toEqual([text.trim()]);
  expect(turns).toEqual(["contentStatus,unusableReason,brief,overview,keyPoints,sections", "tags", "file"]);
  const timeline = await new BookmarkProcessingRepositoryImpl(db).findLatestTimeline(saved.id, owner);
  expect(timeline!.events.filter(event => event.kind === "phase").map(event => event.phase).slice(-6)).toEqual(["fetch", "extract", "summarise", "tag", "file", "embed"]);
  expect((await new ContentChunkRepositoryImpl(db).findByScrapedContentId((await repository.getScrapedUrlContent(saved.id))!.id)).length).toBeGreaterThan(0);
});

it("T9 preserves normal enrichment and confirmed private filing without fetching the private page", async () => {
  const normal = await stored();
  const normalPipeline = pipeline(true);
  await normalPipeline.processor.process(normal.id, owner);
  expect((await request(`/bookmarks/${normal.id}`)).body).toMatchObject({ processingStatus: "completed", cosmicBriefSummary: "NORMAL SOURCE BRIEF" });
  expect((await request(`/bookmarks/${normal.id}/content`)).body.source).toBe("extracted");
  expect(normalPipeline.turns).toContain("tags");
  const collection = await new CollectionRepositoryImpl(db).create({ name: "Confirmed private topic", user_id: owner });
  const privateBookmark = await bookmark.createPrivateLink("https://private.example/secret", owner, { title: "Private page", description: "A fictional private description about careful reading." });
  await bookmark.refileByUser(privateBookmark.id, owner, collection.id);
  const privatePipeline = pipeline(true);
  await privatePipeline.processor.process(privateBookmark.id, owner);
  expect((await request(`/bookmarks/${privateBookmark.id}`)).body).toMatchObject({ processingStatus: "completed", collectionId: collection.id, isPrivateLink: true });
  expect((await request(`/bookmarks/${privateBookmark.id}/content`)).status).toBe(404);
  expect(await repository.getScrapedUrlContent(privateBookmark.id)).toBeNull();
  const timeline = await new BookmarkProcessingRepositoryImpl(db).findLatestTimeline(privateBookmark.id, owner);
  expect(timeline!.events.filter(event => event.kind === "phase").map(event => event.phase)).toEqual(["extract", "file"]);
});

it("T9 clears a previous failure at actual run start before new model work", async () => {
  const saved = await stored();
  await bookmark.update(saved.id, { processingFailureCode: "paywall" });
  let observed: unknown;
  await pipeline(true, async () => { observed = (await request(`/bookmarks/${saved.id}`)).body.processingFailureCode; }).processor.process(saved.id, owner);
  expect(observed).toBeNull();
  expect((await request(`/bookmarks/${saved.id}`)).body.processingFailureCode).toBeNull();
});

it("T9 enforces paste length and ownership, escapes markup, and refuses private article content", async () => {
  const saved = await stored();
  for (const length of [199, 200, 100000, 100001]) {
    const result = await request(`/bookmarks/${saved.id}/content`, "PUT", owner, { text: "x".repeat(length) });
    expect(result.status).toBe(length === 200 || length === 100000 ? 200 : 400);
  }
  const injection = '<script>alert("key")</script> & <h1>Keep this inert</h1>\n\n' + "article ".repeat(25);
  expect((await request(`/bookmarks/${saved.id}/content`, "PUT", owner, { text: injection })).status).toBe(200);
  const persisted = (await repository.getScrapedUrlContent(saved.id))!;
  expect(persisted.content).toContain("&lt;script&gt;alert(&quot;key&quot;)&lt;/script&gt; &amp;");
  expect(persisted.content).not.toContain("<script>");
  expect(persisted.metadata.extraction).toEqual({ status: "complete", provider: "user_paste" });
  const blocks = (await request(`/bookmarks/${saved.id}/content`)).body.blocks;
  expect(blocks[0]).toEqual({ kind: "paragraph", text: '<script>alert("key")</script> & <h1>Keep this inert</h1>' });
  expect(blocks[1].kind).toBe("paragraph");
  for (const id of [saved.id, crypto.randomUUID()]) expect((await request(`/bookmarks/${id}/content`, "PUT", crypto.randomUUID(), { text: "x".repeat(200) })).status).toBe(404);
  await db.updateTable("bookmarks").set({ is_private_link: true }).where("id", "=", saved.id).execute();
  expect((await request(`/bookmarks/${saved.id}/content`, "PUT", owner, { text: "x".repeat(200) })).status).toBe(409);
  expect((await request(`/bookmarks/${saved.id}/content`)).status).toBe(404);
  expect((await repository.getScrapedUrlContent(saved.id))!.content).toBe(persisted.content);
});

// Same recovery contract for non-article URLs: stored paste is article text.
it("T9 decodes pasted text for a video or tweet URL before the actual model boundary", async () => {
  for (const url of ["https://www.youtube.com/watch?v=fictional", "https://x.com/fictional/status/123"]) {
    const saved = await stored();
    await db.updateTable("bookmarks").set({ source_url: url, metadata: { openGraph: { site_name: url.includes("youtube") ? "YouTube" : "X (formerly Twitter)" } } }).where("id", "=", saved.id).where("user_id", "=", owner).execute();
    const text = 'Careful reading helps <people> & explains evidence. '.repeat(5);
    expect((await request(`/bookmarks/${saved.id}/content`, "PUT", owner, { text })).status).toBe(200);
    const { processor, sources } = pipeline(true);
    await processor.process(saved.id, owner, { resume: true });
    expect(sources).toEqual([text.trim()]);
    expect((await request(`/bookmarks/${saved.id}/content`)).body.source).toBe("pasted");
  }
});
