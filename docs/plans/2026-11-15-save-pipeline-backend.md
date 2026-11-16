# Save pipeline backend: fix, simplify, speed up

Written 2026-11-15 from a read-through of the save API and the queue consumer at `0d4ee5e`.
Nothing here was reproduced by running code; every finding cites the lines it was read from.
Scope: `POST /bookmarks` and its siblings (reprocess, paste content, reshare), the pgmq
producer, the worker loop, and the six processing phases. Clients are out of scope.

## The shape of the problem

The save path works, but its state lives in three places that are kept in step by hand:
`bookmarks.processing_status`, the pgmq message, and the run/event timeline. Each is written by
a separate statement, over two transports (a Postgres pool and Supabase REST), with no
transaction joining them. Most of the bugs below are the gaps between those writes.

The plan is to make two rules true and delete the code that exists because they are not:

1. **One transaction per state change.** A bookmark enters `processing` in the same transaction
   that enqueues its message.
2. **`processing` means exactly one live message.** Only the worker moves a bookmark out of
   `processing`, and only when it deletes or archives that message.

With those two rules the status column is the lock. No lease column, no advisory lock, no
watchdog, no race-recovery branch.

## Findings

Severity: **P0** loses or corrupts user data, or is a security hole. **P1** wrong behaviour
under ordinary conditions. **P2** waste or debt.

### Correctness and security

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| 1 | P0 | The run's final write saves the whole bookmark as read at the start. Archive, retitle, retag or favourite during the 30–90 s run is reverted. | `bookmark.processor.service.ts:331`, `bookmark.service.ts:486` |
| 2 | P0 | SSRF. URL validation is scheme-only; nothing blocks private or link-local hosts, on first hop or redirect. Applies to the worker fetch, the headless browser, image downloads, and `POST /bookmarks/preview` (in the API process, no rate limit). Fetched HTML is readable back through the reader. | `http-client.ts`, `web-scraping.service.ts:60`, `bookmarks.ts:826` |
| 3 | P0 | No response size cap on page fetches, and a message that kills the process is never archived: max-retry handling lives only in the thrown-error path. One huge page can crash-loop the worker forever. | `http-client.ts`, `queue.processor.ts:161` |
| 4 | P1 | Nothing prevents two runs on one bookmark. Sources: a second Retry or paste while processing; a retryable failure sets `failed` while its message is still queued, so Retry enqueues a second; the timeline watchdog does the same; a run longer than the 300 s visibility timeout (model calls have no timeout). Concurrent runs that resume one run collide on `UNIQUE (run_id, sequence)` and one fails. | `bookmarks.ts:881`, `:1011`, `:296`; `ai/index.ts:84`; timeline migration `:46` |
| 5 | P1 | The worker reads 10 messages for 5 slots and waits for the whole batch. Half of each batch burns its timeout queued locally, and one slow page idles the other slots. | `queue.processor.ts:100` |
| 6 | P1 | Graceful shutdown never runs: `enableShutdownHooks()` is not called, so `onModuleDestroy` is dead code. Every deploy kills in-flight runs, which then wait out the 5-minute timeout. | `apps/worker/src/main.ts`, `queue.processor.ts:37` |
| 7 | P1 | Create is three separate writes: insert, status update, HTTP enqueue. A crash between them leaves a row with no message. | `bookmarks.ts:225` |
| 8 | P1 | Resuming after a crash reopens the run but leaves the interrupted phase event `running`. The timeline then returns `pollAfterMs: 2000` forever. | `bookmark-processing-reporter.service.ts:171`, `bookmarks.ts:318` |
| 9 | P1 | The daily budget counts runs the worker has started, so a burst of saves all pass before any run exists. Reprocess resumes the old run and is never counted, contrary to the comment. | `processing-budget.service.ts:80`, `bookmark-processing.repository.ts:286` |
| 10 | P1 | A bookmark deleted while queued throws before the `try`, so it is retried three times, five minutes apart. | `bookmark.processor.service.ts:149` |
| 11 | P1 | `collection_id` on create is not checked for ownership (refile checks it). `tags`, `title` and `description` are unvalidated or unbounded. | `bookmarks.ts:550`, `:130` |
| 12 | P2 | `scraped_url_contents.bookmark_id` has no unique constraint; two runs can insert two rows and reads pick one arbitrarily. | `20250919110755_…`, `bookmark.repository.ts:360` |
| 13 | P2 | Text stripping uses `.text()`, which joins adjacent blocks on minified HTML, then collapses all newlines, so paragraph chunking never triggers. Affects summary input, search document and chunk boundaries. | `chunking.service.ts:50` |

