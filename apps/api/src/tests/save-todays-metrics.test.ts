/** Disposable reporting cohorts. Executes the operator's exact read-only SQL. */
import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceReceipt } from "./save-todays-receipt";
import { createHash } from "node:crypto";
import { CompiledQuery, sql } from "kysely";
import { DatabaseTestUtils, getTestDatabase, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
const db = getTestDatabase(); const utils = new DatabaseTestUtils(db); const owners: string[] = [];
let owner: string; const observations: Record<string, unknown> = {};
const start = "2026-03-02T00:00:00Z"; const end = "2026-03-09T00:00:00Z";
beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe("postgres://postgres:postgres@127.0.0.1:5433/postgres");
  expect(process.env.NODE_ENV).toBe("test"); expect(process.env.COMPOSE_PROJECT_NAME).toBe("cosmic-dolphin");
  await utils.waitForConnection();
});
beforeEach(async () => {
  await utils.truncateAll(); owner = crypto.randomUUID(); owners.push(owner);
  await sql`INSERT INTO auth.users(id,email) VALUES (${owner}::uuid, ${`t10-metric-${owner}@example.invalid`})`.execute(db);
});
afterAll(async () => {
  for (const id of owners) await sql`DELETE FROM auth.users WHERE id=${id}::uuid AND email=${`t10-metric-${id}@example.invalid`}`.execute(db);
  await closeTestDatabase();
  if (process.env.T10_RECEIPT_DIR) {
    const snapshot = await sourceReceipt();
    await mkdir(process.env.T10_RECEIPT_DIR, { recursive: true });
    await writeFile(resolve(process.env.T10_RECEIPT_DIR, "metric-query-fixtures.json"), JSON.stringify({
      ...snapshot,
      proof: "Fictional disposable cohorts; no production baseline or release outcomes", observations
    }, null, 2));
  }
});
async function query(name: string, zone = "UTC") {
  const doc = await readFile(resolve(__dirname, "../../../mobile/IMPLEMENTATION.md"), "utf8");
  const match = doc.match(new RegExp("<!-- " + name + " -->\\s*```sql\\n([\\s\\S]*?)\\n```"));
  expect(match, "Operator SQL definition must exist").not.toBeNull();
  const statement = match![1];
  expect(statement).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create)\b/i);
  const result = await db.transaction().execute(async tx => {
    await sql`SET TRANSACTION READ ONLY`.execute(tx);
    await sql.raw(zone === "America/New_York" ? "SET LOCAL TIME ZONE 'America/New_York'" : "SET LOCAL TIME ZONE 'UTC'").execute(tx);
    return tx.executeQuery<Record<string, string | number | null>>(CompiledQuery.raw(statement, [start, end]));
  });
  observations[name] = { start, end, sqlSha256: createHash("sha256").update(statement).digest("hex"), rows: result.rows };
  return result.rows[0];
}
async function saved(created: string, read?: string, extra: Record<string, unknown> = {}) {
  return (await db.insertInto("bookmarks").values({
    user_id: owner, source_url: `https://t10-metric.example.invalid/${crypto.randomUUID()}`,
    created_at: new Date(created), read_at: read ? new Date(read) : null, ...extra
  }).returning("id").executeTakeFirstOrThrow()).id;
}
it("G-1 counts exactly seven-day completions inside a mature half-open UTC save cohort", async () => {
  await saved(start, "2026-03-09T00:00:00Z");
  await saved(start, "2026-03-09T00:00:00.001Z");
  await saved("2026-03-08T23:59:59Z");
  await saved(end, "2026-03-09T01:00:00Z");
  await saved("2026-03-01T23:59:59Z", start);
  const row = await query("G-1", "America/New_York"); expect(Number(row.saves)).toBe(3); expect(Number(row.done_7d)).toBe(1);
  expect(Number(row.save_to_done_7d)).toBeCloseTo(100 / 3);
});
it("G-2/G-5 use DST windows, all stored user-days and original slots including hidden/deleted", async () => {
  const a = await saved(start, "2026-03-08T09:59:59Z");
  const b = await saved(start, "2026-03-08T10:00:00Z");
  const hidden = await saved(start); const deleted = crypto.randomUUID();
  await db.insertInto("daily_picks").values({ user_id: owner, local_date: "2026-03-07",
    time_zone: "America/New_York", bookmark_ids: [a,b,hidden,deleted], reasons: ["r","r","r","r"] }).execute();
  await db.insertInto("daily_picks").values({ user_id: owner, local_date: "2026-03-08",
    time_zone: "America/New_York", bookmark_ids: [deleted], reasons: ["r"] }).execute();
  await db.insertInto("feed_feedback").values({ user_id: owner, bookmark_id: hidden, kind: "not_interested",
    created_at: new Date("2026-03-07T12:00:00Z") }).execute();
  // Undo before send creates no row; this late feedback is outside the original pick day.
  await db.insertInto("feed_feedback").values({ user_id: owner, bookmark_id: a, kind: "not_interested",
    created_at: new Date("2026-03-08T10:00:00Z") }).execute();
  const done = await query("G-2"); expect(Number(done.pick_user_days)).toBe(2); expect(Number(done.done_picks)).toBe(1);
  expect(Number(done.picks_done_per_active_day)).toBe(0.5);
  const reject = await query("G-5"); expect(Number(reject.original_slots)).toBe(5);
  expect(Number(reject.rejected_slots)).toBe(1); expect(Number(reject.rejection_pct)).toBe(20);
  const dst = await sql<{spring_hours:string;fall_hours:string}>`SELECT EXTRACT(epoch FROM
    ((date '2026-03-08' + time '06:00') AT TIME ZONE 'America/New_York') -
    ((date '2026-03-07' + time '06:00') AT TIME ZONE 'America/New_York')) / 3600 AS spring_hours,
    EXTRACT(epoch FROM ((date '2026-11-01' + time '06:00') AT TIME ZONE 'America/New_York') -
    ((date '2026-10-31' + time '06:00') AT TIME ZONE 'America/New_York')) / 3600 AS fall_hours`.execute(db);
  expect(Number(dst.rows[0].spring_hours)).toBe(23); expect(Number(dst.rows[0].fall_hours)).toBe(25);
  observations.DST = dst.rows;
});
it("G-3 uses all attributed iOS saves as the denominator", async () => {
  await saved(start, undefined, {capture_platform:"ios",capture_source:"ios_share_extension"});
  await saved(start, undefined, {capture_platform:"ios",capture_source:"clipboard"});
  await saved(start, undefined, {capture_platform:"android",capture_source:"android_share"});
  await saved(start); const row = await query("G-3");
  expect(Number(row.ios_saves)).toBe(2); expect(Number(row.extension_saves)).toBe(1); expect(Number(row.ios_extension_pct)).toBe(50);
});
it("G-4 unions saving and reading actors once and uses UTC week boundaries", async () => {
  await saved(start); await saved("2026-03-08T23:59:59Z", "2026-03-08T23:59:59Z");
  const other = crypto.randomUUID(); owners.push(other);
  await sql`INSERT INTO auth.users(id,email) VALUES (${other}::uuid, ${`t10-metric-${other}@example.invalid`})`.execute(db);
  await saved("2026-02-01T00:00:00Z", start, {user_id:other});
  await saved(end); const row = await query("G-4");
  expect(Number(row.saves)).toBe(2); expect(Number(row.active_users)).toBe(2); expect(Number(row.saves_per_active_user_week)).toBe(1);
});
it("G-6 counts observed queue lag strictly above 24h without inferring client-only failures", async () => {
  await saved(start, undefined, {capture_queued_at:new Date("2026-03-01T00:00:00Z")});
  await saved(start, undefined, {capture_queued_at:new Date("2026-02-28T23:59:59Z")});
  await saved(start); const row = await query("G-6");
  expect(Number(row.attributed_queued_saves)).toBe(2); expect(Number(row.observed_over_24h)).toBe(1);
  expect(Number(row.max_queue_age_s)).toBe(86401);
});
