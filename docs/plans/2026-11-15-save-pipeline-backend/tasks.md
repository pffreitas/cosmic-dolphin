# Tasks: Save pipeline backend, package 1 of 5 — stop corrupting and looping

| | |
|---|---|
| Spec | [2026-11-15-save-pipeline-backend.md](../2026-11-15-save-pipeline-backend.md) · Status at breakdown: Approved by the user's go-ahead on 2026-11-15 ("Go ahead with the plan. I accept your recommendations"), amended by decisions D-1 to D-5 in the spec |
| Spec revision | `uncommitted, sha256:b2ea8aa77873` |
| Generated with | `/Users/paulo.freitas/.claude/skills/spec-breakdown` · SKILL.md sha256 `f7d0c27c94c9` |
| Readiness | The spec has no open questions: its three "Decisions needed" were answered (D-1, D-2) and the four breakdown questions were answered (D-2 to D-5). Package scope is B-1. |
| Prototype | N/A: no UI |
| Status | Approved |
| Date | 2026-11-15 |
| Feature flag | N/A: no flag. Every change corrects or removes existing behaviour and is covered by tests; there is no staged behaviour to switch. |
| Integration | Feature branch `feature/save-pipeline-1` → GitHub PR → `main` on `origin`; one complete package |
| Delivery | github-pr |
| Authorization | Requested: the user wrote "Full send it to prod" on 2026-11-15 (this conversation), then chose sequential packages (D-3). Scope: implement, review, open the PR and merge this package after the full gate. A merge to `main` deploys the API and worker to production automatically (see Repo conventions). It does not cover manual rollout (R-1, R-2), packages 2 to 5, or any production data change. Plan approved by the user on 2026-11-15 ("Yes"). |
| Plan | 4 tasks · critical path T-1 → T-2 → T-3 → T-4 · 1 lane (all tasks share files) |

## Repos

| Repo | Remote | Path at breakdown | Target branch | Feature branch | Merge order |
|---|---|---|---|---|---|
| cosmic-dolphin | `origin` · `git@github.com:pffreitas/cosmic-dolphin.git` | `/Users/paulo.freitas/.t3/worktrees/cosmic-dolphin/t3-d5d2dfab-8b0d818df5dc231a` (this worktree has unrelated uncommitted design work; build in a separate worktree) | `main` | `feature/save-pipeline-1` | 1 |

## How to work this plan

Point a coding agent at this file ("Work the plan in `docs/plans/2026-11-15-save-pipeline-backend/tasks.md`") and it runs as the
**coordinator**. Developer subagents build the tasks test-first on `feature/save-pipeline-1`. The
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
   worktree or the user's direction. Never discard it. Create `feature/save-pipeline-1` from the fetched target in an
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
5. **Blocked work.** Preserve unfinished code in a local `wip/save-pipeline-1-<T-n>` branch based on the
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
You are the developer for <T-n> in docs/plans/2026-11-15-save-pipeline-backend/tasks.md. Read the file header, *Repo conventions*,
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
You review the whole feature in docs/plans/2026-11-15-save-pipeline-backend/tasks.md. Read the header, *Repo conventions*,
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