### Waste

The API runs on DigitalOcean and the database on Supabase, so every round trip crosses
providers. Counting round trips is the right unit here.

| # | Finding | Where |
|---|---------|-------|
| 14 | Every authenticated request builds a Supabase client and calls `auth.getUser` over HTTP. This is likely the largest single cost in a save. | `middleware/auth.ts:26` |
| 15 | Twelve route modules each call `createDatabase`, which resets the singleton and builds a new pool of 20. One API replica can open 240 connections. Each module also builds its own service container. | `database/connection.ts:57`, every `routes/*.ts` |
| 16 | Save is one auth call, four SQL round trips and one HTTP enqueue. The duplicate path answers "already saved" in four queries, two of them recursive collection-path lookups the share-key reply does not use. | `bookmarks.ts:579`–`:647` |
| 17 | Image extraction sends the full unbudgeted HTML to the model, downloads every chosen image with no size cap, corrupts the bytes through a text decode, stores them in Postgres where nothing reads them, and the `embed` phase deletes them (it clears all chunks, not just text). | `bookmark.processor.service.ts:809`, `:764`; `http-client.ts` |
| 18 | Chunks are inserted one at a time, each in its own transaction, then embeddings are updated one at a time: about five round trips per chunk, 200 for a long article. Chunks are deleted before embedding, so a failed embed leaves search with none. | `bookmark.processor.service.ts:756`–`:807` |
| 19 | The bookmark row is written seven times per save (insert, two `processing` updates, fetch, filing, final, status). Each touches indexed columns, so each maintains about 17 indexes including two pgroonga and one GIN. | see index list in migrations |
| 20 | Each model turn costs two timeline writes (insert `running`, update). Turns are not shown to users; only phases are. | `bookmark-processing-reporter.service.ts:283` |
| 21 | The full content goes to a model three times (images, summary, tags). | `bookmark.processor.service.ts:579`, `:681`, `:809` |
| 22 | A transient fetch failure waits the full 300 s before retry. An idle worker takes up to 5 s to notice a save. | `queue.service.ts:49`, `queue.processor.ts:249` |
| 23 | The same HTML is parsed about six times per run. | `web-scraping.service.ts:268`, `chunking.service.ts:50` |
| 24 | Web fires a preview scrape alongside every save, so the page is fetched twice. | `apps/web` capture flow, `bookmarks.ts:826` |

### Debt

- Two queue transports. API and worker hold a Postgres pool but reach pgmq through Supabase
  REST. This blocks transactions and causes the test-isolation caveat in `AGENTS.md`.
- Dead code: the worker's `popMessage` and `sendMessage`; `DefaultMessageHandler`; the
  `default`, `tasks` and `notifications` queues; the AI session id passed to every call and
  never used; the in-memory retry map; the legacy phase map on the write path; a redundant
  ownership read and stale comment in PATCH; `try { … } catch (e) { throw e }`.
- The create handler is 160 lines with three near-identical branches, the same `later_until`
  parse five times, and "Library"/"library" messages.
- Archived messages are never pruned.
- Request logs include every saved URL with its user id, including private links. The HTTP
  client logs each URL with `console.log`.
- `bookmark-delete.test.ts` re-implements the handler inside the test, so it cannot fail when
  the route changes.

## Plan

Five PRs, in order. Each is independently shippable and each deletes more than it adds.
Tests run against the local Postgres container, serially, per the release runbook.

### PR 1 — Stop corrupting and looping (no schema change)

1. **Per-phase writes.** Each phase returns a patch of the columns it produced; the final write
   merges those patches and the terminal status into one `UPDATE`. The processor never writes
   `title`, `is_archived`, `is_favorite` or tags it did not generate. Fixes 1; removes one
   write (19).
