# Star-field mobile header · 2026-11-27

**Current outcome:** source `0837ab7c` pushed; production web ACTIVE; iOS 1.0.0 (28) available in the existing internal TestFlight Beta group.
**Active gate:** production delivery complete, exact source/artifact/Apple membership verified.
**Next gate / owner:** physical signed-session and spoken-accessibility acceptance remain separate / device QA or user.
**Blocker:** none for this release. Automatic cloud previews remain blocked by EAS credits until December 1;
the verified local production iOS build succeeded. Starting clean base was
`04cb68dc4b345d50912a20da4cfdcafb3bc4be82`; no incoming remote changes at delivery.
The floating navigation remains the bottom-left control. Final sanitized receipt: [release-evidence.json](release-evidence.json).

## User scope

Make the native and mobile-web header dark with a subtle star field. Blend it into the light
page. The initial alpha-mask/irregular-edge brief was superseded when the user rejected the
light-theme fade and requested the strongest professional design solution. Use Meshy,
including its CLI as clarified by the user. Keep existing header controls and capture/search behavior.

## Asset generation

The official CLI is available through the existing `meshy-cli@0.4.0` npm runner, outside PATH.
Verified production Meshy access; existing session reused. One `text-to-image` task:
`01a22004-10f2-719d-9e6f-563cd5d93fe2`, `nano-banana-pro`, 16:9.
Published estimate: 9 credits, pricing read November 27; balance before generation 826.
Task succeeded and reported **9 consumed credits**. Original image, sanitized receipt and prompt
are retained in `assets/header-starfield`; generation/download both used the official CLI.
Full prompt: `assets/header-starfield/prompt.txt`. No paid variant or retry submitted.
A missing local payload file was rejected before HTTP submission; wrote the payload and submitted once.

## Current design decision

The fade created a muddy gray band against white. The revised design deliberately separates
navigation and reading: a 72px dark star-field masthead, then a completely opaque reading
surface. The user’s latest request moves the 24px curves onto the **masthead bottom corners**,
leaving the body’s top edge straight. In light theme the page is pure white; dark retains its page
color. No shadow, feathered edge or simulated translucency is used at that boundary.

This hierarchy gives the cosmic identity one restrained placement while preserving a clean
reading area. Native Home, Library and saved detail use the same composition as mobile web.
Hint panels and floating navigation remain outside the clipped decorative header image. The existing
Meshy plate is reused; no additional paid generation or variant was submitted.

## Historical fade trial

The original masked implementation passed technical checks but was rejected by the user as
visually ugly in light theme. Its images are retained in `history/`; they are diagnostics, not
the current design contract. The alpha-mask assets were task-owned and are no longer consumed.

## Verification

- Native: 340 tests pass (43 suites, one skipped); typecheck and lint pass with 12 existing warnings.
- Web: 445 tests pass (22 files), including 28 new contrast compositions/coverage entries;
  typecheck, lint/a11y/token checks pass with 111 existing lint warnings. Production web build passes.
- Generator: 11 tests pass; all three token outputs match JSON. Native and web plate bytes match.
- Native render: iPhone 17 Pro, iOS 26.5, existing Debug simulator host + current Metro JS/assets.
  Home light/dark, focused omnibox with keyboard, and Library were inspected. Status icons are light
  on the sky, Library's title/search remain readable, and the bottom-left floating menu remains.
  This is current JavaScript/image/asset render proof, not a new signed native build or physical QA.
- Web render: 402 × 778 mobile Home in light/dark, focused URL with Save/hint panel; 72px masthead and 24px header bottom corners
  are measured from rendered styles; light foreground remains token-driven. At 900px the image is hidden and existing tablet
  chrome remains. PNG snapshots are in this directory; Next's dev indicator was hidden for captures.
- First native render had black status icons on the dark sky; corrected the root status-bar style
  for the affected routes and recaptured. The first web full test failed token-coverage assertions;
  registered the new inks and translucent-fill compositions, without weakening contrast thresholds.
