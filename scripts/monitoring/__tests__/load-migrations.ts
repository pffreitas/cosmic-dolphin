#!/usr/bin/env bun
import { SQL } from "bun";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assertOwnedUrl } from "./proof-database";

export async function loadMigrations(adminUrl: string, ownedTarget: string | undefined, dir: string) {
  assertOwnedUrl(adminUrl, ownedTarget);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  if (!files.length) throw new Error("no migrations");
  const sql = new SQL({ url: adminUrl, max: 1 });
  try {
    const rows = await sql.unsafe("select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','pgmq','supabase_migrations') and c.relkind in ('r','p','m','S') limit 1");
    if (rows.length) throw new Error("refusing occupied database; use a fresh task-owned container");
    for (const file of files) await sql.unsafe(readFileSync(join(dir, file), "utf8"));
    await sql.unsafe("create table public.__test_database_marker (created_at timestamptz not null default now()); insert into public.__test_database_marker default values");
    await sql.unsafe("grant select on public.__test_database_marker to postgres; grant usage on schema pgmq to postgres; grant select on all tables in schema pgmq to postgres");
    return files.length;
  } finally { await sql.close(); }
}
if (import.meta.main) {
  try {
    if (!process.env.MONITOR_IT_ADMIN_URL) throw new Error("admin URL required");
    console.log(`applied ${await loadMigrations(process.env.MONITOR_IT_ADMIN_URL, process.env.MONITOR_IT_OWNED_TARGET, process.argv[2] ?? "supabase/migrations")} migrations; test marker created`);
  } catch { console.error("proof migration load refused or failed"); process.exit(2); }
}
