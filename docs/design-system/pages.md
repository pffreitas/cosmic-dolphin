# Pages

Route-by-route composition. Patterns are fixed; how a page arranges them is not — this document is
the intended arrangement, not a cage. Every page must ship all of its listed states.

Routes below map to `apps/web/app/`.

---

## Home · `/my/dashboard`

The algorithmically ranked social feed. See
[functional-spec/05-feed.md](../functional-spec/05-feed.md) for ranking behaviour.

**The morning edition.** Home reads top-down like an edition: what's arriving, what you were halfway
through, the one thing most worth your time, then the rest. Every block answers *what should I read
now* before the next one is asked.

**Layout** — app shell; then a single 1100px column, holding, in order:

1. **Edition header** — a 13px/500 `--cd-fg-tertiary` kicker with the reader's date ("Friday, 2
   October"), a 34px serif greeting by time of day ("Good morning, Paulo"), and one `body-sm` line saying how the
   scope is ordered plus "updated *n* min ago". The scope segmented control (For you / Following /
   Unread) sits on the right, bottom-aligned. Date, greeting and the updated time are the reader's
   clock, so they render after mount.
2. **Saving now** — one `--cd-bg-subtle` bordered strip, a hairline between rows: each in-flight
   save (optimistic captures and the feed's `pending` items, de-duplicated) as favicon · `title-3`
   title (clamp 1) · time, with staged AI progress laid out inline on the right. Absent when nothing
   is in flight. On Home this replaces the global pending rows above the page.
3. **Pick up where you left off** — up to 3 in-progress saves as bordered cards in an auto-fit grid
   (`minmax(240px,1fr)`): `title-3` title (clamp 2) and a progress meter with the time left. A
   horizontally scrolling, snapping strip below 640px. Absent when nothing is part-read.
4. **The feed and its rail** — below a hairline, a grid of `minmax(0,720px) 260px`, 40px gap. The
   first ranked bookmark renders as the feed item's `lead` variant; digests stay AI callouts; every
   other bookmark is a `row`. Infinite scroll with a skeleton row as the sentinel; no pagination
   controls. Below 900px the rail drops entirely; nothing in it is unique.

**Rail** — Your topics this week (rows of topic · "*n* saves", linking into search) · People you
follow (up to 5, with weekly save counts).

**States**

| State | Treatment |
| --- | --- |
| Loading | The edition header with the scope control live, a skeleton `lead`, and three skeleton rows. The rail renders its labels immediately with skeleton rows beneath. |
| Empty (new user) | Two columns from 1024px. Left: a 44px `display` hero, "Save your first link.", a URL input with the primary CTA, and three suggested sources. Right: a bordered `--cd-bg-subtle` list of what the first save sets in motion — lands in the library, gets a brief, gets filed. The rail is hidden. |
| Empty (scope filter) | Inline empty state inside the feed column; the segmented control stays. |
| Error | Inline panel with the reason and a **Retry** button. Never replace the whole page. |
| Offline | A persistent `--cd-warning` strip under the header; cached items stay readable. |

---

## Library · `/my/library`

Saved-link-first, chronological, AI-filed. Private surface — no social affordances anywhere.

**Layout** — app shell; then a single 960px column. The collection tree is **not** on this page:
it lives in the sidebar (patterns.md § App shell), where All saves, Inbox, Read later, Archive and
the AI-filed collections are one click from every route, each with a tabular count, and the
current one marked.

**Main** — a page header (`components/ui/page-header.tsx`): eyebrow "Library" (or "Library ›
Parent" inside a nested collection), the collection name, a count line, and on the right the
read-status segmented control and a **Sort** menu (a ghost button opening radio items — sort is a
preference, not a filter). Below it, when there is one, the collection-suggestion AI callout as a
one-line `banner` with **Create collection** / **Not now** and its sources. Then library rows in a
`divide-y` list whose selection gutter hangs into the margin.

**Interactions** — clicking a breadcrumb navigates to that collection. Dragging a row onto a
collection or Inbox in the sidebar refiles it and pins the placement against further AI moves. Bulk selection (shift-click)
enables refile, mark read, and archive.

**States** — loading: six skeleton rows. Empty library, empty collection, and empty read-status
filter each get their own copy. Filing-in-progress rows show the `Inbox` breadcrumb with the AI
*filing…* marker and a skeleton summary.

---

## Bookmark detail · `/bookmarks/[bookmarkId]`

Read, then discuss. The one place the serif runs at full size.

**Layout** — app shell; then a single centred column at 680px. No rail. A 2px `--cd-accent`
reading-progress hairline runs across the top of the viewport, tracking scroll position directly
(no easing, so nothing for reduced motion to stop).

**Order** — this sequence is the argument of the page and must not be rearranged:

1. **Hero** — collection breadcrumb · `title-1` title (44px) · provenance row (domain, author, saved time,
   reading time) · action row (**Mark as read** primary, Open original, Share, overflow).
2. **Cosmic brief** — an AI callout: summary paragraph, `KEY POINTS` label, dotted key points, and a
   `.ai-foot` with the source and a **Regenerate** ghost button.
3. **Reader** — extracted content in the `reader` role (18px/1.72) on the full 680px column, so the
   brief and the prose share one right edge, with user highlights, pull
   quotes, and images from `cosmicImages`.
4. **Social row** plus a highlight count.
5. **Comments** — `divide-y` thread with 36px avatars, then the current user's comment input.

**States** — processing: the brief position holds staged AI progress and the reader holds a
skeleton. Failed: a `--cd-danger` callout naming the failure with **Retry**, and the original link
still opens. Private link: a `--cd-warning` note explaining that the page couldn't be fetched, with
the user's own title and notes shown instead. Not found / no access: a 404 with a route back to
Library.

---

## Shared bookmark · `/s/[slug]`

The public, unauthenticated view of a shared save. Same composition as the detail page minus the
Library breadcrumb, the read toggle, and the highlights; plus a **Save to your library** primary CTA
in the hero and a sign-in prompt beneath the comments. Signed out, it sits under the public header.

Must render server-side with complete Open Graph tags — this route is how the product spreads.

---

## Explore · `/explore`

Composition: app shell and a page header ("Explore"), then a topic segmented control, then the same
feed items ranked for discovery rather than personal usefulness, with a rail of trending
collections and people to follow. Empty state until the social graph is populated.

---

## Search · `/search`

A full route as well as a command-palette surface. A page header ("Search"), then the query field
pinned under the top bar (`sticky top-14`); results as
library rows with the matched span in `--cd-hl-bg`; filters for collection, tag, read status, and
date as a segmented control plus popovers. Semantic hits carry a `Related` neutral tag to explain
why a row without a literal match is present.

---

## Profile · `/my/profile`

Avatar, name, join date, and counts (saves, collections, followers, following). Tabs for Saves
(public only), Collections, and Likes. Someone else's profile is the same page with a **Follow**
primary button.

---

## Landing · `/`

Signed out only — a signed-in reader is redirected to Home. Draws its own frame: the public header,
then four beats, then a footer.

1. **Hero** — an AI-chip kicker ("Summaries that name their sources"), a two-line 68px `display`
   headline whose second line is `--cd-fg-secondary`, one 18px line of what the product does,
   **Start your library** (primary, large) and **Sign in**. Behind it, the single top-centre
   `--cd-ai-glow` aura. Below, the Library in an app window, fading out at its foot.
2. **How it works** — on `--cd-bg-subtle`: three alternating text-and-vignette rows (capture,
   Cosmic brief, filing), numbered `01`–`03`.
3. **Principles** — "Built to be finished, not scrolled." beside a hairline-ruled definition list.
4. **Closing** — an AI-callout-material panel with one sentence and **Create your account**.

Every illustration is a vignette from `components/marketing/vignettes.tsx`: the product's own
components on illustrative content, marked `inert` and labelled with what they depict. Never a
screenshot, never a mock drawn to look like the app.

---

## Auth · `/(auth-pages)/sign-in`, `/sign-up`, `/forgot-password`

A split screen. The form column on the left: brandmark top-left, the form centred at 380px with a
30px serif heading and one line of `body-sm`, rectangular `--cd-radius-md` inputs, a full-width
primary pill submit, provider buttons as secondary; a quiet copyright at the foot. From 1024px, a
showcase panel on the right on `--cd-bg-subtle` with one aura, holding a Cosmic brief vignette and
one sentence on what the account is for. `/protected/reset-password` uses the form column alone.

Errors render inline under the offending field via `FormMessage`, never as a page-level banner.
