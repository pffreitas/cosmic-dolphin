/**
 * Report -> gauge samples -> OTLP/HTTP JSON for Grafana Cloud.
 *
 * Every series has fixed labels: no bookmark ids, message ids, user ids or
 * free text. A failed database observation publishes only the heartbeat,
 * observer health and the API state it observed, never healthy zeros.
 */
import {
  FAILURE_CLASS,
  FAILURE_CODES,
  LOOPBACK,
  RULES,
  isRecord,
  isTimeout,
  parseUrl,
  readBounded,
  type Env,
  type HttpFetch,
  type Report,
  type TargetKind,
} from "./save-bookmarks";

export const SERVICE_NAME = "cosmic-save-monitor";
export const JOURNEY = "save_bookmark";
export type Environment = "production" | "local" | "fixture";

export const DELIVERY = { timeoutMs: 10_000, responseBytes: 16_384 } as const;

/** Every published metric. Gauges carry no unit, so OTLP translation adds no suffix. */
export const METRICS = {
  cosmic_save_monitor_heartbeat_timestamp_seconds: { help: "Unix time of this checker run.", labels: [] },
  cosmic_save_monitor_observer_up: { help: "1 when the database snapshot succeeded, 0 when it failed.", labels: [] },
  cosmic_save_monitor_snapshot_timestamp_seconds: { help: "Database clock of the last successful snapshot.", labels: [] },
  cosmic_save_api_up: { help: "1 when the API health check passed, 0 when it failed. Absent when not observed.", labels: [] },
  cosmic_save_alert_count: { help: "Rows past each database alert threshold; 0 when healthy.", labels: ["code"] },
  cosmic_save_queue_messages: { help: "Bookmark queue messages by visibility state.", labels: ["state"] },
  cosmic_save_queue_redelivered_messages: { help: "Queue messages delivered more than once.", labels: [] },
  cosmic_save_queue_oldest_visible_wait_seconds: { help: "Longest claimable wait; 0 when nothing is claimable.", labels: [] },
  cosmic_save_queue_invalid_messages: { help: "Invalid messages claimable past one lease, by kind.", labels: ["kind"] },
  cosmic_save_processing_bookmarks: { help: "Bookmarks currently processing.", labels: [] },
  cosmic_save_processing_oldest_journey_age_seconds: { help: "Oldest processing journey, dated by its queue enqueue; 0 when none.", labels: [] },
  cosmic_save_saves: { help: "Bookmarks created in the last 24h by current status.", labels: ["status"] },
  cosmic_save_terminal_completed: { help: "Bookmarks completed in the last 60m.", labels: [] },
  cosmic_save_terminal_failed: { help: "Bookmarks failed in the last 60m by failure code.", labels: ["code", "class"] },
  cosmic_save_completion_latest_age_seconds: { help: "Age of the latest completion of any bookmark. Absent when none in 24h.", labels: [] },
  cosmic_save_completion_created_to_completed_seconds: {
    help: "Created to completed for saves created and completed in 24h. Includes idle deferral and reprocessing. Context only.",
    labels: ["quantile"],
  },
} as const satisfies Record<string, { help: string; labels: readonly string[] }>;
export type MetricName = keyof typeof METRICS;

export interface Sample {
  name: MetricName;
  labels: Readonly<Record<string, string>>;
  value: number;
}

const INVALID_LABEL = { malformed: "malformed", orphan: "orphan", ownerMismatch: "owner_mismatch" } as const;

export function samplesFor(report: Report, nowMs: number): Sample[] {
  const out: Sample[] = [];
  const add = (name: MetricName, value: number, labels: Record<string, string> = {}) => out.push({ name, labels, value });

  add("cosmic_save_monitor_heartbeat_timestamp_seconds", nowMs / 1000);
  add("cosmic_save_monitor_observer_up", report.observations.database === "ok" ? 1 : 0);
  if (report.observations.api !== "not_observed") add("cosmic_save_api_up", report.observations.api === "ok" ? 1 : 0);
  const c = report.context;
  if (report.clock !== "database" || !c) return out;

  add("cosmic_save_monitor_snapshot_timestamp_seconds", Date.parse(report.observedAt) / 1000);
  const fired = new Map(report.alerts.map((a) => [a.code, a.evidence.count]));
  for (const rule of RULES) if (rule.source === "database") add("cosmic_save_alert_count", fired.get(rule.code) ?? 0, { code: rule.code });

  add("cosmic_save_queue_messages", c.queue.visible, { state: "visible" });
  add("cosmic_save_queue_messages", c.queue.delayed, { state: "delayed" });
  add("cosmic_save_queue_messages", c.queue.leasedOrBackoff, { state: "leased_or_backoff" });
  add("cosmic_save_queue_redelivered_messages", c.queue.redelivered);
  add("cosmic_save_queue_oldest_visible_wait_seconds", c.queue.oldestVisibleWaitSeconds ?? 0);
  for (const [kind, label] of Object.entries(INVALID_LABEL)) {
    add("cosmic_save_queue_invalid_messages", c.queue.invalidPastGrace[kind as keyof typeof INVALID_LABEL], { kind: label });
  }
  add("cosmic_save_processing_bookmarks", c.processing.total);
  add("cosmic_save_processing_oldest_journey_age_seconds", c.processing.oldestJourneyAgeSeconds ?? 0);
  for (const [status, n] of Object.entries({ ...c.saves.byStatus, idle: c.saves.deferredIdle })) add("cosmic_save_saves", n, { status });
  add("cosmic_save_terminal_completed", c.terminal.completed);
  for (const code of FAILURE_CODES) add("cosmic_save_terminal_failed", c.terminal.failedByCode[code], { code, class: FAILURE_CLASS[code] });
  if (c.completion.latestAgeSeconds !== null) add("cosmic_save_completion_latest_age_seconds", c.completion.latestAgeSeconds);
  const timing = c.completion.createdToCompleted;
  if (timing.p50Seconds !== null) add("cosmic_save_completion_created_to_completed_seconds", timing.p50Seconds, { quantile: "0.5" });
  if (timing.p95Seconds !== null) add("cosmic_save_completion_created_to_completed_seconds", timing.p95Seconds, { quantile: "0.95" });
  return out;
}

