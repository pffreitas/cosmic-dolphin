# Production bookmark queue diagnosis, 2026-11-25

The strongest supported cause is a missing wake-up in the worker dispatcher. The bug reproduces with the production queue order and concurrency. DigitalOcean access and Grafana log forwarding are now available; current worker ACTIVE/startup evidence supports the configured queue order, while the missing wake-up itself remains demonstrated by the local dispatcher reproduction. No worker repair or manual bookmark/queue mutation was performed.

## Current observability

The [log activation receipt](../digitalocean-logs/activation-2026-11-25.md) confirms native worker records in Grafana, including the actual `bookmarks` queue startup. Worker image `a533a2c3` has the same dispatcher source as `0a0784e1`; the release changed no dispatcher behavior. The real scheduled snapshot at 23:33:34 UTC reports six processing bookmarks and six visible queue items, API/database healthy, and `queue_visible_backlog`/`processing_overdue` alerts. These are current inventory counts; no repair is implied. Use the [production log dashboard](https://tenderlimpet2779.grafana.net/d/cosmic-production-logs) with the incident time range for runtime context.

## Log-based follow-up, 2026-11-26 01:31 UTC

The evidence strongly supports dispatcher starvation before bookmark handling. The deployed worker is ACTIVE on `a533a2c326d1e120af6c85a488666fa4b520a2d6`, deployment `f42a3e34-9ef7-41e4-a372-7d935565cd8b`. Live configuration matches `QUEUE_NAMES=default,bookmarks`; startup reports two queues and concurrency five. Current main `4c8d362f` contains no subsequent worker or worker-spec change.

The focused Loki query covers 2026-11-25 21:15 UTC through 2026-11-26 01:31 UTC. It returns 17 worker records, all startup, including both queue-loop starts. There are no queue-read errors, ERROR/FATAL records, or `Processing bookmark` handler entries. The handler emits that INFO entry before calling extraction/AI, so the stop is before that boundary. Generic dispatcher completion is DEBUG-only and is not used as the decisive evidence.

Eight actual scheduled snapshots from 23:33:34 through 01:18:04 UTC show six processing bookmarks and six visible queue messages, zero leased/backoff, delayed or redelivered messages, zero recent completions, and healthy API/database observations. The latest shows all six overdue and an oldest visible wait of 651,080 seconds. No infrastructure failure count is recorded. Fifteen-minute samples can miss brief leases, so the lack of handler-entry logs is an independent part of the evidence.

Queries used with `grafanacloud-logs`:

```logql
{service_name="cosmic-dolphin-worker",deployment_environment_name="production"}
```

```logql
{service_name="cosmic-dolphin-save-monitor",deployment_environment_name="production"} |= "save_bookmark_snapshot"
```

The three tested explanations were missing dispatcher wake-up, queue configuration/access failure, and a provider/extraction stall. Startup/configuration rules out a missing bookmark queue. Queue errors expected from access/connectivity failures are absent; the deployed database pool has a ten-second connection timeout. The provider explanation is unsupported because handler-entry logs are absent. The remaining qualification is that logs do not record reservation release or `waitForSlot()` transitions directly; those are reproduced against the exact dispatcher source below. Shared batch timestamps also do not establish the order of startup log lines—the order comes from verified live configuration and the loop's source.

No worker code, production configuration, queue messages or bookmark rows were changed in this follow-up. The repair control used an isolated source copy only. This request was diagnosis; release of the repair remains the separate gate below.

## Production observations

The collector repeatedly sees four processing bookmarks and four visible, owner-matched queue messages. It sees no delayed or leased messages, no invalid messages, and no redeliveries. The API health check and database snapshot succeed. The snapshot delivered at approximately 18:04:53 UTC reports an oldest claimable wait of 625,089 seconds, about seven days.

At initial diagnosis, the latest successful [backend deployment](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43901840613) deployed SHA `0a0784e1cbb5c81c287eaa69442f23d43d59f568` on November 16. Startup logs show two queues, concurrency 5, and polling configured in the order `default`, then `bookmarks`. The current dispatcher source is unchanged from that deployed SHA. The [worker app spec](../../../.do/worker-app.yml) also sets `QUEUE_NAMES=default,bookmarks`.

Those initial startup logs describe November 16. At initial diagnosis, current DigitalOcean access was unavailable after a declined credential request. The user later explicitly authorized DigitalOcean login and log integration; current ACTIVE/startup receipts are recorded above. They establish process/configuration state, not queue progress.

## Dispatcher failure

The [queue read loop](../../../apps/worker/src/queue/queue.processor.ts) shares a pool of five slots between both queues.

1. The `default` loop reserves all five slots before awaiting its first database read.
2. The `bookmarks` loop sees no free slot and awaits `waitForSlot()`.
3. An empty `default` read releases its reservations in `finally`.
4. Reservation release does not call `wakeSlotWaiters()`. The bookmark loop stays asleep.
5. The empty default loop sleeps and polls again. No message completes, so the existing completion wake-up never runs.

The worker can remain alive and continue polling the empty default queue while never reading bookmarks. Save acceptance still works because the API persists the bookmark and enqueues its message independently.

## Local proof

A throwaway harness imports the real `QueueProcessor`. It substitutes the logger, configuration, and queue transport, so it performs no network or database access. It presents an empty default queue and one waiting bookmark. Its behavioral assertions require a bookmark read and handler completion.

The existing dispatcher suite could not start in this checkout because `@nestjs/common` is not installed. The isolated harness mocks that framework boundary and the queue transport, while executing the unmodified dispatcher logic.

| Experiment | Result |
| --- | --- |
| Original source, `default,bookmarks`, concurrency 5 | Reproduced twice. Only default reads occur. The bookmark remains waiting and the assertion fails |
| Original source, `bookmarks,default` | Bookmark read and handled |
| Isolated source copy, original production order, wake waiters after releasing read reservations | Bookmark read and handled |

These controls isolate the missing wake-up. Reversing the order is a diagnostic control, not a deployed repair. The source copy adds `this.wakeSlotWaiters()` after `this.reserved -= count`; the repository worker source remains unchanged.

### Durable reproduction

The [standalone reproduction](reproduction/queue-starvation.spec.ts) imports the real dispatcher, mocks only framework/transport boundaries, and performs no database or provider requests. It is intentionally outside application CI and fails while the production bug is present.

```sh
bun --no-env-file test docs/monitoring/save-bookmark/reproduction/queue-starvation.spec.ts
```

Rechecked against the current source: exit 1 in approximately 80ms, nine default reads, no bookmark read, no handler completion, one message waiting. A source copy differing by exactly one wake-up line passes with a bookmark read/completion. Reversing queue order also passes. The assertions concern actual polling/handling, not whether a wake-up method was called.

To recreate the one-line source-copy control without recovering a temporary artifact, run from the repository root:

```sh
starvation_control_dir=$(mktemp -d)
python3 - "$starvation_control_dir/queue.processor.ts" <<'PY'
from pathlib import Path
import sys
text = Path("apps/worker/src/queue/queue.processor.ts").read_text()
needle = "this.reserved -= count;"
assert text.count(needle) == 1
Path(sys.argv[1]).write_text(text.replace(needle, needle + "\n        this.wakeSlotWaiters();"))
PY
STARVATION_PROCESSOR_PATH="$starvation_control_dir/queue.processor.ts" bun --no-env-file test docs/monitoring/save-bookmark/reproduction/queue-starvation.spec.ts
rm -rf "$starvation_control_dir"
```

## Repair gate

Add a regression test through the real multi-queue dispatcher boundary before changing worker behavior. Verify reservation release after empty reads, failed reads, and partial batches without exceeding shared concurrency. Then complete the repository backend release gate before deploying a fix. Confirm the existing production messages progress and the two Grafana alerts resolve. No manual message replay is needed merely to make a visible message claimable.

## Queue simplification audit

No current application producer for the `default` queue was found. Its creation is legacy scaffolding in the initial pgmq migration. `DefaultMessageHandler` is a catch-all logger for unknown message types in any consumed queue; it is not a business producer for a queue named `default`.

A production query at 2026-11-26 02:01:08 UTC used the worker's existing credential after the production target fence, verified TLS, and an explicitly read-only transaction with statement/lock limits. It selected counts only and called no queue claim, send, delete or archive function.

| Queue | Current producer | Queued | Ever claimed among current messages | Archived |
| --- | --- | --- | --- | --- |
| `default` | None found | 0 | 0 | 0 |
| `bookmarks` | Save/reprocess repository paths | 6 | 0 | 24 |
| `digests` | `DigestSchedulerService` | 116 | 0 | 0 |

The worker's live `QUEUE_NAMES=default,bookmarks` omits `digests`, while the digest scheduler remains enabled by default. Each `digest_generate` message carries `userId` and `scheduledAt`; it asks the handler to create an AI feed item from a coherent group of 3–6 recent saves, with source links. The generation window is 14 days, scheduler eligibility requires three recent saves, and users with a digest inside three days are skipped. Incoherent or insufficient content produces no digest. The 116 messages are unprocessed generation requests, not 116 completed digests or necessarily 116 different users.

Recommendation: stop consuming unused `default`, retain the small dispatcher wake-up fix, and align consumers with the real `bookmarks`/`digests` producers if digests remain a product feature. An empty first queue can starve the second even after `default` is removed, so queue cleanup alone does not repair the generic dispatcher. Handle the 116 queued digest jobs deliberately before enabling that consumer. If digests are retired, disable the scheduler and retire that job path explicitly. Stopping a consumer is separate from dropping a database queue; no queue or configuration change was made in this audit.
