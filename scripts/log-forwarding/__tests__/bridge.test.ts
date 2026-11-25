import { afterEach, describe, expect, test } from "bun:test";
import { createBridge } from "../bridge";
import { loadConfig, type Env } from "../config";

const KEY = "fixture-api-source-key-000000000000000000000000";
const WORKER_KEY = "fixture-worker-source-key-000000000000000000000";
const TOKEN = "fixture-grafana-token-private-000000000000000000";
const NOW = 1_795_613_400_123;
const servers: Bun.Server<undefined>[] = [];
const children: Bun.Subprocess[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) { child.kill("SIGKILL"); await child.exited; }
  for (const server of servers.splice(0)) await server.stop(true);
});

type Capture = { path: string; authorization: string | null; body: any };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(options: { env?: Env; upstream?: (request: Request) => Response | Promise<Response> } = {}) {
  const captured: Capture[] = [];
  const upstream = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    captured.push({ path: new URL(request.url).pathname, authorization: request.headers.get("authorization"), body: await request.json() });
    return options.upstream ? options.upstream(request) : Response.json({});
  } });
  servers.push(upstream);
  const config = loadConfig({
    LOG_BRIDGE_ENVIRONMENT: "local", LOG_ALLOW_LOCAL_FIXTURE: "true",
    GRAFANA_OTLP_ENDPOINT: `http://127.0.0.1:${upstream.port}/otlp`,
    GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: TOKEN,
    LOG_SOURCE_KEYS_JSON: JSON.stringify({ api: KEY, worker: WORKER_KEY }),
    ...options.env,
  });
  const bridge = createBridge(config, { now: () => NOW });
  const receiver = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: bridge.handle });
  servers.push(receiver);
  const url = `http://127.0.0.1:${receiver.port}`;
  const post = (payload: unknown = { message: "ordinary line" }, init: RequestInit = {}, path = "/api/v2/logs") => fetch(url + path, {
    method: "POST", headers: { "content-type": "application/json", "DD-API-KEY": KEY }, body: JSON.stringify(payload), ...init,
  });
  return { config, bridge, receiver, upstream, url, post, captured };
}

const record = (capture: Capture, index = 0) => capture.body.resourceLogs[0].scopeLogs[0].logRecords[index];
const labels = (capture: Capture) => Object.fromEntries(capture.body.resourceLogs[0].resource.attributes.map((a: any) => [a.key, a.value.stringValue]));

