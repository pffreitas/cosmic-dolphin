#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { RULES, RUNBOOK, isRecord, parseUrl, readBounded, type Env, type HttpFetch } from "./save-bookmarks";
import { JOURNEY, METRICS, SERVICE_NAME, type Environment, type MetricName } from "./telemetry";

export const OWNED = { folder: "cosmic-save-monitor", title: "Cosmic save monitoring", dashboard: "cosmic-save-bookmarks", tag: "managed-by-cosmic-save-monitor", rulePrefix: "cosmic-save-" } as const;
export const WINDOW = { range: "45m", seconds: 2700, cadenceSeconds: 900 } as const;
export interface AssetConfig { namespace: string; datasourceUid: string; receiver: string; environment: Environment; runbookUrl: string }
export const DEFAULTS: AssetConfig = {
  namespace: "default", datasourceUid: "REPLACE_METRICS_UID", receiver: "REPLACE_EXISTING_RECEIVER", environment: "production",
  runbookUrl: `https://github.com/pffreitas/cosmic-dolphin/blob/main/${RUNBOOK}`,
};

export function assetConfig(env: Env): AssetConfig {
  const config = {
    namespace: env.GRAFANA_NAMESPACE ?? DEFAULTS.namespace,
    datasourceUid: env.GRAFANA_DATASOURCE_UID ?? DEFAULTS.datasourceUid,
    receiver: env.GRAFANA_RECEIVER ?? DEFAULTS.receiver,
    environment: env.MONITOR_METRICS_ENVIRONMENT ?? DEFAULTS.environment,
    runbookUrl: env.MONITOR_RUNBOOK_URL ?? DEFAULTS.runbookUrl,
  };
  if (!/^(default|org-[1-9]\d*|stacks-[1-9]\d*)$/.test(config.namespace) || !/^[A-Za-z0-9_-]{1,40}$/.test(config.datasourceUid)
    || !/^[\x20-\x7e]{1,200}$/.test(config.receiver) || !["production", "local", "fixture"].includes(config.environment)) throw new Error("config_invalid");
  const url = parseUrl(config.runbookUrl);
  if (!url || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("config_invalid");
  return config as AssetConfig;
}

const scope = (config: AssetConfig) => `environment="${config.environment}",journey="${JOURNEY}"`;
export function latest(name: MetricName, config: AssetConfig, extra = ""): string {
  return `last_over_time(${name}{${scope(config)}${extra ? `,${extra}` : ""}}[${WINDOW.range}])`;
}
export function ruleQuery(code: string, config: AssetConfig): string {
  const observer = `sum(${latest("cosmic_save_monitor_observer_up", config)})`;
  if (code === "missing_observer") {
    const heartbeat = latest("cosmic_save_monitor_heartbeat_timestamp_seconds", config);
    return `sum(absent_over_time(cosmic_save_monitor_heartbeat_timestamp_seconds{${scope(config)}}[${WINDOW.range}])) or (time() - max(${heartbeat}) > bool ${WINDOW.seconds})`;
  }
  const rule = RULES.find((r) => r.code === code);
  if (!rule) throw new Error("rule_unknown");
  if (rule.source === "observer") return `1 - ${observer}`;
  if (rule.source === "api") return `1 - sum(${latest("cosmic_save_api_up", config)})`;
  const value = latest("cosmic_save_alert_count", config, `code="${rule.code}"`);
  const up = latest("cosmic_save_monitor_observer_up", config);
  return `sum(${value} * on(environment,journey) group_left() ${up}) or (${observer} == 0)`;
}

export function generateAssets(config: AssetConfig) {
  const entries = [...RULES.map((r) => ({ code: r.code, summary: r.summary, next: r.next, severity: r.severity })), {
    code: "missing_observer", summary: "Save monitor has not delivered for 45 minutes", next: "Check the scheduled job and Grafana ingestion. Save health is unknown.", severity: "critical",
  }];
  const rules = entries.map((r) => ({
    apiVersion: "rules.alerting.grafana.app/v1beta1", kind: "AlertRule",
    metadata: { name: `${OWNED.rulePrefix}${r.code.replaceAll("_", "-")}`, namespace: config.namespace, annotations: { "grafana.app/folder": OWNED.folder, "grafana.com/provenance": "api" } },
    spec: {
      title: r.summary, trigger: { interval: "1m" }, for: "1m", noDataState: "Alerting", execErrState: "Error",
      labels: { managed_by: SERVICE_NAME, service: "cosmic-dolphin", environment: config.environment, journey: JOURNEY, severity: r.severity, code: r.code },
      annotations: { summary: r.summary, description: r.next, runbook_url: `${config.runbookUrl}#${r.code.replaceAll("_", "-")}`, __dashboardUid__: OWNED.dashboard, __panelId__: r.code === "missing_observer" ? "3" : RULES.find((rule) => rule.code === r.code)?.source === "database" ? "5" : "2" },
      notificationSettings: { type: "SimplifiedRouting", receiver: config.receiver, groupBy: ["grafana_folder", "alertname", "environment"], groupWait: "30s", groupInterval: "5m", repeatInterval: "4h" },
      expressions: {
        A: { datasourceUID: config.datasourceUid, relativeTimeRange: { from: WINDOW.range, to: "0s" }, model: { expr: ruleQuery(r.code, config), instant: true, refId: "A" } },
        B: { source: true, model: { type: "threshold", expression: "A", refId: "B", conditions: [{ evaluator: { type: "gt", params: [0] } }] } },
      },
    },
  }));
  const panels: Record<string, unknown>[] = [{
    id: 1, type: "text", title: "Scope and timing", gridPos: { x: 0, y: 0, w: 24, h: 4 },
    options: { mode: "markdown", content: `Server-accepted saves only. Client-only captures and rejected attempts are unseen. API health does not prove save acceptance. Collector every 15m; values use a 45m lookback. Terminal failures cover 60m. Completion timing includes idle deferral and reprocessing. [Runbook](${config.runbookUrl}).` },
  }];
  const panel = (title: string, description: string, expr: string | string[], legend: string, unit: string, type = "timeseries") => {
    const id = panels.length + 1;
    panels.push({ id, type, title, description, gridPos: { x: ((id - 2) % 2) * 12, y: 4 + Math.floor((id - 2) / 2) * 8, w: 12, h: 8 },
      datasource: { type: "prometheus", uid: config.datasourceUid }, targets: (Array.isArray(expr) ? expr : [expr]).map((query, index) => ({ refId: String.fromCharCode(65 + index), expr: query, legendFormat: legend, range: true })),
      fieldConfig: { defaults: { unit }, overrides: [] }, options: { legend: { displayMode: "table", placement: "bottom" }, tooltip: { mode: "multi" } },
    });
  };
  panel("Observer and API health", METRICS.cosmic_save_monitor_observer_up.help, [latest("cosmic_save_monitor_observer_up", config), latest("cosmic_save_api_up", config)], "{{__name__}}", "none");
  panel("Time since delivered heartbeat", "Missing or older than 45m alerts. Fresh observer failure still delivers a heartbeat.", `time() - ${latest("cosmic_save_monitor_heartbeat_timestamp_seconds", config)}`, "Heartbeat age", "s");
  for (const name of Object.keys(METRICS) as MetricName[]) {
    if (["cosmic_save_monitor_heartbeat_timestamp_seconds", "cosmic_save_monitor_observer_up", "cosmic_save_api_up"].includes(name)) continue;
    const unit = name.endsWith("seconds") ? (name.includes("timestamp") ? "dateTimeAsIso" : "s") : "short";
    const business = name !== "cosmic_save_monitor_snapshot_timestamp_seconds";
    const expr = business ? `${latest(name, config)} and on(environment,journey) (${latest("cosmic_save_monitor_observer_up", config)} == 1)` : latest(name, config);
    panel(METRICS[name].help, METRICS[name].help, expr, METRICS[name].labels.map((l) => `{{${l}}}`).join(" ") || name, unit);
  }
  return {
    schemaVersion: 1, config, folder: { uid: OWNED.folder, title: OWNED.title },
    dashboard: { uid: OWNED.dashboard, title: "Save-bookmark monitoring", tags: [OWNED.tag], schemaVersion: 39, version: 0, timezone: "utc", editable: false, refresh: "1m", time: { from: "now-6h", to: "now" }, links: [{ title: "Runbook", url: config.runbookUrl, type: "link" }], panels },
    rules,
  };
}
export type Assets = ReturnType<typeof generateAssets>;
export const encodeAssets = (assets: Assets) => `${JSON.stringify(assets, null, 2)}\n`;

export function provisioningTarget(env: Env, config: AssetConfig) {
  const url = parseUrl(env.GRAFANA_URL ?? "");
  const cloud = url?.protocol === "https:" && !url.port && /^[a-z0-9-]+\.grafana\.net$/.test(url.hostname);
  const local = url?.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && /^\d+$/.test(url.port);
  if (!url || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !(cloud || local)) throw new Error("grafana_url_invalid");
  if (cloud && (!config.namespace.startsWith("stacks-") || config.environment !== "production")) throw new Error("grafana_namespace_invalid");
  if (local && (config.namespace.startsWith("stacks-") || config.environment === "production")) throw new Error("grafana_environment_invalid");
  if (config.datasourceUid === DEFAULTS.datasourceUid || config.receiver === DEFAULTS.receiver) throw new Error("grafana_placeholders");
  const token = env.GRAFANA_SERVICE_ACCOUNT_TOKEN;
  if (!token || !/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error("grafana_token_invalid");
  return { origin: url.origin, authorization: `Bearer ${token}` };
}
export interface GrafanaTarget { origin: string; authorization: string }

export async function applyAssets(assets: Assets, target: GrafanaTarget, fetchImpl: HttpFetch = fetch) {
  async function request(method: string, path: string, body?: unknown, missing = false): Promise<Record<string, unknown> | null> {
    let response: Response;
    try { response = await fetchImpl(target.origin + path, { method, redirect: "error", signal: AbortSignal.timeout(10000), headers: { authorization: target.authorization, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error("grafana_unreachable"); }
    try {
      if (missing && response.status === 404) return null;
      if (!response.ok) throw new Error(`grafana_http_${response.status}`);
      const text = await readBounded(response, 2_000_000);
      const result: unknown = text === null ? null : JSON.parse(text);
      if (!isRecord(result)) throw new Error("grafana_response_invalid");
      return result;
    } finally { await response.body?.cancel().catch(() => {}); }
  }
  const path = `/apis/rules.alerting.grafana.app/v1beta1/namespaces/${assets.config.namespace}/alertrules`;
  const receivers = await request("GET", `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/${assets.config.namespace}/receivers`);
  if (!Array.isArray(receivers?.items) || !receivers.items.some((r: unknown) => isRecord(r) && isRecord(r.spec) && r.spec.title === assets.config.receiver)) throw new Error("grafana_receiver_missing");
  const ds = await request("GET", `/api/datasources/uid/${assets.config.datasourceUid}`);
  if (ds?.type !== "prometheus") throw new Error("grafana_datasource_invalid");
  const folder = await request("GET", `/api/folders/${OWNED.folder}`, undefined, true);
  if (folder && folder.title !== OWNED.title) throw new Error("grafana_folder_conflict");
  const dashboard = await request("GET", `/api/dashboards/uid/${OWNED.dashboard}`, undefined, true);
  let dashboardVersion: { id: number; version: number } | undefined;
  if (dashboard) {
    const meta = dashboard.meta, content = dashboard.dashboard;
    if (!isRecord(meta) || meta.folderUid !== OWNED.folder || !isRecord(content) || !Array.isArray(content.tags) || !content.tags.includes(OWNED.tag)
      || typeof content.id !== "number" || typeof content.version !== "number") throw new Error("grafana_dashboard_conflict");
    dashboardVersion = { id: content.id, version: content.version };
  }
  const versions: (string | null)[] = [];
  for (const rule of assets.rules) {
    const current = await request("GET", `${path}/${rule.metadata.name}`, undefined, true);
    if (!current) { versions.push(null); continue; }
    const meta = current.metadata, spec = current.spec;
    if (!isRecord(meta) || !isRecord(meta.annotations) || meta.annotations["grafana.app/folder"] !== OWNED.folder
      || !isRecord(spec) || !isRecord(spec.labels) || spec.labels.managed_by !== SERVICE_NAME
      || typeof meta.resourceVersion !== "string") throw new Error("grafana_rule_conflict");
    versions.push(meta.resourceVersion);
  }
  if (!folder) await request("POST", "/api/folders", assets.folder);
  await request("POST", "/api/dashboards/db", { dashboard: { ...assets.dashboard, ...dashboardVersion }, folderUid: OWNED.folder, overwrite: false, message: "Generated save monitoring assets v1" });
  for (const [i, rule] of assets.rules.entries()) {
    const version = versions[i];
    await request(version ? "PUT" : "POST", version ? `${path}/${rule.metadata.name}` : path, { ...rule, metadata: { ...rule.metadata, ...(version ? { resourceVersion: version } : {}) } });
  }
  return { applied: true, dashboard: OWNED.dashboard, rules: assets.rules.length };
}

export async function main(argv: string[], env: Env = process.env): Promise<number> {
  try {
    if (argv.length > 2 || !["--dry-run", "--write", "--check", "--apply"].includes(argv[0] ?? "--dry-run") || (argv.length === 2) !== ["--write", "--check"].includes(argv[0])) throw new Error("usage_invalid");
    const config = assetConfig(env);
    const assets = generateAssets(config);
    const text = encodeAssets(assets);
    if (argv[0] === "--apply") console.log(JSON.stringify(await applyAssets(assets, provisioningTarget(env, config))));
    else if (argv[0] === "--write") writeFileSync(argv[1], text, { mode: 0o600 });
    else if (argv[0] === "--check") { if (readFileSync(argv[1], "utf8") !== text) throw new Error("assets_drift"); console.log('{"assets":"match"}'); }
    else process.stdout.write(text);
    return 0;
  } catch (error) {
    const code = error instanceof Error && /^(config_invalid|usage_invalid|assets_drift|grafana_[a-z0-9_]+)$/.test(error.message) ? error.message : "grafana_failed";
    console.error(JSON.stringify({ result: "failed", reason: code }));
    return 2;
  }
}
if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
