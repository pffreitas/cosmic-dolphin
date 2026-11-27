# Native web-parity continuation · 2026-11-27

Read `AGENTS.md`, this guide, then the current feature task record. This is a continuation map;
the feature records retain detailed evidence and history. Current production web remains the
visual authority under [parity.md](parity.md). Read the approved mobile behavior spec before
changing capture, reading, ownership or offline behavior.

Behavior references: [approved mobile Save/reading spec](../specs/mobile-reading-app/2026-11-09-save-and-todays-5.md)
and [current web capture contract](../functional-spec/02-capture.md). For another surface, use
[the source inventory](inventory.md) and [component adaptation workflow](implementation.md#adapting-a-component)
to identify its production renderer and contract before editing native behavior.

## Current outcome and next gate

**Wrap-up status (November 27):** implementation is merged into `main` through
[PR #266](https://github.com/pffreitas/cosmic-dolphin/pull/266), merge `0eb3f751`;
TestFlight 26 delivery is complete. **Parity acceptance remains PENDING**: final rendered,
simulator and physical/session/spoken accessibility gates are still open. The repository's
default/deployment branch is `main` (there is no `master`). Implementation branches and
task-owned servers/device claim have been removed/released; the active T3 checkout is
retained until it becomes inactive. Do not rebuild/resubmit 26 merely for documentation.
See [the integration/cleanup record](native-parity-wrap-up.md) for current delivery state.

To call parity acceptance complete, the next device QA agent must:

1. Capture **final-source** matched light/dark default and larger-text pairs, including the
   full saved-detail reader, tables, code, images and comments. The committed detail default
   pairs precede the last corrections; the web larger-text fixture is not Dynamic Type proof.
2. Exercise real simulator navigation/transport: Home scopes, continue reading, lead story,
   comments, omnibox save, empty states and refresh; sidebar filters and navigation; capture
   and saved-detail read/Undo, original, note/filing/Later, full text/highlights, comments,
   private-summary editing and recovery. Include account A→B with a form/request active.
3. Verify the installed signed build's session, share extension, sign-out and spoken
   VoiceOver/modal focus on a physical device. Simulator and signed-artifact inspection
   do not certify those interactions.

The current blocker is the repeated T3 `ALERT_NOT_FOUND` failure, not a verified app defect.
Use a fresh claim through `device_list` → `device_open`; never borrow another agent's claim.
Comment reply/edit/delete/report remain explicitly out of scope.

| Surface | Recorded outcome | Next gate / owner | Authoritative record |
| --- | --- | --- | --- |
| Home and sidebar | Rendered migration; included in current build 26 with saved-detail correction. The Home-only build 24 receipt remains historical evidence | Physical/signed-session QA, successful sign-out and spoken accessibility; device QA/user | [Home tasks](home-parity/tasks.md), [signed artifact and Apple receipt](home-parity/sidebar-testflight-evidence.json) |
| Save-a-link form and private link | First delivered in iOS 1.0.0 (25), retained in current internal Beta build 26; historical form gate 40 suites / 324 tests, current combined gate 42 suites / 338 tests, 1 skipped | Physical/signed-session and spoken accessibility QA, including modal focus; device QA/user | [Save tasks](save-parity/tasks.md), [evidence](save-parity/evidence.json), [resume recipe](save-parity/README.md) |
| Saved bookmark detail | Actual route migrated after build-25 wrong-surface diagnosis; iOS 1.0.0 (26) available in existing internal Beta. 338 tests pass; final full/XXXL/flow acceptance open | Final simulator/physical QA; T3 `ALERT_NOT_FOUND` blocks further device interaction | [Detail tasks](bookmark-detail-parity/tasks.md), [fixture/implementation guide](bookmark-detail-parity/README.md) |

The two Save corrections were rechecked successfully in [the release evidence](save-parity/release-2026-11-27/evidence.json).
Original invalid/confirmation images remain before-correction diagnostics. The earlier Save-form continuation completed device checks. The saved-detail correction later hit repeated `ALERT_NOT_FOUND`; its task record owns that new blocker. Build-25 form delivery is
owned by [Save tasks](save-parity/tasks.md) and [the signed-artifact receipt](save-parity/testflight-evidence.json).
Current corrected build **26** is processed and assigned to the existing internal Beta group; [saved-detail tasks](bookmark-detail-parity/tasks.md) and [its final receipt](bookmark-detail-parity/testflight-evidence.json) own current binary state. No new audience or public release was created.

Physical/signed-session and spoken VoiceOver remain separate acceptance gates. In particular,
Home-entry raw accessibility snapshots can enumerate retained Home nodes beneath the sheet;
a cold-route/tree-only observation was not general modal-focus certification. Keep this limit
explicit and use a fresh authorized device claim for further QA.

## Source identity and authorization

- Implementation: merged into `main` by PR #266 at
  `0eb3f751f9cf3c92663e93a187b138e28fb982a5`, from final head
  `859da8639a30abd9a6a923c528f6aa6479c8c190`. The local/remote
  `feat/mobile-home-web-parity` branch was deleted after ancestry verification.
  This handoff originally started from clean pushed `24c55564`.
- Integration base: `origin/main` at `65bcf07afbe3d7a60bb2ddfe47caa3bd631454e6`; original native branch base remains `671e278`. The implementation merge is `0eb3f751`; fetch current main before resuming.
- Current signed build 26 source: `ff57248c88fbd4927720186499de302daaa331a7`; [saved-detail receipt](bookmark-detail-parity/testflight-evidence.json). Final simulator/large-text/full-reader/flow acceptance remains open after the device-tool failure.
- Historical signed build 25 source: `430ecb2f8cccaffc7d1074e5b9de9d15daa32bf8`;
  [final Save receipt](save-parity/testflight-evidence.json). Documentation commits after it do not change that artifact.
- Historical Home/sidebar build 24 source: `a077ea5472b764044bf0acac11b955fa20e3d7d2`.
- Save implementation/evidence source: `d261b491eca5564665f74267e10879b57152cdb0`;
  `24c55564` records its delivery and outstanding device gate.
- Fetch origin and inspect current head/base/working state before resuming. These are recorded
  identities, not an instruction to reset a newer checkout or discard uncommitted work.
- “Save page” was misinterpreted as the create form. The actual intended saved detail is `/bookmark/[id]`; its production web owner is `/bookmarks/[bookmarkId]`. Require evidence from that actual renderer/controller before delivery.
- The user chose current web Home composition/controls and subsequently requested sidebar and
  Save migration. Keep those decisions. Other screens retaining native compatibility styling
  have not thereby been approved for a bulk redesign.
- Follow the latest user grant. The November 27 wrap-up explicitly authorizes merging this
  work and cleaning its branches/worktree. Earlier receipts correctly record that no merge
  occurred at those release times. Distribution/audience changes remain separately scoped.

## Reusable implementation seams

| Work | Start here | Boundary to preserve |
| --- | --- | --- |
| Palette, type and optical sizes | [generated theme](../../apps/mobile/constants/theme.ts), [web theme adapter](../../apps/mobile/components/web-home/theme.ts) | Parity opts into `webColors`/`webTypeCompact`; `colors`/`type` retain shipped native compatibility. `webText` selects bundled optical cuts and exact Inter weights. Edit tokens/generator inputs, never generated output. |
| Home composition and chrome | [Home](<../../apps/mobile/app/(tabs)/index.tsx>), [Chrome](../../apps/mobile/components/web-home/Chrome.tsx), [Sidebar](../../apps/mobile/components/web-home/Sidebar.tsx), [primitives](../../apps/mobile/components/web-home/Primitives.tsx) | Keep composition, route filters/counts, owner keys and public-slug opening. Home `Action` is the compact control; Save's default web Dialog button has different geometry. |
| Text wrapping | [BalancedTitle](../../apps/mobile/components/web-home/BalancedTitle.tsx), [PrettyCopy](../../apps/mobile/components/web-home/PrettyCopy.tsx) | Glyph-measured adapters, not fixture-specific line breaks. PrettyCopy defaults to sidebar `meta`, 18.75pt line height, cap 1.3 and `even`; Save explicitly uses `short-tail`, role/line-height overrides and uncapped copy. Preserve the defaults for existing consumers. |
| Save presentation | [SaveSheet](../../apps/mobile/components/web-save/SaveSheet.tsx), [Save route](../../apps/mobile/app/save.tsx), [native root](../../apps/mobile/app/_layout.tsx) | SaveSheet is a controlled renderer. Keep native `Modal` plus keyboard avoidance: the transparent route alone exposed Home in accessibility snapshots. Safe areas lie outside matched product bounds. |
| Capture behavior | [CaptureContext](../../apps/mobile/contexts/CaptureContext.tsx), [save queue](../../apps/mobile/lib/save-queue.ts), [native API adapter](../../apps/mobile/lib/mobile-api.ts), [durable tests](../../apps/mobile/app/__tests__/save-durable.test.tsx) | Persist before showing confirmation; preserve latest intent through create **and PATCH acknowledgement**. Keep replay/Remove/concurrent-arrival/owner fences. Presentation migration is not a replacement queue. |
| Clipboard and private metadata | [CopiedLink](../../apps/mobile/components/CopiedLink.tsx), [Save controller](../../apps/mobile/app/save.tsx) | Clipboard metadata detection is not content reading; use explicit native Paste. Preview is optional, fenced by abort/owner/lifetime, contributes title only and never gates saving. |

Save route prefill requires a matching `accountId` and the initial owner generation. An account
change remounts the entire private form synchronously. Omnibox private-link navigation passes
`privateLink=true` and `captureSource=save_sheet`; clipboard-prefilled routes retain clipboard
attribution. Save and Home reuse `captureUrl` for web-style URL validation. Do not loosen those
ownership checks to make a deep link or fixture convenient.

The relevant web owners are [NewBookmarkButton](../../apps/web/components/bookmark/new-bookmark.tsx),
[PrivateLinkDialog](../../apps/web/components/bookmark/private-link-dialog.tsx) and
[Dialog](../../apps/web/components/ui/dialog.tsx)/[Input](../../apps/web/components/ui/input.tsx)/
[Textarea](../../apps/web/components/ui/textarea.tsx)/[Button](../../apps/web/components/ui/button.tsx).
Native deliberately keeps its durable save/optional note/read-later step; web closes optimistically
and reopens a rate-limited form. The approved mobile spec and Save record explain that adapter.

## Build and regression gate

Run from the repository root unless a command enters an app explicitly:

```bash
bun install
(cd apps/mobile && bunx tsc --noEmit)
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile test -- --runInBand
bun run tokens:test
```

For Save behavior iteration, run the focused gate first:

```bash
bun run --cwd apps/mobile test -- --runInBand --testPathPattern=save-durable
```

The final Save run had 40 passing suites / 324 passing tests / 1 skipped; lint had 12 existing
warnings, no errors, and 95 token-linted files. These are historical checks, not a substitute for
checks after new code changes. The corrected saved-detail run had 42 passing suites / 338
passing tests / 1 skipped; lint had 12 existing warnings and 100 token-linted files. Web fixture
changes also need `bun run --cwd apps/web typecheck`, lint, tests and build. Fresh PR gates run
`bun install --frozen-lockfile` and the complete `bun run apispec` pipeline, not just postinstall.

The web parity galleries import the same JSON fixtures from `apps/mobile/dev`. Web's Docker
builder must include those explicit inputs; a full-checkout Next build can pass while the
production image fails on omitted fixture files. Validate a fresh Linux Docker image when
changing gallery imports/build context. The wrap-up record preserves the failed deployment
and its packaging correction; do not duplicate fixtures to conceal the dependency.

Maintain the committed iOS project in place. `react-native-svg` 15.12.1 is already in this branch's
Pod lock; a fresh native/dependency checkout needs `pod install` in `apps/mobile/ios`. Never run
`expo prebuild --clean`. Select your own device through T3 first, then build without driving UI:

```bash
parity_derived_data=$(mktemp -d "${TMPDIR:-/tmp}/cosmic-parity-build.XXXXXX")
xcodebuild -workspace apps/mobile/ios/CosmicDolphin.xcworkspace \
  -scheme CosmicDolphin -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<your-open-device-id>' \
  -derivedDataPath "$parity_derived_data" \
  IPHONEOS_DEPLOYMENT_TARGET=15.1 CODE_SIGN_IDENTITY=- build
```

The 15.1 override addressed old RNSVG/AsyncStorage resource-bundle targets under Xcode 27.2;
it was a build invocation, not a committed deployment-policy change. Install the resulting
`Build/Products/Debug-iphonesimulator/CosmicDolphin.app` using the newly returned bound device CLI.
The old simulator client could use ordinary SecureStore but could not prove shared-Keychain
sign-out. Do not re-sign a copy with guessed groups or weaken auth/storage guards; see Home's
failed attempt and signed-artifact receipt before planning capability proof.

The current signed artifact has 29 frozen serif assets, including the retained Home cuts and
saved-detail normal/italic/bold-italic variants. Only regenerate when the reference or font
mapping changes, using [the Home generator](../../scripts/generate-home-fonts.py) and
[detail generator](../../scripts/generate-detail-fonts.py)'s pinned commands after web font
output exists. Keep hashes/manifests/native font loading and evidence in sync; do not
introduce a font substitute or synthetic weight to mask a mismatch.

## Distribution continuity

Read [the release runbook](../runbooks/backend-and-testflight-release.md) and Home's
[release history](home-parity/tasks.md#testflight-release--2026-11-27) before an authorized release.
Reconcile the actual current source/backend gate and audience first.

- Current build 26 and historical builds 25/24 are **local EAS production distributions**, not internal previews.
  Their signed host/extension, resolved Info configuration, production API/issuer and all font
  hashes were verified; Apple processing and actual internal Beta membership are separately
  recorded in the committed receipt. Physical/session proof remains separate.
- EAS cloud Free-plan quota was exhausted on November 27; reset was shown as December 1.
  Recheck current state rather than assuming it is still exhausted or purchasing a plan.
- Tested local path used EAS CLI 27.11.0 and build-only
  `GYM_XCARGS=IPHONEOS_DEPLOYMENT_TARGET=15.1`. `.easignore` already excludes the tracked
  `.Jules`/`.jules` case collision from packaging. Process-scoped case-sensitive Git settings
  used a private Git config file; do not change shared repository `core.ignorecase` as a workaround.
- Check the remote build counter; do not hardcode a successor to the last recorded 26. Inspect the IPA
  before one submission; bind version/build/hash to source and verify actual Apple/group state.
- Before integration is confirmed, dispatching the runbook's `--ref main` example selects
  main's source rather than an unmerged candidate. After integration, verify the exact live
  source instead of reusing an old branch name or artifact receipt. The wrap-up merge does
  not itself request a new binary or a wider audience. Pushes to main may trigger the existing
  web deployment/internal-preview workflows; those states are distinct from TestFlight 26.
- The merge's automatic iOS/Android internal previews failed on exhausted EAS Free-plan
  credits ([run](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46048712292)); the
  runner reported reset on December 1. This is an operational follow-up, not a failed
  TestFlight 26 upload. Reconcile current quota before any separately authorized retry.

## Suggested skills

- **impeccable** for the next native UI adaptation or rendered polish. Preserve the current
  web identity; use its native guidance and craft floor, with the user's pinned web contract.
- **playwright-cli** for a permitted browser fallback. T3 preview is first when available;
  the earlier repeated frame failure does not authorize skipping discovery forever.
- **safe-push** when the next request includes code validation and branch delivery. Keep
  documentation-only checks proportionate and retain the existing evidence limits.
