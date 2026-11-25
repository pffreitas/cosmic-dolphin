import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXIT, main, parseArgs, type Deps } from "../monitor";
import {
  PRODUCTION,
  RULES,
  classifyDbError,
  emptyFacts,
  evaluate,
  observeApi,
  parseFixture,
  resolveTarget,
  type DatabaseFacts,
  type HttpFetch,
  type Sampled,
  type Snapshot,
} from "../save-bookmarks";

const SCRIPT = join(import.meta.dir, "..", "monitor.ts");
const FIXTURES = join(import.meta.dir, "fixtures");
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SECRET = "S3cr3t-Passw0rd";
const CA = "-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIUQ2ZmYWtlZmFrZWZha2VmYWtlZmFrZTAK\n-----END CERTIFICATE-----\n";

function snapshot(edit: (f: DatabaseFacts) => void = () => {}, api: Snapshot["api"] = { state: "ok" }): Snapshot {
  const facts = emptyFacts();
  edit(facts);
  return { observedAt: "2026-11-24T12:00:00.000Z", target: "fixture", api, database: { state: "ok", facts } };
}
const codes = (s: Snapshot) => evaluate(s).alerts.map((a) => a.code);

describe("evaluate", () => {
  test("no traffic with successful observations is ok, with a caveat", () => {
    const report = evaluate(snapshot());
    expect(report).toMatchObject({ status: "ok", alerts: [], clock: "database", observations: { api: "ok", database: "ok" } });
    expect(report.notes.join(" ")).toContain("does not prove the save journey works");
  });

  test("an unobservable database is monitoring_failed, never ok, and has no context", () => {
    const report = evaluate({ observedAt: "2026-11-24T12:00:00.000Z", target: "production", api: { state: "ok" }, database: { state: "failed", failure: "schema_mismatch" } });
    expect(report).toMatchObject({ status: "monitoring_failed", context: null, clock: "checker", observations: { database: "schema_mismatch" } });
    expect(report.alerts).toMatchObject([{ code: "monitoring_failed", severity: "critical", evidence: { count: 1, reason: "schema_mismatch" } }]);
  });

  test("API health failure is critical and blocks ok", () => {
    const report = evaluate(snapshot(() => {}, { state: "failed", failure: "malformed" }));
    expect(report.status).toBe("alerting");
    expect(report.alerts).toMatchObject([{ code: "api_health_failed", severity: "critical", evidence: { reason: "malformed" } }]);
  });

  test("an API that was not observed is neither healthy nor an API alert", () => {
    const report = evaluate({ observedAt: "2026-11-24T12:00:00.000Z", target: "unresolved", api: { state: "not_observed" }, database: { state: "failed", failure: "target_database_project_mismatch" } });
    expect(report.observations.api).toBe("not_observed");
    expect(codes({ observedAt: "t", target: "unresolved", api: { state: "not_observed" }, database: { state: "failed", failure: "usage_invalid" } })).toEqual(["monitoring_failed"]);
  });

  const sampledRules: Array<[string, (f: DatabaseFacts) => Sampled]> = [
    ["queue_visible_backlog", (f) => f.queue.backlog],
    ["processing_without_owner", (f) => f.processing.withoutOwner],
    ["processing_overdue", (f) => f.processing.overdue],
    ["queue_invalid_messages", (f) => f.queue.orphan],
  ];
  for (const [code, pick] of sampledRules) {
    test(`${code} fires on one row and carries a runbook anchor`, () => {
      const report = evaluate(snapshot((f) => Object.assign(pick(f), { count: 1, oldestAgeSeconds: 2400, sampleIds: [ID(1)] })));
      expect(report.status).toBe("alerting");
      const alert = report.alerts.find((a) => a.code === code)!;
      expect(alert.runbook).toBe(`docs/runbooks/save-bookmark-monitoring.md#${code.replaceAll("_", "-")}`);
      expect(alert.evidence).toMatchObject({ count: 1, sampleIds: [ID(1)] });
    });
  }

  test("one infrastructure failure at low traffic pages as critical with no rate minimum", () => {
    const report = evaluate(
      snapshot((f) => {
        f.saves.failed = 1;
        f.terminal.failedByCode.provider = { count: 1, oldestAgeSeconds: 60, sampleIds: [ID(7)] };
      }),
    );
    expect(report.alerts).toMatchObject([{ code: "infrastructure_failures", severity: "critical", evidence: { count: 1, byCode: { provider: 1 }, sampleIds: [ID(7)] } }]);
  });

  test("unclassified (null code) and unavailable failures count as infrastructure", () => {
    const report = evaluate(
      snapshot((f) => {
        f.terminal.failedByCode.unclassified = { count: 2, oldestAgeSeconds: 10, sampleIds: [] };
        f.terminal.failedByCode.unavailable = { count: 1, oldestAgeSeconds: 10, sampleIds: [] };
      }),
    );
    expect(report.alerts[0]?.evidence).toMatchObject({ count: 3, byCode: { unclassified: 2, unavailable: 1 } });
  });

  test("source failures alone are context, and every code is reported for zero recovery", () => {
    const report = evaluate(
      snapshot((f) => {
        for (const code of ["paywall", "auth", "blocked", "empty", "unsupported"] as const) f.terminal.failedByCode[code] = { count: 1, oldestAgeSeconds: 5, sampleIds: [] };
      }),
    );
    expect(report.status).toBe("ok");
    expect(report.context?.terminal).toMatchObject({ sourceFailed: 5, infrastructureFailed: 0, failedByCode: { paywall: 1, unsupported: 1, provider: 0 } });
    expect(report.notes.join(" ")).toContain("5 expected source failure(s)");
  });

  test("idle deferral, delayed sends, leases and backoff are not failures", () => {
    const report = evaluate(
      snapshot((f) => {
        f.saves.idle = 12;
        f.saves.processing = 3;
        Object.assign(f.queue, { delayed: 1, leasedOrBackoff: 2, redelivered: 2, visible: 1, oldestVisibleWaitSeconds: 299 });
        Object.assign(f.processing, { total: 3, oldestJourneyAgeSeconds: 1700 });
      }),
    );
    expect(report.status).toBe("ok");
    expect(report.context?.saves).toEqual({ accepted: 3, byStatus: { processing: 3, completed: 0, failed: 0 }, deferredIdle: 12 });
  });

  test("invalid-message evidence counts every kind and keeps ids bounded", () => {
    const ids = [1, 2, 3, 4, 5].map(String);
    const report = evaluate(snapshot((f) => {
      for (const kind of ["malformed", "orphan", "ownerMismatch"] as const) f.queue[kind] = { count: 5, oldestAgeSeconds: 400, sampleIds: ids };
    }));
    expect(report.alerts[0]).toMatchObject({ code: "queue_invalid_messages", severity: "warning", evidence: { count: 15, byKind: { malformed: 5, orphan: 5, ownerMismatch: 5 } } });
    expect(report.alerts[0]?.evidence.sampleIds).toHaveLength(5);
    expect(report.context?.queue.invalidPastGrace).toEqual({ malformed: 5, orphan: 5, ownerMismatch: 5 });
  });

  test("completion timing is labelled as including idle deferral and reprocessing", () => {
    const basis = evaluate(snapshot()).context?.completion.createdToCompleted.basis;
    expect(basis).toContain("idle budget deferral");
    expect(basis).toContain("reprocessing");
    expect(basis).toContain("no latency alert");
  });

  test("rule order is stable: monitoring, API, then save journey; only invalid messages is a warning", () => {
    const all = snapshot((f) => {
      f.queue.backlog = { count: 1, oldestAgeSeconds: 400, sampleIds: [] };
      f.processing.withoutOwner = { count: 1, oldestAgeSeconds: 400, sampleIds: [] };
      f.processing.overdue = { count: 1, oldestAgeSeconds: 4000, sampleIds: [] };
      f.queue.malformed = { count: 1, oldestAgeSeconds: 400, sampleIds: [] };
      f.terminal.failedByCode.provider = { count: 1, oldestAgeSeconds: 10, sampleIds: [] };
    }, { state: "failed", failure: "timeout" });
    expect(codes(all)).toEqual(["api_health_failed", "queue_visible_backlog", "processing_without_owner", "processing_overdue", "queue_invalid_messages", "infrastructure_failures"]);
    expect(RULES.filter((r) => r.severity === "warning").map((r) => r.code)).toEqual(["queue_invalid_messages"]);
  });
});

