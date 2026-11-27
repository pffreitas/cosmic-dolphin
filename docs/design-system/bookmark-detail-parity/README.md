# Saved bookmark detail continuation

Read `AGENTS.md`, [tasks.md](tasks.md), [parity.md](../parity.md), the approved mobile
reading spec and the release runbook. **This is the saved detail screen**, native
`/bookmark/[id]` and web `/bookmarks/[bookmarkId]`. `/save` and `/dev/save` are the
create form; their screenshots cannot certify this page.

## Implementation

The actual native route owns fetch/recovery, reading actions and private sheets.
`components/web-bookmark/Frame.tsx` provides the shared omnibox/five-cell chrome and
scopes the web palette through native sheets. `Reader.tsx` adapts ReaderProse line
boxes, margin collapse, real Markdown, table/code scrolling and semantic headings.
`Provenance.tsx`, `Comments.tsx` and `ReaderImage.tsx` adapt the matching web owners.

Default `article` mode renders `cosmicBriefSummary` **and** the long `cosmicSummary`,
as production web does. “Read saved text” in More and `?mode=read` still use genuine
`BookmarkContent.blocks`, with existing highlights and reading preferences. The
legacy `/reader/[id]` redirect remains. Notes, filing, Later, reversible read state,
private own-summary edits and explicit public-link sharing remain native adapters.

The route is keyed synchronously by account/id/slug. Owner reads use the generated
client, which normalizes wire metadata (`site_name`, `article_author`); do not return
raw JSON and assume those are camelCase. Public reads use the public-slug contract.
Reading progress binds both reads and queued flushes to the originating account.
Do not replace the existing reading/capture providers or infer a durable offline
queue for ordinary reading actions.

## Matched fixture

`apps/mobile/dev/bookmark-fixture.json` uses the reported title/brief and illustrative
long Markdown. It is not a recovered private bookmark response.

Web:

```bash
bun run --cwd apps/web dev
# /dev/bookmark?parity=1&theme=light&text=default
# production BookmarkDetail + AppShell + BottomNavigation
playwright-cli -s=bookmark-parity open 'http://localhost:3001/dev/bookmark?parity=1&theme=light&text=default'
playwright-cli -s=bookmark-parity run-code --filename=docs/design-system/bookmark-detail-parity/capture-web.js
```

Use the actual dev port; this session used 3001. The capture waits for fixture
hydration and font readiness. `text=large` is a CSS scaling fixture (23/17, controls
capped at 1.3), not browser Dynamic Type. The old pre-hydration capture produced an
attribute mismatch; do not scale DOM styles before the gallery is ready.

Native interaction fixture:

```bash
bun docs/design-system/bookmark-detail-parity/local-service.mjs
(cd apps/mobile && EXPO_PUBLIC_API_URL=http://127.0.0.1:5541 \
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:5541 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=fictional-local-anon \
bunx expo start --dev-client --port 8081)
```

The loopback service supplies fictional auth and in-memory responses, with no
production data or credentials. Sign into the fictional service if required.
Open a fresh **owned** T3 device with `device_list` → `device_open`, install/build
through the maintained native project, then use its returned bound command for
all UI operations. Launch `cosmicdolphin://bookmark/frontier-fixture`. Variants are
`frontier-ready`, `frontier-processing`, `frontier-private`, `frontier-failed` and
`frontier-shared` (the last needs `?slug=frontier-shared`). Never reuse another
agent's claim or drive UI with simctl/ssh as a fallback to failed device tools.

Default evidence has 402×778 product bounds: 402×874 simulator originals minus
62/34pt OS safe areas. Paired PNGs show web left/native right. The captured default
stage precedes final progress/metadata, rich-renderer and label-color corrections;
it is **not final whole-page certification**. Larger native renders and simulator
flows were blocked by repeated `ALERT_NOT_FOUND` after the launcher's advised
alert inspection. Read the task's current gate before attempting more device work.

## Gates and fonts

```bash
bun install
(cd apps/mobile && bunx tsc --noEmit)
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile test -- --runInBand
bun run tokens:test
```

The route regression requires the rich body beneath the brief; a create-form
fixture cannot satisfy it. Real Markdown renderer and transport-owner tests are
separate from layout/physical proofs. Current tests preserve read/Undo, recovery,
private forms, held responses, navigation and account changes.

Edit canonical `tokens.json`, regenerate and check; never edit generated themes.
The pinned font scripts require web's `.next` font output. Home's generator keeps
unchanged cuts byte-identical and adds 32/35/43. The detail generator freezes
regular/italic/bold-italic reader instances. All **29** custom serif assets must be
registered in the root font loader and verified by byte hash in the signed IPA.
Run the pinned `uv` commands in the script headers, not unpinned global font tools.

For TestFlight, read the runbook and the current grant/receipt. No PR or merge was
requested. A successful local production build/upload is followed by Apple
processing and actual membership in the existing internal Beta group. Retain
private raw logs/signing receipts outside the repo, and commit sanitized results.
