import { sql } from "kysely";
import { getTestDatabase, closeTestDatabase } from "../../test-utils/database";
import { FeedRepositoryImpl } from "../../repositories/feed.repository";
import { FeedRankingServiceImpl } from "../../services/feed-ranking.service";
import { SocialRepositoryImpl } from "../../repositories/social.repository";
import { SocialServiceImpl } from "../../services/social.service";
const users: string[] = [];
afterAll(async () => { const db = getTestDatabase(); for (const id of users) await sql`DELETE FROM auth.users WHERE id = ${id}::uuid`.execute(db); await closeTestDatabase(); });
it("warm ranked feed rechecks own snoozes and replaces a completed pending row without stale content", async () => {
  const db = getTestDatabase(); const user = crypto.randomUUID(); users.push(user);
  await sql`INSERT INTO auth.users(id,email) VALUES (${user}::uuid, ${user + "@example.invalid"})`.execute(db);
  const repo = new FeedRepositoryImpl(db);
  const feed = new FeedRankingServiceImpl(repo, new SocialServiceImpl(new SocialRepositoryImpl(db)), "test");
  const now = (await sql<{ now: Date }>`SELECT now() AS now`.execute(db)).rows[0].now;
  const rows = await db.insertInto("bookmarks").values([
    { user_id: user, source_url: "https://null.example/item", processing_status: "completed", title: "Ready" },
    { user_id: user, source_url: "https://pending.example/item", processing_status: "processing", title: "Pending" },
    { user_id: user, source_url: "https://future.example/item", processing_status: "completed", later_until: new Date(now.getTime() + 1000) },
  ]).returningAll().execute();
  const [ready, pending, future] = rows;
  const first = await feed.getFeed(user, { scope: "for_you", limit: 15, now });
  expect(first.items.map(item => item.bookmark?.id).sort()).toEqual([ready.id, pending.id].sort());
  await db.updateTable("bookmarks").set({ later_until: new Date(now.getTime() + 3600000) }).where("id", "=", ready.id).execute();
  await db.updateTable("bookmarks").set({ processing_status: "completed", title: "Completed late", cosmic_brief_summary: "Fresh pipeline brief", processing_completed_at: new Date(now.getTime() + 2000) }).where("id", "=", pending.id).execute();
  const refreshed = await feed.getFeed(user, { scope: "for_you", limit: 15, now: new Date(now.getTime() + 2000) });
  expect(refreshed.metrics.cacheHit).toBe(true);
  expect(refreshed.items.map(item => item.bookmark?.id).sort()).toEqual([pending.id, future.id].sort());
  const completed = refreshed.items.find(item => item.bookmark?.id === pending.id)!;
  expect(completed.type).toBe("own_save");
  expect(completed.bookmark?.title).toBe("Completed late");
  expect(completed.bookmark?.cosmicBriefSummary).toBe("Fresh pipeline brief");
});
it("Unread remains own newest-first when an older snooze elapses on a warm head", async () => {
  const db = getTestDatabase(); const user = crypto.randomUUID(); users.push(user);
  await sql`INSERT INTO auth.users(id,email) VALUES (${user}::uuid, ${user + "@example.invalid"})`.execute(db);
  const now = (await sql<{ now: Date }>`SELECT now() AS now`.execute(db)).rows[0].now;
  const rows = await db.insertInto("bookmarks").values([
    { user_id: user, source_url: "https://new.example/item", processing_status: "completed", created_at: new Date(now.getTime() - 1000), updated_at: new Date(now.getTime() - 1000) },
    { user_id: user, source_url: "https://old.example/item", processing_status: "completed", created_at: new Date(now.getTime() - 86400000), updated_at: new Date(now.getTime() - 86400000), later_until: new Date(now.getTime() + 1000) },
  ]).returningAll().execute();
  const feed = new FeedRankingServiceImpl(new FeedRepositoryImpl(db), new SocialServiceImpl(new SocialRepositoryImpl(db)), "test");
  expect((await feed.getFeed(user, { scope: "unread", now })).items.map(item => item.bookmark?.id)).toEqual([rows[0].id]);
  expect((await feed.getFeed(user, { scope: "unread", now: new Date(now.getTime() + 2000) })).items.map(item => item.bookmark?.id)).toEqual(rows.map(row => row.id));
});
