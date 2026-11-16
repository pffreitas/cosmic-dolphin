# Tasks: Save pipeline backend, package 2 of 5 — one transport, one transaction, one consumer loop

| | |
|---|---|
| Spec | [2026-11-15-save-pipeline-backend.md](../2026-11-15-save-pipeline-backend.md) · Status at breakdown: Approved by the user's go-ahead of 2026-11-15, amended by decisions D-1 to D-9 in the spec. Package 1 ([tasks.md](tasks.md)) is merged (PR #258, `57aee13`) and its production checks R-1 and R-2 passed on 2026-11-16. |
| Spec revision | `uncommitted, sha256:a46fbacde7d8` |
| Generated with | `/Users/paulo.freitas/.claude/skills/spec-breakdown` · SKILL.md sha256 `f7d0c27c94c9` |
| Readiness | No open questions: D-5 was answered by the production check recorded as D-6; the numbers the plan left open are D-7 to D-9 (chosen by the breakdown, listed for the user's approval). |
| Prototype | N/A: no UI |
| Status | Approved |
| Date | 2026-11-16 |
| Feature flag | N/A: no flag. The queue messages and their payloads do not change, so old and new API and worker versions interoperate during the deploy (see Rollout). |
| Integration | Feature branch `feature/save-pipeline-2` → GitHub PR → `main` on `origin`; one complete package |
| Delivery | github-pr |
| Authorization | Requested: the user wrote "Full send it to prod" on 2026-11-15 and chose sequential packages (D-3); on 2026-11-16 they said "Continue where you left off" after package 1 was verified in production. Scope: implement, review, open the PR and merge this package after the full gate. A merge to `main` deploys the API and worker to production automatically. It does not cover manual rollout (R-1 to R-3), packages 3 to 5, or any production data change. Plan approved by the user on 2026-11-16: "approved. full send package 2". |
| Plan | 5 tasks · critical path T-1 → T-2 → T-3 → T-4 → T-5 · 1 lane (every task shares files with the next) |

## Repos

| Repo | Remote | Path at breakdown | Target branch | Feature branch | Merge order |
|---|---|---|---|---|---|
| cosmic-dolphin | `origin` · `git@github.com:pffreitas/cosmic-dolphin.git` | `/Users/paulo.freitas/.t3/worktrees/cosmic-dolphin/save-pipeline-2` (built in its own worktree) | `main` | `feature/save-pipeline-2` | 1 |

## How to work this plan

Point a coding agent at this file ("Work the plan in `docs/plans/2026-11-15-save-pipeline-backend/tasks-2.md`") and it runs as the
**coordinator**. Developer subagents build the tasks test-first on `feature/save-pipeline-2`. The
coordinator verifies and commits each task there. Once every task is done, GPT Sol reviews
the whole feature through `sol-loop`, with at most 5 rounds for all tasks and repos together,
including meaningful fixes made during PR feedback. Deliver one GitHub PR per repo's complete
package, after implementation, proof and review. Merge only with explicit user full-send or
merge authorization and every gate passing. Without that grant, leave the PR ready for the
user. Task commits are implementation checkpoints; none is delivered separately to `main`.

| Role | Who | Does | Never |
|---|---|---|---|
| Coordinator | The agent pointed at this file | Picks tasks, verifies, commits on the feature branch, owns Sol review, PR delivery and this file | Writes product code |
| Developer | A fresh subagent per task | Builds one task, test-first | Edits this file, commits or pushes |
| Reviewer | One Sol reviewer per round in one ledger | Reviews the cumulative change and cross-task integration; re-reviews fixes | Edits any file, starts subagents or watches PRs |

Without developer subagent support, the coordinator may build tasks itself using the developer
brief and disclose the fallback. Final review still requires a route to GPT Sol; report a
missing route rather than substituting self-review or another model.

### Coordinator

Before the first task:

1. Check the spec and this file's *Status* and approval provenance. Both must be `Approved` at
   their authorized semantic revisions; otherwise stop and ask. A lane-only assignment
   authorizes that lane's implementation, not integration of an incomplete feature. Ask before
   resuming or skipping an `In progress` task whose ownership or state is unclear.
   Confirm `Delivery: github-pr` matches the spec's delivery rules. Record the actual user
   execution request in *Authorization*; approval of this file alone never authorizes merging.
   An explicit full-send request authorizes feature pushes, PR/review replies and merge after
   the gate. It permits `--force-with-lease` only for an authorized rebase of this task's own
   feature branch; never force-push the target or another/shared branch. Otherwise do not rebase
   published history without permission. Keep scope and manual rollout owners unchanged.
2. In every repo, confirm `origin` and `main`, inspect the working tree and fetch the
   target. Preserve the approved tasks file; other pre-existing dirty work requires a separate
   worktree or the user's direction. Never discard it. Create `feature/save-pipeline-2` from the fetched target in an
   isolated worktree where available. On resume, use the recorded branch and review state;
   never recreate it or reset the round count. Preserve an approved uncommitted tasks file by
   committing it on the feature branch; it need not be pushed to the target before work starts.
3. Resolve `sol-loop`, `file-pr`, `babysit-pr` and `leaving-pr-comments` from installed skills.
   Confirm authenticated GitHub CLI and a route to the requested/latest available GPT Sol.
   Outside T3, confirm Python 3 for `pr-wait`. Run *Verify all* on the starting target snapshot.
   If it is already red or a required tool is unavailable, stop and report it.
4. In *Delivery*, reuse or record each repo's branch, target and existing PR URL; do not create
   a duplicate PR. Verify live state on resume. In *Implementation review*, record each repo's
   feature branch and full target SHA as Base
   SHA, with verdict `Pending` and rounds `0`. For a legacy plan whose task commits already
   landed on the target, preserve them and report that history: this package contains only the
   remaining delta. Do not claim the earlier work will ship with this package or undo it.
   Preserve already-used review rounds/findings and merged PR history when resuming.
5. Confirm every task can be completed before package integration. A task depending on rollout
   of this same package creates a cycle. Report it as a plan problem; do not integrate a subset
   to unblock it. Post-launch cleanup or required staged deployments need an explicitly agreed
   separate plan/package or a revised spec before implementation proceeds.

For each task:

1. **Pick.** Choose the lowest-numbered `Todo` task whose task dependencies are `Done` and whose
   external rollout prerequisites are complete. If no task is ready and any non-`Dropped` task
   remains unfinished, report the blockers and preserve the feature branch. Do not integrate.
2. **Start and build.** Set Status to `In progress` and spawn a developer with the developer
   brief in the task's feature worktree.
3. **Verify and checkpoint.** Run the task's *Verify* commands yourself and the required lint
   and type checks. Send failures to the developer until green, or block the task if it cannot
   proceed. These are implementation checks, not review rounds. Check the developer's report
   accounts for the acceptance criteria. Run broader checks when the task or repo requires them.
4. Set Status to `Done` and record results in *Notes*. Commit the task on the feature branch
   using *Repo conventions* with a `Task: T-n` trailer. If the task is in another repo, record
   its code commit SHA in the tasks file and commit the status change on that file's feature
   branch. `Done` means implemented, verified and committed on the feature branch; it does not
   mean reviewed, integrated or shipped.
5. **Blocked work.** Preserve unfinished code in a local `wip/save-pipeline-2-<T-n>` branch based on the
   feature checkpoint; keep its branch name and reason in *Notes*. Return to the clean feature
   branch and mark the task `Blocked`. Continue independent tasks, but hold the entire package
   until every task is done. Do not push blocked work to `main`.
6. Continue without per-task review, target merges or target pushes. Feature-branch backup
   pushes are optional when authorized and repo checks pass; they are not package delivery.
   Do not open a package PR until all required tasks in all repos are done and final review
   passes. A blocker holds the whole package while independent local implementation continues.

### Final implementation review

1. **Ready.** Start only after every non-`Dropped` task in the whole plan is `Done`, including
   all lanes. If the saved review has used 5 rounds without approval, report it and stop unless
   the user directs further review. An incomplete plan cannot earn package approval.
2. **Prepare the candidate.** Fetch every target and update the feature branch to include its
   latest SHA using the approved repo strategy. Resolve conflicts through the owning developers.
   Record that target SHA as Base SHA
   and the candidate feature HEAD as Reviewed SHA. Run *Verify all* and every task-specific
   check it does not cover in every repo; include required integration, security and CI checks
   from *Repo conventions*. Local proof must pass before review. If a required CI job runs only
   on a PR, declare that trigger in *Repo conventions*; it remains a merge gate and runs after
   the reviewed feature is pushed. Never treat unavailable PR-only CI as green or require it
   before the PR that triggers it can exist. A required pre-PR staging/UAT check still blocks.
3. **Review.** Use `sol-loop` approved-plan mode with this reviewer brief, spec/prototype paths,
   all Base/Reviewed SHAs and the task-to-commit
   mapping. It reviews the entire cumulative feature diff and cross-task contracts. One pass
   across all tasks and repos is one round. Store its verdict, round count and findings in
   *Implementation review*; commit the record on the feature branch. This is the only final
   implementation review loop; do not add a separate generic Sol loop. The plan's 5-round cap
   replaces sol-loop's standalone budget. Every required acceptance criterion, failure, NFR
   and repo check is in scope regardless of how frequently the path occurs.
4. **Batch fixes.** For `CHANGES REQUESTED`, with fewer than 5 rounds used, send all findings
   together to the affected developers. Fix every Critical and High finding or dispute it with
   evidence. Group fixes by owning task; use dependency order and non-overlapping *Touches*
   for parallel work. A spec gap blocks resolution. Verify and commit fixes on the feature
   branch, then request the next round with the same ledger, all fixes and disputes. In T3,
   every delegated review round is a fresh `delegate_task`; follow its returned next action, never poll or send
   re-review to an old child thread. Repeat from preparation;
   verification retries do not count as review rounds.
5. **Outcome.** `APPROVE` requires no open Critical or High finding. Record accepted Medium/Low
   follow-ups with task IDs. Five rounds without approval leave the package on its feature
   branch; report the findings and stop. Do not reset the cap or mark implemented tasks `Blocked`.
   Approval applies to the recorded Base/Reviewed SHAs. Product-code changes or new target
   commits require fresh verification and reviewer approval of the updated candidate, using
   the same remaining round budget. Review-record-only commits do not invalidate semantic
   approval, but required GitHub checks must still cover the final pushed head. Behavior fixes
   during PR babysitting use this same ledger and remaining rounds. Exhaustion is not approval.

### Deliver the complete package

1. **Gate.** Every non-`Dropped` task must be `Done`, the whole-feature verdict must be `APPROVE`,
   and local proof must pass for the candidate being delivered. Fetch each target
   again. If any differs from its recorded Base SHA, return to review preparation; never
   deliver using stale approval. Confirm the pushed product tree is the reviewed tree; re-run
   relevant proof and review for code changes or meaningful conflict fixes.
2. **File or update the PRs.** Push the feature branch, never `HEAD:refs/heads/main`.
   Use `file-pr` for one non-draft PR per repo's complete package against its recorded target.
   Include the spec/tasks links, outcome, proof and review result; follow the repo's merge
   method, including squash-only rules. Preserve task-to-commit provenance in this plan even
   when GitHub squashes the PR. In T3, call `link_pull_request` as the next tool call after
   creating, taking over or pushing to each PR. Record PR URL and actual head/base in *Delivery*.
3. **Babysit.** Use `babysit-pr`. Verify each bot finding against the spec and source. Route
   real fixes to owning developers, rerun proof, and obtain current Sol review coverage through
   the same ledger before pushing behavioral changes. Reply with evidence when dismissing a
   finding, using `leaving-pr-comments`. Do not change required behavior or weaken tests to get
   green. Persist actionable state before waiting. In T3, only the package coordinator calls
   `watch_pull_request` if not already active and ends the turn; wakes resume work without
   removing the watch, so do not rearm it on each wake. Never poll or sleep. Outside T3,
   use that skill's `pr-wait`. A watcher's ready result is not permission to merge.
4. **Live merge gate.** Every task is `Done`; all repos have current Sol approval and proof;
   all required checks pass on each final PR head; required reviewers/bots have finished;
   findings are fixed or dismissed with a written reason; no human requests changes; required
   human approvals are present; the PRs are open, non-draft, up to date and mergeable. Fetch
   targets again and compare live heads/bases to the recorded candidates immediately before
   each merge. Unknown, pending, BEHIND or DIRTY is not ready. A new base or behavior change
   returns to verification/review with the same remaining round budget and fresh head checks.
   Check exact merge candidates when the repo requires them; do not substitute branch-only proof.
5. **Merge or hand off.** With explicit full-send or merge authorization, merge through GitHub
   using the repo's allowed method and branch protection; never use `--admin` or another bypass.
   Stay watching until a merge queue/auto-merge actually completes. Without merge authorization,
   never enable auto-merge or enter a queue; disable existing automatic merging before any push
   or report the blocker if unable. Leave the PR open for the user at the gate. A subsequent
   full-send request can resume the same ready PR without repeating unchanged implementation.
6. **Multiple repos.** Verify the gate across every repo before the first merge. Merge in the
   spec's compatibility order and recheck the remaining candidates before their merges.
   Separate PR merges are not atomic: a failure after one succeeds holds the remaining PRs
   and must report each merged SHA and pending result. Never force-push a rollback or claim
   the whole feature shipped. A deployment required between changes needs a separately agreed
   package or named operator step; do not silently perform manual rollout to unblock delivery.

**Finish or resume.** Persist PR URLs, head/base SHAs, review rounds/findings, observed proof,
check results, decisions and per-repo delivery state in this file. After a merge, record the
merge SHA locally and in the final report; do not reopen a merged PR or push to the target just
to publish bookkeeping. A completion report requires all package PRs merged. A ready handoff
states they remain open/unmerged; a partial merge reports every repo separately. Manual rollout
remains with its named owners and starts only after its declared package prerequisites.

Ask through the harness question tool when a consequential gap, missing proof, exhausted
review budget or unfixable gate prevents progress. Preserve branches and unresolved findings.
Before a question or blocked/ready handoff in T3, call `unwatch_pull_request` on every PR you
watch. On resume, inspect live PR state and reuse checkpoints and rounds; an installed-skill
update or missing scratch files never resets approvals or the review budget.

**Never** integrate an individual task into `main`, push an incomplete or unapproved package,
skip or weaken a required check, bypass protection, force-push outside the own-branch grant,
or change task scope, criteria or order. Record
plan problems in *Notes* and the final report for the breakdown to resolve.

**Parallel work.** One coordinator owns the feature branches, review record and final package
delivery. Developers can work in isolated task worktrees when dependencies are met and
*Touches* do not overlap. The coordinator collects their changes on the feature branch and
checks them there. Lane coordinators may help implement scoped work, but only the designated
package coordinator performs whole-feature review, watches PRs and merges after all lanes finish.

### Developer brief

```
You are the developer for <T-n> in docs/plans/2026-11-15-save-pipeline-backend/tasks-2.md. Read the file header, *Repo conventions*,
task <T-n> and the spec sections it cites. You do not need the other tasks.

Build it test-first, one behaviour at a time, in the order of the task's *Tests* list:
1. Red: write one test for the next acceptance criterion. Run it. It must fail, and for the
   reason you expect.
2. Green: write the least production code that makes it pass.
3. Repeat for the next criterion. Refactor only when green, and re-run the tests after each
   step.
Tests go through public interfaces and assert behaviour, not implementation. Do not write all
the tests first. If you have a TDD skill or a skill for this stack, use it.

Follow *Repo conventions* and the stack guidelines it names, and match the surrounding code.
Build only the *Scope*. Do not edit the tasks file, commit or push.
Before you report done, run every *Verify* command and the lint and type checks in *Verify all*.

If the task or the spec is missing, contradictory or wrong, stop and report BLOCKED with the
reason. Do not work around a gap.

Report: the files you changed; the tests you added, each confirmed failing before its code;
Verify results; decisions you made; anything outside the Scope you noticed.

When you receive review findings: fix every Critical and High finding. Fix a Medium or Low
finding when it is inside the Scope and small; otherwise say why not. Dispute a finding only
with evidence (code, spec, test output), never to save work. Then report again in the same
format, with one line per finding: fixed, or disputed and why.
```

### Reviewer brief

```
You review the whole feature in docs/plans/2026-11-15-save-pipeline-backend/tasks-2.md. Read the header, *Repo conventions*,
*Implementation review*, every task and its cited spec sections. The coordinator supplies
Base SHA (the current target), Reviewed SHA (the feature candidate) and task commits for every
repo. Do not edit any file.

Inspect `git diff BASE_SHA REVIEWED_SHA` and `git log BASE_SHA..REVIEWED_SHA`, including new
files. Run *Verify all* against the supplied candidate and task-specific checks it does not
cover. Review the final package; task checkpoints do not have to be independently deployable.
Then check:
1. Every acceptance criterion holds and has meaningful behaviour coverage through public
   interfaces. No test is skipped, weakened or deleted to get green.
2. The implementation stays inside the combined task scopes and the spec. A task's *Out of
   scope* may be delivered by another included task; that is not scope creep.
3. The complete feature's *Ships as* holds, including specified flag-off behaviour. It is
   releasable after integration into main, with no incomplete required behaviour.
4. The code is correct, secure and handles the spec's named failures and existing regressions.
5. Cross-task and cross-repo contracts, wiring, migrations, flags and telemetry agree. Check
   the full user path, compatibility and integration coverage.
6. It follows *Repo conventions*, stack guidelines and surrounding code. The package follows
   the spec's deployment order without requiring an unreviewed partial target integration.

Severity:
- Critical: breaks the build or target, loses data, opens a security hole, fails an acceptance
  criterion, or exposes behaviour the spec should hide.
- High: a bug on a likely path, an acceptance criterion without real coverage, work outside
  combined scope, or a rule that CI or architecture tests will reject.
- Medium: a maintainability problem or an unhandled edge case the spec does not name.
- Low: naming, style, nits.

Report APPROVE (no open Critical or High finding) or CHANGES REQUESTED first. Then a table:
ID, severity, repo/file:line, task IDs, problem, fix. Cite applicable criteria or spec rows.
On re-review, mark every earlier finding fixed, still open, dispute accepted or dispute
rejected with evidence, then list new findings. Review changed code and its interactions;
raise a new finding on unchanged, already-reviewed code only if it is Critical.
```


## Repo conventions

- **Build**: `bun install --frozen-lockfile && bun run apispec:compile && bun run apispec:build && bun run --cwd packages/shared build && bun run --cwd apps/api build && bun run --cwd apps/worker build`. After a TypeSpec change run `bun run apispec` and commit the regenerated client; never hand-edit generated files.
- **Test**: shared `cd packages/shared && bunx jest -i <file>` (Jest 30, in band: tests truncate one database); API `cd apps/api && bun test <file>`; worker `cd apps/worker && bun test src`. Shared integration tests use the real database through `getTestDatabase()` (`packages/shared/src/test-utils/database.ts`); the local database has the `pgmq` extension and the `bookmarks` queue.
- **Lint / format / type-check**: type-check is the build above. Lint: `bun run --cwd apps/api lint` and `cd apps/worker && bunx eslint "src/**/*.ts"` (never the worker's own `lint` script: it passes `--fix`). Both report 0 errors today and warnings only.
- **Test database**: the compose database keeps its data in RAM and crashed with SIGBUS twice during full-suite runs on this Mac's 2 GB Docker VM (package 1). For full runs use a disk-backed one instead, created and removed by the coordinator: `docker run -d --name save-pipeline-2-db -e POSTGRES_PASSWORD=postgres -p 5433:5432 --shm-size=256m -v save-pipeline-2-pgdata:/var/lib/postgresql/data supabase/postgres:15.19.0.004 postgres -c 'listen_addresses=*' -c fsync=off -c full_page_writes=off -c synchronous_commit=off -c max_wal_size=128MB -c checkpoint_timeout=60s`, then `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bun run db:test:reset`. Port 5433 must be free: stop `cosmic-dolphin-test-db` first with `docker stop` and restart it afterwards. Remove the container and volume when done. Never run `db:test:down` on a database another session may use. Do not build Docker images on this VM.
- **Verify all**: the build above, then `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run test:backend -- --env-mode=loose --concurrency=1 --force` on the disk-backed database. Baseline on `57aee13`: shared 458, API 399, worker 21 passing, 0 failures.
- **Required checks**: `deploy-backend.yml` triggers on push to `main` only: its `build-and-test` job (build, real Lightpanda check, backend tests) runs on the merge candidate; a failure stops the migrations and deploy jobs. On a pull request, `Rule ten` and `Mobile lint, types and Jest` run (triggered by generated client changes) and gate the merge. Verify all is the only proof of the backend before merge: run it on the exact head that will be merged.
- **Merge method / protection**: `main` has no branch protection. Use squash. Merging runs the backend workflow: tests, `supabase db push` (this package has no migration), then both images deploy to DigitalOcean automatically. Supabase CLI is pinned at 2.122.1.
- **Stack**: Bun 1.3.11 in CI (1.3.13 locally) · Fastify (`apps/api`), NestJS (`apps/worker`), Kysely over Postgres through Supabase's transaction pooler (port 6543: no session state, no `SET`, no session advisory locks), pgmq 1.4.4 in production and 1.5.1 locally (call only the three-argument `send` and `read` forms), TypeSpec contract. Follow `AGENTS.md`, `docs/runbooks/backend-and-testflight-release.md` and the ESLint configs in `apps/api` and `apps/worker`.
- **Feature flag**: none.
- **Commits**: Conventional Commits with a scope (`fix(worker): …`), trailer `Task: T-n` on feature checkpoints, and the attribution line the session requires. The PR links the spec and task IDs; squashing keeps traceability in this file.

## Plan at a glance

**Granularity rationale.** Package 2 is PR 2 of the spec, six items, grouped by mechanism and proof into five outcomes: queue calls go through the database connection (T-1), saving a link is one transaction (T-2), Retry and paste cannot start a second run (T-3), the worker claims, retries and stops cleanly (T-4), and a run has a deadline (T-5). Budget 4 to 8; 5 fits. The tasks run in sequence: T-2 and T-3 both edit `bookmarks.ts` and the bookmark repository, T-4 and T-5 both edit the processor, and T-2 to T-4 depend on T-1's transport. Effort `S` is up to half a day, `M` half a day to two days including verification and review.

```mermaid
graph LR
  T1["T-1 Queue over the database connection"] --> T2["T-2 Saving is one transaction"]
  T2 --> T3["T-3 Retry and paste never start a second run"]
  T3 --> T4["T-4 Worker claims, retries, stops cleanly"]
  T4 --> T5["T-5 A run has a deadline"]
```

| ID | Title | Depends on | Lane | Touches | Size | Ships as |
|---|---|---|---|---|---|---|
| T-1 | Queue calls go through the database connection | none | A | `packages/shared/src/repositories/` · `packages/shared/src/services/queue.service.ts` · `packages/shared/src/services/index.ts` · `apps/worker/src/queue/` · `apps/worker/src/digest/` | M | Additive: no behaviour change |
| T-2 | Saving a link is one transaction | T-1 | A | `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/services/processing-budget.service.ts` · `packages/shared/src/services/index.ts` · `apps/api/src/routes/bookmarks.ts` | M | User-visible: a save is never half-written; budget counts saves |
| T-3 | Retry and paste never start a second run | T-2 | A | `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/services/bookmark.service.ts` · `apps/api/src/routes/bookmarks.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` | M | User-visible: a second Retry is a no-op; paste while processing answers 409 |
| T-4 | The worker claims, retries and stops cleanly | T-1, T-3 | A | `apps/worker/src/queue/` · `packages/shared/src/services/bookmark.processor.service.ts` | M | User-visible: faster pickup and retry, no false "failed" while retrying |
| T-5 | A run has a deadline | T-4 | A | `packages/shared/src/ai/index.ts` · `packages/shared/src/services/` · `apps/worker/src/queue/` | M | User-visible: a stuck run ends and retries instead of blocking its slot |

## Tasks

### T-1 · Queue calls go through the database connection

| | |
|---|---|
| Status | Todo |
| Depends on | none |
| Traces | PR 2 item 1 · debt "Two queue transports" and dead code in the spec |
| Ships as | Additive: no behaviour change. The same queues, rows and JSON payloads are used, so an old API or worker interoperates with a new one during the deploy. |
| Size | M |
| Touches | `packages/shared/src/repositories/` · `packages/shared/src/services/queue.service.ts` · `packages/shared/src/services/index.ts` · `apps/worker/src/queue/` · `apps/worker/src/digest/` |

**Goal.** Sending, reading, deleting, archiving and delaying a pgmq message is done with SQL on the existing Postgres pool, and neither the API nor the worker uses the Supabase REST `pgmq_public` endpoints.

**Context.** Spec PR 2 item 1 and decision D-6. Today `QueueServiceImpl` (`packages/shared/src/services/queue.service.ts`) and the worker's `QueueService` (`apps/worker/src/queue/queue.service.ts`) call `supabase.schema("pgmq_public").rpc(...)`. Production has pgmq 1.4.4 with `send(text,jsonb,integer)`, `read(text,integer,integer)`, `delete(text,bigint)`, `archive(text,bigint)` and `set_vt(text,bigint,integer)`; the local database has 1.5.1. Use only those forms. Production goes through the Supabase transaction pooler, so use no session state. `createServiceContainer` is called with a Supabase client by twelve route modules; package 4 removes those, so keep its signature and leave the argument unused here.

**Scope**

- New `packages/shared/src/repositories/pgmq.repository.ts` (export it from `repositories/index.ts`): methods `send(queue, payload, delaySeconds = 0)`, `read(queue, visibilitySeconds, quantity)` returning `{{ msg_id, read_ct, enqueued_at, vt, message }}[]`, `delete(queue, msgId)`, `archive(queue, msgId)` and `setVisibility(queue, msgId, seconds)`, written with Kysely's `sql` template on the `db` it is given. Every method accepts either the `Kysely` instance or a transaction, because T-2 and T-3 call `send` inside one. Payloads are sent as a JSON object (`$1::jsonb`), never as a string.
- `packages/shared/src/services/queue.service.ts`: `QueueServiceImpl` builds on the repository instead of the Supabase client; `sendBookmarkProcessingMessage` keeps its signature and payload shape. `createServiceContainer` passes the database.
- `apps/worker/src/queue/queue.service.ts`: reimplement on the repository through the existing `DATABASE_INSTANCE` provider, keeping the method names the processor and digest scheduler use (`popMessages`, `deleteMessage`, `archiveMessage`, `sendMessage`) and `QueueMessage` shape; add `setVisibility`. Delete `popMessage`, which nothing calls.
- Delete `apps/worker/src/queue/supabase-client.service.ts` and its provider and `testConnection`; remove the Supabase dependency from the worker module if nothing else uses it.
- Keep the 300 s visibility timeout (as a named constant, now in one place).

**Out of scope**

- Transactional enqueue (T-2, T-3), the consumer loop and backoff (T-4), removing `supabaseClient` from the container signature (package 4).

**Acceptance criteria**

- [ ] Given a payload object, when it is sent and read, then the message body is the same JSON object, not a string, and `read_ct` is 1 on its first read (PR 2 item 1).
- [ ] Given a message read with a visibility of N seconds, then it is invisible to a second read until N seconds pass, and `read_ct` is 2 on the next read after it reappears.
- [ ] `delete` removes a message and `archive` moves it to the archive table; `setVisibility(…, 0)` makes a message readable at once.
- [ ] `sendBookmarkProcessingMessage` writes exactly the payload it wrote before (`type`, `data`, `metadata`, with `phase` and `resume` only when set).
- [ ] No code under `apps/` or `packages/shared/src/` calls `pgmq_public` or constructs a Supabase client for queue access.

**Tests** (write them in this order)

1. Shared integration (`getTestDatabase`): `send then read round-trips a JSON object and counts deliveries` and `visibility hides a message until it expires` (use a 1 s visibility) (PR 2 item 1).
2. Shared integration: `delete archive and setVisibility behave as pgmq documents`.
3. Shared unit: `sendBookmarkProcessingMessage keeps its payload`.
4. Worker: replace the `pgmq RPC contracts` tests in `queue.infrastructure.spec.ts` with the same behaviours against the repository; the processor, handler and digest tests keep passing unchanged.

**Verify**

```bash
cd packages/shared && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bunx jest -i src/__tests__
cd apps/worker && bun test src
bun run --cwd packages/shared build && bun run --cwd apps/api build && bun run --cwd apps/worker build
grep -rn "pgmq_public" apps packages/shared/src --include='*.ts' | grep -v node_modules
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

### T-2 · Saving a link is one transaction

| | |
|---|---|
| Status | Todo |
| Depends on | T-1 |
| Traces | Finding 7 · Finding 9 · Finding 16 (create path) · PR 2 items 2 (create and reshare) and 6 · decision D-7 |
| Ships as | User-visible: a save is either fully recorded and queued or not recorded; the daily budget counts saves |
| Size | M |
| Touches | `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/services/processing-budget.service.ts` · `packages/shared/src/services/index.ts` · `apps/api/src/routes/bookmarks.ts` |

**Goal.** Creating a bookmark (public link, private link or reshare) inserts the row, decides the budget and sends the queue message in one database transaction, and a duplicate URL costs one statement.

**Context.** Spec Findings 7, 9 and 16, decisions D-1 and D-7. Today the create handler (`apps/api/src/routes/bookmarks.ts`) does `findByUserAndUrl`, then `create`, then `queueBookmarkForProcessing` (budget check, `updateProcessingStatus('processing')`, HTTP enqueue, and a `failed` status if the enqueue throws), and recovers a unique-index race in its `catch`. `reshareBookmarkForUser` does the same through `queueBookmarkForProcessing`. The budget counts started runs, which is zero for a burst of saves.

**Scope**

- `bookmark.repository.ts` and `bookmark.service.ts`: one operation (for example `createAndQueue(url, userId, options, {{ dailyLimit, now }})`) that in one transaction (1) counts the user's bookmarks created since UTC midnight, (2) inserts with `INSERT … ON CONFLICT (user_id, source_url) DO NOTHING RETURNING *`, setting `processing_status = 'processing'` and `processing_started_at` when within budget and `'idle'` otherwise, and (3) when a row was inserted within budget, sends the processing message through T-1's repository on the same transaction. It returns the row and whether it was queued, or `null` for a conflict. Private-link creation uses the same operation with its own insert data.
- `bookmarks.ts`: the create handler calls it. No pre-lookup: on `null`, run `findByUserAndUrl` and `mergeCapture` as the duplicate path does today. Delete the unique-violation recovery branch, `isUniqueViolation` use in the handler (keep the exported helper only if tests use it), `queueBookmarkForProcessing`, and the `failed`-on-enqueue-error path. `reshareBookmarkForUser` uses the same operation. A failed send rolls back the insert, so the request answers 500 and nothing is half-written.
- `processing-budget.service.ts`: replace the run count with the created-bookmarks count of D-7, keeping `dailyProcessingBudget()`, its environment override and `startOfUtcDay`. Remove `ProcessingBudgetService` from the container if nothing else uses it.
- Keep every response body, status code and message of the create and reshare endpoints unchanged, including "Saved. Today's processing budget is spent — use Summarise now when you want this one processed." for an over-budget save.

**Out of scope**

- Reprocess and paste (T-3), the consumer (T-4), any change to rate limits or to what a share-key request may send.

**Acceptance criteria**

- [ ] Given a new URL within budget, when saved, then the row is `processing` and exactly one message is in the `bookmarks` queue, atomically (Finding 7).
- [ ] Given the same URL saved twice, then one row and one message exist and the second answer is 200 `alreadySaved` with merged note and read-when (Finding 16).
- [ ] Given two identical saves at the same instant, then one row and one message exist and both callers get a valid answer (Findings 7, 16).
- [ ] Given a user at the daily limit, when saving, then the row is `idle`, no message is sent, and the over-budget message is returned (Finding 9, D-7).
- [ ] Given a burst of saves above the limit, then only saves beyond it are `idle` (Finding 9).
- [ ] Given the queue send fails, then no bookmark row exists and the response is 500 (Finding 7).
- [ ] Private-link saves and reshares behave the same way, with their existing bodies (PR 2 item 2).
- [ ] Valid requests return byte-identical bodies and statuses to package 1.

**Tests** (write them in this order)

1. Shared integration: `new save is processing with exactly one queued message`; `duplicate and concurrent saves queue once` (use `Promise.all`).
2. Shared integration: `over-budget save is idle and queues nothing`; `a burst crosses the limit at the right save`; `a failing send rolls back the insert` (an executor whose `send` throws).
3. API: handler tests for create, private link, reshare and duplicate bodies against a real service container on the test database, asserting the bodies match package 1's; the old `queueBookmarkForProcessing` and race-recovery tests are replaced by behaviour tests above, not deleted.
4. Budget unit tests updated to the created-bookmarks count.

**Verify**

```bash
cd packages/shared && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bunx jest -i src/__tests__
cd apps/api && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bun test src/tests/bookmark-capture.test.ts src/tests/bookmark.test.ts src/tests/reshare.test.ts src/tests/api-contract.test.ts
bun run --cwd packages/shared build && bun run --cwd apps/api build && bun run --cwd apps/api lint
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

### T-3 · Retry and paste never start a second run

| | |
|---|---|
| Status | Todo |
| Depends on | T-2 |
| Traces | Finding 4 (API half) · PR 2 item 2 (reprocess and paste) · decision D-9 · the timeline watchdog removal |
| Ships as | User-visible: a second Retry or Summarise now is a no-op; a paste while processing answers 409; a worker outage no longer marks bookmarks failed |
| Size | M |
| Touches | `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/services/bookmark.service.ts` · `apps/api/src/routes/bookmarks.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` |

**Goal.** Starting a reprocess, a Summarise now or a paste is a single guarded transaction that moves the bookmark to `processing` and queues one message only if it was not already `processing`.

**Context.** Spec Finding 4 and decision D-9. Today `POST /bookmarks/:id/reprocess` sets `processing`, then sends, and marks `failed` if the send throws; `PUT /bookmarks/:id/content` (`storePastedContent`) replaces the content and sets `processing` unconditionally, then sends. A second tap queues a second run. `buildBookmarkProcessingTimelineResponse` also fails a `processing` bookmark that has no timeline after two minutes (`WORKER_START_DEADLINE_MS`), which with transactional enqueue would fail a bookmark whose message is still waiting.

**Scope**

- Repository and service: `startReprocess(id, userId, {{ phase }})` as one transaction: `UPDATE bookmarks SET processing_status = 'processing', processing_failure_code = NULL, processing_started_at = now(), processing_completed_at = NULL, processing_error = NULL WHERE id = ? AND user_id = ? AND processing_status <> 'processing' RETURNING *`, then `send({{ phase, resume: true }})` through T-1's repository in the same transaction. When no row is updated, return the current row and `queued: false` (`null` if the bookmark does not exist for that user). `storePastedContent` keeps its row lock and, when the bookmark is already `processing`, stores nothing and reports it; otherwise it also sends the message in its transaction.
- `bookmarks.ts`: reprocess answers 202 with the bookmark and "Reprocessing this bookmark" or `Retrying <phase>` when queued, and 202 with the current bookmark and "Already processing" when not (D-9); a missing bookmark stays 404. Paste answers 409 `{{ error: "Still processing. Try again when it finishes." }}` when processing, keeps its other answers, and no longer sets `failed` on a send error (the transaction rolls back and the answer is 500 as for other failures). Delete the timeline watchdog, `WORKER_START_DEADLINE_MS` and `WORKER_START_FAILURE_MESSAGE`; the timeline endpoint becomes read-only.
- `bookmarks.tsp`: document the paste 409 and the "Already processing" 202 text; run `bun run apispec` and commit the regenerated client.

**Out of scope**

- Changing the reprocess rate limit, the consumer or run semantics (T-4, T-5).

**Acceptance criteria**

- [ ] Given a `failed` or `idle` bookmark, when Retry or Summarise now is requested, then it becomes `processing` and one message is queued, atomically (Finding 4).
- [ ] Given a `processing` bookmark, when Retry is requested twice, then no extra message is queued and both answers are 202 (Finding 4, D-9).
- [ ] Given a `processing` bookmark, when text is pasted, then the answer is 409 and the stored content is unchanged (D-9).
- [ ] Given a `failed` bookmark, when text is pasted, then content is stored, the bookmark is `processing` and one message is queued, atomically.
- [ ] Given another user's or a missing bookmark, then 404 and nothing changes.
- [ ] Given a `processing` bookmark with no timeline for longer than two minutes, then the timeline endpoint returns it unchanged and writes nothing.
- [ ] The contract documents the new 409 and the regenerated client builds.

**Tests** (write them in this order)

1. Shared integration: `reprocess starts exactly one run`, including two concurrent calls (`Promise.all`) that queue one message.
2. Shared integration: `paste while processing is refused and changes nothing`; `paste after a failure stores content and queues once`.
3. API: reprocess, paste and timeline handler tests for the answers above; the watchdog tests are replaced by `timeline of a long-waiting processing bookmark is unchanged and read-only`.
4. Contract test passes after regeneration.

**Verify**

```bash
cd packages/shared && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bunx jest -i src/__tests__
cd apps/api && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bun test src/tests/bookmark-processing-timeline.test.ts src/tests/bookmark-content.test.ts src/tests/api-contract.test.ts
bun run apispec
bun run --cwd apps/api build && bun run --cwd apps/api lint && bun run --cwd apps/web typecheck
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

### T-4 · The worker claims, retries and stops cleanly

| | |
|---|---|
| Status | Todo |
| Depends on | T-1, T-3 |
| Traces | Finding 4 (retryable failure marked failed while queued) · Finding 5 · Finding 22 · PR 2 items 3 and 4 · decision D-8 |
| Ships as | User-visible: a saved link is picked up within about a second, retried within seconds to minutes, and shows `processing` (not `failed`) while it has attempts left |
| Size | M |
| Touches | `apps/worker/src/queue/` · `packages/shared/src/services/bookmark.processor.service.ts` |

**Goal.** The consumer reads only as many messages as it has free slots, disposes of each message individually (delete, archive or delay), and stops by returning unfinished messages to the queue; and a retryable failure leaves the bookmark `processing`.

**Context.** Spec Findings 4, 5 and 22 and decision D-8. `QueueProcessor.processQueue` reads `QUEUE_BATCH_SIZE` (10) messages for `QUEUE_CONCURRENCY` (5) slots and awaits the whole batch (`Promise.allSettled`) before reading again, so half of each batch waits locally against its 300 s visibility timeout and one slow page idles the rest; idle polling is 5 s; a retryable failure waits the full 300 s and the processor has already set the bookmark `failed`. Package 1 added the exhausted-delivery guard (`read_ct > maxRetries + 1`) and `failExhausted`; keep both.

**Scope**

- `queue.processor.ts`: replace the batch loop with a dispatcher. Keep `QUEUE_CONCURRENCY` slots; when slots are free read at most that many (never more than `QUEUE_BATCH_SIZE`), start each message as soon as it is read, and read again whenever a slot frees; when nothing is read, wait `QUEUE_POLL_INTERVAL` (default 1000 ms). Disposition: success → delete; the handler's acknowledged cases (deleted bookmark) → delete; exhausted/poison → archive (existing); terminal failure (`shouldRetry === false`) → archive; retryable failure with attempts left → `setVisibility(queue, id, backoff)` with 30 s, 120 s, 600 s for deliveries 1, 2, 3 (D-8). Remove the in-memory retry map.
- Shutdown (`onModuleDestroy`): stop reading, wait for in-flight work up to `QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT` (30 s), then `setVisibility(…, 0)` for every message still in flight so another worker takes it at once.
- `bookmark.processor.service.ts` and `bookmark-processor.handler.ts`: pass `finalAttempt` (delivery count above the retry limit) into `process`. A thrown retryable error with attempts left records the failed phase, leaves the run `running` and the bookmark `processing`, and rethrows with `shouldRetry`; on the final attempt, or for a non-retryable error, behaviour is as in package 1 (run closed, then bookmark `failed`). Soft phase failures that do not throw still end `failed` as before.

**Out of scope**

- The run deadline (T-5), changing concurrency or the visibility timeout, and more queues.

**Acceptance criteria**

- [ ] Given 5 slots and 20 waiting messages, then at most 5 are in flight and a new one starts as soon as any finishes, with no read while all slots are busy (Finding 5).
- [ ] Given an idle queue, then the consumer polls about once a second, not every 5 s (Finding 22).
- [ ] Given a retryable failure on delivery 1, 2 or 3, then the message is delayed 30 s, 120 s or 600 s and the bookmark stays `processing` (Findings 4, 22).
- [ ] Given a retryable failure on the final attempt, then the bookmark becomes `failed` after its run is closed and the message is archived.
- [ ] Given a non-retryable failure, then it is archived and the bookmark is `failed` as before.
- [ ] Given shutdown with messages in flight, then reading stops, finished work is acknowledged, and unfinished messages become readable immediately.
- [ ] The poison guard and exhausted-delivery behaviour from package 1 are unchanged.

**Tests** (write them in this order)

1. Worker: `reads only as many messages as free slots` and `starts a new message when a slot frees`, with a controllable fake queue and deferred handlers (no real timers).
2. Worker: `backoff by delivery count` and `dispositions` (success, acknowledged, terminal, retryable, final).
3. Worker: `shutdown returns unfinished messages to the queue`.
4. Shared: `retryable failure with attempts left keeps the bookmark processing and the run open`; `final attempt fails the bookmark after closing the run`.

**Verify**

```bash
cd apps/worker && bun test src
cd packages/shared && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bunx jest -i src/__tests__/services/bookmark.processor.service.test.ts
bun run --cwd packages/shared build && bun run --cwd apps/worker build && cd apps/worker && bunx eslint "src/**/*.ts"
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

### T-5 · A run has a deadline

| | |
|---|---|
| Status | Todo |
| Depends on | T-4 |
| Traces | Finding 4 (run longer than the visibility timeout) · PR 2 item 5 · decision D-8 |
| Ships as | User-visible: a stuck page or model call ends within 4 minutes and is retried instead of blocking a worker slot until redelivery |
| Size | M |
| Touches | `packages/shared/src/ai/index.ts` · `packages/shared/src/services/` · `apps/worker/src/queue/` |

**Goal.** One abort signal per run, firing after 240 s (shorter than the 300 s visibility timeout), reaches every fetch, rendered extraction, model call and embedding call of that run, and a run that hits it fails as a retryable error.

**Context.** Spec Finding 4 and decision D-8. Model calls (`AI.generateObjectWithUsage`) and embedding calls have no timeout; `CosmicHttpClient.fetch` already accepts a `signal`; `WebScrapingServiceImpl.scrape` takes an `ExtractionContext`; rendered providers use `withFetchDeadline` with their own fixed budgets. A run longer than 300 s is redelivered while still running.

**Scope**

- `processor.process` creates `AbortSignal.timeout(RUN_DEADLINE_MS)` (default 240000, overridable by `RUN_DEADLINE_MS` for tests) and passes it down: `ai/index.ts` (`generateObjectWithUsage` and `generateObject` forward `abortSignal` to the AI SDK), `embedding.service.ts` (`embed`, `embedMany`), `ExtractionContext.signal` through `WebScrapingServiceImpl.scrape` to the HTTP client and provider `extract` calls (combine with each provider's own deadline).
- A run that is aborted by the deadline throws a `RunDeadlineError` carrying `shouldRetry: true`, which T-4's consumer retries with backoff. On shutdown after the grace period, abort in-flight runs the same way so they return to the queue.

**Out of scope**

- Changing any provider's own timeouts, response size caps (package 3), or the visibility timeout.

**Acceptance criteria**

- [ ] Given a model call that never returns, when the deadline passes, then the run fails with `RunDeadlineError`, the pending call received an aborted signal, and the bookmark is handled as a retryable failure (Finding 4).
- [ ] Given a page fetch that never returns, then the same happens for the fetch phase.
- [ ] Given a run that finishes before the deadline, then nothing changes and no timer keeps the process alive afterwards.
- [ ] Given `RUN_DEADLINE_MS` is unset, then the deadline is 240 s.

**Tests** (write them in this order)

1. Shared: `a hanging model call is aborted at the deadline and fails retryably` using `RUN_DEADLINE_MS` of a few hundred milliseconds and an AI fake that records the signal.
2. Shared: `a hanging fetch is aborted at the deadline`; `an embedding call receives the signal`.
3. Shared: `a fast run leaves no pending timer`.
4. Worker: `shutdown after the grace period aborts in-flight runs`.

**Verify**

```bash
cd packages/shared && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bunx jest -i src/__tests__
cd apps/worker && bun test src
bun run --cwd packages/shared build && bun run --cwd apps/api build && bun run --cwd apps/worker build
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

## Implementation review

| Repo | Feature branch | Base SHA | Reviewed SHA | Tasks | Rounds | Verdict | Checks | Findings / follow-ups |
|---|---|---|---|---|---|---|---|---|
| cosmic-dolphin | `feature/save-pipeline-2` | | | T-1 to T-5 | 0 | Pending | | |

## Delivery

**Approval provenance.** Spec: approved by the user's go-ahead of 2026-11-15, amended by D-1 to D-9. This plan: pending approval while Draft. The execution grant is recorded in Authorization.

| Repo | PR | Head SHA | Base SHA | State | Proof / decisions | Merge SHA |
|---|---|---|---|---|---|---|
| cosmic-dolphin | | | | Not started | | |

## Rollout

The first two steps follow the package's merge; the coordinator does not perform them. The API and worker deploy together, but either may briefly run old code next to new: both sides read and write the same queue rows with the same payloads, so every combination works.

- **R-1** Confirm the automatic backend deploy finished green and that the worker logs `Starting to process queue: bookmarks`. Owner: the user.
- **R-2** In production, save one link and confirm it reaches `completed` within about a minute; save the same link again and confirm "Already in your Library"; on a failed bookmark tap Retry twice quickly and confirm one run in the timeline. Owner: the user.
- **R-3** Over the next day, confirm the queue is not backing up: the user (or the coordinator, with the user's say-so, in a read-only transaction) checks `select count(*) from pgmq.q_bookmarks` stays near zero. Owner: the user. Package 3 starts only after R-2 passes.

## Coverage

Spec items are the numbered findings and the PR 2 items in the spec. Packages 1, 3, 4 and 5 are separate packages (D-3).

| Spec item | Task(s) |
|---|---|
| PR 2 item 1 | T-1 |
| Debt: two queue transports; dead worker `popMessage` | T-1 |
| Finding 7 | T-2 |
| Finding 9 | T-2 |
| Finding 16, create path | T-2 |
| PR 2 item 2, create and reshare | T-2 |
| PR 2 item 6 | T-2 |
| Finding 4, API half (second Retry or paste, watchdog) | T-3 |
| PR 2 item 2, reprocess and paste | T-3 |
| Finding 4, retryable failure marked failed while queued | T-4 |
| Finding 5 | T-4 |
| Finding 22 | T-4 |
| PR 2 items 3 and 4 | T-4 |
| Finding 4, run longer than the visibility timeout | T-5 |
| PR 2 item 5 | T-5 |
| Findings 1, 3, 6, 8, 10, 11, 17 | package [Package 1, merged in PR 258](tasks.md) |
| Findings 2, 3 (size cap half), 12 to 15, 18 to 21, 23, 24 | package [PRs 3, 4 and 5](../2026-11-15-save-pipeline-backend.md) |

## Spec gaps and breakdown decisions

| ID | Gap or decision | Resolution | Decided by |
|---|---|---|---|
| B-1 | Package scope. | This file covers PR 2 only (spec D-3). | User ("1a") |
| B-2 | Whether production can run queue commands through the database connection (spec D-5). | Yes: verified read-only on 2026-11-16, recorded as D-6. | User ("You can do that yourself"), result in the spec |
| B-3 | The budget unit and the timing numbers the plan left open (spec PR 2 items 4, 5 and 6). | Created-bookmarks count, 240 s deadline, 30 s / 120 s / 600 s backoff, 1 s poll (D-7, D-8). Listed for the user's approval with this plan. | Breakdown owner, within D-1 |
| B-4 | A paste or Retry on a bookmark already processing. | Retry answers 202 "Already processing"; paste answers 409 (D-9). | Breakdown owner, within the spec's rule that `processing` means one live message |
| B-5 | Where a task file for a second package lives. | `tasks-2.md` beside `tasks.md`, because `tasks.md` is package 1's merged record. | Breakdown owner |
| B-6 | `createServiceContainer` still takes a Supabase client. | Left unused here; package 4 removes it with the per-route containers. | Breakdown owner, per the spec's PR 4 item 1 |
