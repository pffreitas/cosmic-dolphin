# Native Home web parity · 2026-11-26

- Outcome: implementation committed on `feat/mobile-home-web-parity`; JS gates green on 2026-11-27. Not rendered on a device yet.
- Next gate: rendered simulator comparison against web /dev/home, after a native rebuild that links react-native-svg (Podfile.lock has no RNSVG; `pod install` must run on macOS).
- Owner: continuing on the MacBook T3 environment (device access available). Branch `feat/mobile-home-web-parity`. Blocker on the Linux host was disabled T3 agent device access, so no simulator, fixture-device or physical proof exists yet.
- Baseline: main @ 4c8d362f18b8e495a6ffe33d103f77c32554dda6, with preceding design-system reconciliation uncommitted. Preserve that work and all untracked user studies/specs/screenshots.
- Scope assumption: signed-in Home (/my/dashboard), not marketing landing. Asked asynchronously whether composition should replace Today's 5; after opportunity for response, proceeding with the user's stated web-parity goal. No backend changes, native prebuild, release or unrelated screen redesign.

## Evidence

Web development server started on 3001. /dev/home uses production HomeView and AppShell. Native device access returned disabled; do not claim simulator/physical proof. Existing mobile uses three tabs, black header, topic chips, Today's 5 and capped tail; web uses omnibox shell, edition header, scope control, resume strip, lead + rows and five compact navigation cells.

## 2026-11-27 resume

- Comments action opens a native comment sheet over the feed (web CommentDrawer behavior: fetched only when opened, owner-bound requests, count heading, "Add a comment", edited marker). Web's reply, edit, delete and report controls are not ported. Native bookmark detail does not have them either.
- Added test: opens comments, posts as owner, refetches, closes in place (`apps/mobile/app/__tests__/home-edition.test.tsx`).
- Lint errors fixed (unescaped apostrophes, unused vars).
- Gates: mobile `tsc --noEmit` passed; `bun run lint` passed (incl. lint:tokens, tokens:check); full mobile jest run passed after the changes (39 suites, 306 tests, 1 skipped).
- New native dependency: `lucide-react-native` needs `react-native-svg` 15.12.1. No expo-updates, so there's no OTA crash risk, but existing dev clients need a rebuild.
