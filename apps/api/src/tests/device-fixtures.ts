/** Local branch/device proof only. This is never a business-data seeder. */
import { sql } from "kysely";
import { createDatabase } from "@cosmic-dolphin/shared";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function assertDeviceFixtureTarget(databaseUrl: string, nodeEnv: string | undefined, accountIds: string, hasMarker: () => Promise<boolean>): Promise<string[]> {
  const target = new URL(databaseUrl);
  if (nodeEnv !== "test" || !["postgres:", "postgresql:"].includes(target.protocol) || !LOOPBACK.has(target.hostname) || target.port !== "5433" || target.pathname !== "/postgres" || target.username !== "postgres") throw new Error("Device fixtures require NODE_ENV=test and the loopback disposable Postgres on 5433");
  const ids = [...new Set(accountIds.split(",").map(value => value.trim()))];
  if (!ids.length || ids.some(id => !UUID.test(id))) throw new Error("DEVICE_TEST_USER_IDS must contain authenticated test-account UUIDs");
  if (!(await hasMarker())) throw new Error("Refusing to seed a database without the __test_database_marker");
  return ids;
}
export async function seedDeviceFixtures(databaseUrl: string, nodeEnv: string | undefined, accountIds: string) {
  // Validate environment and every account before even opening a connection.
  await assertDeviceFixtureTarget(databaseUrl, nodeEnv, accountIds, async () => true);
  const db = createDatabase(databaseUrl);
  try {
    const ids = await assertDeviceFixtureTarget(databaseUrl, nodeEnv, accountIds, async () => {
      const marker = await sql<{ present: boolean }>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__test_database_marker') AS present`.execute(db);
      return marker.rows[0]?.present === true;
    });
    await db.transaction().execute(async trx => {
      for (const id of ids) {
        await sql`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (${id}::uuid, ${id + "@device-fixture.invalid"}, '{"name":"Device fixture reader"}'::jsonb) ON CONFLICT (id) DO NOTHING`.execute(trx);
        await trx.insertInto("profiles").values({ id, name: "Device fixture reader", email: `${id}@device-fixture.invalid`, handle: `fixture_${id.replace(/-/g, "").slice(0, 16)}` }).onConflict(oc => oc.column("id").doNothing()).execute();
        for (let index = 0; index < 6; index++) {
          const domain = ["reading.example", "design.example", "science.example"][index % 3];
          await trx.insertInto("bookmarks").values({
            user_id: id, source_url: `https://${domain}/device-fixture-${index}`,
            title: `Fictional reading ${index + 1}`, processing_status: "completed",
            cosmic_summary: "A fictional article for local device proof. No external content was fetched.",
            cosmic_brief_summary: "Fictional reading for the local device checklist.",
            cosmic_tags: ["reading"], metadata: { readingTime: index + 2, wordCount: 800, originalUrl: `https://${domain}/device-fixture-${index}` },
            is_archived: false, is_private_link: false, read_at: null,
            later_until: null, capture_source: "save_sheet", capture_platform: "ios",
          }).onConflict(oc => oc.columns(["user_id", "source_url"]).doNothing()).execute();
        }
      }
    });
    return { accounts: ids.length, savesPerAccount: 6, domains: 3 };
  } finally { await db.destroy(); }
}
if (typeof Bun !== "undefined" && Bun.main === __filename) {
  void seedDeviceFixtures(process.env.DATABASE_URL ?? "", process.env.NODE_ENV, process.env.DEVICE_TEST_USER_IDS ?? "")
    .then(result => console.log(`Seeded ${result.accounts} local fixture accounts with ${result.savesPerAccount} fictional saves each.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
