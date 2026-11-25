import { authenticate, isRecord, type Config, type Source } from "./config";
import { normalizeBatch, otlpPayload, type BatchCause, type LogRecord } from "./normalize";

export type HttpFetch = typeof fetch;
type ReadResult = { ok: true; text: string } | { ok: false; error: "payload_too_large" | "timeout" | "invalid_body" };

async function readBounded(body: ReadableStream<Uint8Array> | null, maxBytes: number, signal: AbortSignal): Promise<ReadResult> {
  if (!body) return { ok: true, text: "" };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("timeout"));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) return { ok: false, error: "payload_too_large" };
      chunks.push(value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(joined) };
  } catch {
    return { ok: false, error: signal.aborted ? "timeout" : "invalid_body" };
  } finally {
    signal.removeEventListener("abort", onAbort);
    // Do not wait on a hostile stream's cancellation promise.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export type Delivery = { ok: true } | { ok: false; timeout: boolean };

/** No internal retry or durable queue: failure goes back to the native sender. */
export async function deliver(records: readonly LogRecord[], source: Source | "bridge", config: Config, fetchImpl: HttpFetch = fetch): Promise<Delivery> {
  const signal = AbortSignal.timeout(config.limits.upstreamTimeoutMs);
  let response: Response | undefined;
  try {
    response = await fetchImpl(config.upstreamUrl, {
      method: "POST",
      redirect: "error",
      signal,
      headers: { "content-type": "application/json", authorization: config.authorization },
      body: JSON.stringify(otlpPayload(records, source, config)),
    });
    if (!response.ok) return { ok: false, timeout: false };
    if (response.status === 204) return { ok: true };
    const result = await readBounded(response.body, config.limits.responseBytes, signal);
    if (!result.ok) return { ok: false, timeout: result.error === "timeout" };
    const ack: unknown = JSON.parse(result.text);
    if (!isRecord(ack)) return { ok: false, timeout: false };
    if (ack.partialSuccess !== undefined) {
      if (!isRecord(ack.partialSuccess)) return { ok: false, timeout: false };
      const rejected = ack.partialSuccess.rejectedLogRecords ?? 0;
      const count = typeof rejected === "string" && /^\d+$/.test(rejected) ? Number(rejected) : rejected;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count !== 0 ||
          (ack.partialSuccess.errorMessage !== undefined && typeof ack.partialSuccess.errorMessage !== "string")) return { ok: false, timeout: false };
    }
    return { ok: true };
  } catch {
    return { ok: false, timeout: signal.aborted };
  } finally {
    void response?.body?.cancel().catch(() => {});
  }
}

function response(status: number, error: string): Response {
  const headers: Record<string, string> = {};
  if (status === 503) headers["retry-after"] = "1";
  if (status === 408 || status === 413 || status === 400 && error === "invalid_json") headers.connection = "close";
  return Response.json({ error }, { status, headers });
}

function credentials(url: URL, request: Request): string[] | null {
  const keys: string[] = [];
  const header = request.headers.get("dd-api-key");
  if (header !== null) keys.push(header);
  if (url.pathname.startsWith("/v1/input/")) {
    try { keys.push(decodeURIComponent(url.pathname.slice("/v1/input/".length))); } catch { return null; }
  }
  for (const name of ["api_key", "dd-api-key"]) keys.push(...url.searchParams.getAll(name));
  return keys.length <= 4 ? keys : null;
}