- The full-opacity sky has a semantic dark loading fallback. The page is opaque at its boundary;
  only the masthead’s bottom corners are clipped, without clipping header popovers or the floating control.

The latest user grant is “Let’s go with that. Implement it and push to prod.” This authorizes
source delivery and production web plus a signed iOS release to the existing internal TestFlight
Beta audience. Public App Store release and audience expansion are not part of the existing delivery path.

Task-owned Metro, web dev server and loopback fixture service are stopped; browser closed.
Device appearance restored to light and this task’s device claim closed without shutdown.
Generated Next route-import churn was restored. The approved source/artwork are ready for commit and push.

## Corner inversion · latest user direction

The user explicitly requested rounded corners on the header instead of the body. The dark
plate is clipped at its bottom corners; header controls/popovers stay outside that clip.
The page has no top radius. Earlier rounded-body captures are retained in `history/rounded-body`.
The same Meshy plate is reused; no new generation is needed.

## Production delivery · user authorized

Release starts on `main` at `04cb68dc4b345d50912a20da4cfdcafb3bc4be82`, with only the
header implementation/artwork/evidence uncommitted. Fresh fetch confirms no incoming commits.
Local native/web typecheck, lint, full tests, production web build and token checks already pass
on the approved corner inversion. No backend or contract behavior changes; retain the existing
verified backend deployment. Latest automatic mobile preview logs still report exhausted EAS
Free-plan credits until December 1. Use the tested local EAS 27.11.0 production build path with
existing signing/submission credentials; verify exact IPA before one upload. Simulator renders
remain distinct from signed physical/session/spoken-accessibility acceptance.

### Release progress

Approved source `0837ab7c74ee101dc526fb085707343cdcbade35` is pushed on `main`.
[Web run 46101261545](https://github.com/pffreitas/cosmic-dolphin/actions/runs/46101261545)
succeeded; deployment `1038fbdb-c12c-4d32-b0bf-93536378f613` is ACTIVE with that exact image tag.
Live `/images/header-starfield.webp` returns 200 and matches source SHA-256
`bc96545416577de450b05b71761d54dd185bdd0701257cee32d867434383b6c6`; served CSS contains
the masthead token/selector. Native local archive source matches, app/extension 1.0.0 (28),
signatures/profiles/shared entitlements/production API/issuer/29 serif assets and starfield bytes verified.
IPA SHA-256 `d07e86bad81cfa7c07e145d68a2ae9f28b18ba2e5cc7f44e9971f8213ed6deda`.
[Submission 042e59f0](https://expo.dev/accounts/cosmic-dolphin/projects/cosmic-dolphin/submissions/042e59f0-c18d-4150-a87c-4c1c4323400b)
was scheduled once, without auto TestFlight group setup, and FINISHED at 03:10:30Z on November 28.
First Apple read still shows 27 newest; processing/group availability of 28 remain pending.
Automatic iOS/Android preview jobs failed on exhausted cloud credits; mobile quality passed.
Existing production backend is healthy; no backend/contract changes or redeployment required.
EAS temporary signing credentials were cleaned up. CLI casing preflight briefly altered shared
ignorecase despite the process override; restored its prior true value immediately after packaging.
Private raw receipts and signed artifact are retained under the task-owned release cache.

### Final availability

Apple processed iOS **1.0.0 (28)**: VALID, IN_BETA_TESTING, unexpired. Build
`e8eaf14d-0b68-45f6-8101-2fcbf5eb3709` is present in the actual existing internal **Beta** group
`2cec83b6-864f-41ef-9434-652ba953e18c`, verified after the successful single upload.
[Apple TestFlight](https://appstoreconnect.apple.com/apps/6758127357/testflight/ios).
No group/tester expansion, external beta review, public App Store rollout, duplicate upload or
backend redeployment. Web and native release states are complete; signed physical/session/spoken
accessibility acceptance remains separately open. Task-owned local build workspace removed;
IPA, inspection scripts and restricted raw receipts retained in the release cache. Final receipt
and task-record completion are local documentation; production source remains the pushed `0837ab7c`.
