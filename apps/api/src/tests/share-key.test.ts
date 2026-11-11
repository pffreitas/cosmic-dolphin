import { afterAll, beforeAll, beforeEach, expect, it, mock } from "bun:test";
import Fastify, { type FastifyInstance } from "fastify";
import { sql } from "kysely";
import { ShareKeyRepositoryImpl, ShareKeyServiceImpl, BookmarkRepositoryImpl, BookmarkServiceImpl, WebScrapingServiceImpl, type ServiceContainer } from "@cosmic-dolphin/shared";
import { closeTestDatabase, DatabaseTestUtils, getTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../routes/bookmarks";
import { registerShareKeyRoutes } from "../routes/share-keys";
import { restrictShareKeyRoutes } from "../middleware/share-key";
import { registerRateLimiting } from "../plugins/rate-limit";
const db = getTestDatabase();
const utils = new DatabaseTestUtils(db);
const webScraping = new WebScrapingServiceImpl();
const bookmark = new BookmarkServiceImpl(new BookmarkRepositoryImpl(db), webScraping);
const services = { shareKey: new ShareKeyServiceImpl(new ShareKeyRepositoryImpl(db)), bookmark, webScraping, processingBudget: { check: async () => ({ withinBudget: true }) }, queue: { sendBookmarkProcessingMessage: mock(async () => 1) } } as unknown as ServiceContainer;
let app: FastifyInstance;
let address: string;
let owner: string;
const logs: any[] = [];
const jwt = async (request: any, reply: any) => {
  if (request.headers.authorization === `Bearer fixture-jwt:${owner}`) { request.userId = owner; return; }
  return reply.status(401).send({ error: "Invalid JWT" });
};
beforeAll(async () => {
  await utils.waitForConnection();
  app = Fastify({ logger: { stream: { write: (line: string) => logs.push(JSON.parse(line)) } } });
  app.addHook("onRequest", restrictShareKeyRoutes);
  registerRateLimiting(app);
  app.register(async scope => {
    await registerShareKeyRoutes(scope, services, jwt);
    await registerBookmarkRoutes(scope, services, jwt);
  }, { prefix: "/api/v1" });
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => {
  await utils.truncateAll(); owner = crypto.randomUUID(); logs.length = 0;
  await sql`INSERT INTO auth.users (id, email) VALUES (${owner}::uuid, ${owner + "@example.invalid"})`.execute(db);
});
afterAll(async () => { await app?.close(); await closeTestDatabase(); });
async function request(method: string, path: string, body?: unknown, token = `fixture-jwt:${owner}`) {
  const response = await fetch(address + "/api/v1" + path, { method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() as any };
}
it("issues a save-only credential, saves under its owner, then rejects it after acknowledged revocation", async () => {
  const issued = await request("POST", "/share-keys", { deviceId: "installation-1" });
  expect(issued.status).toBe(201);
  expect(issued.body.key).toMatch(/^cdsk_[A-Za-z0-9_-]{43}$/);
  const saved = await request("POST", "/bookmarks", { source_url: "https://example.com/shared" }, issued.body.key);
  expect(saved.status).toBe(201);
  expect(saved.body.id).toBeString();
  expect(await bookmark.findByIdAndUser(saved.body.id, owner)).not.toBeNull();
  expect((await request("DELETE", `/share-keys/${issued.body.id}`)).status).toBe(204);
  expect((await request("POST", "/bookmarks", { source_url: "https://example.com/revoked" }, issued.body.key)).status).toBe(401);
});
it("dedupes without exposing private owner fields and rejects every extra input field", async () => {
  const original = await request("POST", "/bookmarks", { source_url: "https://example.com/private-owner", user_note: "SECRET_OWNER_NOTE", title: "Owner", collection_id: undefined });
  const issued = await request("POST", "/share-keys", { deviceId: "installation-2" });
  const body = { source_url: "https://example.com/private-owner", capture_source: "ios_share_extension", capture_platform: "ios", queued_at: new Date().toISOString() };
  const duplicate = await request("POST", "/bookmarks", body, issued.body.key);
  expect(duplicate.status).toBe(200);
  expect(duplicate.body).toEqual({ id: original.body.bookmark.id, message: "Already in your Library", alreadySaved: true });
  for (const field of ["user_note", "later_until", "title", "description", "tags", "collection_id", "is_private_link", "user_id", "bookmark", "unknown"]) {
    expect((await request("POST", "/bookmarks", { ...body, [field]: null }, issued.body.key)).status).toBe(400);
  }
});
it("rejects share credentials on every other route and rejects malformed create payloads", async () => {
  const { body: issued } = await request("POST", "/share-keys", { deviceId: "matrix" });
  for (const [method, path] of [
    ["GET", "/bookmarks"], ["GET", "/bookmarks/counts"], ["GET", "/bookmarks/shared/unknown"],
    ["GET", "/bookmarks/00000000-0000-0000-0000-000000000000"], ["PATCH", "/bookmarks/00000000-0000-0000-0000-000000000000"],
    ["DELETE", "/bookmarks/00000000-0000-0000-0000-000000000000"], ["POST", "/bookmarks/preview"],
    ["POST", "/share-keys"], ["DELETE", `/share-keys/${issued.id}`], ["GET", "/health"], ["GET", "/not-an-endpoint"],
  ]) expect((await request(method, path, undefined, issued.key)).status).toBe(401);
  for (const body of [null, {}, { source_url: "ftp://example.com" }, { source_url: 1 }, { source_url: "https://example.com", queued_at: "bad" }, { source_url: "https://example.com", capture_platform: "other" }, { source_url: "https://example.com", capture_source: "other" }]) {
    expect((await request("POST", "/bookmarks", body, issued.key)).status).toBe(400);
  }
  for (const token of ["cdsk_invalid", `cdsk_${"a".repeat(43)}`]) expect((await request("POST", "/bookmarks", { source_url: "https://example.com" }, token)).status).toBe(401);
});
it("shares the existing 100/day owner save bucket with JWT creates", async () => {
  const { body: issued } = await request("POST", "/share-keys", { deviceId: "limited" });
  const body = { source_url: "https://example.com/rate" };
  const first = await request("POST", "/bookmarks", body);
  expect(first.status).toBe(201);
  expect(first.body.bookmark.userId).toBe(owner);
  for (let count = 1; count < 100; count++) expect((await request("POST", "/bookmarks", body, issued.key)).status).toBe(200);
  const limited = await request("POST", "/bookmarks", body, issued.key);
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  expect((await request("POST", "/bookmarks", body)).status).toBe(429);
});
it("restricts a share bearer even when the HTTP auth scheme uses different casing", async () => {
  const { body: issued } = await request("POST", "/share-keys", { deviceId: "case-insensitive-scheme" });
  const response = await fetch(address + "/api/v1/bookmarks/shared/unknown", {
    headers: { authorization: `bEaReR ${issued.key}` },
  });
  expect(response.status).toBe(401);
  const saved = await fetch(address + "/api/v1/bookmarks", {
    method: "POST", headers: { authorization: `bEaReR ${issued.key}`, "content-type": "application/json" },
    body: JSON.stringify({ source_url: "https://example.com/auth-scheme" }),
  });
  expect(saved.status).toBe(201);
});
