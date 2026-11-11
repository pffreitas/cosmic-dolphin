// Standalone native-test infrastructure. Never imported by the app or normal API server.
// Run from repo root with the explicit disposable test environment and built shared package.
import assert from "node:assert/strict";
import Fastify from "fastify";
import { sql } from "kysely";
import { ShareKeyRepositoryImpl, ShareKeyServiceImpl, BookmarkRepositoryImpl, BookmarkServiceImpl, WebScrapingServiceImpl } from "@cosmic-dolphin/shared";
import { getTestDatabase, DatabaseTestUtils, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../../../api/src/routes/bookmarks.ts";
import { restrictShareKeyRoutes } from "../../../api/src/middleware/share-key.ts";
import { registerRateLimiting } from "../../../api/src/plugins/rate-limit.ts";
assert.equal(process.env.DATABASE_URL, "postgres://postgres:postgres@127.0.0.1:5433/postgres");
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.COMPOSE_PROJECT_NAME, "cosmic-dolphin");
const db = getTestDatabase();
await new DatabaseTestUtils(db).waitForConnection();
async function assertDisposableMarker() {
  const marker = await sql`SELECT to_regclass('public.__test_database_marker') IS NOT NULL AS present`.execute(db);
  assert.equal(marker.rows[0]?.present, true, "Refuse native fixture without disposable database marker");
}
await assertDisposableMarker();
// This harness owns exactly this fictional user; it never truncates another session's fixtures.
const userId = crypto.randomUUID();
await sql`INSERT INTO auth.users (id, email) VALUES (${userId}::uuid, ${userId + "@example.invalid"})`.execute(db);
const shareKey = new ShareKeyServiceImpl(new ShareKeyRepositoryImpl(db));
const webScraping = new WebScrapingServiceImpl();
const bookmark = new BookmarkServiceImpl(new BookmarkRepositoryImpl(db), webScraping);
let jobs = 0;
const jobCounts = new Map();
const services = { shareKey, bookmark, webScraping, processingBudget: { check: async () => ({ withinBudget: true }) }, queue: { sendBookmarkProcessingMessage: async id => { jobCounts.set(id, (jobCounts.get(id) ?? 0) + 1); return ++jobs; } } };
const issued = await shareKey.issue(userId, "native-fixture-installation");
const origin = "http://127.0.0.1:5536";
const item = { key: issued.key, keyId: issued.id, deviceId: "native-fixture-installation", userId, apiBaseUrl: origin };
const article = "https://example.com/t3-native-" + userId;
const app = Fastify({ logger: false });
app.addHook("onRequest", restrictShareKeyRoutes);
registerRateLimiting(app);
app.register(async scope => {
  // Explicit test auth-boundary injection, as in existing API tests. Normal JWT middleware is untouched.
  await registerBookmarkRoutes(scope, services, async (request, reply) => {
    if (request.headers.authorization !== "Bearer fixture-owner") return reply.status(401).send({ error: "Fixture owner only" });
    request.userId = userId;
  });
}, { prefix: "/api/v1" });
app.get("/fixture", async request => ({ item: { ...item, apiBaseUrl: request.query?.offline ? "http://127.0.0.1:5599" : origin }, article }));
app.get("/fixture/revoked", async () => {
  const rejected = await shareKey.issue(userId, "rejected-native-fixture");
  await shareKey.revoke(rejected.id, userId);
  return { item: { ...item, key: rejected.key, keyId: rejected.id }, article: article + "-revoked-" + rejected.id };
});
app.post("/fixture/revoke", async () => { await shareKey.revoke(issued.id, userId); return { revoked: true }; });
app.get("/fixture/state", async () => {
  const rows = await db.selectFrom("bookmarks").select(["id", "source_url", "capture_source", "capture_platform", "capture_queued_at"]).where("user_id", "=", userId).execute();
  return { rows, jobs, jobCounts: Object.fromEntries(jobCounts) };
});
await app.listen({ port: 5536, host: "127.0.0.1" });
console.log("Native fixture API listening on loopback5536; fictional auth boundary, real restricted-key routes/Postgres; queue sender counted, no hosted writes.");
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  await app.close();
  // Revalidate the disposable marker and remove only this harness's URL/owner
  // rows. bookmarks.user_id does not cascade directly from auth.users.
  await assertDisposableMarker();
  await db.transaction().execute(async transaction => {
    const account = (await sql.raw("SELECT id, email FROM auth.users").execute(transaction)).rows.find(row => row.id === userId);
    assert.equal(account?.email, userId + "@example.invalid", "Refuse cleanup of another account");
    const rows = await transaction.selectFrom("bookmarks").select(["id", "source_url"]).where("user_id", "=", userId).execute();
    for (const row of rows) {
      assert.ok(row.source_url === article || row.source_url.startsWith(article + "-"), "Refuse cleanup of another fixture URL");
      await transaction.deleteFrom("scraped_url_contents").where("bookmark_id", "=", row.id).execute();
      await transaction.deleteFrom("bookmarks").where("id", "=", row.id).where("user_id", "=", userId).where("source_url", "=", row.source_url).execute();
    }
    await transaction.deleteFrom("auth.users").where("id", "=", userId).where("email", "=", userId + "@example.invalid").execute();
  });
  await closeTestDatabase();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void stop().then(() => process.exit(0)); });
