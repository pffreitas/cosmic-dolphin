import { SQL } from "bun";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { THRESHOLDS, observeDatabase, withReadOnlyTransaction, classifyDbError, type DatabaseFacts, type Target } from "../save-bookmarks";

const urls = proofUrls(process.env);
const ADMIN = urls?.admin;
const CHECKER = urls?.checker;
const enabled = urls !== null;

import { proofUrls, assertTestMarker } from "./proof-database";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const target = (url = CHECKER!): Target => ({ kind: "local", databaseUrl: url, apiHealthUrl: "", tls: false });

describe.skipIf(!enabled)("monitor SQL against migrated schema", () => {
  let admin: SQL;
  let n = 0;

  beforeAll(async () => {
    admin = new SQL({ url: ADMIN!, max: 1 });
    await assertTestMarker(admin);
    await admin.unsafe(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'monitor_noaccess') then create role monitor_noaccess login password 'noaccess'; end if;
    end $$`);
    const [db] = await admin.unsafe("select 1 from pg_database where datname = 'monitor_empty'");
    if (!db) await admin.unsafe("create database monitor_empty");
  });
  afterAll(async () => {
    await admin?.close();
  });
  beforeEach(async () => {
    await assertTestMarker(admin);
    await admin.unsafe("delete from pgmq.q_bookmarks; delete from public.bookmarks");
  });

  async function bookmark(o: { status: string; startedAgo?: number | null; createdAgo?: number; completedAgo?: number; code?: string | null; user?: string }) {
    const [row] = await admin.unsafe(
      `insert into public.bookmarks (source_url, title, user_id, processing_status, processing_started_at, created_at, processing_completed_at, processing_failure_code, processing_error)
       values ($1, 'PRIVATE TITLE', $2, $3::bookmark_processing_status,
               case when $4::float8 is null then null else now() - make_interval(secs => $4::float8) end,
               now() - make_interval(secs => $5::float8),
               case when $6::float8 is null then null else now() - make_interval(secs => $6::float8) end,
               $7, case when $3 = 'failed' then 'PROVIDER SAID: secret detail' end)
       returning id::text`,
      [`https://private.example/${++n}`, o.user ?? USER, o.status, o.startedAgo ?? null, o.createdAgo ?? o.startedAgo ?? 0, o.completedAgo ?? null, o.code ?? null],
    );
    return row.id as string;
  }

  type Visibility = { visibleForSeconds: number; availableInSeconds?: never } | { availableInSeconds: number; visibleForSeconds?: never };
  async function message(o: { body: unknown; enqueuedAgo: number; readCt?: number } & Visibility) {
    const [row] = await admin.unsafe(
      `insert into pgmq.q_bookmarks (read_ct, enqueued_at, vt, message)
       values ($1, now() - make_interval(secs => $2::float8), now() - make_interval(secs => $3::float8), $4::jsonb)
       returning msg_id::text`,
      [o.readCt ?? 0, o.enqueuedAgo, (o.availableInSeconds === undefined ? o.visibleForSeconds : -o.availableInSeconds), o.body],
    );
    return row.msg_id as string;
  }
  const processMessage = (bookmarkId: unknown, userId: unknown = USER) => ({ type: "bookmark_process", data: { bookmarkId, userId }, metadata: { source: "api" } });

  async function observe(): Promise<DatabaseFacts> {
    const result = await observeDatabase(target());
    if (result.database.state !== "ok") throw new Error(`observation failed: ${result.database.failure}`);
    return result.database.facts;
  }

  test("empty database observes cleanly", async () => {
    const f = await observe();
    expect(f.queue.visible).toBe(0);
    expect(f.processing.total).toBe(0);
  });

  test("visible wait threshold edge: 290s quiet, 310s backlog", async () => {
    const id = await bookmark({ status: "processing", startedAgo: 400 });
    await message({ body: processMessage(id), enqueuedAgo: 400, visibleForSeconds: 290 });
    expect((await observe()).queue.backlog.count).toBe(0);
    await admin.unsafe("delete from pgmq.q_bookmarks");
    const msg = await message({ body: processMessage(id), enqueuedAgo: 400, visibleForSeconds: 310 });
    const f = await observe();
    expect(f.queue.backlog).toMatchObject({ count: 1, sampleIds: [msg] });
    expect(f.queue.oldestVisibleWaitSeconds).toBeGreaterThanOrEqual(310);
  });

  test("leased, delayed and backoff rows are not backlog even when enqueued long ago", async () => {
    const id = await bookmark({ status: "processing", startedAgo: 1500, createdAgo: 1500 });
    await message({ body: processMessage(id), enqueuedAgo: 1500, availableInSeconds: 500, readCt: 3 });
    const delayed = await bookmark({ status: "processing", startedAgo: 10 });
    await message({ body: processMessage(delayed), enqueuedAgo: 10, availableInSeconds: 60, readCt: 0 });
    const f = await observe();
    expect(f.queue).toMatchObject({ visible: 0, delayed: 1, leasedOrBackoff: 1, redelivered: 1 });
    expect(f.queue.backlog.count + f.processing.withoutOwner.count + f.processing.overdue.count).toBe(0);
  });

  test("owner grace edge: no message 100s quiet, 130s alerts", async () => {
    const quiet = await bookmark({ status: "processing", startedAgo: 100 });
    expect((await observe()).processing.withoutOwner.count).toBe(0);
    const lost = await bookmark({ status: "processing", startedAgo: 130 });
    expect((await observe()).processing.withoutOwner).toMatchObject({ count: 1, sampleIds: [lost] });
    expect(quiet).not.toBe(lost);
  });

  test("a message for the right bookmark but another user is not an owner", async () => {
    const id = await bookmark({ status: "processing", startedAgo: 400 });
    const msg = await message({ body: processMessage(id, OTHER), enqueuedAgo: 400, visibleForSeconds: 400 });
    const f = await observe();
    expect(f.processing.withoutOwner).toMatchObject({ count: 1, sampleIds: [id] });
    expect(f.queue.ownerMismatch).toMatchObject({ count: 1, sampleIds: [msg] });
  });

  test("redelivery resets processing_started_at but the queued journey stays overdue", async () => {
    const old = await bookmark({ status: "processing", startedAgo: 30, createdAgo: 3000 });
    await message({ body: processMessage(old), enqueuedAgo: 2200, availableInSeconds: 100, readCt: 3 });
    const recent = await bookmark({ status: "processing", startedAgo: 30, createdAgo: 3000 });
    await message({ body: processMessage(recent), enqueuedAgo: 2000, availableInSeconds: 100, readCt: 3 });
    const f = await observe();
    expect(f.processing.overdue).toMatchObject({ count: 1, sampleIds: [old] });
    expect(f.processing.withoutOwner.count).toBe(0);
  });

  test("overdue without a message falls back to processing_started_at", async () => {
    const id = await bookmark({ status: "processing", startedAgo: THRESHOLDS.processingOverdueSeconds + 60 });
    const f = await observe();
    expect(f.processing.overdue.sampleIds).toEqual([id]);
    expect(f.processing.withoutOwner.sampleIds).toEqual([id]);
  });

  test("idle (budget-deferred) bookmarks are not stalls", async () => {
    await bookmark({ status: "idle", startedAgo: null, createdAgo: 5000 });
    const f = await observe();
    expect(f.processing.total).toBe(0);
    expect(f.saves).toMatchObject({ idle: 1, processing: 0 });
  });

  test("malformed payloads never crash the casts and wait out the grace", async () => {
    const bodies = [
      "just a string",
      [1, 2],
      null,
      { type: "bookmark_process" },
      { type: "bookmark_process", data: "x" },
      { type: "bookmark_process", data: { bookmarkId: "not-a-uuid", userId: USER } },
      { type: "bookmark_process", data: { bookmarkId: 42, userId: USER } },
      { type: "bookmark_process", data: { bookmarkId: `${USER}\n`, userId: USER } },
      { type: "other", data: { bookmarkId: USER, userId: USER } },
    ];
    for (const body of bodies) await message({ body, enqueuedAgo: 400, visibleForSeconds: 400 });
    await message({ body: "fresh", enqueuedAgo: 100, visibleForSeconds: 100 });
    const f = await observe();
    expect(f.queue.malformed.count).toBe(bodies.length);
    expect(f.queue.malformed.sampleIds.length).toBe(THRESHOLDS.sampleIds);
    expect(f.queue.visible).toBe(bodies.length + 1);
  });

  test("orphans from a just-committed delete get the grace period", async () => {
    await message({ body: processMessage("33333333-3333-4333-8333-333333333333"), enqueuedAgo: 60, visibleForSeconds: 1 });
    expect((await observe()).queue.orphan.count).toBe(0);
    const stale = await message({ body: processMessage("44444444-4444-4444-8444-444444444444"), enqueuedAgo: 400, visibleForSeconds: 400 });
    expect((await observe()).queue.orphan).toMatchObject({ count: 1, sampleIds: [stale] });
  });

  test("terminal window classifies failure codes and context counts one per save", async () => {
    const provider = await bookmark({ status: "failed", startedAgo: 1900, createdAgo: 2000, completedAgo: 1800, code: "provider" });
    await bookmark({ status: "failed", startedAgo: 700, completedAgo: 600, code: null });
    await bookmark({ status: "failed", startedAgo: 700, completedAgo: 600, code: "paywall" });
    await bookmark({ status: "failed", startedAgo: 9000, completedAgo: THRESHOLDS.terminalWindowSeconds + 60, code: "unavailable" });
    await bookmark({ status: "completed", startedAgo: 30, createdAgo: 700, completedAgo: 600 });
    const f = await observe();
    expect(f.terminal.failedByCode.provider).toMatchObject({ count: 1, sampleIds: [provider] });
    expect(f.terminal.failedByCode.unclassified.count).toBe(1);
    expect(f.terminal.failedByCode.paywall.count).toBe(1);
    expect(f.terminal.failedByCode.unavailable.count).toBe(0);
    expect(f.terminal.completed).toBe(1);
    expect(f.completion).toMatchObject({ timedCount: 1, p50Seconds: 100, maxSeconds: 100 });
    expect(f.completion.latestAgeSeconds).toBeGreaterThanOrEqual(600);
  });

  test("observation is read-only and leaves every queue row untouched", async () => {
    const id = await bookmark({ status: "processing", startedAgo: 400 });
    await message({ body: processMessage(id), enqueuedAgo: 400, visibleForSeconds: 400 });
    await message({ body: "bad", enqueuedAgo: 400, availableInSeconds: 20, readCt: 2 });
    const rows = () => admin.unsafe("select msg_id, read_ct, enqueued_at, vt, message from pgmq.q_bookmarks order by msg_id");
    const before = await rows();
    await observe();
    expect(await rows()).toEqual(before);

    const sql = new SQL({ url: CHECKER!, max: 1, prepare: false });
    try {
      const attempt = (statement: string) =>
        withReadOnlyTransaction(sql, (tx) => tx.unsafe(statement)).then(() => "committed", classifyDbError);
      expect(await attempt("select * from pgmq.read('bookmarks', 30, 10)")).toBe("read_only_violation");
      expect(await attempt("update public.bookmarks set title = 'x'")).toBe("read_only_violation");
    } finally {
      await sql.close();
    }
    expect(await rows()).toEqual(before);
  });

  test("wrong credentials, access and schema are monitoring failures without leaking text", async () => {
    const url = new URL(CHECKER!);
    const variant = (edit: (u: URL) => void) => {
      const u = new URL(url);
      edit(u);
      return u.href;
    };
    const failure = async (u: string) => {
      const r = await observeDatabase(target(u));
      expect(JSON.stringify(r)).not.toContain("wrong-secret-pw");
      return r.database.state === "ok" ? "ok" : r.database.failure;
    };
    expect(await failure(variant((u) => (u.password = "wrong-secret-pw")))).toBe("db_auth_failed");
    expect(await failure(variant((u) => ((u.username = "monitor_noaccess"), (u.password = "noaccess"))))).toBe("permission_denied");
    expect(await failure(variant((u) => (u.pathname = "/monitor_empty")))).toBe("schema_mismatch");
    expect(await failure(variant((u) => (u.port = "1")))).toBe("db_unreachable");
  });

  test("live CLI against the local target: exit code, report and privacy", async () => {
    await bookmark({ status: "failed", startedAgo: 120, completedAgo: 60, code: "provider" });
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.json({ status: "ok", timestamp: new Date().toISOString() }) });
    try {
      const u = new URL(CHECKER!);
      const proc = Bun.spawn(["bun", join(import.meta.dir, "..", "monitor.ts")], {
        env: {
          BUN_CONFIG_NO_ENV_FILE: "true",
          PATH: process.env.PATH ?? "",
          DATABASE_URL: CHECKER!,
          MONITOR_LOCAL_TARGET: `${u.hostname}:${u.port}`,
          MONITOR_API_HEALTH_URL: `http://127.0.0.1:${server.port}/health`,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [code, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()]);
      expect(code).toBe(1);
      const report = JSON.parse(stdout);
      expect(report).toMatchObject({ status: "alerting", target: "local", alerts: [{ code: "infrastructure_failures" }] });
      for (const leak of [USER, "PRIVATE TITLE", "private.example", "PROVIDER SAID", u.password]) expect(stdout).not.toContain(leak);
    } finally {
      server.stop(true);
    }
  });
});
