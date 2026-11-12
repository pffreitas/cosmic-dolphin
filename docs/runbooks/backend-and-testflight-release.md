# Backend and TestFlight release

Use this runbook for an authorized release of this monorepo. It records the release boundaries exposed by [Save + Today's 5](../retrospectives/2026-11-12-save-and-todays-5.md). Inspect the current workflows and CLI help before using commands; versions and interfaces can change.

## Establish the candidate

Read the feature spec and task record. Record the user grant, intended audience, branch, original base, reviewed SHA, final PR head, review ledger and remaining proof. Preserve existing work and hooks. In this repository the default/deploy branch is `main`, even when a request calls it “master.”

Resolve physical-device, normal-session and live accessibility availability early. Fixtures, simulators and signed capability inspection can advance implementation, but do not prove those outcomes. Record any user-authorized beta exception precisely; do not carry it into a later release as a standing waiver.

Preflight the *release path* before the final review: fresh-checkout generated inputs, full backend compiler inputs, Docker workspaces, migration CLI/config/target compatibility, native signing, production public configuration and existing submission credentials. A green PR workflow may not exercise any deployment job.

## Prove backend inputs and tests

From the repository root, with the tested Bun version in `package.json` and the workflows:

```bash
bun install --frozen-lockfile
bun run apispec:compile
bun run apispec:build
bun run --cwd packages/shared build
bun run --cwd apps/api build
bun run --cwd apps/worker build
```

Run the complete `bun run apispec` pipeline when TypeSpec changes. It requires the generator's Java dependency. Compare generated output with the candidate; never repair generated client files by hand.

`bun install` is insufficient proof: root `postinstall` catches a failed client build. Contract tests also read compiled OpenAPI, which can be missing on a fresh runner. The API's full TypeScript build includes tests importing the generated client. Its Dockerfile must include the client manifest/source and explicitly build it; removing tests or narrowing compilation conceals the missing workspace.

Use only the disposable local database. Coordinate its ownership before reset or teardown:

```bash
COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:up
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:reset
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run test:backend -- --env-mode=loose --concurrency=1 --force
```

Shared/API/worker tests truncate the same database. Run them serially, without native/API fixtures using it. Explicit local environment values avoid inherited production settings and Turbo environment filtering. A local SQL connection does not redirect Supabase SDK/pgmq RPCs; a local worker proof must isolate those separately. Never change production auth or queue code to make a fixture pass.

`db:test:down` discards the database. Use it only when no other task owns a fixture or test session. Investigate memory/disk/kernel evidence before attributing a killed Postgres process to WAL, a particular test or a Bun version.

## Build Linux images without disturbing other work

Inventory Docker context, VM resources and running containers first. A shared 2 GB VM killed compiler processes and four existing database containers during this release. Do not retry heavy builds there or stop other containers to make room.

On a Mac using Colima, a separately owned profile is one option. Choose resources supported by the host; the successful proof used 8 GB and 4 CPUs:

```bash
colima start --profile cosmic-dolphin-build-proof --memory 8 --cpu 4 --activate=false
docker --context colima-cosmic-dolphin-build-proof build --platform linux/amd64 -f apps/api/Dockerfile -t cosmic-dolphin-api-proof .
docker --context colima-cosmic-dolphin-build-proof build --platform linux/amd64 -f apps/worker/Dockerfile -t cosmic-dolphin-worker-proof .
```

Use a clean tracked-source context for release proof; exclude `.env`, local dependencies and stale build output. Inspect [.dockerignore](../../.dockerignore) and image inputs. Bind source identity to the result, not just an image tag. Local emulation/Rosetta builds do not prove native cloud performance.

Inspect required dependency artifacts when install scripts are skipped. In the current API image, shared/client/API builds are explicit; worker installation has different lifecycle requirements. Smoke the actual API startup and generated-client import with fictional environment values and no business-network access. Verify the packaged worker browser under the workflow's memory limit.

Colima may not share host `/tmp` mount paths. Copy a fixture using `docker cp` or stdin rather than treating a missing mount as an app failure. Remove only owned containers, then stop only the owned proof profile. Preserve the default context. If an incident affects existing services, report it and restore their prior state within authorization; successful readiness checks do not prove preservation of interrupted transactions.

## Merge and verify production backend

Complete the plan's required review and local checks before pushing. Keep one bounded review ledger across feature and release fixes. Plan room for deployment corrections; do not silently reset an exhausted budget. Current user authorization governs any exception.

In T3, link each PR immediately after creation/takeover/push. Handle existing feedback, then use the PR watcher and end the turn while waiting. On a wake, verify the exact live head/base, required checks/reviews, unresolved threads and mergeability. Fetch the base immediately before an authorized merge; use the allowed merge method and a head guard, without protection bypass. Stop the watch before handback. Do not reopen merged PRs or push to `main` merely to publish bookkeeping.

After merge, compare the merged tree with the final reviewed PR tree. Locate the new backend run for the **exact merged SHA**. Do not confuse an older failed or queued run with the current release. `gh run watch <run-id> --exit-status` can wait for a workflow; PR waits still use T3's PR watcher.

Verify each required stage in [.github/workflows/deploy-backend.yml](../../.github/workflows/deploy-backend.yml):

| Stage | Required evidence |
| --- | --- |
| Build/tests | Completed backend build-and-test job, with required tests passing |
| Migrations | Successful linked production migration push, or “already up to date” |
| API | Actual image build/push and App Platform deployment success/ACTIVE |
| Worker | Image build/push, packaged extraction, deployment `--wait` and an actual bookmarks queue startup/processing log |

Worker markers must come from runtime output, not the workflow's echoed grep command. A failed migration or skipped deploy leaves the backend gate closed even when tests pass.

The workflow pins Supabase CLI **2.122.1**. CLI 3 rejected `[inbucket]` and changed the default `db push` target. A section rename alone was insufficient compatibility proof. Upgrade CLI/config/target semantics together with disposable checks and review. Root `bun run db:migrate` is unpinned and targets the linked project; use the tested authorized workflow for this release path.

For a genuinely stuck Actions run, inspect its exact head, jobs, concurrency, workflow state and service status. Record cancellation responses accurately. A “cannot cancel” response is not successful cancellation. Do not create repeated replacement runs; any authorized recovery dispatch must be singular and identified.

## Submit production iOS once

After the required backend gate is green and the production head still matches the candidate:

```bash
gh workflow run deploy-mobile.yml --repo pffreitas/cosmic-dolphin --ref main -f destination=testflight
```

Record the returned GitHub run ID. The workflow requires Expo authentication, signing/submission credentials and the production public API/issuer/anon configuration. Never print service-role keys or signing credentials. Verify native targets/entitlements/configuration against the signed artifact; committed native projects make `app.json` changes alone insufficient proof.

The production profile increments the build number and schedules automatic submission. Internal previews are a different distribution. Do not submit one or dispatch another build just because Apple's processing is unfinished.

If **submission failed after a valid production build finished**, resolve the recorded credential/submission issue, verify that exact build and use the existing-build input within the release grant:

```bash
gh workflow run deploy-mobile.yml --repo pffreitas/cosmic-dolphin --ref main -f destination=testflight -f ios_build_id=<verified-production-build-uuid>
```

This retries submission without building again. Do not use it for an already-finished submission or an unrelated/internal build.

## Verify actual TestFlight availability

Run EAS reads from `apps/mobile`, using the installed/tested CLI:

```bash
bunx eas-cli build:view <build-id> --json
bunx eas-cli submit:view <submission-id> --json
bunx eas-cli submit:status -p ios -e production --json --non-interactive
```

Match exact build/submission IDs, commit, STORE distribution, bundle, app version and build number. Submission `FINISHED` proves completed upload; Apple processing and beta-group assignment are later stages.

If the read-only status command cannot resolve multiple native schemes/targets, first verify the host bundle in the native project and production build. The tested EAS CLI supports this scoped lookup:

```bash
EAS_DANGEROUS_OVERRIDE_IOS_BUNDLE_IDENTIFIER=com.cosmicdolphin.app bunx eas-cli submit:status -p ios -e production --json --non-interactive
```

Use this override **only for this read-only lookup**, never for building or submitting another identity. The existing EAS credentials service/account key resolved ASC access; no new Apple login was needed. If no authorized key is available, use the harness's secret flow and report the precise verification gap without exposing credentials.

For `MISSING_EXPORT_COMPLIANCE`, inspect the app's existing declaration and actual encryption usage. This release already declared `ITSAppUsesNonExemptEncryption: false` in `app.json`, but the committed native host plist did not contain it. The authorized release applied that same declaration to the exact uploaded ASC build. Do not automatically answer false for a new app or changed encryption; resolve the declaration with its owner when needed. Rebuilding was unnecessary.

Require Apple `processingState: VALID`, an unexpired build, internal `IN_BETA_TESTING` (or the appropriate intended-audience state) and actual assignment to the intended group. The existing internal all-builds **Beta** group picked up build 15 automatically after compliance cleared. Check before adding groups, testers or links; finishing a release does not authorize expanding its audience. Internal availability does not imply external Beta App Review approval or public App Store release.

## Hand back a durable result

Report version/build, intended audience, merged head, backend result and exact Apple state. Keep the current release summary easy to find in the task record. Commit useful sanitized lessons/run IDs/links when documentation work is authorized; retain private raw receipts outside the repo with unique stage filenames and restrictive permissions. Do not overwrite a “before” receipt with a final read.

Keep failed attempts and proof limits. Outstanding normal-session, physical-radio, live spoken accessibility, device installation and future metric observations remain explicit. Successful delivery is not proof that the product's reading/conversion goals improved.
