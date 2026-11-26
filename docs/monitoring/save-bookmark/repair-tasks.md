# Bookmark queue wake-up repair

Current outcome: implemented and Sol-approved; complete Linux backend suite and clean API/worker image/browser gates passed. Production is still on the old worker. Next gate: independent PR shipping verification and CI before merge, then the exact backend deployment and original-save progress. Owner: root. Blocker: none observed; release evidence remains pending.

## Authorized scope and starting state

The user authorized moving ahead with the fix after the [incident diagnosis](production-incident-2026-11-25.md) and default/digest queue audit. Release scope is the missing dispatcher wake-up and changing the production consumer list from `default,bookmarks` to `bookmarks`. No queue is dropped, no messages are manually replayed or deleted, and digest consumption remains off while its 116-job backlog and product flow await a separate decision.

Starting branch `record-production-log-activation` was clean at `6fcd8f6a7baa53a651b3a6984830e7262d3fe834`, four unpublished documentation commits ahead and two homepage commits behind main. Those documentation commits were preserved on `fix-bookmark-queue-wakeup`, based on fetched main `4c8d362f18b8e495a6ffe33d103f77c32554dda6`; documentation-only candidate before implementation is `89777f9836148d727397b89305a866a55a130adc`. The original branch remains available.

## Behavior and regression evidence

After a queue read releases its reserved slots, the dispatcher now wakes loops waiting for capacity. Tests run the real dispatcher with held transport and handler acknowledgements: empty and failed first reads must unblock bookmarks; a partial batch must share unused slots; a full batch must wait for handler completion and stay within concurrency five.

- Baseline existing dispatcher suite: 23 passed, 45 assertions.
- Test-first tracer on original source: failed, bookmark never read.
- Repaired dispatcher suite: 27 passed, 72 assertions.
- Mutation removing only the wake-up line: empty, failed, and partial-batch cases fail; full-batch case passes through the existing handler-completion wake-up. Restored source: all 27 pass.
- Frozen dependency install, contract compilation, generated-client build, shared, API and worker builds: passed on host Bun 1.3.13.
- First host backend run: shared 510 passed, worker 48 passed; API 394 passed / 3 failed because two fixture guards require the literal local port 5433 and the native fixture child rejects port 53383. Tests were preserved. A Linux runner shares only the owned database container's network namespace, with a loopback 5433 proxy to its 5432 Postgres; the host's shared 5433 is untouched.
- First Linux run could compile all inputs but Jest ran through Bun's Node fallback and failed before test execution. Installing actual Node 20.19.2 in the owned runner restored the CI runtime boundary. Complete serial Linux Bun 1.3.11 backend gate passed: shared 510 tests / 35 suites, API 406 tests, worker 48 tests; four Turbo tasks successful, zero cached, 70.35 seconds.

## Owned verification infrastructure

The default Colima context and its existing databases were inventoried and left alone. This repair owns profile `cosmic-queue-repair-proof` (4 CPUs, 8 GB RAM), context `colima-cosmic-queue-repair-proof`, and disposable container `cosmic-queue-repair-db` on loopback port 53383. All repository migrations and the test marker were applied successfully. `TEST_DB_ALLOW_NONLOCAL=1` permits this explicitly owned alternate loopback port; no production database or shared port 5433 is used by tests. Backend suites run serially with fictional Supabase transport configuration.

Clean tracked-source image input is `git archive` of `2830785745a25d71e92af1e0601f5e9795ae5966`, without local environment, dependencies or stale build outputs. Linux amd64 API image `sha256:f3d49b34d4e93c68cd7e32d0b05c820919bfa6a88a9892cfb91457147a8485e2` built; its actual process answered health 200 and imported the generated client with fictional configuration and network disabled. An initial health probe preceded readiness; the bounded readiness probe passed. The existing API Dockerfile uses Bun 1.2.23; the worker pins 1.3.11.

Linux amd64 worker image `sha256:affe3d34c5c931106bcebf73c5230dac7cdabef231686d122e2a1688da16d9e2` built. QEMU's initial Bun execution hit the 512 MB container limit, confirmed by kernel memory-cgroup evidence. Only the owned profile was restarted with Rosetta. The same image then passed all eight packaged-browser assertions at 512 MB / one CPU, including public HTTPS trust and recovery after stalled JavaScript, without an OOM kill. The first Rosetta attempt used network disabled: seven local assertions passed, then its expected public HTTPS check failed; the final run allowed the public smoke request to example.com and passed. The script was copied into its expected `/app/scripts` path. No application code or memory limit was changed. Local Linux emulation is distinct from native cloud deployment.

Owned test database/runner and smoke containers were removed after their gates; the owned VM and immutable proof images remain available for independent verification. The default Docker context remains `colima`. PR and backend deployment IDs: pending.

## Repair review ledger

This new repair has a three-round Sol review cap. The completed log-forwarding implementation's six-round ledger remains closed in its own task record; it is not reset or reused. This repair ledger will persist through PR feedback and any release fix.

| Round | Candidate | Verdict | Findings / outcome |
| --- | --- | --- | --- |
| 1 | `2830785745a25d71e92af1e0601f5e9795ae5966` | APPROVE | gpt-6.1-sol on high; no findings. Independently ran dispatcher 27/72 and standalone reproduction 1 pass; checked wake-up ordering, capacity, shutdown and deployment overlay. Usage not returned. |

Independent isolated functional Shipping verification is a separate release gate, not another code-review round. The repair is committed locally; no push, PR, merge or deployment has occurred at this receipt. Subsequent changes only update documentation; the approved behavior diff remains unchanged (three implementation/test/config files, 96 insertions / 2 deletions).

## Production acceptance

Verify the exact merged SHA's backend tests, migrations, API and worker deployment. Observe real bookmark handler-entry logs, terminal status/dequeue progress for the six original queued saves, and scheduled Grafana backlog/overdue recovery. Report any normal source-processing failures separately. Digest jobs remain unconsumed. Save monitoring runs every 15 minutes, so a healthy deployment alone does not establish alert recovery.

A read-only production capture at 2026-11-26 02:31:00 UTC confirmed six owner-matched queued saves, all processing, none ever claimed. Their bookmark/message IDs are retained only in a private receipt for exact post-release comparison; no customer URLs, titles or identities are published.
