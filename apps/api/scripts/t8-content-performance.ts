/** Final-source NFR-3 receipt. Isolated fictional owner auth; real loopback DB/API. No TRUNCATE. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import Fastify from "fastify";
import { sql } from "kysely";
import { BookmarkRepositoryImpl, BookmarkServiceImpl, createDatabase, WebScrapingServiceImpl, type ServiceContainer } from "@cosmic-dolphin/shared";
import { registerBookmarkRoutes } from "../src/routes/bookmarks";

const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "5433");
assert.equal(url.pathname, "/postgres"); assert.equal(url.username, "postgres");
assert.equal(process.env.NODE_ENV, "test"); assert.equal(process.env.COMPOSE_PROJECT_NAME, "cosmic-dolphin");
const db = createDatabase(url.toString());
const app = Fastify();
const owner = crypto.randomUUID(); const email = `t8-owned-${owner}@example.invalid`;
let seeded = false;
let fixtureBookmark: string | undefined;
let measured = false;
const output = process.env.T8_RECEIPT_DIR ?? "/tmp/T-8";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function marker() {
  const result = await sql<{ present: boolean }>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='__test_database_marker') AS present`.execute(db);
  assert.equal(result.rows[0]?.present, true, "Disposable database marker required");
}
try {
  await marker();
  const head = Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim();
  const paths = [...new Set([
    ...Bun.spawnSync(["git", "diff", "--name-only"]).stdout.toString().trim().split("\n"),
    ...Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard"]).stdout.toString().trim().split("\n"),
  ])].filter(Boolean).sort();
  const manifest = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(resolve(path))) })));
  await sql`INSERT INTO auth.users(id,email) VALUES (${owner}::uuid, ${email})`.execute(db); seeded = true;
  const repository = new BookmarkRepositoryImpl(db);
  const bookmark = new BookmarkServiceImpl(repository, new WebScrapingServiceImpl());
  const words = Array.from({ length: 20000 }, (_, n) => `word${n}`);
  const article = `<p>${words.join(" ")}</p>`;
  const saved = await bookmark.create("https://t8-owned.example.invalid/article", owner);
  fixtureBookmark = saved.id;
  await repository.insertScrapedUrlContents(saved.id, { title: "Deterministic 20,000-word article", content: article, metadata: { extraction: { status: "complete", provider: "fixture_stored_extraction", fetchedAt: "2026-11-09T00:00:00Z" } } });
  await registerBookmarkRoutes(app, { bookmark } as unknown as ServiceContainer, async (request, reply) => {
    if (request.headers["x-owned-fixture-user"] !== owner) return reply.status(401).send({ error: "Isolated fixture owner required" });
    request.userId = owner;
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const byteSamples: number[] = [];
  async function sample() {
    const started = performance.now();
    const response = await fetch(`${address}/bookmarks/${saved.id}/content`, { headers: { "x-owned-fixture-user": owner } });
    const text = await response.text(); const body = JSON.parse(text);
    const elapsed = performance.now() - started;
    assert.equal(response.status, 200); assert.equal(body.wordCount, 20000); assert.equal(body.source, "extracted");
    assert.equal(body.blocks[0].text, words.join(" "));
    byteSamples.push(Buffer.byteLength(text)); return elapsed;
  }
  for (let n = 0; n < 10; n++) await sample();
  byteSamples.length = 0;
  const timings: number[] = [];
  for (let n = 0; n < 100; n++) timings.push(await sample());
  const rank = Math.ceil(.95 * timings.length);
  const p95 = [...timings].sort((a, b) => a - b)[rank - 1];
  const bytes = Math.max(...byteSamples);
  const receipt = { candidateHead: head, sourceManifest: manifest, sourceManifestSha256: hash(JSON.stringify(manifest)),
    fixtureSha256: hash(article), fixtureWordCount: words.length, fixtureUser: owner, fixtureBookmark: saved.id,
    authProof: "Isolated injected fictional owner boundary; not normal issuer proof", dbHost: url.host, apiHost: address,
    warmupCount: 10, measuredCount: timings.length, percentileRank: rank, timer: "performance.now monotonic, HTTP response body plus JSON parsing",
    serializedResponseBytes: bytes, byteSamples, p95Ms: p95, elapsedSamplesMs: timings };
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/content-performance.json`, JSON.stringify(receipt, null, 2));
  measured = true;
  console.log(JSON.stringify({ measuredCount: timings.length, warmupCount: 10, serializedResponseBytes: bytes, p95Ms: p95, fixtureSha256: receipt.fixtureSha256, dbHost: url.host, apiHost: address }));
  assert.ok(bytes <= 500000); assert.ok(p95 <= 400);
} finally {
  try {
    await app.close();
    if (seeded) {
      await marker();
      await db.transaction().execute(async transaction => {
        const owned = await sql<{ email: string }>`SELECT email FROM auth.users WHERE id=${owner}::uuid`.execute(transaction);
        assert.equal(owned.rows[0]?.email, email, "Refuse cleanup of an account this fixture does not own");
        if (fixtureBookmark) {
          const saved = await transaction.selectFrom("bookmarks").select(["id", "source_url"])
            .where("id", "=", fixtureBookmark).where("user_id", "=", owner).executeTakeFirstOrThrow();
          assert.equal(saved.source_url, "https://t8-owned.example.invalid/article");
          await transaction.deleteFrom("scraped_url_contents").where("bookmark_id", "=", saved.id).execute();
          await transaction.deleteFrom("bookmarks").where("id", "=", saved.id).where("user_id", "=", owner).execute();
        }
        await sql`DELETE FROM auth.users WHERE id=${owner}::uuid AND email=${email}`.execute(transaction);
        assert.equal((await transaction.selectFrom("bookmarks").select("id").where("user_id", "=", owner).execute()).length, 0);
        const auth = await sql`SELECT id FROM auth.users WHERE id=${owner}::uuid`.execute(transaction);
        assert.equal(auth.rows.length, 0);
      });
      if (measured) {
        const receipt = JSON.parse(await readFile(`${output}/content-performance.json`, "utf8"));
        receipt.cleanup = { serverClosed: true, ownedAuthUserRemoved: true, ownedBookmarkAndContentRemoved: true, truncateUsed: false };
        await writeFile(`${output}/content-performance.json`, JSON.stringify(receipt, null, 2));
      }
      console.log("Owned fictional bookmark, content, auth user and server removed; no truncation");
    }
  } finally { await db.destroy(); }
}
