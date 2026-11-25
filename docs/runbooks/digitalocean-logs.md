# Search production DigitalOcean logs in Grafana

Open the [production log dashboard](https://tenderlimpet2779.grafana.net/d/cosmic-production-logs). Select API, worker, web, or save-monitor and the incident time range. The [save dashboard](https://tenderlimpet2779.grafana.net/d/cosmic-save-bookmarks) shows queue and observer health for the same period.

## Search an incident

Use the `grafanacloud-logs` Loki data source in Explore. These queries select production runtime logs.

```logql
{service_name="cosmic-dolphin-worker",deployment_environment_name="production"} |= "QueueProcessor"
```

```logql
{service_name="cosmic-dolphin-worker",deployment_environment_name="production"} |~ "Error (reading messages from|processing) queue"
```

```logql
{service_name="cosmic-dolphin-api",deployment_environment_name="production"} | severity_text=~"ERROR|FATAL"
```

Filter a log body by its opaque bookmark or request ID to correlate events. These IDs are not indexed labels. Credentials, private payload fields, URLs, and email addresses are redacted. Free-form text can still contain information the redactor cannot recognize. Avoid logging private content at its source.

An `ACTIVE` DigitalOcean deployment does not prove its queues are progressing. Check worker startup, queue read errors, and the save dashboard together. A running worker can stop polling one queue without throwing an error.

## Interpret coverage and health

The bridge accepts DigitalOcean's native Datadog HTTP log format and forwards it to Grafana OTLP logs. Each source has a separate secret key. The receiver has no DigitalOcean account credential and does not read or repair bookmarks.

The bridge sends `log_bridge_heartbeat` every minute. Its missing-heartbeat alert uses a five-minute window and a two-minute pending period. A heartbeat proves the bridge can publish to Grafana. It does not prove all four native sources are connected. Check records for each source; save-monitor logs normally appear only every 15 minutes.

Native forwarding covers new runtime logs. Build/deploy logs and historical backfill are outside this integration. Use `doctl apps logs --type build` or `--type deploy` for those. The account's current Grafana plan determines log retention and ingestion limits. The separate DigitalOcean bridge service is billed independently.

The receiver acknowledges a batch only after Grafana accepts it. Upstream HTTP errors, timeouts, malformed acknowledgements, or partial rejection return an error to the native sender. The bridge has no durable spool. Native retry behavior and retention determine recovery after an outage; do not assume loss-free delivery. Dashboard counters are process-local and reset on restart.

If source records are missing while heartbeats continue, inspect the heartbeat's `lastRejection`. Its fixed reason, route, encoding, and source identify intake errors without exposing credentials or payloads. The custom endpoint accepts plain or gzip JSON at its root and Datadog paths. Both compressed and expanded bodies have byte caps.

## Deploy or update the bridge

1. Complete the verification workflow and code review for the intended version.
2. Configure the `log-observability-production` environment with `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_OTLP_TOKEN`, and `LOG_SOURCE_KEYS_JSON`. Use a stack-scoped logs-write credential. Keep tokens and source keys out of chat and repository files.
3. Run `.github/workflows/deploy-log-forwarding.yml` from `main`. Select `create` only for the initial app; select `update` afterwards and configure `LOG_BRIDGE_DO_APP_ID`.
4. Verify the actual deployed source commit, `ACTIVE` status, `/health`, and a fresh heartbeat in Loki. A deployment-request receipt is not completion proof.
5. Set the repository variable `GRAFANA_LOG_BRIDGE_URL` to the verified bridge origin. Configure `LOG_FORWARDING_API_KEY`, `LOG_FORWARDING_WORKER_KEY`, `LOG_FORWARDING_WEB_KEY`, and `LOG_FORWARDING_SAVE_MONITOR_KEY` as repository secrets matching the receiver's source keys.
6. Apply the owned forwarding destination to each current live app spec. Preserve its other fields and source versions. Verify a real native runtime log from each app in Loki before marking activation complete.

Normal API, worker, web, and monitoring deployment workflows overlay the owned destination onto their app templates. Missing URL and key leave an unconfigured template unchanged. Partial configuration fails before deployment. Other destinations remain intact. The bridge update workflow refreshes its Git source; live source-app forwarding changes preserve existing image versions.

## Roll back forwarding

Remove only `cosmic-grafana-logs` from the affected component's current `log_destinations` list. Preserve other destinations, environment values, and image versions. Disable the repository forwarding configuration consistently before a later release can restore it. Keep the bridge available until source removal finishes. Remove its heartbeat alert only when the bridge is intentionally retired.

The [activation record](../monitoring/digitalocean-logs/tasks.md) contains current deployment state and proof limits.
