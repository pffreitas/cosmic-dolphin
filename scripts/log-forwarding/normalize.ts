import { isRecord, type Config, type Source } from "./config";

const encoder = new TextEncoder();
const ANSI = /\u001b(?:\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\[[0-?]*[ -/]*[@-~]|[@-_])/g;
const PRIVATE_KEY = /(?:^auth|cookie|password|passwd|secret|token|apikey|credential|connectionstring|databaseurl|dsn|privatekey|requestbody|responsebody|payload|content|title|user|email|url|uri|session|^key$|^accesskey$|^jwt$|^body$|^headers$|^query$|^params$)/i;
const CORRELATION_ID_KEY = /^(?:bookmarkid|requestid|reqid)$/i;

function opaqueId(value: unknown): boolean {
  return typeof value === "number" ? Number.isSafeInteger(value) && value >= 0 : typeof value === "string" &&
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,128}|req-[a-z0-9]{1,16})$/i.test(value);
}

/** Defense in depth, not a guarantee for arbitrary free-form private text. */
export function redactText(text: string, secrets: readonly string[]): string {
  let value = text.replace(ANSI, "");
  for (const secret of secrets) if (secret) value = value.split(secret).join("[REDACTED]");
  return value
    .replace(/\b(?:authorization|cookie|set-cookie|request[ _-]?body|response[ _-]?body|payload)\s*[=:]\s*[^\r\n]*/gi, "[REDACTED_FIELD]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.-]+/gi, "[REDACTED_AUTH]")
    .replace(/\b(?:[a-z][a-z0-9+.-]*):\/\/[^\s<>"']+/gi, "[REDACTED_URL]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|(?:sk-|glc_)[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:api[ _-]?key|password|passwd|secret|token|credential|connection[ _-]?string|content|title|user(?:[ _-]?id)?|email|url)\s*[=:]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]*)/gi, "[REDACTED_FIELD]");
}

function scrub(value: unknown, secrets: readonly string[], depth = 0): unknown {
  if (typeof value === "string") return redactText(value, secrets);
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (depth >= 6) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => scrub(entry, secrets, depth + 1));
  if (!isRecord(value)) return "[REDACTED]";
  return Object.fromEntries(Object.entries(value).slice(0, 64).map(([key, entry]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
    const privateValue = PRIVATE_KEY.test(normalizedKey) || (CORRELATION_ID_KEY.test(normalizedKey) && !opaqueId(entry));
    return [redactText(key, secrets).slice(0, 128), privateValue ? "[REDACTED]" : scrub(entry, secrets, depth + 1)];
  }));
}

const LEVELS: Readonly<Record<string, [number, string]>> = {
  trace: [1, "TRACE"], verbose: [1, "TRACE"], debug: [5, "DEBUG"], info: [9, "INFO"], log: [9, "INFO"],
  warn: [13, "WARN"], warning: [13, "WARN"], error: [17, "ERROR"], fatal: [21, "FATAL"], critical: [21, "FATAL"],
};

function severity(event: Record<string, unknown>, embedded: Record<string, unknown> | null, message: string): [number, string] {
  for (const field of [event.severity, event.level, event.status, embedded?.severity, embedded?.level, embedded?.status]) {
    if (typeof field === "string" && LEVELS[field.toLowerCase()]) return LEVELS[field.toLowerCase()];
    if (typeof field === "number" && [10, 20, 30, 40, 50, 60].includes(field)) return LEVELS[["trace", "debug", "info", "warn", "error", "fatal"][field / 10 - 1]];
  }
  const nest = message.match(/^\[Nest\]\s+\d+\s+-\s+.*?\s+(LOG|ERROR|WARN|DEBUG|VERBOSE)\s+\[/);
  const standard = message.match(/^(?:\d{4}-\d\d-\d\dT\S+\s+)?\[?(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\b/i);
  return LEVELS[(nest?.[1] ?? standard?.[1] ?? "info").toLowerCase()];
}

function timestamp(value: unknown): string | null {
  if (typeof value === "string" && /^\d{17,19}$/.test(value)) {
    const nano = BigInt(value);
    if (nano <= 8_640_000_000_000_000_000_000n) return nano.toString();
  }
  let ms: number;
  if (typeof value === "number" || (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value))) {
    const n = Number(value);
    ms = n < 100_000_000_000 ? n * 1000 : n;
  } else if (typeof value === "string") ms = Date.parse(value);
  else return null;
  return Number.isFinite(ms) && ms >= 0 && ms <= 8_640_000_000_000_000 ? (BigInt(Math.round(ms)) * 1_000_000n).toString() : null;
}

export interface LogRecord {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
}

export type Normalization = { ok: true; records: LogRecord[] } | { ok: false; error: "invalid_batch" | "payload_too_large" };

/** Datadog v2 array and v1 single-event JSON; every event must carry message. */
export function normalizeBatch(payload: unknown, config: Config, nowMs: number): Normalization {
  const events = Array.isArray(payload) ? payload : [payload];
  if (!events.length) return { ok: false, error: "invalid_batch" };
  if (events.length > config.limits.records) return { ok: false, error: "payload_too_large" };
  const observedTimeUnixNano = (BigInt(Math.round(nowMs)) * 1_000_000n).toString();
  const records: LogRecord[] = [];
  for (const event of events) {
    if (!isRecord(event) || typeof event.message !== "string") return { ok: false, error: "invalid_batch" };
    if (encoder.encode(JSON.stringify(event)).byteLength > config.limits.lineBytes) return { ok: false, error: "payload_too_large" };
    const plain = event.message.replace(ANSI, "");
    let embedded: Record<string, unknown> | null = null;
    try { const parsed: unknown = JSON.parse(plain); if (isRecord(parsed)) embedded = parsed; } catch { }
    const [severityNumber, severityText] = severity(event, embedded, plain);
    const timeUnixNano = [event.timestamp, event["@timestamp"], event.time, embedded?.timestamp, embedded?.time]
      .map(timestamp).find((time) => time !== null) ?? observedTimeUnixNano;
    let message = embedded ? JSON.stringify(scrub(embedded, config.redactionSecrets)) : redactText(plain, config.redactionSecrets);
    const context = Object.fromEntries(["stack", "err", "error", "code", "queue", "attempt", "count", "duration", "duration_ms",
      "bookmarkId", "bookmark_id", "requestId", "request_id", "reqId", "req_id"]
      .filter((key) => event[key] !== undefined).map((key) => [key, event[key]]));
    if (Object.keys(context).length) message += `\n${JSON.stringify(scrub(context, config.redactionSecrets))}`;
    records.push({ timeUnixNano, observedTimeUnixNano, severityNumber, severityText, body: { stringValue: message } });
  }
  return { ok: true, records };
}

const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

export function otlpPayload(records: readonly LogRecord[], source: Source | "bridge", config: Config) {
  return { resourceLogs: [{
    resource: { attributes: [
      attribute("service.name", source === "bridge" ? "cosmic-log-bridge" : `cosmic-dolphin-${source}`),
      attribute("deployment.environment.name", config.environment),
      attribute("cloud.provider", "digitalocean"),
      attribute("cloud.platform", "digitalocean_app_platform"),
    ] },
    scopeLogs: [{ scope: { name: "cosmic.log_bridge", version: "1" }, logRecords: records }],
  }] };
}
