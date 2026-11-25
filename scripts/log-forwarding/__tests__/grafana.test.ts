import { expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  applyAssets, assetConfig, bridgeScope, DEFAULTS, encodeAssets, generateAssets, heartbeatQuery, main,
  MAX_LINES, OWNED, provisioningTarget, SERVICE_NAMES, SOURCE_REGEX, type Assets, type HttpFetch,
} from "../grafana";

const config = assetConfig({ GRAFANA_LOKI_DATASOURCE_UID: "fictional-loki", GRAFANA_RECEIVER: "Fictional existing receiver", LOG_BRIDGE_ENVIRONMENT: "local" });
const assets = generateAssets(config);
const target = { origin: "http://127.0.0.1:32768", authorization: "Bearer FICTIONAL_NOT_A_CREDENTIAL" };
const rulePath = `/apis/rules.alerting.grafana.app/v1beta1/namespaces/${config.namespace}/alertrules`;
type Call = { method: string; path: string; body: any };
function clone(): Assets { return JSON.parse(encodeAssets(assets)); }

function fixture(existing: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const fetchImpl: HttpFetch = async (url, init) => {
    const path = new URL(url).pathname;
    expect(new URL(url).origin).toBe(target.origin);
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("authorization")).toBe(target.authorization);
    calls.push({ method: init!.method!, path, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (init!.method !== "GET") return Response.json({ ok: true });
    if (Object.hasOwn(existing, path)) return Response.json(existing[path]);
    if (path.endsWith("/receivers")) return Response.json({ items: [{ spec: { title: config.receiver } }] });
    if (path.includes("/datasources/")) return Response.json({ type: "loki", uid: config.datasourceUid });
    return Response.json({}, { status: 404 });
  };
  return { calls, fetchImpl };
}

function existingOwned() {
  return {
    [`/api/folders/${OWNED.folder}`]: assets.folder,
    [`/api/dashboards/uid/${OWNED.dashboard}`]: { meta: { folderUid: OWNED.folder }, dashboard: { ...assets.dashboard, id: 7, version: 12 } },
    [`${rulePath}/${OWNED.rule}`]: { ...assets.rules[0], metadata: { ...assets.rules[0].metadata, resourceVersion: "27" } },
  };
}

test("generation is deterministic and checked-in placeholder assets match default generation", () => {
  expect(encodeAssets(assets)).toBe(encodeAssets(generateAssets(config)));
  expect(readFileSync(new URL("../../../docs/monitoring/digitalocean-logs/grafana/assets.v1.json", import.meta.url), "utf8"))
    .toBe(encodeAssets(generateAssets(DEFAULTS)));
  expect(assets.folder).toEqual({ uid: "cosmic-production-logs", title: "Cosmic production logs" });
  expect(assets.dashboard.uid).toBe(OWNED.dashboard);
  expect(assets.dashboard.tags).toEqual([OWNED.tag]);
  expect(assets.dashboard.panels).toHaveLength(12);
  expect(assets.dashboard.panels.every((p) => ["text", "logs", "timeseries", "stat"].includes(String(p.type)))).toBe(true);
  expect(assets.dashboard.panels[0].options).toHaveProperty("mode", "markdown");
  expect(assets.dashboard.links).toContainEqual({ title: "Save-journey alerts and metrics", url: "/d/cosmic-save-bookmarks", type: "link" });
});

test("all LogQL targets have fixed environment and bounded service selectors without indexed private identifiers", () => {
  expect(SERVICE_NAMES).toEqual(["cosmic-dolphin-api", "cosmic-dolphin-worker", "cosmic-dolphin-web", "cosmic-dolphin-save-monitor"]);
  const variable = assets.dashboard.templating.list[0];
  expect(variable.type).toBe("custom");
  expect(variable.query).toBe(SERVICE_NAMES.join(","));
  expect(variable.allValue).toBe(SOURCE_REGEX);
  expect(variable.options.map((v) => v.value)).toEqual(["$__all", ...SERVICE_NAMES]);
  for (const p of assets.dashboard.panels) {
    const targets = p.targets as { expr: string; maxLines?: number; queryType: string }[] | undefined;
    for (const q of targets ?? []) {
      expect(q.expr).toContain('deployment_environment_name="local"');
      const selector = q.expr.match(/\{([^}]*)\}/)?.[1];
      expect(selector).toContain("service_name=");
      expect(selector).not.toContain("${source");
      expect(selector?.match(/service_name=~?"([^"]+)"/)?.[1]).toMatch(new RegExp(`^(?:${SOURCE_REGEX.replaceAll("|", "\\|")}|${SERVICE_NAMES.join("|")}|cosmic-log-bridge)$`));
      expect(selector).not.toMatch(/(?:user|bookmark|request|req)_?id/i);
      expect(q.expr).not.toContain("label_values");
      if (p.type === "logs") { expect(q.maxLines).toBe(MAX_LINES); expect(q.maxLines!).toBeLessThanOrEqual(500); }
    }
  }
  const encoded = encodeAssets(assets);
  expect(encoded).not.toContain("FICTIONAL_NOT_A_CREDENTIAL");
  expect(encoded).not.toContain("grafanacloud-logs");
});

