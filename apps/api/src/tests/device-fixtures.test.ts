import { expect, it } from "bun:test";
import { createDatabase } from "@cosmic-dolphin/shared";
import { assertDeviceFixtureTarget, seedDeviceFixtures } from "./device-fixtures";
const local = "postgres://postgres:postgres@127.0.0.1:5433/postgres";
const ids = "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222";
it("device seeding refuses non-test, non-loopback, nonmarker targets and malformed account UUIDs before a write", async () => {
  let checks = 0;
  const marker = async () => { checks++; return true; };
  for (const [url, env, users] of [["postgres://postgres:postgres@host.example:5433/postgres", "test", ids], [local, "production", ids], [local, "test", "not-a-uuid"], [local, "test", ""], [local.replace("5433", "5432"), "test", ids]]) {
    await expect(assertDeviceFixtureTarget(url, env, users, marker)).rejects.toThrow();
  }
  expect(checks).toBe(0);
  await expect(assertDeviceFixtureTarget(local, "test", ids, async () => false)).rejects.toThrow("marker");
  expect(await assertDeviceFixtureTarget(local, "test", ids, marker)).toEqual(ids.split(","));
});
it("guarded local seeding creates matching fictional profiles and at least five eligible saves over three domains idempotently", async () => {
  const first = await seedDeviceFixtures(local, "test", ids);
  expect(first).toMatchObject({ accounts: 2, savesPerAccount: 6, domains: 3 });
  expect(await seedDeviceFixtures(local, "test", ids)).toEqual(first);
  const db = createDatabase(local);
  try {
    for (const id of ids.split(",")) {
      expect(await db.selectFrom("profiles").select("id").where("id", "=", id).executeTakeFirst()).toMatchObject({ id });
      const rows = await db.selectFrom("bookmarks").selectAll().where("user_id", "=", id).execute();
      expect(rows).toHaveLength(6);
      expect(new Set(rows.map(row => new URL(row.source_url).hostname)).size).toBe(3);
      for (const row of rows) expect(row).toMatchObject({ processing_status: "completed", is_archived: false, is_private_link: false, read_at: null, later_until: null });
    }
  } finally { await db.destroy(); }
});
