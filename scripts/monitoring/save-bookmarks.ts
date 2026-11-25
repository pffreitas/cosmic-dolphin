import { SQL } from "bun";

const PROCESSING_RETRY_BUDGET_SECONDS = 4 * 240 + 30 + 120 + 600;
const PROCESSING_OVERDUE_MARGIN_SECONDS = 390;

export const THRESHOLDS = {
  visibleQueueWaitSeconds: 300,
  ownerGraceSeconds: 120,
  processingOverdueSeconds: PROCESSING_RETRY_BUDGET_SECONDS + PROCESSING_OVERDUE_MARGIN_SECONDS,
  invalidMessageAvailableSeconds: 300,
  terminalWindowSeconds: 3600,
  savesWindowSeconds: 86_400,
  sampleIds: 5,
  statementTimeoutMs: 5_000,
  connectTimeoutSeconds: 10,
  observationDeadlineMs: 30_000,
  healthTimeoutMs: 5_000,
  healthBodyBytes: 4_096,
} as const;

export const PRODUCTION = {
  projectRef: "qsqbcqkpqmkuywunxbut",
  apiHealthUrl: "https://api.cosmic-dolphin.com/health",
} as const;

export const RUNBOOK = "docs/runbooks/save-bookmark-monitoring.md";


export const FAILURE_CLASS = {
  provider: "infrastructure",
  unavailable: "infrastructure",
  unclassified: "infrastructure",
  paywall: "source",
  auth: "source",
  blocked: "source",
  empty: "source",
  unsupported: "source",
} as const;
export type FailureCode = keyof typeof FAILURE_CLASS;
export const FAILURE_CODES = Object.keys(FAILURE_CLASS) as FailureCode[];

/** Rows past a threshold: exact count, oldest age, a few opaque ids. */
export interface Sampled {
  count: number;
  oldestAgeSeconds: number | null;
  sampleIds: string[];
}

export const INVALID_KINDS = ["malformed", "orphan", "ownerMismatch"] as const;
export type InvalidKind = (typeof INVALID_KINDS)[number];

export interface DatabaseFacts {
  queue: {
    visible: number;
    delayed: number;
    leasedOrBackoff: number;
    redelivered: number;
    oldestVisibleWaitSeconds: number | null;
    backlog: Sampled;
  } & Record<InvalidKind, Sampled>;
  processing: {
    total: number;
    oldestJourneyAgeSeconds: number | null;
    withoutOwner: Sampled;
    overdue: Sampled;
  };
  /** Bookmarks created in the saves window, by current status. */
  saves: { processing: number; completed: number; failed: number; idle: number };
  terminal: { completed: number; failedByCode: Record<FailureCode, Sampled> };
  completion: {
    latestAgeSeconds: number | null;
    timedCount: number;
    p50Seconds: number | null;
    p95Seconds: number | null;
    maxSeconds: number | null;
  };
}

export const TARGET_REJECTIONS = [
  "database_url_missing",
  "database_url_invalid",
  "database_url_unsupported",
  "project_ref_missing",
  "project_ref_unexpected",
  "supabase_url_mismatch",
  "database_project_mismatch",
  "api_override_forbidden",
  "ca_invalid",
  "local_target_invalid",
  "local_target_mismatch",
  "local_mixed_with_production",
] as const;
export type TargetRejection = (typeof TARGET_REJECTIONS)[number];

const OBSERVATION_FAILURES = [
  "db_unreachable",
  "db_auth_failed",
  "database_missing",
  "permission_denied",
  "schema_mismatch",
  "statement_timeout",
  "observation_timeout",
  "observation_invalid",
  "not_read_only",
  "read_only_violation",
  "db_query_failed",
  "fixture_invalid",
  "usage_invalid",
  "checker_failed",
  "output_failed",
] as const;
export type FailureReason = `target_${TargetRejection}` | (typeof OBSERVATION_FAILURES)[number];
export const FAILURE_REASONS: readonly FailureReason[] = [
  ...TARGET_REJECTIONS.map((r) => `target_${r}` as const),
  ...OBSERVATION_FAILURES,
];

export type ApiFailure = "unreachable" | "timeout" | "malformed" | `http_${number}`;
export type ApiObservation = { state: "ok" } | { state: "failed"; failure: ApiFailure } | { state: "not_observed" };
export type DbObservation = { state: "ok"; facts: DatabaseFacts } | { state: "failed"; failure: FailureReason };
export type TargetKind = "production" | "local" | "fixture" | "unresolved";

export interface Snapshot {
  /** Database clock when the snapshot succeeded, checker clock otherwise. */
  observedAt: string;
  target: TargetKind;
  api: ApiObservation;
  database: DbObservation;
}

