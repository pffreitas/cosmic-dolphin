# Production log activation, 2026-11-25

Live in [Grafana](https://tenderlimpet2779.grafana.net/d/cosmic-production-logs): native API, worker and web runtime logs, plus one direct snapshot from each scheduled save-monitor run. The existing save metrics and alerts continue operating. The worker dispatcher defect remains unrepaired.

## Deployed versions

| Component | Production version | Verified delivery |
| --- | --- | --- |
| Log bridge | `f4cb0cf1a2bdd7743e0719dd9ada59147f0b44f8`, Git branch `main` | ACTIVE, process health, auth rejection and direct heartbeat in Loki |
| API | `a533a2c326d1e120af6c85a488666fa4b520a2d6` | Native runtime records in Loki |
| Worker | `a533a2c326d1e120af6c85a488666fa4b520a2d6` | Native records, including actual `bookmarks` queue startup |
| Web | `a533a2c326d1e120af6c85a488666fa4b520a2d6` | Native startup records after missing-message compatibility fix |
| Save monitor | `cc298e98293cd9093fa51c559ea930434e7ad61d` | SCHEDULED invocation, metrics/log acknowledgements, matching Loki snapshot |

Native destination `cosmic-grafana-logs` remains configured on all four source components. API/worker/web images and settings were preserved during the monitor update. The bridge app is `20e573b4-5222-42c2-ab23-63eb5b6f18d5`; the monitor app is `457df394-b764-477d-8461-f190bbe474da`. The always-running bridge costs $5/month; Grafana and scheduled-job plan/runtime billing remain separate.

## Scheduled receipt

- [PR #263](https://github.com/pffreitas/cosmic-dolphin/pull/263) merged at 23:25:31 UTC as `cc298e98`. Its tree matches reviewed head `487ebb88`; all three checks and the [independent Shipping verdict](https://github.com/pffreitas/cosmic-dolphin/pull/263#issuecomment-7177506290) passed.
- [Deployment 45721307422](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45721307422) passed from the exact merge. App Platform ACTIVE deployment is `10cd10c0-c39f-41ab-bf20-23dcf924e0ce`, with `--publish --publish-log` and the configured 15-minute UTC schedule.
- Invocation `36e7c84e-0e77-458c-8060-28d8c4afa41e` has trigger `SCHEDULED`, started at 23:33:34 UTC and completed at 23:33:35 UTC. Retained output reports `delivery: ok`, `logDelivery: ok`, and one log record. DigitalOcean phase `FAILED` corresponds to the alerting checker's exit 1; both delivery operations succeeded.
- Loki returned the matching production snapshot with database observation time `2026-11-25T23:33:34.478Z` and log timestamp `1795649615402000000`. API/database observations are `ok`, observer gauge is 1, status is `alerting`/WARN, and counts are six processing bookmarks and six visible queue messages. `queue_visible_backlog` and `processing_overdue` remain active. This is a real database observation, not a synthetic production fixture.
- The two-hour source query at 23:34:42 UTC returned API 254, worker 17, web 6, save-monitor 1 and bridge 124 records. These are bounded-window receipts, not cumulative totals or proof that a quiet worker is progressing.

## Validation and operating limits

The same code-review ledger finished at 6/6 APPROVE; the user explicitly authorized round six. [Fresh monitoring CI](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45720424696) passed 155 offline tests, all 14 SQL tests after every migration, and 155 tests in the pinned Linux Bun 1.3.11 image. Actual CLI/HTTP verification covered acknowledgements, rejection, deadline/recovery, privacy, byte limits, fixed labels and production target fencing. No production bookmark/queue repair or worker behavior change was performed.

Grafana readback confirms 12 panels and the bridge heartbeat rule routed to `Cosmic save email`, with no-data Alerting, execution errors Error and two-minute pending. Its actual evaluation is inactive/healthy. All eleven dashboard queries returned HTTP 200 after the scheduled snapshot arrived. Earlier contact-point firing/recovery receipts are separate from this rollout's configuration/evaluation proof.

Scheduled snapshots contain safe counts/status only; full scheduled stdout/stderr is retained in DigitalOcean and is not forwarded by this fallback. Native forwarding covers new runtime records, excluding build/deploy logs and historical backfill. The bridge has no durable spool; platform retries/retention bound outage recovery. Counters reset on process restart. Redaction removes known secrets/private fields but cannot guarantee arbitrary free-form text is private. Grafana's current plan determines retention and ingestion limits.

Use the [log runbook](../../runbooks/digitalocean-logs.md), [collector runbook](../../runbooks/save-bookmark-monitoring.md), and [worker incident diagnosis](../save-bookmark/production-incident-2026-11-25.md) for investigation and the separate repair gate.
