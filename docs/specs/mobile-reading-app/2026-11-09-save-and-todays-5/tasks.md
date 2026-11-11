# Tasks: Save + Today’s 5

| | |
|---|---|
| Spec | [Save + Today’s 5](../2026-11-09-save-and-todays-5.md) · Status at breakdown: Approved |
| Spec revision | uncommitted, sha256:bafeb812ef1164e7f57dbdb963a2d4ca4de3bfb47ce028d72ad33f51ba7d40b7 |
| Generated with | /Users/paulo.freitas/.agents/skills/spec-breakdown/SKILL.md · bundle sha256:124ebcf2c424572fceeaca35495af25c9c33d6b479bf41f06dc5c3124b07d911 (skill, template, protocol, patterns, checker; ordered path+content) |
| Readiness | Spec §11 ready; PM/Architect/Designer approved. RY-1…4 resolved: private capture, all-consumer compile, iOS15 Paste, future snooze bounds. A-1…4 and DOC-1/2 carried unchanged. |
| Prototype | [Approved standalone prototype](./prototype.html) · sha256:75906f1a46dfb19ca0272d0a785da06c3afd59686f3028835ed6d6fe9eee378f |
| Status | Approved |
| Date | 2026-11-10 |
| Approved by | Paulo Freitas on 2026-11-10, user reply “approved” · approved draft sha256:74aa524138d7de738c082b421284573920f4f27593f71fb73ca5e947f33de25b |
| Feature flag | N/A: internal TestFlight audience; extend the existing app in place (D-13, §8.1) |
| Integration | Feature branch `feature/save-and-todays-5` → one complete GitHub PR → `main` on `origin` (`git@github.com:pffreitas/cosmic-dolphin.git`); squash merge |
| Delivery | github-pr |
| Authorization | Paulo approved full send on2026-11-11: “Approved full send the change to master and TestFlight so I can beta test it via TestFlight to validate”. This authorizes the complete package review/PR/squash merge into the actual default branch main and manual TestFlight delivery after backend green. Earlier approvals preserved; remaining unavailable native/session proofs move to beta validation under the explicit grant below. |
| Plan | 10 tasks · critical path T-1 → T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → T-8 → T-9 → T-10 · one serial lane |


**Execution clarification (2026-11-10).** Paulo confirmed “No physical iPhone is available” and pointed to the existing iPhone simulator. Continue implementation using that native simulator, XCTest, real local API/database tests and signed EAS capability inspection. The coordinator had over-gated T-2 on physical-device availability. Implementation checkpoints may proceed on those available checks; retain unavailable physical-phone/Wi-Fi/LTE and normal-issuer real-session outcomes as explicit pending proof in T-10/the package checklist. No such outcome is claimed passed, and no release/merge grant or product requirement is changed. This clarification governs task dependencies during implementation; it does not permit partial release or replacing pending package proof with an HTML demo.

**Beta delivery authorization (2026-11-11).** Paulo approved the concrete gate-change proposal and explicitly requested full send to “master and TestFlight” for beta validation. The actual repository default/deploy branch is `main`; use its existing squash PR and deployment workflows. This latest user instruction supersedes the earlier no-merge grant and pre-review/pre-PR/pre-merge blocks caused solely by unavailable T-10 native/session/physical proof. All implementation, local tests/types/lint/generation, numeric/security/compatibility/query fixtures, signed capability inspections, whole-feature Sol review and live GitHub checks remain required. Bring the complete verified T-10 WIP into this feature, review/merge the single complete package, require deploy-backend tests/migrations/API/worker green, then dispatch production iOS TestFlight. Pending normal-issuer/physical-radio/live-spoken/full native matrix/prior-device evidence stays explicitly unchecked for TestFlight beta validation; it is not passed, removed or replaced with HTML. T-10 Done denotes completed code and available proof under this authorized beta gate, not all physical acceptance proofs. No public App Store/wider rollout is granted, and any capture loss still requires PM clearance. The latest instruction also explicitly assigns the manual TestFlight step to the coordinator. This authorized exception governs the generic all-task/proof gate text below.

## How to work this plan

Point a coding agent at this file ("Work the plan in `docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5/tasks.md`") and it runs as the
**coordinator**. Developer subagents build the tasks test-first on `feature/save-and-todays-5`. The
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
   worktree or the user's direction. Never discard it. Create `feature/save-and-todays-5` from the fetched target in an
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
5. **Blocked work.** Preserve unfinished code in a local `wip/save-and-todays-5-<T-n>` branch based on the
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
You are the developer for <T-n> in docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5/tasks.md. Read the file header, *Repo conventions*,
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
You review the whole feature in docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5/tasks.md. Read the header, *Repo conventions*,
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

- **Source rules:** `AGENTS.md`, `CLAUDE.md`; `docs/functional-spec/01-product-model.md` and the linked capture/library/feed/social/API documents; `docs/design-system/README.md`, `foundations.md`, `components.md`, `patterns.md`, `pages.md`, `implementation.md`, `audit.md`; `apps/mobile/IMPLEMENTATION.md`; package ESLint configs. This approved spec replaces the older mobile prototype and its ink accent where explicitly stated. Existing web conventions remain in force.
- **Stack:** Bun1.3.11, Node22+, TypeScript, Expo54/React Native0.81/Expo Router6, Fastify4/Zod, shared Kysely/Postgres, NestJS worker, existing pgmq. Mobile imports generated `@cosmic-dolphin/api-client`; never shared backend modules. Extend `lib/mobile-api.ts` for new/changed contracts; do not propagate the older manual-fetch `lib/api.ts` pattern into new APIs. AI calls and processing stay in shared services.
- **Contracts/migrations:** TypeSpec first in `packages/apispec/*.tsp`; `bun run apispec`; commit generated tracked client changes without manual edits. `git ls-files packages/api-client/src` includes models/docs; the contrary comment in accessibility.yml is stale. Additive schema migrations under `supabase/migrations/`, Kysely types in `packages/shared/src/database/schema.ts`. Production `db:migrate` is not a test command. Tests use disposable Postgres5433, never a hosted database or one containing data to retain.
- **Build:** `bun run --cwd packages/shared build`, `bun run --cwd apps/api build`, `bun run --cwd apps/worker build`; API generation before consumer compilation. Native binary proof uses EAS preview from `apps/mobile` (`eas build --profile preview --platform all`). Never run `expo prebuild --clean`: committed iOS project/extension is hand-maintained; set `expo-share-intent` `disableIOS: true` as specified.
- **Tests:** API/worker scripts use Bun test, not Jest pattern flags. Examples: `bun run --cwd apps/api test -- src/tests/api-contract.test.ts`, `bun run --cwd apps/worker test`. Shared uses Jest30: `bun run --cwd packages/shared test -- --runInBand --testPathPatterns=bookmark.service`. Mobile uses Jest29/RNTL: `bun run --cwd apps/mobile test -- --runInBand --testPathPattern=save-queue`. Web uses Vitest: `bun run --cwd apps/web test`. New suite names in tasks are proposed files; their package runners already exist.
- **Database setup:** `bun run db:test:up`, then `bun run db:test:reset`. Backend suites truncate public tables, including shared Jest setup; run them serially. Root `bun run test:db` is the complete backend gate. Stop/discard via `bun run db:test:down` when finished.
- **Lint/type checks:** mobile `bun run --cwd apps/mobile lint`; web `bun run --cwd apps/web lint`; `bun run tokens:check`. Backend lint: `bun run --cwd apps/api lint`; worker's script uses `--fix`, so inspect its changes or use `cd apps/worker && bunx eslint 'src/**/*.ts' 'test/**/*.ts'` without fixes. Root `bun run typecheck` runs the available web typecheck script; compile api/worker/shared/mobile individually with `bunx tsc --noEmit -p` and the corresponding tsconfig.
- **Starting baseline:** GitHub main and local HEAD matched `b7045a4c56f896d085e2e1aef79b12ea1cfa6407` on2026-11-10. No touched-path drift since spec date, no new feature already shipped. Planning token check passed. Full typecheck and mobile tests were unavailable because this checkout lacks installed `turbo`/`jest`; no source baseline pass is claimed. At execution setup, install with Bun and generate, run Verify all on the fetched target before T-1; stop/report a red baseline rather than making unrelated repairs under this feature.
- **Verify all**: `bun run apispec`, shared build, the explicit compilation/test/lint commands below (root; after normal dependency setup).

```bash
bun run apispec
bun run --cwd packages/shared build
bun run typecheck
bunx tsc --noEmit -p packages/shared/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p apps/worker/tsconfig.json
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run test:db
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile test -- --ci --runInBand
bun run --cwd apps/web lint
bun run --cwd apps/web test
bun run tokens:check
```

Native EAS/device, performance, compatibility and security proof from T-10 also gate final review/PR delivery; they cannot be replaced by bundle export or the HTML simulation. Starting-target checks cover existing behavior; new feature-specific proofs apply after their owning tasks exist.

- **Required checks/triggers:** existing `Accessibility gate / Rule ten` runs on every PR and main push: generation, web contrast/semantics/motion, full web lint/tests and mobile token lint. New `mobile-pr.yml` from T-10 runs mobile lint, `tsc --noEmit` and Jest on PRs matching mobile deploy paths. These PR-only checks run after PR creation and block merge. Local Verify all and the branch preview/device proofs run before review. Ordinary feature pushes have no backend deploy gate. On main merge, `deploy-backend.yml` runs backend tests, migration then containers; `deploy-mobile.yml` runs quality/internal builds; generated contracts trigger web rebuild. TestFlight remains manual after backend green.
- **Merge method/protection:** GitHub allows squash, merge and rebase; this spec chooses squash. Main protection API returned404/unprotected on2026-11-10; no configured required approval count or merge queue. Recheck live rules at execution and preserve all checks/reviews. No direct main pushes, no individual task PRs, no automatic merge without a separate explicit grant.
- **Commits:** Conventional Commits, e.g. `feat(mobile): persist captured links`, with `Task: T-n` trailer. Record full checkpoint SHA in each Notes field; keep task-to-commit mapping through squash. No new flag, analytics SDK, action offline queue, notification or backlog feature.


### Feature-branch native proof environment

Use this recipe for T-2 keychain, T-3/T-4 native and T-10 primary-outcome checks. It is a test setup, not deployment/integration of the package. EAS only builds the client; pair it with the same feature candidate's normal local API/worker.

1. At T-1, add `apps/api/src/tests/device-fixtures.ts` with a guard test for loopback/marker/account-id validation: a test-only seeder using the existing loopback5433/marker guard. Read `DEVICE_TEST_USER_IDS` as the authenticated internal test accounts' UUIDs; seed matching local auth/profile rows and fictional ≥5 eligible saves across ≥3domains. Never write hosted business data. Do not run truncating suites concurrently with a device session; reset/reseed between independent sessions.
2. Use existing Supabase auth issuer/configured internal test accounts for real sign-in only; keep JWT middleware unchanged. Both branch API and preview mobile use that issuer. `DATABASE_URL` for API/worker is explicitly local disposable5433, so bookmarks/keys/picks/content are branch data. Reuse existing provider configuration without printing secrets; if credentials/build tools are unavailable report the missing prerequisite.
3. In separate terminals from the feature root, after generation/shared build and local DB setup:

```bash
bun run db:test:up
bun run db:test:reset
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test bun --env-file=.env apps/api/src/tests/device-fixtures.ts
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres API_PORT=3030 HOST=0.0.0.0 bun --env-file=.env apps/api/src/index.ts
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres bun --env-file=.env run --cwd apps/worker start:dev
```

Set DEVICE_TEST_USER_IDS from the signed-in test sessions before running the seeder. API and worker commands are long-running separate terminals, not a chained verification command. No `db:migrate`/production Supabase push occurs.

4. Architect supplies a temporary HTTPS tunnel to local3030 reachable on both Wi-Fi and LTE; Cloudflare Tunnel's `cloudflared tunnel --url http://127.0.0.1:3030` is an executable route when the CLI is installed. Before EAS preview, set `EXPO_PUBLIC_API_URL` to that actual HTTPS origin in the preview build environment, preserving existing EXPO_PUBLIC_SUPABASE_URL/ANON_KEY for auth. `MobileAPI` appends `/api/v1`; shared key payload gets the same origin. Verify actual build API origin and both normal JWT and restricted-key calls from the phone. Do not point the build at production business APIs or weaken auth/ATS to simulate success. The tunnel/preview origin is an ephemeral test choice within the accepted branch-preview proof, not a new product contract.
5. Seed deterministic completed fixtures for picks/content budgets and use a real shared article plus the branch worker for pending→completion. Device API requests and worker consume the local candidate DB. For web cross-device read-state proof, run the existing web app against that same candidate API. Record actual candidate/build/endpoint and results, then close the tunnel/servers and discard the test DB. T-10 repeats the primary outcome on this environment; R-3 later checks deployed TestFlight separately.


**Native fixture execution** (T-2 and T-3, in addition to Jest and EAS). Select an iOS Simulator via `device_list`, set `DEVICE_TEST_ID` to its returned id and call `device_open` when UI is needed. Run the new test-only scheme from root:

```bash
xcodebuild -project apps/mobile/ios/CosmicDolphin.xcodeproj -scheme ShareQueueTests -destination "platform=iOS Simulator,id=$DEVICE_TEST_ID" test
```

The scheme/fixtures are delivered in T-2/T-3, not assumed pre-existing. Run keychain write/read, revoked-item retention, lock contention,200-entry cap, interrupted flush/replace, append during snapshot and app-import-before-group-remove cases. Each first-red fixture reports the failed invariant; the final run reports zero failures. Signed branch EAS/device checks still prove both real bundle capabilities, Safari close/host-not-open and Wi-Fi/LTE latency; XCTest alone does not prove those. Record xcodebuild result and the actual device/build outcome in task Notes.

**Picks timing method** (T-6/T-10). Seed500 newest candidates with controlled eligibility/domain fixtures. Warm10requests; measure100compute requests by deleting only that fixture user's daily_picks row between requests, and100rereads without deletion, using monotonic client elapsed time. Sort each sample and use rank ceil(0.95×100) for p95; report sample count, candidate SHA, DB/API host and compute/reread separately (≤800/200ms). Clock boundary fixtures cover05:59 with and without a previous-date row,06:00,23/25-hour DST days and same/different dates across zones using controlled Postgres test time, never a client-only calendar calculation. Content timing similarly uses100owner GETs after10warmups over20,000words and measures serialized bytes≤500KB/p95≤400ms. No suites truncate the fixture DB during measurements.

## Plan at a glance

**Granularity rationale.** Ten outcome groups fit the ten-task working budget. S means roughly up to half a day; M roughly half a day to two days including implementation/proof, not a delivery promise. All tasks are M because each crosses a behavior boundary. Duplicate capture variants, Later options, pick visibility/time states and failure codes each stay within one shared proof matrix. Native key lifecycle, cross-process iOS durability, Android return, token generation, snapshot selection, reversible actions, extracted reading and recovery need distinct coherent reviews. T-10 proves integrated budgets; it does not defer required tests or accessibility from earlier tasks.

One serial lane is deliberate: generation and shared DTOs, root auth/capture lifecycle, Home and bookmark detail overlap. A second coordinator would conflict in those files. Every checkpoint can be verified locally/against a branch preview after its dependencies; none requires its own package to ship. Only the entire checked/reviewed package goes to main.

```mermaid
graph LR
  T1["T-1 Durable in-app save"] --> T2["T-2 Restricted share key"]
  T2 --> T3["T-3 iOS save and close"]
  T3 --> T4["T-4 Android save and return"]
  T4 --> T5["T-5 Plum mobile shell"]
  T5 --> T6["T-6 Daily picks and Home"]
  T6 --> T7["T-7 Reversible reading actions"]
  T7 --> T8["T-8 Bookmark reading session"]
  T8 --> T9["T-9 Truthful failure recovery"]
  T9 --> T10["T-10 Package proof and PR CI"]
```


| ID | Title | Depends on | Lane | Touches | Size | Ships as |
|---|---|---|---|---|---|---|
| T-1 | Save a link durably from the real in-app entry | none | A | `apps/mobile/app/save.tsx` · `apps/mobile/app/_layout.tsx` · `apps/mobile/contexts/CaptureContext.tsx` · `apps/mobile/lib/save-queue.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/components/CaptureStatus.tsx` · `apps/mobile/app/(tabs)/index.tsx` · `apps/api/src/routes/bookmarks.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/database/schema.ts` · `packages/shared/src/types.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` · `supabase/migrations/` | M | User-visible: complete-package capability |
| T-2 | Issue and revoke a save-only share key | T-1 | A | `apps/api/src/middleware/share-key.ts` · `apps/api/src/middleware/auth.ts` · `apps/api/src/routes/share-keys.ts` · `apps/api/src/routes/bookmarks.ts` · `apps/api/src/index.ts` · `packages/shared/src/` · `packages/apispec/` · `packages/api-client/` · `supabase/migrations/` · `apps/mobile/contexts/AuthContext.tsx` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/lib/share-key.ts` · `apps/mobile/lib/supabase.ts` · `apps/mobile/app/(tabs)/profile.tsx` · `apps/mobile/ios/` · `apps/mobile/modules/share-queue/` | M | User-visible: complete-package capability |
| T-3 | Save and close from the native iOS share extension | T-2 | A | `apps/mobile/ios/ShareExtension/` · `apps/mobile/ios/CosmicDolphin.xcodeproj/` · `apps/mobile/ios/` · `apps/mobile/modules/share-queue/` · `apps/mobile/app.json` · `apps/mobile/app/_layout.tsx` · `apps/mobile/lib/save-queue.ts` · `apps/mobile/IMPLEMENTATION.md` | M | User-visible: complete-package capability |
| T-4 | Save and return from Android sharing without a tap | T-3 | A | `apps/mobile/app/_layout.tsx` · `apps/mobile/app/share.tsx` · `apps/mobile/lib/shareIntent.ts` · `apps/mobile/lib/save-queue.ts` · `apps/mobile/modules/share-queue/` · `apps/mobile/app/__tests__/share-logic.test.ts` | M | User-visible: complete-package capability |
| T-5 | Apply the plum mobile shell and three destinations | T-4 | A | `docs/design-system/tokens.json` · `docs/design-system/foundations.md` · `scripts/generate-tokens.mjs` · `apps/mobile/constants/theme.ts` · `apps/mobile/components/ui/Signal.tsx` · `apps/mobile/app/(tabs)/_layout.tsx` · `apps/mobile/app/(tabs)/profile.tsx` · `apps/mobile/app/profile.tsx` · `apps/mobile/app/(tabs)/index.tsx` · `apps/mobile/app/_layout.tsx` · `apps/mobile/ios/ShareExtension/ShareTheme.swift` · `apps/mobile/ios/ShareExtension/ShareViewController.swift` · native font-resource memberships as needed | M | User-visible: complete-package capability |
| T-6 | Show immutable daily picks in a finite Home | T-5 | A | `packages/shared/src/services/feed-ranking.service.ts` · `packages/shared/src/repositories/feed.repository.ts` · `packages/shared/src/services/picks.service.ts` · `packages/shared/src/repositories/picks.repository.ts` · `packages/shared/src/services/index.ts` · `packages/shared/src/repositories/index.ts` · `packages/shared/src/database/schema.ts` · `packages/shared/src/types.ts` · `apps/api/src/routes/picks.ts` · `apps/api/src/index.ts` · `packages/apispec/` · `packages/api-client/` · `supabase/migrations/` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/hooks/useHomeFeed.ts` · `apps/mobile/components/FeedCard.tsx` · `apps/mobile/components/TodayProgress.tsx` · `apps/mobile/app/(tabs)/index.tsx` | M | User-visible: complete-package capability |
| T-7 | Complete, snooze or reject an own save with Undo | T-6 | A | `apps/mobile/components/FeedCard.tsx` · `apps/mobile/components/SwipeableCard.tsx` · `apps/mobile/components/TodayProgress.tsx` · `apps/mobile/components/Toast.tsx` · `apps/mobile/lib/read-when.ts` · `apps/mobile/lib/bookmark-actions.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/app/(tabs)/index.tsx` · `apps/api/src/routes/bookmarks.ts` | M | User-visible: complete-package capability |
| T-8 | Read a bookmark and continue to the next pick | T-7 | A | `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/services/bookmark-content-blocks.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` · `apps/api/src/routes/bookmarks.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/app/bookmark/[id].tsx` · `apps/mobile/app/reader/[id].tsx` · `apps/mobile/lib/bookmark-actions.ts` · `apps/mobile/components/Toast.tsx` | M | User-visible: complete-package capability |
| T-9 | Explain extraction failures and recover with pasted text | T-8 | A | `packages/shared/src/services/bookmark.processor.service.ts` · `packages/shared/src/services/bookmark.processor.prompt.ts` · `packages/shared/src/services/bookmark.summary.ts` · `packages/shared/src/services/content-extraction.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/database/schema.ts` · `packages/shared/src/types.ts` · `packages/apispec/` · `packages/api-client/` · `supabase/migrations/` · `apps/api/src/routes/bookmarks.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/components/CaptureStatus.tsx` · `apps/mobile/components/FeedCard.tsx` · `apps/mobile/app/bookmark/[id].tsx` | M | User-visible: complete-package capability |
| T-10 | Prove the complete package and add its mobile PR gate | T-9 | A | `.github/workflows/mobile-pr.yml` · `apps/mobile/IMPLEMENTATION.md` · `apps/mobile/app/__tests__/` · `apps/mobile/components/__tests__/` · `apps/api/src/tests/` · `packages/shared/src/__tests__/` | M | User-visible: complete-package capability |

