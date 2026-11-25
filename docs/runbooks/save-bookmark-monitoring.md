# Activate and operate save-bookmark monitoring

This collector observes server-accepted saves. Client-only captures, offline intents that have not reached the server, and rejected API attempts are unseen. API health does not prove save acceptance. Empty traffic does not prove a working save journey.

The independent DigitalOcean job runs every 15 minutes. It performs a bounded read-only database snapshot and sends fewer than 50 fixed gauge series through OTLP/HTTP JSON. Grafana evaluates eight alerts every minute. No public endpoint, application process, queue mutation, or automatic remediation is involved.

## Prepare a new Grafana Cloud Free stack

1. Create the new Free stack in Grafana Cloud. Record its Grafana URL and stack ID. Use `stacks-<STACK_ID>` as `GRAFANA_NAMESPACE`.
2. Open the stack's OpenTelemetry connection tile. Record the OTLP gateway base ending in `/otlp` and the numeric instance ID. Create an access policy token limited to this stack and `metrics:write`. Store `GRAFANA_OTLP_TOKEN` in your secret store. Do not paste tokens into chat or commit them.
3. Find the existing Prometheus metrics data-source UID in Grafana. Set `GRAFANA_DATASOURCE_UID` to that UID. The provisioner reads this data source and does not modify it.
4. Create and verify your intended contact point in Grafana. Set `GRAFANA_RECEIVER` to the exact existing contact-point title. The provisioner does not create contact points or overwrite global notification policies. Every rule routes directly to this receiver, with a 30-second group wait, five-minute group interval, and four-hour repeat interval. Confirm that recovery notifications are enabled on the contact point.
5. Create a Grafana service account with permission to read the data source and receiver, create the owned folder and dashboard, and provision alert rules. Store its token as `GRAFANA_SERVICE_ACCOUNT_TOKEN` in your secret store. Editor or Admin is supported by default. Use narrower Grafana RBAC where your plan supports it. This token is used for provisioning only and is never injected into the cron job.
6. Record `MONITOR_RUNBOOK_URL` if this runbook is published elsewhere. The default links to this repository on GitHub.

Review the Free stack's current limits and retention. The DigitalOcean scheduled job is billed for its runtime separately from Grafana's Free plan. Metrics have fixed `environment` and `journey` labels. Queue counts, failure codes, statuses, and quantiles use bounded label values. No user IDs, bookmark IDs, URLs, titles, content, or raw error messages enter metrics.

## Generate and provision assets

The checked-in `docs/monitoring/save-bookmark/grafana/assets.v1.json` is a reproducible template with explicit placeholders. It uses fixed owned folder, dashboard, and rule UIDs. Reuse those UIDs for reruns.

```sh
bun --no-env-file scripts/monitoring/grafana.ts --dry-run
bun --no-env-file scripts/monitoring/grafana.ts --check docs/monitoring/save-bookmark/grafana/assets.v1.json
```

With the stack settings injected through your secret store, generate the exact configured assets for review.

```sh
bun --no-env-file scripts/monitoring/grafana.ts --write /private/tmp/save-monitor-assets.json
bun --no-env-file scripts/monitoring/grafana.ts --check /private/tmp/save-monitor-assets.json
bun --no-env-file scripts/monitoring/grafana.ts --apply
```

Required settings are `GRAFANA_URL`, `GRAFANA_NAMESPACE`, `GRAFANA_DATASOURCE_UID`, `GRAFANA_RECEIVER`, and `GRAFANA_SERVICE_ACCOUNT_TOKEN`. Cloud provisioning requires `MONITOR_METRICS_ENVIRONMENT=production`, which is the default. Local proofs use a loopback Grafana URL, namespace `default`, and environment `local`.

Apply checks all owned UIDs before writing. Foreign resources cause a conflict. Alert updates carry the current `metadata.resourceVersion`; concurrent edits fail instead of being silently replaced. Dashboard updates carry its current version. Rerun after a partial failure. Existing owned resources are updated and missing resources are created. Apply never deletes resources.

## Prepare the production collector

Use the GitHub environment `monitoring-production` for new ingest and database CA secrets. Existing repository secrets can remain inherited. Configure these values before manual activation.

