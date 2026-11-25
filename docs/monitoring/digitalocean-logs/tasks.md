# DigitalOcean logs in Grafana

| Current state | Value |
| --- | --- |
| Outcome | PRs #261 and #262 are merged. The bridge is ACTIVE from `main` at `f4cb0cf1a2bdd7743e0719dd9ada59147f0b44f8`. Backend/web releases passed. Native API, worker, and web runtime logs are readable in Grafana. The scheduled monitor publishes metrics, but its runtime output has not reached the bridge. A tested direct snapshot-log fallback is prepared locally. |
| Next gate | Publish the approved fallback, independently verify the PR, land and deploy it; prove an actual scheduled snapshot in Loki. |
| Owner | This thread owns configuration, delivery, and live verification. |
| Blocker | No access blocker. The sixth and final authorized code review approved the fallback. PR verification and live scheduled delivery remain open. |
| Starting state | Branch `activate-save-monitoring`, base and live `origin/main` `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`. Existing monitoring activation/incident documentation changes are preserved. |
| Delivery branch | `integrate-digitalocean-logs`, updated without conflicts to live main `f312e01dc0a871221e7d99b27ad0f80267cdad57` before review. |
| Fallback starting state | Clean branch `finish-save-monitor-log-export`, base `f4cb0cf1a2bdd7743e0719dd9ada59147f0b44f8`; no application, queue or environment-file changes. |

## Scope and completion gate

Forward production API, worker, web, and save-monitor runtime logs to the existing Grafana Cloud stack. Keep labels bounded by source and environment. Preserve useful error and queue context while redacting credentials and private payload fields. Provide searches and a dashboard that connect the save-journey alerts with runtime logs. No bookmark repair or worker code change belongs to this task.

Completion requires a real forwarded runtime log readable through Grafana Loki for each configured source, verified authentication and failure handling, and recorded source configuration that survives later app deployments. Confirm that an upstream ingestion failure is not acknowledged as successful delivery. Record limits of platform retention, runtime-only forwarding, and redaction.

## Transport decision to verify

DigitalOcean's native App Platform log destinations support Datadog HTTP intake with a configurable endpoint, but no direct Loki destination. A small compatible receiver translates native pushes to Grafana OTLP logs. This avoids deploying a DigitalOcean account credential in the receiver or polling recent log snapshots. DigitalOcean accepted a read-only proposal with the custom destination; actual native delivery remains the activation gate.

The data shape is `authenticated source → bounded Datadog batch → normalized/redacted log records → OTLP logs acknowledgement`. Source keys map to the fixed names `api`, `worker`, `web`, and `save-monitor`. The receiver acknowledges only after Grafana accepts the batch. Authentication and transport errors have fixed codes; raw response bodies and keys stay out of its logs.

## Work sequence

1. Complete scoped DigitalOcean sign-in and inventory the production apps without exposing environment values.
2. Verify the forwarding contract and build a bounded receiver with offline transport, redaction, and delivery tests.
3. Prepare reproducible receiver deployment and guarded source configuration, preserving all other live app settings.
4. Configure Grafana log searches/dashboard and bridge health visibility.
5. Activate and verify live delivery, source coverage, and failure/recovery behavior. Record exact deployed versions and remaining gaps.

## Implementation and initial activation evidence