describe("resolveTarget", () => {
  const ref = PRODUCTION.projectRef;
  const direct = `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;
  const pooler = `postgresql://postgres.${ref}:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  const prod = { SUPABASE_PROJECT_REF: ref, SUPABASE_URL: `https://${ref}.supabase.co`, DATABASE_URL: direct };

  test("accepts the production project by direct host or pooler username", () => {
    expect(resolveTarget(prod)).toMatchObject({ ok: true, target: { kind: "production", tls: true, apiHealthUrl: PRODUCTION.apiHealthUrl } });
    expect(resolveTarget({ ...prod, DATABASE_URL: pooler })).toMatchObject({ ok: true });
    expect(resolveTarget({ ...prod, DATABASE_URL: pooler.replace(":6543", ":5432") })).toMatchObject({ ok: true });
    expect(resolveTarget({ ...prod, DATABASE_URL: `${direct}?sslmode=require` })).toMatchObject({ ok: true });
  });

  test("a pinned CA turns on verification against it", () => {
    expect(resolveTarget({ ...prod, MONITOR_DB_CA_PEM: CA })).toMatchObject({ ok: true, target: { tls: { ca: CA } } });
  });

  const rejected: Array<[string, Record<string, string | undefined>, string]> = [
    ["missing DATABASE_URL", { ...prod, DATABASE_URL: undefined }, "database_url_missing"],
    ["non-postgres URL", { ...prod, DATABASE_URL: "https://example.com" }, "database_url_invalid"],
    ["missing ref", { ...prod, SUPABASE_PROJECT_REF: undefined }, "project_ref_missing"],
    ["another project ref", { ...prod, SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst" }, "project_ref_unexpected"],
    ["SUPABASE_URL for another project", { ...prod, SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" }, "supabase_url_mismatch"],
    ["SUPABASE_URL over http", { ...prod, SUPABASE_URL: `http://${ref}.supabase.co` }, "supabase_url_mismatch"],
    ["SUPABASE_URL with a path", { ...prod, SUPABASE_URL: `https://${ref}.supabase.co/rest` }, "supabase_url_mismatch"],
    ["SUPABASE_URL with credentials", { ...prod, SUPABASE_URL: `https://u:p@${ref}.supabase.co` }, "supabase_url_mismatch"],
    ["SUPABASE_URL with a query", { ...prod, SUPABASE_URL: `https://${ref}.supabase.co/?x=1` }, "supabase_url_mismatch"],
    ["direct host of another project", { ...prod, DATABASE_URL: direct.replace(ref, "abcdefghijklmnopqrst") }, "database_project_mismatch"],
    ["pooler user of another project", { ...prod, DATABASE_URL: pooler.replace(`postgres.${ref}`, "postgres.abcdefghijklmnopqrst") }, "database_project_mismatch"],
    ["pooler without project user", { ...prod, DATABASE_URL: pooler.replace(`postgres.${ref}`, "postgres") }, "database_project_mismatch"],
    ["pooler lookalike host", { ...prod, DATABASE_URL: pooler.replace("aws-0-us-east-1.pooler", "evil.pooler") }, "database_project_mismatch"],
    ["lookalike host", { ...prod, DATABASE_URL: `postgresql://postgres:pw@db.${ref}.supabase.co.evil.test:5432/postgres` }, "database_project_mismatch"],
    ["localhost without explicit local opt-in", { ...prod, DATABASE_URL: "postgres://postgres:pw@127.0.0.1:5433/postgres" }, "database_project_mismatch"],
    ["a host override parameter", { ...prod, DATABASE_URL: `${direct}?host=evil.test` }, "database_url_unsupported"],
    ["an options parameter", { ...prod, DATABASE_URL: `${direct}?options=-c%20default_transaction_read_only%3Doff` }, "database_url_unsupported"],
    ["TLS disabled", { ...prod, DATABASE_URL: `${direct}?sslmode=disable` }, "database_url_unsupported"],
    ["another database", { ...prod, DATABASE_URL: direct.replace(/\/postgres$/, "/other") }, "database_url_unsupported"],
    ["no explicit port", { ...prod, DATABASE_URL: direct.replace(":5432", "") }, "database_url_unsupported"],
    ["direct host on the pooler port", { ...prod, DATABASE_URL: direct.replace(":5432", ":6543") }, "database_url_unsupported"],
    ["a fragment", { ...prod, DATABASE_URL: `${direct}#x` }, "database_url_unsupported"],
    ["production with API override", { ...prod, MONITOR_API_HEALTH_URL: "https://elsewhere.test/health" }, "api_override_forbidden"],
    ["a CA that is not PEM", { ...prod, MONITOR_DB_CA_PEM: "not a certificate" }, "ca_invalid"],
    ["local opt-in mixed with production vars", { ...prod, MONITOR_LOCAL_TARGET: "127.0.0.1:5433", MONITOR_API_HEALTH_URL: "http://127.0.0.1:1/health" }, "local_mixed_with_production"],
    ["local opt-in to a remote host", { DATABASE_URL: "postgres://u:p@10.0.0.5:5432/db", MONITOR_LOCAL_TARGET: "10.0.0.5:5432", MONITOR_API_HEALTH_URL: "http://127.0.0.1:1/health" }, "local_target_invalid"],
    ["local opt-in with a remote API", { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db", MONITOR_LOCAL_TARGET: "127.0.0.1:5432", MONITOR_API_HEALTH_URL: "http://api.test/health" }, "local_target_invalid"],
    ["local opt-in with a different port", { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db", MONITOR_LOCAL_TARGET: "127.0.0.1:55871", MONITOR_API_HEALTH_URL: "http://127.0.0.1:1/health" }, "local_target_mismatch"],
    ["local opt-in with URL parameters", { DATABASE_URL: "postgres://u:p@127.0.0.1:5432/db?host=x", MONITOR_LOCAL_TARGET: "127.0.0.1:5432", MONITOR_API_HEALTH_URL: "http://127.0.0.1:1/health" }, "database_url_unsupported"],
  ];
  for (const [name, env, reason] of rejected) {
    test(`rejects ${name}`, () => expect(resolveTarget(env)).toEqual({ ok: false, reason: reason as never }));
  }

  test("accepts an exact explicit local target", () => {
    const env = { DATABASE_URL: "postgres://u:p@127.0.0.1:55871/postgres", MONITOR_LOCAL_TARGET: "127.0.0.1:55871", MONITOR_API_HEALTH_URL: "http://127.0.0.1:9/health" };
    expect(resolveTarget(env)).toMatchObject({ ok: true, target: { kind: "local", tls: false } });
  });
});

describe("observeApi", () => {
  const json = { "content-type": "application/json; charset=utf-8" };
  const respond = (body: BodyInit | null, status = 200, headers: Record<string, string> = json) =>
    (async () => new Response(body, { status, headers })) as HttpFetch;
  const healthy = JSON.stringify({ status: "ok", timestamp: "2026-11-24T12:00:00.000Z" });
  const cases: Array<[string, HttpFetch, Snapshot["api"]]> = [
    ["healthy body", respond(healthy), { state: "ok" }],
    ["non-200", respond("down", 503), { state: "failed", failure: "http_503" }],
    ["non-JSON content type", respond(healthy, 200, { "content-type": "text/html" }), { state: "failed", failure: "malformed" }],
    ["non-JSON body", respond("<html>"), { state: "failed", failure: "malformed" }],
    ["oversized body", respond(JSON.stringify({ status: "ok", timestamp: "2026-11-24T12:00:00Z", pad: "x".repeat(5000) })), { state: "failed", failure: "malformed" }],
    ["wrong status", respond(JSON.stringify({ status: "degraded", timestamp: "2026-11-24T12:00:00Z" })), { state: "failed", failure: "malformed" }],
    ["missing timestamp", respond(JSON.stringify({ status: "ok" })), { state: "failed", failure: "malformed" }],
    ["network error", (async () => { throw new TypeError("connect ECONNREFUSED 10.1.2.3"); }) as HttpFetch, { state: "failed", failure: "unreachable" }],
    ["timeout", (async () => { throw new DOMException("t", "TimeoutError"); }) as HttpFetch, { state: "failed", failure: "timeout" }],
  ];
  for (const [name, fetchImpl, expected] of cases) {
    test(name, async () => expect(await observeApi("https://api.test/health", fetchImpl)).toEqual(expected));
  }

  test("a redirect from a real server is refused, not followed", async () => {
    let followed = false;
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (req) => (new URL(req.url).pathname === "/health" ? Response.redirect("/elsewhere", 302) : ((followed = true), Response.json({ status: "ok", timestamp: new Date().toISOString() }))),
    });
    try {
      expect(await observeApi(`http://127.0.0.1:${server.port}/health`)).toEqual({ state: "failed", failure: "unreachable" });
      expect(followed).toBe(false);
    } finally {
      server.stop(true);
    }
  });
});

test("database errors map to fixed codes and drop their text", () => {
  const err = (errno: string | undefined, code: string) => Object.assign(new Error("password for user x@host failed: secret"), { errno, code });
  expect(classifyDbError(err("28P01", "ERR_POSTGRES_SERVER_ERROR"))).toBe("db_auth_failed");
  expect(classifyDbError(err("42501", "ERR_POSTGRES_SERVER_ERROR"))).toBe("permission_denied");
  expect(classifyDbError(err("42P01", "ERR_POSTGRES_SERVER_ERROR"))).toBe("schema_mismatch");
  expect(classifyDbError(err("57014", "ERR_POSTGRES_SERVER_ERROR"))).toBe("statement_timeout");
  expect(classifyDbError(err("constructor", "ERR_POSTGRES_SERVER_ERROR"))).toBe("db_query_failed");
  expect(classifyDbError(err(undefined, "ERR_POSTGRES_CONNECTION_CLOSED"))).toBe("db_unreachable");
  expect(classifyDbError(new Error("anything"))).toBe("db_query_failed");
});

describe("parseFixture", () => {
  const base = () => JSON.parse(readFileSync(join(FIXTURES, "low-traffic-provider-failure.json"), "utf8"));
  const parse = (edit: (raw: any) => void) => {
    const raw = base();
    edit(raw);
    return parseFixture(JSON.stringify(raw));
  };

  test("accepts a stored snapshot and drops unknown fields everywhere", () => {
    const parsed = parse((raw) => {
      raw.secret = SECRET;
      raw.api.detail = SECRET;
      raw.database.facts.title = SECRET;
      raw.database.facts.terminal.failedByCode.provider.url = SECRET;
    });
    expect(parsed).toMatchObject({ target: "fixture", api: { state: "ok" }, database: { state: "ok" } });
    expect(JSON.stringify(parsed)).not.toContain(SECRET);
  });

  const broken: Array<[string, (raw: any) => void]> = [
    ["a bookmark sample id that is not a UUID", (r) => (r.database.facts.terminal.failedByCode.provider.sampleIds = ["user@example.com"])],
    ["an uppercase bookmark id", (r) => (r.database.facts.terminal.failedByCode.provider.sampleIds = ["00000000-0000-4000-8000-00000000000A"])],
    ["a message id that is not a positive integer", (r) => Object.assign(r.database.facts.queue.backlog, { count: 1, oldestAgeSeconds: 400, sampleIds: ["0"] })],
    ["a negative count", (r) => (r.database.facts.queue.visible = -1)],
    ["a fractional count", (r) => (r.database.facts.saves.idle = 1.5)],
    ["a count as a string", (r) => (r.database.facts.saves.idle = "1")],
    ["a negative age", (r) => (r.database.facts.terminal.failedByCode.provider.oldestAgeSeconds = -5)],
    ["a missing age", (r) => delete r.database.facts.completion.p95Seconds],
    ["more sample ids than rows", (r) => r.database.facts.terminal.failedByCode.provider.sampleIds.push("00000000-0000-4000-8000-000000000008")],
    ["a zero count with an age", (r) => (r.database.facts.queue.malformed.oldestAgeSeconds = 10)],
    ["visible rows with no oldest wait", (r) => (r.database.facts.queue.visible = 2)],
    ["a timestamp that is not ISO", (r) => (r.observedAt = "yesterday")],
    ["a free-text database failure", (r) => (r.database = { state: "failed", failure: `password ${SECRET} rejected` })],
    ["a free-text API failure", (r) => (r.api = { state: "failed", failure: "connect ECONNREFUSED 10.0.0.1" })],
    ["an impossible HTTP status", (r) => (r.api = { state: "failed", failure: "http_999" })],
    ["a missing failure code entry", (r) => delete r.database.facts.terminal.failedByCode.paywall],
  ];
  for (const [name, edit] of broken) test(`rejects ${name}`, () => expect(parse(edit)).toBeNull());
});

describe("main", () => {
  function deps(env: Record<string, string>, overrides: Partial<Deps> = {}) {
    const out: string[] = [];
    const err: string[] = [];
    const fetchMock = mock(async (..._args: Parameters<HttpFetch>) => new Response("{}", { status: 200 }));
    const d: Deps = {
      env,
      readFile: (p) => readFileSync(p, "utf8"),
      writeFile: () => {},
      stdout: (t) => out.push(t),
      stderr: (t) => err.push(t),
      observeApi: mock(async () => ({ state: "ok" as const })),
      observeDatabase: mock(async () => ({ observedAt: "2026-11-24T12:00:00.000Z", database: { state: "ok" as const, facts: emptyFacts() } })),
      fetch: fetchMock,
      now: () => Date.parse("2026-11-24T12:00:05.000Z"),
      ...overrides,
    };
    return { d, out, err, fetchMock };
  }
  const prodEnv = {
    SUPABASE_PROJECT_REF: PRODUCTION.projectRef,
    SUPABASE_URL: `https://${PRODUCTION.projectRef}.supabase.co`,
    DATABASE_URL: `postgresql://postgres:${SECRET}@db.${PRODUCTION.projectRef}.supabase.co:5432/postgres`,
  };

  test("a wrong production target fails before any network call, leaks nothing and does not claim API health", async () => {
    const { d, out } = deps({ ...prodEnv, DATABASE_URL: `postgresql://postgres:${SECRET}@db.abcdefghijklmnopqrst.supabase.co:5432/postgres` });
    expect(await main([], d)).toBe(EXIT.monitoring_failed);
    expect(d.observeApi).not.toHaveBeenCalled();
    expect(d.observeDatabase).not.toHaveBeenCalled();
    const report = JSON.parse(out.join(""));
    expect(report).toMatchObject({ target: "unresolved", observations: { api: "not_observed", database: "target_database_project_mismatch" } });
    expect(out.join("")).not.toContain(SECRET);
    expect(out.join("")).not.toContain("abcdefghijklmnopqrst");
  });

  test("unknown or repeated flags are a monitoring failure, not a healthy run", async () => {
    for (const argv of [["--fixtures", "x"], ["--report", "a", "--report", "b"], ["--publish", "--publish"], ["--report"]]) {
      const { d, out } = deps({});
      expect(await main(argv, d)).toBe(EXIT.monitoring_failed);
      expect(JSON.parse(out.join("")).observations.database).toBe("usage_invalid");
    }
    expect(parseArgs(["constructor", "x"])).toBeNull();
  });

  test("an unexpected observer throw becomes a fixed checker_failed report with no error text", async () => {
    const { d, out } = deps(prodEnv, { observeDatabase: mock(async () => { throw new Error(`boom ${SECRET} at /secret/path`); }) });
    expect(await main([], d)).toBe(EXIT.monitoring_failed);
    const text = out.join("");
    expect(JSON.parse(text).observations.database).toBe("checker_failed");
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("/secret/path");
  });

  test("an output failure prints a fixed output_failed report and exits 2", async () => {
    const { d, out } = deps(prodEnv, { writeFile: () => { throw new Error(`EACCES /private/${SECRET}`); } });
    expect(await main(["--report", "/nope/r.json"], d)).toBe(EXIT.monitoring_failed);
    const text = out.join("");
    expect(JSON.parse(text)).toMatchObject({ status: "monitoring_failed", observations: { database: "output_failed" } });
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("/nope");
  });

  test("--publish without delivery configuration exits 3 and still prints the report", async () => {
    const { d, out, err } = deps(prodEnv);
    expect(await main(["--publish"], d)).toBe(EXIT.delivery_failed);
    expect(JSON.parse(out.join("")).status).toBe("ok");
    expect(JSON.parse(err.join(""))).toEqual({ delivery: "failed", reason: "config_endpoint_missing" });
  });

  test("--publish after a failed observation still delivers the failure signal", async () => {
    const env = { ...prodEnv, DATABASE_URL: "nope", GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp", GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: `glc_${SECRET}` };
    const { d, err, fetchMock } = deps(env);
    expect(await main(["--publish"], d)).toBe(EXIT.monitoring_failed);
    expect(JSON.parse(err.join(""))).toEqual({ delivery: "ok", series: 2 });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const names = body.resourceMetrics[0].scopeMetrics[0].metrics.map((m: { name: string }) => m.name);
    expect(names).toEqual(["cosmic_save_monitor_heartbeat_timestamp_seconds", "cosmic_save_monitor_observer_up"]);
  });

  test("--check-config validates without network and never echoes values", async () => {
    const good = deps({ ...prodEnv, GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp", GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: `glc_${SECRET}` });
    expect(await main(["--check-config", "--publish"], good.d)).toBe(EXIT.ok);
    expect(JSON.parse(good.out.join(""))).toEqual({ config: "ok", target: "production", publish: true });
    const bad = deps({ ...prodEnv, MONITOR_DB_CA_PEM: SECRET, GRAFANA_OTLP_ENDPOINT: `https://evil.test/otlp?k=${SECRET}` });
    expect(await main(["--check-config", "--publish"], bad.d)).toBe(EXIT.monitoring_failed);
    expect(JSON.parse(bad.out.join(""))).toEqual({ config: "invalid", problems: ["target_ca_invalid", "delivery_endpoint_invalid"] });
    expect(bad.out.join("")).not.toContain(SECRET);
    for (const d of [good.d, bad.d]) expect(d.observeDatabase).not.toHaveBeenCalled();
    expect(good.d.fetch).not.toHaveBeenCalled();
  });
});

describe("CLI with fixtures", () => {
  const cli = (args: string[], env: Record<string, string> = {}) => {
    const run = Bun.spawnSync(["bun", "--no-env-file", SCRIPT, ...args], { env: { PATH: process.env.PATH ?? "", ...env } });
    return { code: run.exitCode, stdout: run.stdout.toString(), stderr: run.stderr.toString() };
  };

  test("healthy no-traffic fixture exits 0 and writes a private report and summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "monitor-"));
    const run = cli(["--fixture", join(FIXTURES, "healthy-no-traffic.json"), "--report", join(dir, "r.json"), "--summary", join(dir, "s.md")]);
    expect(run.code).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ status: "ok", target: "fixture", alerts: [] });
    expect(JSON.parse(readFileSync(join(dir, "r.json"), "utf8")).status).toBe("ok");
    expect(readFileSync(join(dir, "s.md"), "utf8")).toContain("## Save-bookmark monitor: OK");
    expect(statSync(join(dir, "r.json")).mode & 0o777).toBe(0o600);
  });

  test("low-traffic provider failure fixture exits 1 with a critical alert", () => {
    const run = cli(["--fixture", join(FIXTURES, "low-traffic-provider-failure.json")]);
    expect(run.code).toBe(1);
    expect(JSON.parse(run.stdout).alerts.map((a: { code: string; severity: string }) => [a.code, a.severity])).toEqual([["infrastructure_failures", "critical"]]);
  });

  test("unobservable database fixture exits 2", () => {
    const run = cli(["--fixture", join(FIXTURES, "database-unobservable.json")]);
    expect(run.code).toBe(2);
    expect(JSON.parse(run.stdout).status).toBe("monitoring_failed");
  });

  test("a malformed fixture or missing file exits 2 with fixture_invalid", () => {
    expect(cli(["--fixture", join(FIXTURES, "invalid.json")]).code).toBe(2);
    expect(JSON.parse(cli(["--fixture", join(FIXTURES, "nope.json")]).stdout).observations.database).toBe("fixture_invalid");
  });

  test("live mode with no target configured exits 2 without touching the network", () => {
    const run = cli([]);
    expect(run.code).toBe(2);
    expect(JSON.parse(run.stdout).observations.database).toBe("target_database_url_missing");
    expect(run.stderr).toBe("");
  });

  test("an unwritable report path yields the fixed fallback, not a stack", () => {
    const run = cli(["--fixture", join(FIXTURES, "healthy-no-traffic.json"), "--report", "/nonexistent-dir/r.json"]);
    expect(run.code).toBe(2);
    expect(JSON.parse(run.stdout).observations.database).toBe("output_failed");
    expect(run.stdout + run.stderr).not.toContain("nonexistent-dir");
    expect(run.stderr).toBe("");
  });
});
