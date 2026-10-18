# Signal mobile implementation

The Expo app now implements the approved mobile direction in `docs/design-system/prototypes/mobile/`. Home combines discovery with a personalized feed; Explore is a redirect for old links. Recommendation-explanation controls are intentionally absent.

## Connected behavior

- Home uses the existing ranked feed, public discovery and continue-reading endpoints through the generated API client. AI-generated digests retain their complete server-authored source sets. Pipeline-generated tags form topic sections, including normalized AI and self-improvement topics. Topic headings and generic descriptions are UI copy; the client does not invent an AI thesis. Topic detail opens the complete available list. Reading preferences can prioritize interests or hide a topic with Undo.
- Public recommendations are saved through the reshare API; they are never silently added to Library. Owned saves and recommendations share a source-first reading entry point.
- Library remains private and chronological, with read filters, oldest/newest ordering, collections, Inbox, Archive, manual filing and archive/restore. Offline fallback retains the existing account-specific bookmark cache. Paging ignores stale filter/account responses and prevents concurrent duplicate loads.
- In-app capture creates a pending row immediately, continues the request while the user browses, and offers retry without losing private-link fields. Captures are held in memory for the session, not an offline queue. A completed capture invalidates the visible feed/library. The existing OS share-intent route remains available.
- Detail shows real summaries/key points and source attribution, processing/retry, explicit read controls, public conversation and an explicit publishing confirmation. Merely opening Share never publishes a private save.
- The reading view shows the full saved Cosmic brief exposed by the current API. It does **not** claim to show the original article body. The original source remains a separate browser action. Reading size is stored in device preferences; scroll progress and private highlights use existing services. The reader exposes selectable text; users copy and paste a passage into the highlight sheet with an optional note. The app does not automatically read the clipboard.
- Profile uses real account/public-save APIs and provides profile editing. Settings persist appearance, reading size and topic preferences per account on the device. Placeholder account/support actions were removed.
- Inter and Source Serif 4 are bundled and loaded before splash dismissal. Signal's generated color/radius/spacing tokens remain canonical; no generated client or theme files were edited.

## Local checks

From `apps/mobile`, run `bun x tsc --noEmit`, `bun run lint`, and `bun run test -- --runInBand`. The native bundle check is `bun x expo export --platform ios --platform android --output-dir /tmp/cosmic-dolphin-native-export` (bundle export, not a signed binary build).

Implementation validation passed TypeScript checking and the full mobile test suite (48 passed, one pre-existing skipped test). Lint completed with zero errors and five existing warnings. iOS and Android Hermes bundle exports completed successfully; export does not exercise native device behavior.

UI verification exercised actual Expo React Native Web flows at phone dimensions, with screenshots inspected, an isolated fake session and intercepted API fixtures. These checks do not authenticate against a hosted project or mutate real user data. iOS/Android device testing, system text scaling, keyboard behavior, native text selection and OS share-extension round trips still require a simulator or physical device; none is attached in this environment.

No API contract changes or migrations are required for these client surfaces. Wider web discovery, ingestion and AI digest generation continue to follow the existing server/worker behavior; this change adds no external-news crawler or new recommendation-generation service.
