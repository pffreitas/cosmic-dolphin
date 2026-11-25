# Save-bookmark monitoring verification

The delivered change prepares alerts for server-accepted saves. It creates no Cloud account, production deployment, or recipient notification. The original production queue incident remains unconfirmed because production database access was unavailable.

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

## Activation gaps

Grafana Cloud Free account/namespace behavior, production Supabase URL/TLS trust/Supavisor/grants/RLS, DigitalOcean deployment and scheduled invocation, a real accepted client save, and notification/recovery delivery need live verification. Follow the activation runbook before treating the setup as active production monitoring.

GPT-6.1 Sol approved the prepared implementation with no blocking correctness or safety finding. The initial comparison had an independent Opus review. The user selected Sol after the Opus usage limit; the final audit lacks vendor diversity. The reviewer checked code, specs, the decision log, and local receipts. A repository transcript was unavailable.
