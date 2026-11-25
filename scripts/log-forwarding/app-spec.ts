import { closeSync, constants, fchmodSync, openSync, readFileSync, writeFileSync } from "node:fs";

export const SOURCE_COMPONENTS = {
  api: { app: "cosmic-dolphin-api-nodejs", group: "services", component: "cosmic-dolphin-api-nodejs" },
  worker: { app: "cosmic-dolphin-worker-nodejs", group: "workers", component: "cosmic-dolphin-worker-nodejs" },
  web: { app: "cosmic-dolphin-webapp", group: "services", component: "cosmic-dolphin-webapp" },
  "save-monitor": { app: "cosmic-dolphin-save-monitor", group: "jobs", component: "save-bookmark-monitor" },
} as const;
export type LogSource = keyof typeof SOURCE_COMPONENTS;
const DESTINATION = "cosmic-grafana-logs";
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function bridgeUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("logs_bridge_url_invalid"); }
  if (url.protocol !== "https:" || !/^cosmic-log-bridge-[a-z0-9-]+\.ondigitalocean\.app$/.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("logs_bridge_url_invalid");
  return url.origin;
}

export function withLogForwarding(spec: unknown, source: LogSource, env: Record<string, string | undefined>) {
  const target = SOURCE_COMPONENTS[source];
  if (!target || !record(spec) || spec.name !== target.app || !Array.isArray(spec[target.group])) throw new Error("logs_app_conflict");
  const copy = structuredClone(spec);
  const components = copy[target.group] as unknown[];
  const matches = components.filter((entry): entry is Record<string, unknown> => record(entry) && entry.name === target.component);
  if (matches.length !== 1) throw new Error("logs_component_conflict");
  const endpoint = env.GRAFANA_LOG_BRIDGE_URL;
  const key = env.LOG_FORWARDING_KEY;
  if (!endpoint && !key) return { spec: copy, configured: false };
  if (!endpoint || !key || !/^[A-Za-z0-9_-]{32,256}$/.test(key)) throw new Error("logs_config_missing_or_invalid");
  const canonicalEndpoint = bridgeUrl(endpoint);
  const component = matches[0];
  if (component.log_destinations !== undefined && !Array.isArray(component.log_destinations)) throw new Error("logs_destinations_invalid");
  const destinations = (component.log_destinations ?? []) as unknown[];
  const owned = destinations.filter((entry) => record(entry) && entry.name === DESTINATION);
  if (owned.length > 1) throw new Error("logs_destination_conflict");
  if (owned.length === 1) {
    const entry = owned[0] as Record<string, unknown>;
    if (!record(entry.datadog) || typeof entry.datadog.endpoint !== "string") throw new Error("logs_destination_conflict");
    try { bridgeUrl(entry.datadog.endpoint); } catch { throw new Error("logs_destination_conflict"); }
  }
  const destination = { name: DESTINATION, datadog: { endpoint: canonicalEndpoint, api_key: key } };
  component.log_destinations = [...destinations.filter((entry) => !(record(entry) && entry.name === DESTINATION)), destination];
  return { spec: copy, configured: true };
}

if (import.meta.main) {
  try {
    const [fileFlag, file, sourceFlag, source, ...extra] = process.argv.slice(2);
    if (fileFlag !== "--file" || !file || sourceFlag !== "--source" || !Object.hasOwn(SOURCE_COMPONENTS, source ?? "") || extra.length) throw new Error("logs_usage_invalid");
    const parsed: unknown = Bun.YAML.parse(readFileSync(file, "utf8"));
    const result = withLogForwarding(parsed, source as LogSource, process.env);
    if (result.configured) {
      const fd = openSync(file, constants.O_WRONLY | constants.O_TRUNC | constants.O_NOFOLLOW);
      try { fchmodSync(fd, 0o600); writeFileSync(fd, JSON.stringify(result.spec, null, 2) + "\n"); } finally { closeSync(fd); }
    }
    console.log(JSON.stringify({ logForwarding: result.configured ? "configured" : "not_configured", source }));
  } catch (error) {
    const reason = error instanceof Error && /^logs_[a-z0-9_]+$/.test(error.message) ? error.message : "logs_spec_failed";
    console.error(JSON.stringify({ result: "failed", reason }));
    process.exitCode = 2;
  }
}
