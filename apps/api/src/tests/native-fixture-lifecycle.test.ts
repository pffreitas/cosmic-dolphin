/** Public lifecycle of the isolated native harness; no product auth or hosted writes. */
import { expect, it } from "bun:test";
import { CompiledQuery } from "kysely";
import { resolve } from "node:path";
import { createDatabase } from "@cosmic-dolphin/shared";
import { DatabaseTestUtils } from "@cosmic-dolphin/shared/dist/test-utils/database";
it("native fixture shutdown removes its bookmarks and auth account while preserving other data", async () => {
  const root = resolve(__dirname, "../../../..");
  const db = createDatabase(process.env.DATABASE_URL!);
  await new DatabaseTestUtils(db).waitForConnection();
  const child = Bun.spawn(["bun", "apps/mobile/ios/ShareQueueTests/local-api-fixture.mjs"], { cwd: root, env: process.env, stdout: "ignore", stderr: "pipe" });
  let owner: string | undefined; let article: string | undefined; let stopped = false;
  try {
    let fixture: any;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { fixture = await (await fetch("http://127.0.0.1:5536/fixture")).json(); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 25)); }
    }
    expect(fixture).toBeDefined(); owner = fixture.item.userId; article = fixture.article;
    const before = (await db.selectFrom("bookmarks").select("id").where("user_id", "!=", owner!).execute()).map(row => row.id).sort();
    const saved = await fetch("http://127.0.0.1:5536/api/v1/bookmarks", {
      method: "POST", headers: { authorization: "Bearer " + fixture.item.key, "content-type": "application/json" },
      body: JSON.stringify({ source_url: article, capture_source: "ios_share_extension", capture_platform: "ios" }),
    });
    expect(saved.status).toBe(201);
    child.kill("SIGTERM"); expect(await child.exited).toBe(0); stopped = true;
    expect(await db.selectFrom("bookmarks").select("id").where("user_id", "=", owner!).execute()).toEqual([]);
    expect((await db.executeQuery(CompiledQuery.raw("SELECT id FROM auth.users WHERE id=$1::uuid", [owner]))).rows).toEqual([]);
    expect((await db.selectFrom("bookmarks").select("id").where("user_id", "!=", owner!).execute()).map(row => row.id).sort()).toEqual(before);
  } finally {
    if (!stopped) { child.kill("SIGTERM"); await child.exited; }
    // The failing implementation may leave its bookmark. Clean only the exact
    // fictional owner/URL after recording the failed assertion.
    if (owner && article) {
      const rows = await db.selectFrom("bookmarks").select(["id", "source_url"]).where("user_id", "=", owner).execute();
      for (const row of rows) {
        expect(row.source_url).toBe(article);
        await db.deleteFrom("bookmarks").where("id", "=", row.id).where("user_id", "=", owner).where("source_url", "=", article).execute();
      }
    }
    await db.destroy();
  }
}, 15000);