export type Severity = "critical" | "warning";

export interface Evidence {
  count: number;
  reason?: FailureReason | ApiFailure;
  oldestAgeSeconds?: number | null;
  byKind?: Record<InvalidKind, number>;
  byCode?: Partial<Record<FailureCode, number>>;
  sampleIds?: string[];
}

export type RuleCode =
  | "monitoring_failed"
  | "api_health_failed"
  | "queue_visible_backlog"
  | "processing_without_owner"
  | "processing_overdue"
  | "queue_invalid_messages"
  | "infrastructure_failures";

/** Which observation a rule needs before it can say anything. */
export type RuleSource = "observer" | "api" | "database";

export interface Alert {
  code: RuleCode;
  severity: Severity;
  evidence: Evidence;
  next: string;
  runbook: string;
}

export type Status = "ok" | "alerting" | "monitoring_failed";

export interface Report {
  schemaVersion: 1;
  status: Status;
  observedAt: string;
  clock: "database" | "checker";
  target: TargetKind;
  observations: { api: "ok" | "not_observed" | ApiFailure; database: "ok" | FailureReason };
  alerts: Alert[];
  context: Context | null;
  notes: string[];
  thresholds: typeof THRESHOLDS;
}


const factsOf = (s: Snapshot) => (s.database.state === "ok" ? s.database.facts : null);
const sampled = (pick: (f: DatabaseFacts) => Sampled) => (s: Snapshot): Evidence | null => {
  const f = factsOf(s);
  if (!f) return null;
  const { count, oldestAgeSeconds, sampleIds } = pick(f);
  return count > 0 ? { count, oldestAgeSeconds, sampleIds } : null;
};

interface Rule {
  code: RuleCode;
  severity: Severity;
  source: RuleSource;
  summary: string;
  next: string;
  check: (s: Snapshot) => Evidence | null;
}

export const RULES: readonly Rule[] = [
  {
    code: "monitoring_failed",
    severity: "critical",
    source: "observer",
    summary: "Save monitor cannot observe the database",
    next: "Save health is unknown. Fix the checker's target, credentials, grants or network before trusting any green run.",
    check: (s) => (s.database.state === "failed" ? { count: 1, reason: s.database.failure } : null),
  },
  {
    code: "api_health_failed",
    severity: "critical",
    source: "api",
    summary: "API health check failed",
    next: "API health failed; save acceptance is unverified. Check the API app's deployment, logs and domain.",
    check: (s) => (s.api.state === "failed" ? { count: 1, reason: s.api.failure } : null),
  },
  {
    code: "queue_visible_backlog",
    severity: "critical",
    source: "database",
    summary: "Claimable save messages are not being read",
    next: "Claimable messages are not being read. Check the worker app is running and polling the bookmarks queue.",
    check: sampled((f) => f.queue.backlog),
  },
  {
    code: "processing_without_owner",
    severity: "critical",
    source: "database",
    summary: "Processing saves have no queue message",
    next: "A processing save has no queued message and nothing will finish it. Reprocess the listed bookmarks after finding why the message was lost.",
    check: sampled((f) => f.processing.withoutOwner),
  },
  {
    code: "processing_overdue",
    severity: "critical",
    source: "database",
    summary: "Saves outlived the retry budget",
    next: "A save has outlived the bounded retry budget. Check worker logs for these message deliveries and provider health.",
    check: sampled((f) => f.processing.overdue),
  },
  {
    code: "queue_invalid_messages",
    severity: "warning",
    source: "database",
    summary: "Invalid queue messages stay claimable",
    next: "Malformed, orphaned or owner-mismatched messages stayed claimable past one lease. Queue age does not date a bookmark deletion. Check the worker is draining them and what enqueued them.",
    check: (s) => {
      const f = factsOf(s);
      if (!f) return null;
      const byKind = Object.fromEntries(INVALID_KINDS.map((k) => [k, f.queue[k].count])) as Record<InvalidKind, number>;
      const count = INVALID_KINDS.reduce((n, k) => n + byKind[k], 0);
      if (count === 0) return null;
      const sampleIds = INVALID_KINDS.flatMap((k) => f.queue[k].sampleIds).slice(0, THRESHOLDS.sampleIds);
      return { count, byKind, sampleIds };
    },
  },
  {
    code: "infrastructure_failures",
    severity: "critical",
    source: "database",
    summary: "Saves failed for infrastructure reasons",
    next: "Saves failed for provider, availability or unclassified reasons. Check provider status and worker logs; users must retry these saves.",
    check: (s) => {
      const f = factsOf(s);
      if (!f) return null;
      const byCode: Partial<Record<FailureCode, number>> = {};
      const sampleIds: string[] = [];
      let count = 0;
      for (const code of FAILURE_CODES) {
        const row = f.terminal.failedByCode[code];
        if (FAILURE_CLASS[code] !== "infrastructure" || row.count === 0) continue;
        byCode[code] = row.count;
        count += row.count;
        sampleIds.push(...row.sampleIds);
      }
      return count > 0 ? { count, byCode, sampleIds: sampleIds.slice(0, THRESHOLDS.sampleIds) } : null;
    },
  },
];

