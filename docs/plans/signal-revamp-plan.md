# Signal Revamp — Delivery Plan

The revamp specified in [`docs/design-system/`](../design-system/) and
[`docs/functional-spec/`](../functional-spec/), broken into 20 deliverables that each leave the app
shippable. The two specs say *what*; this file says *in what order, in which files, and how we know
a piece is finished*.

Nothing here reopens a decision from the specs. Where the codebase already disagrees with them, that
is recorded in [What the codebase does differently](#what-the-codebase-already-does-differently) and
handled inside the deliverable that owns it.

---

## Shape of the work

Three horizontal foundations first, because every surface consumes them. Then vertical slices —
contract, handler, worker, and UI shipped together per capability, so no deliverable leaves a
half-wired feature behind.

| Wave | Deliverables | Theme |
| --- | --- | --- |
| 1 | D1–D3 | Tokens, primitives, the seven patterns. No page changes. |
| 2 | D4–D6 | Capture and the AI pipeline: never block, name the phases, stop auto-filing. |
| 3 | D7–D10 | Library: collections, reading, and the two reading surfaces. |
| 4 | D11–D13 | Social: graph, comments, reshare. |
| 5 | D14–D16 | Feed: ranker, digests, and Home. |
| 6 | D17–D20 | Remaining surfaces, mobile tokens, and the accessibility gate. |

| # | Deliverable | Size | Depends on |
| --- | --- | --- | --- |
| D1 | Signal tokens and the two voices | M | — |
| D2 | Primitives on Signal | M | D1 |
| D3 | The seven patterns + state gallery | L | D2 |
| D4 | Capture: normalise, dedupe, never block | M | D3 |
| D5 | Pipeline phases the UI can name | M | D3 |
| D6 | Filing, and the override rule | M | D5 |
| D7 | Collections API | M | D6 |
| D8 | Reading progress and highlights | M | — |
| D9 | Library page | L | D3, D6, D7 |
| D10 | Bookmark detail and shared page | L | D3, D5, D8 |
| D11 | Social graph: handles, follows, blocks | M | D2 |
| D12 | Comments and reports | M | D11 |
| D13 | Reshare | S | D11, D4 |
| D14 | Feed ranker | L | D11, D13 |
| D15 | Digests | M | D14 |
| D16 | Feed feedback and Home | L | D14, D15 |
| D17 | Search and command palette | M | D3 |
| D18 | Explore, Profile, Auth, chrome removal | M | D11 |
| D19 | Mobile token pipeline | M | D1 |
| D20 | Accessibility and definition-of-done gate | S | D18 |

**Parallelism.** D8 has no dependency on the pipeline work and can run beside Wave 2. D11 needs only
the primitives, so the social track can start as soon as D2 lands. D19 needs only D1. Everything
else follows the arrows.

## Ground rules that gate every deliverable

Not restated here — read them where they live and treat them as acceptance criteria:

- The ten rules in [`design-system/README.md`](../design-system/README.md#the-rules-that-do-not-bend).
- The six non-negotiables in [`functional-spec/README.md`](../functional-spec/README.md#non-negotiables).
- The per-surface checklist in
  [`design-system/implementation.md`](../design-system/implementation.md#definition-of-done).

Two process rules apply to every deliverable that touches an endpoint: the change starts in
`packages/apispec/*.tsp` and the client is regenerated with `bun run apispec` — `packages/api-client`
is never hand-edited. And a migration that adds a table adds its RLS policy in the same file.

---

## Wave 1 · Foundation

### D1 · Signal tokens and the two voices

**Outcome.** Every colour, radius, and font in `apps/web` resolves to a `--cd-*` token, and a new hex
literal fails the build.

**Scope.**
- Copy `docs/design-system/tokens.css` to `apps/web/app/tokens.css`; import it at the top of
  `app/globals.css`, above the `@tailwind` directives.
- Delete the `:root` and `.dark` blocks in `globals.css` (the shadcn stone palette, lines 15–84).
  `tokens.css` ships its own shadcn compatibility layer, so `components/ui/*` keeps working untouched.
- Two raw-colour blocks also live in `globals.css`: `.expandable-mark` on the Tailwind blue palette,
  and `.shimmer` on six hex stops. Move the first onto `--cd-hl-bg` / `--cd-hl-line` now; `.shimmer`
  is deleted outright in D18, so exempt it from the guard until then rather than restyling it.
- `app/layout.tsx`: load Inter (400/500/600/700) and Source Serif 4 (400/600 + italic) via
  `next/font/google`, exposed as `--cd-font-sans` / `--cd-font-serif` so the token file stays
  authoritative. Drop the `geist` dependency and the `karla` / `noto` entries in `tailwind.config.ts`.
- Extend `tailwind.config.ts` with the Signal `fontFamily`, `colors`, and `borderRadius` maps from
  `implementation.md`.
- Grep `bg-accent` **before** merging: Signal's `accent` shadows shadcn's, which meant "muted hover
  surface". Every hit moves to `bg-bg-inset` in this same commit.
- Add the rule-zero guard — an ESLint rule or a `lint:tokens` script over `apps/web/{app,components}`
  rejecting hex literals, `rgb(`, and px radii — and wire it into `bun run lint`.

**Touches.** `apps/web/app/{tokens.css,globals.css,layout.tsx}`, `apps/web/tailwind.config.ts`,
`apps/web/package.json`, `apps/web/eslint.config.*`.

**Done when.** The app builds, no colour `:root` block exists outside `tokens.css`, and introducing
`#fff` into a component fails `bun run lint`.

### D2 · Primitives on Signal

**Outcome.** The app looks mostly the same and is running entirely on Signal. No page files change.

**Scope.**
- Restyle in place in `apps/web/components/ui/`: `button` (primary pill · secondary · ghost · danger;
  `sm`/`default`/`icon`; the loading state swaps the leading icon and **keeps the label**), `input`,
  `textarea`, `select`, `badge` → Tag (accent-soft, `neutral`, `removable`), `avatar`, `separator`,
  `dialog` (bottom sheet below 640px), `tooltip`, `dropdown-menu`, `scroll-area`, `skeleton`
  (`line` / `title` / `thumb`, mirroring real geometry).
- New primitives: `segmented.tsx` (a real radiogroup), `kbd.tsx`, `empty-state.tsx`, `toast.tsx`
  (4s; 8s with **Undo** when undoable), `favicon-chip.tsx`.
- The URL-capture field is the one input that takes `--cd-radius-pill`. Every other field is a
  rectangle.

**Touches.** `apps/web/components/ui/**`.

**Done when.** Every primitive reads only `--cd-*`, each has a visible focus ring, and no screen has
grown a local button.

### D3 · The seven patterns + state gallery

**Outcome.** The composite components that carry the product's identity exist and are provably
complete, before any page consumes them.

**Scope.**
- Build in this order — later ones consume earlier ones: `components/provenance-row.tsx`,
  `components/ai/ai-callout.tsx`, `components/ai/processing-steps.tsx`,
  `components/social/action-row.tsx`, `components/app-header.tsx`,
  `components/bookmark/library-row.tsx`, `components/feed/feed-item.tsx`.
- Feed item ships all four variants: `article`, `video`, `digest`, `pending`.
- A dev-only `/dev/patterns` route rendering every pattern in every state — loading, empty, error,
  AI-processing, failed, and private-link. This route is the acceptance surface for the rest of the
  revamp and stays for the duration.

**Touches.** `apps/web/components/{provenance-row,app-header}.tsx`, `apps/web/components/{ai,social,feed,bookmark}/**`,
`apps/web/app/dev/patterns/page.tsx`.

**Done when.** All seven render all their states at `/dev/patterns`, in both themes, and match
`docs/design-system/prototypes/index.html` opened beside them.

---

## Wave 2 · Capture and pipeline

### D4 · Capture: normalise, dedupe, never block

**Outcome.** A pasted link is a usable row before any AI work starts, and pasting it twice is not an
error.

**Scope.**
- URL normaliser in `packages/shared`: lowercase scheme and host, strip trailing slash, drop `utm_*`,
  `fbclid`, `gclid`, `ref`, `mc_cid`. Normalised form into `source_url`, what the user pasted into
  `metadata.originalUrl`.
- `POST /bookmarks`: on the existing `(user_id, source_url)` collision, return the existing bookmark
  with `alreadySaved: true` rather than a 409. Contract first.
- Client: an optimistic row built from the pasted URL alone — domain, favicon chip, URL as
  provisional title, staged progress at *Fetching page*. A failed request turns that row into an
  inline error with **Retry**; it is never silently removed. `POST /bookmarks/preview` is used
  opportunistically and never awaited.
- Rate limit saves at 100/day with a 429 and `Retry-After`; the field keeps the URL and shows the
  wait. Needs a rate-limit plugin — see [Open decisions](#open-decisions).

**Touches.** `packages/apispec/bookmarks.tsp`, `apps/api/src/routes/bookmarks.ts`,
`packages/shared/src/services/bookmark.service.ts`, `apps/web/components/bookmark/new-bookmark.tsx`,
`apps/web/lib/store/slices/bookmarksSlice.ts`.

**Done when.** `POST /bookmarks` p95 is under 300ms, a duplicate paste toasts "Already in your
library" with a link to it, and no capture path shows a full-screen spinner or a blocking modal.

### D5 · Pipeline phases the UI can name

**Outcome.** The processing timeline speaks the vocabulary the UI renders, and a partial failure
still produces a useful bookmark.

**Scope.**
- Rename the phase vocabulary to the spec's six: `fetch`, `extract`, `summarise`, `tag`, `file`,
  `embed`. Today `bookmark.processor.service.ts` emits `summarization`, `brief_summary`, `tags`,
  `images`, `chunking`, `embedding`, `categorization`, `finalization`, and
  `private_link_enrichment` — map them in the reporter and backfill `bookmark_processing_events` so
  existing timelines stay readable.
- Surface phases 1–5; `embed` runs silently.
- Migration: `bookmarks.cosmic_key_points jsonb`, so key points are stored as an array instead of
  being parsed out of markdown at render time.
- Emit one event per phase **transition**, not per token. `processing-steps` announces each change
  once through `aria-live="polite"`.
- `POST /bookmarks/{id}/reprocess` with an optional `phase` scope, appending to the existing timeline
  rather than replacing it.
- A per-user daily processing budget enforced before enqueue. Over budget, the bookmark saves with
  `processing_status = 'idle'` and the row offers **Summarise now**.

**Touches.** `packages/shared/src/services/{bookmark.processor.service.ts,bookmark-processing-reporter.service.ts}`,
`supabase/migrations/`, `packages/apispec/{bookmarks,pipeline}.tsp`, `apps/api/src/routes/bookmarks.ts`,
`apps/web/components/ai/processing-steps.tsx`.

**Done when.** A new save shows five named phases inside a real row; a bookmark whose `summarise`
failed still shows content, tags, and filing, with the failed phase in place of the brief; and
**Retry** appends to the timeline.

### D6 · Filing, and the override rule

**Outcome.** The pipeline proposes filing and never overrides a human. This is the riskiest
behaviour change in the revamp — today it auto-creates collections.

**Scope.**
- Migration: `bookmarks.filing_source text NOT NULL DEFAULT 'ai' CHECK (filing_source IN ('ai','user'))`,
  `bookmarks.saved_from_bookmark_id`, and `collection_suggestions` with its index and owner-only RLS.
- Rework `bookmark.categorizer.service.ts` into the `file` phase. It currently calls
  `collectionRepository.createPath` and creates collections outright; that stops. The model returns
  one of: an existing collection id (the common case), a new-collection proposal that lands in
  `collection_suggestions` and needs 5 supporting bookmarks before it is offered, or `null` — which
  leaves the bookmark in Inbox, a valid resting place rather than a failure.
- The pipeline never moves a bookmark whose `filing_source` is `'user'`, on any subsequent run.
- Tag generation passes the user's top 50 existing tags as candidates so the vocabulary converges.

**Touches.** `supabase/migrations/`, `packages/shared/src/services/bookmark.categorizer.{service,prompt}.ts`,
`packages/shared/src/repositories/{collection,bookmark}.repository.ts`.

**Done when.** A manual refile survives a reprocess untouched, no collection is created by the
pipeline, and a bookmark with no good home stays in Inbox.

---

## Wave 3 · Library

### D7 · Collections API

**Outcome.** The collection tree is fully operable from the API, and a refile is permanent.

**Scope.**
- Contract first, then a new `apps/api/src/routes/collections.ts` — split out of `bookmarks.ts`,
  which is 706 lines and already carries `/collections` in violation of the repo's own
  resource-domain convention.
- `POST /collections`; `PATCH /collections/{id}` (rename, recolour, reparent);
  `DELETE /collections/{id}` — its bookmarks move to Inbox and are never deleted.
- `PATCH /bookmarks/{id}/collection` — the override endpoint. It sets `filing_source = 'user'` in the
  same transaction as the move.
- `GET /collections/suggestions`, `POST /collections/suggestions/{id}/accept`, and `.../dismiss`,
  with dismissal remembered for 30 days via `dismissed_until`.
- Depth capped at two levels, enforced server-side.

**Touches.** `packages/apispec/`, `apps/api/src/routes/{collections,bookmarks}.ts`,
`packages/shared/src/services/collection.service.ts`.

**Done when.** The tree can be created, renamed, reparented, and deleted through the API; a third
level is rejected; and a refile is not undoable by the next pipeline run.

### D8 · Reading progress and highlights

**Outcome.** The product can tell what has been read and what was worth marking. Runs in parallel
with Wave 2.

**Scope.**
- Migrations `bookmark_reading_progress` and `bookmark_highlights` with their indexes and owner-only
  RLS.
- `PUT /bookmarks/{id}/progress` — idempotent, cheap, and **monotonic server-side**: a percent lower
  than the stored one is rejected rather than trusted. `GET /bookmarks/continue-reading` for the Home
  rail.
- `GET`/`POST /bookmarks/{id}/highlights`, `PATCH`/`DELETE /highlights/{id}`. Anchoring is quote plus
  a short prefix and suffix, never character offsets, so re-extraction does not orphan them.
- Highlights are private even on a public bookmark.

**Touches.** `supabase/migrations/`, `packages/apispec/`, `apps/api/src/routes/`,
`packages/shared/src/repositories/`.

**Done when.** A re-extraction leaves every highlight anchored, progress writes at most once per 5s
per bookmark, and a highlight is invisible to a second viewer of a public bookmark.

### D9 · Library page

**Outcome.** `/my/library` rebuilt on the patterns: chronological rows, an editable tree, and every
state.

**Scope.**
- `GET /bookmarks` gains `sort` (`newest` | `oldest` | `recently_read` | `longest_unread`) and cursor
  pagination. `read_status` and `collection_id` already exist. Chronological stays the default and is
  reachable in one click.
- Layout `216px minmax(0,1fr)`: the collection tree rail (All saves · Inbox · collections nested to
  two levels · Read later · Archive) with mono counts and the collection-suggestion AI callout below
  it; the main column is a header block plus a `divide-y` list of library rows.
- Unread is a 6px accent dot with a transparent spacer when read, so the list never shifts. No social
  affordances anywhere on this surface.
- Read-status segmented control persists in the URL (`?read_status=unread`).
- Drag a row onto a tree node to refile (sets `filing_source = 'user'`); shift-click range selection
  drives bulk refile, mark read/unread, add tag, archive, delete — every one undoable for 8s except
  delete, which confirms.
- States: six skeleton rows; distinct copy for empty library, empty collection, and empty filter;
  filing-in-progress rows show the `Inbox` breadcrumb with the AI *filing…* marker.
- Delete `apps/web/components/bookmark/bookmark-list-card.tsx` in the same commit.

**Touches.** `apps/web/app/(private)/my/library/page.tsx`, `apps/web/components/bookmark/**`,
`packages/apispec/bookmarks.tsp`, `apps/api/src/routes/bookmarks.ts`.

**Done when.** Every state renders, no card component survives, and the page passes the
definition-of-done checklist in both themes.

### D10 · Bookmark detail and shared page

**Outcome.** The reading surface. `/bookmarks/[bookmarkId]` and `/s/[slug]` on one composition.

**Scope.**
- The page order is the argument of the page and does not get rearranged: hero (breadcrumb ·
  `title-1` · provenance · action row) → Cosmic brief AI callout with key points and a `.ai-foot`
  naming its source → reader at 16px/1.75 within `--cd-measure` → social row with highlight count →
  comments.
- Reader wiring: highlights render with `--cd-hl-bg`; a selection popover offers **Highlight**,
  **Copy**, **Comment**; reading progress writes on a 5s throttle and on unmount; at 90% the page
  *suggests* marking read with an undoable toast and never sets it silently.
- States: processing holds staged progress in the brief's position and a skeleton reader; failed
  shows a `--cd-danger` callout with **Retry** while the original link still opens; a private link
  gets the `--cd-warning` note and an invitation to write the user's own summary; not found is a 404
  with a route back to Library.
- `/s/[slug]` is the same composition minus the breadcrumb, read toggle, and highlights, plus a
  **Save to your library** CTA. It must render server-side with complete Open Graph tags — this route
  is how the product spreads.

**Touches.** `apps/web/app/(private)/bookmarks/[bookmarkId]/page.tsx`,
`apps/web/app/s/[slug]/**`, `apps/web/components/bookmark/**`.

**Done when.** All four states render, the shared route returns complete OG tags to an
unauthenticated fetch, and reading progress survives a reload.

---

## Wave 4 · Social

### D11 · Social graph: handles, follows, blocks

**Outcome.** Users have stable public identities and a follow edge for the feed to stand on.

**Scope.**
- Migrations: `profiles.handle` (unique, `^[a-z0-9_]{3,30}$`) and `handle_changed_at`; `follows` and
  `user_blocks` with their constraints, indexes, and RLS.
- A handle claim flow for existing accounts — see [Open decisions](#open-decisions).
- `PUT`/`DELETE /users/{handle}/follow`, `GET /users/{handle}`, `/saves`, `/followers`, `/following`,
  `PATCH /profile` (name, picture, handle once per 30 days), `PUT`/`DELETE /users/{handle}/block`.
- Routes key on handle, not id. `email` is never present in a `PublicProfile`. 404 rather than 403
  for objects the caller cannot see. Follows rate limited to 100/hour.
- Blocking removes both directions and hides the blocker's public saves from the blocked user.

**Touches.** `supabase/migrations/`, `packages/apispec/`, `apps/api/src/routes/{users,profile}.ts`,
`packages/shared/src/services/profile.service.ts`.

**Done when.** Following is reciprocal-free and immediate, a blocked user cannot see the blocker's
public saves, and no public response contains an email.

### D12 · Comments and reports

**Outcome.** Conversation on public bookmarks and digests, one level deep, with a moderation floor.

**Scope.**
- Migrations: `bookmark_comments` with its partial index, `bookmarks.comment_count` maintained by
  trigger like `like_count` already is, and `content_reports`. RLS: readable when the parent bookmark
  is public or owned by the reader, writable by the author.
- `GET`/`POST /bookmarks/{id}/comments`, `PATCH`/`DELETE /comments/{id}`. Editable for 15 minutes,
  then frozen. Delete soft-deletes when it has replies, hard-deletes when it does not. 2,000
  character cap, plain text plus links. Rate limited to 10/min.
- One level of nesting: a `parentId` pointing at a reply attaches to that reply's parent instead.
- Ordering is chronological — no ranking, no "top comment", no score.
- Placement: never inline in the feed. The feed's comment action opens a drawer on desktop and a
  sheet on mobile; the detail page shows the thread in full.
- `POST /reports`. Reported content stays visible pending review — auto-hide is trivially weaponised.

**Touches.** `supabase/migrations/`, `packages/apispec/`, `apps/api/src/routes/comments.ts`,
`apps/web/components/social/**`.

**Done when.** A reply to a reply lands on the parent, an edit at 16 minutes is refused, and
un-sharing a bookmark hides its thread without deleting it.

### D13 · Reshare

**Outcome.** The feed's **Save** action creates the resharer's own bookmark, with provenance.

**Scope.**
- `POST /bookmarks/{id}/reshare` creates a new bookmark owned by the caller with
  `saved_from_bookmark_id` set, and runs the full pipeline for the new owner so the summary and
  filing reflect *their* tree.
- It hits the existing per-user URL uniqueness constraint: resharing something already saved is a
  no-op that returns `alreadySaved: true` and toasts "Already in your library" (D4's path).
- Deleting the original does not affect reshares; the provenance line degrades to the domain alone.

**Touches.** `packages/apispec/`, `apps/api/src/routes/bookmarks.ts`,
`packages/shared/src/services/bookmark.service.ts`, `apps/web/components/social/action-row.tsx`.

**Done when.** A reshare is filed into the resharer's own tree, and resharing twice is a no-op.

---

## Wave 5 · Feed

### D14 · Feed ranker

**Outcome.** `GET /bookmarks/feed` returns ranked items with a server-generated reason. Today it
returns the user's own unread bookmarks by `limit`/`offset`; the route survives, the behaviour does
not.

**Scope.**
- Contract: replace the feed operation's shape with `FeedItem` / `FeedResponse` —
  `scope=for_you|following|unread`, cursor-based (never offset; the set is re-ranked between requests
  so offsets duplicate and skip), page size 20, `computedAt`. Both clients regenerate together.
- Migrations: `feed_impressions` and the covering index on public saves by author and recency.
- Candidate set, capped at 500: own unread from the last 90 days, followed public saves from the last
  14 days, eligible digests. Ranked in the API, not the database — the signals need the user's
  interest vector.
- The six signals at their starting weights (topic affinity .35, source affinity .15, recency .20,
  social proof .15, effort fit .10, novelty .05), in **configuration, not scattered constants**, so
  they can be tuned without a deploy.
- Post-processing in order: author diversity (max 2 consecutive from one person or domain), digest
  spacing, seen decay (×0.6 after 3 unopened impressions, dropped from For you after 5 and still
  reachable in Unread).
- `pending` items pin to the top regardless of score. `rankingReason` is generated server-side from
  the top two contributing signals and is never synthesised on the client.
- Cache the ranked head per user for 5 minutes; newly saved bookmarks bypass the cache and prepend.

**Touches.** `packages/apispec/bookmarks.tsp`, `apps/api/src/routes/feed.ts`,
`packages/shared/src/services/feed-ranking.service.ts`, `supabase/migrations/`.

**Done when.** The ranker explains itself in one sentence per item, the same item is not served
indefinitely unopened, and no signal rewards engagement time or popularity alone.

### D15 · Digests

**Outcome.** An AI-authored feed item that groups the user's own saves into one observation.

**Scope.**
- Migration `feed_digests` with its index and owner-unless-public RLS.
- A per-user scheduled worker job clustering the last 14 days of saves by embedding proximity and
  asking the model for a thesis plus 2–3 key points **only when the cluster is genuinely coherent** —
  a weak cluster produces no digest. The worker has no scheduler today; see
  [Open decisions](#open-decisions).
- `GET /digests/{id}`, `PUT`/`DELETE /digests/{id}/like`, `PUT`/`DELETE /digests/{id}/share`. Digests
  are first-class social objects; resharing one saves the digest, not its sources.
- The `digest` feed-item variant: the AI callout *is* the frame, with a `Built from` provenance row
  listing its sources as links. Capped at 1 per 8 items, max 3 per session.

**Touches.** `supabase/migrations/`, `apps/worker/src/`, `packages/shared/src/services/`,
`packages/apispec/`, `apps/web/components/feed/feed-item.tsx`.

**Done when.** A digest names every bookmark it was built from, an incoherent cluster produces
nothing, and two digests never appear within one screenful.

### D16 · Feed feedback and Home

**Outcome.** `/my/dashboard` rebuilt as the ranked feed, with feedback that visibly works.

**Scope.**
- Migration `feed_feedback`; `POST /feed/feedback` for **Not interested**, **Fewer from this domain**,
  and **Mute topic** from each item's overflow menu. Dismissal weights 3× the equivalent positive and
  takes effect on the next request — a returning dismissed item is a bug, not a ranking nuance.
- Layout: header capsule, then `minmax(0,1fr) 268px` with a 32px gap; the feed column caps at 680px
  and the rail drops entirely below 900px.
- Feed column: the scope segmented control with an "Updated *n* min ago" meta, then feed items,
  infinite scroll with a skeleton sentinel and no pagination controls.
- Rail: Continue reading (from D8's endpoint), Your topics this week, People you follow.
- States: three skeleton items; a display-size hero for a new user with the URL field as its primary
  action; an inline empty state for a filtered scope with the control still present; an inline error
  panel that never replaces the page; a persistent `--cd-warning` offline strip over cached items.

**Touches.** `apps/web/app/(private)/my/dashboard/page.tsx`, `apps/web/components/feed/**`,
`packages/apispec/`, `apps/api/src/routes/feed.ts`, `supabase/migrations/`.

**Done when.** Every state renders, a dismissed item does not come back, and the rail's absence below
900px costs the user nothing.

---

## Wave 6 · Remaining surfaces and the gate

### D17 · Search and command palette

**Outcome.** One vocabulary across the search route and `⌘K`.

**Scope.**
- `/search`: query field pinned under the header; results as library rows with the matched span in
  `--cd-hl-bg`; filters for collection, tag, read status, and date. Semantic-only hits carry a
  `Related` neutral tag so a result without a keyword match explains itself.
- `POST /search/ask` answers render as an AI callout bound by the same provenance rule as every other
  AI output: it names the bookmarks it drew from, each as a link.
- The palette (`cmdk`, already a dependency) opens on `⌘K` with sections in fixed order — Actions,
  Your saves, Collections, People — and shows the same provenance line the feed uses. Typing a URL
  surfaces "Save this link" as the first action.

**Touches.** `apps/web/app/(private)/search/page.tsx`, `apps/web/components/{search,global-command-dialog}.tsx`.

**Done when.** Both surfaces render the same row and the same provenance line, and every `search/ask`
answer links its sources.

### D18 · Explore, Profile, Auth, and chrome removal

**Outcome.** The last surfaces move, and the pre-revamp chrome is deleted.

**Scope.**
- `/explore`: topic segmented control, feed items ranked for discovery, a rail of trending
  collections and people, and an honest empty state until the graph is populated.
- `/my/profile` and `/u/{handle}`: avatar, name, join date, counts, and tabs for Saves (public only),
  Collections, and Likes. Someone else's profile is the same page with a **Follow** primary button.
- Auth pages: a single 400px column on `--cd-bg-subtle`; rectangular `--cd-radius-md` inputs, a
  full-width primary pill submit, providers as secondary buttons. The current pill-shaped inputs and
  2rem headings go. Errors render inline under the offending field via `FormMessage`, never as a
  page-level banner.
- Delete `components/cosmic-menu.tsx`, `components/hero.tsx`, and the `.shimmer` block in
  `globals.css`.

**Touches.** `apps/web/app/(private)/{explore,my/profile}/`, `apps/web/app/(auth-pages)/**`,
`apps/web/components/`, `apps/web/app/globals.css`.

**Done when.** No pre-revamp chrome component remains in the tree and every route renders its states.

### D19 · Mobile token pipeline

**Outcome.** `apps/mobile` consumes the same tokens, so the two clients cannot drift. Parity beyond
token adoption is explicitly out of scope for this revamp.

**Scope.**
- Generate a TypeScript theme object from `docs/design-system/tokens.json` at build time rather than
  transcribing values; replace `apps/mobile/constants/Colors.ts`.
- Apply it to the existing surfaces: tabs, `BookmarkCard`, bookmark detail, search, share.
- The header capsule becomes a bottom tab bar plus a compact top bar; hover states become pressed
  states.

**Touches.** `apps/mobile/constants/`, `apps/mobile/components/**`, a generator script.

**Done when.** No colour literal remains in `apps/mobile`, and changing `tokens.json` changes both
clients.

### D20 · Accessibility and definition-of-done gate

**Outcome.** The rules that were called build-breaking actually break the build.

**Scope.**
- Automated contrast verification of `tokens.json` at 4.5:1 for text and 3:1 for meaningful icons and
  control borders, in both modes, as a test rather than a review comment.
- A CI pass over `/dev/patterns` and each route for: a visible focus ring on every interactive
  element, 32px pointer targets (44px touch), `aria-current` on nav, `aria-pressed` on like,
  `aria-live="polite"` on processing status, and `<article>` semantics on feed and library items.
- `prefers-reduced-motion` honoured everywhere — the shimmer flattens to `--cd-bg-inset`, the spinner
  becomes a static ring at 60%.
- Walk the per-surface checklist from `implementation.md` for each migrated route and record the
  result.

**Touches.** `apps/web/`, CI workflow.

**Done when.** A contrast regression or a missing focus ring fails CI, not review.

---

## What the codebase already does differently

Found while surveying the repo. Each is handled inside the deliverable named, and none of them
changes what the specs ask for.

| Finding | Where | Handled by |
| --- | --- | --- |
| The `file` phase is not new — `bookmark.categorizer.service.ts` already files, and **auto-creates collections** via `collectionRepository.createPath`. That contradicts "suggestion, not automation" today, silently. | `packages/shared/src/services/bookmark.categorizer.service.ts` | D6 — the riskiest single change in the plan |
| Phase names on disk are `summarization`, `brief_summary`, `tags`, `images`, `chunking`, `embedding`, `categorization`, `finalization`, `private_link_enrichment` — nine, not the spec's six. | `bookmark.processor.service.ts` | D5 — map and backfill, don't rename blindly |
| `bookmark_tags` is **already dropped**, in `20250919212651_drop_unused_tables.sql`. The data-model doc's "confirm before touching it" is settled: nothing to do. | `supabase/migrations/` | Closed — no work |
| `GET /collections` lives inside `bookmarks.ts`, which is 706 lines, against the repo's own resource-domain convention. | `apps/api/src/routes/bookmarks.ts` | D7 — split as part of the collections work |
| `GET /bookmarks/feed` is `limit`/`offset` returning `GetBookmarksResponse`. Web **and** mobile consume the generated client, so the shape change is a coordinated regeneration, not a web-only edit. | `packages/apispec/bookmarks.tsp` | D14 |
| No rate-limit plugin in the API. The spec needs three different limits (saves 100/day, comments 10/min, follows 100/hour). | `apps/api` | D4 introduces it; D11 and D12 consume it |
| No scheduler in the worker — it is a pgmq poll loop. Digest generation is specified as "on a schedule per user". | `apps/worker` | D15, and an open decision below |
| `apps/web` already runs ESLint and Vitest, so the rule-zero guard and the contrast test both have a home. | `apps/web/package.json` | D1, D20 |

## Open decisions

Four things the specs do not settle, each blocking a specific deliverable. Recommendations given;
none needs answering before Wave 1 starts.

| # | Question | Blocks | Recommendation |
| --- | --- | --- | --- |
| 1 | How does the worker run a per-user scheduled job? It is a pgmq poll loop with no scheduler. | D15 | `@nestjs/schedule` inside the existing worker, enqueueing onto pgmq so the job path stays identical to every other job. Avoids a second broker, which the conventions forbid. |
| 2 | How do existing accounts get a handle? The column does not exist yet, and `/u/{handle}` is specified as the canonical profile URL. | D11, D18 | Backfill a reserved handle from the email local part, mark it unclaimed, and prompt once on next sign-in. Keep `/my/profile` working throughout. |
| 3 | How expensive is the interest vector per feed request? It is the mean embedding of everything finished in 60 days, read from `content_chunks`. | D14 | Measure first with a per-request cache as specified. If p95 suffers, materialise per user on a nightly job — but do not build that until it is measured. |
| 4 | Where does the ranking configuration live so weights are tunable without a deploy? | D14 | A single config row per environment read at request time, with the file values as the fallback. The spec is explicit that weights are "a starting point, not a contract". |

## Cadence

Waves 1 and 2 are sequential and gate everything. From Wave 3 on, Library (D7–D10), Social
(D11–D13), and Mobile (D19) can run as parallel tracks; Feed (D14–D16) needs Social landed first.
D20 runs last because it audits the finished surfaces.

Each deliverable is one PR. A deliverable that leaves the old component in the tree beside the new
one is not finished — the specs are explicit that a migration which keeps both stops being a
migration.
