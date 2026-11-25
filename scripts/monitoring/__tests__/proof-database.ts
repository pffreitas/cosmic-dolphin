import { SQL } from "bun";
import { type Env } from "../save-bookmarks";

export function assertOwnedUrl(value: string, ownedTarget: string | undefined): void {
  const url = new URL(value);
  if (!ownedTarget || !["127.0.0.1", "localhost"].includes(url.hostname) || !/^\d+$/.test(url.port)
    || url.port === "5433" || url.host !== ownedTarget || url.pathname !== "/postgres" || url.search || url.hash
    || !["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("refusing non-owned proof database");
}
export function proofUrls(env: Env) {
  const admin = env.MONITOR_IT_ADMIN_URL;
  const checker = env.MONITOR_IT_DATABASE_URL;
  if (!admin && !checker && !env.MONITOR_IT_OWNED_TARGET) return null;
  if (!admin || !checker) throw new Error("both proof URLs required");
  assertOwnedUrl(admin, env.MONITOR_IT_OWNED_TARGET);
  assertOwnedUrl(checker, env.MONITOR_IT_OWNED_TARGET);
  return { admin, checker };
}
export async function assertTestMarker(sql: SQL) {
  const [table] = await sql.unsafe("select to_regclass('public.__test_database_marker') is not null as present");
  if (!table?.present) throw new Error("refusing fixture writes without test marker");
  const [row] = await sql.unsafe("select count(*)::int as count from public.__test_database_marker");
  if (row?.count !== 1) throw new Error("refusing invalid test marker");
}
