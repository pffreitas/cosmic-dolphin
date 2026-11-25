# Save-bookmark production alerts

| Current state | Value |
|---|---|
| Outcome | Production monitoring is active on merged SHA `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`. Grafana has the dashboard, eight rules, and the user-provided email contact point. Firing and recovery delivery passed. Four processing saves have four claimable messages; the oldest journey has waited about seven days. A missing dispatcher wake-up reproduces with the deployed queue order and concurrency. |
| Next gate | Regression-test and repair dispatcher reservation release before any backend deployment. Verify existing messages progress and alerts resolve after release. |
| Owner | This thread owns activation verification and read-only incident diagnosis. |
| Blocker | Monitoring has no access blocker. Current DigitalOcean worker status/logs remain unavailable after the read-only credential request was declined. The local dispatcher bug is reproduced; no production repair is deployed. |
| Scope | Grafana Cloud alerts and an independent read-only save-journey checker. |
| User choice | Latest steering: "Actually I’m considering going with grafana. It looks a more sustainable option in the long run." |
| Starting state | Clean branch `investigate-stuck-bookmarks`, base `0a0784e1cbb5c81c287eaa69442f23d43d59f568`. Live `origin/main` matched at start. |
| Release | On 2026-11-25 the user authorized activation after merge. The main-only manual workflow built and created the separate scheduled collector. Production database/API observation, Cloud ingestion, recurring invocation, firing-email delivery, and recovery-email delivery passed. The temporary setup rule was removed. No application deployment or database/queue mutation occurred. |

## Behavior to prove

Observe accepted saves without claiming or changing queue messages. Detect prolonged visible queue wait, processing without an owner-matching message, saves exceeding their retry budget, and terminal infrastructure failures. Preserve source-access failures as context. An unavailable observer is an alert, never a healthy result.

The worker's four-minute deadline, five-minute queue lease, and 30/120/600-second retry backoff affect thresholds. A bookmark's `processing_started_at` records enqueue time initially and is reset at each worker delivery. Queue `enqueued_at` supplies the stable journey clock across automatic retries. `idle` is intentional daily AI-budget deferral. Empty traffic is not evidence of a successful save journey.

Only opaque IDs, counts, phases, and fixed failure codes belong in reports. Never publish bookmark titles, URLs, content, user IDs, provider errors, or credentials.

## Delivery

Publish checker observations to Grafana Cloud. Provision a save-journey dashboard, alert rules, and a missing-observation alert. Do not use application code to restart services or replay bookmarks automatically.

The collector uses the chosen 15-minute DigitalOcean cadence. Grafana queries account for sparse samples, and the missing-observer alert detects scheduler or ingestion outages. Credentials and the contact point were configured through the authorized activation; actual production firing emails were received.

## Evidence

The [interactive architecture blueprint](blueprint/architecture.html) explains the application path, observation boundaries, failure scenarios, and manual activation. Its diagrams and scenarios contain no live production telemetry.

See [verification.md](verification.md) for the final checks, corrections, and activation gaps. The integrated implementation passes 144 offline tests and 14 real-SQL tests against all 36 unchanged migrations. Local Grafana 13.3.2 and Mimir 3.2.6 proof covers provisioning, ingestion/readback, sparse samples, alert firing, query errors, and healthy recovery. The development queue inspected earlier is unrelated to production and is not production evidence.

The [production incident diagnosis](production-incident-2026-11-25.md) records the reproduced dispatcher starvation, deployed configuration, control experiments, and limits of current runtime evidence. Diagnosis made no production mutation or repository worker change.

## Implementation history

Activation started on branch `activate-save-monitoring`, base `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`, from a clean checkout. The merged-main [verification run](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45609493011) passed. The repository's production database and DigitalOcean secret names match the backend workflow. The new monitoring environment had no settings or secrets; it was created without overwriting another environment. Grafana's sign-in flow reached GitHub login without an authenticated session. The owned browser tab was closed after the access check.

