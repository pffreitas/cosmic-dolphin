# Saved bookmark detail parity · 2026-11-27

- Outcome: **saved bookmark detail migrated and delivered in iOS 1.0.0 (26), available in the existing internal TestFlight Beta group**. Source `ff57248c`; production build + submission FINISHED; Apple VALID / IN_BETA_TESTING / unexpired; actual Beta membership verified. 338 tests pass. Final simulator/physical parity acceptance remains open.
- Next gate: render the final source in default and larger Dynamic Type, verify the full reader/table/code/images/comments and real simulator flows; then physical signed-session/spoken accessibility acceptance. No remaining binary-delivery gate.
- Owner: this MacBook T3 thread completed code/binary delivery; device QA/user owns remaining acceptance. Blocker: none for delivery. T3's advised `alert get` and `--debug` retry both returned `ALERT_NOT_FOUND` (2026-11-27 15:57 UTC), so device interaction stopped. No need to re-ask composition or release permission for this correction.
- Starting state: clean pushed `feat/mobile-home-web-parity` at `fa3ddba7d8514a9677ccafe1850c4f9665ab3e65`. Original base `671e278`; fetched main is now `65bcf07a` (worker-only change). Inspect current source rather than assuming the older head remains current.
- Scope correction: “bookmark save page” means **saved bookmark detail**, not the create form. Correct web order is hero/breadcrumb/provenance/actions → Cosmic brief → rich reader/images/tags → social row → inline comments. Topic button, Brief/Read/Original tabs and the persistent Later/Mark done footer are not the reference composition.
- Preserve native genuine full-text access, highlights, note/filing/reading actions and account fences. Keep known reply/edit/delete/report controls out of scope. Semantic web tokens only; maintain the native project in place.

Integration/cleanup status is owned by [the wrap-up record](../native-parity-wrap-up.md).
The November 27 user request explicitly authorizes merging into the repository default
`main` and removing this task's branches/worktree. Historical release statements below
describe the state at upload time; final device acceptance remains a separate gate.

## Failure and acceptance signal

- [Reported web](reported-web.png): user-provided full-page reference, 146×2000 downsampled attachment; original viewport/text scale unknown.
- [Reported native](reported-native-build25.png): user reports installed TestFlight 25 on their phone, 921×2000 attachment; OS/device/text size not independently verified. This is reported physical evidence, not a simulator capture.
- Source `apps/mobile/app/bookmark/[id].tsx` is unchanged by the Save-form implementation commit. This confirms a scope error, not an unproven stale-build/cache hypothesis; bisection and timeout instrumentation are unnecessary for this deterministic mismatch.
- The previous Save fixture rendered the create form and could not validate this route. New proof must use the actual detail renderer/controller, with matched content and rich-reader coverage. Existing `save-parity` evidence remains truthful for the form and is not relabelled as detail proof.
- `apps/mobile/dev/bookmark-fixture.json` is an illustrative matched fixture using the reported article title/brief and representative rich Markdown. It is not a claim to have read the user's private bookmark API response or recovered the full downsampled web screenshot.

## Implemented result

- Actual route: `apps/mobile/app/bookmark/[id].tsx`, not `/save`. Shared omnibox/five-cell chrome → breadcrumb/title/provenance → Mark as read/Open original/share/More → brief → continuous `cosmicSummary` reader/images/tags → social row → inline comments. Removed the giant topic/note buttons, old mode tabs and permanent Later/Mark done bar.
- Web is the source for 32/35.2 title, 14.5/23.2 brief, 17/29.24 prose, 26/32.5 and 20/27 headings, margin collapse and image/code/table frames. Semantic tokens only. 29 frozen serif assets cover normal/italic/bold-italic weights and default/larger optical cuts; existing Home cuts stayed byte-identical. Images use web's fixed 16:9 cover frame, not an assumed natural ratio.
- Generated owner read normalizes actual wire `site_name` / `article_author` and enforces the expected user. Public reads still use the slug contract without private-cache fallback. Route account/id/slug keys synchronously reset private local fields; stale request, post and deletion completions are fenced.
- Default article progress now works without opening Read; fetches and queued flushes retain their owner across navigation. Native full stored text/highlights/preferences, note/filing/Later, reversible read state/Undo/next-pick feedback, private own-summary editing, failure/paste/retry and explicit public-link disclosure remain available. Ordinary reading writes still fail/roll back offline, not a new durable queue.
- Native More/reading/private-link adapters preserve approved product behavior. Known comment reply/edit/delete/report controls remain out of scope.

## Evidence and failures