## Tasks

### T-1 · Save a link durably from the real in-app entry

| | |
|---|---|
| Status | Done |
| Depends on | none |
| Traces | FR-4 · FR-5 · FR-6 · FR-26 · FR-27 · NFR-4 · NFR-5 · FR-19 at capture · S-5 · S-23 · §8.4 Writes/App save queue · §8.6 Duplicate URL/Save request failed/Private save · §8.8 Bookmark created |
| Ships as | User-visible: save a link durably from the real in-app entry in the complete package |
| Size | M |
| Touches | `apps/mobile/app/save.tsx` · `apps/mobile/app/_layout.tsx` · `apps/mobile/contexts/CaptureContext.tsx` · `apps/mobile/lib/save-queue.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/components/CaptureStatus.tsx` · `apps/mobile/app/(tabs)/index.tsx` · `apps/api/src/routes/bookmarks.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/database/schema.ts` · `packages/shared/src/types.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` · `supabase/migrations/` |

**Goal.** The normal Save entry creates through the generated API, shows a pending Home row and survives process death/offline replay, with exactly one bookmark per URL. Optional note/timing confirmation and existing private-link validation are usable end to end.

**Context.** Root AuthProvider/protected routes and CaptureContext are the real entry. Extend existing create/dedupe and owner PATCH paths in routes/bookmarks.ts; schema uses snake-case create versus camel-case update (§8.4). Existing in-memory captures are not an offline queue.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Add the guarded test-only device fixture seeder described in Feature-branch native proof environment; its tests run through the API package. Add bookmark note, snooze and capture columns/index, owner-only DTO additions and public stripping, create/PATCH validation and duplicate precedence. Keep omitted/null semantics and note+timing atomic update exactly as §8.4; no scrape in create.
- New `lib/save-queue.ts`: serialized AsyncStorage mutations, stable ids, matching-user replay, timestamps/attempts/notBefore and triggers on launch/foreground/sign-in/refresh. Private flag/title/description survive. Expired queued Later becomes null. Durable create queue only; no action queue.
- Replace CaptureContext's in-memory authority with persisted entries; use MobileAPI's generated creates/updates and guard JWT response types. Pending/failed/retry/remove rows use CaptureStatus/S-23; refresh existing feed/library after acceptance. Later T-6 owns finite placement and T-9 owns failure reason display.
- S-5 uses native paste controls with no read/title before the explicit tap; iOS15.x hides copied-link row. Require private title/description before Save, note separately. After Save, optional ≤500-character note and Tonight/This weekend/No rush; put local time helpers in `lib/read-when.ts` for T-7 to extend. Failed confirmation reverts with specified toast.
- Extend `Bookmark created` logging with source/platform/queued/queue_age_s/already_saved, never note text. New mobile flows supply their source/platform. For unchanged previous JWT/web requests, optional omitted capture_source remains NULL under the all-NULL schema, and omitted platform is unknown as explicitly defined in §8.4; no invented unknown source enum. Duplicate preserves attribution. Cover S-5 busy/no-URL/invalid/offline/success and S-23 kept/failed/success states; content uncapped, button labels and reduced-motion defaults.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] A cold-started signed-in user can Save → Home pending using actual provider/API wiring; killing before server acceptance preserves the entry and later `alreadySaved` counts as success (FR-27).
- [x] Two concurrent creates yield one bookmark; note is filled only if stored NULL, explicit snooze replaces/clears, omission preserves, no duplicate queue job (§8.4, NFR-5).
- [x] 400 retains a failed row with Remove; network/5xx retains Retry/Remove; 401/wrong account waits;429 obeys notBefore. Private replay retains title/description, never fetches the page (§8.6).
- [x] Notes and snoozes are owner-only, all listed public/followed/reshare serializers strip private fields; validation allows future ≤60days, not elapsed values (§8.4, FR-16).

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-4:** The save sheet shall offer a link field and, when the clipboard holds a URL, the copied-link row (D-10).
- [x] **FR-4 AC1:** Opening the sheet shows no paste prompt and no title before the tap.
- [x] **FR-5:** The save sheet shall write the bookmark on Save, then offer an optional note and Read when: Tonight, This weekend, No rush (FR-11).
- [x] **FR-5 AC1:** No rush sets no snooze.
- [x] **FR-6 capture checkpoint:** A new save appears above the existing Home feed with pipeline phases and its available filing path. Completed-after-compute placement is T-6; classified failure replacement is T-9. The full FR-6 package requirement is covered across those checkpoints.
FR-6 AC1 (failure replaces the card in place) is owned by T-9, not a T-1 completion condition.
- [x] **FR-26:** Every save shall record `capture_platform`, `capture_source` and, if queued, `capture_queued_at`.
FR-26 AC1 (queued iOS attribution) is owned by T-3, not a T-1 completion condition. T-1 proves save_sheet/clipboard capture; T-4 proves Android.
- [x] **FR-27:** Unsent saves shall persist on the phone until the server accepts them, one bookmark per URL.
- [x] **FR-27 AC1:** App kill preserves an unsent save; relaunch accepts `alreadySaved` as success.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. RNTL `app/__tests__/save-durable.test.tsx`: Save via real root/provider → pending → kill/restart → successful replay, no extra bookmark (FR-5/27); then private and optional confirmation variants before acceptance, after acceptance and while offline; note/timing edits persist on the queued entry and replay with the create when it has no server id.
2. API `src/tests/bookmark-capture.test.ts`: concurrency, duplicate field precedence, omission/null,500-character boundary and60-day bound; owner/public DTO contract matrix; private create/replay validation.
3. Mobile `lib/__tests__/save-queue.test.ts`: interrupted serialized mutations, matching accounts, every replay status, elapsed timing, all drain triggers and removal; note/source/queuedAt preserved.
4. RNTL Save/CaptureStatus: paste no-read-before-tap and15.x fallback; empty/loading/error/offline/success, copy, labels and uncapped text. Shared `__tests__/services/bookmark-capture.test.ts` proves metadata replacement does not overwrite new capture columns and legacy optional source omission stays NULL.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run apispec
bun run --cwd packages/shared build
bun run db:test:up
bun run db:test:reset
bun run --cwd apps/api test -- src/tests/bookmark-capture.test.ts src/tests/device-fixtures.test.ts src/tests/api-contract.test.ts
bun run --cwd packages/shared test -- --runInBand --testPathPatterns=bookmark-capture
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='save|capture'
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Implemented and coordinator-verified 2026-11-10 on `feature/save-and-todays-5`; checkpoint `b8c2401891146234ce03fa505e2aaa2bf88e294d` (`Task: T-1`). Fresh developer task node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A9cea8afb-b067-4e50-992e-7d20a5aed0da completed durable Save/provider/generated API wiring, account-bound serialized capture replay, atomic owner confirmation, private note/timing/capture fields, duplicate precedence and public stripping, native metadata-only copied-link detection, local timing helpers and the guarded fixture seeder. Real Fastify/loopback Postgres concurrency proves one bookmark/job; RNTL lifetime abort/unmount and storage replay prove the T-1 interruption checkpoint. Native process-kill/EAS, LTE, accessibility and later FR-6 placement/failure/iOS attribution remain with their owning tasks.

Coordinator independently ran every T-1 Verify command plus Verify all and API lint: apispec and shared build; disposable DB up/reset; API340 tests; focused shared2; focused mobile27; root typecheck with `--env-mode=loose` and explicit shared/API/worker/mobile tsc; serial test:db shared393/API340/worker10; full mobile73 with one existing skip; web335; mobile/web/API lint and tokens checks all PASS. Mobile/web lint retain5/112 baseline warnings; API lint has60 warnings including4 new HTTP-fixture any warnings. All backend processes explicitly used loopback5433, NODE_ENV=test and COMPOSE_PROJECT_NAME=cosmic-dolphin, Turbo loose env and serial DB suites. The disposable container's developer-set max_wal_size=128MB avoids tmpfs exhaustion; no hosted migration/configuration ran. Client nullable serializers were fixed in generator source templates and regenerated; no generated file was manually edited. Non-generated diff whitespace check passes; two generator-produced blank-comment whitespace warnings remain. Source-doc attempts did not correct nullable-enum generator comments and were reverted; final generated output matches the tested candidate.

Test-first assessment: developer reported observed behavior-red→green for core Save interruption/confirmation/replay, API ownership/privacy/validation/concurrency, queue status/account/timeouts, clipboard, fixture guards and generated null serialization. Supplemental regression cases first ran green (serialized storage interruption, existing pipeline/path display, form fallbacks/local times and shared metadata/legacy NULL); the during-create confirmation test was added before the preceding PATCH case was fully green. These are recorded process deviations, not a claim of perfect red-green sequencing. Coordinator accepted the implemented checkpoint after independently verifying its behavior; T-2 must follow one failing behavior→green before the next behavior. Whole-feature Sol review remains Pending, rounds0; T-1 is not reviewed, integrated or shipped.

### T-2 · Issue and revoke a save-only share key

| | |
|---|---|
| Status | Done |
| Depends on | T-1 |
| Traces | FR-1 key prerequisite · NFR-9 · NFR-10 · S-15 · §8.4 Share key/iOS shared storage · §8.7 share security · §8.8 Share key logs · A-2 |
| Ships as | User-visible: issue and revoke a save-only share key in the complete package |
| Size | M |
| Touches | `apps/api/src/middleware/share-key.ts` · `apps/api/src/middleware/auth.ts` · `apps/api/src/routes/share-keys.ts` · `apps/api/src/routes/bookmarks.ts` · `apps/api/src/index.ts` · `packages/shared/src/` · `packages/apispec/` · `packages/api-client/` · `supabase/migrations/` · `apps/mobile/contexts/AuthContext.tsx` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/lib/share-key.ts` · `apps/mobile/lib/supabase.ts` · `apps/mobile/app/(tabs)/profile.tsx` · `apps/mobile/ios/` · `apps/mobile/modules/share-queue/` |

**Goal.** A signed-in installation issues its restricted key, can submit a minimal save with it, and must revoke it successfully before signing out. Every other endpoint and extra input rejects it.

**Context.** JWT middleware is currently universal; registration is index.ts under /api/v1. Keep normal JWT creates compatible; the alternate response is selected by auth, not by hiding a full owner Bookmark after serialization.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Add share_keys schema/active-device uniqueness/hash-only storage/RLS/cascade, shared repository/service and JWT-only POST/DELETE routes. Rotation revokes previous active device key; DELETE idempotent and owner-scoped.
- Route-specific middleware accepts cdsk_ only on POST/bookmarks; enforce the four-field body allowlist and existing100/day user rate limit. TypeSpec response union has minimal ShareSaveResponse for share keys including duplicates; JWT keeps CreateBookmarkResponse. Regenerate and compile every consumer.
- Add a `ShareQueueTests` XCTest target in the committed Xcode project with keychain-group entitlements and a native keychain interoperability test; T-3 expands it with durability cases. App sign-in/foreground-if-missing issues key; stable installation deviceId, keychain service/account/value/accessibility and group match §8.4. Add group entitlements to both committed targets and verify capability via a branch EAS/device probe. If SecureStore accessGroup interoperability fails, use the accepted local share-queue bridge to write the item; do not mirror/refresh Supabase JWTs.
- Serialize issuance/foreground/sign-out to prevent a late issue recreating a key after sign-out. If the shared item is missing, acquire/rotate the stable device key then revoke its returned id before session clearing; offline failure retains sign-in with Retry. Sign-out waits for DELETE acknowledgement before clearing session/key. S-15 busy/error/offline/signed-out, exact “Connect to finish signing out” + Retry; preserve pending user-owned captures. Log issue/revoke/reject by user/key id only.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] A fresh issue returns one cdsk_ key of specified shape; storage contains its SHA-256 only; rotation/revoke/cascade work without invalidating unrelated devices.
- [x] Minimal valid-key POST creates or dedupes under the same rate limit; no Bookmark, note, collection or content fields leak. Any extra field is400; any other endpoint/invalid/revoked key is401 (NFR-9).
- [x] Failed revocation retains session and key; Retry can finish sign-out. Native extension-target code can read the exact shared item (A-2), with the approved bridge fallback if needed.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. API `src/tests/share-key.test.ts`: issue → key-auth create → revoke → rejected create; duplicate response privacy and full route/body/status matrix.
2. Shared `__tests__/services/share-key.service.test.ts`: concurrent same-device rotation, hashes, active uniqueness/RLS/user deletion, owner-only idempotent revoke, logs contain no key.
3. Mobile `lib/__tests__/share-key.test.ts` and AuthContext/profile RNTL: issue on sign-in/missing foreground; no replacement when item exists; missing-item sign-out and racing issuance/revocation cannot bypass acknowledgement; revoked sign-out retry without session loss.
4. Extend `api-contract.test.ts`: both auth response branches and previous consumers compile; run native keychain read probe against both targets before declaring A-2 confirmed.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run apispec
bun run --cwd packages/shared build
bun run db:test:up
bun run db:test:reset
bun run --cwd apps/api test -- src/tests/share-key.test.ts src/tests/api-contract.test.ts
bun run --cwd packages/shared test -- --runInBand --testPathPatterns=share-key
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='share-key|profile'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Implemented and checkpoint-accepted on2026-11-10 using the simulator execution clarification above; coordinator software/native-fixture checks and signed capability inspection are green. Normal-issuer real-session and live physical-device outcomes remain pending package proof. Initially preserved on `wip/save-and-todays-5-T-2`, based on feature checkpoint `19d7cd4c25be506c1507fc325820ed8433cac523`; WIP commit `7ba8d7eab788b65d197cf097f5c004963e9f644b` (`Task: T-2`). The initial Blocked disposition is superseded by Paulo’s simulator steering. T-2 is Done at the implementation checkpoint, not reviewed, integrated or shipped; feature checkpoint `c48128057fa944da6869bf8f13295be50ccd60d6` (`Task: T-2`). Developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A308843bf-32b1-4aa9-aac9-fb0b4edcc3df delivered62 source/test/generated/native paths without commits or task edits. Full handback and honest sequential red/green ledger remain `/tmp/T-2-handback.md` and `/tmp/T-2-ledger.md`.

Coordinator independently ran every T-2 Verify command and Verify all: apispec/shared build, disposable DB up/reset, API347, focused shared4, focused mobile10, root typecheck and explicit shared/API/worker/mobile tsc; serial backend shared397/API347/worker10, full mobile83 with one existing skip, web335, mobile/web/API lint and tokens PASS. API lint64 warnings (4new HTTP-fixture any warnings), mobile5/web112 baseline warnings; non-generated whitespace check PASS. Staging exposed standard generator boilerplate whitespace/blank-EOF warnings in new client files that unstaged diff-check did not include; they are recorded, and no generated file was edited manually. Native ShareQueueTests on local iPhone17Pro/iOS26.5 simulator F3CF81FA-5972-40A4-83EF-0D077C02B571:5tests/0failures; exact JSON/service/account/group/accessibility write/read/delete proven. Developer also observed the real simulator app and actual extension process reading one fictional shared item, then cleaned it up. These are fixture/cross-process proofs, not a real authenticated native lifecycle.

Signed EAS preview https://expo.dev/accounts/cosmic-dolphin/projects/cosmic-dolphin/builds/968adcfe-0ca5-4b56-8fb6-b5953905c748 finished2026-11-10T21:31:03.878Z. Coordinator rechecked `codesign --verify --deep --strict` and signed app/extension entitlements: both DVYXX2PWV5.com.cosmicdolphin.shared; profiles include one provisioned device, minOS15.1. The EAS_NO_VCS snapshot predates final probe logging/Y-Z fixtures and final API Bearer-scheme hardening; it is not a final-checkpoint source-bound build. No attached signed physical-device interoperability or authenticated phone JWT/share-key API calls were observed. Signed binary/profile capability and actual simulator cross-process reads are recorded separately from the outstanding device outcomes.

Local transport prerequisite resolved by coordinator using temporary infrastructure only: marker-guarded Supabase-compatible pgmq_public SQL wrappers over the disposable container's real pgmq1.5.1; PostgREST13.0.7 on loopback5534; loopback5535 relay permitting only GET /auth/v1/user to the existing issuer and the five standard queue RPCs to local PostgREST, denying every other route. No product endpoint, auth middleware bypass, new broker, product flag or hosted business write was added. API/worker process SUPABASE_URL was temporarily overridden to that relay; mobile auth retains the normal issuer. Actual API QueueServiceImpl and worker QueueService/SupabaseClientService proved send/read/archive/delete/pop; the normal API and worker booted/returned200health, and the real worker consumed/deleted a fictional non-bookmark probe through the ordinary pgmq loop. Official Lightpanda1.0.2 macOS arm64 binary was downloaded under `/tmp` for worker bootstrap. Relay counters:0authReads,49localQueueCalls,1denied business route. This resolves safe transport/startup, not bookmark processing or authenticated native proof. Reproducible scripts/logs are in `/tmp/mobile-branch-infra/`; use the same temporary local transport when the normal-issuer test session becomes available. All test suites finished before these server sessions. Own servers/container stopped, probe queue and owned wrapper schema removed; named disposable DB remains healthy. Every backend process used loopback5433/test/COMPOSE_PROJECT_NAME=cosmic-dolphin; no hosted migration or worker consumption occurred.

Remaining prerequisites: real configured internal test-account login for normal-issuer native issuance/save/revocation/offline Retry and matching-user local fixture seeding; remaining signed-device proof through the approved device checklist. The developer and coordinator each used request_secret for the missing login; no value arrived, and no identity was invented. device_list currently exposes simulators/emulators only. Paulo replied that no physical iPhone is available and directed use of the existing simulator. Under the execution clarification these outcomes remain explicit pending package proof, and do not block code checkpoints. The preserved implementation is restored to the feature branch; its product/source diff matches the independently verified WIP candidate. T-3 is now ready. Rebind later preview builds to a live local tunnel/current source and complete available simulator outcomes; obtain real-session/physical proof before claiming those package gates passed. Complete-package review rounds remain0.

### T-3 · Save and close from the native iOS share extension

| | |
|---|---|
| Status | Done |
| Depends on | T-2 |
| Traces | FR-1 · FR-2 · FR-26 iOS attribution · FR-27 bridge import · NFR-1 · NFR-4 · NFR-9 · S-7 · §8.4 iOS shared storage · §8.6 share failures · §9 prebuild risk · A-2 |
| Ships as | User-visible: save and close from the native iOS share extension in the complete package |
| Size | M |
| Touches | `apps/mobile/ios/ShareExtension/` · `apps/mobile/ios/CosmicDolphin.xcodeproj/` · `apps/mobile/ios/` · `apps/mobile/modules/share-queue/` · `apps/mobile/app.json` · `apps/mobile/app/_layout.tsx` · `apps/mobile/lib/save-queue.ts` · `apps/mobile/IMPLEMENTATION.md` |

**Goal.** Safari sharing saves on extension open and closes without launching the host; any request failure is acknowledged only after a durable phone queue write. Foreground import/replay cannot lose saves.

**Context.** The existing hand-maintained ShareViewController forwards links to the app. Rewrite that flow, keeping the supported15.1 deployment target, app group and shared key from T-2.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Native extension captures only URL/capture metadata with the key, shows title/domain plus Saving/Saved/Already saved/Queued/No URL/Queue full and Close; no note/timing or session refresh. Auto-close is disabled for VoiceOver.
- Implement ≤200-entry pending-shares-v1.json plus separate exclusive lockfile, flushed temp/atomic replace; no acknowledge-before-persist.8-second timeout/network/5xx queues;429 preserves Retry-After notBefore;401 preserves row userId then clears rejected shared item. No URL/full group sends no request.
- Extend `ios/ShareQueueTests/` native fixtures to run under the ShareQueueTests scheme: use temporary group-like directories for queue I/O and actual shared-group/keychain entitlements for interoperability. Local Expo share-queue bridge snapshots under lock, imports durably into app queue with same id/timestamps/platform/source, removes only imported ids under lock. Prove concurrent extension arrival and crash at every import/remove boundary. Drain matching user only; foreground reissues missing key through T-2.
- Set disableIOS:true and document no clean prebuild in IMPLEMENTATION.md; add a regression test that committed Swift path remains present. Accessible status announcement persists, no auto-close for VoiceOver and no reduced-motion spinner rotation.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] Safari valid-key share creates one bookmark with ios/ios_share_extension; normal extension completion closes without host launch (FR-1).
- [x] Offline/revoked/missing key/429/5xx/timeout shows phone-saved only after durable write; relaunch drains exactly once with attribution and original queuedAt/notBefore (FR-2/26).
- [x] Crash after app persistence but before group removal replays safely; another account does not drain; concurrent writes/imports lose no entries; full200/no URL has specified copy and no request.
- [ ] VoiceOver leaves result and Close available;20 Wi-Fi and20 LTE trials meet NFR-1, recorded using os_log and signed device build, not Expo Web.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-1:** The iOS share extension shall save on open with the share key (D-21), show the result and close without opening the app.
- [x] **FR-1 AC1:** A valid-key Safari share creates exactly one bookmark; screen-reader behavior follows §7 Accessibility.
- [x] **FR-2:** On any request failure the extension shall queue the URL on the phone and say so; the app sends it on next launch or foreground.
- [x] **FR-2 AC1:** Exactly one bookmark after next app open for §8.6 "Share token missing or revoked", "Share offline" and "Rate limited (429)".

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. Native integration: valid-key Safari share → no host open → one API bookmark, then revoked-key/offline share → phone persist → matching-account replay.
2. Native queue/bridge fixtures: lock contention,200 boundary, temp-write interruption, durable-import/remove interruption and concurrent append; assert stable ids, original attribution and Retry-After.
3. Mobile bridge-import Jest: duplicate stable id, matching-account isolation and snapshot removal; process kill replay accepts alreadySaved.
4. Device states/motion/VoiceOver and os_log latency matrix; regression test app.json disableIOS plus Swift-path presence. Use device_list/open and the bound agent-device command for device UI; EAS preview is the branch binary proof.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='share-queue|save-queue|native-share'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
cd apps/mobile
eas build --profile preview --platform ios
```

