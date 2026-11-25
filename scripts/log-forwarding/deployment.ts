#!/usr/bin/env bun
import { closeSync, constants, fchmodSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { isRecord, loadConfig, type Env } from "./config";

export const APP_NAME = "cosmic-log-bridge";
const COMPONENT_NAME = "log-bridge";
const REPOSITORY = "https://github.com/pffreitas/cosmic-dolphin.git";
const DOCKERFILE = "scripts/log-forwarding/Dockerfile";
const FOREIGN_COMPONENTS = ["workers", "jobs", "static_sites", "functions", "databases", "domains"];
const APP_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;
const fail = (code: string): never => { throw new Error(code); };

function branchName(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value) || value.includes("..") || value.includes("//") || value.endsWith("/")
    || value.split("/").some((part) => part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock"))) return fail("deployment_branch_invalid");
  return value;
}

export function deploymentConfig(env: Env): Env & { PORT: string; LOG_BRIDGE_ENVIRONMENT: string; LOG_BRIDGE_BRANCH: string } {
  if (env.PORT !== undefined && env.PORT !== "8080" || env.LOG_BRIDGE_ENVIRONMENT !== undefined && env.LOG_BRIDGE_ENVIRONMENT !== "production") return fail("deployment_config_invalid");
  try { loadConfig({ ...env, PORT: "8080", LOG_BRIDGE_ENVIRONMENT: "production" }); }
  catch { return fail("deployment_config_invalid"); }
  return { ...env, PORT: "8080", LOG_BRIDGE_ENVIRONMENT: "production", LOG_BRIDGE_BRANCH: branchName(env.LOG_BRIDGE_BRANCH ?? "main") };
}

function ownsSource(service: Record<string, unknown>): boolean {
  return service.name === COMPONENT_NAME && service.source_dir === "/" && service.dockerfile_path === DOCKERFILE
    && isRecord(service.git) && service.git.repo_clone_url === REPOSITORY && typeof service.git.branch === "string"
    && !service.github && !service.gitlab && !service.image;
}

function ownedService(spec: unknown): Record<string, unknown> | null {
  if (!isRecord(spec) || spec.name !== APP_NAME || !Array.isArray(spec.services) || spec.services.length !== 1
    || FOREIGN_COMPONENTS.some((key) => spec[key] !== undefined && (!Array.isArray(spec[key]) || (spec[key] as unknown[]).length > 0))) return null;
  const service = spec.services[0];
  if (!isRecord(service) || !ownsSource(service)) return null;
  try { branchName((service.git as Record<string, string>).branch); } catch { return null; }
  return service;
}

function validateSpec(spec: unknown, env: ReturnType<typeof deploymentConfig>): asserts spec is Record<string, unknown> {
  const service = ownedService(spec);
  if (!isRecord(spec) || !service || Object.keys(spec).some((key) => !["name", "region", "ingress", "services"].includes(key))
    || spec.region !== "nyc" || Object.keys(service).some((key) => !["name", "git", "source_dir", "dockerfile_path", "http_port", "instance_count", "instance_size_slug", "health_check", "envs"].includes(key))
    || !isRecord(service.git) || Object.keys(service.git).some((key) => !["repo_clone_url", "branch"].includes(key)) || service.git.branch !== env.LOG_BRIDGE_BRANCH
    || service.http_port !== 8080 || service.instance_count !== 1 || service.instance_size_slug !== "apps-s-1vcpu-0.5gb"
    || JSON.stringify(service.health_check) !== JSON.stringify({ http_path: "/health" })
    || JSON.stringify(spec.ingress) !== JSON.stringify({ rules: [{ component: { name: COMPONENT_NAME }, match: { path: { prefix: "/" } } }] })) return fail("deployment_template_invalid");
  const expected = ["PORT", "LOG_BRIDGE_ENVIRONMENT", "GRAFANA_OTLP_ENDPOINT", "GRAFANA_OTLP_INSTANCE_ID", "GRAFANA_OTLP_TOKEN", "LOG_SOURCE_KEYS_JSON"];
  if (!Array.isArray(service.envs) || service.envs.length !== expected.length || service.envs.some((entry, index) => !isRecord(entry)
    || entry.key !== expected[index] || entry.scope !== "RUN_TIME" || entry.value !== env[expected[index]]
    || entry.type !== (["GRAFANA_OTLP_TOKEN", "LOG_SOURCE_KEYS_JSON"].includes(expected[index]) ? "SECRET" : "GENERAL")
    || Object.keys(entry).some((key) => !["key", "scope", "type", "value"].includes(key)))) return fail("deployment_template_invalid");
}

/** Substitute whole scalar values, never interpolate secrets into YAML or shell. */
export function renderSpec(template: string, input: Env): Record<string, unknown> {
  const env = deploymentConfig(input);
  let parsed: unknown;
  try { parsed = Bun.YAML.parse(template); } catch { return fail("deployment_template_invalid"); }
  const substitute = (value: unknown): unknown => {
    if (typeof value === "string") {
      const match = /^\$\{([A-Z_]+)\}$/.exec(value);
      if (!match) { if (value.includes("${")) return fail("deployment_template_invalid"); return value; }
      const resolved = env[match[1]];
      if (!resolved) return fail("deployment_value_missing");
      return resolved;
    }
    if (Array.isArray(value)) return value.map(substitute);
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, substitute(entry)]));
    return value;
  };
  const spec = substitute(parsed);
  validateSpec(spec, env);
  return spec;
}

