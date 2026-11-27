# Native web-parity integration and cleanup · 2026-11-27

- Outcome: **implementation merged into `main` by PR #266 at `0eb3f751`**. Home, sidebar,
  Save-a-link form and actual saved-bookmark detail are implemented;
  corrected iOS **1.0.0 (26)** is processed and available in the existing internal TestFlight
  Beta group. **Full visual/device acceptance remains open.**
- Verdict: **PENDING**. Do not close the parity task while required acceptance is missing.
- Next gate: final-source simulator matrix and signed physical/session/VoiceOver checks;
  retire the retained active checkout once the thread is inactive. This record is part of
  final documentation delivery; its hosting PR/main history identifies that separate revision.
- Owner: this T3 thread owns documentation/cleanup; the next device QA agent and user own
  remaining acceptance. Blocker: no binary-delivery blocker; repeated T3 `ALERT_NOT_FOUND`
  stopped device interaction. Do not infer a successful final render from Metro reload logs.

## Source and release receipts

The user explicitly requested merge and cleanup on November 27. The repository default and
deployment branch is **`main`**, not `master`. The clean starting feature head was
`f692369e0b4e4beb9ee1379d084924c402a5035a`; `origin/main` was fetched at
`65bcf07afbe3d7a60bb2ddfe47caa3bd631454e6` and merged without conflicts in `dc87654a`.
The original feature base was `671e2781e2f685804bf33bb06422bd1b92b05154`.

Build 26 remains tied to **`ff57248c88fbd4927720186499de302daaa331a7`**, not a later
documentation or integration commit. [Its signed/Apple receipt](bookmark-detail-parity/testflight-evidence.json)
records IPA SHA-256, production API/issuer, host/share-extension signatures, 29 font hashes,
completed EAS submission, Apple VALID / IN_BETA_TESTING and verified internal Beta membership.
No new build, submission, audience expansion or public release is requested by this wrap-up.