| Setting | Source |
| --- | --- |
| `DATABASE_URL` | Existing production GitHub secret |
| `SUPABASE_PROJECT_REF`, `SUPABASE_URL` | Existing production repository variables |
| `MONITOR_DB_CA_PEM` | Supabase database root CA PEM from a trusted source, stored as a secret |
| `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_INSTANCE_ID` | New stack's OpenTelemetry tile, stored as variables |
| `GRAFANA_OTLP_TOKEN` | Stack-scoped `metrics:write` secret |
| `DIGITALOCEAN_ACCESS_TOKEN`, `DIGITALOCEAN_REGISTRY_NAME` | Existing GitHub secrets |
| `MONITOR_DO_APP_ID` | Variable holding the separate monitoring app ID after creation |

The database fence requires the production project `qsqbcqkpqmkuywunxbut`, its exact Supabase URL, database `/postgres`, and a direct port of 5432 or pooler port of 5432/6543. Only `sslmode=require` is permitted as a URL query parameter. Direct hosts and pooler usernames must identify the same project. Arbitrary health URL overrides and local settings are rejected for production.

Activation requires a CA PEM and uses certificate verification. Do not disable TLS to make a failing run green. The query uses `prepare: false` for pooler compatibility. Supavisor behavior, the actual production URL format, TLS trust, network access, and production grants remain first-live-run checks. The observer role needs SELECT access to the referenced public bookmark columns and `pgmq.q_bookmarks`. It does not need queue claim or write access. Read-only transactions limit the observer's behavior even when existing credentials have wider privileges.

The production CA download used by [Supabase Studio](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json) was verified on 2026-11-25: [Supabase Root 2021 CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). Prefer the current certificate from the project's Database Settings if Supabase changes its CA. Validate the certificate before storing it; a successful download alone does not prove production TLS connectivity.

Validate configuration without database or Grafana calls.

```sh
bun --no-env-file scripts/monitoring/monitor.ts --check-config --publish
bun --no-env-file scripts/monitoring/deployment.ts --check-config
```

For the deployment validator, inject `IMAGE_TAG` as the exact 40-character checkout SHA and `DIGITALOCEAN_REGISTRY_NAME`. It serializes environment values as structured JSON, preserving PEM newlines and secret punctuation. It does not print the resolved spec or remote response bodies.

## Activate manually

1. Complete the monitoring verification workflow on the intended SHA. Review the configured Grafana assets and provision them.
2. Run **Activate save monitoring manually** on `main`. Select `create` for the first separate app, or `update` with `MONITOR_DO_APP_ID` for an existing monitoring app.
3. Record the returned app ID as `MONITOR_DO_APP_ID`. A returned `deployment=requested` means DigitalOcean accepted the spec. It does not prove deployment or a scheduled invocation completed.
4. Confirm the app contains only `save-bookmark-monitor`, with schedule `*/15 * * * *` in UTC and no public route. Confirm the deployed image tag matches the selected SHA.
5. Confirm a scheduled invocation and the collector's delivery result. Check Grafana's heartbeat, observer, snapshot timestamp, and save dashboard. Check the database snapshot timestamp advances.
6. Perform an authorized test save through the real client and confirm its acceptance and completion. This production check is separate from local fixture proof.
7. Through an approved receiver test, confirm an actual notification and a recovery notification reach the intended destination. Local proof uses an empty receiver and proves no delivery to a person.

The activation workflow has only `workflow_dispatch`. Merging code neither deploys nor activates the collector. The image uses pinned Bun `1.3.11-alpine`, needs no dependency install, and starts no app. Automatic image redeployment is disabled. API and worker images and app specs are untouched.

## Confirm alerts and recovery

Use `last_over_time(metric{environment="production",journey="save_bookmark"}[45m])` in Explore. A five-minute default Prometheus lookback misses valid 15-minute observations. The heartbeat rule checks absent series and a heartbeat timestamp older than 45 minutes. Its one-minute pending period follows that window.

Successful observations publish fixed zeros for healthy database rules. Query errors use Grafana's `Error` state and no-data uses `Alerting`. Database observation failure sends a fresh heartbeat and observer value zero but omits business gauges and the successful snapshot timestamp. An unobserved API gauge is omitted too. Retained business values are suppressed when the latest observer value is zero. They are never replaced with invented collector zeros. When no observer series exists, rule no-data and the dedicated heartbeat rule identify the gap.

