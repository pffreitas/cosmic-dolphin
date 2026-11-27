# Native Home web parity · 2026-11-26

- Outcome: **Home/sidebar migration is included in current iOS 1.0.0 (26), available in the existing internal TestFlight Beta group with Save and corrected saved detail**. The Home-only correction originally shipped in build 24; its artifact/history below are retained. [Current combined build 26 receipt](../bookmark-detail-parity/testflight-evidence.json).
- Next gate: physical-device/signed-session acceptance of build 26, including successful sign-out and spoken accessibility. No remaining binary-delivery gate; [integration/cleanup](../native-parity-wrap-up.md) is tracked separately.
- Owner: this MacBook T3 thread completed delivery; next acceptance belongs to device QA/user. Blocker: none for delivery. Simulator sign-out capability/launch limitations are retained below.
- Current shared binary: **iOS 1.0.0 (26)** includes Home/sidebar, the Save form and corrected saved detail, available in existing internal Beta. [Current receipt](../bookmark-detail-parity/testflight-evidence.json); [detail acceptance gate](../bookmark-detail-parity/tasks.md) remains open.
- Continuation: [native parity handoff](../native-parity-handoff.md). This record owns the released Home/sidebar scope; the branch subsequently adds [Save migration](../save-parity/tasks.md), which was subsequently delivered together with Home in build 25. [Historical build 25 receipt](../save-parity/testflight-evidence.json). The Home-only build 24 evidence below remains historical; read Save’s current next gate before preparing another binary.
- Starting state on MacBook: clean `ios-home-web-parity` at `671e2781e2f685804bf33bb06422bd1b92b05154`. Fetched origin and switched to `feat/mobile-home-web-parity` at `ce03bd3` (remote head, base `origin/main` at `671e278`). Preserved environment/hooks; none were edited.
- Scope: user explicitly approved web Home composition and controls. Current web wins. Evidence is simulator + illustrative fixtures/local HTTP transport, not physical-device or production-account proof.
- Remaining limits: UIKit blur and Core Text antialiasing/fractional rounding remain platform adapters; larger serif optical sizes use the nearest bundled cut. Known reply/edit/delete/report controls stay out of scope. Other phone/tablet widths, accessibility categories and physical hardware were not certified by this pass.

## Sidebar correction · 2026-11-27

- User grant: “Fix the side bar… it’s not compliant with web.” Clean branch `feat/mobile-home-web-parity` at `25cb7e6886a548e912c52ec537b835145c45e599`, remote fetched and matched; base remains `671e278`.
- Reproduced in iPhone 18 Pro iOS 27 simulator and production web Sidebar at 402 × 778 CSS pixels: native omits Inbox/Read later/Archive, counts, collection hierarchy/group, selected state and account/theme menu; generic centered buttons and brand size differ. Native modal also placed its brand beneath the OS status bar.
- Initial web screenshot caught sheet animation and was rejected; recaptured after settled animation. T3 preview failed twice with “The browser is not producing screenshot frames,” including restore retry. Playwright fallback is used; native interaction remains on this thread’s T3 device claim.

- Corrective delivery remains within the prior “Build iOS binary and push it to test flight” grant for this Home feature, following the user’s sidebar correction. Same existing internal Beta audience; no merge, wider rollout or new account access. Physical-device/normal-session limits remain disclosed. EAS cloud quota remains exhausted; use the already-proven local distribution path, with remote counter currently 23.
- URL read-filter adapter now follows the route and defaults unknown values to All. This prevents a retained Library instance from overriding a sidebar destination with an older local read filter.