export const COMPLETION_BASIS =
  "One value per bookmark created and completed in the saves window, created_at to processing_completed_at. Includes idle budget deferral and any reprocessing before completion. Context only; no latency alert.";

function contextOf(f: DatabaseFacts) {
  const failedByCode = Object.fromEntries(FAILURE_CODES.map((c) => [c, f.terminal.failedByCode[c].count])) as Record<FailureCode, number>;
  const sum = (cls: "infrastructure" | "source") => FAILURE_CODES.reduce((n, c) => n + (FAILURE_CLASS[c] === cls ? failedByCode[c] : 0), 0);
  const { idle, ...accepted } = f.saves;
  return {
    windowsSeconds: { saves: THRESHOLDS.savesWindowSeconds, terminal: THRESHOLDS.terminalWindowSeconds },
    saves: { accepted: accepted.processing + accepted.completed + accepted.failed, byStatus: accepted, deferredIdle: idle },
    queue: {
      visible: f.queue.visible,
      delayed: f.queue.delayed,
      leasedOrBackoff: f.queue.leasedOrBackoff,
      redelivered: f.queue.redelivered,
      oldestVisibleWaitSeconds: f.queue.oldestVisibleWaitSeconds,
      invalidPastGrace: Object.fromEntries(INVALID_KINDS.map((k) => [k, f.queue[k].count])) as Record<InvalidKind, number>,
    },
    processing: { total: f.processing.total, oldestJourneyAgeSeconds: f.processing.oldestJourneyAgeSeconds },
    terminal: { completed: f.terminal.completed, infrastructureFailed: sum("infrastructure"), sourceFailed: sum("source"), failedByCode },
    completion: {
      /** Latest completion of any bookmark, including reprocessed older saves. */
      latestAgeSeconds: f.completion.latestAgeSeconds,
      createdToCompleted: {
        basis: COMPLETION_BASIS,
        count: f.completion.timedCount,
        p50Seconds: f.completion.p50Seconds,
        p95Seconds: f.completion.p95Seconds,
        maxSeconds: f.completion.maxSeconds,
      },
    },
  };
}
export type Context = ReturnType<typeof contextOf>;

export function evaluate(s: Snapshot): Report {
  const alerts = RULES.flatMap((rule): Alert[] => {
    const evidence = rule.check(s);
    return evidence
      ? [{ code: rule.code, severity: rule.severity, evidence, next: rule.next, runbook: `${RUNBOOK}#${rule.code.replaceAll("_", "-")}` }]
      : [];
  });
  const facts = factsOf(s);
  const context = facts ? contextOf(facts) : null;
  const status: Status = !context ? "monitoring_failed" : alerts.length > 0 ? "alerting" : "ok";
  const notes: string[] = [];
  if (context && context.saves.accepted === 0 && context.terminal.completed === 0) {
    notes.push("No accepted saves in the window. Observations succeeded; this does not prove the save journey works.");
  }
  if (context && context.terminal.sourceFailed > 0) {
    notes.push(`${context.terminal.sourceFailed} expected source failure(s) in the terminal window; context only.`);
  }
  return {
    schemaVersion: 1,
    status,
    observedAt: s.observedAt,
    clock: context ? "database" : "checker",
    target: s.target,
    observations: {
      api: s.api.state === "failed" ? s.api.failure : s.api.state,
      database: s.database.state === "failed" ? s.database.failure : "ok",
    },
    alerts,
    context,
    notes,
    thresholds: THRESHOLDS,
  };
}


export interface Target {
  kind: "production" | "local";
  databaseUrl: string;
  apiHealthUrl: string;
  tls: false | true | { ca: string };
}

export type Env = Record<string, string | undefined>;
export type HttpFetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;
export const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const POOLER_HOST = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const PEM = /^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----(\r?\n-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----)*\s*$/;

