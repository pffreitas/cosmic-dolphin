import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT, main, type Deps } from "../monitor";
import { emptyFacts, evaluate } from "../save-bookmarks";
import { logPayload, publishLog } from "../logs";

const TOKEN = "fixture-log-token-private-00000000";
const NOW = Date.parse("2026-11-25T12:00:00Z");
const servers: Bun.Server<undefined>[] = [];
const children: Bun.Subprocess[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) { child.kill("SIGKILL"); await child.exited; }
  for (const server of servers.splice(0)) await server.stop(true);
});

function fixture(replies: (path: string) => Response | Promise<Response> = (path) => path.endsWith("/logs") ? new Response(null, { status: 204 }) : Response.json({})) {
  const seen: { path: string; body: any; authorization: string | null }[] = [];
  const out: string[] = [], err: string[] = [];
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(req) {
    const path = new URL(req.url).pathname;
    seen.push({ path, body: await req.json(), authorization: req.headers.get("authorization") });
    return replies(path);
  } });
  servers.push(server);
  const deps: Deps = {
    env: { GRAFANA_OTLP_ENDPOINT: `http://127.0.0.1:${server.port}/otlp`, GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: TOKEN },
    readFile: (path) => readFileSync(path, "utf8"), writeFile: () => {},
    stdout: (text) => out.push(text), stderr: (text) => err.push(text),
    observeApi: async () => { throw Error("fixture_must_not_probe_api"); },
    observeDatabase: async () => { throw Error("fixture_must_not_probe_database"); },
    fetch, now: () => NOW,
  };
  const args = ["--fixture", join(import.meta.dir, "fixtures/healthy-no-traffic.json"), "--publish", "--publish-log"];
  return { seen, out, err, deps, args };
}

test("the checker publishes one acknowledged snapshot log before it exits", async () => {
  const f = fixture();
  expect(await main(f.args, f.deps)).toBe(EXIT.ok);
  expect(f.seen.map((s) => s.path)).toEqual(["/otlp/v1/metrics", "/otlp/v1/logs"]);
  expect(f.seen[1]!.authorization).toBe(`Basic ${btoa(`123456:${TOKEN}`)}`);
  const logs = f.seen[1]!.body.resourceLogs;
  expect(logs).toHaveLength(1);
  expect(logs[0].resource.attributes).toEqual([
    { key: "service.name", value: { stringValue: "cosmic-dolphin-save-monitor" } },
    { key: "deployment.environment.name", value: { stringValue: "fixture" } },
  ]);
  const records = logs[0].scopeLogs[0].logRecords;
  expect(records).toHaveLength(1);
  expect(records[0].severityText).toBe("INFO");
  expect(JSON.parse(records[0].body.stringValue)).toMatchObject({ event: "save_bookmark_snapshot", status: "ok" });
  expect(JSON.stringify(logs)).not.toContain(TOKEN);
  expect(JSON.parse(f.out.join(""))).toMatchObject({ status: "ok", target: "fixture" });
  expect(f.err.map((s) => JSON.parse(s))).toMatchObject([{ delivery: "ok" }, { logDelivery: "ok", records: 1 }]);
});

test("the packaged CLI publishes metrics and logs with the configured command flags", async () => {
  const f = fixture();
  const child = Bun.spawn([process.execPath, "--no-env-file", join(import.meta.dir, "../monitor.ts"), ...f.args], {
    env: { PATH: process.env.PATH, ...f.deps.env }, stdout: "pipe", stderr: "pipe",
  });
  children.push(child);
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect(code).toBe(EXIT.ok);
  expect(JSON.parse(stdout)).toMatchObject({ status: "ok", target: "fixture" });
  expect(stderr.trim().split("\n").map((line) => JSON.parse(line))).toMatchObject([{ delivery: "ok" }, { logDelivery: "ok", records: 1 }]);
  expect(f.seen.map((s) => s.path)).toEqual(["/otlp/v1/metrics", "/otlp/v1/logs"]);
});

test("a held log ACK keeps the checker running after metric delivery", async () => {
  let started!: () => void, release!: (response: Response) => void;
  const reached = new Promise<void>((done) => { started = done; });
  const held = new Promise<Response>((done) => { release = done; });
  const f = fixture((path) => { if (path.endsWith("/logs")) { started(); return held; } return Response.json({}); });
  let finished = false;
  const pending = main(f.args, f.deps).then((code) => { finished = true; return code; });
  await reached;
  expect(finished).toBe(false);
  expect(f.seen.map((s) => s.path)).toEqual(["/otlp/v1/metrics", "/otlp/v1/logs"]);
  release(new Response(null, { status: 204 }));
  expect(await pending).toBe(EXIT.ok);
});

test("metrics failure still attempts logs; logs failure preserves metrics and the observation report", async () => {
  for (const failedPath of ["/otlp/v1/metrics", "/otlp/v1/logs"]) {
    const f = fixture((path) => path === failedPath ? new Response(TOKEN, { status: 503 }) : Response.json({}));
    expect(await main(f.args, f.deps)).toBe(EXIT.delivery_failed);
    expect(f.seen).toHaveLength(2);
    expect(JSON.parse(f.out.join(""))).toMatchObject({ status: "ok", observations: { api: "ok", database: "ok" } });
    const result = f.err.map((text) => JSON.parse(text));
    expect(result[failedPath.endsWith("/metrics") ? 0 : 1].reason).toBe("http_503");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  }
});