describe("authenticated real HTTP intake", () => {
  test("every supported source uses its authenticated fixed service label", async () => {
    const keys = Object.fromEntries(["api", "worker", "web", "save-monitor"].map((source) => [source, `fixture-${source}-key-${"0".repeat(40)}`]));
    const f = fixture({ env: { LOG_SOURCE_KEYS_JSON: JSON.stringify(keys) } });
    for (const [source, key] of Object.entries(keys)) {
      expect((await f.post({ message: "runtime", service: "spoofed" }, { headers: { "content-type": "application/json", "DD-API-KEY": key } })).status).toBe(202);
      expect(labels(f.captured.at(-1)!)["service.name"]).toBe(`cosmic-dolphin-${source}`);
    }
  });
  test("rejects missing, wrong and conflicting credentials without reflecting them", async () => {
    const f = fixture();
    for (const [headers, path] of [
      [{ "content-type": "application/json" }, "/api/v2/logs"],
      [{ "content-type": "application/json", "DD-API-KEY": "private-invalid-key" }, "/api/v2/logs"],
      [{ "content-type": "application/json", "DD-API-KEY": KEY }, `/v1/input/${WORKER_KEY}`],
      [{ "content-type": "application/json", "DD-API-KEY": KEY }, `/api/v2/logs?api_key=${WORKER_KEY}`],
    ] as const) {
      const result = await f.post(undefined, { headers }, path);
      expect(result.status).toBe(401);
      expect(await result.text()).toBe('{"error":"unauthorized"}');
    }
    expect(f.captured).toHaveLength(0);
  });

  test("v2 batches, v1 single-event/path and legacy query map identity from key", async () => {
    const f = fixture();
    const first = await f.post([{ message: "first", service: "spoof", ddtags: "user_id:private" }, { message: "second" }], {
      headers: { "content-type": "APPLICATION/JSON; charset=UTF-8", "dD-aPi-KeY": WORKER_KEY },
    });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ accepted: 2 });
    expect(labels(f.captured[0])).toEqual({
      "service.name": "cosmic-dolphin-worker", "deployment.environment.name": "local",
      "cloud.provider": "digitalocean", "cloud.platform": "digitalocean_app_platform",
    });
    expect(record(f.captured[0]).attributes).toBeUndefined();
    const legacy = await f.post({ message: "legacy" }, { headers: { "content-type": "application/json" } }, `/v1/input/${KEY}`);
    expect(legacy.status).toBe(202);
    const query = await f.post({ message: "query" }, { headers: { "content-type": "application/json" } }, `/v1/input?api_key=${KEY}`);
    expect(query.status).toBe(202);
    const spelling = await f.post({ message: "query spelling" }, { headers: { "content-type": "application/json" } }, `/api/v2/logs?dd-api-key=${KEY}`);
    expect(spelling.status).toBe(202);
    for (const capture of f.captured) {
      expect(capture.path).toBe("/otlp/v1/logs");
      expect(capture.authorization).toBe(f.config.authorization);
    }
  });

  test("unknown paths/methods, content types, unsupported encodings and malformed JSON fail before upstream", async () => {
    const f = fixture();
    expect((await fetch(f.url + "/api/v2/logs")).status).toBe(405);
    expect((await f.post(undefined, {}, "/unknown")).status).toBe(404);
    expect((await f.post(undefined, { headers: { "DD-API-KEY": KEY, "content-type": "text/plain" } })).status).toBe(415);
    expect((await f.post(undefined, { headers: { "DD-API-KEY": KEY, "content-type": "application/json", "content-encoding": "br" } })).status).toBe(415);
    const json = await f.post(undefined, { body: '{"message": "private-json-error"' });
    expect(json.status).toBe(400);
    expect(await json.text()).toBe('{"error":"invalid_json"}');
    for (const payload of [[], null, 2, "private", {}, [{ message: "valid" }, { message: 123 }]]) {
      const result = await f.post(payload);
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({ error: "invalid_batch" });
    }
    const invalidUtf8 = await f.post(undefined, { body: new Uint8Array([0xc3, 0x28]) });
    expect(invalidUtf8.status).toBe(400);
    expect(f.captured).toHaveLength(0);
  });

  test("custom endpoint root accepts authenticated plain and gzip batches", async () => {
    const f = fixture();
    expect((await f.post({ message: "native root" }, {}, "/")).status).toBe(202);
    const bytes = Bun.gzipSync(JSON.stringify([{ message: "compressed café" }]));
    const result = await f.post(undefined, { body: bytes, headers: { "DD-API-KEY": KEY, "content-type": "application/json", "content-encoding": "gzip" } }, "/");
    expect(result.status).toBe(202);
    expect(record(f.captured[1]).body.stringValue).toBe("compressed café");
    expect(labels(f.captured[1])["service.name"]).toBe("cosmic-dolphin-api");
  });

  test("gzip wire and expanded byte limits reject before publishing and allow recovery", async () => {
    const f = fixture({ env: { LOG_MAX_REQUEST_BYTES: "100", LOG_MAX_LINE_BYTES: "1000" } });
    const headers = { "DD-API-KEY": KEY, "content-type": "application/json", "content-encoding": "gzip" };
    const expanded = Bun.gzipSync(JSON.stringify({ message: "é".repeat(1000) }));
    const tooExpanded = await f.post(undefined, { body: expanded, headers });
    expect(tooExpanded.status).toBe(413);
    expect(await tooExpanded.json()).toEqual({ error: "payload_too_large" });
    const wire = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(101)); controller.close(); } });
    const tooLargeWire = await f.post(undefined, { body: wire, headers, keepalive: false });
    expect(tooLargeWire.status).toBe(413);
    expect(await tooLargeWire.json()).toEqual({ error: "payload_too_large" });
    expect(f.captured).toHaveLength(0);
    expect((await f.post(undefined, { body: Bun.gzipSync(JSON.stringify({ message: "recovered" })), headers })).status).toBe(202);
  });

  test("gzip errors remain fixed and auth precedes decompression", async () => {
    const f = fixture();
    const headers = { "DD-API-KEY": KEY, "content-type": "application/json", "content-encoding": "gzip" };
    const bad = await f.post(undefined, { body: new Uint8Array([1, 2, 3]), headers });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid_json" });
    const denied = await f.post(undefined, { body: new Uint8Array([1, 2, 3]), headers: { ...headers, "DD-API-KEY": "wrong-key" } }, "/");
    expect(denied.status).toBe(401);
    expect(f.captured).toHaveLength(0);
  });

  test("heartbeat records bounded rejection metadata without path keys or payload content", async () => {
    const f = fixture();
    const result = await f.post({ message: "private body" }, { headers: { "content-type": "application/json", "content-encoding": KEY } }, `/v1/input/${KEY}`);
    expect(result.status).toBe(415);
    expect(await f.bridge.heartbeat()).toEqual({ ok: true });
    const text = record(f.captured[0]).body.stringValue;
    expect(JSON.parse(text).lastRejection).toEqual({ status: 415, reason: "invalid_content_encoding", route: "/v1/input", encoding: "other", source: "api" });
    expect(JSON.parse(text).rejectedBatches).toBe(1);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("private body");
  });
});