**Notes**

Started2026-11-10 from coordinator-verified T-2 checkpoint `c48128057fa944da6869bf8f13295be50ccd60d6` under Paulo’s simulator execution clarification. Fresh background developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A3dc8212b-a2a3-406d-a3af-4ed2098d7211 assigned from f50457f00576f6d09655a5bfd6334ef328e5216e. Use real native simulator/XCTest fixtures and local branch transport; record unavailable physical Wi-Fi/LTE and real-session outcomes in the pending package proof, never as passed. Root requested T-2’s completed developer to release its own stale device session; that owner reported Closed, and root resumed its own bound simulator command. No other session was reused or closed.

Coordinator verification2026-11-10: implemented and accepted as an available implementation checkpoint under the execution clarification, not shipped or fully device-proved. Reviewed all17 changed/new files and the handback `/tmp/T-3-handback.md`; the signed archive's17 source hashes independently match the current product files. Native protected/locked recovery-before-request and durable-app-import-before-group-remove preserve stable IDs, owners, original timing and attribution; imports/drains coalesce without immediately retrying old failures. No product auth bypass, clean prebuild or generated-client hand edit was introduced.

Coordinator checks independently PASS: apispec, shared build, root typecheck with `--env-mode=loose`, individual shared/API/worker/mobile tsc, disposable DB up/reset and serial backend suites (shared397/API347/worker10), focused mobile18, full mobile92 with one existing skip, web335, mobile/web lint with baseline warnings only, tokens:check and diff checks. Native ShareQueueTests scheme compiled and ran26 tests on local iPhone17Pro simulator F3CF81FA-5972-40A4-83EF-0D077C02B571/iOS26.5 with the real local Fastify/Postgres restricted-key fixture; no truncating suite ran while that fixture was active. Own fixture stopped cleanly. Logs: `/tmp/t3-coordinator-checks/`.

Developer ran signed EAS preview3fb9fb09-7ec9-4499-a4cc-7c121beafbfa; coordinator corroborated FINISHED from mobile cwd, strict deep signature verification, both exact signed app-group/keychain entitlements, all17 source hashes and actual bundle's original public auth binding/token/preprocessor resources. This corroborates the existing changed-source upload, not a claimed new coordinator upload. Source manifest SHA25600f90ef81e459d8131184e04ed20ec8b166f9a0ccaedd234c53a3a6c9573792d; fingerprint279decf21e989f6ed04e67e3177d877854985679. Preview's real temporary API tunnel is now stopped. T-10 must build final package source.

Available UI proof: actual simulator Safari restricted-key save made one local bookmark without host launch; refused transport persisted and actual signed-out host imported the same ID/owner/time across relaunch. Actual dark/large-text/Reduce Motion recording showed readable status/Close and stationary progress. These use explicitly fictional/test-auth fixtures, not a normal-issuer real mobile session. Native policy fixtures prove retained result/Close/announcement for VoiceOver; live spoken VoiceOver and40 signed physical Wi-Fi/LTE trials remain unproved. The combined criterion above stays unchecked and is carried to T-10; implementation checkmarks do not imply those pending outcomes passed. Native mobile token merge/title weight/Close label cap align with T-5 styling scope.

Test-first qualifications are accepted and retained for whole-feature review: several supplementary/existing behavior characterizations first ran green; step23 build characterization preceded closure of step22's floating-point tolerance failure; actual Safari/local-API supplemental integration came after queue/Jest phases. Initial parallel/truncating backend invocation failed from test setup, then correct serial suites passed. Two excluded EAS attempts had remote public auth-variable mismatches; final build's actual auth bytes match. Coordinator's first EAS read from root failed and created an owned empty root app.json; it was removed, mobile app.json unchanged. No feature behavior or check was weakened. Developer's own device session/services and root fixture are closed; existing hooks remain untouched. Complete-package review rounds remain0.

Checkpoint commit: `72ae8f28b3ed408527f272b417137d70302e4056` (`Task: T-3`).

### T-4 · Save and return from Android sharing without a tap

| | |
|---|---|
| Status | Done |
| Depends on | T-3 |
| Traces | FR-3 · FR-26 Android attribution · FR-27 · S-20 · NFR-4 · §8.4 Android · §8.6 Android share signed out · A-4 |
| Ships as | User-visible: save and return from Android sharing without a tap in the complete package |
| Size | M |
| Touches | `apps/mobile/app/_layout.tsx` · `apps/mobile/app/share.tsx` · `apps/mobile/lib/shareIntent.ts` · `apps/mobile/lib/save-queue.ts` · `apps/mobile/modules/share-queue/` · `apps/mobile/app/__tests__/share-logic.test.ts` |

**Goal.** Android captures the incoming URL durably before auth routing, saves without a tap when signed in, then returns to the sender; signed-out or offline capture stays safe.