test("dashboard searches severity metadata and worker context and parses the exact heartbeat body fields", () => {
  const panels = assets.dashboard.panels;
  const expr = (id: number) => (panels.find((p) => p.id === id)?.targets as any[])[0].expr as string;
  expect(expr(2)).toBe(`{service_name=~"${SOURCE_REGEX}",deployment_environment_name="local"} | service_name=~"\${source:regex}"`);
  expect(expr(3)).toContain('severity_text=~"(?i)(WARN|WARNING|ERROR|FATAL|CRITICAL)"');
  expect(expr(3)).toContain('detected_level=~"(?i)(WARN|WARNING|ERROR|FATAL|CRITICAL)"');
  expect(expr(4)).toContain('service_name="cosmic-dolphin-worker"');
  expect(expr(4)).toContain("queue|processor|job|retry|attempt|pgmq|embedding");
  expect(expr(5)).toContain('service_name="cosmic-dolphin-api"');
  expect(expr(5)).not.toContain("WARNING");
  expect(expr(6)).toBe(`${bridgeScope(config)} |= "log_bridge_heartbeat"`);
  expect(expr(7)).toContain("rate(");
  expect(expr(7)).toContain("[$__interval]");
  expect(expr(8)).toContain("count_over_time(");
  expect(expr(8)).toContain("[$__range]");
  for (const [i, field] of ["acceptedBatches", "acceptedRecords", "rejectedBatches", "deliveryFailures"].entries()) {
    expect(expr(9 + i)).toContain(`json event="event", ${field}="${field}"`);
    expect(expr(9 + i)).toContain(`| event="log_bridge_heartbeat" | unwrap ${field} | __error__="" [5m]`);
    expect(expr(9 + i)).toContain("last_over_time(");
    expect(expr(9 + i)).not.toContain("vector(0)");
    expect(panels.find((p) => p.id === 9 + i)?.fieldConfig).toHaveProperty("defaults.noValue", "Unknown");
  }
  const notes = String((panels[0].options as any).content);
  for (const explanation of ["every 15m", "every 60s", "not that any native source is connected", "reset on restart", "not counted", "Build/deploy", "Redaction", "charges and retention"]) expect(notes).toContain(explanation);
});

test("one heartbeat alert uses five-minute lookback, zero fallback, pending period and direct existing receiver", () => {
  expect(assets.rules).toHaveLength(1);
  const rule = assets.rules[0];
  expect(rule.metadata.name).toBe("cosmic-logs-heartbeat");
  expect(heartbeatQuery(config)).toBe('sum(count_over_time({service_name="cosmic-log-bridge",deployment_environment_name="local"} |= "log_bridge_heartbeat" [5m])) or vector(0)');
  expect(rule.spec.expressions.A.model.expr).toBe(heartbeatQuery(config));
  expect(rule.spec.expressions.A.datasourceUID).toBe(config.datasourceUid);
  expect(rule.spec.expressions.B.model.conditions[0].evaluator).toEqual({ type: "lt", params: [1] });
  expect(rule.spec.trigger.interval).toBe("1m");
  expect(rule.spec.for).toBe("2m");
  expect(rule.spec.noDataState).toBe("Alerting");
  expect(rule.spec.execErrState).toBe("Error");
  expect(rule.spec.labels).toEqual({ managed_by: OWNED.manager, environment: "local", source: "bridge", service: OWNED.manager, severity: "critical" });
  expect(rule.spec.notificationSettings).toMatchObject({ type: "SimplifiedRouting", receiver: config.receiver, groupWait: "30s", groupInterval: "5m", repeatInterval: "4h" });
  expect(rule.spec.annotations.runbook_url).toBe(`${config.runbookUrl}#missing-bridge-heartbeat`);
});