describe("bounds across the HTTP boundary", () => {
  test("default Datadog wire bounds allow a 1000-event batch larger than 1MiB", async () => {
    const f = fixture();
    expect(f.config.limits.requestBytes).toBe(5_242_880);
    expect(f.config.limits.records).toBe(1000);
    expect(f.config.limits.concurrentRequests).toBe(4);
    const result = await f.post(Array.from({ length: 1000 }, () => ({ message: "a".repeat(2048) })));
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({ accepted: 1000 });
    expect(f.captured[0].body.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(1000);
  });
  test("counts full UTF-8 request bytes including streamed bodies", async () => {
    const f = fixture({ env: { LOG_MAX_REQUEST_BYTES: "80", LOG_MAX_LINE_BYTES: "1000" } });
    expect((await f.post({ message: "x".repeat(40) })).status).toBe(202);
    const multibyte = await f.post({ message: "é".repeat(40) });
    expect(multibyte.status).toBe(413);
    expect(await multibyte.json()).toEqual({ error: "payload_too_large" });
    const streamed = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"message":"'));
      controller.enqueue(new TextEncoder().encode("a".repeat(100)));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    } });
    expect((await f.post(undefined, { body: streamed })).status).toBe(413);
    expect(f.captured).toHaveLength(1);
  });

  test("caps batch count and entire serialized UTF-8 record/context bytes", async () => {
    const f = fixture({ env: { LOG_MAX_RECORDS: "2", LOG_MAX_LINE_BYTES: "80" } });
    expect((await f.post([{ message: "one" }, { message: "two" }])).status).toBe(202);
    expect((await f.post([{ message: "one" }, { message: "two" }, { message: "three" }])).status).toBe(413);
    expect((await f.post({ message: "é".repeat(40) })).status).toBe(413);
    expect((await f.post({ message: "small", stack: "x".repeat(100) })).status).toBe(413);
    expect(f.captured).toHaveLength(1);
  });

  test("rejects overload immediately, health stays process-only, slot releases after ACK", async () => {
    const started = deferred<void>();
    const release = deferred<Response>();
    let calls = 0;
    const f = fixture({ env: { LOG_MAX_CONCURRENT_REQUESTS: "1" }, upstream: async () => {
      if (++calls === 1) { started.resolve(); return release.promise; }
      return Response.json({});
    } });
    const first = f.post();
    await started.promise;
    const overloaded = await f.post({ message: "not queued" });
    expect(overloaded.status).toBe(503);
    expect(overloaded.headers.get("retry-after")).toBe("1");
    expect(await overloaded.json()).toEqual({ error: "overloaded" });
    expect(await (await fetch(f.url + "/health")).json()).toEqual({ status: "process_up" });
    expect(f.captured).toHaveLength(1);
    release.resolve(Response.json({}));
    expect((await first).status).toBe(202);
    expect((await f.post()).status).toBe(202);
  });

  test("stalled incoming stream has a deadline and releases its concurrency slot", async () => {
    const f = fixture({ env: { LOG_REQUEST_TIMEOUT_MS: "30", LOG_MAX_CONCURRENT_REQUESTS: "1" } });
    const stalled = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{"message":"')); } });
    const upload = new AbortController();
    const result = await f.post(undefined, { body: stalled, signal: upload.signal, keepalive: false });
    expect(result.status).toBe(408);
    expect(await result.json()).toEqual({ error: "request_timeout" });
    expect(result.headers.get("connection")).toBe("close");
    upload.abort();
    const recovered = await f.post(undefined, { keepalive: false });
    expect(await recovered.text()).toBe('{"accepted":1}');
    expect(recovered.status).toBe(202);
  });
});

