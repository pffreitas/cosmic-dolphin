import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RULES, emptyFacts, evaluate, type DatabaseFacts, type HttpFetch, type Report, type Snapshot } from "../save-bookmarks";
import { METRICS, deliver, otlpPayload, resolveOtlpTarget, samplesFor, type OtlpTarget, type Sample } from "../telemetry";

const NOW = Date.parse("2026-11-24T12:00:05.000Z");
const ID = "00000000-0000-4000-8000-000000000001";
const SECRET = "glc_S3cr3tT0ken";

function report(edit: (f: DatabaseFacts) => void = () => {}, api: Snapshot["api"] = { state: "ok" }): Report {
  const facts = emptyFacts();
  edit(facts);
  return evaluate({ observedAt: "2026-11-24T12:00:00.000Z", target: "production", api, database: { state: "ok", facts } });
}
const failed = (api: Snapshot["api"]): Report =>
  evaluate({ observedAt: "2026-11-24T12:00:04.000Z", target: "production", api, database: { state: "failed", failure: "db_unreachable" } });
const series = (s: Sample) => `${s.name}${JSON.stringify(Object.entries(s.labels).sort())}`;
const value = (samples: Sample[], name: string, labels: Record<string, string> = {}) =>
  samples.find((s) => s.name === name && JSON.stringify(s.labels) === JSON.stringify(labels))?.value;

const DB_CODES = RULES.filter((r) => r.source === "database").map((r) => r.code);

describe("samplesFor", () => {
  test("a healthy snapshot publishes fixed zeros for every database rule and subcount", () => {
    const samples = samplesFor(report(), NOW);
    for (const code of DB_CODES) expect(value(samples, "cosmic_save_alert_count", { code })).toBe(0);
    for (const kind of ["malformed", "orphan", "owner_mismatch"]) expect(value(samples, "cosmic_save_queue_invalid_messages", { kind })).toBe(0);
    expect(samples.filter((s) => s.name === "cosmic_save_terminal_failed")).toHaveLength(8);
    expect(value(samples, "cosmic_save_monitor_observer_up")).toBe(1);
    expect(value(samples, "cosmic_save_api_up")).toBe(1);
    expect(value(samples, "cosmic_save_monitor_heartbeat_timestamp_seconds")).toBe(NOW / 1000);
    expect(value(samples, "cosmic_save_monitor_snapshot_timestamp_seconds")).toBe(Date.parse("2026-11-24T12:00:00.000Z") / 1000);
  });

  test("an alert and its recovery use the same series, so the recovery zero clears it", () => {
    const firing = samplesFor(report((f) => (f.processing.overdue = { count: 2, oldestAgeSeconds: 2500, sampleIds: [ID] })), NOW);
    const recovered = samplesFor(report(), NOW);
    expect(value(firing, "cosmic_save_alert_count", { code: "processing_overdue" })).toBe(2);
    expect(value(recovered, "cosmic_save_alert_count", { code: "processing_overdue" })).toBe(0);
    expect(firing.map(series).sort()).toEqual(recovered.map(series).sort());
  });

  test("a failed database observation publishes heartbeat, observer 0 and only the API state it observed", () => {
    const withApi = samplesFor(failed({ state: "failed", failure: "http_503" }), NOW);
    expect(withApi.map((s) => [s.name, s.value])).toEqual([
      ["cosmic_save_monitor_heartbeat_timestamp_seconds", NOW / 1000],
      ["cosmic_save_monitor_observer_up", 0],
      ["cosmic_save_api_up", 0],
    ]);
    const unobserved = samplesFor(failed({ state: "not_observed" }), NOW);
    expect(unobserved.map((s) => s.name)).toEqual(["cosmic_save_monitor_heartbeat_timestamp_seconds", "cosmic_save_monitor_observer_up"]);
  });

  test("an API failure with a healthy database keeps the business zeros", () => {
    const samples = samplesFor(report(() => {}, { state: "failed", failure: "timeout" }), NOW);
    expect(value(samples, "cosmic_save_api_up")).toBe(0);
    expect(value(samples, "cosmic_save_monitor_observer_up")).toBe(1);
    expect(value(samples, "cosmic_save_alert_count", { code: "processing_overdue" })).toBe(0);
  });

  test("cardinality stays under 50 fixed series with no ids or free text in labels", () => {
    const busy = report((f) => {
      f.queue.visible = 3;
      f.queue.oldestVisibleWaitSeconds = 900;
      f.queue.backlog = { count: 3, oldestAgeSeconds: 900, sampleIds: ["17", "18", "19"] };
      f.processing = { total: 1, oldestJourneyAgeSeconds: 2500, withoutOwner: { count: 1, oldestAgeSeconds: 200, sampleIds: [ID] }, overdue: { count: 1, oldestAgeSeconds: 2500, sampleIds: [ID] } };
      f.terminal.failedByCode.provider = { count: 1, oldestAgeSeconds: 30, sampleIds: [ID] };
      f.completion = { latestAgeSeconds: 30, timedCount: 1, p50Seconds: 40, p95Seconds: 40, maxSeconds: 40 };
    });
    const all = new Set([busy, report(), failed({ state: "ok" }), failed({ state: "not_observed" })].flatMap((r) => samplesFor(r, NOW).map(series)));
    expect(all.size).toBeLessThan(50);
    const allowed: Record<string, RegExp> = {
      code: /^(queue_visible_backlog|processing_without_owner|processing_overdue|queue_invalid_messages|infrastructure_failures|provider|unavailable|unclassified|paywall|auth|blocked|empty|unsupported)$/,
      state: /^(visible|delayed|leased_or_backoff)$/,
      kind: /^(malformed|orphan|owner_mismatch)$/,
      status: /^(processing|completed|failed|idle)$/,
      class: /^(infrastructure|source)$/,
      quantile: /^(0\.5|0\.95)$/,
    };
    for (const s of samplesFor(busy, NOW)) {
      expect(Object.keys(s.labels).sort()).toEqual([...METRICS[s.name].labels].sort());
      for (const [k, v] of Object.entries(s.labels)) expect(v).toMatch(allowed[k]!);
    }
    expect(JSON.stringify(samplesFor(busy, NOW))).not.toContain(ID);
  });

  test("absent completion timing is omitted rather than reported as zero", () => {
    const names = samplesFor(report(), NOW).map((s) => s.name);
    expect(names).not.toContain("cosmic_save_completion_latest_age_seconds");
    expect(names).not.toContain("cosmic_save_completion_created_to_completed_seconds");
  });
});

