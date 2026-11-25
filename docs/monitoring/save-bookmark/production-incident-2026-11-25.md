# Production bookmark queue diagnosis, 2026-11-25

The strongest supported cause is a missing wake-up in the worker dispatcher. The bug reproduces with the production queue order and concurrency. Current DigitalOcean process status and logs are unavailable, so runtime confirmation remains open. No production code, process, bookmark, or queue message was changed during diagnosis.

## Production observations

The collector repeatedly sees four processing bookmarks and four visible, owner-matched queue messages. It sees no delayed or leased messages, no invalid messages, and no redeliveries. The API health check and database snapshot succeed. The snapshot delivered at approximately 18:04:53 UTC reports an oldest claimable wait of 625,089 seconds, about seven days.

The latest successful [backend deployment](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43901840613) deployed SHA `0a0784e1cbb5c81c287eaa69442f23d43d59f568` on November 16. Startup logs show two queues, concurrency 5, and polling starting in the order `default`, then `bookmarks`. The current dispatcher source is unchanged from that deployed SHA. The [worker app spec](../../../.do/worker-app.yml) also sets `QUEUE_NAMES=default,bookmarks`.

Those startup logs describe November 16. They do not prove the worker is currently running. The user declined the read-only DigitalOcean credential request; no further credential request or access workaround was attempted.

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
