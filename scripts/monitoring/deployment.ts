#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { resolveTarget, isRecord, readBounded, type Env, type HttpFetch } from "./save-bookmarks";
import { resolveOtlpTarget } from "./telemetry";

export const APP_NAME = "cosmic-dolphin-save-monitor";
export function deploymentConfig(env: Env) {
  const db = resolveTarget(env);
  if (!db.ok || db.target.kind !== "production") throw new Error("deployment_database_invalid");
  if (!env.MONITOR_DB_CA_PEM) throw new Error("deployment_ca_required");
  if (!resolveOtlpTarget(env, "production").ok) throw new Error("deployment_ingest_invalid");
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(env.DIGITALOCEAN_REGISTRY_NAME ?? "") || !/^[a-f0-9]{40}$/.test(env.IMAGE_TAG ?? "")) throw new Error("deployment_image_invalid");
}

export function renderSpec(template: string, env: Env): Record<string, unknown> {
  deploymentConfig(env);
  const parsed: unknown = Bun.YAML.parse(template);
  if (!isRecord(parsed) || parsed.name !== APP_NAME || !Array.isArray(parsed.jobs) || parsed.jobs.length !== 1
    || parsed.services || parsed.workers || parsed.static_sites || parsed.functions || parsed.databases || parsed.domains || parsed.ingress || parsed.alerts) throw new Error("deployment_template_invalid");
  const substitute = (value: unknown): unknown => {
    if (typeof value === "string") {
      const match = /^\$\{([A-Z_]+)\}$/.exec(value);
      if (!match) { if (value.includes("${")) throw new Error("deployment_template_invalid"); return value; }
      const resolved = env[match[1]];
      if (!resolved) throw new Error("deployment_value_missing");
      return resolved;
    }
    if (Array.isArray(value)) return value.map(substitute);
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, substitute(v)]));
    return value;
  };
  const spec = substitute(parsed) as Record<string, unknown>;
  const job = Array.isArray(spec.jobs) && isRecord(spec.jobs[0]) ? spec.jobs[0] : null;
  if (!job || !isRecord(job.schedule) || !isRecord(job.image) || !isRecord(job.image.deploy_on_push) || job.name !== "save-bookmark-monitor" || job.kind !== "SCHEDULED" || job.schedule.cron !== "*/15 * * * *"
    || job.image.repository !== APP_NAME || job.image.tag !== env.IMAGE_TAG || job.image.deploy_on_push.enabled !== false) throw new Error("deployment_template_invalid");
  return spec;
}

export async function deploySpec(spec: Record<string, unknown>, env: Env, fetchImpl: HttpFetch = fetch) {
  const token = env.DIGITALOCEAN_ACCESS_TOKEN;
  if (!token || !/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error("deployment_token_invalid");
  const id = env.MONITOR_DO_APP_ID;
  if (id && !/^[a-f0-9-]{36}$/.test(id)) throw new Error("deployment_app_id_invalid");
  if (!id && env.MONITOR_DO_CREATE !== "true") throw new Error("deployment_create_not_selected");
  async function request(method: string, path: string, body?: unknown) {
    let response: Response;
    try { response = await fetchImpl(`https://api.digitalocean.com/v2/apps${path}`, { method, redirect: "error", signal: AbortSignal.timeout(30000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error("deployment_unreachable"); }
    try {
      if (!response.ok) throw new Error(`deployment_http_${response.status}`);
      const text = await readBounded(response, 1_000_000);
      const result: unknown = text ? JSON.parse(text) : null;
      if (!isRecord(result) || !isRecord(result.app)) throw new Error("deployment_response_invalid");
      return result.app;
    } finally { await response.body?.cancel().catch(() => {}); }
  }
  if (id) {
    const app = await request("GET", `/${id}`);
    const current = app.spec;
    if (!isRecord(current) || current.name !== APP_NAME || !Array.isArray(current.jobs) || current.jobs.length !== 1
      || !isRecord(current.jobs[0]) || current.jobs[0].name !== "save-bookmark-monitor"
      || ["services", "workers", "static_sites", "functions", "databases", "domains"].some((key) => Array.isArray(current[key]) && current[key].length > 0)) throw new Error("deployment_app_conflict");
  }
  const app = await request(id ? "PUT" : "POST", id ? `/${id}` : "", { spec });
  if (typeof app.id !== "string" || !/^[a-f0-9-]{36}$/.test(app.id)) throw new Error("deployment_response_invalid");
  return { deployment: "requested", appId: app.id, imageTag: env.IMAGE_TAG, activation: "verify scheduled invocation and Grafana delivery" };
}
if (import.meta.main) {
  try {
    const [mode, output] = process.argv.slice(2);
    if (!["--check-config", "--render", "--deploy"].includes(mode) || (mode === "--render") !== Boolean(output) || process.argv.length > 4) throw new Error("deployment_usage_invalid");
    const spec = renderSpec(readFileSync(".do/monitoring-app.yml", "utf8"), process.env);
    if (mode === "--render") writeFileSync(output, `${JSON.stringify(spec, null, 2)}\n`, { mode: 0o600 });
    else if (mode === "--deploy") console.log(JSON.stringify(await deploySpec(spec, process.env)));
    else console.log('{"deployment_config":"ok"}');
  } catch (error) {
    const reason = error instanceof Error && /^deployment_[a-z0-9_]+$/.test(error.message) ? error.message : "deployment_failed";
    console.error(JSON.stringify({ result: "failed", reason })); process.exitCode = 2;
  }
}