describe("normalized records", () => {
  test("opaque bookmark/request IDs survive only in body; private fields and free-form ID values redact", async () => {
    const f = fixture();
    const bookmarkId = "67c057b4-fc97-4b4b-87f7-bc347c4c1be8";
    const requestId = "a14e8b12db097e86c544f2324f6d8ad9";
    const result = await f.post([
      { message: JSON.stringify({ msg: "queue failed", bookmarkId, requestId, reqId: "req-1c", userId: "private-user-id", content: "private-content", title: "private-title", auth: { key: "private-auth-key" } }) },
      { message: "queue context", bookmark_id: bookmarkId, request_id: requestId, req_id: "req-2" },
      { message: JSON.stringify({ msg: "invalid IDs", bookmarkId: "private title with spaces", requestId: "someone@example.com", reqId: "https://private.example/path" }) },
    ]);
    expect(result.status).toBe(202);
    const capture = f.captured[0];
    for (let i = 0; i < 2; i++) {
      expect(record(capture, i).body.stringValue).toContain(bookmarkId);
      expect(record(capture, i).body.stringValue).toContain(requestId);
      expect(record(capture, i).attributes).toBeUndefined();
    }
    const output = JSON.stringify(capture.body);
    for (const value of ["private-user-id", "private-content", "private-title", "private-auth-key", "private title with spaces", "someone@example.com", "private.example"]) expect(output).not.toContain(value);
    expect(JSON.stringify(capture.body.resourceLogs[0].resource)).not.toContain(bookmarkId);
    expect(JSON.stringify(capture.body.resourceLogs[0].resource)).not.toContain(requestId);
    expect(Object.keys(labels(capture))).toHaveLength(4);
  });
  test("preserves timestamps and structured/Pino/Nest severity; fallback uses receive time", async () => {
    const f = fixture();
    const iso = "2026-11-25T10:00:00.456Z";
    expect((await f.post([
      { message: "WARN queue delayed", timestamp: iso, status: "error" },
      { message: JSON.stringify({ level: 50, time: 1_795_608_000_789, msg: "processing failed", err: { name: "Error", message: "safe failure", stack: "Error: safe failure\n at /app/worker.ts:42:7" } }) },
      { message: "\u001b[31m[Nest] 23 - 11/25/2026, 10:00:00 AM WARN [Queue] retry\u001b[0m", timestamp: 1_795_608_000 },
      { message: "plain message", timestamp: "invalid date" },
      { message: "DEBUG tick", timestamp: "1795608000123000000" },
    ])).status).toBe(202);
    const records = f.captured[0].body.resourceLogs[0].scopeLogs[0].logRecords;
    expect(records.map((r: any) => r.severityText)).toEqual(["ERROR", "ERROR", "WARN", "INFO", "DEBUG"]);
    expect(records.map((r: any) => r.severityNumber)).toEqual([17, 17, 13, 9, 5]);
    expect(records[0].timeUnixNano).toBe((BigInt(Date.parse(iso)) * 1_000_000n).toString());
    expect(records[1].timeUnixNano).toBe("1795608000789000000");
    expect(records[2].timeUnixNano).toBe("1795608000000000000");
    expect(records[3].timeUnixNano).toBe((BigInt(NOW) * 1_000_000n).toString());
    expect(records[4].timeUnixNano).toBe("1795608000123000000");
    expect(records[1].body.stringValue).toContain("/app/worker.ts:42:7");
    expect(JSON.stringify(records)).not.toContain("\u001b");
  });

  test("redacts structured private fields and common plaintext secrets, preserving safe queue/stack context", async () => {
    const f = fixture();
    const embedded = {
      level: 50, msg: `queue failed ${KEY} ${TOKEN}`, queue: "bookmarks", attempt: 3,
      authorization: "private-authorization", cookies: "private-cookie", password: "private-password",
      api_key: "private-api-key", token: "private-token", connectionString: "private-connection",
      request: { body: { text: "private-body" }, headers: { value: "private-header" }, requestId: "private-request-id" },
      content: "private-content", title: "private-title", userId: "private-user", email: "private-email", url: "private-url",
      err: { message: "worker failed", stack: "Error: worker failed\n at /app/queue.ts:12:3\n postgres://user:pass@database.invalid/db\n https://private.example/path?token=value\n someone@example.com" },
    };
    const plain = [
      "ERROR upstream Bearer abcdefghijklmnopqrstuvwxyz", "Basic YWxhZGRpbjpvcGVuc2VzYW1l", "redis://user:pass@host.invalid/db",
      "person@example.com", "token=plaintext-token", "password: plaintext-password", "title=private article title",
      'request body: {"private":"private-raw-body"}', `key literal ${WORKER_KEY}`, f.config.authorization,
    ].join("\n");
    expect((await f.post([{ message: JSON.stringify(embedded) }, { message: plain }])).status).toBe(202);
    const output = JSON.stringify(f.captured[0].body);
    for (const value of [KEY, WORKER_KEY, TOKEN, f.config.authorization, "private-authorization", "private-cookie", "private-password", "private-api-key", "private-token", "private-connection", "private-body", "private-header", "private-request-id", "private-content", "private-title", "private-user", "private-email", "private-url", "user:pass", "someone@example.com", "person@example.com", "abcdefghijklmnopqrstuvwxyz", "YWxhZGRpbjpvcGVuc2VzYW1l", "plaintext-token", "plaintext-password", "private article title", "private-raw-body", "private.example"]) expect(output).not.toContain(value);
    expect(output).toContain("bookmarks");
    expect(output).toContain("/app/queue.ts:12:3");
    expect(output).toContain("worker failed");
    expect(output).toContain("[REDACTED");
  });

  test("deep structured context is capped and prototype keys do not alter labels", async () => {
    const f = fixture();
    let nested: unknown = { password: "never-publish" };
    for (let i = 0; i < 20; i++) nested = { nested };
    const payload = JSON.parse('{"message":"safe","__proto__":{"service.name":"spoof"}}');
    payload.message = JSON.stringify({ msg: "safe", nested });
    expect((await f.post(payload)).status).toBe(202);
    expect(JSON.stringify(f.captured[0].body)).not.toContain("never-publish");
    expect(labels(f.captured[0])["service.name"]).toBe("cosmic-dolphin-api");
    expect(record(f.captured[0]).body.stringValue).toContain("[TRUNCATED]");
  });
});