- Final composition: web’s 288pt compact drawer, 56pt wordmark header, left-aligned 32pt navigation rows/16pt Lucide icons, bordered selected Home, Library and Collections groups, totals including child collections, and bottom-pinned avatar/name/email account menu. Profile, Light/Dark/Match system and existing sign-out are wired; keyboard is dismissed before opening navigation.
- Matched fixtures: **10 screenshot pairs**, light/dark and default/iOS XXXL, populated collection tree and account popup, plus empty collections at both text sizes. [Metadata and source hashes](sidebar-evidence.json) record 402 × 778 product bounds, original 402 × 874 simulator frames, 62/34pt safe-area crop, font files, theme, text scale and computed web bounds. Native single-line controls preserve Core Text glyphs in 16pt line boxes within web’s 32pt rows. Fractional glyph/rasterization differences remain explicit; no arbitrary image-diff threshold used.
- Empty-copy failure retained: standard iOS line breaking did not match CSS `text-wrap: pretty`; a minimal balanced width also produced the wrong final phrase. Final native adapter measures glyph lines, leaves ordinary wrapping alone and avoids a stranded word by comparing non-final line widths. Larger empty-copy now has the same three lines as web, without manual fixture breaks. [Before](pair-sidebar-empty-large-before.png), [after](pair-sidebar-empty-light-large.png).
- Simulator transport proof: nested Typography collection → Inbox clears `collection_id`; Read later requests `read_status=unread`; Archive requests `scope=archive`, all through existing provider/navigation/generated client against the loopback service. Account Light/Dark/Match system work. A mid-theme-transition frame was rejected; final settled light/dark pixels match their generated bg-subtle tokens. Keyboard-open → navigation closes the keyboard; profile opens outside tabs. Public-profile fixture endpoint was initially absent, then added from the generated contract and retried; no production endpoint was changed.
- Device-ref failure retained: after tab navigation, a bare ref required a complete snapshot. Followed the supplied exact emitted ref once, then refreshed snapshots before further input. Task-owned browser tabs were closed. Native evidence remains simulator/fictional transport, not physical install, real account or spoken VoiceOver proof.
- Final mobile typecheck, lint (93 files, token checks; 12 warnings/no errors), and Jest **40 passed suites / 315 passed tests / 1 skipped** pass. Web typecheck passes. Production inputs/backend source remain identical to deployed `671e278` and its successful exact-SHA gate; no backend redeploy or merge.
- Archive preflight also passes with process-scoped case-sensitive Git settings and a private Git config file, preserving the repository’s `core.ignorecase=true` and all agent hooks. This avoids changing shared repository configuration during packaging.

- Sign-out control reached the existing “Connect to finish signing out” guard. The prior ad-hoc simulator dev client has an **empty entitlement set**: normal SecureStore had worked, but the shared Keychain write required before revocation did not. The correct distribution IPA’s shared group and resolved Info value were independently verified; production auth/storage guards were not changed. A task-owned simulator copy was re-signed with resolved groups, but T3 launch failed with “Simulator device failed to open cosmicdolphin://” (xcrun 115), including its prescribed debug retry. Stopped simulator automation and restored the original dev client with an install only. [Blocked-state evidence](flow-sidebar-signout-blocked.png). Successful sign-out remains for physical/signed-session acceptance; mock auth-boundary tests pass. No signed-out screenshot is claimed.

- Correction committed/pushed as `a077ea5472b764044bf0acac11b955fa20e3d7d2`. Local production build **1.0.0 (24)** completed, source archive HEAD matched that exact SHA. Signed host + extension signatures, App Store profiles, version/build, minimum iOS 15.1, shared App Group and shared Keychain entitlements **and resolved native Info configuration** verified. `get-task-allow: false`, export-compliance false, production API/issuer and all 12 serif font hashes verified. [Artifact receipt](sidebar-testflight-evidence.json); IPA SHA-256 `6ac55d9d97b9f44ce11c20465256141cb4d34b043f1213caea8bf8adda543ebd`. Temporary signing credentials were cleaned up by EAS; repo Git configuration remained unchanged.