2. **Delete image download and storage.** Keep the model's URL selection, feed it budgeted text.
   Fixes 17. Drop `createImageChunk` and the image branch of the chunk repository.
3. **Poison guard.** Check `read_ct` when a message is read; past the limit, mark the bookmark
   failed and archive without running. Fixes the loop in 3.
4. **Missing bookmark is an ack.** Delete the message and return. Fixes 10.
5. **Close orphaned events on resume**, and derive `pollAfterMs` from the bookmark status
   alone. Fixes 8.
6. **Enable shutdown hooks.** Fixes 6.
7. **Validate the body with one Zod schema**, including collection ownership. Fixes 11.

### PR 2 — One transport, one transaction, one consumer loop

1. **pgmq over SQL.** Replace both REST clients with `pgmq.send / read / delete / archive /
   set_vt` on the existing pool. Delete `QueueServiceImpl`'s HTTP path, the worker's
   `SupabaseClientService` and its `QueueService`. First step: confirm the `DATABASE_URL` role
   can execute the `pgmq` schema in production.
2. **Transactional transitions.** One repository method per transition, each a single
   transaction:
   - *create*: `INSERT … ON CONFLICT (user_id, source_url) DO NOTHING RETURNING *` with the
     status set at insert, plus `pgmq.send`. No row returned means duplicate.
   - *reprocess / paste*: `UPDATE … SET processing_status = 'processing' WHERE id = ? AND
     user_id = ? AND processing_status <> 'processing' RETURNING *`, plus `pgmq.send`. No row
     means it is already running: reply 202 and enqueue nothing.

   Fixes 7 and the API half of 4. Removes the unique-violation recovery branch, the
   enqueue-failed status, and the watchdog write in the timeline GET.
3. **Keep `processing` during retries.** A retryable failure records the failed phase event and
   leaves the bookmark `processing`; only the final attempt sets `failed`. This is what makes
   rule 2 hold, and it stops the status flashing.
4. **Rewrite the consumer loop** (about 60 lines replacing `queue.processor.ts`): a dispatcher
   reads only as many messages as there are free slots, polls every second when idle, and each
   message is deleted, archived, or given a backoff with `set_vt` (30 s, 2 min, 10 min). On
   shutdown, stop reading, wait, then `set_vt(0)` anything unfinished. Fixes 5 and 22.
5. **Run deadline.** One `AbortSignal` per run, shorter than the visibility timeout, passed to
   every fetch and model call. Fixes the last source of 4.
6. **Budget counts bookmarks enqueued today**, read inside the create transaction. Fixes 9.

### PR 3 — Network safety

1. One guarded fetch used by every outbound request: resolve the host, reject private,
   loopback, link-local and metadata ranges, re-check on each redirect, cap the response body
   and the redirect count. Apply the same allow rule to the headless browser's requests.
   Fixes 2 and the memory half of 3.
2. Rate-limit `POST /bookmarks/preview`.

### PR 4 — Fewer round trips

1. **One pool, one container**, built once in `index.ts` and passed to every route module.
   Fixes 15.
2. **Verify the JWT locally** against the Supabase signing key. Fixes 14. See decision 1.
3. **Batch the embed phase**: embed first, then delete and insert all chunks with their vectors
   in one transaction. Fixes 18.
4. **Write a turn event once**, on completion. Fixes 20.
5. **Duplicate path**: return from the conflict branch with one `UPDATE … RETURNING`; skip the
   collection path for share-key replies. Fixes 16.
6. **Parse once**: pass the stripped text from fetch through to summary, search document and
   chunking. Fix the block-joining bug at the same time. Fixes 13 and 23.
7. **Tags from the summary**, not the full content. Fixes 21. See decision 2.

### PR 5 — Schema cleanup

1. `UNIQUE (bookmark_id)` on `scraped_url_contents`, after de-duplicating. Fixes 12.
2. Drop indexes no query can use: single-column `user_id` (prefix of the unique index),
   `source_url`, `is_archived`, `is_favorite`, `created_at`, `read_at`. Check each against
   `pg_stat_user_indexes` in production first. Keep `processing_status` only if the feed and
   picks queries prove to use it.