describe("OTLP acknowledgement and failure behavior", () => {
  test("accepts Grafana's verified no-content 204 acknowledgement", async () => {
    const f = fixture({ upstream: () => new Response(null, { status: 204 }) });
    const result = await f.post([{ message: "first" }, { message: "second" }]);
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual({ accepted: 2 });
  });
  test("holds native acknowledgement until upstream accepts all records", async () => {
    const started = deferred<void>();
    const release = deferred<Response>();
    const f = fixture({ upstream: () => { started.resolve(); return release.promise; } });
    let acknowledged = false;
    const pending = f.post([{ message: "one" }, { message: "two" }]).then((value) => { acknowledged = true; return value; });
    await started.promise;
    expect(acknowledged).toBe(false);
    release.resolve(Response.json({ partialSuccess: { rejectedLogRecords: "0" } }));
    expect((await pending).status).toBe(202);
  });

  test("partial rejection, malformed/oversized ACK and HTTP failure return fixed retryable failures", async () => {
    const replies: Response[] = [
      Response.json({ partialSuccess: { rejectedLogRecords: "1", errorMessage: `${KEY} private-upstream-error` } }),
      Response.json({ partialSuccess: { rejectedLogRecords: -1 } }),
      Response.json({ partialSuccess: { rejectedLogRecords: "unknown" } }),
      Response.json({ partialSuccess: "private-upstream-error" }),
      Response.json({ partialSuccess: { rejectedLogRecords: 0, errorMessage: 123 } }),
      new Response(`private upstream text ${KEY}`),
      Response.json({ padding: "x".repeat(20_000) }),
      new Response(`${TOKEN} private-upstream-error`, { status: 401 }),
      new Response(`${KEY} private-upstream-error`, { status: 429 }),
      new Response(`${TOKEN} private-upstream-error`, { status: 500 }),
    ];
    const f = fixture({ upstream: () => replies.shift()! });
    while (replies.length) {
      const result = await f.post();
      expect(result.status).toBe(502);
      expect(await result.text()).toBe('{"error":"delivery_failed"}');
    }
    expect((await fetch(f.url + "/health")).status).toBe(200);
  });

  test("rejects redirects without contacting their destination", async () => {
    let redirected = 0;
    const other = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch() { redirected++; return Response.json({}); } });
    servers.push(other);
    const f = fixture({ upstream: () => new Response(null, { status: 307, headers: { location: `http://127.0.0.1:${other.port}/private?key=${KEY}` } }) });
    const result = await f.post();
    expect(result.status).toBe(502);
    expect(await result.text()).toBe('{"error":"delivery_failed"}');
    expect(redirected).toBe(0);
  });

  test("network and stalled-header/body delivery fail; timeout releases slot for recovery", async () => {
    const f = fixture();
    await f.upstream.stop(true);
    expect((await f.post()).status).toBe(502);
    const release = deferred<Response>();
    let calls = 0;
    const slow = fixture({ env: { LOG_UPSTREAM_TIMEOUT_MS: "30", LOG_MAX_CONCURRENT_REQUESTS: "1" }, upstream: () => {
      if (++calls === 1) return release.promise;
      if (calls === 2) return new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); } }));
      return Response.json({});
    } });
    for (let i = 0; i < 2; i++) {
      const result = await slow.post();
      expect(result.status).toBe(503);
      expect(await result.text()).toBe('{"error":"delivery_timeout"}');
    }
    release.resolve(Response.json({}));
    expect((await slow.post()).status).toBe(202);
  });

  test("direct heartbeat has its own fixed service and bounded counters", async () => {
    const f = fixture();
    expect((await f.post({ message: "runtime" })).status).toBe(202);
    expect(await f.bridge.heartbeat()).toEqual({ ok: true });
    expect(labels(f.captured[1])["service.name"]).toBe("cosmic-log-bridge");
    expect(JSON.parse(record(f.captured[1]).body.stringValue)).toEqual({
      event: "log_bridge_heartbeat", acceptedBatches: 1, acceptedRecords: 1, rejectedBatches: 0, deliveryFailures: 0,
    });
    expect(JSON.stringify(f.captured[1].body)).not.toContain(KEY);
  });
});

