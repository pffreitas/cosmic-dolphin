# Save parity fixtures and continuation

Start at [the native handoff](../native-parity-handoff.md) and [current Save tasks](tasks.md).
The task record owns outcome/next gate/owner/blocker; this page makes its proof reproducible.
Do not depend on prior terminal sessions, a cached simulator binary or old `/tmp` scripts.

## Resume the outstanding gate

1. Inspect the current branch/base and uncommitted work. Rebuild/install the maintained native
   dev client if dependencies/native assets require it; build instructions are in the handoff.
2. Use T3 `device_list` → `device_open` for an eligible claim. Assign **the exact newly returned
   command** to `parity_device_cmd`. The prior iPhone 18 Pro/iOS 27 simulator was a simulator,
   not physical evidence, and its old command/claim is not transferable between threads.
3. Start the local fixture service, Metro and web as below. Open the app through the bound CLI,
   get a fresh snapshot, and use T3 `device_screenshot` to inspect it. A sparse splash tree is
   not a completed render. Follow current tool advice once on a failure; stop if it repeats.
4. Recheck `/dev/save?invalid=true` in light/dark at default iOS Large, and
   `/dev/save?stage=confirmation` at XXXL, including the real optional confirmation with a URL.
   The error should avoid a stranded final word; the heading should balance rather than leave
   `it.` alone. Those corrections already exist in PrettyCopy/SaveSheet; verify before editing.
5. Save new **after-correction** originals/crops/pairs with distinct names, and update metadata
   and the task outcome. Preserve existing diagnostic images. If code changes, rerun the
   relevant behavioral checks, then the required mobile gate.
6. Finish the pending real-flow repeat: Home omnibox URL → Behind a login, owner-scoped prefill,
   description, Save, duplicate response and Done. Existing tests cover these boundaries; the
   completed simulator receipt covers public/private creates and note/timing PATCH, not that
   final omnibox/dedupe repeat. Continue physical/signed-session QA separately.

The failed `alert get` inspected an absent alert after a helper warning while Home rendered.
It is not a reason to alter app auth, throw away the simulator/native project, or mark the
platform globally unavailable. A fresh authorized continuation still follows T3's claim and
failure rules. This documentation update does not itself resume device work or authorize release.

## Start the owned local services

Inventory listeners before starting processes; reuse only services owned by the task or choose
other coordinated ports. The Save and Home HTTP harnesses both default to 5537, so do not run
both there. Preserve other agents' services and all environment files.

Run each command in a separate terminal from the repository root:

```bash
bun docs/design-system/save-parity/local-service.mjs
```

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:5537 \
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:5537 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=fictional-local-anon \
bunx expo start --dev-client --port 8081
```

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:5537/api/v1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5537 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fictional-local-anon \
bun run --cwd apps/web dev --port 3001
```

These are per-process overrides, not `.env` edits. The harness uses fictional auth and
in-memory bookmarks only. Its HTTP auth response supplies owner `fixture-reader`; use a
fictional sign-in through the native form when a local session is needed. The harness does
not validate a real password and must never be presented as production auth proof. Web's
Save fixture is intended for a **logged-out development session**, so the route mounts the
production dialog once rather than duplicating the signed-in root dialog.

The service [source](local-service.mjs) records method/path and selected fixture payload fields;
it does not log passwords/tokens. Its memory and request history reset on process restart.
`GET /fixture/requests` exports the sanitized receipt. `POST /fixture/save-mode` with
`{"status":503}` simulates a create failure; `{"status":201}` restores acceptance.
It is not a held-acknowledgement or full 429 timing harness—use the durable integration tests
for held/replayed/concurrent/owner behavior, and extend transport deliberately if a device
proof requires those cases. Preview currently returns an unavailable response; successful
and late preview cases have integration-test proof.

## Visual fixtures versus real capture