- [Evidence metadata](evidence.json), [light pair](pair-light-default.png), [dark pair](pair-dark-default.png). Web left/native right, 402×778 product bounds; simulator originals 402×874 at 1x, backing scale 3x, 62/34pt OS safe-area crop. No global image-diff threshold or physical certification.
- Default captures preceded final progress/metadata, rich-renderer, contextual navigation and Key points label-color corrections. The label was changed from secondary text to web's foreground after capture. Final post-fix renders remain required; do not label the pairs as acceptance of the final source and whole page.
- Web default/larger light/dark renders use production BookmarkDetail/AppShell/BottomNavigation. Larger web is a CSS scaling fixture (23/17, controls 1.3), **not native Dynamic Type evidence**. Original web large capture scaled before hydration and produced an attribute mismatch; capture now awaits the gallery readiness marker, network bootstrap and fonts. Native larger category was set, but its capture and subsequent simulator flows were not completed after the device-tool failure.
- `diagnostics/` keeps unmatched exploratory reader captures. They show rendered native long-form content, not a final matched full article/table/code/image acceptance set.
- Route red: body sentinel absent, 1 failed / 9 passed. This proved the Save fixture could not certify saved detail. Initial full regression failure included old tab/footer selectors and missing chrome/comments mocks; selectors were adapted while retaining read/Undo/recovery/ownership assertions, not extending timeouts.
- Progress red: 3 failures proved default article progress and original-account transport were missing. Wire-data red proved the generated reader/normalization boundary was absent. The real Markdown renderer first needed an isolated preferences mock, then failed on missing semantic headings; its final test covers real lists/table/code and long-line scrollability without mocking Markdown.
- Final mobile typecheck/lint/full Jest and tokens checks are recorded at delivery below. Web typecheck also passed. Existing lint warnings remain separate from errors.

## Remaining acceptance

1. Final exact-source default + XXXL native/web pairs, including the whole reader, table/code/image states and inline comments. Geometry/antialiasing/font fallback must be reviewed separately.
2. Simulator controls through the real route/navigation/transport: read/unread/Undo, original, note/filing/Later, full stored text/highlights, comments, private summary, failures/paste/retry and shared save. Account A→B while a form/request is active. Unit proofs are not simulator flows.
3. Physical signed-session/share-extension/sign-out, normal radio behavior and spoken accessibility. The reported physical build-25 image is diagnosis evidence, not post-fix proof.

## Release compatibility and authorization

User already asked to build/push TestFlight and corrected the intended surface. This binary correction uses that existing grant and the existing internal Beta audience; no PR/merge/backend deployment/public release was requested.

Current backend run [46023483758](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46023483758) succeeded at `65bcf07a` (worker-only Haiku/X-link change). API/shared/spec/generated-client and all backend dependency/build inputs consumed by the prior proof remain unchanged from build-25 source `430ecb2f`. Reuse its fresh contract/Linux API+worker image/runtime proof; no repeated Docker work or shared VM change. See the prior [release receipt](../save-parity/testflight-evidence.json).

Production remote build number was 25 before this correction. Local EAS 27.11.0 is required by the currently exhausted free cloud quota; no plan purchase or cloud retry. Maintain native projects; RNSVG 15.12.1 is already in the committed Podfile.lock. Use the tested scoped iOS 15.1 GYM override, private case-sensitive Git config, exact-source archive and signed artifact inspection. Apple VALID/IN_BETA_TESTING and actual existing Beta membership follow upload; scheduling is not availability.

## Final code gate · 2026-11-27

`bun install` completed without dependency changes. Mobile `tsc --noEmit`, lint (100 token-scanned files; 12 existing warnings, no errors), full Jest (**42 passed suites, 338 passed tests; 1 skipped suite/test**) and tokens:test (11 passed) succeeded. Web typecheck passed. No timeout changes or production data edits. Remaining device checks above are not waived or labelled complete.

## Production artifact · 2026-11-27

Source [ff57248c](https://github.com/pffreitas/cosmic-dolphin/commit/ff57248c88fbd4927720186499de302daaa331a7) is pushed. Local EAS production build finished, incrementing 25→26; 44 archived source/dependency/font files match the candidate and actual environment files were excluded. Both host and ShareExtension are 1.0.0 (26), iOS minimum 15.1, strict signed verification passed, Store profiles unexpired through 2027-01-22, get-task-allow false, group/keychain configuration correct. All 29 custom serif font hashes and production API/issuer were verified; fictional loopback configuration excluded.

IPA SHA-256: `60177e90ffd3a59b88db5b41008fc114bb31db86a5d91628fd7a4c8d23774aba`. [Submission 97868c5d](https://expo.dev/accounts/cosmic-dolphin/projects/cosmic-dolphin/submissions/97868c5d-a1cd-4a22-96df-06e0eba760b0) scheduled once with auto TestFlight setup disabled. Submission FINISHED at 2026-11-27T17:10:53.892Z. Apple VALID / IN_BETA_TESTING / unexpired and actual internal Beta assignment are now verified; no repeated build or enlarged audience. Private raw receipts: `~/.cache/cosmic-dolphin-releases/bookmark-detail-20261127T170213Z`; [sanitized receipt](testflight-evidence.json). Shared Git ignorecase remains true; no shared Docker changes.

## Final TestFlight receipt · 2026-11-27

**iOS 1.0.0 (26) is available** in existing internal **Beta** (`2cec83b6-864f-41ef-9434-652ba953e18c`, all builds). Apple build `8330d335-029d-42fd-942d-efe62c8dab11`: VALID, IN_BETA_TESTING, unexpired. External state READY_FOR_BETA_SUBMISSION is not external approval. No group/tester expansion, PR, merge, backend deploy or public App Store release.

[Apple TestFlight](https://appstoreconnect.apple.com/apps/6758127357/testflight/ios) · [submission](https://expo.dev/accounts/cosmic-dolphin/projects/cosmic-dolphin/submissions/97868c5d-a1cd-4a22-96df-06e0eba760b0) · [signed/Apple receipt](testflight-evidence.json). Code source remains pushed `ff57248c88fbd4927720186499de302daaa331a7`; later documentation does not change that artifact. Build 25 is historical Save-form delivery and the reported wrong-detail diagnosis; install 26 for this correction. Remaining device/physical gates above remain explicit.