export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Pure: decides the target before any network call. Never echoes values. */
export function resolveTarget(env: Env): { ok: true; target: Target } | { ok: false; reason: TargetRejection } {
  const reject = (reason: TargetRejection) => ({ ok: false as const, reason });
  if (!env.DATABASE_URL) return reject("database_url_missing");
  const db = parseUrl(env.DATABASE_URL);
  if (!db || !["postgres:", "postgresql:"].includes(db.protocol) || !db.hostname) return reject("database_url_invalid");
  const params = [...db.searchParams];

  if (env.MONITOR_LOCAL_TARGET !== undefined) {
    if (env.SUPABASE_PROJECT_REF || env.SUPABASE_URL || env.MONITOR_DB_CA_PEM) return reject("local_mixed_with_production");
    const [host, port, extra] = env.MONITOR_LOCAL_TARGET.split(":");
    const api = parseUrl(env.MONITOR_API_HEALTH_URL ?? "");
    if (extra !== undefined || !host || !LOOPBACK.has(host) || !/^\d+$/.test(port ?? "") || !api || api.protocol !== "http:" || !LOOPBACK.has(api.hostname)) {
      return reject("local_target_invalid");
    }
    if (params.length > 0 || db.hash || !/^\/[A-Za-z0-9_]+$/.test(db.pathname)) return reject("database_url_unsupported");
    if (db.hostname !== host || db.port !== port) return reject("local_target_mismatch");
    return { ok: true, target: { kind: "local", databaseUrl: env.DATABASE_URL, apiHealthUrl: api.href, tls: false } };
  }

  const ref = env.SUPABASE_PROJECT_REF;
  if (!ref) return reject("project_ref_missing");
  if (ref !== PRODUCTION.projectRef) return reject("project_ref_unexpected");
  if (env.MONITOR_API_HEALTH_URL !== undefined) return reject("api_override_forbidden");
  if (parseUrl(env.SUPABASE_URL ?? "")?.href !== `https://${ref}.supabase.co/`) return reject("supabase_url_mismatch");
  const direct = db.hostname === `db.${ref}.supabase.co`;
  const pooler = POOLER_HOST.test(db.hostname) && decodeURIComponent(db.username) === `postgres.${ref}`;
  if (!direct && !pooler) return reject("database_project_mismatch");
  const portOk = direct ? db.port === "5432" && db.username !== "" : db.port === "5432" || db.port === "6543";
  const paramsOk = params.every(([key, value]) => key === "sslmode" && value === "require");
  if (!portOk || !paramsOk || db.pathname !== "/postgres" || db.hash) return reject("database_url_unsupported");
  const ca = env.MONITOR_DB_CA_PEM;
  if (ca !== undefined && ca !== "" && !PEM.test(ca)) return reject("ca_invalid");
  return {
    ok: true,
    target: { kind: "production", databaseUrl: env.DATABASE_URL, apiHealthUrl: PRODUCTION.apiHealthUrl, tls: ca ? { ca } : true },
  };
}


export const isTimeout = (error: unknown) => {
  const name = isRecord(error) ? error.name : undefined;
  return name === "TimeoutError" || name === "AbortError";
};

/** Reads at most `limit` bytes; null when the body is larger. */
export async function readBounded(response: Response, limit: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
}

