# Floating mobile navigation · 2026-11-27

**Current outcome:** complete locally in native and mobile web; final checks pass.
**Next gate / owner:** commit and synchronize `main` with `origin/main` / current agent,
authorized by the user on November 27.
**Blocker:** none. Implementation and render verification are complete. Rendered simulator
evidence is separate from physical/session QA; TestFlight distribution remains separately scoped.

## Approved scope and starting state

The user's November 27 request replaces the top menu control and bottom navigation with a
bottom-left floating hamburger button in both the native app and mobile browser. Match the former
bar's opacity and add a gentle shadow. This supersedes the older three-/five-tab navigation
requirements for this task; existing capture, reading, account and routing behavior stays binding.

- Branch: `main`; base: `7b16eb68f42b9e8f5e5422e7d5bb3d7530479bc8`.
- Starting working tree: clean. Environment files and native project configuration preserved.
- References: design-system README/patterns/foundations, native-parity continuation guide,
  approved Save + Today's 5 spec and Home task record. The existing production-component
  `/dev/home` and native Home fixture are the visual review surfaces for this narrow revision.

## Implementation

Web's AppShell owns the floating SheetTrigger below 768px. Tablet's top trigger and desktop's
sidebar remain. Root/gallery bottom bars are removed. Native Home and saved detail reuse a
FloatingNavigation renderer; the remaining tab routes render it instead of a BottomTabBar.
All use 48px touch targets, 16px safe-area gaps, 20px hamburger, existing 95% nav surface and
shared `shadow-floating-nav` tokens. The native focus outline stays outside the blur clip.

The existing drawer retains destinations, collection queries and the account menu. Save a link
is included in compact navigation to preserve the old bar's capture shortcut, using the current
Save controller. Native drawer fields/count requests are keyed by account and close on blur;
web waits for the drawer's close-focus event before opening the existing capture dialog.

## Evidence and failures retained

- Initial focused native navigation: 13/13 passed. Web semantics: 19/19 passed.
- First full native run: 336 passed, 2 failed, 1 skipped. Both failures expected removed tab labels
  in the Signal accessibility suite; updated those assertions to verify floating-control focus
  and drawer label scaling rather than dropping the coverage.
- First mobile-web render measured a 48 × 48 fixed control at x=16, y=714 in 402 × 778.
  Its shadow was absent: Tailwind interpreted the arbitrary shadow variable as a color.
  Added a named semantic boxShadow utility and recaptured after checking computed shadow.
- The first installed native binary showed unimplemented SVG components. Rejected that render;
  building the committed iOS project in place, without prebuild or native configuration edits.
- A native dark capture taken during the system theme transition, and a subsequent debugger-warning
  overlay frame after Metro stopped, were rejected. Recaptured settled dark after the bound device
  command verified the development overlay was dismissed. No app warning suppression was added.
- Web captures hide only Next's development indicator, which otherwise covers the same bottom-left
  corner. They are local development fixtures, not production/session or physical-device proof.

## Final verification

- Native: 42 passing suites, 338 passing tests, one skipped; typecheck passes; lint has no errors
  and 12 existing warnings. All token-linted files pass.
- Web: 22 passing files / 417 tests; typecheck passes; lint has no errors and 111 existing warnings;
  accessibility/token lint passes. Final production Next build succeeds after the shadow fix.
- Shared token generator: 11 tests pass; all three generated files match JSON.
- Fresh iOS Debug simulator build succeeds against the committed native project. Installed on
  the task's iPhone 17 Pro / iOS 26.5; native light/dark captures show the 48pt hamburger control,
  16pt safe-area offsets, retained toolbar omnibox and no bottom bar. Drawer opens and closes,
  exposing Save, Home, Search, Library queries/collections and account. A stale device ref was
  rejected before dispatch, then refreshed and the same action succeeded.
- Web mobile: 402 × 778 fixture; control bounds `{x:16,y:714,width:48,height:48}`, fixed position,
  both themes use 95% nav surface and computed gentle shadow. Drawer Save emits exactly one
  existing capture-dialog event after drawer closure. At 900px the 34px top menu remains;
  at 1280px it is hidden and the sidebar is visible.
- Captures: [web light](web-light.png), [web dark](web-dark.png),
  [native light](native-light.png), [native dark](native-dark.png), [native drawer](native-drawer.png).
  These are fixture visuals and simulator interaction evidence. They do not certify Android,
  physical-device signed sessions or spoken VoiceOver. Historical full parity acceptance remains
  owned by the native-parity handoff, outside this navigation revision.
- Task-owned Metro, web dev server and in-memory fixture service stopped; browser session closed.
  Device appearance restored to light and this task's claim closed without shutting down the device.
  Build output removed. Next's generated route-import churn restored to its starting value.


## Remote delivery · 2026-11-27

The user explicitly requested committing, pulling and pushing this change to the remote.
Fetched `origin` before committing and checked main ancestry; no source edits occurred after
the passing native/web gates. Remote synchronization is the active delivery step.