Implementation [PR #266](https://github.com/pffreitas/cosmic-dolphin/pull/266) merged on
November 27 at 18:20:20 UTC, merge **`0eb3f751f9cf3c92663e93a187b138e28fb982a5`**, final
head **`859da8639a30abd9a6a923c528f6aa6479c8c190`**, base `65bcf07a`. Both current-head
CI gates passed: [Mobile lint/types/Jest](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46048196368)
and [Rule ten](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46048196501). Ancestry
in fetched origin/main was verified before deleting the implementation branches.

Main automatically triggered [backend](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46048712255),
[web](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46048712285) and
[mobile](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46048712292) workflows.
The merge's Accessibility gate passed. Backend/web deployment was still running at the
first post-merge observation; reconcile their live state before describing production as
updated. Both internal preview builds failed because EAS Free-plan credits were exhausted;
the runner reported reset on **December 1, 2026**. These previews are separate from the
already delivered TestFlight 26. No plan upgrade, replacement binary, manual deployment,
preview retry or audience expansion was performed as incidental cleanup.

A fresh November 27 Apple group query again verified build **26** (`8330d335-029d-42fd-942d-efe62c8dab11`)
as VALID, unexpired and included in the internal **Beta** group (`2cec83b6-864f-41ef-9434-652ba953e18c`).
The backend pipeline subsequently completed successfully; production API `/health` returned
`status: ok` at 18:26:30 UTC. These observations do not certify new worker/device flows.

Web's host checkout build/test gate passed, but its Docker build failed: the builder copied
only apps/web and omitted the native-owned JSON fixtures imported by both parity galleries.
The follow-up adds only `apps/mobile/dev/home-fixture.json` and `bookmark-fixture.json` to
the builder's explicit inputs. This fixes packaging rather than removing the production-renderer
galleries or duplicating their content. **Web deployment recovery remains required until the
packaging correction is integrated and the normal deployment workflow completes.**
Verify a clean Linux image, not just a full-checkout Next build, when adding cross-app fixtures.

The packaging correction's clean **Linux/amd64** image passed on the ARM Mac through
emulation, source **`ae910e409ef6317e56dc4aba57c3255219df8710`**. Image
`cosmic-parity-web-proof:ae910e40`, digest
`sha256:2f3a189697a436369fd545ff7acdc7680e991d6b64cfada4514656d1ee10ca79`.
The context used tracked source and the successfully generated API-client build; no local
node_modules, .next output or environment files. Build arguments were fictional loopback
values: this is image/startup proof, **not the production web artifact or a visual capture**.

Runtime under `--network none`, 1 CPU / 512MiB returned `/` **200**, `/dev/home?parity=1`
**404**, `/dev/bookmark?parity=1` **404**. Both pages intentionally call `notFound()` outside
development. The first probe incorrectly expected a gallery 200, failed, and was retained;
the corrected probe verified the existing guard. No production gallery was enabled to pass
the test. The disposable container was removed and the dedicated proof VM stopped afterward.

## Remaining acceptance

| Gate | Required proof | Existing evidence limit |
| --- | --- | --- |
| Final matched rendering | Actual production native `/bookmark/[id]` and web `/bookmarks/[bookmarkId]` through the documented fixtures; same viewport/content/theme; light and dark at default and a larger native Dynamic Type category; full reader, tables, code, images, comments, geometry and typography | Committed detail default pairs precede final renderer/progress/metadata/contextual-nav/label corrections. Web large is a CSS scaling fixture. Native large capture was interrupted. |
| Real simulator flows | Home scopes/continue/lead/comments/save/empty/refresh; sidebar navigation/filtering; create/private-link/confirmation; detail read/Undo/original/note/filing/Later/full text/highlights/comments/private-summary/recovery, with active-form/request account A→B | Unit/transport regressions pass, and earlier Home/Save fixture flows exist. They do not certify every final saved-detail interaction. |
| Installed signed build | Physical session and share extension, successful sign-out, ordinary network conditions, spoken VoiceOver and modal focus | IPA entitlements/signatures and Apple processing are verified; simulator/tree-only observations are not physical or spoken certification. |

Comment reply/edit/delete/report controls were explicitly excluded. They are not a blocker
for this agreed scope. Do not port them as incidental cleanup.

Start with [the central continuation guide](native-parity-handoff.md), then the feature records:
[Home/sidebar](home-parity/tasks.md), [Save form](save-parity/tasks.md),
[saved detail](bookmark-detail-parity/tasks.md) and its [fixture/build recipe](bookmark-detail-parity/README.md).
The saved-detail local fixture is illustrative content, not a recovered private bookmark.
Preserve web as reference, semantic tokens, maintained native project, owner fences and
durable-capture/reading behavior. Never run `expo prebuild --clean`.

Use T3 `device_list` → `device_open` and the returned bound `agent-device` command. Follow
tool recovery advice once; repeated failure requires stopping device interaction. Never reuse
or close another agent's claim. Acquire a fresh task-owned claim for the remaining matrix.

## Integration validation

Fresh frozen-lockfile installation and the complete `bun run apispec` pipeline passed.
Mobile typecheck/lint passed (12 existing warnings); Jest passed **42 suites / 338 tests**
with 1 skipped suite/test. Token-generation tests passed **11/11**. Mobile application,
dependency and font source remain unchanged from signed build 26's `ff57248c`; subsequent
regression-harness changes do not change the signed artifact. The native build/signature proof
is retained in the release receipt rather than issuing a redundant binary for documentation.

Web lint, typecheck and production build passed. The first full Vitest run failed 2 contrast
coverage assertions because `nav-surface` had no audit classification. The correction adds
actual composited navigation label/focus contrast checks over app grounds and black/white
image extremes in both themes; no palette or product UI change was required. Keep the failed
run in history rather than describing every integration check as passing on its first attempt.
The repeated web lint/typecheck/production build and full Vitest gate passed: **22 files /
417 tests**. PR-triggered CI remains the merge gate.

The first Mobile PR gate on `5fc4ed47` failed its cold-root Save test at the existing 5-second
limit: [run 46047237485](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46047237485),
41 suites / 337 tests passed, 1 failed, 1 skipped. A fresh-cache local baseline passed in
2.7 seconds; instrumentation measured about 993ms of first Save imports and 290ms of first
Home imports inside the timed interaction. This was Jest dependency transformation work,
which a compiled native bundle does not perform on navigation. A diagnostic-only 2.5-second
run passed in 2.3 seconds; it is not a Linux reproduction or a committed timeout change.

The harness now loads the **real** route modules during suite initialization and awaits
the actual reader owner through RootLayout/providers before interacting. Auth/provider/queue
and transport state still start cold; durable persistence, double-submit, held/lost ACK,
navigation, restart and exactly-once assertions remain intact. No timeout or production
behavior changed. The focused fresh-cache 30-test run passed; its first integration took
1.0 second. Repeated mobile lint/typecheck and the full fresh-cache run passed **42 suites /
338 tests**, 1 skipped. Current-head PR CI subsequently passed before the implementation merge.

## Accepted debt and deferred scope

No additional technical debt was identified in this bounded wrap-up. Missing final QA is a
closure blocker, not debt. Core Text rasterization/fractional rounding, native blur and nearest
bundled optical cuts remain documented platform adapters in [Home's limits](home-parity/tasks.md).

Comment reply/edit/delete/report controls remain **explicitly deferred by the user's original
scope**, not newly waived during wrap-up. Impact: native does not provide those web moderation
and conversation actions. Owner: unassigned. Destination: [saved-detail deferrals](bookmark-detail-parity/tasks.md#explicit-deferrals).
Next action only when requested: map current production web controls and permissions, adapt
native behavior and account fences, then prove matched rendering and actual interaction.
Done means the agreed controls work across account changes with appropriate permissions and
device/accessibility evidence. No external ticket was created.

The exhausted cloud-preview quota is an operational follow-up, not an app-code defect or a
TestFlight 26 delivery blocker. Owner: unassigned. For a separately requested preview, first
recheck quota after reset, then use the release runbook's intended source/profile and verify
actual build completion. A scheduling job alone does not close that follow-up.

## Cleanup boundaries and preservation

- Local `main` had three unpublished exploratory documentation commits at `3e3c3908`.
  They are preserved under **`backup/main-before-home-parity-wrap-20261127`** before local
  main is synchronized. They are not part of this parity merge.
- Task-owned fixture servers on 5537/5541, web dev on 3001 and Metro on 8081 were stopped
  after verifying their commands and working directories. Other agents' processes were not
  stopped. The task-owned Colima proof profile was temporarily restarted for the web image
  proof with its existing 4 CPU / 8GiB capacity and `--activate=false`, then stopped again.
  The default Docker context and its eight existing containers remained running; shared
  infrastructure and retained API/worker/web proof images were left intact.
- Task-local ignored Xcode environment files, Expo state and browser/fixture diagnostics were
  copied to a private cache archive before worktree removal. No untracked source was present.
  Private signed-artifact/build/submission receipts remain outside Git; do not publish private
  logs or credentials. Committed receipts are sufficient to identify the delivered artifact.
- Removed local and remote `feat/mobile-home-web-parity` and local task-start branch
  `ios-home-web-parity` after verifying ancestry in fetched main. Local main was synchronized
  after preserving its unpublished commits. Other worktrees/branches include
  unfinished or unpublished work and are preserved. Do not blanket-delete or prune them.

- Released this thread's iPhone 18 Pro simulator claim through T3 `device_close`, with
  `shutdown=false`. Other device claims and the simulator itself were not shut down.
- Retained active checkout:
  `/Users/paulo.freitas/.t3/worktrees/cosmic-dolphin/t3-2c1bf312-08104846a78c4f96`.
  The wrap-up workflow forbids deleting the active checkout during its turn, and T3 exposed
  no supported worktree exit/removal tool. Return this checkout to main after documentation
  delivery; preserve any new work. **Final removal is pending until this thread is inactive.**
  From another checkout, reconcile tracked/untracked/ignored state, confirm content is in
  origin/main, then use non-forced `git worktree remove <that-path>`. Inspect any refusal;
  do not use `--force` or blanket `git clean`.
- The private preservation archive and validation/cleanup manifest are under
  `/Users/paulo.freitas/.cache/cosmic-dolphin-releases/home-parity-wrap-20261127`.
  The signed IPA/Apple proof remains in the existing private release cache. Neither cache
  is disposable while acceptance or release investigation still needs its evidence.

The parity task remains open for the required QA above. Implementation merge, TestFlight
availability and documentation delivery must not be described as final device acceptance.