export async function observeApi(url: string, fetchImpl: HttpFetch = fetch): Promise<ApiObservation> {
  const failed = (failure: ApiFailure): ApiObservation => ({ state: "failed", failure });
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "error",
      signal: AbortSignal.timeout(THRESHOLDS.healthTimeoutMs),
      headers: { accept: "application/json" },
    });
  } catch (error) {
    return failed(isTimeout(error) ? "timeout" : "unreachable");
  }
  try {
    if (response.status !== 200) return failed(`http_${response.status}`);
    if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failed("malformed");
    const text = await readBounded(response, THRESHOLDS.healthBodyBytes);
    if (text === null) return failed("malformed");
    const body: unknown = JSON.parse(text);
    const ok = isRecord(body) && body.status === "ok" && isTimestamp(body.timestamp);
    return ok ? { state: "ok" } : failed("malformed");
  } catch (error) {
    return failed(isTimeout(error) ? "timeout" : "malformed");
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

const UUID = "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'";
const uuidField = (field: string) => `case when q.message->>'type' = 'bookmark_process'
           and jsonb_typeof(q.message->'data'->'${field}') = 'string'
           and q.message->'data'->>'${field}' ~* ${UUID}
         then (q.message->'data'->>'${field}')::uuid end`;

const MESSAGES = `messages as (
  select q.msg_id, q.read_ct, q.enqueued_at, q.vt <= now() as visible,
         extract(epoch from now() - greatest(q.vt, q.enqueued_at))::float8 as wait_s,
         ${uuidField("bookmarkId")} as bookmark_id,
         ${uuidField("userId")} as user_id
  from pgmq.q_bookmarks q
)`;

const sampledColumns = (prefix: string, id: string, age: string, where: string, sampleSizePlaceholder: string) =>
  `count(*) filter (where ${where})::int as ${prefix}_count,
   max(${age}) filter (where ${where}) as ${prefix}_age,
   coalesce((array_agg(${id}::text order by ${age} desc) filter (where ${where}))[1:${sampleSizePlaceholder}], '{}') as ${prefix}_ids`;

const QUEUE_SQL = `with ${MESSAGES}, classified as (
  select m.*, case
    when m.bookmark_id is null or m.user_id is null then 'malformed'
    when b.id is null then 'orphan'
    when b.user_id <> m.user_id then 'owner_mismatch'
    else 'owned' end as kind
  from messages m left join public.bookmarks b on b.id = m.bookmark_id
)
select count(*) filter (where visible)::int as visible,
       count(*) filter (where not visible and read_ct = 0)::int as delayed,
       count(*) filter (where not visible and read_ct > 0)::int as leased_or_backoff,
       count(*) filter (where read_ct > 1)::int as redelivered,
       max(wait_s) filter (where visible) as oldest_visible_wait_s,
       ${sampledColumns("backlog", "msg_id", "wait_s", "visible and wait_s > $1", "$3")},
       ${sampledColumns("malformed", "msg_id", "wait_s", "visible and wait_s > $2 and kind = 'malformed'", "$3")},
       ${sampledColumns("orphan", "msg_id", "wait_s", "visible and wait_s > $2 and kind = 'orphan'", "$3")},
       ${sampledColumns("mismatch", "msg_id", "wait_s", "visible and wait_s > $2 and kind = 'owner_mismatch'", "$3")}
from classified`;

const PROCESSING_SQL = `with ${MESSAGES}, owners as (
  select bookmark_id, user_id, min(enqueued_at) as stable_journey_started_at
  from messages where bookmark_id is not null and user_id is not null group by 1, 2
), p as (
  select b.id, o.bookmark_id is not null as owned,
         extract(epoch from now() - coalesce(b.processing_started_at, b.created_at))::float8 as attempt_age_s,
         extract(epoch from now() - coalesce(o.stable_journey_started_at, b.processing_started_at, b.created_at))::float8 as journey_age_s
  from public.bookmarks b
  left join owners o on o.bookmark_id = b.id and o.user_id = b.user_id
  where b.processing_status = 'processing'
)
select count(*)::int as total, max(journey_age_s) as oldest_journey_s,
       ${sampledColumns("orphaned", "id", "attempt_age_s", "not owned and attempt_age_s > $1", "$3")},
       ${sampledColumns("overdue", "id", "journey_age_s", "journey_age_s > $2", "$3")}
from p`;

const SAVES_SQL = `select processing_status::text as status, count(*)::int as n
from public.bookmarks where created_at > now() - make_interval(secs => $1) group by 1`;

const TERMINAL_SQL = `select processing_status::text as status,
       case when processing_status = 'failed' then coalesce(processing_failure_code, 'unclassified') end as code,
       count(*)::int as n,
       max(extract(epoch from now() - processing_completed_at))::float8 as age,
       (array_agg(id::text order by processing_completed_at desc))[1:$2] as ids
from public.bookmarks
where processing_status in ('completed', 'failed') and processing_completed_at > now() - make_interval(secs => $1)
group by 1, 2`;

const COMPLETION_SQL = `select extract(epoch from now() - max(processing_completed_at))::float8 as latest_age,
       count(*) filter (where created_at > now() - make_interval(secs => $1))::int as timed,
       percentile_cont(0.5) within group (order by extract(epoch from processing_completed_at - created_at)) filter (where created_at > now() - make_interval(secs => $1)) as p50,
       percentile_cont(0.95) within group (order by extract(epoch from processing_completed_at - created_at)) filter (where created_at > now() - make_interval(secs => $1)) as p95,
       max(extract(epoch from processing_completed_at - created_at)) filter (where created_at > now() - make_interval(secs => $1))::float8 as max
from public.bookmarks
where processing_status = 'completed' and processing_completed_at > now() - make_interval(secs => $1)`;

class MonitorError extends Error {
  constructor(readonly failure: FailureReason) {
    super(failure);
  }
}

/** Runs `body` in one REPEATABLE READ READ ONLY transaction with bounded timeouts. */
export async function withReadOnlyTransaction<T>(sql: SQL, body: (tx: SQL) => Promise<T>): Promise<T> {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const t = THRESHOLDS.statementTimeoutMs;
    await tx.unsafe(`set local statement_timeout = ${t}; set local lock_timeout = ${t}; set local idle_in_transaction_session_timeout = ${t * 2}`);
    if (one(await tx.unsafe("select current_setting('transaction_read_only') as ro")).ro !== "on") throw new MonitorError("not_read_only");
    return body(tx);
  }) as Promise<T>;
}