describe("configuration fences", () => {
  const env: Env = {
    GRAFANA_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-east-0.grafana.net/otlp",
    GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: TOKEN,
    LOG_SOURCE_KEYS_JSON: JSON.stringify({ api: KEY, worker: WORKER_KEY }),
  };
  test("production gateway is exact; local receiver requires explicit fixture/environment", () => {
    const config = loadConfig(env);
    expect(config.environment).toBe("production");
    expect(config.upstreamUrl).toBe("https://otlp-gateway-prod-us-east-0.grafana.net/otlp/v1/logs");
    for (const endpoint of [
      "http://otlp-gateway-prod-us-east-0.grafana.net/otlp", "https://example.com/otlp",
      "https://otlp-gateway-prod-us-east-0.grafana.net.evil.example/otlp",
      "https://otlp-gateway-prod-us-east-0.grafana.net/otlp?key=private", "https://user:private@otlp-gateway-prod-us-east-0.grafana.net/otlp",
      "https://otlp-gateway-prod-us-east-0.grafana.net/otlp?", "https://@otlp-gateway-prod-us-east-0.grafana.net/otlp",
      "https://otlp-gateway-prod-us-east-0.grafana.net/otlp#private", "https://otlp-gateway-prod-us-east-0.grafana.net:1234/otlp",
      "https://otlp-gateway-prod-us-east-0.grafana.net/otlp/v1/logs", "http://127.0.0.1:1234/otlp",
    ]) expect(() => loadConfig({ ...env, GRAFANA_OTLP_ENDPOINT: endpoint })).toThrow("log_bridge_config_invalid");
    expect(() => loadConfig({ ...env, LOG_BRIDGE_ENVIRONMENT: "local" })).toThrow("log_bridge_config_invalid");
    const local = { ...env, GRAFANA_OTLP_ENDPOINT: "http://127.0.0.1:1234/otlp", LOG_BRIDGE_ENVIRONMENT: "local" };
    expect(() => loadConfig(local)).toThrow("log_bridge_config_invalid");
    expect(loadConfig({ ...local, LOG_ALLOW_LOCAL_FIXTURE: "true" }).environment).toBe("local");
  });
  test("keys are unique, bounded and restricted to known sources; configuration errors are fixed", () => {
    for (const keys of [{}, [], { api: "short" }, { arbitrary: KEY }, { api: KEY, worker: KEY }, { api: "x".repeat(257) }, { api: " " + KEY }, { api: 123 }]) {
      expect(() => loadConfig({ ...env, LOG_SOURCE_KEYS_JSON: JSON.stringify(keys) })).toThrow("log_bridge_config_invalid");
    }
    for (const overrides of [{ GRAFANA_OTLP_TOKEN: "private\ninvalid" }, { GRAFANA_OTLP_INSTANCE_ID: "not-numeric" }, { LOG_MAX_CONCURRENT_REQUESTS: "5" }, { LOG_MAX_REQUEST_BYTES: "5242881" }, { LOG_MAX_RECORDS: "0" }]) expect(() => loadConfig({ ...env, ...overrides })).toThrow("log_bridge_config_invalid");
    expect(loadConfig({ ...env, LOG_SOURCE_KEYS_JSON: JSON.stringify({ api: KEY }) }).sourceKeys).toHaveLength(1);
  });
});

