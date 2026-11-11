# Signal mobile implementation

The Expo app now implements the approved mobile direction in `docs/design-system/prototypes/mobile/`. Home combines discovery with a personalized feed; Explore is a redirect for old links. Recommendation-explanation controls are intentionally absent.

## Connected behavior

- Home uses the existing ranked feed, public discovery and continue-reading endpoints through the generated API client. AI-generated digests retain their complete server-authored source sets. Pipeline-generated tags form topic sections, including normalized AI and self-improvement topics. Topic headings and generic descriptions are UI copy; the client does not invent an AI thesis. Topic detail opens the complete available list. Reading preferences can prioritize interests or hide a topic with Undo.
- Public recommendations are saved through the reshare API; they are never silently added to Library. Owned saves and recommendations share a source-first reading entry point.
- Library remains private and chronological, with read filters, oldest/newest ordering, collections, Inbox, Archive, manual filing and archive/restore. Offline fallback retains the existing account-specific bookmark cache. Paging ignores stale filter/account responses and prevents concurrent duplicate loads.
- In-app capture creates a pending row immediately, continues the request while the user browses, and offers retry without losing private-link fields. Captures are durably serialized in the app save queue before transport and replay only for their owning account. A completed capture invalidates the visible feed/library. The existing OS share-intent route remains available.
- Detail shows real summaries/key points and source attribution, processing/retry, explicit read controls, public conversation and an explicit publishing confirmation. Merely opening Share never publishes a private save.
- The reading view shows the full saved Cosmic brief exposed by the current API. It does **not** claim to show the original article body. The original source remains a separate browser action. Reading size is stored in device preferences; scroll progress and private highlights use existing services. The reader exposes selectable text; users copy and paste a passage into the highlight sheet with an optional note. The app does not automatically read the clipboard.
- Profile uses real account/public-save APIs and provides profile editing. Settings persist appearance, reading size and topic preferences per account on the device. Placeholder account/support actions were removed.
- Inter and Source Serif 4 are bundled and loaded before splash dismissal. Signal's generated color/radius/spacing tokens remain canonical; no generated client or theme files were edited.

## Local checks

From `apps/mobile`, run `bun x tsc --noEmit`, `bun run lint`, and `bun run test -- --runInBand`. The native bundle check is `bun x expo export --platform ios --platform android --output-dir /tmp/cosmic-dolphin-native-export` (bundle export, not a signed binary build).

Implementation validation passed TypeScript checking and the full mobile test suite (48 passed, one pre-existing skipped test). Lint completed with zero errors and five existing warnings. iOS and Android Hermes bundle exports completed successfully; export does not exercise native device behavior.

UI verification exercised actual Expo React Native Web flows at phone dimensions, with screenshots inspected, an isolated fake session and intercepted API fixtures. These checks do not authenticate against a hosted project or mutate real user data. iOS/Android device testing, system text scaling, keyboard behavior, native text selection and OS share-extension round trips still require a simulator or physical device; none is attached in this environment.

No API contract changes or migrations are required for these client surfaces. Wider web discovery, ingestion and AI digest generation continue to follow the existing server/worker behavior; this change adds no external-news crawler or new recommendation-generation service.

## Save-only share credentials

The app serializes issuance, foreground repair and acknowledged revocation before sign-out.
The extension never receives the Supabase JWT. `modules/share-queue` writes the exact shared
keychain JSON using the native bridge: SecureStore 15 appends `:no-auth` to its service,
which differs from the approved `com.cosmicdolphin.share` service. Both native targets compile
`SharedShareKey.swift` and carry `$(AppIdentifierPrefix)com.cosmicdolphin.shared`; the expanded
access group comes from their Info.plist. Installation IDs use private, device-only SecureStore.

Never run `expo prebuild --clean`. The committed iOS project and extension are maintained in
place; `expo-share-intent` has `disableIOS: true`. Run the test-only `ShareQueueTests` scheme
with `DEVICE_TEST_ID`. Its small entitled host runs Security and capture fixtures without starting the
React Native app. Capture transport tests use the local API harness described below. XCTest is
simulator evidence; it does not establish
signed-device provisioning capability. Native signed preview proof remains a separate gate.


## Native iOS share capture and import

The maintained Swift extension saves on open with the restricted shared key and sends only
URL/capture fields to the bookmark POST. It completes its extension context after the result;
it never opens the host or reads/refreshes a Supabase session. VoiceOver retains the result and
Close. Reduce Motion replaces rotation with a stationary ring. Titles use the app's bundled
serif and the panel loads canonical Signal tokens directly from the bundled tokens.json resource.

The app group is `group.com.cosmicdolphin.app`. `pending-shares-v1.json` is a JSON array of at
most 200 `{ id, url, userId?, queuedAt, notBefore? }` entries. The independent
`pending-shares-v1.lock` inode carries an exclusive flock through each mutation. Writes use a
private, protected temporary file, flush it, rename atomically, then flush the directory.
Capture persists a stable recovery row before transport while holding the lease. Success removes
only that ID; any unacknowledged request leaves it recoverable. A hard eight-second deadline
cancels transport. 429 stores Retry-After; 401 retains the owning user durably before clearing the
rejected credential. Credential publishing/clearing also takes the queue lease, preventing a
rejected in-flight save from deleting a newly published key.

The local Expo bridge snapshots and removes IDs under the same lock. CaptureProvider imports on
launch/foreground even while signed out, then the serialized AsyncStorage queue preserves the ID,
original queuedAt/notBefore and ios_share_extension/ios attribution before removing imported group
IDs. Concurrent arrivals remain in the group. Overlapping drains coalesce; newly arrived entries
still send while already attempted failures wait for a later trigger or Retry. Interrupted cleanup
may replay an accepted URL, which the API deduplicates.

The native scheme now includes a real local API fixture. Start its separate loopback-only harness
from the repository root before the XCTest command:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun apps/mobile/ios/ShareQueueTests/local-api-fixture.mjs
xcodebuild -project apps/mobile/ios/CosmicDolphin.xcodeproj -scheme ShareQueueTests -destination "platform=iOS Simulator,id=$DEVICE_TEST_ID" test
```

The harness requires the disposable database marker and owns one fictional account, removed on
SIGTERM. Its explicitly injected test auth boundary is isolated from the normal API; it never
changes JWT middleware or forwards hosted business writes. Processing enqueues are counted in
this harness. Normal branch API/worker proof uses the separately guarded local pgmq infrastructure.
Never run truncating backend suites while this native fixture or device proof is active.
Native fixture publication tests support Safari/bridge probes; run the existing Z keychain cleanup
and remove only the probe's own queue IDs afterwards. Simulator and XCTest results are checkpoint
evidence. Normal-issuer signed-in replay, signed physical-device interoperability and the 20 Wi-Fi
plus 20 LTE latency trials remain package proof requirements.