const SQLSTATE: Record<string, FailureReason> = {
  "28P01": "db_auth_failed",
  "28000": "db_auth_failed",
  "3D000": "database_missing",
  "42501": "permission_denied",
  "42P01": "schema_mismatch",
  "3F000": "schema_mismatch",
  "42703": "schema_mismatch",
  "42883": "schema_mismatch",
  "42704": "schema_mismatch",
  "57014": "statement_timeout",
  "55P03": "statement_timeout",
  "25006": "read_only_violation",
};

/** Maps any thrown value to a fixed code; never keeps the message. */
export function classifyDbError(error: unknown): FailureReason {
  if (error instanceof MonitorError) return error.failure;
  const e = isRecord(error) ? error : null;
  if (typeof e?.errno === "string" && Object.hasOwn(SQLSTATE, e.errno)) return SQLSTATE[e.errno];
  if (typeof e?.errno === "string" && e.errno.startsWith("08")) return "db_unreachable";
  if (typeof e?.code === "string" && /CONNECTION|TIMEOUT|TLS|SSL|ECONN|ENOTFOUND/i.test(e.code)) return "db_unreachable";
  return "db_query_failed";
}

export async function observeDatabase(
  target: Target,
  deadlineMs: number = THRESHOLDS.observationDeadlineMs,
): Promise<{ observedAt: string; database: DbObservation }> {
  let sql: SQL | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    sql = new SQL({
      url: target.databaseUrl,
      max: 1,
      prepare: false,
      connectionTimeout: THRESHOLDS.connectTimeoutSeconds,
      idleTimeout: THRESHOLDS.connectTimeoutSeconds,
      tls: target.tls,
    });
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new MonitorError("observation_timeout")), deadlineMs);
    });
    const { now, facts } = await Promise.race([deadline, withReadOnlyTransaction(sql, collect)]);
    return { observedAt: now, database: { state: "ok", facts } };
  } catch (error) {
    return { observedAt: new Date().toISOString(), database: { state: "failed", failure: classifyDbError(error) } };
  } finally {
    clearTimeout(timer);
    await sql?.close({ timeout: 0 }).catch(() => {});
  }
}


type Row = Readonly<Record<string, unknown>>;
const invalid = () => new MonitorError("observation_invalid");
const BOOKMARK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MESSAGE_ID = /^[1-9]\d{0,18}$/;

export function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record(value: unknown): Row {
  if (!isRecord(value)) throw invalid();
  return value;
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw invalid();
  return value.map(record);
}
function one(value: unknown): Row {
  const all = rows(value);
  if (all.length !== 1) throw invalid();
  return all[0];
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}
function age(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw invalid();
  return Math.round(value);
}
function timestamp(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : value;
  if (!isTimestamp(text)) throw invalid();
  return new Date(text).toISOString();
}
function sampledOf(value: unknown, id: RegExp): Sampled {
  const r = record(value);
  const n = count(r.count);
  const oldest = age(r.oldestAgeSeconds);
  const ids = r.sampleIds;
  if (!Array.isArray(ids) || ids.length > Math.min(n, THRESHOLDS.sampleIds) || !ids.every((v) => typeof v === "string" && id.test(v))) throw invalid();
  if ((n === 0) !== (oldest === null)) throw invalid();
  return { count: n, oldestAgeSeconds: oldest, sampleIds: [...ids] };
}