- The four production apps are `ACTIVE`. Their existing image versions were recorded before configuration changes. API, worker, and web use `0a0784e1cbb5c81c287eaa69442f23d43d59f568`; save-monitor uses `08bef9224c8cbdedf4f14ca75c866eb04c62b94a`.
- The existing worker's retained logs show both queues starting with concurrency 5 and order `default`, then `bookmarks`, without a recorded queue-read error. This supports the separate dispatcher diagnosis; logging rollout does not repair it.
- The bridge passed 23 tests and 224 assertions inside its exact pinned Bun 1.3.11 Linux image. The actual Dockerfile CMD and `/health` smoke passed with external network disabled. Deployment/source-overlay tests passed on pinned Bun separately.
- Grafana accepted a labeled setup log and returned it through `grafanacloud-logs`. Resource labels normalize to `service_name` and `deployment_environment_name`.
- Grafana has the new 12-panel dashboard. The heartbeat rule was initially staged, then enabled after a real receiver heartbeat arrived at 21:51 UTC.
- The new `log-observability-production` environment holds the publisher and source-key map. Four matching source-key repository secrets are configured. No keys are recorded here.
- Primary `godo` source confirms the bridge update field is `update_all_source_versions`. It refreshes only the owned receiver's source. Live source-app log overlays preserve their image versions.
- The DigitalOcean API accepted the new receiver proposal and reports a $5 monthly app cost. This is separate from the existing Grafana stack. The receiver is now deployed; native source coverage remains a separate gate.
- Before compatibility corrections, 71 host tests passed with 884 assertions. The Grafana suite also passed on pinned Linux Bun 1.3.11. All eleven generated dashboard queries execute against Cloud Loki. Native API records subsequently confirmed real forwarding.

## Merged release

