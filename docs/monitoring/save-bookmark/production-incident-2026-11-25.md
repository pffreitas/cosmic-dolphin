# Production bookmark queue diagnosis, 2026-11-25

The strongest supported cause is a missing wake-up in the worker dispatcher. The bug reproduces with the production queue order and concurrency. DigitalOcean access and Grafana log forwarding are now available; current worker ACTIVE/startup evidence supports the configured queue order, while the missing wake-up itself remains demonstrated by the local dispatcher reproduction. No worker repair or manual bookmark/queue mutation was performed.

## Current observability

The [log activation receipt](../digitalocean-logs/activation-2026-11-25.md) confirms native worker records in Grafana, including the actual `bookmarks` queue startup. Worker image `a533a2c3` has the same dispatcher source as `0a0784e1`; the release changed no dispatcher behavior. The real scheduled snapshot at 23:33:34 UTC reports six processing bookmarks and six visible queue items, API/database healthy, and `queue_visible_backlog`/`processing_overdue` alerts. These are current inventory counts; no repair is implied. Use the [production log dashboard](https://tenderlimpet2779.grafana.net/d/cosmic-production-logs) with the incident time range for runtime context.

## Production observations

The collector repeatedly sees four processing bookmarks and four visible, owner-matched queue messages. It sees no delayed or leased messages, no invalid messages, and no redeliveries. The API health check and database snapshot succeed. The snapshot delivered at approximately 18:04:53 UTC reports an oldest claimable wait of 625,089 seconds, about seven days.

The latest successful [backend deployment](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43901840613) deployed SHA `0a0784e1cbb5c81c287eaa69442f23d43d59f568` on November 16. Startup logs show two queues, concurrency 5, and polling starting in the order `default`, then `bookmarks`. The current dispatcher source is unchanged from that deployed SHA. The [worker app spec](../../../.do/worker-app.yml) also sets `QUEUE_NAMES=default,bookmarks`.

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

## Repair gate

Add a regression test through the real multi-queue dispatcher boundary before changing worker behavior. Verify reservation release after empty reads, failed reads, and partial batches without exceeding shared concurrency. Then complete the repository backend release gate before deploying a fix. Confirm the existing production messages progress and the two Grafana alerts resolve. No manual message replay is needed merely to make a visible message claimable.