/** Validates a facts-shaped value and rebuilds it with only known fields. */
export function parseFacts(value: unknown): DatabaseFacts {
  const r = record(value);
  const q = record(r.queue);
  const p = record(r.processing);
  const s = record(r.saves);
  const t = record(r.terminal);
  const c = record(r.completion);
  const failed = record(t.failedByCode);
  const facts: DatabaseFacts = {
    queue: {
      visible: count(q.visible),
      delayed: count(q.delayed),
      leasedOrBackoff: count(q.leasedOrBackoff),
      redelivered: count(q.redelivered),
      oldestVisibleWaitSeconds: age(q.oldestVisibleWaitSeconds),
      backlog: sampledOf(q.backlog, MESSAGE_ID),
      malformed: sampledOf(q.malformed, MESSAGE_ID),
      orphan: sampledOf(q.orphan, MESSAGE_ID),
      ownerMismatch: sampledOf(q.ownerMismatch, MESSAGE_ID),
    },
    processing: {
      total: count(p.total),
      oldestJourneyAgeSeconds: age(p.oldestJourneyAgeSeconds),
      withoutOwner: sampledOf(p.withoutOwner, BOOKMARK_ID),
      overdue: sampledOf(p.overdue, BOOKMARK_ID),
    },
    saves: { processing: count(s.processing), completed: count(s.completed), failed: count(s.failed), idle: count(s.idle) },
    terminal: {
      completed: count(t.completed),
      failedByCode: Object.fromEntries(FAILURE_CODES.map((code) => [code, sampledOf(failed[code], BOOKMARK_ID)])) as Record<FailureCode, Sampled>,
    },
    completion: {
      latestAgeSeconds: age(c.latestAgeSeconds),
      timedCount: count(c.timedCount),
      p50Seconds: age(c.p50Seconds),
      p95Seconds: age(c.p95Seconds),
      maxSeconds: age(c.maxSeconds),
    },
  };
  const empty = (n: number, v: number | null) => (n === 0) !== (v === null);
  if (empty(facts.queue.visible, facts.queue.oldestVisibleWaitSeconds) || empty(facts.processing.total, facts.processing.oldestJourneyAgeSeconds)) throw invalid();
  if (empty(facts.completion.timedCount, facts.completion.p50Seconds)) throw invalid();
  return facts;
}

const roundAndClampNonnegativeSeconds = (value: unknown): unknown => (value === null || value === undefined ? null : Math.max(0, Math.round(Number(value))));
const sampledRow = (row: Row, prefix: string) => ({
  count: row[`${prefix}_count`],
  oldestAgeSeconds: roundAndClampNonnegativeSeconds(row[`${prefix}_age`]),
  sampleIds: row[`${prefix}_ids`],
});

function terminalFrom(result: Row[]) {
  let completed = 0;
  const failedByCode = Object.fromEntries(FAILURE_CODES.map((c) => [c, { count: 0, oldestAgeSeconds: 0, sampleIds: [] as unknown[] }]));
  for (const row of result) {
    if (row.status === "completed") {
      completed += count(row.n);
      continue;
    }
    if (!Array.isArray(row.ids)) throw invalid();
    const code = typeof row.code === "string" && Object.hasOwn(FAILURE_CLASS, row.code) ? (row.code as FailureCode) : "unclassified";
    const into = failedByCode[code];
    into.count += count(row.n);
    into.oldestAgeSeconds = Math.max(into.oldestAgeSeconds, Number(roundAndClampNonnegativeSeconds(row.age)));
    into.sampleIds = [...into.sampleIds, ...row.ids].slice(0, THRESHOLDS.sampleIds);
  }
  for (const entry of Object.values(failedByCode)) if (entry.count === 0) Object.assign(entry, { oldestAgeSeconds: null });
  return { completed, failedByCode };
}

async function collect(tx: SQL): Promise<{ now: string; facts: DatabaseFacts }> {
  const T = THRESHOLDS;
  const clock = one(await tx.unsafe("select now() as now"));
  const q = one(await tx.unsafe(QUEUE_SQL, [T.visibleQueueWaitSeconds, T.invalidMessageAvailableSeconds, T.sampleIds]));
  const p = one(await tx.unsafe(PROCESSING_SQL, [T.ownerGraceSeconds, T.processingOverdueSeconds, T.sampleIds]));
  const saves = rows(await tx.unsafe(SAVES_SQL, [T.savesWindowSeconds]));
  const terminal = rows(await tx.unsafe(TERMINAL_SQL, [T.terminalWindowSeconds, T.sampleIds]));
  const c = one(await tx.unsafe(COMPLETION_SQL, [T.savesWindowSeconds]));

  const byStatus: Record<string, unknown> = { processing: 0, completed: 0, failed: 0, idle: 0 };
  for (const row of saves) if (typeof row.status === "string" && Object.hasOwn(byStatus, row.status)) byStatus[row.status] = row.n;
  const facts = parseFacts({
    queue: {
      visible: q.visible,
      delayed: q.delayed,
      leasedOrBackoff: q.leased_or_backoff,
      redelivered: q.redelivered,
      oldestVisibleWaitSeconds: roundAndClampNonnegativeSeconds(q.oldest_visible_wait_s),
      backlog: sampledRow(q, "backlog"),
      malformed: sampledRow(q, "malformed"),
      orphan: sampledRow(q, "orphan"),
      ownerMismatch: sampledRow(q, "mismatch"),
    },
    processing: {
      total: p.total,
      oldestJourneyAgeSeconds: roundAndClampNonnegativeSeconds(p.oldest_journey_s),
      withoutOwner: sampledRow(p, "orphaned"),
      overdue: sampledRow(p, "overdue"),
    },
    saves: byStatus,
    terminal: terminalFrom(terminal),
    completion: {
      latestAgeSeconds: roundAndClampNonnegativeSeconds(c.latest_age),
      timedCount: c.timed,
      p50Seconds: roundAndClampNonnegativeSeconds(c.p50),
      p95Seconds: roundAndClampNonnegativeSeconds(c.p95),
      maxSeconds: roundAndClampNonnegativeSeconds(c.max),
    },
  });
  return { now: timestamp(clock.now), facts };
}

