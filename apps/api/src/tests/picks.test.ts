import { beforeAll, beforeEach, afterAll, expect, it } from "bun:test";
import { sql } from "kysely";
import Fastify, { type FastifyInstance } from "fastify";
import { DatabaseTestUtils, getTestDatabase, closeTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerPicksRoutes } from "../routes/picks";
import { PicksServiceImpl, PicksRepositoryImpl, FeedRankingServiceImpl, FeedRepositoryImpl, SocialServiceImpl, SocialRepositoryImpl } from "@cosmic-dolphin/shared";

const db = getTestDatabase();
const utils = new DatabaseTestUtils(db);
let app: FastifyInstance;
let address: string;
let owner: string;
const fixtureUsers: string[] = [];
let computeZone: string;
beforeAll(async () => {
  await utils.waitForConnection();
  computeZone = (await sql<{ name: string }>`SELECT name FROM pg_timezone_names WHERE name IN ('UTC','Pacific/Honolulu','Asia/Tokyo') AND (now() AT TIME ZONE name)::time >= time '06:00' LIMIT 1`.execute(db)).rows[0].name;
  app = Fastify();
  await registerPicksRoutes(app, async request => { request.userId = request.headers["x-fixture-user"] as string; }, new PicksServiceImpl(new PicksRepositoryImpl(db), new FeedRankingServiceImpl(new FeedRepositoryImpl(db), new SocialServiceImpl(new SocialRepositoryImpl(db)), "test")));
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => {
  await utils.truncateAll();
  owner = crypto.randomUUID();
  fixtureUsers.push(owner);
  await sql`INSERT INTO auth.users(id,email) VALUES (${owner}::uuid, ${owner + "@example.invalid"})`.execute(db);
});
afterAll(async () => {
  await app?.close();
  for (const id of fixtureUsers) await sql`DELETE FROM auth.users WHERE id = ${id}::uuid`.execute(db);
  await closeTestDatabase();
});
async function today(user = owner, tz = computeZone) {
  const response = await fetch(`${address}/picks/today?tz=${encodeURIComponent(tz)}`, { headers: { "x-fixture-user": user } });
  return { status: response.status, body: await response.json() as { localDate: string; refreshesAt: string; computedAt?: string; revealsAt?: string; items: { position: number; bookmark: { id: string; readAt?: string }; reason: string }[] } };
}
async function save(domain: string) {
  return db.insertInto("bookmarks").values({ user_id: owner, source_url: `https://${domain}/${crypto.randomUUID()}`, title: domain, processing_status: "completed" }).returning("id").executeTakeFirstOrThrow();
}
it("two devices concurrently receive one immutable three-slot snapshot with server reasons", async () => {
  await save("one.example"); await save("one.example"); await save("two.example");
  // Select a PostgreSQL-known zone currently after 06:00, so this route test
  // exercises compute independently of the machine's wall-clock hour.
  const zone = (await sql<{ name: string }>`SELECT name FROM pg_timezone_names WHERE name IN ('UTC','Pacific/Honolulu','Asia/Tokyo') AND (now() AT TIME ZONE name)::time >= time '06:00' LIMIT 1`.execute(db)).rows[0].name;
  const [first, second] = await Promise.all([today(owner, zone), today(owner, zone)]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(first.body).toEqual(second.body);
  expect(first.body.items.map(item => item.position)).toEqual([1, 2, 3]);
  expect(first.body.items.every(item => item.reason.length > 0)).toBe(true);
  expect(first.body.computedAt).toBeDefined();
});
it("zero eligible stores no set and later completion permits the first same-day snapshot", async () => {
  const pending = await save("pending.example");
  await db.updateTable("bookmarks").set({ processing_status: "processing" }).where("id", "=", pending.id).execute();
  const empty = await today();
  expect(empty.status).toBe(200);
  expect(empty.body.items).toEqual([]);
  expect(empty.body.computedAt).toBeUndefined();
  expect(await db.selectFrom("daily_picks").selectAll().where("user_id", "=", owner).execute()).toEqual([]);
  await db.updateTable("bookmarks").set({ processing_status: "completed" }).where("id", "=", pending.id).execute();
  const ready = await today();
  expect(ready.body.items.map(item => item.bookmark.id)).toEqual([pending.id]);
  expect(ready.body.computedAt).toBeDefined();
});
it("refresh preserves original slots/reasons while done stays and hidden slots never backfill", async () => {
  for (const domain of ["one.example", "two.example", "three.example", "four.example", "five.example"]) await save(domain);
  const original = (await today()).body;
  const ids = original.items.map(item => item.bookmark.id);
  await db.updateTable("bookmarks").set({ read_at: sql`now()` }).where("id", "=", ids[0]).execute();
  await db.updateTable("bookmarks").set({ later_until: sql`now() + interval '1 hour'` }).where("id", "=", ids[1]).execute();
  await db.updateTable("bookmarks").set({ is_archived: true }).where("id", "=", ids[2]).execute();
  await db.deleteFrom("bookmarks").where("id", "=", ids[3]).execute();
  await db.insertInto("feed_feedback").values({ user_id: owner, kind: "not_interested", bookmark_id: ids[4] }).execute();
  await save("late.example");
  const changed = (await today()).body;
  expect(changed.computedAt).toBe(original.computedAt);
  expect(changed.items.map(item => item.position)).toEqual([1]);
  expect(changed.items[0].bookmark.readAt).toBeDefined();
  expect(changed.items[0].reason).toBe(original.items[0].reason);
  expect(changed.revealsAt).toBeDefined();
  await db.updateTable("bookmarks").set({ later_until: sql`now() - interval '1 second'` }).where("id", "=", ids[1]).execute();
  const revealed = (await today()).body;
  expect(revealed.items.map(item => item.position)).toEqual([1, 2]);
  expect(revealed.items[1].reason).toBe(original.items[1].reason);
  expect(revealed.revealsAt).toBeUndefined();
  await db.updateTable("bookmarks").set({ is_archived: true }).where("id", "in", ids.slice(0, 2)).execute();
  expect((await today()).body).toMatchObject({ computedAt: original.computedAt, items: [] });
});
it("validates PostgreSQL timezone names and serves only the authenticated owner's set", async () => {
  await save("owner.example");
  const original = await today();
  expect((await today(owner, "Unknown/Zone")).status).toBe(400);
  const missing = await fetch(address + "/picks/today", { headers: { "x-fixture-user": owner } });
  expect(missing.status).toBe(400);
  const other = crypto.randomUUID();
  fixtureUsers.push(other);
  await sql`INSERT INTO auth.users(id,email) VALUES (${other}::uuid, ${other + "@example.invalid"})`.execute(db);
  expect((await today(other)).body).toMatchObject({ items: [] });
  expect((await today(other)).body.computedAt).toBeUndefined();
  expect((await today()).body).toEqual(original.body);
});
