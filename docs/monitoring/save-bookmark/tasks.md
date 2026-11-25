# Save-bookmark production alerts

| Current state | Value |
|---|---|
| Outcome | Prepared monitoring is complete and approved by Sol. Host and pinned Linux checks pass: 144 offline tests, 14 SQL tests, and all 36 migrations loaded from scratch. Production queue diagnosis remains unconfirmed. |
| Next gate | Review the monitoring PR. After merge, configure the new Free stack and follow manual activation plus live verification. |
| Owner | This thread owns PR delivery; the operator owns Cloud configuration and manual activation. |
| Blocker | None for prepared assets. Live activation needs a new Grafana stack, an existing verified receiver, secrets, and production connectivity proof. |
| Scope | Grafana Cloud alerts and an independent read-only save-journey checker. |
| User choice | Latest steering: "Actually I’m considering going with grafana. It looks a more sustainable option in the long run." |
| Starting state | Clean branch `investigate-stuck-bookmarks`, base `0a0784e1cbb5c81c287eaa69442f23d43d59f568`. Live `origin/main` matched at start. |
| Release | Prepare for a new Free stack, as requested. No live account, alerts, or scheduled production job have been created. Activation is a separate manual step. |

## Behavior to prove

Observe accepted saves without claiming or changing queue messages. Detect prolonged visible queue wait, processing without an owner-matching message, saves exceeding their retry budget, and terminal infrastructure failures. Preserve source-access failures as context. An unavailable observer is an alert, never a healthy result.

The worker's four-minute deadline, five-minute queue lease, and 30/120/600-second retry backoff affect thresholds. A bookmark's `processing_started_at` records enqueue time initially and is reset at each worker delivery. Queue `enqueued_at` supplies the stable journey clock across automatic retries. `idle` is intentional daily AI-budget deferral. Empty traffic is not evidence of a successful save journey.

Only opaque IDs, counts, phases, and fixed failure codes belong in reports. Never publish bookmark titles, URLs, content, user IDs, provider errors, or credentials.

## Delivery

Publish checker observations to Grafana Cloud. Provision a save-journey dashboard, alert rules, and a missing-observation alert. Do not use application code to restart services or replay bookmarks automatically.

Grafana credentials, notification destinations, and an actual received notification remain activation checks. The collector can retain the chosen 15-minute DigitalOcean cadence. Grafana queries must account for sparse samples, and a missing-observer alert must detect scheduler or ingestion outages.

## Evidence

See [verification.md](verification.md) for the final checks, corrections, and activation gaps. The integrated implementation passes 144 offline tests and 14 real-SQL tests against all 36 unchanged migrations. Local Grafana 13.3.2 and Mimir 3.2.6 proof covers provisioning, ingestion/readback, sparse samples, alert firing, query errors, and healthy recovery. The development queue inspected earlier is unrelated to production and is not production evidence.

## Implementation history

The initial candidate comparison selected the stateless Opus checker and Sol's stricter boundary handling. Parent checks reran both candidates' SQL, including the selected candidate's 59 tests. Opus began integration but stopped at its usage limit. The user selected Sol to finish; Sol preserved the partial implementation and completed assets, packaging, and verification. Parent review then removed 44 narrative comment lines, made the stable queue clock and sample-size parameter explicit, and fixed the fetch mock type without changing runtime behavior.

## Source decisions

- [App Platform alerts](https://docs.digitalocean.com/products/app-platform/how-to/create-alerts/)
- [Scheduled job limits](https://docs.digitalocean.com/products/app-platform/how-to/manage-jobs/)
- [App spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Current alert enum](https://github.com/digitalocean/godo/blob/main/apps.gen.go) uses `JOB_INVOCATION_FAILED`.

## Implementation selection

The parent and independent Opus cross-judge selected the Opus candidate. Its threshold object drives exact SQL counts, and it requires no cross-run state. The parent reran all 59 tests against the full schema and all 45 offline tests in the Linux Bun 1.3.11 image.

The Sol candidate contributes stricter URL validation and safe boundary/output handling. Its persistent orphan-state file is not adopted because an ephemeral scheduled job cannot retain it. Orphan evidence describes visible invalid queue backlog. Queue age does not date a bookmark deletion.

The 15-minute collector publishes small OTLP/HTTP JSON batches. Local Mimir accepted the payload and returned the submitted gauge through its Prometheus query API. Grafana queries use a 45-minute window to account for sparse samples. Live Cloud ingestion, Supabase TLS/pooler access, and a received alert remain unverified.