The older `supabase.com/prod-ca-2021.crt` URL returned 404. The current production download URL was traced from Supabase Studio's [SSL configuration](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Settings/Database/SSLConfiguration.tsx) and [custom content](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json). The downloaded CA is self-signed, has CA permissions, and expires on 2031-04-26. Its SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. It was stored as `MONITOR_DB_CA_PEM`. Two successful production snapshots now prove the configured TLS connection, pooler/grants, and SQL work for this observer. They do not prove a dedicated read-only role or a negative TLS test.

The [activation workflow](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45662881565) created app `457df394-b764-477d-8461-f190bbe474da` using the exact merged image SHA. `MONITOR_DO_APP_ID` is stored in `monitoring-production`; subsequent deployments must use `activation=update`. The first delivered heartbeat was `2026-11-25T17:33:37.016Z`; the next was `2026-11-25T17:48:07.943Z`. Both snapshots reported database and API health as 1. The later snapshot counted four visible messages, zero leased/backoff or delayed messages, no invalid messages, and no redeliveries. The oldest visible wait and processing journey age were both 624,084 seconds. These observations establish the queue stall, but not the worker's underlying failure.

Grafana stack `1939091` uses namespace `stacks-1939091`, Prometheus data-source UID `grafanacloud-prom`, and contact point `Cosmic save email`. Cloud metadata supplied the OTLP endpoint and stack username; the provisioning service-account token is separate from the collector's metrics token. Eight production rules evaluate with health `ok`; `processing_overdue` and `queue_visible_backlog` fire. Their firing emails arrived at 17:39:40 and 17:40:25 UTC in the configured inbox. Grafana 13.4 returned HTTP 410 for the older contact-point test endpoint; the discovered Receiver test subresource returned success, and its setup email was received. A separate, explicitly labeled temporary math rule verified firing and recovery without publishing fabricated production metrics or changing bookmarks. Its firing and resolved emails arrived at 17:54:50 and 17:57:50 UTC. The rule was then removed.

Cloud metadata describes the new account as `free-trial`, expiring on 2026-12-09. The monitoring assets use the features planned for the Free stack. The latest successful backend deployment, on November 16, logged the worker starting both `default` and `bookmarks` polling. That historical startup evidence does not establish current worker health.

The initial candidate comparison selected the stateless Opus checker and Sol's stricter boundary handling. Parent checks reran both candidates' SQL, including the selected candidate's 59 tests. Opus began integration but stopped at its usage limit. The user selected Sol to finish; Sol preserved the partial implementation and completed assets, packaging, and verification. Parent review then removed 44 narrative comment lines, made the stable queue clock and sample-size parameter explicit, and fixed the fetch mock type without changing runtime behavior.

The first GitHub proof failed at database startup. Parent reproduced the socket/TCP readiness race and changed the CI readiness probe to TCP. The following GitHub proof passed on `14ade678` before PR #260 merged; merged-main verification also passed during activation setup.

## Source decisions

- [App Platform alerts](https://docs.digitalocean.com/products/app-platform/how-to/create-alerts/)
- [Scheduled job limits](https://docs.digitalocean.com/products/app-platform/how-to/manage-jobs/)
- [App spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Current alert enum](https://github.com/digitalocean/godo/blob/main/apps.gen.go) uses `JOB_INVOCATION_FAILED`.

## Implementation selection

The parent and independent Opus cross-judge selected the Opus candidate. Its threshold object drives exact SQL counts, and it requires no cross-run state. The parent reran all 59 tests against the full schema and all 45 offline tests in the Linux Bun 1.3.11 image.

The Sol candidate contributes stricter URL validation and safe boundary/output handling. Its persistent orphan-state file is not adopted because an ephemeral scheduled job cannot retain it. Orphan evidence describes visible invalid queue backlog. Queue age does not date a bookmark deletion.

The 15-minute collector publishes small OTLP/HTTP JSON batches. Local Mimir accepted the payload and returned the submitted gauge through its Prometheus query API. Grafana queries use a 45-minute window to account for sparse samples. Live Cloud ingestion, the configured production database connection, recurring scheduled invocation, and actual firing-email delivery now pass; see [verification.md](verification.md) for the remaining limits.