- Independent Shipping verification posted [PASS+NOTES](https://github.com/pffreitas/cosmic-dolphin/pull/261#issuecomment-7175818756) for exact head `8eda4bb719d6c8c6cfa9bae584e962b161c08bb6`: 76 tests / 911 assertions; both base/head monitoring replays 144 tests / 591 assertions; real HTTP and all four source CLI overlays. Linux/Cloud evidence remained the parent's gate.
- All three PR checks passed. PR #261 merged at 22:01:34 UTC as `a533a2c326d1e120af6c85a488666fa4b520a2d6`. `git diff` between the reviewed PR head and merged tree is empty. No unrelated application behavior was changed.
- Exact merged-SHA backend release: [45709625464](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45709625464), SUCCESS: backend build/tests, pinned Supabase migration gate, actual Linux API/worker image builds/pushes, packaged browser extraction proof, source overlays, and both waited App Platform deployments. Web release: [45709625579](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45709625579), SUCCESS: generation, typecheck/lint/tests/build, Docker build/push, overlay, and deployment.
- Bridge update from `main`: [45709964586](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45709964586). Offline tests, native Linux image, packaged runtime suite, actual CMD health smoke, and deployment request passed. Actual App Platform rollout/readback is a separate gate.
- Scheduled checker invocation `032dcbed-6f45-4aa7-b9eb-d1dbf43af080` ran at 22:04 UTC and reported metric delivery `ok`. An alerting checker exits 1, so DigitalOcean's job phase `FAILED` alone is not evidence that observation or publishing failed.
- At 22:10 UTC, API, worker, and web were ACTIVE on image tag `a533a2c3`, with `cosmic-grafana-logs` preserved. Loki returned 12 API and 17 worker records in the 30-minute window, including one actual `Starting to process queue: bookmarks` marker. Native startup output does not prove queue progress.
- Live Grafana readback at 22:08 UTC confirmed 12 panels and one heartbeat rule routed to `Cosmic save email`, no-data Alerting, execution errors Error, pending 2m. Actual evaluation was inactive with health `ok`.
- Round-4 diagnostic source `384f02a3bd2c859f3632009cb6bcfb11c3b0882a` was independently approved, then passed 28 tests / 292 assertions inside pinned Linux Bun 1.3.11 (local amd64 emulation). Controlled bridge rollout reached ACTIVE at 22:12 UTC. Only the bridge's source changed; source image tags, bookmark state, and worker code remain untouched. Web restart `b1a39d65-d727-4614-9650-b3e96ff0e9c3` triggers fresh native startup logs to identify the structural mismatch.

- At 22:12 UTC, the bridge heartbeat recorded an authenticated gzip web rejection with `batchCause: missing_message`. The compatibility fix retains such native events as scrubbed structured JSON instead of rejecting the whole batch. Non-object events, supplied non-string messages, and all byte/count/time/concurrency/ACK bounds remain enforced. No rejected payload contents were captured.

## Review ledger

The standalone Sol review cap started at three rounds across implementation and activation fixes. At 22:06 UTC, actual authenticated gzip web batches failed as `invalid_batch`, proving a native log delivery/data-loss blocker. Under sol-loop's explicit data-loss exception, the same ledger extends to five total rounds; it is not reset. Comment cleanup precedes review. Existing monitoring implementation reviews belong to the earlier merged feature; they are not approval of this extension.

| Round | Model | Scope | Outcome |
| --- | --- | --- | --- |
| 1 | GPT-6.1 Sol | Full log integration on base `f312e01d`, including uncommitted files | CHANGES. S1 monitoring tests ran after template mutation; S2 existing secret-bearing templates retained 0644 permissions. Both fixed; recheck pending |
| 2 | GPT-6.1 Sol | Changed monitoring gate order and private spec writer | APPROVE. S1 and S2 independently resolved. Candidate approved for controlled activation; native delivery remains open |
| 3 | GPT-6.1 Sol | Root-path intake, bounded gzip, and safe rejection metadata | APPROVE. No blocker/should finding. Documentation nit S3 fixed. Three-round review cap exhausted; real native receipts remain required |
| 4 | GPT-6.1 Sol | Fixed structural diagnostics for rejected native batches | APPROVE. Reviewer independently ran 77 tests / 959 assertions. No findings; HTTP validation/ACK behavior unchanged. Diagnostic red test failed before the implementation. One further round remains under the data-loss extension |
| 5 | GPT-6.1 Sol | Preserve native events that omit `message` as redacted structured records | APPROVE, no findings. Reviewer independently ran 78 tests / 964 assertions. Actual web heartbeat identifies `missing_message`. Real gzip regression failed 400 before the fix and passes 202 afterwards. Pinned Linux: 29 tests / 297 assertions. Existing held-ACK and whole-event byte-limit proofs cover missing-message records too. Five-round cap exhausted |
| 6 | GPT-6.1 Sol | Direct scheduled snapshot-log fallback on base `f4cb0cf1` | APPROVE, no findings, for candidate `f47f2cbf`. Reviewer independently passed 155 tests / 673 assertions, strict typecheck and deterministic assets. User authorized this one additional review; no seventh round authorized |

## Compatibility release and remaining scheduled-job gap

- [PR #262](https://github.com/pffreitas/cosmic-dolphin/pull/262) merged at 22:50:16 UTC as `f4cb0cf1a2bdd7743e0719dd9ada59147f0b44f8`, after both checks passed and the isolated Shipping verifier posted [PASS+NOTES](https://github.com/pffreitas/cosmic-dolphin/pull/262#issuecomment-7176831258). This verifier reran actual base/head processes, HTTP, all source overlays, 78 bridge tests and 144 monitoring tests. It was functional verification, not an additional code-review round.
- The reviewed head `9b3e217a` and merged tree are identical. [Main bridge deployment 45716607869](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45716607869) passed its checks; actual App Platform readback confirms ACTIVE source `f4cb0cf1`, Git branch `main`, and no in-progress deployment.
- At 22:54 UTC, the two-hour native coverage query returned 18 API, 17 worker and six web records. Web runtime logs arrived after the missing-message fix. No authenticated production-source fixture was submitted by the agent. Source image tags remain `a533a2c3` for API/worker/web and `08bef922` for save-monitor.
- Scheduled invocation `17bb2df2-aee0-4e02-adeb-58055c1a948c` ran at 22:48 UTC. Its retained native output is readable through DigitalOcean and reports `api: ok`, `database: ok`, alerts `queue_visible_backlog`/`processing_overdue`, and metric delivery `ok`. No save-monitor batch or log stream appeared at the bridge/Loki after this invocation. Earlier scheduled runs also had no source receipt. This establishes a forwarding gap; it does not establish a specific internal DigitalOcean cause.
- Prepared fallback: explicit `--publish --publish-log` sends one count/status snapshot directly through the existing validated Grafana OTLP target and credential, then waits for a bounded log acknowledgement before exiting. It uses existing safe gauge samples; sampled IDs, notes, private text and runbook URLs are excluded. Each metric/log delivery remains independent; either failure exits 3 while retaining the observation report. Metric-only `--publish` remains supported. Full scheduled stdout/stderr forwarding remains a platform limitation to track separately.
- The main-function HTTP test failed with exit 2 and no log request before the flag existed. It now produces acknowledged metric and log requests; a separate actual CLI process test also passes. Pinned Linux Bun 1.3.11 image: **155 tests / 673 assertions**, including the actual CLI, held log ACK, response-body deadline/recovery, partial/malformed rejection, redirect refusal, privacy, payload bounds and fixture-to-production fence. Host baseline: 154 tests / 669 assertions; the final 11 log tests / 82 assertions also pass. Strict targeted TypeScript checking is clean using an existing TypeScript/bun-types installation; no dependency was installed or changed. Workflow structural validation passes. ShellCheck's existing SC2034 unused `attempt` warning in the unchanged database-readiness loop remains.
- The fallback is approved but has not been deployed. The same ledger is now 6/6, with the user-authorized sixth round APPROVE and no seventh round authorized. The existing three native sources, bridge heartbeat rule, and save metrics/alerts stay live. The worker missing-wakeup defect and four stuck bookmarks are unchanged by this task.

Comment review removed 16 narrative blocks without changing runtime behavior. Its two accepted design findings are encoded by one named request ceiling shared with the native parser, and an explicit `stageAssets` factory. The staging factory keeps canonical enabled/staged assets distinct without adding mutable mode state or a bypass option to the provisioner.

S1 proof replays the actual three non-network monitoring workflow steps in an owned temporary checkout with fictional production-shaped configuration. All 144 offline tests pass before the overlay, the overlay succeeds, and the combined spec/config checks pass afterwards. No deployment or business-network step runs. S2 has a CLI regression test that overwrites an existing 0644 template, proves 0600 permissions and unchanged key bytes, and refuses a symlink without leaking its key.

Live activation uses the platform's configurable endpoint origin. The initial receiver supported only Datadog subpaths and rejected gzip. A production-shaped API request produced no native Loki records. Compatibility corrections accept authenticated intake at the endpoint root as well as Datadog paths and bound both gzip wire and expanded bytes. Heartbeats now include safe rejection categories so an intake mismatch is observable. These changes require the third review round. The new local tests pass; two initial assertions were corrected because the fixture key maps to API, not worker. No source-app or worker behavior changes accompany these receiver fixes.

The current suite passes 76 tests and 911 assertions. A chunked gzip error fixture initially reused a dangling Bun client connection and received an empty native 400 on its recovery request. The fixture now consumes both rejection bodies and disables reuse for that invalid chunked upload; the recovery assertion remains 202. No timeout was increased. Earlier pinned Linux tests passed with the unmodified recovery assertion.

The compatible receiver's exact deployed source is `7b245306e0c1a994b4b71597c8ccf931a44fb6b1`. Its `/health` returns 200; an unauthenticated intake returns 401. At 21:51:26 UTC, Loki returned five native API records and direct bridge heartbeats. No authenticated production-source fixture was submitted by the agent. The repository bridge URL and environment app ID are configured for future release workflows. The worker and web are otherwise quiet until startup/activity; save-monitor emits on its 15-minute schedule. Their native receipts must still be observed.

## Sources

- [DigitalOcean log forwarding](https://docs.digitalocean.com/products/app-platform/how-to/forward-logs/)
- [DigitalOcean app specification](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [doctl browser OAuth](https://docs.digitalocean.com/reference/doctl/reference/auth/login/)
- [Grafana OTLP ingestion](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/)