describe("otlpPayload", () => {
  test("encodes unitless gauges with fixed resource and point attributes", () => {
    const body = otlpPayload(samplesFor(report(), NOW), "production", NOW);
    const resource = body.resourceMetrics[0]!;
    expect(resource.resource.attributes).toEqual([{ key: "service.name", value: { stringValue: "cosmic-save-monitor" } }]);
    const metrics = resource.scopeMetrics[0]!.metrics;
    for (const metric of metrics) {
      expect(Object.keys(metric).sort()).toEqual(["description", "gauge", "name"]);
      for (const point of metric.gauge.dataPoints) {
        expect(point.timeUnixNano).toBe("1795521605000000000");
        expect(point.attributes.slice(0, 2)).toEqual([
          { key: "environment", value: { stringValue: "production" } },
          { key: "journey", value: { stringValue: "save_bookmark" } },
        ]);
      }
    }
    expect(new Set(metrics.map((m) => m.name)).size).toBe(metrics.length);
  });
});

describe("resolveOtlpTarget", () => {
  const cloud = { GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp", GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: SECRET };
  const local = { ...cloud, GRAFANA_OTLP_ENDPOINT: "http://127.0.0.1:32770/otlp" };

  test("Grafana Cloud publishes as production with Basic auth", () => {
    const resolved = resolveOtlpTarget(cloud, "production");
    expect(resolved).toEqual({
      ok: true,
      target: { url: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp/v1/metrics", authorization: `Basic ${btoa(`123456:${SECRET}`)}`, environment: "production" },
    });
    expect(resolveOtlpTarget(cloud, "unresolved")).toMatchObject({ ok: true, target: { environment: "production" } });
  });

  test("a loopback receiver is only for local and fixture runs", () => {
    expect(resolveOtlpTarget(local, "local")).toMatchObject({ ok: true, target: { environment: "local", url: "http://127.0.0.1:32770/otlp/v1/metrics" } });
    expect(resolveOtlpTarget(local, "fixture")).toMatchObject({ ok: true, target: { environment: "fixture" } });
  });

  const rejected: Array<[string, Record<string, string | undefined>, Parameters<typeof resolveOtlpTarget>[1], string]> = [
    ["no endpoint", { ...cloud, GRAFANA_OTLP_ENDPOINT: undefined }, "production", "endpoint_missing"],
    ["a non-Grafana host", { ...cloud, GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod.grafana.net.evil.test/otlp" }, "production", "endpoint_invalid"],
    ["plain http to Grafana", { ...cloud, GRAFANA_OTLP_ENDPOINT: "http://otlp-gateway-prod-us-east-0.grafana.net/otlp" }, "production", "endpoint_invalid"],
    ["an explicit port", { ...cloud, GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net:8443/otlp" }, "production", "endpoint_invalid"],
    ["the full metrics path", { ...cloud, GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp/v1/metrics" }, "production", "endpoint_invalid"],
    ["a query string", { ...cloud, GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp?x=1" }, "production", "endpoint_invalid"],
    ["credentials in the URL", { ...cloud, GRAFANA_OTLP_ENDPOINT: "https://a:b@otlp-gateway-prod-us-east-0.grafana.net/otlp" }, "production", "endpoint_invalid"],
    ["a remote http receiver", { ...cloud, GRAFANA_OTLP_ENDPOINT: "http://10.0.0.5:4318/otlp" }, "local", "endpoint_invalid"],
    ["fixture data to Grafana Cloud", cloud, "fixture", "environment_mismatch"],
    ["local data to Grafana Cloud", cloud, "local", "environment_mismatch"],
    ["production data to a local receiver", local, "production", "environment_mismatch"],
    ["no token", { ...cloud, GRAFANA_OTLP_TOKEN: undefined }, "production", "credentials_missing"],
    ["a non-numeric instance id", { ...cloud, GRAFANA_OTLP_INSTANCE_ID: "abc" }, "production", "credentials_invalid"],
    ["a token with whitespace", { ...cloud, GRAFANA_OTLP_TOKEN: "glc_a b" }, "production", "credentials_invalid"],
  ];
  for (const [name, env, target, reason] of rejected) {
    test(`rejects ${name}`, () => expect(resolveOtlpTarget(env, target)).toEqual({ ok: false, reason: reason as never }));
  }
});

describe("deliver against a real HTTP receiver", () => {
  type Handler = (req: Request) => Response | Promise<Response>;
  let handler: Handler = () => Response.json({});
  let seen: { path: string; auth: string | null; type: string | null; body: string }[] = [];
  let server: ReturnType<typeof Bun.serve>;
  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: async (req) => {
        seen.push({ path: new URL(req.url).pathname, auth: req.headers.get("authorization"), type: req.headers.get("content-type"), body: await req.text() });
        return handler(req);
      },
    });
  });
  afterAll(() => server.stop(true));

  const target = (): OtlpTarget => ({ url: `http://127.0.0.1:${server.port}/otlp/v1/metrics`, authorization: `Basic ${btoa(`1:${SECRET}`)}`, environment: "local" });
  const send = async (h: Handler) => {
    handler = h;
    seen = [];
    return deliver(samplesFor(report(), NOW), target(), fetch, NOW);
  };

  test("a 200 OTLP response is delivered once with JSON and Basic auth", async () => {
    expect(await send(() => Response.json({}))).toEqual({ ok: true, series: samplesFor(report(), NOW).length });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ path: "/otlp/v1/metrics", auth: `Basic ${btoa(`1:${SECRET}`)}`, type: "application/json" });
    expect(JSON.parse(seen[0]!.body).resourceMetrics).toHaveLength(1);
    expect(await send(() => Response.json({ partialSuccess: {} }))).toMatchObject({ ok: true });
    expect(await send(() => Response.json({ partialSuccess: { rejectedDataPoints: "0" } }))).toMatchObject({ ok: true });
  });

  const failures: Array<[string, Handler, string]> = [
    ["partial success with rejected points (int64 string)", () => Response.json({ partialSuccess: { rejectedDataPoints: "2", errorMessage: SECRET } }), "partial_rejected"],
    ["partial success with rejected points (number)", () => Response.json({ partialSuccess: { rejectedDataPoints: 1 } }), "partial_rejected"],
    ["a malformed partial success", () => Response.json({ partialSuccess: { rejectedDataPoints: "-1" } }), "malformed_response"],
    ["an empty success body", () => new Response("", { status: 200 }), "malformed_response"],
    ["a non-JSON success body", () => new Response(`ok ${SECRET}`, { status: 200 }), "malformed_response"],
    ["an oversized success body", () => Response.json({ pad: "x".repeat(20_000) }), "malformed_response"],
    ["a server error with private text", () => new Response(`invalid token ${SECRET}`, { status: 500 }), "http_500"],
    ["an auth rejection", () => new Response("unauthorized", { status: 401 }), "http_401"],
    ["a redirect", () => Response.redirect("https://elsewhere.test/collect", 307), "unreachable"],
  ];
  for (const [name, h, failure] of failures) {
    test(`${name} fails delivery without remote text`, async () => {
      const result = await send(h);
      expect(result).toEqual({ ok: false, failure: failure as never });
      expect(JSON.stringify(result)).not.toContain(SECRET);
      expect(seen).toHaveLength(1);
    });
  }

  test("timeouts and refused connections are fixed codes", async () => {
    const timeout = (async () => { throw new DOMException("t", "TimeoutError"); }) as HttpFetch;
    expect(await deliver([], target(), timeout, NOW)).toEqual({ ok: false, failure: "timeout" });
    expect(await deliver([], { ...target(), url: "http://127.0.0.1:1/otlp/v1/metrics" }, fetch, NOW)).toEqual({ ok: false, failure: "unreachable" });
  });
});