test("new apply preflights all owned resources before bounded writes without altering sources, contacts or policies", async () => {
  const f = fixture();
  expect(await applyAssets(assets, target, f.fetchImpl)).toEqual({ applied: true, dashboard: OWNED.dashboard, rules: 1 });
  expect(f.calls.slice(0, 5).every((c) => c.method === "GET")).toBe(true);
  expect(f.calls.slice(5).map((c) => `${c.method} ${c.path}`)).toEqual(["POST /api/folders", "POST /api/dashboards/db", `POST ${rulePath}`]);
  expect(f.calls.filter((c) => c.method !== "GET").some((c) => /receivers|routingtrees|contact|datasources/.test(c.path))).toBe(false);
  expect(f.calls[6].body.overwrite).toBe(false);
  expect(f.calls[6].body.folderUid).toBe(OWNED.folder);
});

test("repeat apply uses current resourceVersion and dashboard id/version without force overwrite", async () => {
  const f = fixture(existingOwned());
  await applyAssets(assets, target, f.fetchImpl);
  const writes = f.calls.filter((c) => c.method !== "GET");
  expect(writes).toHaveLength(2);
  expect(writes[0].body.dashboard).toMatchObject({ id: 7, version: 12, uid: OWNED.dashboard });
  expect(writes[0].body.overwrite).toBe(false);
  expect(writes[1].method).toBe("PUT");
  expect(writes[1].path).toBe(`${rulePath}/${OWNED.rule}`);
  expect(writes[1].body.metadata.resourceVersion).toBe("27");
});

test("rules can be staged empty before first live heartbeat, while still checking rule ownership", async () => {
  const staged = clone();
  staged.rules = [];
  const f = fixture();
  expect(await applyAssets(staged, target, f.fetchImpl)).toHaveProperty("rules", 0);
  expect(f.calls.some((c) => c.method === "GET" && c.path === `${rulePath}/${OWNED.rule}`)).toBe(true);
  expect(f.calls.filter((c) => c.method !== "GET").map((c) => c.path)).toEqual(["/api/folders", "/api/dashboards/db"]);
  const foreign = fixture({ [`${rulePath}/${OWNED.rule}`]: {} });
  await expect(applyAssets(staged, target, foreign.fetchImpl)).rejects.toThrow("grafana_rule_conflict");
  expect(foreign.calls.every((c) => c.method === "GET")).toBe(true);
});

for (const [name, mutation] of [
  ["folder UID", (a: any) => { a.folder.uid = "foreign"; }],
  ["folder title", (a: any) => { a.folder.title = "foreign"; }],
  ["dashboard UID", (a: any) => { a.dashboard.uid = "foreign"; }],
  ["dashboard tag", (a: any) => { a.dashboard.tags.push("foreign"); }],
  ["unscoped query", (a: any) => { a.dashboard.panels[1].targets[0].expr = '{service_name=~".+"}'; }],
  ["rule UID", (a: any) => { a.rules[0].metadata.name = "foreign"; }],
  ["rule owner", (a: any) => { a.rules[0].spec.labels.managed_by = "foreign"; }],
  ["extra rule", (a: any) => { a.rules.push(a.rules[0]); }],
] as const) test(`noncanonical ${name} is rejected before networking`, async () => {
  const a = clone(); mutation(a);
  const f = fixture();
  await expect(applyAssets(a, target, f.fetchImpl)).rejects.toThrow("grafana_assets_invalid");
  expect(f.calls).toHaveLength(0);
});

for (const [name, path, value, code] of [
  ["folder", `/api/folders/${OWNED.folder}`, { uid: OWNED.folder, title: "Foreign folder" }, "folder"],
  ["folder UID", `/api/folders/${OWNED.folder}`, { uid: "foreign", title: OWNED.title }, "folder"],
  ["dashboard folder", `/api/dashboards/uid/${OWNED.dashboard}`, { meta: { folderUid: "foreign" }, dashboard: { ...assets.dashboard, id: 1, version: 2 } }, "dashboard"],
  ["dashboard extra tag", `/api/dashboards/uid/${OWNED.dashboard}`, { meta: { folderUid: OWNED.folder }, dashboard: { ...assets.dashboard, tags: [OWNED.tag, "foreign"], id: 1, version: 2 } }, "dashboard"],
  ["dashboard version", `/api/dashboards/uid/${OWNED.dashboard}`, { meta: { folderUid: OWNED.folder }, dashboard: { ...assets.dashboard, id: 1, version: "2" } }, "dashboard"],
  ["rule owner", `${rulePath}/${OWNED.rule}`, { ...assets.rules[0], spec: { ...assets.rules[0].spec, labels: { managed_by: "foreign" } } }, "rule"],
  ["rule resource version", `${rulePath}/${OWNED.rule}`, assets.rules[0], "rule"],
  ["rule folder", `${rulePath}/${OWNED.rule}`, { ...assets.rules[0], metadata: { ...assets.rules[0].metadata, resourceVersion: "2", annotations: { "grafana.app/folder": "foreign" } } }, "rule"],
] as const) test(`foreign existing ${name} blocks every mutation`, async () => {
  const f = fixture({ [path]: value });
  await expect(applyAssets(assets, target, f.fetchImpl)).rejects.toThrow(`grafana_${code}_conflict`);
  expect(f.calls.every((c) => c.method === "GET")).toBe(true);
});