export function createBridge(config: Config, options: { fetchImpl?: HttpFetch; now?: () => number } = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let active = 0;
  let heartbeatActive = false;
  const totals = { acceptedBatches: 0, acceptedRecords: 0, rejectedBatches: 0, deliveryFailures: 0 };
  let lastRejection: { status: number; reason: string; route: string; encoding: string; source: Source | "unknown"; batchCause?: BatchCause } | undefined;
  const increment = (key: keyof typeof totals, n = 1) => { totals[key] = Math.min(Number.MAX_SAFE_INTEGER, totals[key] + n); };

  async function handle(request: Request): Promise<Response> {
    let url: URL;
    try { url = new URL(request.url); } catch { return response(400, "invalid_request"); }
    if (url.pathname === "/health") return request.method === "GET"
      ? Response.json({ status: "process_up" }) : response(405, "method_not_allowed");
    const encoding = (request.headers.get("content-encoding") ?? "identity").trim().toLowerCase();
    let intakeSource: Source | "unknown" = "unknown";
    const reject = (status: number, reason: string, batchCause?: BatchCause) => {
      increment("rejectedBatches");
      lastRejection = { status, reason, route: url.pathname === "/" ? "/" : url.pathname === "/api/v2/logs" ? "/api/v2/logs" : url.pathname.startsWith("/v1/input") ? "/v1/input" : "other",
        encoding: ["identity", "gzip"].includes(encoding) ? encoding : "other", source: intakeSource, ...(batchCause ? { batchCause } : {}) };
      return response(status, reason);
    };
    if (url.pathname !== "/" && url.pathname !== "/api/v2/logs" && url.pathname !== "/v1/input" && !/^\/v1\/input\/[^/]+$/.test(url.pathname)) return reject(404, "not_found");
    if (request.method !== "POST") return reject(405, "method_not_allowed");
    const keys = credentials(url, request);
    const source = keys && authenticate(keys, config);
    if (!source) return reject(401, "unauthorized");
    intakeSource = source;
    const contentType = request.headers.get("content-type") ?? "";
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?\s*$/i.test(contentType)) return reject(415, "invalid_content_type");
    if (!["identity", "gzip"].includes(encoding)) return reject(415, "invalid_content_encoding");
    const length = request.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > config.limits.requestBytes)) return reject(413, "payload_too_large");
    if (active >= config.limits.concurrentRequests) return reject(503, "overloaded");
    active++;
    try {
      let wireTooLarge = false;
      let input = request.body;
      if (encoding === "gzip" && input) {
        let wireBytes = 0;
        input = input.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
          wireBytes += chunk.byteLength;
          if (wireBytes > config.limits.requestBytes) { wireTooLarge = true; throw new Error("payload_too_large"); }
          controller.enqueue(chunk);
        } })).pipeThrough(new DecompressionStream("gzip"));
      }
      const body = await readBounded(input, config.limits.requestBytes, AbortSignal.timeout(config.limits.requestTimeoutMs));
      if (wireTooLarge) return reject(413, "payload_too_large");
      if (!body.ok) {
        return reject(body.error === "timeout" ? 408 : body.error === "payload_too_large" ? 413 : 400,
          body.error === "timeout" ? "request_timeout" : body.error === "invalid_body" ? "invalid_json" : body.error);
      }
      let payload: unknown;
      try { payload = JSON.parse(body.text); } catch { return reject(400, "invalid_json"); }
      let normalized;
      try { normalized = normalizeBatch(payload, config, now()); } catch { return reject(400, "invalid_batch"); }
      if (!normalized.ok) {
        return reject(normalized.error === "payload_too_large" ? 413 : 400, normalized.error, normalized.batchCause);
      }
      const result = await deliver(normalized.records, source, config, fetchImpl);
      if (!result.ok) {
        increment("deliveryFailures");
        return reject(result.timeout ? 503 : 502, result.timeout ? "delivery_timeout" : "delivery_failed");
      }
      increment("acceptedBatches");
      increment("acceptedRecords", normalized.records.length);
      return Response.json({ accepted: normalized.records.length }, { status: 202 });
    } finally { active--; }
  }

  async function heartbeat(): Promise<Delivery> {
    if (heartbeatActive) return { ok: false, timeout: false };
    heartbeatActive = true;
    try {
      const timeUnixNano = (BigInt(Math.round(now())) * 1_000_000n).toString();
      const record: LogRecord = {
        timeUnixNano, observedTimeUnixNano: timeUnixNano, severityNumber: 9, severityText: "INFO",
        body: { stringValue: JSON.stringify({ event: "log_bridge_heartbeat", ...totals, lastRejection }) },
      };
      return await deliver([record], "bridge", config, fetchImpl);
    } finally { heartbeatActive = false; }
  }

  return { handle, heartbeat };
}
