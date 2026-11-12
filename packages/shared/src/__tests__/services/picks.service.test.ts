import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { getTestDatabase, closeTestDatabase } from "../../test-utils/database";
import { PicksRepositoryImpl } from "../../repositories/picks.repository";
import { FeedRepositoryImpl } from "../../repositories/feed.repository";
import { SocialServiceImpl } from "../../services/social.service";
import { SocialRepositoryImpl } from "../../repositories/social.repository";
import { FeedRankingServiceImpl } from "../../services/feed-ranking.service";
import { PicksServiceImpl } from "../../services/picks.service";
import type { NewBookmark } from "../../database/schema";
const db = getTestDatabase();
// Every time assertion is executed by PostgreSQL; this expression is injected
// only at the standalone repository fixture boundary, never through the API.
class ClockFixture extends PicksRepositoryImpl {
  instant = "2026-03-07T15:00:00Z";
  protected clockExpression() { return sql<Date>`${this.instant}::timestamptz`; }
}
const repository = new ClockFixture(db);
const ranker = new FeedRankingServiceImpl(new FeedRepositoryImpl(db), new SocialServiceImpl(new SocialRepositoryImpl(db)), "test");
const service = new PicksServiceImpl(repository, ranker);
let owner: string;
const users: string[] = [];
beforeEach(async () => {
  repository.instant = "2026-03-07T15:00:00Z";
  owner = randomUUID(); users.push(owner);
  await sql`INSERT INTO auth.users(id,email) VALUES (${owner}::uuid, ${owner + "@example.invalid"})`.execute(db);
});
afterAll(async () => {
  const cleanup = getTestDatabase();
  for (const id of users) await sql`DELETE FROM auth.users WHERE id=${id}::uuid`.execute(cleanup);
  await closeTestDatabase();
});
async function save(name: string, overrides: Partial<NewBookmark> = {}) {
  return db.insertInto("bookmarks").values({ user_id: owner, source_url: `https://${name}.example/${randomUUID()}`, title: name,
    processing_status: "completed", created_at: new Date("2026-03-06T12:00:00Z"), ...overrides }).returningAll().executeTakeFirstOrThrow();
}
it("selects only own completed unread unarchived unrejected unsnoozed saves with usable private briefs", async () => {
  const eligible = [await save("null"), await save("elapsed", { later_until: new Date("2026-03-07T14:59:00Z") }),
    await save("privatebrief", { is_private_link: true, cosmic_brief_summary: "From your description" })];
  await save("future", { later_until: new Date("2026-03-07T15:01:00Z") });
  await save("read", { read_at: new Date("2026-03-07T14:00:00Z") });
  await save("archive", { is_archived: true });
  await save("pending", { processing_status: "processing" });
  await save("idle", { processing_status: "idle" });
  await save("failed", { processing_status: "failed" });
  await save("private", { is_private_link: true });
  await save("privateblank", { is_private_link: true, cosmic_brief_summary: "  " });
  const rejected = await save("rejected");
  await db.insertInto("feed_feedback").values({ user_id: owner, kind: "not_interested", bookmark_id: rejected.id }).execute();
  const other = randomUUID(); users.push(other);
  await sql`INSERT INTO auth.users(id,email) VALUES (${other}::uuid, ${other + "@example.invalid"})`.execute(db);
  await save("foreign", { user_id: other });
  const picks = await service.today(owner, "UTC");
  expect(picks.items.map(item => item.bookmark.id).sort()).toEqual(eligible.map(row => row.id).sort());
});
it("ranks the 500 newest eligible candidates using shared scores/reasons, with at most two per domain", async () => {
  const oldest = await save("oldwinner", { created_at: new Date("2020-01-01T00:00:00Z"), cosmic_tags: ["preferred"] });
  await save("finished", { read_at: new Date("2026-03-07T14:00:00Z"), cosmic_tags: ["preferred"] });
  const newest = await db.insertInto("bookmarks").values(Array.from({ length: 500 }, (_, index) => ({
    user_id: owner, source_url: `https://${index < 4 ? "same.example" : `domain${index}.example`}/${index}`,
    title: `Candidate ${index}`, processing_status: "completed" as const,
    created_at: new Date(Date.parse("2026-03-07T14:00:00Z") - index * 1000),
    cosmic_tags: index < 6 ? ["preferred"] : ["other"], metadata: { readingTime: 5 },
  }))).returningAll().execute();
  const ranked = await ranker.rankOwn(owner, newest, new Date(repository.instant));
  const counts = new Map<string, number>();
  const expected = ranked.filter(item => {
    const count = counts.get(item.domain) ?? 0;
    if (count === 2) return false;
    counts.set(item.domain, count + 1); return true;
  }).slice(0, 5);
  const picks = await service.today(owner, "UTC");
  expect(picks.items.map(item => ({ bookmarkId: item.bookmark.id, reason: item.reason })))
    .toEqual(expected.map(({ bookmarkId, reason }) => ({ bookmarkId, reason })));
  expect(picks.items).toHaveLength(5);
  expect(picks.items.some(item => item.bookmark.id === oldest.id)).toBe(false);
  expect(picks.items.filter(item => new URL(item.bookmark.sourceUrl).hostname === "same.example")).toHaveLength(2);
  expect(expected[0].score).toBeGreaterThan(ranked.find(item => item.domain === "domain499.example")!.score);
  expect(picks.items[0].reason).toContain("preferred");
  ranker.invalidate(owner);
  expect((await service.today(owner, "UTC")).items).toEqual(picks.items);
});
it("at 05:59 serves only the previous-date set or no row, and at 06:00 permits the new pick day", async () => {
  await save("boundary");
  repository.instant = "2026-03-08T09:59:00Z"; // 05:59 New York after the spring jump
  const absent = await service.today(owner, "America/New_York");
  expect(absent).toMatchObject({ localDate: "2026-03-07", refreshesAt: new Date("2026-03-08T10:00:00Z"), items: [] });
  expect(absent.computedAt).toBeUndefined();
  repository.instant = "2026-03-07T15:00:00Z";
  const previous = await service.today(owner, "America/New_York");
  repository.instant = "2026-03-08T09:59:00Z";
  expect(await service.today(owner, "America/New_York")).toEqual(previous);
  repository.instant = "2026-03-08T10:00:00Z";
  const next = await service.today(owner, "America/New_York");
  expect(next.localDate).toBe("2026-03-08");
  expect(next.computedAt).toEqual(new Date(repository.instant));
  expect(next.refreshesAt).toEqual(new Date("2026-03-09T10:00:00Z"));
});
it("PostgreSQL preserves 06:00 boundaries through spring/fall jumps, repeated hours and southern DST", async () => {
  const fixtures = [
    ["America/New_York", "2026-03-07T11:00:00Z", "2026-03-07", "2026-03-08T10:00:00Z", true],
    ["America/New_York", "2026-03-08T06:59:00Z", "2026-03-07", "2026-03-08T10:00:00Z", false],
    ["America/New_York", "2026-03-08T07:00:00Z", "2026-03-07", "2026-03-08T10:00:00Z", false],
    ["America/New_York", "2026-10-31T10:00:00Z", "2026-10-31", "2026-11-01T11:00:00Z", true],
    ["America/New_York", "2026-11-01T05:59:00Z", "2026-10-31", "2026-11-01T11:00:00Z", false],
    ["America/New_York", "2026-11-01T06:00:00Z", "2026-10-31", "2026-11-01T11:00:00Z", false],
    ["America/New_York", "2026-11-01T10:59:00Z", "2026-10-31", "2026-11-01T11:00:00Z", false],
    ["America/New_York", "2026-11-01T11:00:00Z", "2026-11-01", "2026-11-02T11:00:00Z", true],
    ["Europe/London", "2026-03-28T06:00:00Z", "2026-03-28", "2026-03-29T05:00:00Z", true],
    ["Europe/London", "2026-10-24T05:00:00Z", "2026-10-24", "2026-10-25T06:00:00Z", true],
    ["Australia/Sydney", "2026-04-03T19:00:00Z", "2026-04-04", "2026-04-04T20:00:00Z", true],
    ["Australia/Sydney", "2026-10-02T20:00:00Z", "2026-10-03", "2026-10-03T19:00:00Z", true],
    ["Asia/Kathmandu", "2026-03-08T00:15:00Z", "2026-03-08", "2026-03-09T00:15:00Z", true],
  ] as const;
  for (const [zone, instant, localDate, refreshesAt, canCompute] of fixtures) {
    repository.instant = instant;
    const clock = await repository.clock(zone);
    expect(clock).toEqual({ now: new Date(instant), localDate, refreshesAt: new Date(refreshesAt), canCompute });
    console.info("Postgres clock fixture", { zone, instant, ...clock });
  }
  // These differences merely measure the server-returned instants; all local
  // calendar arithmetic above happened in PostgreSQL.
  for (const index of [0, 8, 11]) {
    repository.instant = fixtures[index][1];
    const clock = (await repository.clock(fixtures[index][0]))!;
    expect((clock.refreshesAt.getTime() - clock.now.getTime()) / 3600000).toBe(23);
  }
  for (const index of [3, 9, 10]) {
    repository.instant = fixtures[index][1];
    const clock = (await repository.clock(fixtures[index][0]))!;
    expect((clock.refreshesAt.getTime() - clock.now.getTime()) / 3600000).toBe(25);
  }
});
it("same pick date reuses the snapshot across zones; a different requested pick date may compute", async () => {
  await save("zonefirst");
  repository.instant = "2026-03-07T15:00:00Z";
  const utc = await service.today(owner, "UTC");
  await save("zonelate");
  const ny = await service.today(owner, "America/New_York");
  expect(ny.localDate).toBe(utc.localDate);
  expect(ny.items).toEqual(utc.items);
  expect(ny.computedAt).toEqual(utc.computedAt);
  expect(ny.refreshesAt).toEqual(new Date("2026-03-08T10:00:00Z"));
  repository.instant = "2026-03-07T22:00:00Z";
  const tokyo = await service.today(owner, "Asia/Tokyo");
  expect(tokyo.localDate).toBe("2026-03-08");
  expect(tokyo.items).toHaveLength(2);
  expect(tokyo.computedAt).toEqual(new Date(repository.instant));
  expect((await service.today(owner, "UTC")).items).toEqual(utc.items);
  expect(await db.selectFrom("daily_picks").select("time_zone").where("user_id", "=", owner).orderBy("local_date").execute())
    .toEqual([{ time_zone: "UTC" }, { time_zone: "Asia/Tokyo" }]);
});
it("reveals only surviving hidden slots strictly before refresh, then restores their original positions", async () => {
  for (let index = 0; index < 5; index++) await save(`reveal${index}`);
  const fixed = await service.today(owner, "America/New_York");
  const ids = fixed.items.map(item => item.bookmark.id);
  await db.updateTable("bookmarks").set({ read_at: new Date(repository.instant) }).where("id", "=", ids[0]).execute();
  await db.updateTable("bookmarks").set({ later_until: new Date("2026-03-08T01:00:00Z") }).where("id", "=", ids[1]).execute(); // Tonight20
  await db.updateTable("bookmarks").set({ later_until: fixed.refreshesAt }).where("id", "=", ids[2]).execute();
  await db.updateTable("bookmarks").set({ later_until: new Date("2026-03-07T16:00:00Z"), is_archived: true }).where("id", "=", ids[3]).execute();
  const hidden = await service.today(owner, "America/New_York");
  expect(hidden.items.map(item => item.position)).toEqual([1, 5]);
  expect(hidden.items.filter(item => item.bookmark.readAt)).toHaveLength(1);
  expect(hidden.revealsAt).toEqual(new Date("2026-03-08T01:00:00Z"));
  repository.instant = "2026-03-08T01:00:00Z";
  const revealed = await service.today(owner, "America/New_York");
  expect(revealed.items.map(item => item.position)).toEqual([1, 2, 5]);
  expect(revealed.items[1].reason).toBe(fixed.items[1].reason);
  expect(revealed.revealsAt).toBeUndefined();
  expect(revealed.computedAt).toEqual(fixed.computedAt);
});
it("RLS confines daily sets to their owner and deleting that account cascades its snapshot", async () => {
  await save("rls");
  const picks = await service.today(owner, "UTC");
  const foreign = randomUUID();
  await db.transaction().execute(async trx => {
    await sql`SET LOCAL ROLE authenticated`.execute(trx);
    await sql`SELECT set_config('request.jwt.claim.sub', ${foreign}, true)`.execute(trx);
    expect(await trx.selectFrom("daily_picks").selectAll().execute()).toEqual([]);
    await sql`SELECT set_config('request.jwt.claim.sub', ${owner}, true)`.execute(trx);
    expect(await trx.selectFrom("daily_picks").select("bookmark_ids").execute())
      .toEqual([{ bookmark_ids: picks.items.map(item => item.bookmark.id) }]);
  });
  await expect(db.transaction().execute(async trx => {
    await sql`SET LOCAL ROLE authenticated`.execute(trx);
    await sql`SELECT set_config('request.jwt.claim.sub', ${foreign}, true)`.execute(trx);
    await trx.insertInto("daily_picks").values({ user_id: owner, local_date: "2026-03-08", bookmark_ids: [picks.items[0].bookmark.id], reasons: ["Private"], time_zone: "UTC" }).execute();
  })).rejects.toThrow(/row-level security/);
  await sql`DELETE FROM auth.users WHERE id=${owner}::uuid`.execute(db);
  expect(await db.selectFrom("daily_picks").selectAll().where("user_id", "=", owner).execute()).toEqual([]);
});