test("missing receiver or non-Loki/wrong UID data source prevents every mutation", async () => {
  for (const overrides of [
    { [`/apis/notifications.alerting.grafana.app/v1beta1/namespaces/${config.namespace}/receivers`]: { items: [{ spec: { title: "Different receiver" } }] } },
    { [`/api/datasources/uid/${config.datasourceUid}`]: { type: "prometheus", uid: config.datasourceUid } },
    { [`/api/datasources/uid/${config.datasourceUid}`]: { type: "loki", uid: "foreign" } },
  ]) {
    const f = fixture(overrides);
    await expect(applyAssets(assets, target, f.fetchImpl)).rejects.toThrow(/grafana_(receiver_missing|datasource_invalid)/);
    expect(f.calls.every((c) => c.method === "GET")).toBe(true);
  }
});

test("Cloud and explicitly local targets reject unsafe origins, credentials, placeholders and crossed environment boundaries", () => {
  const cloudConfig = { ...config, namespace: "stacks-1939091", environment: "production" as const };
  const env = { GRAFANA_URL: "https://fictional.grafana.net", GRAFANA_SERVICE_ACCOUNT_TOKEN: "FICTIONAL" };
  expect(provisioningTarget(env, cloudConfig).origin).toBe(env.GRAFANA_URL);
  expect(provisioningTarget({ ...env, GRAFANA_URL: env.GRAFANA_URL + "/" }, cloudConfig).origin).toBe(env.GRAFANA_URL);
  expect(() => provisioningTarget(env, config)).toThrow("grafana_namespace_invalid");
  expect(() => provisioningTarget(env, { ...cloudConfig, environment: "local" })).toThrow("grafana_namespace_invalid");
  expect(() => provisioningTarget({ ...env, GRAFANA_URL: target.origin }, cloudConfig)).toThrow("grafana_environment_invalid");
  expect(() => provisioningTarget({ ...env, GRAFANA_URL: target.origin }, { ...config, environment: "production" })).toThrow("grafana_environment_invalid");
  expect(provisioningTarget({ ...env, GRAFANA_URL: target.origin }, config).origin).toBe(target.origin);
  for (const url of ["http://fictional.grafana.net", "https://fictional.grafana.net.evil.example", "https://grafana.net", "https://fictional.grafana.net:8443", "https://person:secret@fictional.grafana.net", "https://fictional.grafana.net/api", "https://fictional.grafana.net/?token=secret", "https://fictional.grafana.net/#secret", "http://localhost", "http://192.0.2.1:3000", "file:///etc/passwd"]) {
    expect(() => provisioningTarget({ ...env, GRAFANA_URL: url }, cloudConfig)).toThrow("grafana_url_invalid");
  }
  expect(() => provisioningTarget(env, { ...cloudConfig, datasourceUid: DEFAULTS.datasourceUid })).toThrow("grafana_placeholders");
  expect(() => provisioningTarget(env, { ...cloudConfig, receiver: DEFAULTS.receiver })).toThrow("grafana_placeholders");
  expect(() => provisioningTarget({ ...env, GRAFANA_SERVICE_ACCOUNT_TOKEN: "BAD\nTOKEN" }, cloudConfig)).toThrow("grafana_token_invalid");
});

test("apply validates targets itself so direct callers cannot bypass Cloud/local origin fences", async () => {
  const f = fixture();
  await expect(applyAssets(assets, { ...target, origin: "https://foreign.example" }, f.fetchImpl)).rejects.toThrow("grafana_url_invalid");
  await expect(applyAssets(assets, { ...target, origin: "https://fictional.grafana.net" }, f.fetchImpl)).rejects.toThrow("grafana_namespace_invalid");
  await expect(applyAssets(assets, { ...target, authorization: "Bearer bad\nheader" }, f.fetchImpl)).rejects.toThrow("grafana_token_invalid");
  expect(f.calls).toHaveLength(0);
});

