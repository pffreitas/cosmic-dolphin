#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { isRecord, SOURCES, type Env, type Environment } from "./config";

export const OWNED = {
  folder: "cosmic-production-logs", title: "Cosmic production logs", dashboard: "cosmic-production-logs",
  tag: "managed-by-cosmic-log-bridge", rule: "cosmic-logs-heartbeat", manager: "cosmic-log-bridge",
} as const;
export const MAX_LINES = 500;
export const SERVICE_NAMES = SOURCES.map((source) => `cosmic-dolphin-${source}`);
export const SOURCE_REGEX = SERVICE_NAMES.join("|");
export interface AssetConfig {
  namespace: string; datasourceUid: string; receiver: string; environment: Environment; runbookUrl: string;
}
export const DEFAULTS: AssetConfig = {
  namespace: "default", datasourceUid: "REPLACE_LOKI_UID", receiver: "REPLACE_EXISTING_RECEIVER", environment: "production",
  runbookUrl: "https://github.com/pffreitas/cosmic-dolphin/blob/main/docs/runbooks/digitalocean-logs.md",
};

function parseUrl(value: string): URL | null {
  try { return new URL(value); } catch { return null; }
}

function validateConfig(value: unknown): asserts value is AssetConfig {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "datasourceUid,environment,namespace,receiver,runbookUrl"
    || typeof value.namespace !== "string" || !/^(default|org-[1-9]\d*|stacks-[1-9]\d*)$/.test(value.namespace)
    || typeof value.datasourceUid !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(value.datasourceUid)
    || typeof value.receiver !== "string" || !/^[\x20-\x7e]{1,200}$/.test(value.receiver)
    || typeof value.environment !== "string" || !["production", "local"].includes(value.environment) || typeof value.runbookUrl !== "string") throw new Error("config_invalid");
  const url = parseUrl(value.runbookUrl);
  if (!url || url.protocol !== "https:" || url.username || url.password || url.search || url.hash
    || /[\s<>"'`()\\]/.test(value.runbookUrl)) throw new Error("config_invalid");
}

export function assetConfig(env: Env): AssetConfig {
  const config = {
    namespace: env.GRAFANA_NAMESPACE ?? DEFAULTS.namespace,
    datasourceUid: env.GRAFANA_LOKI_DATASOURCE_UID ?? env.GRAFANA_DATASOURCE_UID ?? DEFAULTS.datasourceUid,
    receiver: env.GRAFANA_RECEIVER ?? DEFAULTS.receiver,
    environment: env.LOG_BRIDGE_ENVIRONMENT ?? DEFAULTS.environment,
    runbookUrl: env.LOG_RUNBOOK_URL ?? DEFAULTS.runbookUrl,
  };
  validateConfig(config);
  return config;
}

export const runtimeScope = (config: AssetConfig, source = "variable") => {
  // Keep the indexed selector fixed even if a dashboard URL overrides the custom variable.
  const matcher = source === "variable" || source === "all"
    ? `service_name=~"${SOURCE_REGEX}"` : SERVICE_NAMES.includes(source) ? `service_name="${source}"` : null;
  if (!matcher) throw new Error("config_invalid");
  return `{${matcher},deployment_environment_name="${config.environment}"}${source === "variable" ? ' | service_name=~"${source:regex}"' : ""}`;
};
export const bridgeScope = (config: AssetConfig) => `{service_name="${OWNED.manager}",deployment_environment_name="${config.environment}"}`;
export const heartbeatQuery = (config: AssetConfig) => `sum(count_over_time(${bridgeScope(config)} |= "log_bridge_heartbeat" [5m])) or vector(0)`;
const severity = (levels: string) => ` | severity_text=~"(?i)(${levels})" or detected_level=~"(?i)(${levels})"`;

export function generateAssets(config: AssetConfig) {
  validateConfig(config);
  const ds = { type: "loki", uid: config.datasourceUid };
  const runtime = runtimeScope(config);
  const bridge = `${bridgeScope(config)} |= "log_bridge_heartbeat"`;
  const panels: Record<string, unknown>[] = [{
    id: 1, type: "text", title: "Scope, safety and interpretation", gridPos: { x: 0, y: 0, w: 24, h: 6 },
    options: { mode: "markdown", content: `Production App Platform runtime logs for API, worker, web and save-monitor. Build/deploy logs, historical backfill and client-only events are outside this forwarding scope. Save-monitor runs every 15m; sparse logs and idle applications are normal. No generic source-silence alert is installed.\n\nIndexed scope is bounded by service and environment. OTLP severity_text and detected_level are searchable metadata. Queue/processor and opaque correlation context stay in redacted log bodies, never indexed user/bookmark/request labels. Redaction removes known credentials and private fields but cannot guarantee arbitrary free-form text is private; avoid logging private content at source.\n\nA bridge heartbeat is sent every 60s directly to OTLP. It proves bridge-to-Grafana reachability, not that any native source is connected. Counter values are process-local, reset on restart and are not a complete audit: rejectedBatches counts authenticated body/normalization rejections; deliveryFailures counts failed source-batch deliveries. Authentication, header, size and overload rejections before body processing and failed heartbeat attempts are not counted. Accepted totals do not establish all-source coverage. Loki storage/ingestion charges and retention apply; consult the stack's current usage and limits.\n\n[Log forwarding runbook](${config.runbookUrl}) · [Save-journey alerts and metrics](/d/cosmic-save-bookmarks).` },
  }];
  function logs(id: number, title: string, description: string, expr: string, x: number, y: number, w = 12) {
    panels.push({ id, type: "logs", title, description, gridPos: { x, y, w, h: 9 }, datasource: ds,
      targets: [{ refId: "A", datasource: ds, expr, queryType: "range", maxLines: MAX_LINES }],
      options: { showTime: true, showLabels: false, showCommonLabels: false, wrapLogMessage: true, prettifyLogMessage: false, enableLogDetails: true, sortOrder: "Descending", dedupStrategy: "none" },
    });
  }
  logs(2, "Runtime logs by source", "Choose a bounded runtime source above. Expand a row for severity metadata and redacted context. At most 500 lines per query.", runtime, 0, 6, 24);
  logs(3, "Errors and warnings", "Severity is searched as metadata after the bounded source/environment selector.", runtime + severity("WARN|WARNING|ERROR|FATAL|CRITICAL"), 0, 15);
  logs(4, "Worker queue and processor context", "Worker runtime lines mentioning queue, processor, job, retry, attempt, pgmq or embedding. This text filter is contextual, not a queue health metric.", `${runtimeScope(config, "cosmic-dolphin-worker")} |~ "(?i)(queue|processor|job|retry|attempt|pgmq|embedding)"`, 12, 15);
  logs(5, "API errors", "API error/fatal metadata, independently scoped from the source selector.", runtimeScope(config, "cosmic-dolphin-api") + severity("ERROR|FATAL|CRITICAL"), 0, 24);
  logs(6, "Bridge heartbeat logs", "Direct OTLP heartbeat every 60s. A heartbeat is not proof that native source forwarding is connected.", bridge, 12, 24);
  panels.push({ id: 7, type: "timeseries", title: "Runtime log rate by source", description: "Observed Loki records per second, not request rate or completeness. Sparse save-monitor logs every 15m are normal.", gridPos: { x: 0, y: 33, w: 12, h: 8 }, datasource: ds,
    targets: [{ refId: "A", datasource: ds, expr: `sum by (service_name) (rate(${runtimeScope(config, "all")} [$__interval]))`, queryType: "range", legendFormat: "{{service_name}}" }],
    fieldConfig: { defaults: { unit: "ops", min: 0 }, overrides: [] }, options: { legend: { displayMode: "table", placement: "bottom" }, tooltip: { mode: "multi" } },
  });
  panels.push({ id: 8, type: "stat", title: "Runtime records in selected range", description: "Count of indexed runtime records in the selected dashboard range by source. Missing records can be normal for idle sources; this is not a delivery guarantee.", gridPos: { x: 12, y: 33, w: 12, h: 8 }, datasource: ds,
    targets: [{ refId: "A", datasource: ds, expr: `sum by (service_name) (count_over_time(${runtimeScope(config, "all")} [$__range]))`, queryType: "instant", legendFormat: "{{service_name}}" }],
    fieldConfig: { defaults: { unit: "short", min: 0 }, overrides: [] }, options: { reduceOptions: { calcs: ["lastNotNull"], values: false }, textMode: "value_and_name", colorMode: "none" },
  });
  for (const [index, field] of ["acceptedBatches", "acceptedRecords", "rejectedBatches", "deliveryFailures"].entries()) {
    panels.push({ id: 9 + index, type: "stat", title: `Bridge ${field}`, description: "Latest heartbeat counter within 5m, summed across streams. Process-local; resets on restart. Missing is unknown, never converted to zero. See scope notes for excluded failures. Not proof of native source coverage.", gridPos: { x: index * 6, y: 41, w: 6, h: 6 }, datasource: ds,
      targets: [{ refId: "A", datasource: ds, expr: `sum(last_over_time(${bridge} | json event="event", ${field}="${field}" | event="log_bridge_heartbeat" | unwrap ${field} | __error__="" [5m]))`, queryType: "instant" }],
      fieldConfig: { defaults: { unit: "short", min: 0, noValue: "Unknown" }, overrides: [] }, options: { reduceOptions: { calcs: ["lastNotNull"], values: false }, colorMode: "none" },
    });
  }
  return {
    schemaVersion: 1, config, folder: { uid: OWNED.folder, title: OWNED.title },
    dashboard: {
      uid: OWNED.dashboard, title: OWNED.title, tags: [OWNED.tag], schemaVersion: 39, version: 0, timezone: "utc", editable: false,
      refresh: "1m", time: { from: "now-6h", to: "now" },
      links: [{ title: "Log forwarding runbook", url: config.runbookUrl, type: "link" }, { title: "Save-journey alerts and metrics", url: "/d/cosmic-save-bookmarks", type: "link" }],
      templating: { list: [{ name: "source", label: "Runtime source", type: "custom", query: SERVICE_NAMES.join(","), multi: true, includeAll: true, allValue: SOURCE_REGEX,
        current: { selected: true, text: "All", value: "$__all" }, options: [{ text: "All", value: "$__all", selected: true }, ...SERVICE_NAMES.map((name) => ({ text: name, value: name, selected: false }))] }] },
      panels,
    },
    rules: [{
      apiVersion: "rules.alerting.grafana.app/v1beta1", kind: "AlertRule",
      metadata: { name: OWNED.rule, namespace: config.namespace, annotations: { "grafana.app/folder": OWNED.folder, "grafana.com/provenance": "api" } },
      spec: {
        title: "Production log bridge heartbeat missing", trigger: { interval: "1m" }, for: "2m", noDataState: "Alerting", execErrState: "Error",
        labels: { managed_by: OWNED.manager, environment: config.environment, source: "bridge", service: OWNED.manager, severity: "critical" },
        annotations: { summary: "Log bridge has not delivered a heartbeat for 5 minutes", description: "Check the bridge deployment and OTLP ingestion. Native source coverage is unknown even when a heartbeat is present.", runbook_url: `${config.runbookUrl}#missing-bridge-heartbeat`, __dashboardUid__: OWNED.dashboard, __panelId__: "6" },
        notificationSettings: { type: "SimplifiedRouting", receiver: config.receiver, groupBy: ["grafana_folder", "alertname", "environment"], groupWait: "30s", groupInterval: "5m", repeatInterval: "4h" },
        expressions: {
          A: { datasourceUID: config.datasourceUid, relativeTimeRange: { from: "5m", to: "0s" }, model: { expr: heartbeatQuery(config), instant: true, queryType: "instant", refId: "A" } },
          B: { source: true, model: { type: "threshold", expression: "A", refId: "B", conditions: [{ evaluator: { type: "lt", params: [1] } }] } },
        },
      },
    }],
  };
}
export type Assets = ReturnType<typeof generateAssets>;
export const encodeAssets = (assets: Assets) => `${JSON.stringify(assets, null, 2)}\n`;
export const stageAssets = (assets: Assets): Assets => ({ ...assets, rules: [] });

function validateAssets(assets: Assets) {
  validateConfig(assets?.config);
  const expected = generateAssets(assets.config);
  const allowedStates = [encodeAssets(expected), encodeAssets(stageAssets(expected))];
  if (!allowedStates.includes(encodeAssets(assets))) throw new Error("grafana_assets_invalid");
}

export interface GrafanaTarget { origin: string; authorization: string }
function validateOrigin(origin: string, config: AssetConfig) {
  const url = parseUrl(origin);
  const cloud = url?.protocol === "https:" && !url.port && /^[a-z0-9-]+\.grafana\.net$/.test(url.hostname);
  const local = url?.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && /^\d+$/.test(url.port);
  if (!url || url.username || url.password || url.search || url.hash || url.pathname !== "/" || origin !== url.origin || !(cloud || local)) throw new Error("grafana_url_invalid");
  if (cloud && (!config.namespace.startsWith("stacks-") || config.environment !== "production")) throw new Error("grafana_namespace_invalid");
  if (local && (config.namespace.startsWith("stacks-") || config.environment !== "local")) throw new Error("grafana_environment_invalid");
}

export function provisioningTarget(env: Env, config: AssetConfig): GrafanaTarget {
  validateConfig(config);
  const origin = env.GRAFANA_URL ?? "";
  const normalized = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  validateOrigin(normalized, config);
  if (config.datasourceUid === DEFAULTS.datasourceUid || config.receiver === DEFAULTS.receiver) throw new Error("grafana_placeholders");
  const token = env.GRAFANA_SERVICE_ACCOUNT_TOKEN;
  if (!token || !/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error("grafana_token_invalid");
  return { origin: normalized, authorization: `Bearer ${token}` };
}

export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

async function readJson(response: Response, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (!response.body) throw new Error("grafana_response_invalid");
  const reader = response.body.getReader();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("grafana_unreachable"));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw new Error("grafana_response_invalid");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let result: unknown;
    try { result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new Error("grafana_response_invalid"); }
    if (!isRecord(result)) throw new Error("grafana_response_invalid");
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "grafana_unreachable") throw error;
    throw new Error("grafana_response_invalid");
  } finally {
    signal.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function applyAssets(assets: Assets, target: GrafanaTarget, fetchImpl: HttpFetch = fetch, timeoutMs = 10_000) {
  validateAssets(assets);
  validateOrigin(target.origin, assets.config);
  if (!/^Bearer [\x21-\x7e]{1,4096}$/.test(target.authorization)) throw new Error("grafana_token_invalid");
  if (assets.config.datasourceUid === DEFAULTS.datasourceUid || assets.config.receiver === DEFAULTS.receiver) throw new Error("grafana_placeholders");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error("config_invalid");
  const path = `/apis/rules.alerting.grafana.app/v1beta1/namespaces/${assets.config.namespace}/alertrules`;
  const receiverPath = `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/${assets.config.namespace}/receivers`;
  const allowed = new Set([
    `GET ${receiverPath}`, `GET /api/datasources/uid/${assets.config.datasourceUid}`, `GET /api/folders/${OWNED.folder}`,
    `GET /api/dashboards/uid/${OWNED.dashboard}`, `GET ${path}/${OWNED.rule}`, "POST /api/folders", "POST /api/dashboards/db", `POST ${path}`, `PUT ${path}/${OWNED.rule}`,
  ]);
  async function request(method: string, requestPath: string, body?: unknown, missing = false): Promise<Record<string, unknown> | null> {
    if (!allowed.has(`${method} ${requestPath}`)) throw new Error("grafana_path_invalid");
    const signal = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(target.origin + requestPath, { method, redirect: "error", signal,
        headers: { authorization: target.authorization, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { throw new Error("grafana_unreachable"); }
    try {
      if (missing && response.status === 404) return null;
      if (!response.ok) throw new Error(`grafana_http_${response.status}`);
      return await readJson(response, signal);
    } finally { void response.body?.cancel().catch(() => {}); }
  }
  const receivers = await request("GET", receiverPath);
  if (!Array.isArray(receivers?.items) || !receivers.items.some((r: unknown) => isRecord(r) && isRecord(r.spec) && r.spec.title === assets.config.receiver)) throw new Error("grafana_receiver_missing");
  const ds = await request("GET", `/api/datasources/uid/${assets.config.datasourceUid}`);
  if (ds?.type !== "loki" || ds.uid !== assets.config.datasourceUid) throw new Error("grafana_datasource_invalid");
  const folder = await request("GET", `/api/folders/${OWNED.folder}`, undefined, true);
  if (folder && (folder.uid !== OWNED.folder || folder.title !== OWNED.title)) throw new Error("grafana_folder_conflict");
  const dashboard = await request("GET", `/api/dashboards/uid/${OWNED.dashboard}`, undefined, true);
  let dashboardVersion: { id: number; version: number } | undefined;
  if (dashboard) {
    const meta = dashboard.meta, content = dashboard.dashboard;
    if (!isRecord(meta) || meta.folderUid !== OWNED.folder || !isRecord(content) || content.uid !== OWNED.dashboard
      || content.title !== OWNED.title || !Array.isArray(content.tags) || content.tags.length !== 1 || content.tags[0] !== OWNED.tag
      || typeof content.id !== "number" || !Number.isSafeInteger(content.id) || content.id < 1
      || typeof content.version !== "number" || !Number.isSafeInteger(content.version) || content.version < 0) throw new Error("grafana_dashboard_conflict");
    dashboardVersion = { id: content.id, version: content.version };
  }
  const current = await request("GET", `${path}/${OWNED.rule}`, undefined, true);
  let resourceVersion: string | undefined;
  if (current) {
    const meta = current.metadata, spec = current.spec;
    if (!isRecord(meta) || meta.name !== OWNED.rule || meta.namespace !== assets.config.namespace
      || !isRecord(meta.annotations) || meta.annotations["grafana.app/folder"] !== OWNED.folder
      || !isRecord(spec) || !isRecord(spec.labels) || spec.labels.managed_by !== OWNED.manager
      || spec.labels.source !== "bridge" || spec.labels.service !== OWNED.manager || spec.labels.environment !== assets.config.environment
      || typeof meta.resourceVersion !== "string" || !/^[\x21-\x7e]{1,200}$/.test(meta.resourceVersion)) throw new Error("grafana_rule_conflict");
    resourceVersion = meta.resourceVersion;
  }
  if (!folder) await request("POST", "/api/folders", assets.folder);
  await request("POST", "/api/dashboards/db", { dashboard: { ...assets.dashboard, ...dashboardVersion }, folderUid: OWNED.folder, overwrite: false, message: "Generated production log assets v1" });
  for (const rule of assets.rules) {
    await request(resourceVersion ? "PUT" : "POST", resourceVersion ? `${path}/${OWNED.rule}` : path,
      { ...rule, metadata: { ...rule.metadata, ...(resourceVersion ? { resourceVersion } : {}) } });
  }
  return { applied: true, dashboard: OWNED.dashboard, rules: assets.rules.length };
}

export async function main(argv: string[], env: Env = process.env): Promise<number> {
  try {
    const command = argv[0] ?? "--dry-run";
    if (argv.length > 2 || !["--dry-run", "--write", "--check", "--apply"].includes(command)
      || (argv.length === 2) !== ["--write", "--check"].includes(command)) throw new Error("usage_invalid");
    const config = assetConfig(env), assets = generateAssets(config), text = encodeAssets(assets);
    if (command === "--apply") console.log(JSON.stringify(await applyAssets(assets, provisioningTarget(env, config))));
    else if (command === "--write") writeFileSync(argv[1], text, { mode: 0o600 });
    else if (command === "--check") {
      if (readFileSync(argv[1], "utf8") !== text) throw new Error("assets_drift");
      console.log('{"assets":"match"}');
    } else process.stdout.write(text);
    return 0;
  } catch (error) {
    const reason = error instanceof Error && /^(config_invalid|usage_invalid|assets_drift|grafana_[a-z0-9_]+)$/.test(error.message) ? error.message : "grafana_failed";
    console.error(JSON.stringify({ result: "failed", reason }));
    return 2;
  }
}
if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