test("log partial rejection and malformed acknowledgements never report successful delivery", async () => {
  for (const reply of [
    Response.json({ partialSuccess: { rejectedLogRecords: "1", errorMessage: TOKEN } }),
    Response.json({ partialSuccess: { rejectedLogRecords: -1 } }),
    Response.json({ partialSuccess: { rejectedLogRecords: "not-a-count" } }),
    Response.json({ partialSuccess: { rejectedLogRecords: 0, errorMessage: 123 } }),
    Response.json({ padding: "x".repeat(20_000) }),
    new Response(TOKEN),
  ]) {
    const f = fixture((path) => path.endsWith("/logs") ? reply : Response.json({}));
    expect(await main(f.args, f.deps)).toBe(EXIT.delivery_failed);
    const result = JSON.parse(f.err[1]!);
    expect(result.logDelivery).toBe("failed");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(f.seen).toHaveLength(2);
  }
});

test("the log response-body deadline is bounded and the next run recovers", async () => {
  let stalled = true;
  const f = fixture((path) => !path.endsWith("/logs") ? Response.json({}) : stalled
    ? new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"partialSuccess":')); } }))
    : Response.json({ partialSuccess: { rejectedLogRecords: "0" } }));
  expect(await main(f.args, f.deps)).toBe(EXIT.delivery_failed);
  expect(JSON.parse(f.err[1]!)).toEqual({ logDelivery: "failed", reason: "timeout" });
  stalled = false;
  expect(await main(f.args, f.deps)).toBe(EXIT.ok);
  expect(f.seen.map((s) => s.path)).toEqual(["/otlp/v1/metrics", "/otlp/v1/logs", "/otlp/v1/metrics", "/otlp/v1/logs"]);
}, 20_000);

test("log redirects are rejected without forwarding credentials to another endpoint", async () => {
  let followed = 0;
  const other = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch() { followed++; return Response.json({}); } });
  servers.push(other);
  const f = fixture((path) => path.endsWith("/logs") ? Response.redirect(`http://127.0.0.1:${other.port}/private`, 307) : Response.json({}));
  expect(await main(f.args, f.deps)).toBe(EXIT.delivery_failed);
  expect(JSON.parse(f.err[1]!)).toEqual({ logDelivery: "failed", reason: "unreachable" });
  expect(followed).toBe(0);
});

test("metric-only mode stays unchanged and invalid log flags do no delivery", async () => {
  const old = fixture();
  expect(await main(old.args.filter((a) => a !== "--publish-log"), old.deps)).toBe(EXIT.ok);
  expect(old.seen.map((s) => s.path)).toEqual(["/otlp/v1/metrics"]);
  expect(old.err).toHaveLength(1);
  for (const argv of [["--publish-log"], ["--publish", "--publish-log", "--publish-log"]]) {
    const f = fixture();
    expect(await main(argv, f.deps)).toBe(EXIT.monitoring_failed);
    expect(f.seen).toHaveLength(0);
  }
});

test("fixture snapshots cannot be published to production logs", async () => {
  const f = fixture();
  f.deps.env.GRAFANA_OTLP_ENDPOINT = "https://otlp-gateway-prod-us-east-2.grafana.net/otlp";
  expect(await main(f.args, f.deps)).toBe(EXIT.delivery_failed);
  expect(f.seen).toHaveLength(0);
  expect(JSON.parse(f.err[1]!)).toEqual({ logDelivery: "failed", reason: "config_environment_mismatch" });
});

test("failed observations publish ERROR with only health metrics and fixed failure codes", async () => {
  const f = fixture();
  f.args[1] = join(import.meta.dir, "fixtures/database-unobservable.json");
  expect(await main(f.args, f.deps)).toBe(EXIT.monitoring_failed);
  const record = f.seen[1]!.body.resourceLogs[0].scopeLogs[0].logRecords[0];
  expect(record.severityText).toBe("ERROR");
  const body = JSON.parse(record.body.stringValue);
  expect(body.observations.database).toBe("permission_denied");
  expect(body.metrics.map((m: any) => m.name)).toEqual([
    "cosmic_save_monitor_heartbeat_timestamp_seconds", "cosmic_save_monitor_observer_up", "cosmic_save_api_up",
  ]);
  expect(body.metrics[1].value).toBe(0);
});

test("snapshot logs exclude private text, runbook URLs and sampled IDs; bound the whole UTF-8 payload", async () => {
  const facts = emptyFacts();
  const id = "67c057b4-fc97-4b4b-87f7-bc347c4c1be8";
  facts.processing.overdue = { count: 4, oldestAgeSeconds: 4000, sampleIds: [id] };
  const report = evaluate({ observedAt: new Date(NOW).toISOString(), target: "fixture", api: { state: "ok" }, database: { state: "ok", facts } });
  report.notes.push(TOKEN, "private saved content");
  const body = logPayload(report, "fixture", NOW);
  const text = JSON.stringify(body);
  for (const privateText of [TOKEN, id, "private saved content", "runbook"]) expect(text).not.toContain(privateText);
  expect(body.resourceLogs[0]!.scopeLogs[0]!.logRecords[0]!.severityText).toBe("WARN");
  const f = fixture();
  expect(await publishLog({ ...report, observedAt: "é".repeat(40_000) }, f.deps.env, fetch, NOW)).toEqual({ ok: false, failure: "payload_too_large" });
  expect(await publishLog(report, f.deps.env, fetch, NaN)).toEqual({ ok: false, failure: "payload_invalid" });
  expect(f.seen).toHaveLength(0);
});
