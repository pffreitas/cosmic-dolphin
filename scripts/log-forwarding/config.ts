import { createHash, timingSafeEqual } from "node:crypto";

export const SOURCES = ["api", "worker", "web", "save-monitor"] as const;
export const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
export const NATIVE_BODY_PARSER_LIMIT_BYTES = MAX_REQUEST_BYTES + 1;
export type Source = (typeof SOURCES)[number];
export type Environment = "production" | "local";
export type Env = Readonly<Record<string, string | undefined>>;

export interface Limits {
  requestBytes: number;
  records: number;
  lineBytes: number;
  concurrentRequests: number;
  requestTimeoutMs: number;
  upstreamTimeoutMs: number;
  heartbeatIntervalMs: number;
  responseBytes: number;
}

export interface Config {
  port: number;
  environment: Environment;
  upstreamUrl: string;
  authorization: string;
  sourceKeys: readonly { source: Source; digest: Buffer }[];
  redactionSecrets: readonly string[];
  limits: Limits;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const digest = (key: string) => createHash("sha256").update(key).digest();
const invalid = (): never => { throw new Error("log_bridge_config_invalid"); };

function integer(env: Env, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) return invalid();
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : invalid();
}

export function loadConfig(env: Env): Config {
  const environment = env.LOG_BRIDGE_ENVIRONMENT ?? "production";
  if (environment !== "production" && environment !== "local") return invalid();
  let endpoint: URL;
  try { endpoint = new URL(env.GRAFANA_OTLP_ENDPOINT ?? ""); } catch { return invalid(); }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/otlp" ||
      env.GRAFANA_OTLP_ENDPOINT !== `${endpoint.origin}/otlp`) return invalid();
  const cloud = endpoint.protocol === "https:" && endpoint.port === "" && /^otlp-gateway-[a-z0-9-]+\.grafana\.net$/.test(endpoint.hostname);
  const local = endpoint.protocol === "http:" && /^\d+$/.test(endpoint.port) && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
  if (environment === "production" ? !cloud : !local || env.LOG_ALLOW_LOCAL_FIXTURE !== "true") return invalid();
  const id = env.GRAFANA_OTLP_INSTANCE_ID;
  const token = env.GRAFANA_OTLP_TOKEN;
  if (!id || !/^\d{1,12}$/.test(id) || !token || !/^[\x21-\x7e]{1,4096}$/.test(token)) return invalid();
  let keys: unknown;
  try { keys = JSON.parse(env.LOG_SOURCE_KEYS_JSON ?? ""); } catch { return invalid(); }
  if (!isRecord(keys) || !Object.keys(keys).length) return invalid();
  const sourceKeys: Config["sourceKeys"][number][] = [];
  const seen = new Set<string>();
  for (const [source, key] of Object.entries(keys)) {
    if (!SOURCES.includes(source as Source) || typeof key !== "string" || !/^[\x21-\x7e]{32,256}$/.test(key) || seen.has(key)) return invalid();
    seen.add(key);
    sourceKeys.push({ source: source as Source, digest: digest(key) });
  }
  const authorization = `Basic ${Buffer.from(`${id}:${token}`).toString("base64")}`;
  return {
    port: integer(env, "PORT", 8080, environment === "local" ? 0 : 1, 65535),
    environment,
    upstreamUrl: `${endpoint.origin}/otlp/v1/logs`,
    authorization,
    sourceKeys,
    redactionSecrets: [...seen, token, authorization, authorization.slice(6)],
    limits: {
      requestBytes: integer(env, "LOG_MAX_REQUEST_BYTES", MAX_REQUEST_BYTES, 1, MAX_REQUEST_BYTES),
      records: integer(env, "LOG_MAX_RECORDS", 1000, 1, 1000),
      lineBytes: integer(env, "LOG_MAX_LINE_BYTES", 65_536, 1, 131_072),
      concurrentRequests: integer(env, "LOG_MAX_CONCURRENT_REQUESTS", 4, 1, 4),
      requestTimeoutMs: integer(env, "LOG_REQUEST_TIMEOUT_MS", 10_000, 1, 30_000),
      upstreamTimeoutMs: integer(env, "LOG_UPSTREAM_TIMEOUT_MS", 10_000, 1, 30_000),
      heartbeatIntervalMs: integer(env, "LOG_HEARTBEAT_INTERVAL_MS", 60_000, 1000, 3_600_000),
      responseBytes: 16_384,
    },
  };
}

export function authenticate(keys: readonly string[], config: Config): Source | null {
  if (!keys.length || keys.some((key) => key.length > 256)) return null;
  let owner: Source | null = null;
  for (const candidate of config.sourceKeys) {
    let matches = true;
    for (const key of keys) matches = timingSafeEqual(digest(key), candidate.digest) && matches;
    if (matches) owner = candidate.source;
  }
  return owner;
}
