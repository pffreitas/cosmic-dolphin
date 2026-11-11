/** Final package fixture: fictional owner boundary; actual HTTP, SQL, services and restricted keys.
 * No normal-issuer session, physical radio, native swipe or live-web proof is inferred here. */
import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceReceipt } from "./save-todays-receipt";
import { BookmarkRepositoryImpl, BookmarkServiceImpl, WebScrapingServiceImpl, ShareKeyRepositoryImpl, ShareKeyServiceImpl, PicksRepositoryImpl, PicksServiceImpl, FeedRankingServiceImpl, FeedRepositoryImpl, SocialRepositoryImpl, SocialServiceImpl, type ServiceContainer } from "@cosmic-dolphin/shared";
import { DatabaseTestUtils, getTestDatabase, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../routes/bookmarks";
import { registerShareKeyRoutes } from "../routes/share-keys";
import { registerPicksRoutes } from "../routes/picks";
import { restrictShareKeyRoutes } from "../middleware/share-key";

const db = getTestDatabase(); const utils = new DatabaseTestUtils(db);
const repository = new BookmarkRepositoryImpl(db); const webScraping = new WebScrapingServiceImpl();
const bookmark = new BookmarkServiceImpl(repository, webScraping);
const jobs: string[] = []; const logs: unknown[] = []; const events: { fields: any; message: string }[] = [];
const services = { bookmark, webScraping, shareKey: new ShareKeyServiceImpl(new ShareKeyRepositoryImpl(db)),
  queue: { sendBookmarkProcessingMessage: async (id: string) => { jobs.push(id); return 1; } },
  processingBudget: { check: async () => ({ withinBudget: true }) }, feed: { recordOpen: async () => {} },
  profile: { findById: async () => ({ name: "Fictional local reader" }) },
} as unknown as ServiceContainer;
let app: FastifyInstance; let address: string; let owner: string; let zone: string;
const users: string[] = []; const originalInfo = console.info;
const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const id = request.headers["x-t10-fictional-owner"];
  if (typeof id !== "string" || !users.includes(id)) return reply.status(401).send({ error: "Fictional fixture boundary required" });
  request.userId = id;
};
beforeAll(async () => {
  await utils.waitForConnection();
  expect(process.env.DATABASE_URL).toBe("postgres://postgres:postgres@127.0.0.1:5433/postgres");
  expect(process.env.NODE_ENV).toBe("test"); expect(process.env.COMPOSE_PROJECT_NAME).toBe("cosmic-dolphin");
  zone = (await sql<{ name: string }>`SELECT name FROM pg_timezone_names WHERE name IN ('UTC','Pacific/Honolulu','Asia/Tokyo') AND (now() AT TIME ZONE name)::time >= time '06:00' LIMIT 1`.execute(db)).rows[0].name;
  app = Fastify({ logger: { serializers: { error: (error: any) => ({ message: error?.message, code: error?.code, causeMessage: error?.cause?.message, causeCode: error?.cause?.code }) }, stream: { write: (line: string) => logs.push(JSON.parse(line)) } } });
  app.addHook("onRequest", restrictShareKeyRoutes);
  await app.register(async scope => {
    await registerBookmarkRoutes(scope, services, authenticate); await registerShareKeyRoutes(scope, services, authenticate);
    await registerPicksRoutes(scope, authenticate, new PicksServiceImpl(new PicksRepositoryImpl(db), new FeedRankingServiceImpl(new FeedRepositoryImpl(db), new SocialServiceImpl(new SocialRepositoryImpl(db)), "test")));
  }, { prefix: "/api/v1" });
  address = await app.listen({ host: "127.0.0.1", port: 0 });
  console.info = (fields, message) => { events.push({ fields, message }); };
});
beforeEach(async () => {
  await utils.truncateAll(); owner = crypto.randomUUID(); users.push(owner); jobs.length = logs.length = events.length = 0;
  await sql`INSERT INTO auth.users(id,email) VALUES (${owner}::uuid, ${`t10-${owner}@example.invalid`})`.execute(db);
});
afterAll(async () => {
  console.info = originalInfo; await app?.close();
  for (const user of users) await sql`DELETE FROM auth.users WHERE id=${user}::uuid AND email=${`t10-${user}@example.invalid`}`.execute(db);
  await closeTestDatabase();
});
async function request(path: string, method = "GET", body?: unknown, key?: string, user = owner) {
  const response = await fetch(address + "/api/v1" + path, { method,
    headers: { "x-t10-fictional-owner": user, ...(key ? { authorization: `Bearer ${key}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text(); return { status: response.status, body: text ? JSON.parse(text) : null, bytes: Buffer.byteLength(text) };
}
const today = () => request(`/picks/today?tz=${encodeURIComponent(zone)}`);
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
it("rehearses all-key rollback on additive schema while retaining saves and previous wire clients", async () => {
  const keys = [];
  for (const deviceId of ["t10-rollback-phone", "t10-rollback-tablet"]) {
    const issued = await request("/share-keys", "POST", { deviceId }); expect(issued.status).toBe(201); keys.push(issued.body);
  }
  const saved = await request("/bookmarks", "POST", { source_url: "https://t10-rollback.example.invalid/retained" }, keys[0].key);
  expect(saved.status).toBe(201);
  const columnsBefore = (await sql<{column_name:string}>`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' ORDER BY column_name`.execute(db)).rows;
  expect(columnsBefore.map(row => row.column_name)).toContain("capture_queued_at");
  // The operator's exact all-key operation, only on the explicitly guarded disposable fixture.
  await db.transaction().execute(async tx => { await sql`UPDATE share_keys SET revoked_at = now() WHERE revoked_at IS NULL`.execute(tx); });
  for (const key of keys) expect((await request("/bookmarks", "POST", { source_url: "https://t10-rollback.example.invalid/rejected" }, key.key)).status).toBe(401);
  expect((await request(`/bookmarks/${saved.body.id}`)).status).toBe(200);
  const previous = await request("/bookmarks", "POST", { source_url: "https://t10-rollback.example.invalid/previous-wire", title: "Previous client" });
  expect(previous.status).toBe(201); expect((await request(`/bookmarks/${previous.body.bookmark.id}/read`, "PUT")).body.isRead).toBe(true);
  expect((await request(`/bookmarks/${saved.body.id}`, "PATCH", { userNote: "Retained local rollback note" })).status).toBe(200);
  const columnsAfter = (await sql<{column_name:string}>`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='bookmarks' ORDER BY column_name`.execute(db)).rows;
  expect(columnsAfter).toEqual(columnsBefore);
  expect(await db.selectFrom("bookmarks").select("id").where("user_id","=",owner).execute()).toHaveLength(2);
  await receipt("rollback-http-fixture", { keyIds: keys.map(key => key.id), retainedId: saved.body.id, previousWireId: previous.body.bookmark.id,
    additiveColumnsUnchanged: true, proofLimit: "Fictional HTTP owner, disposable revocation; no live prior TestFlight/normal issuer/release rollback claim" });
});
async function receipt(name: string, fields: Record<string, unknown>) {
  if (!process.env.T10_RECEIPT_DIR) return;
  const snapshot = await sourceReceipt();
  await mkdir(process.env.T10_RECEIPT_DIR, { recursive: true });
  await writeFile(resolve(process.env.T10_RECEIPT_DIR, `${name}.json`), JSON.stringify({ ...snapshot,
    dbHost: "127.0.0.1:5433", apiHost: address, authProof: "Isolated fictional owner boundary, not normal issuer", ...fields }, null, 2));
}

it("keeps the same five server slots/reasons across capture, two done writes and a second client", async () => {
  for (let index = 0; index < 6; index++) await db.insertInto("bookmarks").values({ user_id: owner,
    source_url: `https://t10-${index % 3}.example.invalid/item-${index}`, title: `Fictional reading ${index}`, processing_status: "completed", cosmic_brief_summary: "Stored fictional brief", metadata: { readingTime: 3 } }).execute();
  const original = await today(); expect(original.status).toBe(200); expect(original.body.items).toHaveLength(5);
  const identity = (body: any) => body.items.map((item: any) => ({ id: item.bookmark.id, position: item.position, reason: item.reason }));
  const issued = await request("/share-keys", "POST", { deviceId: "t10-primary" }); expect(issued.status).toBe(201);
  const capture = await request("/bookmarks", "POST", { source_url: "https://t10-capture.example.invalid/safari", capture_source: "ios_share_extension", capture_platform: "ios" }, issued.body.key);
  expect(capture.status).toBe(201); expect(Object.keys(capture.body).sort()).toEqual(["alreadySaved", "id", "message"]);
  const pending = await request(`/bookmarks/${capture.body.id}`);
  expect(pending.body).toMatchObject({ captureSource: "ios_share_extension", capturePlatform: "ios" });
  expect(["pending", "processing"]).toContain(pending.body.processingStatus);
  expect(identity((await today()).body)).toEqual(identity(original.body));
  const first = original.body.items[0].bookmark.id; const second = original.body.items[1].bookmark.id;
  expect((await request(`/bookmarks/${first}/read`, "PUT")).body.isRead).toBe(true);
  await repository.insertScrapedUrlContents(second, { title: "Read fixture", content: "<p>Stored article text for the second pick.</p>", metadata: { extraction: { status: "complete", provider: "fixture" } } });
  expect((await request(`/bookmarks/${second}/content`)).body.blocks).toEqual([{ kind: "paragraph", text: "Stored article text for the second pick." }]);
  expect((await request(`/bookmarks/${second}/read`, "PUT")).body.isRead).toBe(true);
  const secondClient = (await today()).body;
  expect(identity(secondClient)).toEqual(identity(original.body));
  for (const id of [first, second]) expect((await request(`/bookmarks/${id}`)).body.isRead).toBe(true);
  const library = await request("/bookmarks?limit=100&offset=0"); expect(library.status).toBe(200);
  for (const id of [first, second]) expect(library.body.bookmarks.find((item: any) => item.id === id).isRead).toBe(true);
  expect(jobs).toEqual([capture.body.id]);
  await receipt("primary-http-fixture", { slots: identity(original.body), captureId: capture.body.id, doneIds: [first, second],
    proofLimit: "HTTP second client/library shape; no Safari/swipe/Next pick/native login/live web claim" });
});

it("measures 500-candidate compute and immutable reread with 10 warmups and 100 samples each", async () => {
  const candidates = Array.from({ length: 500 }, (_, index) => ({ user_id: owner,
    source_url: `https://t10-perf-${index % 20}.example.invalid/item-${index}`, title: `Controlled candidate ${index}`,
    processing_status: "completed" as const, cosmic_brief_summary: "Controlled fixture brief", user_note: "T10_PRIVATE_NOTE_SENTINEL",
    metadata: { readingTime: 5 }, created_at: new Date(Date.now() - index * 60000) }));
  await db.insertInto("bookmarks").values(candidates).execute();
  async function reset() { await db.deleteFrom("daily_picks").where("user_id", "=", owner).execute(); }
  async function sample() { const started = performance.now(); const result = await today(); const ms = performance.now() - started;
    expect(result.status).toBe(200); expect(result.body.items).toHaveLength(5); return { ms, body: result.body }; }
  for (let n = 0; n < 10; n++) { await reset(); await sample(); }
  const compute: number[] = []; const reread: number[] = []; let fixed: any;
  for (let n = 0; n < 100; n++) { await reset(); const result = await sample(); compute.push(result.ms); fixed = result.body; }
  for (let n = 0; n < 100; n++) { const result = await sample(); reread.push(result.ms); expect(result.body).toEqual(fixed); }
  const p95 = (values: number[]) => [...values].sort((a,b) => a-b)[94];
  const computed = events.filter(event => event.message === "Picks computed"); const served = events.filter(event => event.message === "Picks served");
  expect(computed).toHaveLength(110); expect(served).toHaveLength(210);
  for (const event of computed) { expect(Object.keys(event.fields).sort()).toEqual(["eligible_count", "local_date", "picked_count", "picks_ms", "time_zone", "user_id"]); expect(event.fields.eligible_count).toBe(500); }
  expect(JSON.stringify(events)).not.toContain("T10_PRIVATE_NOTE_SENTINEL");
  await receipt("picks-performance", { candidateFixtureSha256: hash(JSON.stringify(candidates)), candidateCount: 500, timeZone: zone,
    warmupComputeCount: 10, computeCount: 100, rereadCount: 100, percentileRank: 95, timer: "performance.now monotonic HTTP body + JSON",
    computeP95Ms: p95(compute), rereadP95Ms: p95(reread), computeSamplesMs: compute, rereadSamplesMs: reread, computed, served });
  expect(p95(compute)).toBeLessThanOrEqual(800); expect(p95(reread)).toBeLessThanOrEqual(200);
}, 30000);

it("measures a stored 20,000-word article at 500KB/400ms with 10 warmups and 100 HTTP samples", async () => {
  const words = Array.from({ length: 20000 }, (_, n) => `word${n}`).join(" "); const article = `<p>${words}</p>`;
  const saved = await bookmark.create("https://t10-content.example.invalid/article", owner);
  await repository.insertScrapedUrlContents(saved.id, { title: "Controlled 20k words", content: article,
    metadata: { extraction: { status: "complete", provider: "fixture_stored_extraction" } } });
  async function sample() { const start = performance.now(); const response = await request(`/bookmarks/${saved.id}/content`);
    const ms = performance.now() - start; expect(response.status).toBe(200); expect(response.body.wordCount).toBe(20000);
    expect(response.body.blocks[0].text).toBe(words); return { ms, bytes: response.bytes }; }
  for (let n = 0; n < 10; n++) await sample();
  const samples = []; for (let n = 0; n < 100; n++) samples.push(await sample());
  const p95 = samples.map(item => item.ms).sort((a,b) => a-b)[94]; const bytes = Math.max(...samples.map(item => item.bytes));
  await receipt("content-performance", { fixtureSha256: hash(article), fixtureWordCount: 20000, warmupCount: 10, measuredCount: 100,
    percentileRank: 95, timer: "performance.now monotonic HTTP body + JSON", serializedResponseBytes: bytes, p95Ms: p95, samples });
  expect(bytes).toBeLessThanOrEqual(500000); expect(p95).toBeLessThanOrEqual(400);
}, 30000);

it("dedupes concurrent capture, limits keys to POST, strips all failure/private fields and logs no secrets", async () => {
  const issued = await request("/share-keys", "POST", { deviceId: "t10-security" }); expect(issued.status).toBe(201);
  const input = { source_url: "https://t10-security.example.invalid/concurrent", capture_source: "ios_share_extension", capture_platform: "ios" };
  const responses = await Promise.all([request("/bookmarks", "POST", input, issued.body.key), request("/bookmarks", "POST", input, issued.body.key)]);
  if (responses.some(result => result.status === 500)) console.error("T10 concurrent failure", logs.filter((entry: any) => entry.level === 50));
  expect(responses.map(result => result.status).sort()).toEqual([200, 201]);
  expect(responses[0].body.id).toBe(responses[1].body.id); expect(jobs).toHaveLength(1);
  const id = responses[0].body.id;
  for (const field of ["user_note", "later_until", "title", "description", "is_private_link", "collection_id", "user_id", "tags", "extra"]) {
    expect((await request("/bookmarks", "POST", { ...input, [field]: null }, issued.body.key)).status).toBe(400);
  }
  for (const [method, path] of [["GET", `/bookmarks/${id}`], ["PATCH", `/bookmarks/${id}`], ["PUT", `/bookmarks/${id}/read`],
    ["GET", `/bookmarks/${id}/content`], ["PUT", `/bookmarks/${id}/content`], ["GET", "/bookmarks"], ["GET", "/bookmarks/feed"],
    ["GET", "/picks/today?tz=UTC"], ["GET", "/users/fictional/saves"], ["GET", "/bookmarks/continue-reading"], ["POST", "/share-keys"],
    ["DELETE", `/share-keys/${issued.body.id}`], ["GET", "/health"]]) {
    expect((await request(path, method, undefined, issued.body.key)).status).toBe(401);
  }
  const note = "T10_SECRET_NOTE_SENTINEL";
  expect((await request(`/bookmarks/${id}`, "PATCH", { userNote: note, laterUntil: new Date(Date.now() + 3600000).toISOString() })).status).toBe(200);
  const other = crypto.randomUUID(); users.push(other);
  await sql`INSERT INTO auth.users(id,email) VALUES (${other}::uuid, ${`t10-${other}@example.invalid`})`.execute(db);
  for (const [method, path, body] of [["GET", `/bookmarks/${id}`, undefined], ["PATCH", `/bookmarks/${id}`, { userNote: "intrusion" }],
    ["PUT", `/bookmarks/${id}/read`, undefined], ["GET", `/bookmarks/${id}/content`, undefined], ["PUT", `/bookmarks/${id}/content`, { text: "x".repeat(200) }]] as const) {
    expect((await request(path, method, body, undefined, other)).status).toBe(404);
  }
  const published = await bookmark.share(id, owner); const slug = published.shareUrl.split("/").pop();
  const privateFields = ["userNote", "laterUntil", "captureSource", "capturePlatform", "captureQueuedAt", "processingFailureCode", "processingError", "processingStartedAt", "processingCompletedAt", "userId"];
  for (const code of ["paywall", "auth", "blocked", "empty", "unsupported", "unavailable", "provider"] as const) {
    await bookmark.update(id, { processingFailureCode: code });
    expect((await request(`/bookmarks/${id}`)).body.processingFailureCode).toBe(code);
    const shared = await request(`/bookmarks/shared/${slug}`); expect(shared.status).toBe(200);
    for (const field of privateFields) expect(shared.body).not.toHaveProperty(field);
    expect(JSON.stringify(shared.body)).not.toContain(note);
  }
  expect((await request(`/share-keys/${issued.body.id}`, "DELETE")).status).toBe(204);
  expect((await request("/bookmarks", "POST", input, issued.body.key)).status).toBe(401);
  const text = JSON.stringify({ logs, events }); expect(text).not.toContain(note); expect(text).not.toContain(issued.body.key);
  await receipt("security-matrix", { concurrentStatuses: responses.map(result => result.status), sameBookmark: true, queuedJobs: jobs.length,
    restrictedRouteCount: 13, failureReasons: 7, ownerDenials: 5, publicPrivateFieldsAbsent: privateFields, rawKeyAndNoteAbsentFromLogs: true });
});

it("accepts previous-client create/list/read/update payloads with additive schema and current generated decoding", async () => {
  // The body and routes predate capture/picks. This is wire compatibility at a fictional
  // auth boundary; a previous signed build with a normal issuer remains a device gate.
  const saved = await request("/bookmarks", "POST", { source_url: "https://t10-previous.example.invalid/article" });
  expect(saved.status).toBe(201); expect(saved.body.bookmark.sourceUrl).toBe("https://t10-previous.example.invalid/article");
  expect(saved.body).not.toHaveProperty("id"); const id = saved.body.bookmark.id;
  const duplicate = await request("/bookmarks", "POST", { source_url: saved.body.bookmark.sourceUrl });
  expect(duplicate.status).toBe(200); expect(duplicate.body.bookmark.id).toBe(id); expect(duplicate.body.alreadySaved).toBe(true);
  const { BookmarksApi, Configuration } = await import("@cosmic-dolphin/api-client");
  const client = new BookmarksApi(new Configuration({ basePath: address + "/api/v1", fetchApi: async (url: string | URL | Request, init?: RequestInit) => {
    return fetch(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), "x-t10-fictional-owner": owner } });
  } }));
  const decoded = await client.bookmarksFindById({ id });
  expect(decoded.id).toBe(id); expect(decoded.createdAt).toBeInstanceOf(Date); expect(decoded.updatedAt).toBeInstanceOf(Date);
  expect((await request(`/bookmarks/${id}`, "PATCH", { title: "Previous client renamed" })).status).toBe(200);
  expect((await request(`/bookmarks/${id}/read`, "PUT")).body.isRead).toBe(true);
  expect((await request(`/bookmarks/${id}/read`, "DELETE")).body.isRead).toBe(false);
  const library = await request("/bookmarks?limit=20&offset=0&read_status=all&scope=all&sort=newest");
  expect(library.status).toBe(200); expect(library.body.bookmarks.find((item: any) => item.id === id).title).toBe("Previous client renamed");
  expect(jobs).toHaveLength(1);
  await receipt("previous-client-wire", { oldCreate: [201,200], oldList: 200, oldReadUnread: true, oldUpdate: true, currentGeneratedDateDecoding: true,
    proofLimit: "No previous TestFlight install or normal-issuer JWT proof" });
});