**Context.** Root currently waits for session before navigating /share; share.tsx currently requires Save. Use the first text/* URL extraction already in lib/shareIntent.ts; persisted enqueue must precede that auth gate.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- On new intent, enqueue the first valid URL once with android/android_share; do not requeue on root effect re-runs. Signed-in drains immediately; signed-out keeps entry and shows sign-in. Offline queues then closes.
- S-20 uses the shared result states; saved display1.5s then BackHandler.exitApp. On a real device validate A-4; if it fails to return, implement the accepted moveTaskToBack fallback in the local native bridge. TalkBack keeps result and Close rather than automatic return.
- Preserve no-URL handling, retry/account matching and app queue semantics. No iOS host intent path is reintroduced.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] Signed-in text share creates one bookmark without Save tap, displays result then returns to the sender (FR-3/A-4).
- [ ] Offline/signed-out share survives kill/restart and drains after matching sign-in; offline shows queued then returns; TalkBack does not auto-close (§8.6/§7).
- [x] Duplicate root effects cannot create duplicate queue entries; first URL only, android capture metadata retained.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-3:** Android sharing shall open the app, save without a tap, and return to the previous app.
- [x] **FR-3 AC1:** Offline/signed-out arrival follows §8.6 "Android share signed out".

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. RNTL `app/__tests__/android-share.test.tsx`: real root intent before auth → enqueue → sign-in/drain → result, no tap; parameterize offline and signed-out.
2. Jest shareIntent/queue: first-URL extraction, repeated effect idempotency, source/platform, error/rate-limit/retry.
3. Android preview device: return to Chrome/another sender after1.5s, TalkBack status/Close, offline kill/relaunch; select accepted A-4 fallback only from this evidence.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='android-share|share-logic|save-queue'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
cd apps/mobile
eas build --profile preview --platform android
```

**Notes**

Started2026-11-10 from coordinator-verified T-3 checkpoint `72ae8f28b3ed408527f272b417137d70302e4056`; a fresh background developer owns T-4 only. Available Android target: host local, Pixel_7_API_34 emulator/Android14. Use device_open and its own bound agent-device command, close only its own session/services on handback. Follow the simulator execution clarification: unavailable normal-issuer real-session and physical device outcomes remain explicit T-10 proof gaps; do not fabricate credentials or pause implementation solely for them. Coordinator records exact checks, honest test-first ledger and build/native source evidence before checkpointing.

Coordinator checkpoint verification2026-11-10: fresh developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A2d82bf72-f48b-42ca-a6fb-5f5e254aa59d completed T-4 with14 changed/new product files. Handback `/tmp/T-4-handback.md`, receipts `/tmp/T-4/`. Reviewed all14 files, including the native lifecycle Package and serialized Android SharedPreferences inbox: stable native UUID/UTC time persists before React/fonts/auth, app queue persists before native removal, genuine later same-URL intents get new IDs. Generated MobileAPI/CaptureContext owns authenticated transport. No iOS host path or speculative moveTaskToBack fallback. The one-line clipboard module Android version metadata repair was necessary after actual native compilation failed for missing versionName; clipboard behavior is unchanged.

Coordinator independently PASS: apispec/shared build, disposable DB up/reset, focused mobile38, root loose typecheck plus shared/API/worker/mobile tsc, serial backend suites (shared397/API347/worker10), mobile lint/full108 with one existing skip, web lint/335tests, tokens:check and native `:share-queue:compileDebugKotlin`. All18 commands passed; logs `/tmp/t4-coordinator-checks/`. Diff checks pass. Earlier developer extra worker nofix lint used a nonexistent test directory and failed; adapted existing-source nofix lint passed with baseline warnings. This diagnostic is retained, not falsely labelled green.

Developer built final signed INTERNAL Android EAS previewcaaef24d-5bbe-4e8d-824e-0421ea484d68; coordinator corroborated FINISHED via mobile-cwd CLI, independent APK signature verification, all14 current/archive product hashes, actual original public auth bytes and both compiled native classes. APK SHA256a81f761001e2340e02c606cbbdb2db666f2a9a3e59adc13224fbadc6b1bd3865; Hermes82e2a9c2cf13aaf4d9dc372795e3368ff927b5c404a289db38b2398ed3114b80; source manifeste9d9769d2e40e28b90c96f52206e5e56759ae1759aa12b3c3f4211246b3a6641 (1134files/links). This independently corroborates the developer's changed-source upload, not a claimed new coordinator upload. Temp profile restored, no service key/client auth weakening. Final package must rebuild its own source; compiled temporary branch API tunnel is stopped.

Available native proof on host local/Pixel_7_API_34 Android14 emulator: final signed APK's real text/html ACTION_SEND captures firstURL, shows durable offline copy/Close at200%, then BackHandler.exitApp returns to the standalone fixture sender. Fresh no-link after activity exit retains exact copy/Close with no row. Genuine later same-URL arrival has a second ID; coordinator independently compared the recorded before/after-kill queue JSON as exactly equal and inspected final contact/no-link images. Validated-Wi-Fi signed-out text/plain retains row and reaches sign-in. Visual timing supports the1500ms source timer; no exact native millisecond budget is claimed. Actual signed-in no-tap/drain, account/rate/retry/timer/reader-state behavior passes through RNTL real root/AuthProvider/CaptureProvider/generated-API integration at explicitly fictional native/Supabase/fetch boundaries, not a real normal-issuer mobile session.

Proof limitations: combined offline/signed-out/TalkBack criterion remains unchecked for actual normal-issuer matching-session replay and live spoken native TalkBack. TalkBack14.2 was installed and enabled via Settings, but UiAutomation left Bound services:{} and touch exploration false; live retention/announcement/Close is unproved. Native reader-boundary tests pass. Physical sender return and physical-only connectivity remain pending T-10 under the execution clarification. Implemented FR checkmarks do not imply these unavailable proofs passed. No release/merge grant or package gate changed.

Process qualifications retained for whole-feature review: no-link/effect/queue characterizations first ran green; Kotlin boundary implementation first compiled green; supplementary RNTL integration followed URL/queue phase. The real no-link lifecycle regression remained red across superseded previews; initial receiver diagnosis was incomplete, and actual delayed-router assertion established auth-navigation overwrite. Pending-share navigation guard passed that red and final signed emulator regression. No later failing behavior started before the unresolved case was green. Three superseded previews, harness fixes, ABI/environment/compiler setup retries and imprecise original text-size float capture are disclosed in the handback. No tests were weakened/skipped to pass. Own device session/services/fixture state cleaned, restored EAS bytes/hooks preserved. Complete-package review rounds remain0.

Checkpoint commit: `188f8a916819ff28bd6b220a383c77d4b43d7335` (`Task: T-4`).

### T-5 · Apply the plum mobile shell and three destinations

| | |
|---|---|
| Status | Done |
| Depends on | T-4 |
| Traces | FR-17 · FR-28 · NFR-7 · S-15 entry · §7 Navigation/Accessibility/Components · §8.4 Tokens · §8.3 Mobile routing |
| Ships as | User-visible: apply the plum mobile shell and three destinations in the complete package |
| Size | M |
| Touches | `docs/design-system/tokens.json` · `docs/design-system/foundations.md` · `scripts/generate-tokens.mjs` · `apps/mobile/constants/theme.ts` · `apps/mobile/components/ui/Signal.tsx` · `apps/mobile/app/(tabs)/_layout.tsx` · `apps/mobile/app/(tabs)/profile.tsx` · `apps/mobile/app/profile.tsx` · `apps/mobile/app/(tabs)/index.tsx` · `apps/mobile/app/_layout.tsx` · `apps/mobile/ios/ShareExtension/ShareTheme.swift` · `apps/mobile/ios/ShareExtension/ShareViewController.swift` · native font-resource memberships as needed |

**Goal.** Mobile uses approved plum in both modes and Home/Save/Library with avatar entry to existing profile/settings. Web generated tokens remain byte-identical.

**Context.** Generate from tokens.json, never hand-edit theme.ts. Existing Signal primitives and fonts stay canonical; approved standalone prototype supersedes older mobile exploration switches.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Add color.mobile light/dark override map and generator canonical-key validation/alias resolution after mobile merge; preserve all nonaccent Signal values and unchanged web tokens.css. Document mobile-only override in foundations.
- Reuse Signal primitives, add Button trailing detail support for later choices, preserve touch/focus/contrast. Apply the effective mobile token merge to the T-3 native ShareTheme consumer as well; align title-1 weight600/font resources and the native Close label1.3x cap while content stays uncapped. No accent/density/layout experiments ship.
- Remove profile as destination; retain its real account/settings content outside tabs (app/profile.tsx), avatar enters it and old profile-tab route redirects there. Save opens the existing modal; Library keeps existing private chronological collections/Inbox/archive/filter behavior. Mobile copy says Topics; no schema or web rename.
- Content uncapped, tab labels≤1.3x, rows grow; honor reduced motion. Cover auth/cold-start/navigation/deep-link/signed-out and S-15 lifecycle already built in T-2.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] Cold start, Save modal and avatar/profile return preserve Home/Save/Library; old profile-tab link reaches S-15.
- [x] Both-mode accent pairs match §8.4 and all text/UI meet4.5:1/3:1; unknown overrides reject and focus aliases resolve to mobile accent.
- [x] Regeneration changes only mobile theme for overrides; web tokens stay unchanged. Existing Library and profile features remain functional.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-17:** The tab bar shall be Home · Save · Library, with profile behind the Home avatar (D-16).
- [x] **FR-28:** Mobile shall use the plum accent tokens in light and dark; web is unchanged (D-9).
- [x] **FR-28 AC1:** Accent pairs meet NFR-7; web `tokens.css` is unchanged.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. RNTL `app/__tests__/home-navigation.test.tsx`: three destinations, Save modal, avatar and old profile redirect; Library/profile smoke without exploratory controls.
2. Generator tests `scripts/__tests__/generate-tokens.test.mjs`: valid/invalid keys, post-merge aliases and byte-identical web outputs.
3. Mobile contrast/primitive tests: exact pairs, focus/control contrast, grow/wrap behavior and label cap in both modes; native AX3/200% proof owned with the UI and repeated cross-feature in T-10.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
node --test scripts/__tests__/generate-tokens.test.mjs
bun run tokens
bun run tokens:check
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='home-navigation|contrast|Signal'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Started2026-11-10 from coordinator-verified T-4 checkpoint `188f8a916819ff28bd6b220a383c77d4b43d7335`; fresh background developer owns T-5 only. Available native targets: local iPhone17Pro/iOS26.5 simulator F3CF81FA-5972-40A4-83EF-0D077C02B571 and local Pixel_7_API_34/Android14 emulator. Own bound device sessions only, restore settings/services at handback. No real test login or physical iPhone is available; fixture/simulator proofs stay labelled and unavailable outcomes stay with T-10 under the execution clarification. T-3 introduced a native canonical-token/font consumer; coordinator inspection found that its mobile override merge, title-1 weight600 and Close label1.3x cap must be completed with this task’s §7/mobile token styling. This is covered mobile styling/integration work, not a new feature; preserve native capture/queue behavior. Coordinator records candidate SHA, exact checks/results, native evidence where required, Task trailer/checkpoint commit, and any blocker here.

Coordinator verification2026-11-11: fresh developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A3224fda9-e5cd-4700-8647-c09eda2ade5a completed30 changed/new files. Reviewed the full source inventory, preserved profile implementation (only root Back added), real Expo Router navigation tests and native token/font changes. Handback `/tmp/T-5-handback.md`, receipts `/tmp/T-5/`. Home/Save/Library order, avatar/root profile, legacy redirect and Save return now work; Topics is mobile copy only. Shared growth/focus/motion primitives preserve capture/auth behavior. Native mobile merge/aliases, title1 semibold resource and Close1.3x cap are completed.

Coordinator independently PASS: generator5tests, tokens generation/check, apispec/shared build, disposable DB up/reset, focused mobile24, root loose typecheck and shared/API/worker/mobile tsc, serial backend shared397/API347/worker10, mobile lint/full132 with one existing skip, web lint/335tests, focused capture/auth/navigation regressions34, native ShareQueueTests29 and actual ShareExtension simulator target build. All19 serial commands and both native commands passed; logs `/tmp/t5-coordinator-checks/`. Real local Fastify/restricted-key/Postgres fixture ran only after truncating suites and was cleanly stopped. No owned5536 listener remains.

All30 current file hashes independently match final-file-manifest.json. Both web CSS files are byte-identical to starting HEAD; every mobile color outside the six approved overrides and all noncolor generated exports are preserved. The coordinator's first aggregate comparison accidentally included nested changed colors, failed its own checker, then correct exclusion passed; no product change resulted. Own built extension tokens and Inter400/SourceSerif400/SourceSerif600 bytes match canonical source. Native29 includes both-mode plum/focus, font resource and AX3 label/content policy checks. Diff checks pass; generation introduced no additional tracked drift.

Native styling proof is explicitly isolated: UIKit fixture compiles actual share controller/theme with fictional content and own sandbox; RN fixture mounts actual Signal/TopBar/theme/fonts in Expo Go with an isolated preferences boundary. Actual iOS AX3/Android200% in both modes showed readable growing/wrapped content, bounded controls and reachable choices/Close. Coordinator inspected settled dark native Close and Android dark200% sheet images; these support styling, not normal-issuer logged-in product or signed app/extension interoperability. Actual changed-source extension simulator build is unsigned; T-5 does not require a new EAS upload. T-10 still requires final whole-package signed builds, real-session/native/live spoken screen-reader and physical-only outcomes.

Observed test-first qualifications retained for whole-feature review: old-profile redirect was introduced during profile move before its case; its actual infinite-loop red then root-stack replacement green are recorded. Several existing/generator/contrast behaviors first characterized green; supplemental navigation/chrome cases followed primitive/native groups. A reduced-motion refactor syntax failure and native trait-context fixture failure were corrected and rerun; no named failed log is silently called green. Initial full mobile regression failures were fixture/router/profile-import/control-cap mismatches, corrected while preserving persistence/auth assertions;132 then pass. Worker cwd/pattern, SDK/resolver/tool setup retries and async act warnings remain disclosed in the handback. No product auth bypass or skipped/weakened behavior test. Both developer sessions/fixtures/Metro cleaned, precise captured settings restored, existing product app/auth/queue and hooks preserved. Complete-package review rounds remain0. Implementation checkpoint only, not shipped.

Checkpoint commit: `23d9aa285c4b59c577a80759526b760d24646ac2` (`Task: T-5`).

### T-6 · Show immutable daily picks in a finite Home

| | |
|---|---|
| Status | Done |
| Depends on | T-5 |
| Traces | FR-7 · FR-8 · FR-9 · FR-14 · FR-15 · FR-16 · FR-25 · FR-29 · FR-30 · FR-6 final placement · NFR-2 · NFR-10 · S-1 · S-2 · §8.4 Picks · §8.6 picks/time-zone/snooze visibility · §8.8 Picks logs · A-3 |
| Ships as | User-visible: show immutable daily picks in a finite Home in the complete package |
| Size | M |
| Touches | `packages/shared/src/services/feed-ranking.service.ts` · `packages/shared/src/repositories/feed.repository.ts` · `packages/shared/src/services/picks.service.ts` · `packages/shared/src/repositories/picks.repository.ts` · `packages/shared/src/services/index.ts` · `packages/shared/src/repositories/index.ts` · `packages/shared/src/database/schema.ts` · `packages/shared/src/types.ts` · `apps/api/src/routes/picks.ts` · `apps/api/src/index.ts` · `packages/apispec/` · `packages/api-client/` · `supabase/migrations/` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/hooks/useHomeFeed.ts` · `apps/mobile/components/FeedCard.tsx` · `apps/mobile/components/TodayProgress.tsx` · `apps/mobile/app/(tabs)/index.tsx` |

**Goal.** Two devices see the same immutable ranked snapshot and verbatim reasons for a pick day; Home combines it with captures, Continue and a finite feed, including all zero/error/time states.

**Context.** Reuse ranker scoring/buildRankingReason without its process-local session as authority. All IANA/localDate/06:00/DST math is Postgres; daily_picks lazily persists under user/date PK.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Add daily_picks RLS/cascade and PicksRepository/Service, contract and registered GET/picks/today. Select≤5 from500 newest eligible own completed/unread/unarchived/unrejected/unsnoozed; cap2/domain. Private without brief ineligible. Concurrent insert ON CONFLICT then reread;0 eligible creates no row.
- Existing shared ranker/feed own candidates also exclude later_until > now; prove the feed route, not only mobile tail filtering. Visibility independently hides archive/delete/rejection/future snooze while done stays. Original positions/reasons are immutable; no backfill. computedAt distinguishes no row from stored empty; revealsAt earliest hidden snooze before refresh. Same date across zone changes reuses set; different date may compute. Unknown tz400 → client UTC retry; A-3 fallback expo-localization only if Hermes fails.
- For you: captures above picks; completed-after-compute items in more below Continue; request existing feed scope=for_you&limit=15, remove pick ids/pending, show≤10 unsnoozed, then caught-up with unread Library link. Following/Unread retain paged lists and no picks/Continue/end; Unread own newest first.
- FeedCard reason/actions presentation and TodayProgress use prototype. Reason verbatim or absent line, no client thesis; no public note. Counter N visible slots; minutes clause absent when reading time missing. Keep Continue and hide if none.
- Cover skeleton bar+3rows, first run, no eligible, computed no visible, picks-only failure with rest rendering, whole failure+Retry and offline cached Notice; exact §7 copy, no All0done or Today replacement promises. Log both Picks events and picks_ms. No mutation mechanism until T-7.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] Two concurrent requests with3 eligible across≥2domains give one3-slot snapshot with immutable reasons;0 eligible stores nothing and later completion allows first same-day compute.
- [x]05:59/DST/time-zone changes obey §8.4/6; snoozed original slot hides/returns after revealsAt without backfill, archive/deletion/rejection drop N, read slot remains.
- [x] First run/no eligible/computed-empty are distinct; refresh/new completed save never regenerates existing set. Partial picks error leaves the feed usable.
- [x] Feed order, all3 scopes,≤10 tail, reason omission/privacy, Continue hide-if-none and unread count exactly match FR-6/8/14/16/29/30. NFR-2 API compute/reread budgets pass with500 candidates.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-7:** The system shall fix one set per user per pick day (06:00–06:00 local): up to 5 eligible own saves from the feed ranker, identical across devices and refreshes.
- [x] **FR-7 AC1:** 3 eligible across ≥ 2 domains give 3 picks (≤ 2 per domain). At 05:59 local and with 0 eligible, apply §8.6 "0 eligible, or before 06:00".
- [x] **FR-8:** Each pick shall show the server's reason verbatim; the client never composes one.
- [x] **FR-8 AC1:** A For-you item without `rankingReason` shows no reason line.
- [x] **FR-9:** Home shall show done of N and minutes left; N excludes archived, deleted, Not for me’d picks and unexpired `later_until` snoozes.
- [x] **FR-9 AC1:** 5 picks, one done, one snoozed Tonight at 10:00: "1 of 4", then "1 of 5" at the first Home load or focus after 20:00 (`revealsAt`, D-14).
- [x] **FR-14:** For you shall show the picks, Continue (FR-30), up to 10 more unsnoozed For-you items, then the caught-up end with the unread count (D-11).
- [x] **FR-14 AC1:** Fewer than 10 items end early.
- [x] **FR-15:** Pull to refresh shall re-read picks and feed without changing the set.
- [x] **FR-15 AC1:** A save eligible after the set appears below it.
- [x] **FR-16:** Followed items shall show actor and server reason, never a note (D-3).
- [x] **FR-16 AC1:** Public models strip `userNote` (§8.4 "Bookmark additions").
- [x] **FR-25:** A user with no saves shall see first run: the copied-link row and how to share.
- [x] **FR-25 AC1:** Existing saves with no set today show no-picks, not first run (§7).
- [x] **FR-29:** Home shall offer For you · Following · Unread; Following and Unread keep their paged lists, with no picks, Continue or end (D-20).
- [x] **FR-29 AC1:** Unread lists own unread saves newest first.
- [x] **FR-30:** For you shall show a Continue reading row after the picks (D-19).
- [x] **FR-30 AC1:** No save in progress hides it.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. API `src/tests/picks.test.ts`: concurrent two-device snapshot,0eligible→firsteligible, immutable refresh/visibility, timezone validation and owner isolation.
2. Shared `__tests__/services/picks.service.test.ts`: exhaustive eligibility/domain cap/top500/ranking/reasons fixtures; Postgres05:59/06:00, spring/fall DST, same/different date zones, revealsAt boundaries and RLS/cascade.
3. RNTL `app/__tests__/today-feed.test.tsx`: each S-1/S-2 state and3scope matrix, captures→picks→Continue→tail→end, late-completion placement, missing time/reason and privacy.
4. Existing `src/tests/feed.test.ts` and shared feed-ranker/repository regression fixtures prove own future snoozes excluded and elapsed/null snoozes eligible on the real ranked feed path. API500-candidate repeated compute/reread timings prove800/200ms p95; inspect emitted log fields without note/key text. Native timezone fallback A-3 probe at checkpoint.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run apispec
bun run --cwd packages/shared build
bun run db:test:up
bun run db:test:reset
bun run --cwd apps/api test -- src/tests/picks.test.ts src/tests/feed.test.ts src/tests/api-contract.test.ts
bun run --cwd packages/shared test -- --runInBand --testPathPatterns='picks|feed'
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='today-feed|home'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Started2026-11-11 from coordinator-verified T-5 checkpoint `23d9aa285c4b59c577a80759526b760d24646ac2`; fresh background developer owns T-6 only. Complete TypeSpec/DB/server snapshot and finite Home behavior test-first. Available native timezone probe targets: local iPhone17Pro simulator F3CF81FA-5972-40A4-83EF-0D077C02B571 and local Android14 emulator-5554. Own device sessions only. Simulator/fixture outcomes stay labelled; unavailable real-session/physical proof remains T-10 under the execution clarification. Record500-candidate p95 compute/reread results and source/host/clock fixtures before checkpointing.

Coordinator verification2026-11-11: fresh developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3Afe10e157-cef5-448d-803f-25c7f7636b30 delivered36 changed/new product files. Handback `/tmp/T-6-handback.md`, chronological test ledger `/tmp/T-6/tdd-ledger.md` and receipts `/tmp/T-6/`. Reviewed immutable owner/date persistence, SQL calendar/DST/eligibility/visibility/reasons, live real-feed snooze hydration, TypeSpec/generated client and finite3-scope Home. All criteria above have API/shared/public-component coverage; Done/Later mutations remain correctly assigned to T-7. No product auth bypass, worker transport change, private-note public exposure or client calendar authority.

Coordinator found and fixed two small defects itself under the higher-priority instruction to fix small review findings directly. A delayed old-account disk read could overwrite the new account cache before the generation check; the check now precedes assignment. Public useHomeFeed/RNTL delayed-storage regression actually failed by displaying reader A's private item to reader B, then passed. HTTP500 after a successful load incorrectly selected the offline Notice and hid the required picks-error Notice; public Home pull-refresh regression actually failed at the missing picks-error copy, then passed after distinguishing HTTP responses from connection failures. Final changes37 product files; only useHomeFeed and today-feed.test differ from the developer's36-file final manifest, plus the new account-cache regression. This is local verification correction, not a Sol review round.

Coordinator independently PASS: apispec/shared build, disposable DB up/reset, API352 including requested routes/contract, shared focused9, final mobile focused39 across5suites, root loose typecheck and all4 explicit tsc checks, serial backend shared406/API352/worker10, mobile lint/full157 with one pre-existing skip, web lint/335tests, tokens:check. All final required checks passed. Logs `/tmp/t6-coordinator-checks/`; the initial runner stopped at a type error in the new renderHook test and resumed only remaining checks after fixing its explicit props generic. The first account regression attempt failed Babel mock hoisting setup, corrected before the observed behavior red; both setup/type failures remain named in their logs. Child initial-error tests preceded resolution of two loading failures (receipts50–52); existing first-green characterizations and Save fixture/setup corrections are explicitly disclosed in its ledger. No failed log is relabelled green, no behavior assertion weakened or skip added.

Final-source NFR-2 independently rerun after both corrections:10warmups,100compute and100rereads,500eligible over20domains, monotonic loopback HTTP+JSON. Compute p95=19.820834ms (budget800), reread p95=12.262250ms (budget200), DB127.0.0.1:5433/APIhttp://127.0.0.1:57731, Asia/Tokyo selected from actual PostgreSQL wall time. Candidate HEAD920927c4a290e0b2012f5391dc14e72a4a2c5e98 plus37-file source manifest SHA256ec76898b927cca40421c5fb7648958e72232d792801348344dc4b1a0038960c7; candidate fixture SHA256aa778b3d986d48c7e4fd3140e7009ca6075c63803ea0a4dbd157f1b9eecdbc68. Source hashes all independently match. Performance JSON retains all200samples,110computed/210served events; exact log fields and no private-note sentinel verified. Own fixture user/profile removed and HTTP server stopped; no truncating suite ran concurrently. Controlled SQL fixtures separately prove05:59/06:00,23/25hour DST days, same/different dates across zones, IANA rejection, RLS/cascade and Tonight revealsAt, not a client clock simulation.

A-3 native receipts report hermes=true, timeZone=America/New_York, ok=true on both available devices, with IANA and UTC formatting; no expo-localization fallback needed. Developer mounted actual card/progress/Signal/theme/fonts in an isolated ExpoGo fixture with fictional preference boundary, not a normal-issuer whole-Home session. Native-probe code/components are unchanged by the coordinator cache/error fixes; receipts and source manifest inspected. Both owned sessions/ExpoGo installations/Metro/receiver/forwards cleaned, no device settings changed. Final whole-package signed builds, normal-issuer real-session, live spoken screen reader and physical-only Wi-Fi/LTE outcomes remain explicitly pending T-10, as agreed when no physical iPhone was available.

Approved spec/prototype hashes and both existing hook bytes preserved. Tracked diff check passes. The three newly generated files retain14 generator-produced blank-comment whitespace lines (PicksApi2/DailyPick6/TodayPicksResponse6); generated sources were not hand-edited. The staged diff additionally reports two generator-produced blank EOF lines in DailyPick and TodayPicksResponse. Coordinator warning-count assertions initially assumed14 then15 total, failed, and were corrected by inspecting the complete16 warnings (14trailing +2EOF); no source was changed. No new handwritten whitespace warnings. No staging of hooks/environment files, pushes, PR or per-task review. Whole-feature Sol rounds remain0. Implementation checkpoint only, not shipped.

Checkpoint commit: `aafb44ed54aee259196d1fbece61cc3abf1ca26c` (`Task: T-6`).

### T-7 · Complete, snooze or reject an own save with Undo

| | |
|---|---|
| Status | Done |
| Depends on | T-6 |
| Traces | FR-10 · FR-11 · FR-12 · FR-13 · NFR-6 · NFR-8 · S-3 · S-4 · S-18 · §8.4 Writes · §8.6 Not for me Undo/Action while offline/non-own card · §7 Accessibility |
| Ships as | User-visible: complete, snooze or reject an own save with Undo in the complete package |
| Size | M |
| Touches | `apps/mobile/components/FeedCard.tsx` · `apps/mobile/components/SwipeableCard.tsx` · `apps/mobile/components/TodayProgress.tsx` · `apps/mobile/components/Toast.tsx` · `apps/mobile/lib/read-when.ts` · `apps/mobile/lib/bookmark-actions.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/app/(tabs)/index.tsx` · `apps/api/src/routes/bookmarks.ts` |

**Goal.** Own-card Done/Later/rejection persist immediately with reversible optimistic feedback; ownership controls prevent invalid mutations and pick counters respond to the stored snapshot.

**Context.** T-1 owns owner PATCH fields; existing read/archive/feedback/reshare routes remain the mutation contracts. T-6 owns persisted snapshot/counts; T-8 consumes the reusable action controller on the bookmark page.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- New shared mobile action controller and SwipeableCard: right Done/read_at immediately, left Tonight; visible buttons and screen-reader actions. Done stays in picks; Undo restores read state. Extend local-time helper all4 options and display computed day/time in Button detail; restore prior future Later timestamp or null if elapsed.
- Not for me archives own immediately; defer not_interested until toast close/navigation/background. Undo restores and sends nothing; followed/reshares never archive. Preserve accepted killed-process limitations and no durable feedback/action queue.
- Menus/long press exact ownership matrix: own5 actions, followed/reshares3, digest Open only; no swipe/Done/Later for non-own. Save to Library uses existing reshare; Move entry uses existing list, refined T-8.
-8s Undo expiry; screen-reader status persists without expired Undo until next toast/navigation. All actions optimistic/revert with exact failure toast; latest pending request/result cannot incorrectly restore newer state. Reduce motion disables fly-out/bar fill/spin/countdown. S-3/S-4 options and success/error/offline, Home counts, announces results.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] Done/read and Later mutate immediately, Undo within8s restores prior state, network failure reverts with connection toast. Future previous snooze survives Undo; elapsed prior clears.
- [x] Tonight19:00 edge, Tomorrow, next future weekend and next Monday match all FR-11 examples; hidden original pick returns after Home focus revealsAt with1of4→1of5.
- [x] Rejection feedback is absent after Undo, deferred exactly at stated events; killed process retains accepted own archive and may reshow non-own; no queued actions.
- [x] Ownership matrix holds for gestures/buttons/menu/SR actions, digest Open only; Undo expiry and status differ accessibly without extending8s.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-10:** On own saves, swipe right or Done shall set `read_at` at once with an 8 s Undo. A done pick stays in the set.
- [x] **FR-10 AC1:** Undo within 8 s clears `read_at` and restores the slot; network failure follows §8.6 "Action while offline".
- [x] **FR-11:** On own saves, swipe left shall snooze to Tonight; Later offers four times and Not for me, sent at once with an 8 s Undo. Device-local: **Tonight** 20:00 (tomorrow if now ≥ 19:00); **Tomorrow** 07:00; **This weekend** next future Sat or Sun 09:00; **Next week** next Monday 07:00.
- [x] **FR-11 AC1:** This weekend on Saturday 10:00 is Sunday 09:00; on Sunday 10:00 it is next Saturday 09:00. Next week on a Monday is the following Monday.
- [x] **FR-12:** Not for me shall hide the card with 8 s Undo, archive own saves immediately, and send `not_interested` on toast close, navigation away or background.
- [x] **FR-12 AC1:** Undo and process kill follow §8.6 "Not for me Undo"; followed saves are never archived.
- [x] **FR-13:** Card actions (⋯, long press) shall be: own saves Open, Mark done/not done, Later…, Move…, Not for me. Followed and reshares: Open, Save to Library, Not for me. Digests: Open only (D-23).
- [x] **FR-13 AC1:** Followed saves and digests have no swipe, Done or Later buttons.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. RNTL `components/__tests__/bookmark-actions.test.tsx`: Done and Later → API → count/Undo; rejected network → revert; menu/gesture/SR ownership matrix.
2. Jest `lib/__tests__/read-when.test.ts`:19:00, Saturday/Sunday09:00/10:00, Monday, timezone/DST examples; prior future/elapsed restoration.
3. Action-controller fake clock tests:8s/close/navigation/background/kill events, no feedback after Undo, no action queue, pending race rollback; reshare calls existing API.
4. RNTL Toast/reduced motion/large text: status announcement remains after Undo expiry, no listed animation, Later Button detail grows. API existing read/update tests retain owner404 and persisted two-device state.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run db:test:up
bun run db:test:reset
bun run --cwd apps/api test -- src/tests/bookmark-read-routes.test.ts src/tests/bookmark.test.ts
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='bookmark-actions|read-when|Toast'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Started2026-11-11 from coordinator-verified T-6 checkpoint `aafb44ed54aee259196d1fbece61cc3abf1ca26c`; fresh background developer owns T-7 only. Implement reusable optimistic/reversible card actions, timing/menu ownership and8s accessible Undo test-first in the prescribed order. T-6 snapshots and cache/account/error regressions must remain intact. Available native targets: local iPhone17Pro/iOS26.5 simulator F3CF81FA-5972-40A4-83EF-0D077C02B571 and local Android14 emulator-5554; use own bound device sessions, restore precise settings and clean owned services. No normal-issuer test login or physical iPhone is available; explicitly labelled isolated fixtures are permitted for implementation checks, while unavailable real-session/live spoken/physical/final-package proof remains with T-10 under the execution clarification. No durable action queue or product auth bypass. Coordinator records candidate SHA, exact checks/results, native evidence where required, Task trailer/checkpoint commit, and any blocker here.

Coordinator verification2026-11-11: fresh developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A4edbab96-23e8-4149-8d39-0da82da06b17 delivered12 intended mobile files. Full handback/acceptance accounting `/tmp/T-7-handback.md`, chronological receipts `/tmp/T-7/`. Reviewed all12 source/test files, generated transport/owner guards, per-bookmark ordered writes and confirmed baselines, deferred rejection/Undo, local calendar options, ownership matrix, Home overlays/counters and native policy/layout evidence. Each criterion above is covered by public component/transport/clock tests, with unavailable package-native proofs retained below.

Coordinator independently reproduced the existing API capture-age failure: expected≥10, received9 in `/tmp/t7-coordinator-checks/capture-clock-red.log`. The fixture used host Date.now while production logs compare database creation time to queued time. Anchored queuedAt ten seconds before the earlier returned database-created legacy bookmark; the original ≥10 assertion and all attribution/privacy assertions are unchanged. Existing public HTTP test green, complete prescribed API gate352 and serial backend gate now pass. No production backend logger change or weakened assertion.

Two small product corrections were fixed directly by root under the higher-priority small-findings instruction. Done on an already-done pick toggled it unread; a public Home regression actually failed, then passing true for the shared Done/button/right-swipe/SR callback kept it done. The menu still explicitly offers Mark not done and its DELETE path is tested. A Home read started before an accepted Done could subsequently clear its overlay; a public deferred-response regression actually failed. Fresh fulfilled feed/picks carry a runtime read sequence, and synchronization ignores reads preceding pending/completed writes. Cached fallback is excluded from synchronization. Existing later fresh reads still honor another device's unread state. No persisted action queue or client calendar authority. Final15 product/test files: child12 plus useHomeFeed integration, reading-sequence helper and capture fixture. Only Home, the component action test and controller differ from the child manifest; other9 child hashes match.

Root independently PASS: apispec/shared build, disposable DB up/reset, prescribed API352; final focused mobile98 across10suites (all task patterns plus T-6 regressions), root loose typecheck and shared/API/worker/mobile explicit tsc; serial backend shared406/API352/worker10; mobile lint/full215 with one pre-existing skip; web lint/335tests; tokens:check; API lint. Logs `/tmp/t7-coordinator-checks/`, final15-file manifest SHA256ec8fcefa2e198e22810dcc73b43fb1158324a02ba7df9c77ab3a608fe0f06529. First verification stopped at the old fresh-read regression during the synchronization fix; final remaining checks were run after green. No failure is silently relabelled passed.

Test-first qualifications are retained for whole-feature review. Child supplemental RNTL cases followed later phases; Move failure was added while the preceding case was still red, then new fixtures were corrected to existing PATCH/collection and structured paths. An incorrect uncapped-control assumption temporarily changed Signal before valid red; original foundation control caps were restored, leaving Signal unchanged. Setup/first-green characterizations and native squeezed-toast failure/retries are documented individually. Root's initial time-based synchronization passed the stale-read case but failed the existing fresh-read case: actual diagnostic values showed both events at clock100. Awaiting the public read adapter strengthened the existing fixture without changing its assertion; the clock equality still failed. Runtime ordering replaced timestamps, both cases then passed. Temporary diagnostic output was removed. Every actual intermediate failure remains in named logs; no behavior test was skipped, weakened or deleted. These are implementation-verification corrections, not Sol rounds.

Native proof stays accurately bounded: developer used own bound local iOS/Android sessions and actual product components/controller in an isolated fictional ExpoGo view/transport fixture. AX3fontScale2.643 and Android200%/fontScale2 with native Reduce Motion=true, own5 menus, Done/Undo and actual Android right gesture were observed. Root inspected final iOS/Android toast images: status is readable above wrapped Undo/Close; card/content text stays uncapped. Four options/non-own matrix/left gesture and8s SR status policy have component tests; synthetic Android SR policy is not live spoken TalkBack. Toast/card/sheet/gesture visual source is unchanged by root's Home/order fixes; exact native fixtures are not claimed as final whole-package signed or authenticated proof. User has no physical iPhone or normal-issuer test credential. T-10 retains real-session, live spoken VoiceOver/TalkBack, physical-only Wi-Fi/LTE and final signed-source/package outcomes. No new EAS build required by T-7.

Both child device sessions and owned ExpoGo installs/Metro8086/receiver8098/forwards were cleaned; socket receipts confirm ports closed, iOS text/motion and Android text/motion/OS-added font Quick Settings tile restored, pre-existing app inventory preserved. Root created no native session or device service; test HTTP fixtures stopped, named disposable DB retained. Approved spec/prototype/tasks-before-update and both hook bytes independently matched preserved hashes. Final handwritten/staged diff check passes; no generated/package/native/environment drift, commits/pushes/PR by the developer, or per-task review. Whole-feature Sol ledger remains0/max5. Implementation checkpoint only, not shipped.

Checkpoint commit: `42ec686f935b127747f49cbafe503442faa8946b` (`Task: T-7`).

### T-8 · Read a bookmark and continue to the next pick

| | |
|---|---|
| Status | Done |
| Depends on | T-7 |
| Traces | FR-18 · FR-19 · FR-20 · FR-21 · NFR-3 · NFR-6 · S-11 · S-12 · S-22 · §8.4 Content GET · §8.6 Content404/old-reader progress · §7 Deep links |
| Ships as | User-visible: read a bookmark and continue to the next pick in the complete package |
| Size | M |
| Touches | `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/services/bookmark-content-blocks.ts` · `packages/apispec/bookmarks.tsp` · `packages/api-client/` · `apps/api/src/routes/bookmarks.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/app/bookmark/[id].tsx` · `apps/mobile/app/reader/[id].tsx` · `apps/mobile/lib/bookmark-actions.ts` · `apps/mobile/components/Toast.tsx` |

**Goal.** The bookmark offers real Brief/Read/Original, persisted note edit and Move, then Done/Undo/Next pick across the immutable set. Old-reader deep links and private reading data remain usable.

**Context.** Extend existing BookmarkServiceImpl/BookmarkRepositoryImpl with owner content methods and a pure mapper, not a new content service. Current reader shows the saved brief and has highlights/appearance/monotonic progress; preserve those services and unplaced-highlight list.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Owner GET/bookmarks/{id}/content returns blocks/wordCount/source/updatedAt,404 for incomplete/private/nonowner. Pure mapping h1–h4/p/blockquote/li≤2000 then fallback blank lines/sentences≤600chars;≤500KB/p95400ms. Extracted/pasted source drives provenance.
- S-11 prototype: title1, Brief/key points/provenance, Read actual extracted text, Original in-app browser; deep-link mode read/original. Cached brief and content404/offline exact copy/actions; processing/no brief phases and generic failure retry remain truthful. Private description-only brief “From your description”; no article/Paste claim.
- Reuse T-7 controller for Later/Mark done wrapping bar. Pick done shows n/N/Undo/next undone visible pick replacing page; last AllNdone+Back, outside set Done/Undo/Back. Notes sheet add/edit/clear≤500 uses owner PATCH and optimistic/revert; note never enters public conversation.
- Breadcrumb and menu Move reuse existing refile list (loading/Inbox-only/error/offline/Undo), user-confirmed move stops AI refiling even on reprocess. Keep private highlights, reader appearance and monotonic progress; old /reader/id redirects to S-11 Read. Content uncapped, bar wraps, native text selection retained.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] Real complete extracted content is served to owner and rendered in Read with provenance; no complete/private/offline reaches specified empty/connection states. Brief is never labeled original article text.
- [x] Mark done navigates through next undone visible original slots and finishes with AllNdone/Back; outside-set behavior follows FR-21.
- [x] Private note boundaries/null clear and Move are persisted/reversible; confirmed move survives reprocessing and public DTOs remain stripped.
- [x] Old reader links/highlight list/appearance/progress survive; S-11/12/22 loading/empty/error/offline/success states and wrapping bar match prototype.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-18:** The bookmark breadcrumb shall open Move; a confirmed move stops AI refiling.
- [x] **FR-18 AC1:** A moved save survives reprocessing.
- [x] **FR-19:** The user shall add, edit or clear a private note (≤ 500 characters) at save and on the bookmark page.
- [x] **FR-20:** The bookmark page shall offer Brief (brief, key points, provenance), Read (extracted text) and Original (in-app browser).
- [x] **FR-20 AC1:** No extracted content follows §8.6 "Content 404 or offline".
- [x] **FR-21:** Mark done on a pick's page shall show the done count, Undo and Next pick (next undone visible pick).
- [x] **FR-21 AC1:** After the last undone pick, "All {N} done" and Back replace Next pick; outside the set, Done, Undo, Back.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. API `src/tests/bookmark-content.test.ts`: stored extraction → GET owner blocks → read; owner/private/incomplete404, source provenance and20k-word500KB/400ms budget.
2. Shared `__tests__/services/bookmark-content-blocks.test.ts`: supported tags,2000block limit, fallback blank lines/sentence600chars, malformed/untrusted HTML text-only mapper.
3. RNTL `app/__tests__/bookmark-reading.test.tsx`: Brief/Read/Original and both deep-link modes, old-reader redirect, Next pick matrix, all S-11 states, note edit/clear/boundaries and Move states.
4. Existing reading/highlight/filing regression tests: unplaced highlights retained, monotonic progress and user refile wins on reprocess; action failure reverts note/Move with specified toast; native bar AX3/200% and text selection.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run apispec
bun run --cwd packages/shared build
bun run db:test:up
bun run db:test:reset
bun run --cwd apps/api test -- src/tests/bookmark-content.test.ts src/tests/reading.test.ts src/tests/api-contract.test.ts
bun run --cwd packages/shared test -- --runInBand --testPathPatterns='bookmark-content|bookmark.filing|reading|highlight'
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='bookmark-reading|reader|note'
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Started2026-11-11 from coordinator-verified T-7 checkpoint `42ec686f935b127747f49cbafe503442faa8946b`; fresh background developer owns T-8 only. Extend existing owner content/filing/reading/highlight services and implement S-11 Brief/Read/Original, notes/Move and immutable Next pick test-first in prescribed order. T-7 controller/read-sequence freshness and explicit Done semantics must remain intact; no note/offline action queue. NFR-3 needs100owner HTTP GET timings after10warmups over20,000words, response bytes≤500KB and p95≤400ms on final source, never concurrent with truncating suites. Native AX3/200% wrapping and text-selection checks use own bound sessions on local iOS F3CF81FA-5972-40A4-83EF-0D077C02B571/Android emulator-5554, restore settings/installs/services. Normal-issuer login/physical iPhone remain unavailable, isolated fictional view fixtures are labelled and package-only proof remains T-10 under execution clarification. Coordinator records candidate SHA, exact checks/results, native evidence where required, Task trailer/checkpoint commit, and any blocker here.

Coordinator verification2026-11-11: fresh developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A3fabca37-c1e3-44f0-80c6-6dcd48687710 delivered25 intended product/test files. Full handback `/tmp/T-8-handback.md`, chronological red/green/setup/characterization ledger and native receipts `/tmp/T-8/`. Reviewed complete owner contract/SQL/service/pure inert mapper, reader/redirect/tools/progress/controller integration, privacy and existing-test changes. Stored complete extraction is read separately from brief; private/incomplete/nonowner404, source provenance, tag/block/fallback limits, Next original slot, note null/bounds/revert, Move/filing and private reading regressions are covered. All original typed/mobile/shared assertions retained; only required mock members/import setup added. No worker transport, recovery writes, new service/broker/flag/auth endpoint or public note exposure.

Root found an open private note draft could survive an account change into the next account's reader. Public RNTL account-switch regression actually failed with the previous-account TextInput still present; then passed after clearing note/menu state on page/account changes, binding loaded page data and result application to the current page/account, and restricting the note sheet to its owner. Late callbacks cannot apply an earlier page as the current loaded identity. Existing late-page/content/picks/progress and all reading regressions still pass. Final25 source paths remain unchanged as an inventory; only bookmark-reading.test and bookmark/[id] differ from the child manifest, other23 child product hashes match. Direct small-finding correction follows the higher-priority root instruction, not a Sol review round.

Root independently PASS: apispec/shared build, disposable DB up/reset, prescribed API356/24files, shared focused63/6suites, final mobile focused39; root loose typecheck and shared/API/worker/mobile tsc; serial backend shared411/API356/worker10; mobile lint/full254 plus one pre-existing skip; web lint/335tests; tokens:check; API lint. After the small reader correction, repeated affected mobile focused/tsc/lint/full and final-source performance, all pass. Other verified backend/web sources remained unchanged. Logs `/tmp/t8-coordinator-checks/`. No test newly skipped, weakened or deleted.

NFR-3 independently measured after final correction: stored20,000-word article, fixture SHA2561324c27035867432793e85a43fb3df62a7186031954203bc017a09a571036959;10warmups then100serial owner HTTP GETs with response+JSON, monotonic timer/rank95. Final189010bytes (≤500000), p95=10.103291ms (≤400), DB127.0.0.1:5433/APIhttp://127.0.0.1:49934. Candidate HEAD92e6ca62f335fc32e16a6f0e73384e6dede10ab3 plus27-file source manifest (25product +2preserved hooks), SHA256f57c841c616f68f29c9fc363ace93f489eba9644d6b4566e2ceb9541b6ec044c; all file hashes independently match. Receipt `/tmp/t8-coordinator-checks/content-performance.json` retains100timing/byte samples and actual SQL cleanup assertions. Auth injection exists only in isolated fictional owner test registration, not a normal-issuer proof. Root fixture's owned bookmark/content/auth user removed, server/database closed, no TRUNCATE during measurement. Child's initial cleanup failure (auth deletion alone left bookmark) was explicitly recorded; marker/owner/id/URL/content-hash guarded orphan cleanup and corrected final rerun are documented, not falsely passed.

Native proof: isolated fixture mounted actual reader/tools/controller/progress/tokens with fictional view/transport boundaries and on-screen no-account-session label. Both requested native fontScale2.643/AX3 and2.0/Android200% confirmed; initial Android1.75 corrected before passing proof. Root inspected both native Done/count/action bars and actual iOS Copy /Android text handles+Copy/Share selection images. Android Done image includes wrapped Undo/Next; iOS Done action tree captures Undo inside8s, while the later screenshot shows expired Undo and Next. Actual Next page replacement and last All2done/Back receipts retained. Visual markup remains unchanged by root identity/draft guards; fixtures do not prove final signed or normal-issuer authenticated package. No live spoken VoiceOver/TalkBack or physical Wi-Fi/LTE claim. Final signed-source, real-session, live-spoken/physical-only and complete-package proofs remain T-10 under execution clarification.

Child setup/first-green qualifications remain in its ledger: initial mapper-supported tags and existing404/limits/Undo matrices characterized green; new timestamp expectation corrected to actual DB trigger timestamp; new fallback grouping asserts contract invariants; key-point matcher/Markdown/token/inset/mocked members corrected without weakening old assertions. Native wrong-root Expo startup briefly changed root tsconfig, owned process stopped and exact original restored; dependency/menu selector failures and initial1.75 text setting were corrected openly. No successful proof is claimed from failed retries. Native clipboard Copy changed fictional copied text; prior clipboard content was not captured and exact restoration is not claimed. Settings/text/app inventories/own sessions/Metro8087/reverse and performance ports were restored/closed; cleanup receipt inspected. Named disposable DB remains healthy. Root created no native session or device setting change.

Approved spec/prototype/tasks-before-metadata and both hook bytes independently preserved; no env/issuer/native/package config drift. Tracked diff check passes; newly generated BookmarkContent/BookmarkContentBlock retain13 generator-produced trailing blank-comment lines (8+5), plus2 generator-produced blank EOF lines, never manually edited; staged audit reports exactly15 generated warnings. No handwritten whitespace issue. No child commits/staging/push/PR/artifact edits, no per-task review. Whole-feature Sol ledger remains0/max5. Implementation checkpoint only, not shipped.

Checkpoint commit: `ed815d7ea591a21220fa4bb2e9cda806c4092c29` (`Task: T-8`).

### T-9 · Explain extraction failures and recover with pasted text

| | |
|---|---|
| Status | Done |
| Depends on | T-8 |
| Traces | FR-22 · FR-23 · FR-24 · FR-6 failed-card replacement · NFR-9 · NFR-10 · S-16 · S-21 · §8.4 Content PUT/Failure codes · §8.3 Shared processor · §8.7 pasted untrusted text · §8.8 Processing failure log |
| Ships as | User-visible: explain extraction failures and recover with pasted text in the complete package |
| Size | M |
| Touches | `packages/shared/src/services/bookmark.processor.service.ts` · `packages/shared/src/services/bookmark.processor.prompt.ts` · `packages/shared/src/services/bookmark.summary.ts` · `packages/shared/src/services/content-extraction.ts` · `packages/shared/src/services/bookmark.service.ts` · `packages/shared/src/repositories/bookmark.repository.ts` · `packages/shared/src/database/schema.ts` · `packages/shared/src/types.ts` · `packages/apispec/` · `packages/api-client/` · `supabase/migrations/` · `apps/api/src/routes/bookmarks.ts` · `apps/mobile/lib/mobile-api.ts` · `apps/mobile/components/CaptureStatus.tsx` · `apps/mobile/components/FeedCard.tsx` · `apps/mobile/app/bookmark/[id].tsx` |

**Goal.** Unusable pages have a truthful empty brief and classified reason; users can open the source or paste actual text to rebuild through the existing pipeline.

**Context.** Current summarize schema has free-text unusableReason and processor permits soft phases/OpenGraph fallback. Replace those exact paths, clear failure code on run start, and preserve normal/private enrichment rules.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Add nullable processing_failure_code persistence and owner DTO enum; fetch codes retain names, exhausted pending→provider; summarize enum paywall/consent/error_page/empty/other maps exactly §8.4. Unusable blanks brief/summary/key points and fails/skips tag/file/embed; no OpenGraph substitute. Log bookmark/phase/code only.
- Owner PUT content with200–100000characters nonprivate: escaped paragraphs, metadata.extraction complete/user_paste, clearcode and existing full pgmq reprocess. Reprocess consumes pasted stored content; GET source=pasted. Keep untrusted framing. Private409/length400/nonowner404; no new job broker/service.
- S-16 card-in-place/page reasons and safe-link copy exactly all7 codes, no-code Retry Notice. Original plus Paste, provider replaces Paste with Try again. Failed page retains Later/Mark done and menu Not for me through controller.
- S-21 disabled below200/above100000; submitfailure Notice+Retry keeps text, success pending then pasted provenance brief. Failure does not lose bookmark or misstate private description as fetched content. Cover pending/retry/offline/reverted action/empty states.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [x] A model-judged paywall with OpenGraph description has empty cosmicBriefSummary and no tag/file/embed, with code/log; every fetch/unusable mapping and legacy no-code row has specified UX.
- [x]199chars cannot submit;200–100000 escaped text reprocesses existing stored pasted extraction, yields pending then brief with pasted source;100001 rejected. Failure keeps text.
- [x] Nonowner/private cannot paste/read extracted article; provider offers Try again instead of Paste, other codes Original/Paste. Action failure still reverts and link remains safe.

The following §5 wording is authoritative and copied verbatim; each original criterion is covered by the tests above/below:

- [x] **FR-22:** A save with a `processingFailureCode` (§8.4) shall show its reason and Open original, plus Paste the text (replaced by Try again for `provider`) and the bar Later · Mark done, with an empty brief never filled from metadata.
- [x] **FR-22 AC1:** Even with an Open Graph description, unusable content leaves `cosmicBriefSummary` empty; no-code failures follow §7 Copy.
- [x] **FR-23:** Paste the text shall accept 200–100,000 characters as content and rebuild the brief, marked as from pasted text.
- [x] **FR-23 AC1:** 199 characters keeps submit disabled. Success returns the card to pending.
- [x] **FR-24:** Merged into FR-22.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. Pipeline/API integration `src/tests/bookmark-content.test.ts` plus shared processor: paywall+OG → emptyfailed → paste200 → fullreprocess → source=pasted brief; normal/private regression paths.
2. Shared processor table-driven tests: allfetch codes, exhausted pending,5unusable reasons, blank/skip flags and clear-on-restart; prompt schema enum and untrusted pasted framing.
3. API validation/security/contract matrix:199/200/100000/100001, escaped HTML/script input, owner/private409/nonowner404, minimal share auth rejects PUT and private fields never public.
4. RNTL failed-card/page/paste: all7reasons, no-code Retry, provider action replacement, retained text on failure, pending/success/provenance and Later/Done/Notforme offline rollback.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run apispec
bun run --cwd packages/shared build
bun run db:test:up
bun run db:test:reset
bun run --cwd apps/api test -- src/tests/bookmark-content.test.ts src/tests/api-contract.test.ts
bun run --cwd packages/shared test -- --runInBand --testPathPatterns='bookmark.processor|bookmark-content|content-extraction'
bun run --cwd apps/worker test
bun run --cwd apps/mobile test -- --runInBand --testPathPattern='failure|paste|bookmark-reading'
bunx tsc --noEmit -p apps/worker/tsconfig.json
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run --cwd apps/mobile lint
```

**Notes**

Started2026-11-11 from coordinator-verified T-8 checkpoint `ed815d7ea591a21220fa4bb2e9cda806c4092c29`; fresh background developer owns T-9 only. Complete truthful extraction-failure classification/blanking and owner pasted-text recovery through the existing pipeline, with contract-first public integration tests in prescribed order. Add the nullable failure field under T-9 Scope and preserve the capture/error distinction, T-7 action/order fences and T-8 content/privacy/note account guards/progress. Only local disposable backend data and isolated mocks/fixtures; actual worker RPC must use the existing guarded local transport recipe, never hosted business queues. Native targets and session/physical limitations remain as recorded; real-session/final signed/live-spoken/physical-only proof stays T-10 under execution clarification. Coordinator records candidate SHA, exact checks/results, native evidence where required, Task trailer/checkpoint commit, and any blocker here.

Assignment correction2026-11-11: the initial developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A3ab85150-a8c6-41a4-ba0d-690d040c14bd correctly stopped when the coordinator brief incorrectly said processing_failure_code already existed from T-1 and forbade duplicating it. Root checked the committed capture migration/schema/shared types/TypeSpec: no field exists; the approved T-9 Scope expressly requires adding its nullable persistence and owner enum. The brief was wrong, not the approved requirement. Resolution: T-9 is authorized to add the absent column, shared schema/types, owner contract and serializers through the specified migration/TypeSpec pipeline. Do not alter earlier migrations or approved spec/criteria. No additional user approval needed for this already-approved scope.

Initial handback `/tmp/T-9-handback.md` and `/tmp/T-9/` receipts remain preserved. Clean public paywall red received the forbidden OpenGraph brief; partial implementation then failed shared build/missing database column, no green or completed AC claimed. Three known partial product files (API bookmark-content test, shared processor, shared bookmark service) remain unstaged in this same feature checkout; root transfers their ownership to a fresh implementation continuation. Finish that first red/green slice before any subsequent behavior. Failed tsc emitted ignored shared dist; successful build required after adding the contract/schema. No product commit/checkpoint/review round; task remains In progress because the assignment contradiction is now resolved. All protected artifacts and hook bytes were unchanged, owned fixture content/bookmarks/connections cleaned, no active services or devices. Final continuation report must retain these initial red/build/persistence qualifications and the full cumulative inventory. Complete-package Sol ledger stays0/max5 and T-10 proof remains pending.

Coordinator verification2026-11-11: fresh continuation node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A93a0919a-9b63-4bea-989a-49bc7b6a1459 delivered33 intended files, including the original three transferred partial files. Full cumulative inventory and acceptance/red-green ledger are in `/tmp/T-9-resume-handback.md` and `/tmp/T-9-resume/`; original `/tmp/T-9/` evidence remains unchanged. The approved nullable field is now an additive checked migration, owner enum and generated contract. Reviewed the migration, persistence and owner transaction, PUT validation/queue dispatch, classification/blanking and soft-phase preservation, untrusted source boundary, public serializers and mobile recovery/request/account guards. No root product correction was required. All33 final source hashes independently match the handback manifest.

Root independently PASS: apispec/shared build, local disposable DB up/reset, exact prescribed API363/24files; shared focused70/4suites; mobile focused56/2suites; standalone worker10; root loose/concurrency1 typecheck plus explicit shared/API/worker/mobile tsc; serial backend shared426/28suites, API363/24files and worker10/2files; mobile lint8warnings/0errors and full271passed/one existing skip; web lint/335tests; tokens; API lint68warnings/0errors and worker src lint9warnings/0errors. All result logs and runner are in `/tmp/t9-coordinator-checks/`. Backend runner uses explicit local5433/test/project environment and serial Turbo; no truncating suite overlapped a native/measurement fixture. One supplementary standalone worker command20 omitted explicit environment; its10 pure worker tests passed, but root repeated command21 with the required explicit local environment and retained both logs. No omitted-environment receipt is substituted for the required gate.

Acceptance accounting: actual HTTP/storage/processor fixtures prove paywall plus OG leaves all summaries/points empty and skips tag/file/embed; all7 fetch and5 model mappings plus clear-on-start, legacy row UX and safe classified logs pass. Owner200/100000 versus199/100001, escaped paragraphs, nonowner404/private409, restricted-key denial and public-field stripping pass. Deterministic existing pgmq registration/drain invokes the actual processor from stored user_paste content and verifies newly source-driven brief/provenance, including original video/post metadata. RNTL proves seven reason/card/page states, provider replacement, private/no-code behavior, retained draft/Retry, pending/pasted brief, account/page abort/late-result fences and existing reversible reading actions. These are local implementation proofs, not normal-issuer signed-session proof.

Test-first qualifications remain explicit for cumulative review. The original clean paywall red is the preserved first red; the initial missing-column/build failures were not green. Supplemental five-reason/owner/bounds/rollback matrices first characterized green where stated. Three expressly replaced unusable/OG semantics gained stronger empty/failed/skip/code expectations; an accidental unrelated normal-recovery expectation change was restored, and normal soft-provider/private/manual filing regressions pass. Prompt representation checks decode JSON and retain the same text budget. Fixture syntax/types/mock defects and stale shared dist were corrected; no failing setup is claimed as an expected product red. A late actual video/post metadata public red exposed HTML at the model source boundary and passed after treating pasted content as an article. Full ledger records each deviation. The disposable DB tmpfs interruption and failed privileged WAL setup remain qualified; subsequent local reset/max_wal_size128MB and final serial suite passed. No earlier failed receipt was overwritten.

Native evidence is limited to the continuation's isolated fictional actual-component iOS S-16 light page. Root inspected `/tmp/T-9-resume/ios-s16-light.png`: subscription reason, empty content region, exact Original/Paste recovery and Later/Mark done bar. Native S-21 was not reached after the recorded invalid-target/missing-label failures (actual label Paste the text). Android install was blocked by another session owning emulator-5554; its one advised status attempt remained unavailable. The developer stopped, closed only its own panels/Metro/ExpoGo and did not alter another session. No Android, AX3/dark/native pasted-flow, live spoken or normal-issuer session pass is inferred. Complete S-state matrix, final-source signed packages and unavailable real-session/physical Wi-Fi/LTE/device-only proof remain T-10 under execution clarification.

All10 protected hashes independently match before coordinator metadata: approved spec/prototype/tasks, hook/env bytes and original receipts/inventory. No old migration, auth flag/endpoint/bypass, new broker/service, note/action replay queue, production write or child checkpoint. DB retained healthy; no owned application/service/device remains. Handwritten diff whitespace passes; staged audit retains exactly13 generator-owned warnings (10 trailing blank-comment/indentation lines and3 blank EOF lines); generated files were not edited manually. Whole-feature Sol ledger remains0/max5, no per-task review or PR. Done is an implementation checkpoint only, not released.

Checkpoint commit: `675e63ed9badd32158cb7840eb4173daf708df0f` (`Task: T-9`).

### T-10 · Prove the complete package and add its mobile PR gate

| | |
|---|---|
| Status | Done |
| Depends on | T-9 |
| Traces | NFR-1…10 integration proof · G-1…6 · §8.3 CI · §8.9 release/rollback · §8.10 all levels · §9 mitigations · A-1…4 · DOC-1/2 |
| Ships as | User-visible: prove the complete package and add its mobile PR gate in the complete package |
| Size | M |
| Touches | `.github/workflows/mobile-pr.yml` · `apps/mobile/IMPLEMENTATION.md` · `apps/mobile/app/__tests__/` · `apps/mobile/components/__tests__/` · `apps/api/src/tests/` · `packages/shared/src/__tests__/` |

**Goal.** All cross-feature budgets and the primary outcome are proved on the feature candidate; PRs trigger the requested mobile quality gate. Operators have exact release, measurement and rollback instructions.

**Context.** Feature correctness tests already belong to T-1…9. This task exercises the completed two-device/native/server integration, dedicated performance and accessibility measurements and CI trigger, before final Sol review and package PR.

**Prototype.** [Approved standalone prototype](./prototype.html). Use the named S-states; N/A for backend-only portions.

**Scope**

- Add mobile-pr.yml pull_request path filter matching deploy-mobile (mobile/client/apispec/package.json/bun.lock/deploy-mobile.yml), plus its own workflow path. Bun1.3.11 install, Java17/API generation before type checks, mobile lint, local tsc and Jest; no signing secret as flag and no deploy/production DB in PR.
- Dedicated candidate proof: NFR1status latency Wi-Fi/LTE; capturekill/airplane/revoked-key/same-account replay zero lost; picks p95 compute/reread500fixtures; content20kwords500KB/400ms; concurrent dedupe; full auth/public-field/old-JWT compatibility. Run all suites and retained previous web/mobile API smokes.
- Device primary outcome §2: eligible library→Safari capture→pending above unchanged picks→swipe done→Read/Done/Next→second device same slots/reasons→both read on web. Android sender return, clipboard15.x/16+, VoiceOver/TalkBack/8sUndo, Reduce Motion and AX3/Android200% across every introduced screen. Use device tools, not simctl/adb for UI; record actual host/id/build/candidate results in Notes.
- Fold exact operational test results and G1–6 read-only query definitions/weekly UTC versus pick-day rules into existing IMPLEMENTATION.md; no SDK or raw keys/notes. Snapshot G1/G4 eight-week baseline before release; retain operator sign-off and DOC rules, not guessed postrelease results.
- Rehearse rollback on candidate/disposable fixtures: previous JWT clients with additive schema, retained unused migration, prior mobile build, all-key revocation→queued extension. Confirm A-1 audience and both-bundle capabilities; apply only already accepted A2–4 fallbacks if their probes fail. Human postmerge TestFlight/measurement steps are R-n, never dependencies of code tasks.

**Out of scope**

- Backlog2–7/cuts, notifications, exploration switches, analytics SDK, standalone task releases. Adjacent tasks own the portions explicitly named in Scope.

**Acceptance criteria**

- [ ] Verify all, native primary outcome and all numeric budgets pass on the candidate; no unproved device/native/server result is inferred from HTML or bundle export.
- [x] Local/static workflow proof verifies specified PR paths, typecheck/lint/Jest failure behavior and no deploy; the equivalent existing Accessibility commands pass locally. Observed live mobile/Accessibility PR jobs run after package PR creation and gate merge, not T-10 Done or that PR's creation.
- [ ] Previous build/web compatibility, public stripping, no note/key log leakage, all7failure reasons, ownership and complete S-state/a11y matrix pass.
- [ ] A1–4 checks have actual results/fallback evidence; release/rollback and G1–6/DOC query definitions are reviewable before PR. Wider rollout remains blocked by any explained-or-unexplained capture loss until PM clears it.

**Tests** (write in this order; fixtures within one task are not separate handoffs)

1. Workflow fixture/static test: matching paths trigger requested3checks, generation prerequisites/Java present, no production migration or auto-release step.
2. API/shared performance and two-device primary-outcome fixtures; security/compatibility crossmatrix and serialized DB suite runs.
3. Branch EAS previews on both platforms and native/device checklist from Scope, including20shares/network, process-kill boundaries and all screen accessibility states.
4. Read-only metric query fixtures prove UTCweek/pick-day denominators, original-slot rejection denominator, Undo excluded and7daydone window. Rollback rehearsal and complete Verify all before final review.

**Verify** (root unless the block changes directory; start backend disposable DB before its suites)

```bash
bun run apispec
bun run --cwd packages/shared build
bun run typecheck
bunx tsc --noEmit -p packages/shared/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
bunx tsc --noEmit -p apps/worker/tsconfig.json
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run test:db
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile test -- --ci --runInBand
bun run --cwd apps/web lint
bun run --cwd apps/web test
bun run tokens:check
cd apps/mobile
eas build --profile preview --platform all
```

**Notes**

Started2026-11-11 from coordinator-verified T-9 checkpoint `675e63ed9badd32158cb7840eb4173daf708df0f`. Fresh background developer owns T-10 only: complete CI/operational documents and every available final-source integration, numeric, compatibility, signed-build and simulator/emulator proof before reporting any remaining external proof gap. User has no physical iPhone; no normal-issuer test-login secret has been supplied, so do not fabricate one or ask again for a phone. Clearly labelled isolated fixtures are implementation evidence only. Preserve the approved native/real-session package gate and do not mark unavailable proof passed or waived. Own bound device sessions only; local iOS F3CF81FA-5972-40A4-83EF-0D077C02B571 and Android emulator-5554/host local. T-9 Android was owned by another session t3-f11fa76cbb645413da6251f2; never reuse or close it. Native S-21 and the T-9 dark/large-text/reason matrix remain to attempt on available targets with final source. Complete prescribed tests in order, every Verify command and available accepted fallback probes; return exact candidate/build/fixture hashes, quantitative samples, red/green ledger, complete AC/pending-proof accounting and cleanup. No task/spec/prototype edits, staging/commits/pushes/PR/review/subagents. Root retains checkpoint and one cumulative Sol ledger0/max5. Coordinator records final results and any genuine blocker here. Pending package proof from T-2: actual normal-issuer native JWT/share-key issuance/save/revocation/offline Retry; final-source-bound EAS build; live signed-device/keychain behavior. User has no physical iPhone and directed simulator implementation; retain physical Wi-Fi/LTE/device-only outcomes as unavailable, never as passed. Preserve all simulator/XCTest/signed-profile evidence separately, and keep missing credentials or physical proof explicit at the package gate. Pending T-3 proof: normal-issuer host sign-in/key repair/revoked/offline Retry and signed app/extension interoperability; live spoken VoiceOver; all20 Wi-Fi plus20 LTE physical-radio latency trials; final package source-bound native previews. Simulator Safari/local-API capture, refused-transport persistence, signed-out bridge/relaunch, large-text/Reduce Motion and native26 fixtures passed and remain separately labelled. T-5 completes native mobile override/font-weight/Close-label integration. Pending T-4 proof: normal-issuer signed-in no-tap save/matching-user replay; live native spoken TalkBack/retained status/Close (automation suppresses service binding); physical sender return/connectivity. Final signed Android previewcaaef24d passed emulator offline sender return, distinct later intents, no-link lifecycle and durable kill/relaunch; RNTL fictional-boundary sign-in/drain and reader/timer checks pass separately. Final package source builds remain required. T-5 native mobile palette/title-weight/Close-cap integration is completed with29 native tests and unsigned extension build; both-mode AX3/Android200% isolated mounted styling proof passed. Repeat full introduced-screen/navigation/motion matrix with final signed package and real normal-issuer session; Expo Go/fictional styling/policy fixtures are not that proof.

Coordinator verification2026-11-11: fresh developer node:delegated-task:command%3Amcp%3A44e93c94-ffbb-4f6d-ae4f-4a59ab199c23%3Adelegate-task%3A67e07b8d-0e02-44d5-bd59-d77e4290236f delivered9 intended files. Complete chronological red/green/setup/characterization and pending AC accounting is `/tmp/T-10-handback.md`, `/tmp/T-10-receipts/T-10-ledger.md` and its ledger/inventory/source/build/native files. Root independently reviewed the workflow/trigger/failure proof, public HTTP/SQL/generated-client fixtures, reporting SQL and DST windows, native fixture guards/lifecycle, source receipts, operator instructions and small repository cause fix. The cause remains non-enumerable and preserves SQLSTATE for existing concurrent duplicate recovery; actual public full-suite reds preceded the child's green201/200/sameID/oneenqueue. Guarded native cleanup and marker checks, exact elapsed168hour G-1 edge and other6query denominators were verified. No unrelated old assertion was removed or weakened; first-green fixtures/setup failures remain qualified.

Root PASS: apispec/shared build and local DB up/reset; API380/28files; shared focused70; mobile focused56; root loose/concurrency1 typecheck plus explicit shared/API/worker/mobile tsc; forced serial backend shared426/API380/worker10; mobile lint/full271 with one existing skip, web lint/335, tokens, API lint85warnings/0errors and worker src lint9warnings/0errors. Exact existing Accessibility command passed173/3files. Root initially used nonexistent accessibility file filters (setup failure/no test found); retained log20, corrected exact workflow filter in23 passed. Root's first native29 runner omitted its required local5536 fixture and had4 transport setup failures; log24 retained. Corrected owned marker-qualified fixture plus same test runner passed29/0fail in12.301seconds, then SIGTERM cleanup exited0 and exact fixture owner/bookmark/auth residue is0. No product/native assertion changed. These failures are not product reds or green gate receipts. All root outputs are `/tmp/t10-coordinator-checks/`.

Independent source-bound HTTP budgets passed: final17fixtures/4files after a small operator-doc chronology correction;500eligible candidates/20domains,10compute warmups,100compute+100reread monotonic HTTP/body/JSON samples, nearest-rank95 compute20.714958ms<=800 and reread12.164709ms<=200. Stored20,000words,10warmups/100samples:189010bytes<=500000, p95=9.779833ms<=400. Final source manifest9d245dacba2b073d12a654f924d908829e7009d27a77f65889cbd6c7f31ccbae; snapshot candidate a7f653f06cd080f2efcad3eed5310c250dc4cc0b plus the9 listed changes. Root corrected only IMPLEMENTATION.md's historical10:19 chronology to acknowledge the later marker-only harness fix; SQL/app/native sources unchanged. Other8 child hashes match. Affected17 public workflow/package/metric/lifecycle fixtures passed again with the new document/source hash. Earlier full-suite metrics remain historical receipts, not overwritten.

Root independently re-inspected final signed iOS70cffe8b-b0df-404f-80ae-8ef4c694a84b and Android5d08ce94-09b8-47c6-943d-d0df0d382ee7 artifacts: signatures, both iOS bundle IDs/shared expanded keychain/AppGroup/profile grants, Android package/SEND text intent/native bridge, exact bundled original issuer/public key and absence of backend service key, canonical tokens. iOS artifact SHA5753b3090262a2355a2d7e6f49bbec64f72961d0bfe498b7a7452839b2b36ffe; Android4435c0ad1649e8f10a56ade1bf426f9239601926d84861593d59b4f0846673e5. All9 delivered child sources matched final signed source archive before root's non-runtime doc correction. Archive1188files SHA518ad88dcc3a49d77b239a897e06eb08b265cdf23fac7e5558047ce693e7b719 differed only at the explicitly temporary/restored preview eas.json. Root did not submit redundant builds or change app/extension source; current WIP differs from that signed archive additionally only at the disclosed doc chronology. These artifact checks prove source/config/capability, not physical or real-session behavior.

Native root inspection confirms isolated fictional S-21 retained251character draft/Notice/Retry, dark pending capture above unchanged5picks and provider empty page with Try again/Later/Mark done. Child's additional7reason/both-theme/default-text, pasted pending/brief/read, partialAX3/IANA/ReduceMotion and Save validation receipts remain narrowly labelled. Full normal-issuer/Safari/two-device/web outcome, signed-device interop,20Wi-Fi/20LTE status/kill/airplane/zero-loss/sender return, supported15.x/16+clipboard, live spoken VoiceOver/TalkBack/8sretained status and complete screen/theme/AX3/Android200%/motion matrix remain PENDING. Physical denominator0/20+0/20. No unavailable result is passed or waived. Android DEVICE_IN_USE remained owned by t3-f11fa76cbb645413da6251f2; its advised status unavailable. iOS repeated Save-behind-visible-keyboard guard remained after scoped advice/retry; native UI verification stopped. Root did not bypass either failure or claim failed confirmation filenames successful.

A1 internal audience/previous TestFlight ID and R1 baseline/operator sign-offs remain human steps. A2 signed entitlements/native exact-service policy passes but real interop pending; A3 actual Hermes IANA/Postgres acceptance passes; A4 current native Android return unavailable. All future release/measurement/rollback execution remains unassigned; no merge/production/TestFlight permission is inferred. Queries/rollback rehearsals are disposable fictional proof, not production baselines. Root guarded cleanup removed only exact metric UUID URL/owner/id rows, preserved unrelated bookmark IDs, verified native owned rows/accounts0 and retained healthy marked5433 DB. The first /tmp cleanup import failed before writes; API-scoped module resolution corrected it, log28/cleanup27 prove success. Root started no UI/Metro/tunnel and closed only its owned fixture; native test fixture Z cleanup passed. No foreign session, main app data, existing settings/env/hook bytes or earlier receipts changed.

Blocked-work preservation: all9 verified product/test/document changes are committed locally on `wip/save-and-todays-5-T-10` at `fc52a46e30c4ee7bdf0caafc1fa80cb0f7a74130` (`Task: T-10`). This is a WIP backup, not a Done checkpoint. Returned to the clean feature branch and marked T-10 Blocked under the protocol because required external/native proofs cannot proceed with current access/platform/tool stops. All45 protected hashes matched before metadata; handwritten whitespace passes and pre-existing hook files are excluded. No stage/commit/push/PR/review by the child. Whole-feature Sol ledger remains0/max5; entire package held, no review/PR/merge/release.

Concrete proposed exception for user review: `/tmp/T-10-proof-gate-proposal.md` permits whole-feature Sol review and one complete draft PR while T-10's missing proof remains unchecked, moving those checks only to a mandatory merge gate. Proposal is NOT approved or applied; current pre-review/pre-PR gates stay in force. No request for a physical phone or credentials is repeated.

Authorized beta checkpoint2026-11-11: user full-send/TestFlight request above resolves the delivery block by assigning unavailable device/session proof to beta validation. Imported all9 verified files from WIPfc52a46e30c4ee7bdf0caafc1fa80cb0f7a74130 via cherry-pick `0b9e44819e3cb6b3f86f57fe76fd340397749add` (`Task: T-10`). No code/behavior changed in that import. Original blocked history and unchecked physical/native acceptance criteria above are retained; proposal's earlier mandatory-merge-gate timing is superseded by the explicit request to validate through TestFlight. Proceed through whole-package Sol/CI and backend green to production-signed TestFlight; never submit the tunnel-bound internal preview as the beta. Final candidate re-verification and reviewer/PR/build/submission IDs will be recorded.

## Implementation review

One ledger;3 of5 rounds completed: round1 and round2 CHANGES REQUESTED, round3 APPROVE. SOL-1…7 fixed; no open Critical/High or Medium/Low follow-up. Current semantic approval covers Base b704… and Reviewed5e1… below; two rounds remain for any meaningful candidate/base change. Round4 is requested for the test-only cold-root synchronization change below; round3 approval/history remains intact. Record current fetched full Base SHA and reviewed feature SHA when execution starts. Tasks Done only mean verified feature checkpoints; package approval remains Pending until cumulative Sol review. Planning fresh-eyes review is separate from implementation review and consumes none of these rounds.

| Repo | Feature branch | Base SHA | Reviewed SHA | Tasks | Rounds | Verdict | Checks | Findings / follow-ups |
|---|---|---|---|---|---|---|---|---|
| cosmic-dolphin | feature/save-and-todays-5 | b7045a4c56f896d085e2e1aef79b12ea1cfa6407 | 3f83ea74a843622a4a815f62ed9c40db040725fe | T-1…T-10 | 1 | CHANGES REQUESTED | Independent generation/types/build/lint/native29; shared426/API380/worker10/web335/mobile271 plus existing skip after retained first timing failure | SOL-1…3 Critical; SOL-4…6 High; all corrected and independently verified below. Beta-proof exception remains authorized. |
| cosmic-dolphin | feature/save-and-todays-5 | b7045a4c56f896d085e2e1aef79b12ea1cfa6407 | c1dcb4c672bbd4ad5ceb9d28cca9c9dad318614d | T-1…T-10 | 2 | CHANGES REQUESTED | Independent428shared/383API/10worker/297mobile+skip/335web/173accessibility, generation/types/lint/numeric and actual signed artifacts pass | All SOL-1…6 fixed. New Critical SOL-7: Save local URL/note survives A→B; root correction below. Same max5 ledger. |
| cosmic-dolphin | feature/save-and-todays-5 | b7045a4c56f896d085e2e1aef79b12ea1cfa6407 | 5e1c5a9e734e673e5663669e7da9d4a3421e6a21 | T-1…T-10 | 3 | APPROVE | Independent428shared/383API/10worker/303mobile+skip/335web/173accessibility/native29; exact generation/types/lint/builds/numeric/actual signed-source proof pass | SOL-1…7 explicitly fixed; no open Critical/High, dispute or Medium/Low follow-up. Live PR CI and beta proofs remain separate. |


### Round1 correction checkpoint (2026-11-11)

Reviewer OpenAI/Codex gpt-6.1-sol, high effort, reviewed b7045a4c56f896d085e2e1aef79b12ea1cfa6407…3f83ea74a843622a4a815f62ed9c40db040725fe. Complete report `/tmp/save-todays-sol-round-1.md`; root reproduction/fix receipts `/tmp/save-todays-fixes/` and `/tmp/save-todays-root-round-1-fixes.md`. This is the existing whole-feature ledger, not a new task-review loop. Approval remains pending.

- SOL-1: root retained already-enqueued account-bound writes beyond screen disposal, suppressing dead-screen UI; hook cleanup flushes navigation feedback. Real Home unmount with delayed read ACK reproduced dropped Undo, and delayed archive ACK reproduced dropped navigation feedback; both now pass. No durable ordinary-action queue.
- SOL-2: root fenced Home selection synchronously by account, keyed sheets by account, and fenced collection configuration/results. Real private-menu account-switch regression reproduced the leak and passes; delayed collection completion also passes as a supplemental characterization.
- SOL-4: root consumed explicit Save URL route params with clipboard attribution. Actual Home Paste→Save→capture test reproduced the empty field, then passed without another clipboard read/title fetch.
- SOL-5: root routed followed/reshare card and menu Open through generated SharedBookmarksApi and fenced reader identity by slug. Public responses never populate or fall back to private owner caches; owner-only detail/content authorization is unchanged. Four real Home→reader→generated HTTP regressions reproduced owner404, then passed. Failed-public-slug/private-cache regression also passes.
- SOL-6: root enforced the complete serialized UTF-8 500,000-byte budget including envelope, escaping and delivered word count, retaining article order/provenance. Additive TypeSpec optional `truncated` is regenerated; reader explains partial content and opens the original. Real long-word20,000-word HTTP regression reproduced620,120 bytes, then passed;100-sample bounded-case HTTPp95=27.730250ms. Unicode/escaping supported/fallback and block-ceiling cases pass. This implements the existing response cap; it does not claim the omitted source is delivered.
- SOL-3: pending fresh developer correction to the durable capture/confirmation boundary. Latest locally acknowledged capture edits must survive create ACK until reconciliation ACK, safe replay/account switch/kill, and later edits during PATCH; ordinary post-acceptance actions remain immediate with rollback.

Root checks: contract generation/shared build; mobile/API tsc and lint/tokens; mobile focused133; content HTTP13 (short and long20k p95 gates); mapper7 all pass. Full mobile first run:281 passed,1 failed,1 existing skip, at the same Remove/rejected-row assertion retained in round1. Do not call it resolved merely because prior isolated runs pass. Transfer investigation and full green gate to the capture-boundary developer; preserve `/tmp/save-todays-fixes/root-mobile-full.log`. Full package verification and fresh source-bound signed inspections remain before the next review/delivery.

Test-first qualifications: SOL-1's two delayed-ACK variants were added in one red cycle. SOL-2 initially had a router setup failure, then a corrected real clean red (`sol2-red-corrected.log`). Delayed-collection, failed-public-cache, partial-copy and Unicode/block-limit coverage were supplemental tests after their primary behavior's clean red/fix; do not invent independent red cycles. Attempted mobile `typecheck` script does not exist; actual `bunx tsc --noEmit -p apps/mobile/tsconfig.json` passed. Lint passes with existing warnings and the test mock's require-style warning; no handwritten diff whitespace errors. Hook/prototype bytes remain untouched; no push, PR or deployment yet.


### SOL-3 developer handback and coordinator integration (2026-11-11)

Root's SOL-1/2/4/5/6 correction checkpoint is `2accb5951569ec28d3a541635202fd1315a72bf7` (T-1/T-5/T-7/T-8). Fresh capture developer changed only queue/provider and their two tests. `/tmp/SOL-3-handback.md` and `/tmp/sol3-checks/` retain exact proof, fifteen new cases and qualifications. Queue retains a create ACK receipt and latest capture intent through all reconciliation ACKs; confirmation and acceptance/removal share the storage lane. Matching-owner idempotent PATCH replay, latest-field uncertain-create replay, duplicate note/timing precedence, explicit clears, expiry, abort/timeout/auth/429/400/503 behavior pass. Provider removed-ID fence prevents a delayed real storage snapshot from restoring a removed row; synchronous render ownership filtering prevents pre-effect A→B exposure. Ordinary accepted confirmation retains immediate PATCH/rollback.

Actual primary clean red received storage[] while confirmation PATCH was held; actual provider interruption/restart green preserves fields with one create/job. Separate deterministic delayed-snapshot Remove red/green and synchronous owner-render red/green observed. First broad implementation run regressed unchanged private/offline latest-field replay, then corrected against that actual failure. A withdrawn new-test requirement for identical retried POST bytes contradicted T-1 and is not counted as a final red/green success. Supplemental held-PATCH/clear/account/error/expiry cases first ran green and are labelled accordingly. Original timing-sensitive Remove still failed in the first broad run after the deterministic product fence; instrumentation did not prove its exact earlier scheduler state. Final original interaction uses awaited async act while retaining every assertion and default timeout. Treat this as test synchronization, separate from the proven product race, and retain the caveat in review.

Child final mobile297 plus1 existing skip, focused66, tsc/lint/tokens pass. Root independently reran focused66 successfully; cumulative full verification/signed-source inspections follow on the integrated checkpoint. Child did no commits, task/spec/prototype/generated/env/hooks edits, services, devices, DB, subagents or delivery. Round count remains1/max5; all six findings are corrected pending root cumulative gates and fresh round2 verdict. No merge or TestFlight submission yet.


### Independent integrated package verification (2026-11-11)

Integrated SOL-3 checkpoint `1d2118fdaa4f3436a8d235a57b72f0267f89db80` (T-1/T-10), root five-fix checkpoint2accb5951569ec28d3a541635202fd1315a72bf7. Root `/tmp/full-send-round-2/verify.py` completed every command successfully on215 changed source files, manifest79997b9fd9d21e778bb7c9124b77cb2811ce8c0b260b096f60accb601721bcbb. Generation/shared build, all root/shared/API/worker/mobile types, serial uncached backend428shared/383API/10worker, mobile297 plus existing skip, web335, accessibility173, required lint/tokens and API/worker builds pass. Native XCTest29 with the guarded owned loopback fixture passes; fixture cleanly stopped, healthy disposable DB retained. This is simulator/unit capability proof, not the unavailable physical/session matrix.

Root found a deployment-specific integration gap while comparing the actual workflow to the verified test invocation: deploy-backend Run tests omitted COMPOSE_PROJECT_NAME required by the new package fixtures and used strict concurrent Turbo packages sharing TRUNCATE storage. Read-only actual-workflow/Turbo dry-run reproduced the missing setting (strict/nonserial); step now defines cosmic-dolphin and uses --env-mode=loose --concurrency=1. Actual updated backend invocation independently passes428/383/10. The first supplemental dry-run green assertion incorrectly expected loose-mode inherited env to be enumerated in Turbo's JSON; corrected that assertion, not product code, and used real fixtures to prove propagation. No test assertion/skip was removed and no deployment was run. This small coordinator CI fix is included in the same upcoming round2, not a new review ledger.

Final source-bound signed iOS/Android previews remain next. Production public app config is independently matched to the deployed issuer and stable HTTPS API (no tunnel/local origin); remote environment values are unchanged and omitted from public logs. A temporary preview profile may select this existing production environment for capability/source inspection, then must restore eas.json exactly. Internal previews are not TestFlight submissions. All six finding dispositions remain pending fresh cumulative Sol approval; round1/max5 unchanged.


### Fresh signed candidate proof and round2 launch (2026-11-11)

Candidate c1dcb4c672bbd4ad5ceb9d28cca9c9dad318614d, fetched origin/main b7045a4c56f896d085e2e1aef79b12ea1cfa6407 unchanged. Fresh iOS56cf456c-b441-49d1-97d7-baf20099f13e and Androide5221f9a-ec58-4fb0-a270-efe9e883d9d0 FINISHED/internal preview. Source manifest6b5eca324296e3164099885699caa8f1c3a748892b1a4b2d66cb1990c93b1583 covers216 changed files; sealed archive1869files manifestf92bc84bea49d368efa37ead808ae6a289903b748bd32388656a2f248b1eae00. Full archive differs after restoration only at the declared temporary preview eas.json and removed .easignore. EAS_NO_VCS has no cloud gitCommitHash; binding is the observed archive/build flow and exact source-input comparison, not reproducible-build or cloud attestation.

Signed proof handback `/tmp/final-source-preview-handback.md`, reports `/tmp/full-send-round-2/final-proof-summary.json`. Root independently reran both actual artifact inspection helpers: strict iOS app/extension signatures/shared keychain/AppGroups/profile permissions/canonical tokens and Android signature/package/SEND text intent/native bridge, exact stable production public API+issuer+anon and service-role absence all pass. Root IPA SHA72d47152ff3d6c85169ec6b6a21d676f920ccefeb94f32199bdf88b57a9c2673, APKd89eb690f3417df66186115c88cde06367a3d49f7772a37c2a9e4a78ca576044; iOS bundle8a5fcb051d824153b41eff368b6c8c4349233b04cb4bdb9c42fbe90374a81f45, Android bundle7584028e6598ae7e9e8c4028af4fa1fe8026be712a59eee548235a2797b445df. New cap notice/public-slug path/ACK receipt string corroboration passes in both Hermes bundles; strings alone are not runtime/source proof. The initial iOS artifact GET failed without retained status; refreshed metadata/download succeeds, no invented failure code. No unresolved signature/config/source/restore error.

Root rechecked all216 source hashes, preserved hook/prototype bytes, empty index and restored eas.json exact180757aef217d8fa2ad3119facbd8c3625b120f4bcb899752c90029ad5a4a809; no remote environment/credential mutation or TestFlight submission. Source-bound final HTTP fixtures11 pass: picks500-candidate compute/reread21.064375/11.638584ms p95, content20k short words9.010458ms/189010bytes; separate long20k cap regression27.730250ms p95 and<=500000bytes. Healthy disposable DB retained; no owned runtime services/devices. GitHub defaultmain/squash allowed/no rulesets confirmed. Fresh round2 uses same Base and semantic Reviewedc1; this ensuing proof/review bookkeeping commit changes no product behavior. All beta runtime/physical/live-spoken/prior-device limits remain unchecked and authorized for beta validation. No PR/push/merge/deployment yet.


### Round2 SOL-7 account-scoped Save correction (2026-11-11)

Fresh Sol round2 reviewed Baseb7045a4c56f896d085e2e1aef79b12ea1cfa6407…c1dcb4c672bbd4ad5ceb9d28cca9c9dad318614d with metadata-only working7d32550a473b626e5d1b1470263363add09085e7. Reviewer OpenAI/Codex gpt-6.1-sol high; `/tmp/save-todays-sol-round-2.md` and `/tmp/save-todays-sol-round-2-checks/`. All prior six findings explicitly fixed; new Critical SOL-7 reproduces unowned local Save URL/private note under B despite the provider hiding A captures. No source edits by reviewer; root fixes this small finding directly under higher-priority orchestration instructions.

Root split account-owned SaveForm behind a synchronously changed identity/generation key. All draft/confirmation/private metadata/error/busy/timing state resets before B can receive A's form. Explicit Home Paste now carries accountId; Save prefill requires that matching account and the initial generation, discarding stale/legacy unscoped parameters. Live form+identity guards fence submit/finish/error/finally/back effects after identity change or unmount. A's in-flight/durable capture and already-confirmed note remain in the existing account-bound queue; no queue clearing, auth bypass, ordinary action replay queue, contract or server change.

Actual real-root pending-create and accepted-private-request variants failed at A URL visibility after SIGNED_IN(B), then passed; grouped as one account-privacy red cycle (`/tmp/full-send-round-3/sol7-account-red.log`, `sol7-account-green.log`). A separate delayed actual queue-confirmation completion red navigated B to/(tabs), then passed after lifetime/identity guard (`sol7-finish-red.log`, `sol7-finish-green.log`) while A's confirmed private note stayed durable and B's draft remained. Both original reviewer /tmp probes independently rerun green in reviewer-pending-probe-green.log and reviewer-private-probe-green.log. Supplemental route/remount/legacy-param/late-enqueue and accepted-private POST-field assertions are first-green characterizations, not invented red cycles. Final focused44 pass; preliminary full302+one unchanged skip, mobile tsc/lint/tokens pass before the final one-case legacy characterization. Cumulative final-source gates and new signed previews follow before round3; do not relabel the superseded c1 artifacts as final runtime proof.

Root correction touches only Save, Home's Paste ownership parameter and their existing real-root test fixture/cases, plus this metadata. Router mock now returns mutable mockSaveParams for ownership coverage while default{} is retained. Earlier private URL/note/source/ACK/Remove/act timing and withdrawn-test qualifications remain intact. Hooks/prototype unchanged; no PR/push/merge/TestFlight or remote environment mutation. Same ledger2/max5; no fresh round until full/source-signed proof is available.


### Final SOL-7 source proof and round3 request (2026-11-11)

Semantic candidate `5e1c5a9e734e673e5663669e7da9d4a3421e6a21`; freshly fetched origin/main remains `b7045a4c56f896d085e2e1aef79b12ea1cfa6407`. Root complete final Verify all passes: generation/shared build/all explicit types,428shared/383API/10worker,303mobile plus one unchanged skip,335web,173accessibility, required lint/tokens/API+worker builds,29native XCTest and guarded fixture cleanup0. Source-bound numeric HTTP receipts:500-candidate picks compute/reread22.166709/14.852666ms p95;20k-word content9.643ms p95/189010bytes. Initial forced backend had4failed tests/8connection errors after PostgreSQL worker SIGKILL; retained Docker memory.events oom_kill1 establishes local memory kill. Root recreated only disposable5433 DB and reapplied36local migrations/existing max_wal_size128MB, unchanged source/tests; rerun passes. Original results/failures/recovery are preserved under `/tmp/full-send-round-3/`, including after-db-recreate/results.json. This infrastructure failure is not product red or an invented WAL diagnosis.

Updated iOS `993ca705-95d9-4322-89c3-bc216206c33d` and Android `19518fe4-0891-44a6-b0bb-190fa26fcd55` FINISHED/internal preview. Source manifest216rows SHA64a491d0c4f3eeaab16ce7af1bb7263eed0f478f5c49b0af0a1c22dfd0946a83; archive1869files SHAc5b81b73dfefff21501bf57b5ca788d38cfc035bc6335156efee41138c42dd08. Root independently rechecked every source row against committed5e1/current/archive and the complete archive hash. Full archive differs after restoration only at removed temporary.easignore and restored committed eas.json; hooks/prototype preserved/index empty. EAS_NO_VCS cloud commitHash is absent; observed archive/build flow plus exact equality bind inputs, not cloud attestation/reproducible-build proof.

Handback `/tmp/sol7-final-source-preview-handback.md`; summary `/tmp/full-send-round-3/final-proof-summary.json`; root receipt `/tmp/full-send-round-3/root-final-source-proof.json`. Root independently reran actual IPA/APK inspectors: strict iOS app/extension codesign/shared keychain/AppGroups/profile permissions/canonical tokens and Android signature/package/SEND text/native bridge, exact stable production public issuer/API/anon and service-role absence pass. IPA SHAc1f06c5b3f98734c927db5a70bc44edfe9dabfdfcf0a3627a973085977e2637e; APK9b299ddc0cce42b562819fbbdc1adbe3641da2bfc81da7426abdb633c03b1029; iOS Hermes931327c28a30a8b319a2c0014c89ba2d6a0f32b6b65e87818178f76f9a5fe86b; Android Hermesf55186bcb134cff53a9d46540c9c3c80eef5ebd9a6f51993db51fa00d873c7dd. Current accountId/generation/isCurrent/cap/shared-path/ACK bundle markers corroborate inclusion, not runtime correctness. Child additionally observed same compiled SaveScreen property wiring through Hermes disassembly. No beta runtime/physical/spoken/session outcome inferred.

Both platforms initially returned403 twice after metadata refresh, then standard browser-identification downloads returned200; original403 cause unproved. Child retained temporary report-generator quoting/missing-file errors, corrected existing iPhone Distribution identity-label assumption without relaxing signatures/profiles, and lossless Latin1 decoding after disassembly's UTF8 error. All corrections are /tmp tooling, not source/test/security changes. Earlier primary/supplemental/TDD/Remove/withdrawn-retry qualifications remain. Local Bun1.3.13 is not pinned CI1.3.11 proof. No unresolved artifact/config/restore error, remote env/credential mutation, owned services/devices or delivery action.

Fresh round3 uses the same Base and semantic Reviewed5e1; ensuing commit is proof/review metadata only. Complete reviewer brief includes spec/prototype/all ten checkpoint SHAs, ledger/dispositions, SOL7 changes and actual regressions, original failures, current signed proof and beta exceptions. Current final verdict Pending; no PR/push/merge/backend deploy/TestFlight submission yet. After APPROVE, root owns one package PR/live CI/main squash, backend green and production TestFlight under existing user grant.


### Round3 approval and package delivery preparation (2026-11-11)

Fresh whole-feature reviewer OpenAI/Codex gpt-6.1-sol, high effort, returned APPROVE for Base `b7045a4c56f896d085e2e1aef79b12ea1cfa6407` and semantic Reviewed `5e1c5a9e734e673e5663669e7da9d4a3421e6a21`, working metadata-only `6474ec72008cff1dd69faf427bcc28da2fd9cd3d` unchanged throughout. Full report `/tmp/save-todays-sol-round-3.md`; independent receipts `/tmp/save-todays-sol-round-3-checks/`. All SOL-1…7 explicitly fixed; no open Critical/High, dispute, declined criterion or Medium/Low follow-up. Usage unavailable, not guessed. One actual round3: initial unsupported options.effort rejection before execution was corrected to catalog reasoningEffort:high on the same provider/model; not a review or provider change. Ledger3/max5, two rounds remain.

Independent full gates428shared/383API/10worker/303mobile plus unchanged skip/335web/173accessibility/native29 all pass. Reviewer reran both original SOL7 probes and four first-green lifetime/token-refresh/stale-error diagnostics through the actual root/auth/capture/form. Exact TypeSpec/OpenAPI/generated client and shared/API/worker/client CJS/ESM builds reproduced into /tmp and compared; tracked sources/index/hooks unchanged. Fresh source-bound numeric/security/compatibility/rollback/metric HTTP fixtures pass: picks compute/reread21.098541/12.760542ms p95, short20kcontent10.226750ms/189010bytes, long20kHTTP30.025833ms and <=500000bytes. Actual current signed IPA/APK inspectors, supplemental decompressed secret-absence/capability checks and source/archive identity pass. Current metadata-only tasks difference is permitted and disclosed. Native fixture stopped/cleanup0; healthy disposableDB retained.

Root freshly fetched target remainsb704, no package PR exists, working product tree equals semantic5e1. Current GitHubmain unprotected404, squashallowed; live checks/reviews/mergeability still required. This ensuing approval-record commit contains only task/proof metadata. Proceed to push feature branch, create one non-draft complete package PR, link it immediately, inspect live mobile/Accessibility checks and reviews, and merge only after current gates. Then observe backend tests/migrations/API+worker green before production TestFlight dispatch. All original failure/TDD/tooling/Bun-version qualifications and unchecked beta/operator proof remain intact; no deployment/submission yet.

### PR250 cold-root test synchronization and round4 request (2026-11-11)

Mobile PR gate failed twice on unchanged2c393ec: only cold root Save findByLabelText(Link) timed out (302other tests pass/unchangedskip); both failure snapshots contain the Link field. Accessibility passed. First uncached isolated local run passed; failed-job retry still failed, so no further blind retries. Original live logs `/tmp/pr250-ci/mobile-first-failure.log` and mobile-second-failure.log retained. Root applied diagnosing-bugs: `/tmp/pr250-ci/cold-start-repro.test.tsx` copies the actual RootLayout/AuthProvider/CaptureProvider/Save test fixture and injects a1200ms synchronous first-screen-load delay without altering queries/default timeouts/acceptance assertions. The exact Link-query failure reproduces twice in cold-start-repro-red.log and cold-start-repro-red-repeat.log, with field visible in failure tree. This demonstrates the timer/cold-bootstrap mechanism; original GitHub import duration was not directly measured and is not invented.

Ranked predictions: (1) query timer starts while async auth opens the cold screen; flushing bootstrap before query should fix with identical timeout/assertions; (2) actual auth/form loss would persist after flush; (3) inaccessible query would still fail after settled render. First attempted outer async-act(render) caused a separate concurrent-renderer .root access error before the test scenario, retained cold-start-repro-green.log; not product red. Correct render then awaited async-act flush passes cold-start-flush-green.log with same1200ms delay/default query and complete original durable interruption/replay assertions. Root changed only two lines in existing cold-root test: comment plus `await act(async () => {})` after render, before field query. No app/native/server/contract/workflow code, wait timeout, assertion or skip changed. Tests remain cold; deferred auth and screen imports finish before field polling begins. No debug instrumentation added to repository.

Root full mobile303pass+one unchangedskip, mobile tsc/lint/tokens pass (`/tmp/pr250-ci/mobile-full-after-flush.log`, mobile-types.log, mobile-lint.log). Existing app/runtime source and signed artifact5e1 proof are byte-identical; no new EAS build needed for test-only synchronization. Prior generation/backend428/383/10/web335/accessibility173/native29/numeric/security/compatibility proof applies to unchanged implementation; original failures/TDD/infra/tooling/beta qualifications retained. Same Baseb704, same one package PR250, persistent watch active, not rearmed. Fresh Sol round4 of same max5 ledger requested before committing a push; current live CI remains failed, merge held. Test-only fix is root-owned under higher-priority small-review-finding rules. Round4 may inspect/reproduce real test-synchronization and assert preservation without substituting unavailable native/beta proof.


## Delivery

**Approval provenance.** Paulo approved the written spec/prototype on2026-11-10 (“approved”) and authorized breakdown with “go ahead” after the announced next step. Spec semantic revision at approval: sha256:d7937c2ff3f1fa7544afc708123bf28fddf6aa57c9a8c386f743731bcaa9bf9e. Preapproval final council text sha256:5d8aad1b02f7db5d66e10bd53317fe0e2e556335185d922a2b1042e3d3d68f99; prototype75906f1a46dfb19ca0272d0a785da06c3afd59686f3028835ed6d6fe9eee378f. Cleanup only folds provenance/validation and removes scratch links; approved behavior remains unchanged. Paulo approved this exact ten-task plan on 2026-11-10 with “approved”; the pre-metadata draft hash is sha256:74aa524138d7de738c082b421284573920f4f27593f71fb73ca5e947f33de25b. Approval accepts scope, sequence and checks. Implementation assigned by user “go ahead with the implementation” on 2026-11-10; merge remains unassigned.

| Repo | PR | Head SHA | Base SHA | State | Proof / decisions | Merge SHA |
|---|---|---|---|---|---|---|
| cosmic-dolphin | https://github.com/pffreitas/cosmic-dolphin/pull/250 | 2c393ec9ef3213ef6ed543a10773f1c44a56f8fb | b7045a4c56f896d085e2e1aef79b12ea1cfa6407 | Waiting | Sol round3 APPROVE for semantic5e1; final pushed head adds only proof metadata. Both live Mobile PR/Accessibility jobs running; no reviews/comments/threads. Main merge authorized after live gate, backend green before TestFlight. | |

States: Not started, Implementing, Reviewing, Waiting, Ready, Blocked, Merged. Ready leaves the PR open. Plan approval alone does not grant merge; the2026-11-11 full-send instruction above now does.

## Rollout

Operator steps, not implementation dependencies. Owner Paulo Freitas coordinates Architect/PM. T-10's branch previews and all checks occur before review/PR; postmerge actions do not substitute for them.

- **R-1** · Before release: PM with Paulo snapshots G-1/G-4 eight-week baseline, confirms A-1 internal audience and previous TestFlight build/EAS id; Architect confirms candidate keychain capability/device evidence. Queries use spec§8.8 exact denominators. Complete before any release; it does not require this package to deploy.
- **R-2** · After authorized whole-package squash merge: Architect verifies deploy-backend tests, supabase migration and API/worker green; observe deploy-mobile internal quality/build and web rebuild. Old/internal mobile handles picks load failure. Hold TestFlight submission until backend succeeds.
- **R-3** · TestFlight: Paulo manually dispatches deploy-mobile destination=testflight after R-2; confirm processed build and primary outcome on deployed services. No new public App Store rollout is included.
- **R-4** · Measurements: PM runs weekly read-only G-1…6 queries, evaluates4releaseweeks against8baselineweeks; G-1+50% relative, G-2≥1.5 done per eligible-pick day, G-3≥40%iOS extension saves, G-4 no worse than−10%, G-5≤20%rejected original slots, G-6zero lost. Flat G-1 after4weeks revisits picks before backlog3–5.
- **R-5** · Deferred observations: Architect evaluates DOC-1 picks_ms at7days; >800ms invokes accepted index/cap300 rule through an authorized follow-up change/package. PM checks DOC-2 queue age>86400/tester failed rows at7and28days; any counts lost until explained and blocks wider rollout. Do not mark future observations completed at launch.
- **R-6** · Rollback if needed: Paulo/Architect revert backend commit leaving additive migrations unused, restore previous TestFlight build or dispatch known ios_build_id, revoke all share-key rows so extensions queue. Verify captures retained. Preserve incident/candidate evidence; rollback execution is a human operator decision.

## Coverage

Every §5 requirement and original acceptance criterion maps below. Rows for other sections are aliases of their owning capability; N/A/static state cells require no additional implementation. Base reuse (Continue/Library/reading/refile/social privacy) is regression-tested, not marked as new work shipped.

| Spec item | Task(s) |
|---|---|

| FR-1 | T-3 |
| FR-1 AC1 | T-3 |
| FR-2 | T-3 |
| FR-2 AC1 | T-3 |
| FR-3 | T-4 |
| FR-3 AC1 | T-4 |
| FR-4 | T-1 |
| FR-4 AC1 | T-1 |
| FR-5 | T-1 |
| FR-5 AC1 | T-1 |
| FR-6 | T-1, T-6, T-9 |
| FR-6 AC1 | T-1, T-6, T-9 |
| FR-7 | T-6 |
| FR-7 AC1 | T-6 |
| FR-8 | T-6 |
| FR-8 AC1 | T-6 |
| FR-9 | T-6 |
| FR-9 AC1 | T-6 |
| FR-10 | T-7 |
| FR-10 AC1 | T-7 |
| FR-11 | T-7 |
| FR-11 AC1 | T-7 |
| FR-12 | T-7 |
| FR-12 AC1 | T-7 |
| FR-13 | T-7 |
| FR-13 AC1 | T-7 |
| FR-14 | T-6 |
| FR-14 AC1 | T-6 |
| FR-15 | T-6 |
| FR-15 AC1 | T-6 |
| FR-16 | T-6 |
| FR-16 AC1 | T-6 |
| FR-17 | T-5 |
| FR-18 | T-8 |
| FR-18 AC1 | T-8 |
| FR-19 | T-8, T-1 |
| FR-20 | T-8 |
| FR-20 AC1 | T-8 |
| FR-21 | T-8 |
| FR-21 AC1 | T-8 |
| FR-22 | T-9 |
| FR-22 AC1 | T-9 |
| FR-23 | T-9 |
| FR-23 AC1 | T-9 |
| FR-24 (retired alias of FR-22) | T-9 |
| FR-25 | T-6 |
| FR-25 AC1 | T-6 |
| FR-26 | T-1, T-3, T-4 |
| FR-26 AC1 | T-1, T-3, T-4 |
| FR-27 | T-1, T-3, T-4 |
| FR-27 AC1 | T-1, T-3, T-4 |
| FR-28 | T-5 |
| FR-28 AC1 | T-5 |
| FR-29 | T-6 |
| FR-29 AC1 | T-6 |
| FR-30 | T-6 |
| FR-30 AC1 | T-6 |
| NFR-1 status/8s queue/device latency | T-3, T-10 |
| NFR-2 picks budgets | T-6, T-10 |
| NFR-3 content budgets | T-8, T-10 |
| NFR-4 persisted capture/replay/zero loss | T-1, T-3, T-4, T-10, R-5 |
| NFR-5 concurrent dedupe | T-1, T-2, T-10 |
| NFR-6 optimistic8s/revert | T-1, T-7, T-8, T-9, T-10 |
| NFR-7 contrast | T-5, T-10 |
| NFR-8 buttons/SR actions | T-7, T-10 |
| NFR-9 key authorization/privacy | T-2, T-3, T-9, T-10 |
| NFR-10 old JWT/web/mobile and public fields | T-1, T-2, T-6, T-8, T-9, T-10 |
| S-1 For you × default/loading/empty/error/offline/success | T-1, T-6, T-7, T-9 |
| S-1 Following/Unread × default/loading/empty/error/offline | T-6, T-7 |
| S-2 × first run/no eligible/computed empty/paste/offline/pending | T-1, T-6 |
| S-3 × ownership/options/error/offline/Undo | T-7, T-8 |
| S-4 × four computed options/error/offline/Undo | T-7 |
| S-5 × default/busy/no URL/invalid/offline/confirmation/private | T-1 |
| S-7 × Saving/Saved/Already saved/queued/no URL/full/Close | T-3 |
| S-11 × Brief/loading/phases/error/cached/offline/Done | T-8, T-9 |
| S-12 × options/skeleton/Inbox/error/offline/Undo | T-8 |
| S-15 × existing/busy/revocationerror/offline/signedout | T-2, T-5 |
| S-16 × reasons/recovery/error/offline/pending/brief | T-9 |
| S-18 ×8s Undo/statusexpiry/revert/reduce motion | T-7, T-8 |
| S-20 × S-7 states/signedout/offline/success/return | T-4 |
| S-21 × validation/busy/retainederror/offline/pending/pasted | T-9 |
| S-22 × edit/clear/boundary/error/offline/success | T-8 |
| S-23 × retained/400failed/Retry/Remove/pending | T-1 |
| §7 Copy failed reasons7codes/no-code/empty summary claim | T-9 |
| §7 Copy share/save/no URL/full/invalid statuses | T-1, T-3, T-4 |
| §7 Copy picks/progress/all done/caught-up/first/no-visible/no-eligible/read-when | T-1, T-6, T-8 |
| §7 Copy Read no content/Original and all toasts/Done wording | T-7, T-8 |
| §7 Clipboard15.x/16+ explicit native tap | T-1, T-10 |
| §7 Share screen-reader no auto-close | T-3, T-4, T-10 |
| §7 Own cards visible/SR actions/results | T-7, T-10 |
| §7 Undo expiry/status retained | T-7, T-10 |
| §7 Reduce motion all4 prohibited motions | T-3, T-5, T-7, T-10 |
| §7 Dynamic Type uncapped content/label1.3x/growing rows/wrappingbar/AX3/200% | T-1, T-5, T-8, T-10 |
| §7 Components FeedCard/TodayProgress | T-6 |
| §7 Components SwipeableCard/Toast/Button detail | T-5, T-7 |
| §7 Components PendingPhases/CaptureStatus/title1/Signal | T-1, T-5, T-8 |
| §7 Flows/deep links/oldreader/profiletab redirects/standalone visual states | T-5, T-6, T-8, T-10 |
| §8.3 apps/api new routes/create/update/public serializers | T-1, T-2, T-6, T-8, T-9 |
| §8.3 ranker snooze exclusion/scoring | T-6 |
| §8.3 processor classification/blank/stop | T-9 |
| §8.3 iOS rewrite/keychain/disableIOS | T-2, T-3 |
| §8.3 Android | T-4 |
| §8.3 Home finite feed/pending/pick filtering | T-6 |
| §8.3 routing | T-5, T-8 |
| §8.3 CI mobile-pr.yml | T-10 |
| §8.4 bookmarks columns/index/owner additions/capture enums/public stripping | T-1, T-9 |
| §8.4 daily_picks schema/PK/RLS/cascade | T-6 |
| §8.4 share_keys schema/hash/activeunique/RLS/cascade | T-2 |
| §8.4 Writes create/privatevalidation/PATCH/atomicconfirmation/duplicateprecedence/timebounds/reshare | T-1, T-7, T-8 |
| §8.4 Picks route/response/postgreszone/compute/eligible/selection/visibility/revealsAt | T-6 |
| §8.4 Share key issue/rotation/revoke/POSTallowlist/minimalresponse | T-2 |
| §8.4 iOS keychain group/service/account/accessibility/payload | T-2, T-3 |
| §8.4 iOS appgroup filename/200/lock/tempflush/atomicreplace/snapshot/import/remove | T-3 |
| §8.4 appqueue serialized/durable/matching/triggers/privatefields/expiredlater/importidattribution | T-1, T-3, T-4 |
| §8.4 Android firstURL/noTap/1.5s/exit | T-4 |
| §8.4 Content GET/blocks/limits/provenance/owner404 | T-8 |
| §8.4 Content PUT/escape/metadata/pgmq/fullreprocess | T-9 |
| §8.4 failure enum/mapping/clearonstart | T-9 |
| §8.4 Tokens all6lightdarkpairs/validation/alias/mobileonly | T-5 |
| §8.6 Duplicate URL | T-1, T-2 |
| §8.6 Sign-out revocation failed | T-2 |
| §8.6 Share token missing or revoked/Share offline/Rate limited429 | T-2, T-3 |
| §8.6 Replay429/Save request failed | T-1, T-3 |
| §8.6 NohttpURL/appgroupfull | T-3 |
| §8.6 Android signedout | T-4 |
| §8.6 Timezone/0eligible/before06/storedempty | T-6 |
| §8.6 savedprocessingaftercompute/Tonightreveals/snooze≥refresh/archive/delete/rejection | T-6, T-7, T-9 |
| §8.6 NotformeUndo/Actionwhileoffline/nonowncard | T-7, T-8 |
| §8.6 Picksrequestfails | T-6 |
| §8.6 fetchfailure/unusable/pastebounds/private/unusable | T-9 |
| §8.6 Private description never fetch | T-1, T-8, T-9 |
| §8.6 Content404/offline/oldhighlights/progress | T-8 |
| §8.7 POST-only key/minimalleak/keychainTHISDEVICEONLY/appgroup metadata/privatefields/pasteuntrusted | T-1, T-2, T-3, T-9, T-10 |
| §8.8 Picks computed/served allfields | T-6 |
| §8.8 Bookmark created attribution/queueage/alreadysaved | T-1, T-3 |
| §8.8 Key issued/revoked/rejected ids only | T-2 |
| §8.8 Processing failure classified | T-9 |
| §8.8 no key/note log text | T-1, T-2, T-9, T-10 |
| G-1…6 / §8.8 queries/denominators/baseline/loss/flatresponse | T-10, R-1, R-4, R-5 |
| §8.9 singlepackage/squash/PRchecks/premerge/contract/device/capability | T-10; protocol wholepackage gate |
| §8.9 migration/backend/web/internal/TestFlight order | R-2, R-3 |
| §8.9 rollback backend/schema/mobile/allkeys | T-10, R-6 |
| §8.10 shared/API/contracts/mobile/tokens/device proof rows | T-1…T-10 |
| §9 keychain/profile risk | T-2, T-3, T-10 |
| §9 cleanprebuild risk | T-3 |
| §9 postmergebackendfailure risk | T-6, T-10, R-2 |
| §9 readable-page misclassification risk | T-9, R-4 |
| A-1 audience/compatibility fallback | T-10, R-1 |
| A-2 keychain/profile capability/bridge fallback | T-2, T-3, T-10 |
| A-3 HermesIANA/localization fallback | T-6, T-10 |
| A-4 exitApp/moveTaskToBack fallback | T-4, T-10 |
| A-7 retired Paste assumption | T-1 (replacement §7 rule) |
| DOC-1 7day picks_ms/800ms/indexorcap300 | R-5 |
| DOC-2 7/28day queueage/testerfailedrows/blockwiderrollout | R-5 |
| §10 D-1…23 accepted decisions/scope/non-goals | T-1…T-10; Authorization and protocol; retained BACKLOG.md |

## Spec gaps and breakdown decisions

No unanswered implementation decision; all accepted deferred checks retain chosen rules/owner/trigger/failure action in spec§11. These are evidence or grouping decisions, not new requirements.

| ID | Gap or decision | Resolution | Decided by |
|---|---|---|---|
| B-1 | Which approved spec/phase/location | Save + Today’s5, standard spec-child tasks.md; user go ahead authorized breakdown only | Paulo,2026-11-10 approval/go ahead following Next step: task breakdown |
| B-2 | Release unit and merge scope | Carry D-13: one complete squash PR to main; no flag/per-task release/merge grant | Paulo, approved spec§8.9/D-13 |
| B-3 | Capture/key/readiness choices | Carry D-21 and RY1–4: save-only key, required private description, all consumer compiles, supported15.x native Paste, future≤60days Later | Approved spec§8.4/7/11 and final Architect readiness |
| B-4 | Main drift/delivery facts | Current GitHub/local main b7045a4c56f896d085e2e1aef79b12ea1cfa6407; no touched-path drift; unprotected404, squash allowed | Read-only gh/git checks2026-11-10 |
| B-5 | Real test runners/baseline | Bun API/worker, Jest30 shared/Jest29 mobile; token check passed, full runners unavailable without deps. Execution must establish green starting target before feature work | Package scripts and command output2026-11-10; breakdown owner |
| B-6 | Task count/lanes | Ten coherent outcomes, all overlapping shared contexts serialized; native key/iOS/Android risk early, no same-package rollout dependency | Breakdown owner within approved scope; consolidation pass |
| B-7 | Cleanup and durable backlog | Remove owned scratch/captures/old source prototype, preserve explicit user-requested BACKLOG.md and pre-existing hooks/source references | Paulo's durable backlog request takes precedence over skill default keep list |
| B-8 | Commit generated client versus stale CI comment | Tracked src models/docs are regenerated and committed; never manually edit or force-add unrelated generated output | git ls-files/.gitignore evidence2026-11-10 |
| B-10 | Native pre-PR reachability | Branch API/worker and loopback disposable DB paired with EAS via temporary HTTPS tunnel; normal auth issuer, fictional local fixtures, no production business writes/package deploy | Breakdown owner, existing env/auth configuration and accepted §8.9 branch-preview proof |
| B-9 | Deferred checks | A1–4 have premerge probes/fallbacks; DOC1–2 operational postrelease measurements remain R-5, no implementation question deferred | Approved spec§11; PM/Architect owners |

**Planning verification.** Initial prototype29checks plus20closure assertions passed offline with no runtime errors, both modes,200%text and320/390/768px. PM/Architect/Designer approved final spec/prototype; independent simplifier/editor finished; native/backend/assistive technology evidence remains explicitly required during implementation. Structural checker:10tasks,0errors,0warnings. Fresh developer review covered T-1/T-2/T-6/T-10 and integration boundaries; localized findings resolved: checkpoint-vs-package AC ownership, native branch backend recipe, missing shared verification, real feed snooze proof and PR-only CI timing. Nullable legacy source versus new-mobile attribution is explicit. No safe wholesale consolidation was identified; no implementation proof is claimed.


**Cleanup verification (2026-11-10).** Reconciled and removed owned session scratch files, screenshots/assets/review notes/downloaded test runner and the superseded generated mobile-redesign.html. Retained only the authoritative spec, this task plan and approved standalone prototype, plus explicitly user-requested durable BACKLOG.md. Pre-existing hooks/source references untouched. Prototype hash unchanged;10 post-deletion assertions reached successful completion: scratch/source absent, hash, Home, embedded offline assets, bookmark, Save, iOS15 Paste fallback, failure recovery, zero runtime errors. The runner failed during browser shutdown after its package was removed; subsequent inspection confirmed no spawned browser or new temporary directories remained. Final structural checker:10tasks,0errors,0warnings; retained links resolve. These are planning/prototype checks, not native/backend implementation proof.

**Execution setup (2026-11-10).** `feature/save-and-todays-5` starts from fetched origin/main b7045a4c56f896d085e2e1aef79b12ea1cfa6407 in this thread’s existing isolated worktree. The two pre-existing untracked hook files remain excluded. Supporting sol-loop/file-pr/babysit-pr/leaving-pr-comments resolved; authenticated GitHub and latest catalog Sol gpt-6.1-sol confirmed. Starting checks pending normal Bun installation/generation; no product task started.

**Starting-baseline results (2026-11-10, product tree b7045a4c56f896d085e2e1aef79b12ea1cfa6407).** Bun frozen install and apispec pipeline passed with no tracked generation/lock drift. Shared build, root web typecheck and explicit API/worker/shared/mobile tsc passed. Backend test:db passed (shared391, worker10; API suite green). Web335 tests passed. Mobile48 passed/1existing skip after the initial concurrent cold-run bookmark waitFor timeout; isolated bookmark9tests and full mobile rerun passed without code/test changes. Mobile/web lint pass with existing5/112 warnings, both token checks pass. No existing check was weakened or skipped. Expo CLI whoami authenticated; local iOS/Android device tools available. Restored ignored environment files from main checkout via repo's documented worktree setup convention; never log secrets or point tests at hosted data. Existing stopped repository disposable DB was restarted under COMPOSE_PROJECT_NAME=cosmic-dolphin; unused network from initial worktree-name collision removed. All future backend verify commands set DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test and COMPOSE_PROJECT_NAME=cosmic-dolphin explicitly now that .env is restored. Execute DB suites serially. Physical-phone LTE proof remains required later; current listed devices are simulators.

Full-send pre-review verification2026-11-11: fetched target remainsb7045a4c56f896d085e2e1aef79b12ea1cfa6407/main; no existing package PR. Final candidate generation/shared build/all explicit types/forced serial backend shared426/API380/worker10/mobile271+existing skip/web335/Accessibility173/lint/tokens/API+worker builds all pass in `/tmp/full-send-checks/`. The product sources are the verified T1–10 tree; imported T10 code is unchanged from its verified WIP. Production EAS issuer matches the actual deployed GitHub SUPABASE_URL (different from the local fixture issuer); masked production anon values are not inferred from CLI output. Use the production TestFlight profile and deployed API, never the temporary tunnel preview. Current default branch main has no branch protection; still require both live PR quality gates and cumulative Sol approval. User explicitly grants merge and manual TestFlight after backend green; all unproved native/session outcomes remain beta-validation items.


Delivery update2026-11-11: pushed only feature/save-and-todays-5, final head2c393ec9ef3213ef6ed543a10773f1c44a56f8fb; one non-draft package PR250 created/linked immediately. Live PR OPEN/MERGEABLE/UNSTABLE while Mobile lint, types and Jest and Accessibility Rule ten run, no reviews/comments/unresolved threads; rulesets[] and main protection404. Root owns persistent PR watch, no bypass/merge/deploy yet. This local delivery record is not an extra push and does not change the reviewed product tree.


PR250 first live CI2026-11-11: Accessibility Rule ten passed on2c393ec; Mobile lint/types passed but full Jest had one failure/302pass+unchangedskip. Cold root Save findByLabelText(Link) timed out; failure snapshot includes the Link field. Full original log retained `/tmp/pr250-ci/mobile-first-failure.log`. Root unchanged uncached isolated command `bun run --cwd apps/mobile test -- --ci --runInBand --no-cache --testPathPattern=save-durable --testNamePattern='cold root Save'` passes, log `/tmp/pr250-cold-save-check.log`. No source/test/assertion/timeout change; exact original CI scheduler/cold-import cause unproved. Root reran only failed live job once (`gh run rerun 43060513003 --failed`) on unchanged head, existing watch retained. Merge held pending live result; ledger stays3/max5 APPROVE for unchanged semantic5e1.