An ingest timeout, redirect, HTTP failure, malformed response, or OTLP partial rejection exits nonzero. Missing-heartbeat detection later catches scheduler or delivery outages. Exit codes are 0 for healthy observations, 1 for product alerts, 2 for observer failure, and 3 for delivery failure. A product alert can produce a failed DigitalOcean invocation while its metric delivery succeeds.

Terminal failure gauges cover 60 minutes, longer than the collection cadence and drift. Completion timing measures `created_at` to completion and includes budget deferral and reprocessing. It is context, with no latency alert.

Verify that the configured inbox receives a real firing alert. Verify recovery delivery separately, with recovery messages enabled on the contact point. A test endpoint returning success proves sender acceptance; it does not prove inbox receipt. Grafana 13.4 uses `POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}/test`. Read the Receiver resource to obtain `{name}`. The older Alertmanager contact-point test endpoint returns HTTP 410 on this stack.

For a controlled firing and recovery check, use a temporary rule with distinct setup labels and a constant math expression. Change the expression from 1 to 0 after firing delivery. Confirm the resolved email, then delete the temporary rule. Do not publish fabricated production gauges or change bookmarks to test notifications.

The production activation record and remaining limits are in [verification.md](../monitoring/save-bookmark/verification.md#production-activation-on-2026-11-25). The active collector app ID is stored in the `monitoring-production` environment. Use `activation=update` for later collector deployments.

### Monitoring failed

Save health is unknown. Check target validation, TLS, credentials, SELECT grants, network, and schema compatibility before trusting other values.

### API health failed

Check the API deployment, logs, and domain. Save acceptance remains unverified by this health probe.

### Queue visible backlog

Claimable messages waited more than 300 seconds. Check whether the worker is running and polling the bookmarks queue.

### Processing without owner

A processing bookmark has no owner-matching queue message after the 120-second grace period. Find the loss before authorizing reprocessing.

### Processing overdue

A journey exceeded 2,100 seconds. Queue enqueue time survives automatic redelivery. Check bounded retries, provider health, and worker logs.

### Queue invalid messages

Malformed, orphaned, or owner-mismatched messages stayed claimable beyond 300 seconds. Check what enqueued them and whether the worker drains them. Queue age does not date a bookmark deletion.

### Infrastructure failures

Provider, unavailable, or unclassified terminal failures in the last 60 minutes are critical, even for one save. Source-access failures such as paywalls remain context. Check provider status and worker logs before authorizing a retry.

### Missing observer

No heartbeat exists in the last 45 minutes, or its timestamp is older than 45 minutes. Check the schedule, invocation, ingest credentials, and Grafana connectivity. A fresh heartbeat with observer zero instead belongs to `monitoring_failed`.

## Rerun isolated verification

Use a task-owned disposable Supabase Postgres container and an exact `MONITOR_IT_OWNED_TARGET`. Never use port 5433 or a localhost production tunnel. Fixture deletion requires `public.__test_database_marker` with exactly one row. The fresh loader refuses any occupied public, pgmq, or migration schema before applying all unchanged migrations and creating the marker.

```sh
bun --no-env-file test scripts/monitoring/__tests__/save-bookmarks.test.ts scripts/monitoring/__tests__/telemetry.test.ts scripts/monitoring/__tests__/grafana.test.ts scripts/monitoring/__tests__/deployment.test.ts scripts/monitoring/__tests__/cli.test.ts
bun --no-env-file scripts/monitoring/__tests__/load-migrations.ts supabase/migrations
bun --no-env-file test scripts/monitoring/__tests__/save-bookmarks.sql.test.ts
```

The last two commands require `MONITOR_IT_ADMIN_URL`, `MONITOR_IT_DATABASE_URL`, and `MONITOR_IT_OWNED_TARGET` injected for your disposable container. The loader is for a fresh database. Do not run it on an already migrated container.

Before Linux builds, inventory the Docker context and running containers. Use a dedicated build context if the default hosts other work. Build `scripts/monitoring/Dockerfile` from the repository root. Run the fixture CLI with networking disabled and verify its JSON report as well as the exit code.
