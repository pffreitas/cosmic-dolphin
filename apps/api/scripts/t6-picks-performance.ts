/** Disposable loopback-only T-6 HTTP performance fixture. No truncation. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import Fastify from "fastify";
import { sql } from "kysely";
import { createDatabase, PicksRepositoryImpl, PicksServiceImpl, FeedRepositoryImpl, FeedRankingServiceImpl, SocialRepositoryImpl, SocialServiceImpl } from "@cosmic-dolphin/shared";
import { registerPicksRoutes } from "../src/routes/picks";
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "5433"); assert.equal(process.env.NODE_ENV, "test");
const db = createDatabase(url.toString()); const app = Fastify(); const user = crypto.randomUUID();
const out = process.env.T6_RECEIPT_DIR ?? "/tmp/T-6";
const events: { fields: Record<string, unknown>; message: string }[] = [];
const originalInfo = console.info;
console.info = (fields, message) => { events.push({ fields, message }); };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
try {
  const sha = Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim();
  const files = [...new Set([...Bun.spawnSync(["git", "diff", "--name-only"]).stdout.toString().trim().split("\n"), ...Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard"]).stdout.toString().trim().split("\n")])].filter(file => file && !file.endsWith("hooks.json")).sort();
  const manifest = await Promise.all(files.map(async path => ({ path, sha256: hash(await readFile(resolve(path))) })));
  await sql`INSERT INTO auth.users(id,email) VALUES (${user}::uuid, ${user + "@example.invalid"})`.execute(db);
  const clock = (await sql<{ instant: Date; name: string }>`SELECT now() AS instant,name FROM pg_timezone_names WHERE name IN ('UTC','Pacific/Honolulu','Asia/Tokyo') AND (now() AT TIME ZONE name)::time >= time '06:00' LIMIT 1`.execute(db)).rows[0];
  const candidates = Array.from({ length: 500 }, (_, index) => ({ id: crypto.randomUUID(), user_id: user, source_url: `https://fixture-${index % 20}.example/item-${index}`, title: `Controlled candidate ${index}`, processing_status: "completed" as const, created_at: new Date(clock.instant.getTime() - index * 60000), updated_at: clock.instant, cosmic_brief_summary: "Controlled fixture brief", user_note: "PRIVATE_T6_NOTE_SENTINEL", cosmic_tags: ["Technology"], metadata: { readingTime: 5 } }));
  await db.insertInto("bookmarks").values(candidates).execute();
  const repo = new PicksRepositoryImpl(db);
  assert.equal((await repo.candidates(user, clock.instant)).length, 500);
  await registerPicksRoutes(app, async request => { request.userId = user; }, new PicksServiceImpl(repo, new FeedRankingServiceImpl(new FeedRepositoryImpl(db), new SocialServiceImpl(new SocialRepositoryImpl(db)), "test")));
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  async function computeReset() { await db.deleteFrom("daily_picks").where("user_id", "=", user).execute(); }
  async function call() {
    const started = performance.now();
    const response = await fetch(`${address}/picks/today?tz=${encodeURIComponent(clock.name)}`);
    assert.equal(response.status, 200); const body = await response.json(); const ms = performance.now() - started;
    assert.equal(body.items.length, 5); assert.ok(body.computedAt); return { ms, body };
  }
  for (let n = 0; n < 10; n++) { await computeReset(); await call(); }
  const compute: number[] = []; const reread: number[] = [];
  let fixed;
  for (let n = 0; n < 100; n++) { await computeReset(); const sample = await call(); compute.push(sample.ms); fixed = sample.body; }
  for (let n = 0; n < 100; n++) { const sample = await call(); reread.push(sample.ms); assert.deepEqual(sample.body, fixed); }
  const p95 = (samples: number[]) => [...samples].sort((a,b) => a-b)[Math.ceil(.95 * samples.length)-1];
  const computed = events.filter(event => event.message === "Picks computed"); const served = events.filter(event => event.message === "Picks served");
  assert.equal(computed.length, 110); assert.equal(served.length, 210);
  for (const event of computed) { assert.deepEqual(Object.keys(event.fields).sort(), ["user_id","local_date","time_zone","eligible_count","picked_count","picks_ms"].sort()); assert.equal(event.fields.eligible_count, 500); assert.equal(event.fields.picked_count, 5); }
  for (const event of served) assert.deepEqual(Object.keys(event.fields).sort(), ["user_id","local_date","visible_count","done_count"].sort());
  assert.ok(!JSON.stringify(events).includes("PRIVATE_T6_NOTE_SENTINEL"));
  const receipt = { candidateHead: sha, sourceManifest: manifest, sourceManifestSha256: hash(JSON.stringify(manifest)), candidateFixtureSha256: hash(JSON.stringify(candidates)), candidateCount:500, fixtureUser:user, timeZone:clock.name, clock:clock.instant, dbHost:url.host, apiHost:address, warmupComputeCount:10, computeCount:compute.length, rereadCount:reread.length, timer:"performance.now monotonic HTTP response + JSON", percentileRank:95, computeP95:p95(compute), rereadP95:p95(reread), computeSamples:compute, rereadSamples:reread, computedEventCount:computed.length, servedEventCount:served.length };
  await writeFile(`${out}/performance.json`, JSON.stringify(receipt,null,2)); await writeFile(`${out}/performance-events.json`, JSON.stringify(events,null,2));
  originalInfo({computeCount:100,rereadCount:100,computeP95:receipt.computeP95,rereadP95:receipt.rereadP95,dbHost:url.host,apiHost:address},"T6 picks performance");
  assert.ok(receipt.computeP95 <= 800); assert.ok(receipt.rereadP95 <= 200);
} finally {
  console.info = originalInfo; await app.close(); await sql`DELETE FROM auth.users WHERE id = ${user}::uuid`.execute(db);
  assert.equal((await db.selectFrom("profiles").select("id").where("id","=",user).execute()).length,0);
  await db.destroy(); console.log("Owned performance fixture user removed");
}