3. Drop the three unused queues and the image chunk table. Add retention for archived messages.

## Not doing

- No new broker, no lease column, no advisory locks. The status transition is the lock.
- No parallel user-visible phases. The checklist is sequential by product decision.
- No processor rewrite. The phase structure stays; only what each phase writes changes.

## Measure before and after

The timeline already records duration per phase and per turn, so the baseline is one query
over `bookmark_processing_events` (median and p95 `duration_ms` by `phase`, last 14 days), plus
time from `bookmarks.created_at` to the first `fetch` event for queue latency. For the API,
compare Fastify's response time on `POST /bookmarks` before and after PR 2 and PR 4.

## Decisions

Recorded from the user's replies on 2026-11-15. They amend the plan above.

| ID | Decision | Effect on the plan |
|----|----------|--------------------|
| D-1 | Local JWT verification: yes. Budget unit: bookmarks enqueued per day. | PR 4 item 2 and PR 2 item 6 stand as written. |
| D-2 | Tags from the summary: include in PR 4 now and compare against the old tags afterwards (user chose "B", over the recommendation to compare first). | PR 4 item 7 stays in PR 4. The comparison on 20 bookmarks becomes a post-deploy check, not a gate. |
| D-3 | Ship as five sequential packages. Each is reviewed, merged, deployed and observed before the next package is broken down and started. | Each PR below is its own package with its own `tasks.md`. This run's breakdown covers PR 1 only. |
| D-4 | PR 5 (index, queue and image-table drops, and de-duplicating saved content before the new unique constraint) is included without the production index-usage check (user chose "B", over the recommendation to wait for it). | PR 5 stays in scope as the last package. Its breakdown must make each drop a separate, reversible migration and keep the de-duplication non-destructive of the newest row per bookmark. |
| D-5 | The user runs a one-line production check that the database role can execute `pgmq` functions, and reports the result before PR 2 starts. | PR 2 is blocked on that reply. The coordinator supplies the exact command when PR 2 is broken down. |
| D-6 | Production check for D-5, run by the coordinator on 2026-11-16 at the user's instruction ("You can do that yourself"), in a read-only transaction: role `postgres`, pgmq 1.4.4, `USAGE` on schema `pgmq`, `EXECUTE` on `send(text,jsonb,integer)`, `read(text,integer,integer)`, `delete`, `archive` (single and array) and `set_vt(text,bigint,integer)`, and DML on `pgmq.q_bookmarks` and `pgmq.a_bookmarks`. The production `DATABASE_URL` uses Supabase's transaction pooler (port 6543). The local test database runs pgmq 1.5.1, whose `read` takes an extra optional argument. | D-5 is satisfied: PR 2 goes ahead without a grant migration. Package 2 must call only the three-argument `send` and `read` forms, which exist in both versions, and must not use session-level state (no `SET`, no session advisory locks) because of the pooler. |
| D-7 | Budget unit for PR 2 item 6, chosen by the breakdown: the number of bookmarks the user created since UTC midnight, counted inside the creating transaction. A save over the limit still stands, lands `idle` and queues nothing. | A save counts toward the limit whether or not it was queued. Concurrent saves can overshoot by at most their own number; no lock is taken. |
| D-8 | Timing values for PR 2, chosen by the breakdown: the 300 s visibility timeout stays as the ceiling; a run has a 240 s deadline; retries back off 30 s, 120 s, then 600 s by delivery count; an idle consumer polls every 1 s; a retryable failure with attempts left leaves the bookmark `processing`. | A bookmark whose worker is down stays `processing` (it is queued) until a worker takes it; the two-minute "worker unavailable" failure is removed with the timeline watchdog. |
| D-9 | A Retry, Summarise now or paste on a bookmark already `processing`, chosen by the breakdown: Retry and Summarise now answer 202 with the current bookmark and the message "Already processing" and queue nothing; a paste answers 409 "Still processing. Try again when it finishes." and stores nothing. | No path can start a second run. The paste case adds a documented 409 to the contract. |