export function emptyFacts(): DatabaseFacts {
  const none = (): Sampled => ({ count: 0, oldestAgeSeconds: null, sampleIds: [] });
  return {
    queue: { visible: 0, delayed: 0, leasedOrBackoff: 0, redelivered: 0, oldestVisibleWaitSeconds: null, backlog: none(), malformed: none(), orphan: none(), ownerMismatch: none() },
    processing: { total: 0, oldestJourneyAgeSeconds: null, withoutOwner: none(), overdue: none() },
    saves: { processing: 0, completed: 0, failed: 0, idle: 0 },
    terminal: { completed: 0, failedByCode: Object.fromEntries(FAILURE_CODES.map((c) => [c, none()])) as Record<FailureCode, Sampled> },
    completion: { latestAgeSeconds: null, timedCount: 0, p50Seconds: null, p95Seconds: null, maxSeconds: null },
  };
}

const API_FAILURE = /^(unreachable|timeout|malformed|http_[1-5]\d\d)$/;

/** Boundary parse for a stored Snapshot. Unknown fields are dropped; anything off-shape is null. */
export function parseFixture(text: string): Snapshot | null {
  try {
    const raw = record(JSON.parse(text));
    const api = record(raw.api);
    const db = record(raw.database);
    let parsedApi: ApiObservation;
    if (api.state === "ok" || api.state === "not_observed") parsedApi = { state: api.state };
    else if (api.state === "failed" && typeof api.failure === "string" && API_FAILURE.test(api.failure)) parsedApi = { state: "failed", failure: api.failure as ApiFailure };
    else return null;
    let database: DbObservation;
    if (db.state === "ok") database = { state: "ok", facts: parseFacts(db.facts) };
    else if (db.state === "failed" && FAILURE_REASONS.includes(db.failure as FailureReason)) database = { state: "failed", failure: db.failure as FailureReason };
    else return null;
    return { observedAt: timestamp(raw.observedAt), target: "fixture", api: parsedApi, database };
  } catch {
    return null;
  }
}

export function renderSummary(r: Report): string {
  const title = { ok: "OK", alerting: "ALERTING", monitoring_failed: "MONITORING FAILED" }[r.status];
  const lines = [`## Save-bookmark monitor: ${title}`, "", `Observed ${r.observedAt} (${r.clock} clock, target: ${r.target}). API: ${r.observations.api}. Database: ${r.observations.database}.`, ""];
  if (r.alerts.length > 0) {
    lines.push("| Severity | Alert | Evidence | Next action |", "| --- | --- | --- | --- |");
    for (const a of r.alerts) lines.push(`| ${a.severity} | [\`${a.code}\`](${a.runbook}) | \`${JSON.stringify(a.evidence)}\` | ${a.next} |`);
    lines.push("");
  }
  if (r.context) {
    const c = r.context;
    const timing = c.completion.createdToCompleted;
    lines.push(
      "| Context | Value |",
      "| --- | --- |",
      `| Accepted saves (24h) | ${c.saves.accepted} (processing ${c.saves.byStatus.processing}, completed ${c.saves.byStatus.completed}, failed ${c.saves.byStatus.failed}); deferred idle ${c.saves.deferredIdle} |`,
      `| Queue | visible ${c.queue.visible}, delayed ${c.queue.delayed}, leased/backoff ${c.queue.leasedOrBackoff}, oldest visible ${c.queue.oldestVisibleWaitSeconds ?? "-"}s |`,
      `| Terminal (60m) | completed ${c.terminal.completed}, infrastructure failed ${c.terminal.infrastructureFailed}, source failed ${c.terminal.sourceFailed} |`,
      `| Latest completion, any save | ${c.completion.latestAgeSeconds ?? "-"}s ago |`,
      `| Created to completed (n=${timing.count}, includes idle and reprocessing) | p50 ${timing.p50Seconds ?? "-"}s, p95 ${timing.p95Seconds ?? "-"}s |`,
      "",
    );
  }
  for (const note of r.notes) lines.push(`- ${note}`);
  return `${lines.join("\n")}\n`;
}