test("config rejects unbounded names, invalid environments and unsafe runbook URLs", () => {
  for (const env of [
    { GRAFANA_NAMESPACE: "stack-123" }, { GRAFANA_LOKI_DATASOURCE_UID: "foreign/path" },
    { GRAFANA_RECEIVER: "receiver\nheader" }, { LOG_BRIDGE_ENVIRONMENT: "fixture" },
    { LOG_RUNBOOK_URL: "http://example.com/runbook" }, { LOG_RUNBOOK_URL: "https://secret:credential@example.com/runbook" },
    { LOG_RUNBOOK_URL: "https://example.com/runbook?key=secret" }, { LOG_RUNBOOK_URL: "https://example.com/runbook#unexpected" },
    { LOG_RUNBOOK_URL: "https://example.com/)[injected](url)" },
  ]) expect(() => assetConfig(env)).toThrow("config_invalid");
});

test("HTTP, network and malformed-body failures never expose remote credentials or raw response text", async () => {
  const secret = "REMOTE_PRIVATE_SECRET";
  for (const [fetchImpl, code] of [
    [async () => new Response(secret, { status: 401 }), "grafana_http_401"],
    [async () => { throw new Error(secret); }, "grafana_unreachable"],
    [async () => new Response(secret), "grafana_response_invalid"],
    [async () => Response.json([secret]), "grafana_response_invalid"],
    [async () => new Response(new Uint8Array([0xff])), "grafana_response_invalid"],
    [async () => new Response("x".repeat(2_000_001)), "grafana_response_invalid"],
    [async () => new Response(new ReadableStream({ pull(controller) { controller.error(new Error(secret)); } })), "grafana_response_invalid"],
  ] as const) {
    try { await applyAssets(assets, target, fetchImpl); throw new Error("Expected rejection"); }
    catch (error) { expect((error as Error).message).toBe(code); expect(String(error)).not.toContain(secret); }
  }
});

test("a stale dashboard version conflict fails without overwrite or rule writes", async () => {
  const f = fixture(existingOwned());
  const fetchImpl: HttpFetch = async (url, init) => {
    if (init?.method === "POST" && new URL(url).pathname === "/api/dashboards/db") {
      expect(JSON.parse(String(init.body)).overwrite).toBe(false);
      return new Response("PRIVATE_REMOTE_BODY", { status: 412 });
    }
    return f.fetchImpl(url, init);
  };
  await expect(applyAssets(assets, target, fetchImpl)).rejects.toThrow("grafana_http_412");
  expect(f.calls.every((c) => c.method === "GET")).toBe(true);
});

test("deadline covers stalled response body without waiting for hostile cancellation", async () => {
  const fetchImpl: HttpFetch = async () => new Response(new ReadableStream({ pull: () => new Promise(() => {}), cancel: () => new Promise(() => {}) }));
  const started = Date.now();
  await expect(applyAssets(assets, target, fetchImpl, 25)).rejects.toThrow("grafana_unreachable");
  expect(Date.now() - started).toBeLessThan(1000);
});

test("CLI failures output fixed reasons without source keys, tokens, private file names or remote bodies", async () => {
  const errors: string[] = [];
  const spy = spyOn(console, "error").mockImplementation((message) => { errors.push(String(message)); });
  try {
    expect(await main(["--apply"], { ...config, GRAFANA_SERVICE_ACCOUNT_TOKEN: "PRIVATE_SECRET" })).toBe(2);
    expect(await main(["--check", "/nonexistent/PRIVATE_SECRET"])).toBe(2);
    expect(await main(["--write"])).toBe(2);
    expect(await main(["--unknown", "PRIVATE_SECRET"])).toBe(2);
    expect(await main(["--check", new URL("../../../docs/monitoring/digitalocean-logs/grafana/assets.v1.json", import.meta.url).pathname], { LOG_BRIDGE_ENVIRONMENT: "local" })).toBe(2);
  } finally { spy.mockRestore(); }
  expect(errors).toEqual([
    '{"result":"failed","reason":"grafana_url_invalid"}', '{"result":"failed","reason":"grafana_failed"}',
    '{"result":"failed","reason":"usage_invalid"}', '{"result":"failed","reason":"usage_invalid"}', '{"result":"failed","reason":"assets_drift"}',
  ]);
  expect(errors.join("")).not.toContain("PRIVATE_SECRET");
});