const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

export function otlpPayload(samples: readonly Sample[], environment: Environment, nowMs: number) {
  const timeUnixNano = (BigInt(Math.round(nowMs)) * 1_000_000n).toString();
  const names = (Object.keys(METRICS) as MetricName[]).filter((name) => samples.some((s) => s.name === name));
  return {
    resourceMetrics: [
      {
        resource: { attributes: [attribute("service.name", SERVICE_NAME)] },
        scopeMetrics: [
          {
            scope: { name: "cosmic.save_monitor", version: "1" },
            metrics: names.map((name) => ({
              name,
              description: METRICS[name].help,
              gauge: {
                dataPoints: samples
                  .filter((s) => s.name === name)
                  .map((s) => ({
                    attributes: [
                      attribute("environment", environment),
                      attribute("journey", JOURNEY),
                      ...Object.entries(s.labels).map(([k, v]) => attribute(k, v)),
                    ],
                    timeUnixNano,
                    asDouble: s.value,
                  })),
              },
            })),
          },
        ],
      },
    ],
  };
}


export type OtlpRejection = "endpoint_missing" | "endpoint_invalid" | "environment_mismatch" | "credentials_missing" | "credentials_invalid";
export interface OtlpTarget {
  url: string;
  authorization: string;
  environment: Environment;
}

const CLOUD_OTLP_HOST = /^otlp-gateway-[a-z0-9-]+\.grafana\.net$/;

/**
 * Grafana Cloud's exact OTLP gateway publishes as production. A loopback
 * receiver is only for local and fixture runs, so fixture data can never reach
 * production series and production data never leaves for a local receiver.
 */
export function resolveOtlpTarget(env: Env, target: TargetKind): { ok: true; target: OtlpTarget } | { ok: false; reason: OtlpRejection } {
  const reject = (reason: OtlpRejection) => ({ ok: false as const, reason });
  if (!env.GRAFANA_OTLP_ENDPOINT) return reject("endpoint_missing");
  const url = parseUrl(env.GRAFANA_OTLP_ENDPOINT);
  if (!url || url.username || url.password || url.search || url.hash || url.pathname !== "/otlp") return reject("endpoint_invalid");
  const cloud = url.protocol === "https:" && url.port === "" && CLOUD_OTLP_HOST.test(url.hostname);
  const loopback = url.protocol === "http:" && /^\d+$/.test(url.port) && LOOPBACK.has(url.hostname);
  if (!cloud && !loopback) return reject("endpoint_invalid");
  if (cloud ? target === "local" || target === "fixture" : target === "production") return reject("environment_mismatch");
  const id = env.GRAFANA_OTLP_INSTANCE_ID;
  const token = env.GRAFANA_OTLP_TOKEN;
  if (!id || !token) return reject("credentials_missing");
  if (!/^\d{1,12}$/.test(id) || !/^[\x21-\x7e]{1,4096}$/.test(token)) return reject("credentials_invalid");
  return {
    ok: true,
    target: {
      url: `${url.origin}/otlp/v1/metrics`,
      authorization: `Basic ${Buffer.from(`${id}:${token}`).toString("base64")}`,
      environment: cloud ? "production" : target === "fixture" ? "fixture" : "local",
    },
  };
}

export type DeliveryFailure = `config_${OtlpRejection}` | "timeout" | "unreachable" | `http_${number}` | "malformed_response" | "partial_rejected";
export type Delivery = { ok: true; series: number } | { ok: false; failure: DeliveryFailure };

/** One POST, no retry: the next scheduled run is the retry. Remote text is never kept. */
export async function deliver(samples: readonly Sample[], target: OtlpTarget, fetchImpl: HttpFetch, nowMs: number): Promise<Delivery> {
  const fail = (failure: DeliveryFailure): Delivery => ({ ok: false, failure });
  let response: Response;
  try {
    response = await fetchImpl(target.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(DELIVERY.timeoutMs),
      headers: { "content-type": "application/json", authorization: target.authorization },
      body: JSON.stringify(otlpPayload(samples, target.environment, nowMs)),
    });
  } catch (error) {
    return fail(isTimeout(error) ? "timeout" : "unreachable");
  }
  try {
    if (response.status < 200 || response.status > 299) return fail(`http_${response.status}`);
    const text = await readBounded(response, DELIVERY.responseBytes);
    if (text === null) return fail("malformed_response");
    const body: unknown = JSON.parse(text);
    if (!isRecord(body)) return fail("malformed_response");
    if (body.partialSuccess !== undefined) {
      if (!isRecord(body.partialSuccess)) return fail("malformed_response");
      const rejected = body.partialSuccess.rejectedDataPoints ?? 0;
      const n = typeof rejected === "string" && /^\d+$/.test(rejected) ? Number(rejected) : rejected;
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) return fail("malformed_response");
      if (n > 0) return fail("partial_rejected");
    }
    return { ok: true, series: samples.length };
  } catch (error) {
    return fail(isTimeout(error) ? "timeout" : "malformed_response");
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}
