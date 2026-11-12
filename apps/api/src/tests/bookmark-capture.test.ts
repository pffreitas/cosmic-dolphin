import { beforeAll, beforeEach, afterAll, expect, it, mock } from "bun:test";
import { sql } from "kysely";
import Fastify, { type FastifyInstance } from "fastify";
import { BookmarkRepositoryImpl, BookmarkServiceImpl, WebScrapingServiceImpl, SocialServiceImpl, SocialRepositoryImpl, FeedRepositoryImpl, FeedRankingServiceImpl, ExploreRepositoryImpl, ExploreServiceImpl, type ServiceContainer } from "@cosmic-dolphin/shared";
import { DatabaseTestUtils, getTestDatabase, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../routes/bookmarks";
const db = getTestDatabase();
const utils = new DatabaseTestUtils(db);
const scraping = new WebScrapingServiceImpl();
const scrape = mock(async (_url: string): Promise<never> => { throw new Error("Create must never fetch a page"); });
scraping.scrape = scrape;
const bookmark = new BookmarkServiceImpl(new BookmarkRepositoryImpl(db), scraping);
const send = mock(async () => 1);
let app: FastifyInstance;
const logs: any[] = [];
let address: string;
let userId: string;
beforeAll(async () => {
  await utils.waitForConnection();
  app = Fastify({ logger: { stream: { write: (line: string) => logs.push(JSON.parse(line)) } } });
  await registerBookmarkRoutes(app, { bookmark, webScraping: scraping,
    processingBudget: { check: async () => ({ withinBudget: true }) },
    queue: { sendBookmarkProcessingMessage: send },
  } as unknown as ServiceContainer, async request => { request.userId = request.headers["x-fixture-user"] as string; });
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => { await utils.truncateAll(); userId = crypto.randomUUID(); send.mockClear(); scrape.mockClear(); logs.length = 0; });
afterAll(async () => { await app?.close(); await closeTestDatabase(); });
async function request(method: string, path: string, body?: any, owner = userId) {
  const result = await fetch(address + path, { method, headers: { "x-fixture-user": owner, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await result.json();
  return { statusCode: result.status, json: () => payload as any };
}
function create(body: any) { return request("POST", "/bookmarks", body); }
it("concurrent captures share one durable bookmark and job, with source and queue time retained", async () => {
  const queuedAt = new Date(Date.now() - 5000).toISOString();
  const body = { source_url: "https://example.com/article", capture_source: "save_sheet", capture_platform: "ios", queued_at: queuedAt };
  const results = await Promise.all([create(body), create(body)]);
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 201]);
  expect(results[0].json().bookmark.id).toBe(results[1].json().bookmark.id);
  expect(send).toHaveBeenCalledTimes(1);
  const saved = await bookmark.findByIdAndUser(results[0].json().bookmark.id, userId);
  expect(saved).toMatchObject({ captureSource: "save_sheet", capturePlatform: "ios", captureQueuedAt: new Date(queuedAt) });
});
it("duplicate capture fills only a NULL note, replaces explicit timing, preserves omission and attribution, and never requeues", async () => {
  const url = "https://example.com/precedence";
  const later = new Date(Date.now() + 86400000).toISOString();
  const first = (await create({ source_url: url, later_until: later, capture_source: "clipboard", capture_platform: "ios" })).json().bookmark;
  const filled = (await create({ source_url: url, user_note: "First note", capture_source: "save_sheet", capture_platform: "android" })).json();
  expect(filled.alreadySaved).toBe(true);
  expect(filled.bookmark).toMatchObject({ userNote: "First note", laterUntil: later, captureSource: "clipboard", capturePlatform: "ios" });
  const cleared = (await create({ source_url: url, user_note: "Must not overwrite", later_until: null })).json().bookmark;
  expect(cleared).toMatchObject({ id: first.id, userNote: "First note", laterUntil: null });
  expect(send).toHaveBeenCalledTimes(1);
});
it("create and owner PATCH enforce 500-character notes and future-only timing through 60 days", async () => {
  const result = await create({ source_url: "https://example.com/bounds", user_note: "a".repeat(500) });
  expect(result.statusCode).toBe(201);
  const id = result.json().bookmark.id;
  expect((await create({ source_url: "https://example.com/too-long", user_note: "a".repeat(501) })).statusCode).toBe(400);
  for (const later of [new Date(Date.now() - 1).toISOString(), new Date(Date.now() + 61 * 86400000).toISOString(), "invalid"]) {
    expect((await create({ source_url: "https://example.com/invalid-time", later_until: later })).statusCode).toBe(400);
    expect((await request("PATCH", `/bookmarks/${id}`, { laterUntil: later })).statusCode).toBe(400);
  }
  const future = new Date(Date.now() + 60 * 86400000 - 1000).toISOString();
  const patched = await request("PATCH", `/bookmarks/${id}`, { userNote: "Changed", laterUntil: future });
  expect(patched.statusCode).toBe(200);
  expect(patched.json()).toMatchObject({ userNote: "Changed", laterUntil: future });
  expect((await request("PATCH", `/bookmarks/${id}`, { userNote: "a".repeat(501) })).statusCode).toBe(400);
  expect((await request("PATCH", `/bookmarks/${id}`, { title: "Title only" })).json()).toMatchObject({ userNote: "Changed", laterUntil: future });
  expect((await request("PATCH", `/bookmarks/${id}`, { userNote: null, laterUntil: null })).json()).toMatchObject({ userNote: null, laterUntil: null });
  expect((await request("PATCH", `/bookmarks/${id}`, { userNote: "Other owner" }, crypto.randomUUID())).statusCode).toBe(404);
});
it("private capture requires title and description, persists intent, and replay never fetches or requeues", async () => {
  const url = "https://example.com/private";
  expect((await create({ source_url: url, is_private_link: true, description: "Description" })).statusCode).toBe(400);
  expect((await create({ source_url: url, is_private_link: true, title: "Title", description: " " })).statusCode).toBe(400);
  const body = { source_url: url, is_private_link: true, title: "Private title", description: "Description for soft processing", user_note: "Separate note", later_until: null, capture_source: "save_sheet", capture_platform: "android" };
  const created = await create(body);
  expect(created.statusCode).toBe(201);
  expect(created.json().bookmark).toMatchObject({ isPrivateLink: true, userNote: "Separate note", captureSource: "save_sheet", capturePlatform: "android", laterUntil: null, cosmicBriefSummary: body.description });
  const replay = await create(body);
  expect(replay.statusCode).toBe(200);
  expect(replay.json().alreadySaved).toBe(true);
  expect(scrape).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
  for (const invalid of [{ capture_source: "unknown" }, { capture_platform: "other" }, { queued_at: "bad date" }, { user_note: null }, { is_private_link: "false" }]) {
    expect((await create({ source_url: url, ...invalid })).statusCode).toBe(400);
  }
});
it("owner fields stay private across shared-slug, public saves, Explore, followed and reshare feed DTOs", async () => {
  const owner = userId;
  const viewer = crypto.randomUUID();
  for (const id of [owner, viewer]) await sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${id + "@example.invalid"}) ON CONFLICT (id) DO NOTHING`.execute(db);
  await db.insertInto("profiles").values([{ id: owner, email: "owner@example.invalid", handle: "fixture_owner" }, { id: viewer, email: "viewer@example.invalid", handle: "fixture_viewer" }]).onConflict(oc => oc.column("id").doUpdateSet(eb => ({ handle: eb.ref("excluded.handle") }))).execute();
  const created = (await create({ source_url: "https://example.com/public", user_note: "Private reason", later_until: new Date(Date.now() + 86400000).toISOString(), capture_source: "clipboard", capture_platform: "ios", queued_at: new Date().toISOString() })).json().bookmark;
  const shared = await bookmark.share(created.id, owner);
  await bookmark.updateProcessingStatus(created.id, "completed");
  await bookmark.update(created.id, { processingFailureCode: "paywall" });
  const social = new SocialServiceImpl(new SocialRepositoryImpl(db));
  await social.follow(viewer, "fixture_owner");
  const ranking = new FeedRankingServiceImpl(new FeedRepositoryImpl(db), social, "test");
  const publicResults = [
    (await request("GET", `/bookmarks/shared/${shared.shareUrl.split("/").at(-1)}`)).json(),
    (await social.listPublicSaves("fixture_owner", { viewerId: viewer }))!.bookmarks[0],
    (await new ExploreServiceImpl(new ExploreRepositoryImpl(db)).list(viewer)).items[0]?.bookmark,
    (await ranking.getFeed(viewer, { scope: "following" })).items[0]?.bookmark,
  ];
  const reshare = await bookmark.create("https://example.com/reshare", owner, { savedFromBookmarkId: created.id, userNote: "Resharer's private note", laterUntil: new Date(Date.now() + 86400000), captureSource: "save_sheet", capturePlatform: "ios" });
  await bookmark.updateProcessingStatus(reshare.id, "completed");
  await bookmark.share(reshare.id, owner);
  await bookmark.update(reshare.id, { processingFailureCode: "auth" });
  ranking.invalidate(viewer);
  publicResults.push((await ranking.getFeed(viewer, { scope: "following" })).items.find(item => item.type === "reshare")?.bookmark);
  for (const value of publicResults) {
    expect(value).toBeDefined();
    for (const field of ["userNote", "laterUntil", "captureSource", "capturePlatform", "captureQueuedAt", "processingFailureCode", "processingError", "processingStartedAt", "processingCompletedAt"]) expect(Object.prototype.hasOwnProperty.call(value!, field)).toBe(false);
  }
  expect(await bookmark.findByIdAndUser(created.id, owner)).toMatchObject({ userNote: "Private reason", captureSource: "clipboard", processingFailureCode: "paywall" });
});
it("legacy omission stays NULL with unknown platform and capture logs carry attribution without note text", async () => {
  const legacy = (await create({ source_url: "https://example.com/legacy" })).json().bookmark;
  expect(legacy).toMatchObject({ captureSource: null, capturePlatform: "unknown", captureQueuedAt: null, userNote: null, laterUntil: null });
  // Capture age uses database creation time, so keep the fixture on that clock.
  const queuedAt = new Date(new Date(legacy.createdAt).getTime() - 10000).toISOString();
  const body = { source_url: "https://example.com/logged", user_note: "PRIVATE_NOTE_NEVER_LOG", capture_source: "save_sheet", capture_platform: "ios", queued_at: queuedAt };
  await create(body);
  await create(body);
  const createdLogs = logs.filter(log => log.msg === "Bookmark created");
  expect(createdLogs).toHaveLength(3);
  expect(createdLogs[1]).toMatchObject({ capture_source: "save_sheet", capture_platform: "ios", queued: true, already_saved: false });
  expect(createdLogs[1].queue_age_s).toBeGreaterThanOrEqual(10);
  expect(createdLogs[2].already_saved).toBe(true);
  expect(JSON.stringify(logs)).not.toContain("PRIVATE_NOTE_NEVER_LOG");
});
it("malformed private title and description are client errors rather than server crashes", async () => {
  for (const fields of [{ title: 5, description: "Description" }, { title: "Title", description: 5 }]) {
    expect((await create({ source_url: "https://example.com/malformed", is_private_link: true, ...fields })).statusCode).toBe(400);
  }
});
