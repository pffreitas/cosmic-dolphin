# Mobile implementation

The Save + Today's 5 package follows the approved spec at
`docs/specs/mobile-reading-app/2026-11-09-save-and-todays-5.md` and its named native S-states.
Home puts durable pending captures above the server's immutable five picks. The reader has
Brief/Read, explicit Done/Next pick, private notes and recoverable failed extraction. Explore
and old reader links redirect to their approved destinations. Library and public web behavior
remain compatibility requirements.

## Release and proof status

Last verified release: 2026-11-12, version1.0.0/build15, deployed head `10e8ad56de7643fb404ca655c52a7cbab257e819`, available to the existing internal Beta group. [Backend production](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43137645677) and [mobile quality/submission scheduling](https://github.com/pffreitas/cosmic-dolphin/actions/runs/43139079920) succeeded; Apple processing and actual group assignment were verified separately. The [release runbook](../../docs/runbooks/backend-and-testflight-release.md) and [retrospective](../../docs/retrospectives/2026-11-12-save-and-todays-5.md) preserve the reusable procedure.

The user's explicit beta exception moved unavailable real-session/physical/live-spoken/full native matrix evidence to beta validation. Historical checkpoint limitations below remain unpassed; they do not reinstate the superseded pre-review block. Do not generalize this exception to future work. Local receipt paths below are historical evidence locations, not a durable release-state index.

## Connected behavior

- Home uses the existing ranked feed, public discovery and continue-reading endpoints through the generated API client. AI-generated digests retain their complete server-authored source sets. Pipeline-generated tags form topic sections, including normalized AI and self-improvement topics. Topic headings and generic descriptions are UI copy; the client does not invent an AI thesis. Topic detail opens the complete available list. Reading preferences can prioritize interests or hide a topic with Undo.
- Public recommendations are saved through the reshare API; they are never silently added to Library. Owned saves and recommendations share a source-first reading entry point.
- Library remains private and chronological, with read filters, oldest/newest ordering, collections, Inbox, Archive, manual filing and archive/restore. Offline fallback retains the existing account-specific bookmark cache. Paging ignores stale filter/account responses and prevents concurrent duplicate loads.
- In-app capture creates a pending row immediately, continues the request while the user browses, and offers retry without losing private-link fields. Captures are durably serialized in the app save queue before transport and replay only for their owning account. A completed capture invalidates the visible feed/library. The existing OS share-intent route remains available.
- Detail shows real summaries/key points and source attribution, processing/retry, explicit read controls, public conversation and an explicit publishing confirmation. Merely opening Share never publishes a private save.
- The owner reading view offers Brief and Read. Read uses the content endpoint for stored extracted article text, bounded to 500,000 serialized response bytes and labelled when partial. Original remains a separate browser action. Private notes, pasted-text recovery and Next pick use owner contracts; public-slug reading never falls back to an owner cache/endpoint. Reading size remains a device preference, and text is selectable. Existing highlights use an explicit pasted passage; the app does not automatically read the clipboard.
- Profile uses real account/public-save APIs and provides profile editing. Settings persist appearance, reading size and topic preferences per account on the device. Placeholder account/support actions were removed.
- Inter and Source Serif 4 are bundled and loaded before splash dismissal. Generated color/radius/spacing tokens remain canonical, with the approved Plum colors in `color.mobile` overrides. Generated clients/themes are updated only through their source pipelines; mobile changes preserve web token bytes unless explicitly scoped otherwise.

## Local checks

From `apps/mobile`, run `bun x tsc --noEmit`, `bun run lint`, and `bun run test -- --runInBand`. The native bundle check is `bun x expo export --platform ios --platform android --output-dir /tmp/cosmic-dolphin-native-export` (bundle export, not a signed binary build).

The T-10 receipts are `/tmp/T-10-receipts/`, with chronological commands, source manifests,
individual samples, signed preview archives and native screenshots; the coordinator receives
`/tmp/T-10-handback.md`. These are local implementation receipts, not a production baseline.
The dedicated HTTP fixtures use actual routes/SQL/generated clients with an explicitly fictional
owner boundary. Optional receipt output requires `T10_RECEIPT_DIR` and a same-candidate
`T10_SOURCE_MANIFEST` CLI snapshot. The fixture rehashes every listed source path and rejects
an empty/changed manifest; the receipt runner retains the snapshot before starting Bun tests. They cover 500-candidate picks (10 warmups, 100 compute and 100 reread
samples, p95 budgets 800/200ms), stored 20,000-word content (10 warmups, 100 samples,
400ms and 500,000 serialized bytes), concurrent deduplication, seven failure reasons,
restricted-key allowlisting, ownership, public stripping, note/key log sentinels and old wire
clients. Timers include HTTP response/body parsing on loopback; they do not measure a phone's radio.

The final integration uncovered SQLSTATE being discarded by the repository error wrapper,
which made a concurrent duplicate return 500. The minimal fix preserves the cause, allowing
the existing duplicate recovery to return the same ID with one enqueue. A public process-lifecycle
red also found native-harness bookmark residue; shutdown now checks the disposable marker,
exact fictional owner/email and source URLs before deleting only its captures/account.
Old assertions remain intact.

Native XCTest exercises the entitled queue/keychain host and fictional local transport separately
from signed preview capability inspection. The iPhone 17 Pro/iOS26.5 simulator can inspect
actual React Native screens through visibly fictional view/transport fixtures. Neither Expo Go,
policy tests nor profile inspection proves a normal-issuer session, a physical radio trial or live
spoken VoiceOver/TalkBack. Android emulator access was refused by an existing foreign device
claim; do not reuse or close that claim. Retain missing package proof explicitly: normal-issuer
host key issuance/repair/revocation/offline Retry, signed app/extension interoperability and
same-account two-device primary outcome/live web, 20 Wi-Fi and 20 LTE status trials,
physical sender return, supported15.x/16+ clipboard behavior, live spoken results/8s Undo,
and the complete signed/native screen matrix at AX3/Android200% and Reduce Motion.
The coordinator owns final AC accounting; no unavailable result is passed or waived.

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

### Scene-based host startup

The host adopts a single UIKit window scene in its committed `Info.plist`.
`AppDelegate` configures the Expo/RN factory; `SceneDelegate` creates the scene's
window and starts the root there. The application delegate retains a compatibility
window reference for Expo SDK54 modules, not a separate legacy window.
`SceneRootHost` retains the root controller across scene disconnection, detaches
it from the old window, and reattaches it without initializing RN again. A
reconnected scene delivers new intents through live link handlers rather than
trying to replace an already-running RN host's initial launch options.

Cold scene URLs/user activities are passed through `SceneLaunchOptions` to RN and
registered with Expo Linking before JS starts. Warm URLs/universal links and scene
lifecycle callbacks forward to the existing app-delegate handlers/subscribers.
`SceneLaunchOptionsTests` exercises the native initial-link dictionary and URL
context mapping; `SceneRootHostTests` covers one startup, root retention and new
intent delivery across disconnect/reconnect. `native-scene-build.test.ts` checks the committed manifest/source
contract; neither test substitutes for an actual Release launch.

When changing Xcode/linked SDK, verify a Release cold launch on the corresponding
iOS major version before submission. Build20 linked SDK27 with legacy window
startup and passed signing/Apple processing, but iOS27 immediately trapped in
UIKit's `NoSceneLifecycleAdoption` check. An iOS26 simulator did not catch it.
Test cold/warm links and background/foreground too; preserve native extension and
app-group/keychain capabilities. Do not repair this by regenerating native projects
or declaring a scene without mounting the root window.

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

## PR quality gate and final verification

`.github/workflows/mobile-pr.yml` listens only to pull requests and matches deploy-mobile's
mobile/client/apispec/root package/lock/deploy-workflow paths plus its own path. It installs
Bun1.3.11 with the frozen lockfile and Java17, regenerates TypeSpec/API client, then runs mobile
lint, explicit local TypeScript and serial Jest. No secret controls whether it runs; it deploys
nothing. `mobile-pr-workflow.test.ts` checks the trigger matrix and executes each actual
command under a failing stub to prove lint/types/Jest stop the job. Live PR job observation
belongs to the coordinator's later package PR and is still pending.

Before review, run the approved task's apispec/shared-build/root-typecheck, all four explicit
backend/mobile tsc commands, serial `test:db`, mobile/web lint and full tests, root token check
and both EAS previews. Local Accessibility equivalents are mobile token lint/generated-token
check plus web's accessibility tests/lint. Use Bun; generated api-client is never edited manually.
For every backend command explicitly set
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin`.
Turbo uses `--env-mode=loose --concurrency=1`. Never overlap truncating suites with
native/API/performance fixtures, run hosted `db:migrate`, or send hosted business queue writes.

Signed previews are internal only. Bind each build ID/artifact SHA to its complete archived
source manifest and public API/normal-issuer configuration. Verify both iOS bundle identifiers,
AppGroup, expanded shared-keychain entitlement and provisioning permissions, plus Android
signature/package/share intent and bundled issuer. A temporary local preview environment
override may avoid inherited remote auth settings and EAS_NO_VCS archive case collisions;
restore eas.json byte-for-byte, change no remote environment and bundle no service-role key.
Archive inspection is source/capability proof; it is not signed-device behavioral proof.

## Weekly read-only measurements

Local T-10 verification on2026-11-11 passed generation, shared build, root typecheck and
explicit shared/API/worker/mobile tsc; forced serial test:db passed shared426/API380/worker10.
Mobile271 passed with one existing skip; web335 and its Accessibility173 passed. Mobile/web
lint and generated/token lint passed; API lint has85 warnings and zero errors, worker source
lint passed. The native ShareQueueTests rerun passed29 with zero failures in12.345seconds.
No old assertion or skip was changed.

The10:19UTC final numeric receipt on source manifest
`cf31b129c7dc1659200d805d25ed43a98a71c3841bea7c5888facf286aeb850f`
measured picks p95 compute21.818416ms/re-read10.906709ms (500candidates,10compute
warmups,100compute+100reread HTTP samples, nearest-rank95); content p959.917667ms and
189,010serialized bytes (20,000words,10warmups,100HTTP samples). This historical observation precedes
the final documentation fold and the marker-only native test-harness fix. Latest candidate
samples and source hashes are retained in `/tmp/T-10-receipts/proof-final/` and the
coordinator verification receipts. Its query fixtures include the corrected G-1
168-hour window under New York spring DST; earlier calendar-day/unbound receipts are
retained as failed/setup characterizations, not accepted final proof.
Retain every sample in `/tmp/T-10-receipts/final-candidate/`. Both signed preview IDs/artifact/
capability hashes and the final archive comparison are in the handback, without treating
loopback numbers, signed permissions or fictional native screens as physical/session proof.

PM supplies `$1` = Monday00:00Z week start and `$2` = next Monday00:00Z. All intervals are
half-open [start,end). Execute each SQL block as a prepared statement in a read-only transaction
with a read-only reporting role. Retain dated aggregate exports, query SHA and observation
cutoff, without raw keys, URLs, notes or an analytics SDK. UTC weeks apply to G-1/3/4/6.
G-2/5 assign each persisted pick day to the UTC week containing its own local06:00 start;
both boundaries use the row's persisted IANA zone independently, so DST days are23/25 hours.
These are eligible stored pick user-days, not app visits; a day whose slots are all hidden/deleted
still counts. Schema forbids a zero-slot row. Never reconstruct original slots from visible cards.

G-1 (`save_to_done_7d`, percent) uses every save in the week's creation cohort, including
historical null capture attribution. Count completion at or after creation and at or before exactly
168 elapsed hours (independent of the reporting session zone). Only publish a mature cohort after week end+7days; unfinished cohorts are pending.
Keep eight baseline weeks and four release weeks with the same definitions. Mutations/deletions
can remove historical read/feedback evidence; preserve aggregate snapshots and disclose this
limitation instead of implying immutable event analytics.

<!-- G-1 -->
```sql
WITH cohort AS (
  SELECT created_at, read_at FROM bookmarks
  WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
)
SELECT count(*) AS saves,
  count(*) FILTER (WHERE read_at >= created_at AND read_at <= created_at + interval '168 hours') AS done_7d,
  100.0 * count(*) FILTER (WHERE read_at >= created_at AND read_at <= created_at + interval '168 hours')
    / NULLIF(count(*), 0) AS save_to_done_7d
FROM cohort;
```

G-2 (`picks_done_per_active_day`) divides original picked bookmarks marked done in their
own [06:00,next06:00) window by all stored pick user-days in the week. A deleted bookmark
cannot be observed done; its original slot/user-day remains in the denominator.

<!-- G-2 -->
```sql
WITH days AS (
  SELECT user_id, bookmark_ids,
    (local_date + time '06:00') AT TIME ZONE time_zone AS begins,
    (local_date + 1 + time '06:00') AT TIME ZONE time_zone AS ends
  FROM daily_picks
), week AS (
  SELECT * FROM days WHERE begins >= $1::timestamptz AND begins < $2::timestamptz
), done AS (
  SELECT count(*) AS n FROM week d
  CROSS JOIN LATERAL unnest(d.bookmark_ids) AS slot(id)
  JOIN bookmarks b ON b.id = slot.id AND b.user_id = d.user_id
  WHERE b.read_at >= d.begins AND b.read_at < d.ends
)
SELECT (SELECT count(*) FROM week) AS pick_user_days, n AS done_picks,
  n::numeric / NULLIF((SELECT count(*) FROM week), 0) AS picks_done_per_active_day
FROM done;
```

G-3 (`ios_extension_pct`) counts extension-attributed iOS saves divided by all saves with
`capture_platform='ios'` in the UTC creation week. Unattributed legacy saves are excluded
from this platform denominator, not silently treated as iOS.

<!-- G-3 -->
```sql
SELECT count(*) AS ios_saves,
  count(*) FILTER (WHERE capture_source = 'ios_share_extension') AS extension_saves,
  100.0 * count(*) FILTER (WHERE capture_source = 'ios_share_extension')
    / NULLIF(count(*), 0) AS ios_extension_pct
FROM bookmarks
WHERE capture_platform = 'ios'
  AND created_at >= $1::timestamptz AND created_at < $2::timestamptz;
```

G-4 (`saves_per_active_user_week`) counts all UTC-week saves divided by the distinct union
of people who saved or marked done in that week. It counts saving/reading activity, not visits.
Export the same eight baseline and four release weeks; a zero denominator is unknown (NULL).

<!-- G-4 -->
```sql
WITH saves AS (
  SELECT user_id FROM bookmarks WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
), active AS (
  SELECT user_id FROM saves
  UNION
  SELECT user_id FROM bookmarks WHERE read_at >= $1::timestamptz AND read_at < $2::timestamptz
)
SELECT (SELECT count(*) FROM saves) AS saves, count(*) AS active_users,
  (SELECT count(*) FROM saves)::numeric / NULLIF(count(*), 0) AS saves_per_active_user_week
FROM active;
```

G-5 (`rejection_pct`) counts original slots with that owner's `not_interested` feedback
created during their pick day, divided by all originally stored slots before hides/deletion.
Undo before send creates no row and contributes zero. Other feedback kinds and late feedback
are excluded; existing-feedback deletion/history limits must accompany reporting snapshots.

<!-- G-5 -->
```sql
WITH days AS (
  SELECT user_id, bookmark_ids,
    (local_date + time '06:00') AT TIME ZONE time_zone AS begins,
    (local_date + 1 + time '06:00') AT TIME ZONE time_zone AS ends
  FROM daily_picks
), slots AS (
  SELECT d.user_id, d.begins, d.ends, slot.id FROM days d
  CROSS JOIN LATERAL unnest(d.bookmark_ids) AS slot(id)
  WHERE d.begins >= $1::timestamptz AND d.begins < $2::timestamptz
), counted AS (
  SELECT s.*, EXISTS (SELECT 1 FROM feed_feedback f
    WHERE f.user_id = s.user_id AND f.bookmark_id = s.id AND f.kind = 'not_interested'
      AND f.created_at >= s.begins AND f.created_at < s.ends) AS rejected
  FROM slots s
)
SELECT count(*) AS original_slots, count(*) FILTER (WHERE rejected) AS rejected_slots,
  100.0 * count(*) FILTER (WHERE rejected) / NULLIF(count(*), 0) AS rejection_pct
FROM counted;
```

G-6 (`queued_save_lost`) is a zero-loss guard, not a percentage. The query observes accepted
saves with queue lag strictly >86,400seconds; exactly24h is not above the limit. Add tester
failed-row reports and unreconciled client captures from the operator incident ledger, deduplicated
by capture ID where possible. Client-only rows/unuploaded captures cannot be seen by this SQL.
Any observed lag or reported failure counts as lost until explained and cleared by PM; even an
explained loss blocks wider rollout until PM explicitly clears it. Zero query rows never proves
zero end-to-end loss.

<!-- G-6 -->
```sql
WITH queued AS (
  SELECT EXTRACT(epoch FROM created_at - capture_queued_at) AS age_s
  FROM bookmarks WHERE capture_queued_at IS NOT NULL
    AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
)
SELECT count(*) AS attributed_queued_saves,
  count(*) FILTER (WHERE age_s > 86400) AS observed_over_24h,
  max(age_s) AS max_queue_age_s
FROM queued;
```

The dedicated query fixtures execute these exact statements inside READ ONLY transactions,
including G-1 under a New York session across spring DST.
They prove seven-day edges, UTC edges, both DST lengths, all stored user-day/original-slot
denominators (including hidden/deleted), absent Undo feedback, platform attribution, activity
union and the strict queue-age boundary. Fictional fixture values are not baseline measurements.

## Operator release, deferred checks and rollback

Paulo coordinates PM/Architect. Before release (R-1), snapshot G-1/G-4's eight-week baseline,
record A-1's internal tester audience and exact previous TestFlight/EAS build ID, and obtain
Architect capability/device sign-off. Public App Store lookup alone cannot confirm an internal
audience. The current audience/previous TestFlight/operator sign-offs remain pending.
For A-2, inspect both bundle keychain/AppGroup permissions and actual native interop; the
accepted SecureStore service mismatch fallback is the committed exact-service native bridge.
For A-3, probe Hermes' IANA zone and PostgreSQL acceptance; use the already accepted localization
fallback only if that real probe fails. A-4 probes Android sender return; the accepted
moveTaskToBack fallback applies only after an actual exitApp failure, never as a speculative change.

R-2: after an authorized whole-package squash merge, require backend tests/migration/API/worker
green, then web rebuild and internal mobile quality/build. Keep old/internal clients able to show
picks-load failure; do not dispatch TestFlight before backend success.
R-3: Paulo manually dispatches deploy-mobile with destination=testflight, waits for processing,
then proves the primary outcome on deployed services. No public App Store rollout is authorized.
R-4: PM evaluates four release weeks against eight baseline weeks:
G-1 +50% relative, G-2 >=1.5, G-3 >=40%, G-4 no worse than -10%, G-5 <=20%, G-6 zero.
A zero baseline cannot produce a relative percentage; report that explicitly.
Flat G-1 after four weeks revisits picks before backlog3–5.

R-5/DOC-1: Architect checks seven-day `Picks computed` structured `picks_ms` samples, reports
sample count and nearest-rank p95. Above800ms invokes an authorized index or cap300 follow-up;
do not silently modify the500-candidate contract. DOC-2: PM checks queue_age_s logs and the
G-6 query plus tester failed rows at7 and28days. Any loss blocks wider rollout until PM clears it.
These future observations are pending, not launch-time passes. Never export key values/note text.

R-6: human incident decision only; retain candidate/build/aggregate evidence. Revert the backend
feature commit while leaving additive migrations present and unused. Restore the recorded prior
TestFlight build, or manually dispatch its known ios_build_id. Revoke all share keys in one
operator transaction (restricted extensions then retain captures instead of saving):

```sql
BEGIN;
UPDATE share_keys SET revoked_at = now() WHERE revoked_at IS NULL;
COMMIT;
```

The UPDATE is the explicit authorized rollback operation, not a weekly read-only query.
Rehearse only on the marked disposable database, retaining bookmarks and additive columns:
previous wire/generated clients can still create/read/update, revoked restricted keys return401,
and refused native transport retains the same queued capture. A prior mobile binary/config
snapshot is compatibility evidence; without a normal-issuer prior-build session it does not prove
the live rollback outcome. Verify retained captures through a matching normal account after
recovery, reconcile any loss with PM, and keep wider rollout blocked until cleared.
No rollback, release, merge or production mutation is granted by T-10.