/** Only returns a request receipt. ACTIVE/source-commit/forwarding need independent proof. */
export async function deploySpec(spec: Record<string, unknown>, input: Env, fetchImpl: HttpFetch = fetch, timeoutMs = 30_000) {
  const env = deploymentConfig(input);
  validateSpec(spec, env);
  const token = env.DIGITALOCEAN_ACCESS_TOKEN;
  if (!token || !/^[\x21-\x7e]{1,4096}$/.test(token)) return fail("deployment_token_invalid");
  const id = env.LOG_BRIDGE_DO_APP_ID;
  if (id && !APP_ID.test(id)) return fail("deployment_app_id_invalid");
  if (id && env.LOG_BRIDGE_DO_CREATE === "true") return fail("deployment_selection_conflict");
  if (!id && env.LOG_BRIDGE_DO_CREATE !== "true") return fail("deployment_create_not_selected");
  async function request(method: "GET" | "POST" | "PUT", path: string, body?: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(new Error("deployment_unreachable"));
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      response = await Promise.race([fetchImpl(`https://api.digitalocean.com/v2/apps${path}`, {
        method, redirect: "error", signal: controller.signal,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }), aborted]);
      if (!response.ok) return fail(`deployment_http_${response.status}`);
      if (Number(response.headers.get("content-length")) > 1_000_000) return fail("deployment_response_too_large");
      const chunks: Uint8Array[] = [];
      let size = 0;
      reader = response.body?.getReader();
      if (reader) while (true) {
        const { done, value } = await Promise.race([reader.read(), aborted]);
        if (done) break;
        size += value.byteLength;
        if (size > 1_000_000) return fail("deployment_response_too_large");
        chunks.push(value);
      }
      let result: unknown;
      try { result = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return fail("deployment_response_invalid"); }
      if (!isRecord(result) || !isRecord(result.app)) return fail("deployment_response_invalid");
      return result.app;
    } catch (error) {
      const code = error instanceof Error && /^deployment_(?:http_[1-5][0-9]{2}|response_invalid|response_too_large|unreachable)$/.test(error.message) ? error.message : "deployment_unreachable";
      return fail(code);
    } finally {
      clearTimeout(timeout);
      if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      else await response?.body?.cancel().catch(() => {});
    }
  }
  if (id) {
    const current = await request("GET", `/${id}`);
    if (current.id !== id || !ownedService(current.spec)) return fail("deployment_app_conflict");
  }
  const app = await request(id ? "PUT" : "POST", id ? `/${id}` : "", { spec, ...(id ? { update_all_source_versions: true } : {}) });
  if (typeof app.id !== "string" || !APP_ID.test(app.id) || id && app.id !== id) return fail("deployment_response_invalid");
  return { deployment: "requested", appId: app.id, branch: env.LOG_BRIDGE_BRANCH, activation: "verify deployed source commit, activation, and native forwarding" };
}

if (import.meta.main) {
  try {
    const [mode, output, ...extra] = process.argv.slice(2);
    if (!["--check-config", "--render", "--deploy"].includes(mode) || (mode === "--render") !== Boolean(output) || extra.length) fail("deployment_usage_invalid");
    const spec = renderSpec(readFileSync(".do/log-forwarding-app.yml", "utf8"), process.env);
    if (mode === "--render") {
      const fd = openSync(output!, constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { fchmodSync(fd, 0o600); writeFileSync(fd, `${JSON.stringify(spec, null, 2)}\n`); } finally { closeSync(fd); }
    } else if (mode === "--deploy") console.log(JSON.stringify(await deploySpec(spec, process.env)));
    else console.log('{"deployment_config":"ok"}');
  } catch (error) {
    const reason = error instanceof Error && /^deployment_[a-z0-9_]+$/.test(error.message) ? error.message : "deployment_failed";
    console.error(JSON.stringify({ result: "failed", reason })); process.exitCode = 2;
  }
}
