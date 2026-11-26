# Bookmark queue wake-up repair

Current outcome: implemented; production is still on the old worker. Next gate: complete serial backend tests and clean Linux API/worker image proofs, then review and independent shipping verification. Owner: root. Blocker: none observed; release evidence remains pending.

## Authorized scope and starting state

The user authorized moving ahead with the fix after the [incident diagnosis](production-incident-2026-11-25.md) and default/digest queue audit. Release scope is the missing dispatcher wake-up and changing the production consumer list from `default,bookmarks` to `bookmarks`. No queue is dropped, no messages are manually replayed or deleted, and digest consumption remains off while its 116-job backlog and product flow await a separate decision.

Starting branch `record-production-log-activation` was clean at `6fcd8f6a7baa53a651b3a6984830e7262d3fe834`, four unpublished documentation commits ahead and two homepage commits behind main. Those documentation commits were preserved on `fix-bookmark-queue-wakeup`, based on fetched main `4c8d362f18b8e495a6ffe33d103f77c32554dda6`; documentation-only candidate before implementation is `89777f9836148d727397b89305a866a55a130adc`. The original branch remains available.

## Behavior and regression evidence

After a queue read releases its reserved slots, the dispatcher now wakes loops waiting for capacity. Tests run the real dispatcher with held transport and handler acknowledgements: empty and failed first reads must unblock bookmarks; a partial batch must share unused slots; a full batch must wait for handler completion and stay within concurrency five.

- Baseline existing dispatcher suite: 23 passed, 45 assertions.
- Test-first tracer on original source: failed, bookmark never read.
- Repaired dispatcher suite: 27 passed, 72 assertions.
- Mutation removing only the wake-up line: empty, failed, and partial-batch cases fail; full-batch case passes through the existing handler-completion wake-up. Restored source: all 27 pass.
- Frozen dependency install, contract compilation, generated-client build, shared and API builds: passed on host Bun 1.3.13. Worker build and complete backend gate: pending.

## Owned verification infrastructure

The default Colima context and its existing databases were inventoried and left alone. This repair owns profile `cosmic-queue-repair-proof` (4 CPUs, 8 GB RAM), context `colima-cosmic-queue-repair-proof`, and disposable container `cosmic-queue-repair-db` on loopback port 53383. All repository migrations and the test marker were applied successfully. `TEST_DB_ALLOW_NONLOCAL=1` permits this explicitly owned alternate loopback port; no production database or shared port 5433 is used by tests. Backend suites run serially with fictional Supabase transport configuration.

Clean tracked-source Linux image identity, startup/browser receipts, PR and backend deployment IDs: pending. Local Linux emulation will be distinguished from native cloud deployment.

## Repair review ledger

This new repair has a three-round Sol review cap. The completed log-forwarding implementation's six-round ledger remains closed in its own task record; it is not reset or reused. This repair ledger will persist through PR feedback and any release fix.

| Round | Candidate | Verdict | Findings / outcome |
| --- | --- | --- | --- |
| 1 | Pending checks | Pending | Not started |

Independent isolated functional Shipping verification is a separate release gate, not another code-review round. No commit, push, PR, merge, or deployment of this repair has occurred yet.

## Production acceptance

Verify the exact merged SHA's backend tests, migrations, API and worker deployment. Observe real bookmark handler-entry logs, terminal status/dequeue progress for the six original queued saves, and scheduled Grafana backlog/overdue recovery. Report any normal source-processing failures separately. Digest jobs remain unconsumed. Save monitoring runs every 15 minutes, so a healthy deployment alone does not establish alert recovery.
