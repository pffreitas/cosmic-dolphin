# Native web-parity integration and cleanup · 2026-11-27

- Outcome: Home, sidebar, Save-a-link form and actual saved-bookmark detail are implemented;
  corrected iOS **1.0.0 (26)** is processed and available in the existing internal TestFlight
  Beta group. **Full visual/device acceptance remains open.**
- Next gate: finish integration into `main` and task-owned cleanup; then the final-source
  simulator matrix and signed physical/session/VoiceOver checks listed below.
- Owner: this T3 thread owns integration/cleanup; the next device QA agent and user own
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

The PR and final merge receipt will be added after integration. Main pushes may trigger the
existing web deployment and internal-preview workflows. Those are separate from the already
delivered TestFlight binary; a scheduled preview is not a TestFlight release.

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
with 1 skipped suite/test. Token-generation tests passed **11/11**. Mobile source remains
byte-identical to signed build 26's `ff57248c`; the native production build/signature proof
is retained in the release receipt rather than issuing a redundant binary for documentation.

Web lint, typecheck and production build passed. The first full Vitest run failed 2 contrast
coverage assertions because `nav-surface` had no audit classification. The correction adds
actual composited navigation label/focus contrast checks over app grounds and black/white
image extremes in both themes; no palette or product UI change was required. Keep the failed
run in history rather than describing every integration check as passing on its first attempt.
The repeated web lint/typecheck/production build and full Vitest gate passed: **22 files /
417 tests**. PR-triggered CI remains the merge gate.

## Cleanup boundaries and preservation

- Local `main` had three unpublished exploratory documentation commits at `3e3c3908`.
  They are preserved under **`backup/main-before-home-parity-wrap-20261127`** before local
  main is synchronized. They are not part of this parity merge.
- Task-owned fixture servers on 5537/5541, web dev on 3001 and Metro on 8081 were stopped
  after verifying their commands and working directories. Other agents' processes were not
  stopped. The task-owned Colima proof profile was already stopped; shared Docker infrastructure
  and retained release proof images were left intact.
- Task-local ignored Xcode environment files, Expo state and browser/fixture diagnostics were
  copied to a private cache archive before worktree removal. No untracked source was present.
  Private signed-artifact/build/submission receipts remain outside Git; do not publish private
  logs or credentials. Committed receipts are sufficient to identify the delivered artifact.
- Remove only `feat/mobile-home-web-parity`, its worktree and the obsolete task-start branch
  `ios-home-web-parity` after verifying ancestry in main. Other worktrees/branches include
  unfinished or unpublished work and are preserved. Do not blanket-delete or prune them.

Final cleanup and integration outcomes will be recorded after the merge is verified.
