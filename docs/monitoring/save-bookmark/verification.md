# Save-bookmark monitoring verification

PR #260 prepared alerts for server-accepted saves. The user authorized production activation after merging it. The separate collector and Grafana resources are now active, and real production backlog alerts reached the configured inbox. Production observation confirms four stuck saves; the worker's underlying failure remains under investigation.

## Local checks

| Check | Result |
| --- | --- |
| Host Bun 1.3.13 offline suite | 144 passed, 591 assertions |
| Linux image, pinned Bun 1.3.11, network disabled | 144 passed, 591 assertions; fixture JSON preserved through a pipe |
| Fresh Supabase Postgres 15.19.0.004 | Host and pinned Linux Bun 1.3.11 loaders applied all 36 unchanged migrations and created the fixture marker; each real-SQL run passed 14 tests, 49 assertions |
| Strict TypeScript check of every monitoring script and test | Passed using existing workspace TypeScript and bun-types; no dependencies installed |
| Generated Grafana JSON | Exact deterministic match |
| Workflows and App Platform spec | Parsed; activation has only a manual trigger |
| Actual Grafana 13.3.2 | All eight generated rules and 16 dashboard panels created/read back; repeat apply updates existing resources |
| Actual Mimir 3.2.6 OTLP ingestion | All 16 metric families read back with exact names and values, including optional completion context |
| Sparse samples and observer failure | Ten-minute-old samples visible through the 45-minute query; absent/aged heartbeat detected; failed observer suppresses retained business alerts |
| Alert and recovery evaluation | Business/API/observer/missing-data alerts fired; query failure created DatasourceError; healthy recovery left all eight rules inactive with health OK |

The SQL suite proves overdue detection survives redelivery resetting `processing_started_at`, validates malformed UUID payloads, checks owner matching and threshold edges, excludes intentional idle/backoff states, classifies terminal failures, and checks privacy and database failures. Queue rows remain unchanged. An UPDATE and `pgmq.read` both fail inside the observer transaction.

The local receiver has zero integrations. This proves routing configuration and alert state, not delivery to a person. Every dashboard query executes against Mimir. No shared test database, application schema, API contract, or application process was changed.

## Reproduce

The [architecture blueprint](blueprint/architecture.html) was checked at 728px and 390px widths. All eight component buttons, four failure scenarios, three views, keyboard tab navigation, and the source accordion worked. The browser reported no page errors, external resource loads, or horizontal overflow. A separate Sol content review approved the architecture and stated activation limits. The HTML is self-contained and opens without a server.

The [runbook](../../runbooks/save-bookmark-monitoring.md#rerun-isolated-verification) and `.github/workflows/verify-monitoring.yml` contain the commands and fresh-container protocol. The test target must be an explicitly owned loopback database with a populated fixture marker; port 5433 is refused. The loader refuses an occupied database.

Build the monitoring Dockerfile from the repository root in an isolated Docker context, then run the five offline test files and healthy fixture with networking disabled. The image starts only the collector and installs no dependencies.

## Corrections retained in the evidence

- Immediate `process.exit` dropped a piped report in the first image proof. The CLI now sets `process.exitCode`; repeated subprocess checks prove complete output.
- Grafana rejected a dashboard-linked rule without a panel ID. Assets now include both annotations; actual create/update/readback succeeds.
- A sparse-sample test reused a local series with an intervening sample. An isolated fixture environment proved the expected default-lookback gap.
- Grafana query errors create a separate DatasourceError alert. The proof now checks that alert rather than waiting for the source rule to fire.
- The emulated Linux CLI test needed a bounded 20-second timeout for ten cold subprocesses. Its assertions were retained.
- Strict typechecking exposed mocks depending on Bun fetch's unused `preconnect` member. HTTP dependencies now use the callable fetch signature; the suite and strict check pass.
- Two Linux migration-loader attempts in the shared 2 GB Docker context exited 137 without output. Shared infrastructure was left untouched. The identical pinned Linux loader passed in the task's isolated build context, with a fresh owned database and no container memory cap. Host fresh-loader and all real-SQL checks passed independently.
- The first GitHub proof reached the migration loader while the container's temporary initialization server accepted Unix-socket connections but its TCP server was unavailable. A fresh-container reproduction observed socket readiness at 1.07 seconds, TCP unavailable, and loader exit 2; TCP became ready at 1.85 seconds. CI now checks TCP explicitly before loading migrations. No timeout was increased.

## Production activation on 2026-11-25

| Check | Result |
| --- | --- |
| Merged-main verification | [Run 45609493011](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45609493011) passed on `08bef9224c8cbdedf4f14ca75c866eb04c62b94a` |
| Separate collector activation | [Run 45662881565](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45662881565) passed; app `457df394-b764-477d-8461-f190bbe474da` created with the exact merged image |
| Production database/API connection | Two delivered snapshots report observer health 1 and API health 1 using the configured production CA and connection |
| Recurring invocation and Cloud ingestion | Heartbeats advanced from 17:33:37.016 to 17:48:07.943 UTC; both snapshots are readable through the Cloud Prometheus data source |
| Cloud provisioning | Grafana 13.4 accepts namespace `stacks-1939091`; dashboard has 16 panels. Final readback at 18:00:20 UTC confirms exactly eight owned rules, matching queries, a one-minute pending period, no-data alerting, error alerting, the intended receiver, and removal of the temporary rule. All eight production rules evaluate with health `ok` |
| Actual production incident | Four processing saves and four visible messages; no delayed/leased messages, invalid messages, or redeliveries. Oldest wait 624,084 seconds in the second snapshot |
| Real firing delivery | Both production backlog-alert emails received in the configured inbox at 17:39:40 and 17:40:25 UTC |
| Contact-point test | Old endpoint returned HTTP 410. Discovered Receiver test subresource returned success; the setup test email was received |
| Recovery delivery | Separate labeled temporary math rule produced firing and resolved emails at 17:54:50 and 17:57:50 UTC. The rule was removed; no fabricated production gauges or bookmark writes |

## Remaining limits

A new accepted client save remains unverified. The successful database reads prove the configured observer connection works, not that a dedicated read-only role was provisioned or that a negative production TLS test passed. Current worker status/logs remain unavailable. The [incident diagnosis](production-incident-2026-11-25.md) reproduces a missing dispatcher wake-up with the deployed configuration. No production repair has occurred. Monitoring observes failures and does not repair the queue.

GPT-6.1 Sol approved the prepared implementation with no blocking correctness or safety finding. The initial comparison had an independent Opus review. The user selected Sol after the Opus usage limit; the final audit lacks vendor diversity. The reviewer checked code, specs, the decision log, and local receipts. A repository transcript was unavailable.