describe("process entrypoint", () => {
  test("invalid configuration exits with a fixed message without leaking secrets", async () => {
    const child = Bun.spawn([process.execPath, "--no-env-file", new URL("../main.ts", import.meta.url).pathname], {
      cwd: new URL("..", import.meta.url).pathname,
      env: { LOG_SOURCE_KEYS_JSON: `private-invalid-config-${KEY}`, GRAFANA_OTLP_TOKEN: TOKEN },
      stdout: "pipe", stderr: "pipe",
    });
    children.push(child);
    expect(await child.exited).toBe(1);
    expect(await new Response(child.stdout).text()).toBe("");
    expect(await new Response(child.stderr).text()).toBe('{"event":"log_bridge_start_failed"}\n');
  });

  test("startup and periodic heartbeat go directly to OTLP; stdout stays fixed", async () => {
    const f = fixture();
    const twoHeartbeats = deferred<void>();
    let seen = 0;
    const observer = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
      const body: any = await request.json();
      expect(body.resourceLogs[0].resource.attributes[0].value.stringValue).toBe("cosmic-log-bridge");
      expect(body.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue).toContain("log_bridge_heartbeat");
      if (++seen >= 2) twoHeartbeats.resolve();
      return new Response(null, { status: 204 });
    } });
    servers.push(observer);
    const child = Bun.spawn([process.execPath, "--no-env-file", new URL("../main.ts", import.meta.url).pathname], {
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        PORT: "0", LOG_BRIDGE_ENVIRONMENT: "local", LOG_ALLOW_LOCAL_FIXTURE: "true",
        GRAFANA_OTLP_ENDPOINT: `http://127.0.0.1:${observer.port}/otlp`,
        GRAFANA_OTLP_INSTANCE_ID: "123456", GRAFANA_OTLP_TOKEN: TOKEN,
        LOG_SOURCE_KEYS_JSON: JSON.stringify({ api: KEY }), LOG_HEARTBEAT_INTERVAL_MS: "1000",
      }, stdout: "pipe", stderr: "pipe",
    });
    children.push(child);
    await twoHeartbeats.promise;
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0);
    expect(await new Response(child.stdout).text()).toBe('{"event":"log_bridge_started"}\n');
    expect(await new Response(child.stderr).text()).toBe("");
    expect(f.captured).toHaveLength(0);
  });
});