- Correction submission [1e78ae1c-5110-46e2-ad12-b5d819872c8e](https://expo.dev/accounts/cosmic-dolphin/projects/cosmic-dolphin/submissions/1e78ae1c-5110-46e2-ad12-b5d819872c8e) **FINISHED**. Apple accepted the verified local build 24. First read still showed 23 as newest; processing and Beta membership remain pending, distinct from completed upload.

- Final correction availability: **1.0.0 (24), VALID, IN_BETA_TESTING, unexpired**, external `READY_FOR_BETA_SUBMISSION`. ASC build `0520db66-1a62-4252-a08d-c589d282a09b` is present in the existing internal **Beta** group (`hasAccessToAllBuilds: true`) through its actual group-build relationship. [TestFlight](https://appstoreconnect.apple.com/apps/6758127357/testflight/ios). No new group/testers/public link, PR, merge, backend redeploy, external review or public release.
- Corrected IPA retained at `/Users/paulo.freitas/.cache/cosmic-dolphin-releases/home-parity-20261127/CosmicDolphin-home-sidebar.ipa`; raw private receipts remain in that restricted directory. Final [sidebar artifact/Apple receipt](sidebar-testflight-evidence.json). Source `a077ea54`; final documentation is a separate follow-up commit. Physical installation, real-session and live spoken accessibility proof remain unperformed.

## TestFlight release · 2026-11-27

- User grant: “Build iOS binary and push it to test flight.” Candidate starts at clean `9c5288e55f3b37110b0646e00a09a7b7492e7862` on `feat/mobile-home-web-parity`; internal Beta is the existing intended audience. The grant covers this binary and submission, not a merge or wider rollout.
- Previous simulator/fixture proof and its physical-device/normal-session limits remain accurately labelled. This request authorizes internal TestFlight delivery following that disclosed evidence; no earlier task’s beta exception is adopted as a general waiver.
- Backend/API/worker/shared/contract/client source is byte-identical to deployed `671e278`. Existing exact-SHA backend run [45745401065](https://github.com/pffreitas/cosmic-dolphin/actions/runs/45745401065) passed compiler/tests, migrations, Linux API/worker image builds and deployments. Reusing that unchanged-source evidence; no backend deployment required for Home.
- Native host export-compliance plist was reconciled with the existing `app.json` false declaration; encryption usage is unchanged. No native prebuild.

- Production configuration resolves the production API/issuer and existing public anon key. EAS remote iOS counter is **21**, matching Apple’s latest build; auto-increment will allocate **22**. Explicit production scheme `CosmicDolphin` avoids the test-scheme prompt.
- First archive preflight failed on tracked `.Jules`/`.jules` casing. Both palette blobs are identical. Agent hooks remain intact; `.easignore` retains gitignore exclusions and omits those build-irrelevant paths. Scoped case-sensitive Git configuration was restored after successful archive verification. No local `.env`, dependencies or hooks are packaged; all serif font bytes, RNSVG 15.12.1 and maintained native project were verified.
- Fresh frozen Bun installation, OpenAPI compilation and client build passed. Native share/scene/splash static checks: **3 suites / 5 tests passed**. Home’s previous full mobile gate remains applicable to unchanged JavaScript.

- EAS cloud creation failed after archive upload: Free-plan monthly build quota exhausted (reset shown as December 1). No cloud build ID or submission was created, but remote counter reserved **22**. No subscription purchased. Local EAS distribution build uses **23**, exact archived source `60a86850f2ecafd930a9cf43b68899cb910d6895`, existing host/share signing credentials, and Xcode 27.2. Build-only `GYM_XCARGS=IPHONEOS_DEPLOYMENT_TARGET=15.1` covers old dependency resource-bundle targets; native project remains maintained in place.
- Production submission profile explicitly identifies verified host `com.cosmicdolphin.app`, avoiding ambiguity from extension/test targets. Read-only ASC access used the existing account API key. Existing **Beta** group `2cec83b6-864f-41ef-9434-652ba953e18c` is internal with `hasAccessToAllBuilds: true`; no audience changes.
- Final mobile typecheck and lint (including token checks) passed; lint reported 12 warnings and no errors. Full Jest: **39 passed suites, 307 passed tests, 1 skipped**.
- Local Expo Doctor: 15/18 checks passed; existing multiple-lockfile, committed-native/app-config and SDK package-version warnings retained. EAS continued to signing and Pods; no broad dependency upgrade or prebuild was performed.

- Local archive and App Store export completed successfully: **1.0.0 (23)**, 18.7 MB IPA, SHA-256 `909e1675de1fe17930cdf7823832597b368588fdc5acd0114d41cbbbd3dd5cf1`. Both target signatures/profiles verified, same version/build, minimum iOS 15.1, `get-task-allow: false`, shared App Group and shared Keychain group intact. Production API/issuer and all **12** serif font byte hashes verified in the IPA. Native export-compliance false flag is present. See [signed-artifact receipt](testflight-evidence.json). This is distribution-capability evidence, not physical install/session proof. Temporary signing keychain and provisioning profiles were cleaned up by EAS.

- Submission [2425ecf4-cdfd-4c61-947b-2498601c020a](https://expo.dev/accounts/cosmic-dolphin/projects/cosmic-dolphin/submissions/2425ecf4-cdfd-4c61-947b-2498601c020a) **FINISHED**: Apple accepted the exact verified local IPA. No cloud build ID exists for this local build. First ASC read after upload still showed older builds only; processing and actual Beta availability remain a distinct pending gate.

- Final Apple read: **1.0.0 (23), VALID, IN_BETA_TESTING, unexpired**, external `READY_FOR_BETA_SUBMISSION`. ASC build `8f4e3ded-97dd-4d26-b0ca-a73720416c5d` is present in the existing internal **Beta** group (`hasAccessToAllBuilds: true`), verified through the actual group-build relationship. No new testers/groups/public links. [TestFlight](https://appstoreconnect.apple.com/apps/6758127357/testflight/ios). Delivery is complete; external Beta App Review, App Store release, merge, physical installation and real-account acceptance were not performed.
- IPA retained locally at `/Users/paulo.freitas/.cache/cosmic-dolphin-releases/home-parity-20261127/CosmicDolphin-home-parity.ipa`; private raw build/submission/ASC receipts are in that restricted directory. Sanitized durable receipt: [testflight-evidence.json](testflight-evidence.json). Final full mobile checks reran after the submission-profile change with the same passing counts. Origin/main remains `671e278`; branch delivery only, no PR/merge/backend redeploy.

## MacBook result · 2026-11-26 local / 2026-11-27 UTC

### Native build

- `bun install` completed; API client workspace build also completed. No lockfile churn from installation.
- `pod install` linked RNSVG **15.12.1**. Commit includes Podfile.lock and the required RNSVG resource bundle references in the maintained Xcode project. No native prebuild.
- Xcode **27.2 (27B52)**, iOS 27.0 iPhone 18 Pro simulator, T3 local device `3C7F9D5E-A343-4DB8-B75F-671CA10AC69A`. Device interaction used this thread's pinned agent-device command throughout.
- First build failed: Xcode rejected resource-bundle deployment targets 12.4/13.4 in RNSVG/RNCAsyncStorage. Build-only `IPHONEOS_DEPLOYMENT_TARGET=15.1` override succeeded. No deployment target policy change committed.
- Unsigned simulator build rendered but produced SecureStore entitlement errors. Rebuilt with simulator ad-hoc signing (`CODE_SIGN_IDENTITY=-`), installed and ran successfully; auth persisted and native SecureStore worked. This is simulator signing evidence, not distribution capability proof.

### Changes from rendered comparison

- Shared illustrative JSON now drives both `/dev/home` fixtures. Web `?parity=1` uses HomeView, AppShell and the actual root-owned BottomNavigation, with the dev state strip omitted. Production appearance is unchanged.
- Native balanced-title adapter measures the loaded glyphs to reproduce web `text-wrap: balance`; no title-specific manual breaks. Core Text baseline offsets preserve surrounding line boxes.
- Added optical cuts 16/22/23/26/27/38/46 for larger Dynamic Type; default cuts remain byte-identical. Tracking now scales explicitly on iOS. Count controls use tabular numerals.
- Attribution separators travel with their following segment; the update timestamp stays whole at larger text sizes.
- Full gallery: pending row uses the web 16pt saving role and compact active marker; digest matches its label/title/summary/points/source-overflow/social composition, preserves long-press Open, and uses existing owner-bound generated digest endpoints for reactions/sharing. Private rows retain the lock beside the title and warning note.
- Home tab bar overlays scrolling content on a generated `nav-surface` token (web bg-panel at 95% opacity). The logo has web's edge stroke.
- Empty scopes include web's Inbox icon, grouped copy and primary recovery action. First-save hero, control type and spacing were aligned against its rendered web wrapper.
- Comments sheet now avoids the keyboard. Reproduced before changing code: keyboard covered the sheet and Post. After: typed, posted, refetched and closed in place with keyboard present.

### Evidence and comparison

See [capture metadata](evidence.json). All product pairs are **402 × 778 logical pixels/points**. Native originals are 402 × 874 points at 1x (simulator backing scale 3x); crop removes only top 62pt and bottom 34pt OS safe areas. Web uses 402 × 778 CSS viewport at 1x. No product bounds are shifted or rescaled for the default comparison.

Dates/greeting/update time frozen at `2026-11-26T23:00:00Z` / four minutes earlier. Same titles, summaries, ranking reasons, identity fallbacks and resume progress/times; fixtures carry no lead image. Brand artwork and Lucide icons were inspected. Source inventory/font hashes are recorded in metadata and the font manifest.

| State | Matched files | Result |
| --- | --- | --- |
| Light, default iOS Large (1.0) | `web-light-default.png` / `native-light-default.png` | Same headline/summary line breaks, ordered anatomy, gutters, controls and card bounds; fractional native rounding remains. |
| Dark, default | `web-dark-default.png` / `native-dark-default.png` | Same palette, border/identity treatment and hierarchy. |
| Light, iOS XXXL (23/17) | `web-light-large.png` / `native-light-large.png` | Same wrapping with scaled tracking, optical cuts and grouped timestamps. |
| Dark, iOS XXXL | `web-dark-large.png` / `native-dark-large.png` | Same geometry/wrapping as light translation. |
| Empty For you / Following / Unread | `web-empty-*.png` / `native-empty-*.png` | Same ground, icon, title/body wrapping and recovery control; scopes remain usable. |
| Full gallery · pending / digest / private | `pair-full-top.png`, `pair-full-digest.png`, `pair-full-tail.png` | Same production web/native variants; digest and tail use recorded scroll offsets. |
| First-save hero | `web-new-user.png` / `native-new-user.png` | Same hierarchy, wrapper spacing, URL field and explanatory steps. |

`pair-*.png` shows **web left, native right**. Larger web captures are a documented CSS text-scale fixture (23/17; operable controls capped at 1.3), not browser zoom or browser Dynamic Type proof. UIKit blur is not CSS blur; antialiasing is reviewed separately from geometry. No global pixel-diff tolerance was used to excuse layout errors.

### Simulator interactions

These use production native Home/provider/navigation/generated-client boundaries, against `local-service.mjs` (fictional Supabase auth + in-memory loopback HTTP, no real backend/database writes). HTTP receipts: `flow-requests-first-run.json`, `flow-requests.json`, `flow-requests-final.json`.

- Signed in through the native form; switched For you → Following → Unread and back. Requests contain distinct scope values and returned different feed items.
- Continue reading opened the unified Read view and restored **64%**. Lead story used `/bookmarks/shared/bk_8f2a`, not the owner's detail route.
- Comments fetched only on opening; typed and posted while keyboard stayed visible; heading became `1 comment`, field cleared, list refetched, close returned to the retained feed position.
- Omnibox URL showed Save, cleared on submit, entered the real durable capture provider and reached HTTP POST. Corrected harness response and Retry acknowledged `Saved privately to your Library`.
- Pulled the native list down; a new feed/resume/count fetch returned empty data. Verified all scope-specific empty copy, and Unread's Back to For you action.
- `flow-*.png` files are simulator interaction evidence. They are not matched web captures or real-user usage evidence.

### Failures retained

- T3 preview failed twice with “The browser is not producing screenshot frames.” Followed its restore advice once, then used the Playwright skill/CLI for the web reference. T3 device access remained in use.
- Initial web render failed because runtime env was absent. Started both apps with loopback fixture env values; no environment file edited.
- Metro could not resolve a JSON fixture outside its app watch roots; moved the shared fixture into `apps/mobile/dev` and imported it from web. This is data only, no cross-platform renderer import.
- T3 refs expired after keyboard/state changes; refreshed snapshots. A secure-field fill hit the visibility toggle before focus; refocused the visible field. Synthesized scroll did not move the list; followed the tool's raw-drag advice. No tool-dispatched action alone was treated as behavioral proof.
- Harness initially omitted the progress envelope (reader showed 0%) and the create response's required `message` (capture entered Retry). Fixed the harness to match generated contracts and repeated both paths; production auth/API code was not relaxed.
- React Native emitted `Sending onAnimatedValueUpdate with no listeners registered` during restarts/transition cleanup. The LogBox-contaminated larger-text frame was rejected and recaptured after a settled relaunch; no production warning filter was added.
- Light/XXXL bootstrap capture had not settled its safe-area/header bounds. Replaced it after asserting the toolbar y≈72.67pt and date y=158pt/height≈17.67pt; the failed frame is `native-light-large-bootstrap.png`.
- Hot-reload/startup frames were rejected as final captures. Initial rendering is retained as `native-initial.png` / `web-initial.png`; the native initial image contains the unsigned Keychain error overlay.
- The keyboard-covered comments screenshot is `flow-comments-keyboard-before.png`; the fixed, keyboard-present screen is `flow-comments-keyboard-after.png`.
- Expanded gallery regression: digest long-press Open handler was lost during the visual rewrite. The existing regression failed; restored the handler, preserved its assertions and reran the two affected suites (43 tests passed) before the final full gate.
- Visual fixes were made after simulator reproduction, not test-first. Existing behavioral assertions/timeouts were preserved.

### Delivery

- Branch `feat/mobile-home-web-parity` pushed and remote verified at implementation commit `c2792c5e`. The following documentation-only commit records this delivered state.
- Simulator remains on the dev Home fixture, restored to light/default text size. Task-owned Metro (8081), web dev server (3001) and local fixture service (5537) remain available for inspection. Verification browser sessions were closed.

### Final verification

- Mobile `tsc --noEmit`: pass.
- Mobile lint: pass, including lint:tokens and tokens:check; ten pre-existing warnings.
- Full mobile Jest: **39 suites, 307 tests passed, 1 skipped** after final tracking change.
- `bun run tokens:test`: **11 passed**. Web `tsc --noEmit`: pass.
- Native Debug simulator build: pass with documented build-only deployment target override and ad-hoc signing. Share extension, entitlements and test targets preserved.

## Earlier history

Original Linux starting record: main at `4c8d362f18b8e495a6ffe33d103f77c32554dda6`, design-system reconciliation initially uncommitted. This predates the two pushed commits and the MacBook continuation. The user's explicit web-composition decision supersedes the original scope assumption.

## Earlier Linux evidence · superseded by MacBook proof above

Web development server started on 3001. /dev/home uses production HomeView and AppShell. Native device access returned disabled; do not claim simulator/physical proof. Existing mobile uses three tabs, black header, topic chips, Today's 5 and capped tail; web uses omnibox shell, edition header, scope control, resume strip, lead + rows and five compact navigation cells.

## Earlier 2026-11-27 continuation · before the MacBook native build

- Comments action opens a native comment sheet over the feed (web CommentDrawer behavior: fetched only when opened, owner-bound requests, count heading, "Add a comment", edited marker). Web's reply, edit, delete and report controls are not ported. Native bookmark detail does not have them either.
- Added test: opens comments, posts as owner, refetches, closes in place (`apps/mobile/app/__tests__/home-edition.test.tsx`).
- Lint errors fixed (unescaped apostrophes, unused vars).
- Gates: mobile `tsc --noEmit` passed; `bun run lint` passed (incl. lint:tokens, tokens:check); full mobile jest run passed after the changes (39 suites, 306 tests, 1 skipped).
- New native dependency: `lucide-react-native` needs `react-native-svg` 15.12.1. No expo-updates, so there's no OTA crash risk, but existing dev clients need a rebuild.