| Fixture / route | Meaning |
| --- | --- |
| Web `/dev/save?parity=1&stage=link&theme=light&text=default` | Production HomeView/AppShell backdrop and production NewBookmarkButton/PrivateLinkDialog. Theme/stage/text parameters are consumed by the capture helper; opening the URL alone does not automatically open/scale the dialog. |
| Native `cosmicdolphin://dev/save?stage=link` | Controlled SaveSheet over matched Home fixture; native clipboard row intentionally suppressed. Save callbacks change gallery stage, not the real queue. |
| Native `cosmicdolphin://dev/save?stage=private` | URL `https://example.com/private`, blank brief, disabled Save. |
| Native `cosmicdolphin://dev/save?invalid=true` | Inline-invalid visual state; same gallery callback limitation. |
| Native `cosmicdolphin://dev/save?stage=confirmation&url=https%3A%2F%2Fexample.com%2Fsave-parity-public` | Native optional note/read-later fixture; no web counterpart. |
| Native `/save`, opened by Home's Save or Behind a login | Real owner-bound controller/provider/storage/generated HTTP client against the configured transport. Use this for save behavior, never claim the dev gallery exercised persistence. |

Use the exact bound CLI for every UI operation. Example after assigning its returned command:

```bash
"$parity_device_cmd" settings appearance light
"$parity_device_cmd" settings text-size large
"$parity_device_cmd" open com.cosmicdolphin.app --relaunch --metro-port 8081 \
  --launch-url 'cosmicdolphin://dev/save?invalid=true'
"$parity_device_cmd" snapshot -i
```

Use `settings appearance dark` for dark and `settings text-size extra-extra-extra-large` for
XXXL. Relaunch when changing fixture parameters/text size and verify the rendered state.
Refresh a complete snapshot after a transition before using its bare refs. Await command
completion before the next dependent operation/cropping; an `exec` session ID is not completion.
Do not use `simctl`/`idb`/SSH for UI or read a clipboard silently to set up a fixture.

## Capture and label evidence

The accepted matrix is Save/private × light/dark × default/XXXL at **402×778 product points**.
Original iOS frames were **402×874 at 1x**, with 62pt top and 34pt bottom safe areas. Backing
scale was 3x. Re-measure another device; never apply these crop values blindly to another model.
Web is 402×778 CSS pixels, DPR 1. Larger web is a documented CSS text-scale fixture (23/17,
operable controls capped at 1.3), not browser Dynamic Type or zoom.

Use T3 preview first for requested browser work. The last session retried its frame failure
and used Playwright; a new session should rediscover availability. The committed
[capture helper](capture-web.js) operates the production dialog, freezes the Home clock,
waits for fonts, removes animation/hover artifacts and intercepts optional preview transport.
On a permitted Playwright fallback, run from the root:

```bash
playwright-cli -s=save-parity open \
  'http://localhost:3001/dev/save?parity=1&stage=link&theme=light&text=default'
```

The helper writes fixed filenames in this directory. **Preserve the historical images before
running it again**, or use a dated copy with only the output path changed to a new owned evidence
directory. Run that helper with `playwright-cli -s=save-parity run-code --filename=<helper-path>`;
retain its computed-bounds result. Close only the task-owned browser when finished.

Capture a native original to a new owned filename with `"$parity_device_cmd" screenshot <path>`.
For the original measured device, a Python/Pillow crop is `image.crop((0, 62, 402, 840))`.
Pairs paste web left/native right into an 804×778 image; do not rescale product content.
Record source/font hashes, theme, viewport, text size, clock, crop and proof type in a new receipt.
Read [evidence.json](evidence.json) for the existing schema and exact source-audit caveats.

The existing eight main-state pairs are accepted. Two invalid pairs and four native-only
confirmation captures predate the last corrections. `pair-link-large-rejected-wrap.png` is
deliberately rejected history. Keep those labels distinct; neither screenshots nor signed
entitlements imply physical installation, spoken VoiceOver or production-account acceptance.
