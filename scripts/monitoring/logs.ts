import { isRecord, isTimeout, readBounded, type Env, type HttpFetch, type Report } from "./save-bookmarks";
import { DELIVERY, resolveOtlpTarget, samplesFor, type DeliveryFailure, type Environment } from "./telemetry";

export const LOG_REQUEST_BYTES = 65_536;
export type LogDelivery = { ok: true; records: 1 } | { ok: false; failure: DeliveryFailure | "payload_too_large" | "payload_invalid" };
const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

/** Counts and fixed codes only; private report fields and correlation IDs are excluded. */
export function logPayload(report: Report, environment: Environment, nowMs: number) {
  const timeUnixNano = (BigInt(Math.round(nowMs)) * 1_000_000n).toString();
  const [severityNumber, severityText] = report.status === "monitoring_failed" ? [17, "ERROR"]
    : report.status === "alerting" ? [13, "WARN"] : [9, "INFO"];
  return { resourceLogs: [{
    resource: { attributes: [attribute("service.name", "cosmic-dolphin-save-monitor"), attribute("deployment.environment.name", environment)] },
    scopeLogs: [{ scope: { name: "cosmic.save_monitor", version: "1" }, logRecords: [{
      timeUnixNano, observedTimeUnixNano: timeUnixNano, severityNumber, severityText,
      body: { stringValue: JSON.stringify({ event: "save_bookmark_snapshot", observedAt: report.observedAt, status: report.status,
        observations: report.observations, metrics: samplesFor(report, nowMs) }) },
    }] }],
  }] };
}

/** Await one bounded OTLP acknowledgement before a short-lived job exits. */
export async function publishLog(report: Report, env: Env, fetchImpl: HttpFetch, nowMs: number): Promise<LogDelivery> {
  const target = resolveOtlpTarget(env, report.target);
  if (!target.ok) return { ok: false, failure: `config_${target.reason}` };
  let body: string;
  try { body = JSON.stringify(logPayload(report, target.target.environment, nowMs)); }
  catch { return { ok: false, failure: "payload_invalid" }; }
  if (new TextEncoder().encode(body).byteLength > LOG_REQUEST_BYTES) return { ok: false, failure: "payload_too_large" };
  const signal = AbortSignal.timeout(DELIVERY.timeoutMs);
  let response: Response | undefined;
  try {
    response = await fetchImpl(target.target.url.replace(/\/metrics$/, "/logs"), {
      method: "POST", redirect: "error", signal,
      headers: { "content-type": "application/json", authorization: target.target.authorization }, body,
    });
    if (!response.ok) return { ok: false, failure: `http_${response.status}` };
    if (response.status === 204) return { ok: true, records: 1 };
    const text = await readBounded(response, DELIVERY.responseBytes);
    if (text === null) return { ok: false, failure: "malformed_response" };
    const ack: unknown = JSON.parse(text);
    if (!isRecord(ack)) return { ok: false, failure: "malformed_response" };
    if (ack.partialSuccess !== undefined) {
      if (!isRecord(ack.partialSuccess)) return { ok: false, failure: "malformed_response" };
      const rejected = ack.partialSuccess.rejectedLogRecords ?? 0;
      const count = typeof rejected === "string" && /^\d+$/.test(rejected) ? Number(rejected) : rejected;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 ||
        (ack.partialSuccess.errorMessage !== undefined && typeof ack.partialSuccess.errorMessage !== "string")) return { ok: false, failure: "malformed_response" };
      if (count > 0) return { ok: false, failure: "partial_rejected" };
    }
    return { ok: true, records: 1 };
  } catch (error) {
    return { ok: false, failure: signal.aborted || isTimeout(error) ? "timeout" : response ? "malformed_response" : "unreachable" };
  } finally {
    void response?.body?.cancel().catch(() => {});
  }
}