- **Build**: `bun install --frozen-lockfile && bun run apispec:compile && bun run apispec:build && bun run --cwd packages/shared build && bun run --cwd apps/api build && bun run --cwd apps/worker build`
- **Test**: shared `cd packages/shared && bunx jest <file>` (Jest 30); API `cd apps/api && bun test <file>`; worker `cd apps/worker && bun test src`. Shared integration tests use the real database through `getTestDatabase()` (`packages/shared/src/test-utils/database.ts`).
- **Lint / format / type-check**: type-check is the build above. Lint: `bun run --cwd apps/api lint` and `cd apps/worker && bunx eslint "src/**/*.ts"` (the worker's own `lint` script passes `--fix`, which rewrites tracked files; do not use it). Both currently report 0 errors and warnings only.
- **Verify all**: the build above, then the disposable-database gate from `docs/runbooks/backend-and-testflight-release.md`:
  `COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:up`, then `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:reset`, then the same environment with `bun run test:backend -- --env-mode=loose --concurrency=1 --force`. Run shared, API and worker suites serially. A container named `cosmic-dolphin-test-db` was already running at breakdown time: check who owns it before `db:test:reset` truncates it, and never run `db:test:down` on a database another session uses. The Docker VM has 2 GB and hosts other containers: do not build Docker images here.
- **Required checks**: `deploy-backend.yml` triggers on push to `main` (paths include `apps/api`, `apps/worker`, `packages/shared`). It has no pull-request trigger, so its `build-and-test` job (build, real Lightpanda check, backend tests) runs only on the merge candidate; a failure stops the migration and deploy jobs. No other required check is configured. Verify all is therefore the only proof before merge: run it on the exact head that will be merged.
- **Merge method / protection**: `main` has no branch protection. The repository allows merge, squash and rebase. Use squash. Merging to `main` runs `build-and-test`, then `supabase db push` (this package adds no migration), then deploys both images to DigitalOcean automatically. Supabase CLI is pinned at 2.122.1.
- **Stack**: Bun 1.3.11 in CI (1.3.13 locally) · Fastify (`apps/api`), NestJS (`apps/worker`), Kysely over Postgres, pgmq through Supabase REST, TypeSpec contract. Follow `AGENTS.md` (contract first; AI calls stay in `packages/shared`; regression guidance), `docs/runbooks/backend-and-testflight-release.md`, and the ESLint configs in `apps/api` and `apps/worker`.
- **Feature flag**: none.
- **Commits**: Conventional Commits with a scope (`fix(worker): …`), trailer `Task: T-n` on feature checkpoints, and the attribution line the session requires. The PR links the spec and task IDs; squashing keeps traceability in this file.

## Plan at a glance

**Granularity rationale.** Package 1 corrects behaviour with no schema change: seven items in the spec's PR 1, grouped by mechanism and proof into four outcomes: what a run writes (T-1), what the worker will and will not run (T-2), what the timeline reports (T-3), and what create accepts (T-4). Budget: 4 to 8 for a feature; 4 fits. The tasks cannot run in parallel: T-1 to T-3 all edit `bookmark.processor.service.ts` and T-3 and T-4 both edit `apps/api/src/routes/bookmarks.ts`. Effort `S` is up to half a day, `M` half a day to two days including verification and review.

```mermaid
graph LR
  T1["T-1 Run writes only what it produced"] --> T2["T-2 Worker never loops or retries the impossible"]
  T2 --> T3["T-3 Timeline tells the truth"]
  T3 --> T4["T-4 Create validates its input"]
```

| ID | Title | Depends on | Lane | Touches | Size | Ships as |
|---|---|---|---|---|---|---|
| T-1 | A run writes only what its phases produced and stores nothing unused | none | A | `packages/shared/src/services/bookmark.processor.service.ts` · `packages/shared/src/repositories/content-chunk.repository.ts` · `packages/shared/src/__tests__/` | M | User-visible: edits made during processing survive |
| T-2 | The worker never loops on, or retries, a message that cannot succeed | T-1 | A | `apps/worker/src/` · `packages/shared/src/services/bookmark.processor.service.ts` | M | User-visible: no repeated failures after a crash or a delete; clean shutdown on deploy |
| T-3 | The timeline stops polling when processing has ended | T-2 | A | `packages/shared/src/services/bookmark-processing-reporter.service.ts` · `packages/shared/src/services/bookmark.processor.service.ts` · `apps/api/src/routes/bookmarks.ts` | M | User-visible: progress UI stops after a crash recovery |
| T-4 | Create rejects a collection the caller does not own and unbounded text | T-3 | A | `apps/api/src/routes/bookmarks.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` | M | User-visible: new 400/404 answers for invalid input |

## Tasks

### T-1 · A run writes only what its phases produced and stores nothing unused

| | |
|---|---|
| Status | Done |
| Depends on | none |
| Traces | Finding 1 · Finding 17 · PR 1 items 1 and 2 |
| Ships as | User-visible: archiving, favouriting or retitling a bookmark while it is processing is no longer undone |
| Size | M |
| Touches | `packages/shared/src/services/bookmark.processor.service.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/content-chunk.repository.ts` · `packages/shared/src/__tests__/` · `apps/worker/src/queue/queue.module.ts` |

**Goal.** After a run, the bookmark row holds the owner's current `is_archived`, `is_favorite` and title, and the extract phase stores no image bytes and makes no network request.

**Context.** Spec Findings 1 and 17. Today `process()` ends with `const { collectionId, filingSource, ...writableFields } = bookmark; await this.bookmarkService.update(id, writableFields)` (`bookmark.processor.service.ts:331`). `bookmark` is the row read at the start, so every column the run did not produce is written back stale. `processImages` (`:809`) sends the unbudgeted HTML to the model, downloads each chosen image through `httpClient.fetch`, and stores bytes via `createImageChunk`; nothing reads image chunks (the only reference outside the repository and types is the processor), and the embed phase's `deleteByScrapedContentId` removes them. The `image_chunks` table stays until package 5.

**Scope**

- `bookmark.processor.service.ts`: replace the whole-row final write with one `bookmarkService.update(id, patch)` where `patch` contains only columns a phase that ran produced. Public (non-private-link) run: `cosmicImages` (extract), `cosmicSummary`, `cosmicBriefSummary`, `cosmicKeyPoints` (summarise), `cosmicTags` (tag), `searchDocument`. Private-link run: `title`, `cosmicBriefSummary`, `cosmicTags`, `quickAccess`, `metadata` (extract), `searchDocument` is not written. Never include `isArchived`, `isFavorite`, `collectionId`, `filingSource`, or `title` on a public run (the fetch phase already writes the scraped title through `ensureScrapedContent`). Omit a field whose phase failed or did not run. Keep the existing rule that an unusable source clears summary, brief and key points.
- `processImages`: keep the model call that selects relevant images but give it the budgeted text (`budgetText`, at most `MAX_MODEL_CONTENT_CHARS`) instead of raw HTML; return `{{ url, title, description }}` for http(s) URLs only; remove the download, `createImageChunk` call and the `httpClient` dependency if nothing else uses it (update `queue.module.ts` and test constructors).
- `content-chunk.repository.ts`: remove `createImageChunk` and `CreateImageChunkData`. Leave the read methods and the `image_chunks` table alone.

**Out of scope**

- Dropping the `image_chunks` table or any index (package 5).
- Size caps and private-address blocking for fetches (package 3).
- Batching chunk and embedding writes (package 4).

**Acceptance criteria**

- [ ] Given a run in flight, when the owner archives, favourites and retitles the bookmark after the run read it and before it finishes, then after the run those three values are the owner's (Finding 1).
- [ ] Given every phase succeeds, then the single final write sets exactly images, summary, brief, key points, tags and search document (Finding 1).
- [ ] Given the summarise phase fails, then the existing summary, brief and key points are untouched, and given the tag phase fails, the existing tags are untouched (existing "a failure subtracts nothing" rule).
- [ ] Given a private-link run, then title, brief, tags, quick access and metadata are written and `isArchived`/`isFavorite` are not (Finding 1).
- [ ] Given an unusable source, then summary, brief and key points are cleared as before and nothing else is written (existing behaviour).
- [ ] Given content with images, then extract makes one model call, with text no longer than `MAX_MODEL_CONTENT_CHARS`, makes no HTTP request, writes no chunk, and returns only http(s) URLs (Finding 17).
- [ ] `createImageChunk` no longer exists, and the embed phase still replaces text chunks idempotently.

**Tests** (write them in this order)

1. Integration (`getTestDatabase`, real repositories): `run keeps owner edits made while processing`: archive, favourite and retitle between the processor's read and its final write; assert the three values (Finding 1).
2. Unit: `final write contains only produced fields`, one case each for full success, summarise failed, tag failed, private link, unusable source (Finding 1).
3. Unit: `extract selects images without any network or storage`: assert `httpClient.fetch` is never called, the prompt text is within the budget for a 500,000-character page, and a relative or non-http URL is dropped (Finding 17).
4. Compile-time: `createImageChunk` removal leaves `bun run --cwd packages/shared build` and `apps/worker` build green.

**Verify**

```bash
cd packages/shared && bunx jest src/__tests__/services/bookmark.processor.service.test.ts
cd packages/shared && DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bunx jest src/__tests__/integration
bun run --cwd packages/shared build && bun run --cwd apps/worker build
```

**Notes**

Verified 2026-11-15 on the feature branch: shared 432 passing (jest -i), API 383, worker 10, builds green, lint 0 errors. Tests written first, mutation-checked. Decisions: the image prompt receives `budgetText` of the page HTML (not stripped text) because the model needs the img URLs; the patch is skipped when empty; the `httpClient` constructor parameter was removed; image-chunk seed helpers moved to `test-utils/factories.ts`; one existing test now expects the summary to be left unwritten instead of written back. Touched `apps/api/src/tests/bookmark-content.test.ts` (constructor argument) and `repositories/index.ts`, outside the listed Touches but required by the removal. Test database: the in-RAM compose database crashed twice with SIGBUS (VM memory), so verification used a disk-backed container `save-pipeline-1-db` on port 5433.

### T-2 · The worker never loops on, or retries, a message that cannot succeed

| | |
|---|---|
| Status | Done |
| Depends on | T-1 |
| Traces | Finding 3 (crash-loop half) · Finding 10 · Finding 6 · PR 1 items 3, 4 and 6 |
| Ships as | User-visible: a bookmark whose processing keeps killing the worker ends `failed` instead of looping; a bookmark deleted while queued costs no retries; deploys stop the worker cleanly |
| Size | M |
| Touches | `apps/worker/src/queue/queue.processor.ts` · `apps/worker/src/queue/handlers/bookmark-processor.handler.ts` · `apps/worker/src/queue/interfaces/message-handler.interface.ts` · `apps/worker/src/queue/queue.module.ts` · `apps/worker/src/main.ts` · `apps/worker/src/queue/queue.infrastructure.spec.ts` · `packages/shared/src/services/bookmark.processor.service.ts` |

**Goal.** Three things hold: a message delivered more times than the retry limit allows is failed and archived without running; a message for a bookmark that no longer exists is acknowledged; and stopping the worker runs its graceful shutdown.

**Context.** Finding 3: max-retry handling lives only in `handleError`, which a process crash (out of memory, kill) never reaches, so pgmq redelivers forever. `handleError` already treats `read_ct - 1` as the attempts used and archives when that reaches `maxRetries` (default 3), so the last run happens at `read_ct = maxRetries + 1` (4). Finding 10: `process()` throws `Bookmark not found` before its `try`, so a deleted bookmark is retried at five-minute intervals. Finding 6: `apps/worker/src/main.ts` never calls `app.enableShutdownHooks()`, so `QueueProcessor.onModuleDestroy` never runs on SIGTERM; its shutdown also leaves a 30-second timer pending after in-flight work settles. Redelivery after shutdown still waits for the 300-second visibility timeout; shortening that is package 2.

**Scope**

- `queue.processor.ts`: before dispatching, if `message.read_ct > config.maxRetries + 1`, do not call `handle`. Call an optional handler hook `onExhausted(message)`, then archive the message. In `stopProcessing`, clear the timeout timer once the race settles.
- `message-handler.interface.ts` and `bookmark-processor.handler.ts`: add the optional `onExhausted`; the bookmark handler sets the bookmark's processing status to `failed` with the text "Processing stopped after repeated worker failures", tolerating a missing bookmark or an invalid payload. It does not touch the timeline; T-3 makes polling depend on the bookmark status.
- `bookmark.processor.service.ts`: throw an exported `BookmarkNotFoundError` instead of a bare `Error` when the bookmark is missing. The handler catches it, logs, and returns so the processor deletes the message.
- `main.ts`: call `app.enableShutdownHooks()`; extract the app setup into a function so a test can prove it.

**Out of scope**

- Changing the visibility timeout, backoff or concurrency (package 2).
- Response size caps (package 3).

**Acceptance criteria**

- [ ] Given a message with `read_ct = 5` and `maxRetries = 3`, when it is read, then the handler is not run, the bookmark is `failed` with the exhaustion text, and the message is archived (Finding 3).
- [ ] Given a message with `read_ct = 4`, then it is still run (it is the final allowed attempt) and the existing archive-on-failure behaviour is unchanged (Finding 3).
- [ ] The decision uses the pgmq `read_ct`, so it survives a worker restart (existing "exhausts retries across restarts" test keeps passing).
- [ ] Given a message whose bookmark does not exist or belongs to another user, then the message is deleted, no retry is scheduled and no error is logged as a failure (Finding 10).
- [ ] Given any other error, then retry and archive behaviour is unchanged.
- [ ] Given SIGTERM, then the app's shutdown hooks are enabled and `stopProcessing` runs, and after in-flight work settles no timer keeps the process alive (Finding 6).

**Tests** (write them in this order)

1. Worker: `exhausted delivery is failed and archived without running` for `read_ct` 4 (runs) and 5 (does not) (Finding 3).
2. Worker: `exhausted delivery with an unreadable payload is still archived`.
3. Worker + shared: `a deleted bookmark acknowledges the message` (Finding 10); `other errors still retry`.
4. Worker: `app setup enables shutdown hooks` and `stopProcessing leaves no pending timer` (Finding 6).

**Verify**

```bash
cd apps/worker && bun test src
cd packages/shared && bunx jest src/__tests__/services/bookmark.processor.service.test.ts
bun run --cwd packages/shared build && bun run --cwd apps/worker build
cd apps/worker && bunx eslint "src/**/*.ts"
```

**Notes**

Verified 2026-11-15 on the feature branch: worker 19 passing, shared 432 (jest -i), API 383, builds green, worker lint 0 errors. Red-first confirmed for exhausted-delivery, BookmarkNotFoundError, stopProcessing timer and shutdown hooks; characterization tests (read_ct 4 still runs, other errors still retry) passed immediately by design. Decisions: setup moved into new `apps/worker/src/app.setup.ts` (main.ts runs bootstrap on import, so it was untestable); `updateProcessingStatus` is not user scoped so onExhausted fails the bookmark by id; the shutdown test uses a stub app and does not send a real SIGTERM.

### T-3 · The timeline stops polling when processing has ended

| | |
|---|---|
| Status | Todo |
| Depends on | T-2 |
| Traces | Finding 8 · PR 1 item 5 |
| Ships as | User-visible: after a worker crash and recovery, the progress UI stops polling and shows the failed or completed phase it should |
| Size | M |
| Touches | `packages/shared/src/services/bookmark-processing-reporter.service.ts` · `packages/shared/src/services/bookmark.processor.service.ts` · `apps/api/src/routes/bookmarks.ts` · `apps/api/src/tests/bookmark-processing-timeline.test.ts` |

**Goal.** A bookmark that is not `processing` always yields `pollAfterMs: 0`, and a run's events are closed before its bookmark leaves `processing`.

**Context.** Finding 8. `buildBookmarkProcessingTimelineResponse` (`bookmarks.ts:267`) returns 2000 ms when the bookmark is `processing` or any event is still `running`. `resumeRun` (`bookmark-processing-reporter.service.ts`) reopens the run after a crash but never closes the event the crash interrupted, so it stays `running` and polling never stops. The existing test "continues polling when the timeline run is still running" asserts that a `completed` bookmark with a `running` run polls; it exists because the processor sets the bookmark `completed` before it closes the run (`updateProcessingStatus` then `completeRun`), leaving a short window where the two disagree. The fix is to close the run first, so the bookmark status alone can drive polling. The watchdog that fails a `processing` bookmark with no timeline after two minutes stays; package 2 removes it.

**Scope**

- `bookmark-processing-reporter.service.ts`: in `resumeRun`, mark every event of the resumed run that is still `running` as `failed` with error "Interrupted before it finished", with end time and duration set.
- `bookmark.processor.service.ts`: at every terminal path (success, phase failure, unusable source, thrown error), close the run (`completeRun` or `failRun`) before setting the bookmark `completed` or `failed`. A failure while closing the run must not stop the status change (use `try`/`finally`).
- `bookmarks.ts`: derive `pollAfterMs` from the bookmark's `processingStatus` only (`processing` gives 2000, otherwise 0). Update the existing "continues polling" test to assert the new contract and say so in Notes.

**Out of scope**

- Removing the watchdog or changing the two-minute deadline (package 2).
- Changing what the timeline endpoint returns besides `pollAfterMs`.

**Acceptance criteria**

- [ ] Given a resumed run whose previous attempt left a phase and a turn `running`, when it resumes, then both become `failed` with the interruption text and new events continue after the highest sequence (Finding 8).
- [ ] Given a bookmark that is `completed` or `failed`, when its timeline is requested, then `pollAfterMs` is 0 even if an event is `running` (Finding 8).
- [ ] Given a bookmark that is `processing`, then `pollAfterMs` is 2000 (existing behaviour).
- [ ] Given each terminal path, then the run is closed before the bookmark status changes, and a failing `completeRun` still lets the status change (Finding 8).
- [ ] The no-timeline watchdog still fails a `processing` bookmark after two minutes (existing test).

**Tests** (write them in this order)

1. Shared: `resumeRun closes interrupted events` (Finding 8).
2. Shared: `run is closed before the bookmark leaves processing` for success, phase failure, unusable source and thrown error, asserting call order; plus `status still changes when closing the run fails`.
3. API: `completed bookmark with a running event does not poll`; `processing bookmark polls`; watchdog test unchanged.

**Verify**

```bash
cd packages/shared && bunx jest src/__tests__/services/bookmark.processor.service.test.ts
cd packages/shared && bunx jest -t "resumeRun|reporter"
cd apps/api && bun test src/tests/bookmark-processing-timeline.test.ts
bun run --cwd packages/shared build && bun run --cwd apps/api build
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

### T-4 · Create rejects a collection the caller does not own and unbounded text

| | |
|---|---|
| Status | Todo |
| Depends on | T-3 |
| Traces | Finding 11 · PR 1 item 7 |
| Ships as | User-visible: `POST /bookmarks` answers 404 for a collection the caller does not own, 400 for a non-UUID collection id or oversized title, description or tags |
| Size | M |
| Touches | `apps/api/src/routes/bookmarks.ts` · `apps/api/src/tests/bookmark-capture.test.ts` · `apps/api/src/tests/bookmark.test.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` |

**Goal.** One schema validates the whole create body, and a request naming someone else's collection is refused before anything is written.

**Context.** Finding 11. `POST /bookmarks` passes `collection_id` straight to `createPrivateLink` or `create`, where `filing_source` becomes `user`; refile (`refileBookmarkForUser`) checks ownership first and answers 404 "Collection not found". Validation is split across `validateCreateBookmarkBody` and `captureBodySchema` (`bookmarks.ts:130`), and `later_until` is converted to a `Date` in five places. Limits come from decisions B-2 and B-3. The generated client is tracked; regenerate it, never edit it.

**Scope**

- `bookmarks.ts`: build one Zod schema for the create body covering URL, private-link rules, capture fields, `collection_id` (UUID), `title` (trimmed, at most 300 characters), `description` (at most 2000), `tags` (at most 50, each trimmed, non-blank, at most 64 characters), and convert `later_until` to a `Date` once. Keep `validateCreateBookmarkBody` exported with the same signature and messages for existing tests. Before the duplicate lookup, if `collection_id` is present, call `services.collection.findByIdAndUser`; not found answers 404 `{{ error: "Collection not found" }}`.
- `bookmarks.tsp`: document the 404 and the limits; run `bun run apispec` and commit the regenerated client.
- The share-key body stays strict (`source_url` and capture fields only) and its replies are unchanged.

**Out of scope**

- Any change to successful or duplicate response bodies, status codes or messages.
- Other endpoints' validation.

**Acceptance criteria**

- [ ] Given a `collection_id` that does not exist or belongs to another user, when saving (public or private link), then 404 "Collection not found", no row, no queue message (Finding 11).
- [ ] Given a `collection_id` that is not a UUID, then 400 with a message naming `collection_id`, not 500 (Finding 11).
- [ ] Given a title over 300, a description over 2000, more than 50 tags, or a tag over 64 characters or blank, then 400 with the first message (Finding 11).
- [ ] Given today's valid bodies (including `later_until` null, future and omitted), then responses are identical to before (existing tests pass unchanged).
- [ ] Given a share-key request with an extra field, then 400 as today.
- [ ] `bun run apispec` output is committed, `api-contract.test.ts` passes, and no generated file is hand edited.

**Tests** (write them in this order)

1. API: `rejects a collection the caller does not own`, public and private link, asserting nothing is created or queued (Finding 11).
2. API: `rejects a non-UUID collection id`; table-driven limits for title, description and tags.
3. API: `valid bodies keep their exact responses` for `later_until` null, future, omitted, duplicate and share-key paths.
4. Contract: `api-contract.test.ts` passes after regeneration.

**Verify**

```bash
cd apps/api && bun test src/tests/bookmark-capture.test.ts src/tests/bookmark.test.ts src/tests/api-contract.test.ts
bun run apispec
bun run --cwd apps/api build && bun run --cwd apps/api lint
git diff --stat -- packages/api-client packages/apispec
```

**Notes**

_For the coordinator: verification results, follow-ups, blockers, commits in other repos._

## Implementation review

| Repo | Feature branch | Base SHA | Reviewed SHA | Tasks | Rounds | Verdict | Checks | Findings / follow-ups |
|---|---|---|---|---|---|---|---|---|
| cosmic-dolphin | `feature/save-pipeline-1` | | | T-1 to T-4 | 0 | Pending | | |

## Delivery

**Approval provenance.** Spec: approved by the user's go-ahead of 2026-11-15, amended by D-1 to D-5 (spec revision above). This plan: approved by the user on 2026-11-15 ("Yes") at the content in this file. The execution grant is recorded in Authorization.

| Repo | PR | Head SHA | Base SHA | State | Proof / decisions | Merge SHA |
|---|---|---|---|---|---|---|
| cosmic-dolphin | | | | Not started | | |

## Rollout

Both steps follow the package's merge. The coordinator does not perform them.

- **R-1** Confirm the automatic backend deploy finished green (`build-and-test`, migrations job with no changes, `deploy`) and that the worker logs `Starting to process queue: bookmarks`. Owner: the user.
- **R-2** In production, save one link and confirm it reaches `completed`; archive it while it is processing and confirm it stays archived; check the worker log shows no repeated retries. This is the observation window before package 2 is started (spec decision D-3). Owner: the user.

## Coverage

Spec items are the numbered findings and the PR 1 items in the spec. Packages 2 to 5 are separate packages (D-3) with no tasks file yet.

| Spec item | Task(s) |
|---|---|
| Finding 1 | T-1 |
| Finding 17 | T-1 |
| Finding 3, crash-loop half (PR 1 item 3) | T-2 |
| Finding 3, response size cap half | package [Network safety, PR 3](../2026-11-15-save-pipeline-backend.md) |
| Finding 10 | T-2 |
| Finding 6 | T-2 |
| Finding 8 | T-3 |
| Finding 11 | T-4 |
| PR 1 items 1, 2 | T-1 |
| PR 1 items 3, 4, 6 | T-2 |
| PR 1 item 5 | T-3 |
| PR 1 item 7 | T-4 |
| Findings 2, 4, 5, 7, 9, 12 to 16, 18 to 24 and the debt list | package [PRs 2, 4 and 5](../2026-11-15-save-pipeline-backend.md) |

## Spec gaps and breakdown decisions

| ID | Gap or decision | Resolution | Decided by |
|---|---|---|---|
| B-1 | Package scope. | This tasks file covers PR 1 only. PRs 2 to 5 each get their own breakdown after the previous package is merged, deployed and observed (spec D-3). | User ("1a") |
| B-2 | Create-body limits (title, description, tags) are not in the spec. | Title 300, description 2000, 50 tags of up to 64 characters. The tag count matches the PATCH rule; the others are generous bounds chosen by the breakdown so that no realistic client breaks. They are stated in the contract. | Breakdown owner, within the spec's Finding 11 |
| B-3 | What create answers for a collection the caller does not own is not in the spec. | 404 "Collection not found", the same as refile (`refileBookmarkForUser`); a non-UUID id is 400. Checked before the duplicate lookup. | Breakdown, by precedent in `bookmarks.ts` refile |
| B-4 | Whether to run the DB-backed gate during breakdown. | Not run: the Docker VM has 2 GB, hosts other containers, and a container named `cosmic-dolphin-test-db` was already running and may belong to another session. Builds, lint and the targeted tests were run on `0d4ee5e` and passed (shared processor 48, worker 10, API 17; 0 lint errors). The coordinator runs Verify all before starting. | Breakdown, per `AGENTS.md` shared-infrastructure rule |
| B-5 | The spec's "tags from the summary" (D-2) and PR 5's drops (D-4) are deferred to their packages. | They are not in this package; D-2 and D-4 are recorded in the spec. | User ("2b", "4b"); sequencing per B-1 |
