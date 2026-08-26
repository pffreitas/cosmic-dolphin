# Pages

Route-by-route composition. Patterns are fixed; how a page arranges them is not — this document is
the intended arrangement, not a cage. Every page must ship all of its listed states.

Routes below map to `apps/web/app/`.

---

## Home · `/my/dashboard`

The algorithmically ranked social feed. See
[functional-spec/05-feed.md](../functional-spec/05-feed.md) for ranking behaviour.

**Layout** — header capsule; then a two-column grid, `minmax(0,1fr) 268px`, 32px gap, 24px page
padding. Feed column caps at 680px. Below 900px the rail drops entirely; nothing in it is unique.

**Feed column** — a scope segmented control (For you / Following / Unread) with a "Updated *n* min
ago" `meta` on the right, then the feed items. Infinite scroll with a skeleton feed item as the
sentinel; no pagination controls.

**Rail** — Continue reading (up to 3 in-progress saves with percentage and time left) · Your topics
this week (tags, linking into Library filtered) · People you follow (up to 5, with weekly save
counts).

**States**

| State | Treatment |
| --- | --- |
| Loading | Three skeleton feed items. The rail renders its labels immediately with skeleton rows beneath. |
| Empty (new user) | Display-size hero: "Save your first link." A URL input with the primary CTA, and three suggested sources. The rail is hidden. |
| Empty (scope filter) | Inline empty state inside the feed column; the segmented control stays. |
| Error | Inline panel with the reason and a **Retry** button. Never replace the whole page. |
| Offline | A persistent `--cd-warning` strip under the header; cached items stay readable. |

---

## Library · `/my/library`

Saved-link-first, chronological, AI-filed. Private surface — no social affordances anywhere.

**Layout** — header capsule; then `216px minmax(0,1fr)`, 32px gap.

**Rail** — the collection tree. `All saves`, `Inbox`, then AI-created collections with their
children, then `Read later`. Each row carries a mono count; the selected row takes
`--cd-accent-soft`. An **AI filed** marker sits beside the "Collections" label. Below the tree, a
collection-suggestion AI callout with **Create** / **Not now**.

**Main** — a header block (`title-2` collection name, `meta` count line) with the read-status
segmented control and a sort control on the right; then library rows in a `divide-y` list.

**Interactions** — clicking a breadcrumb navigates to that collection. Dragging a row onto a tree
node refiles it and pins the placement against further AI moves. Bulk selection (shift-click)
enables refile, mark read, and archive.

**States** — loading: six skeleton rows. Empty library, empty collection, and empty read-status
filter each get their own copy. Filing-in-progress rows show the `Inbox` breadcrumb with the AI
*filing…* marker and a skeleton summary.

---

## Bookmark detail · `/bookmarks/[bookmarkId]`

Read, then discuss. The one place the serif runs at full size.

**Layout** — header capsule; then a single centred column at 720px, 32px top padding. No rail.

**Order** — this sequence is the argument of the page and must not be rearranged:

1. **Hero** — collection breadcrumb · `title-1` title · provenance row (domain, author, saved time,
   reading time) · action row (**Mark as read** primary, Open original, Share, overflow).
2. **Cosmic brief** — an AI callout: summary paragraph, `KEY POINTS` label, dotted key points, and a
   `.ai-foot` with the source and a **Regenerate** ghost button.
3. **Reader** — extracted content at 16px/1.75 within `--cd-measure`, with user highlights, pull
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
in the header capsule and a sign-in prompt beneath the comments.

Must render server-side with complete Open Graph tags — this route is how the product spreads.

---

## Explore · `/explore`

Currently a placeholder. Composition: header capsule, then a topic segmented control, then the same
feed items ranked for discovery rather than personal usefulness, with a rail of trending
collections and people to follow. Empty state until the social graph is populated.

---

## Search · `/search`

A full route as well as a command-palette surface. Query field pinned under the header; results as
library rows with the matched span in `--cd-hl-bg`; filters for collection, tag, read status, and
date as a segmented control plus popovers. Semantic hits carry a `Related` neutral tag to explain
why a row without a literal match is present.

---

## Profile · `/my/profile`

Avatar, name, join date, and counts (saves, collections, followers, following). Tabs for Saves
(public only), Collections, and Likes. Someone else's profile is the same page with a **Follow**
primary button.

---

## Auth · `/(auth-pages)/sign-in`, `/sign-up`, `/forgot-password`

Single centred column at 400px on `--cd-bg-subtle`. Brandmark, `title-2` heading, one line of
`body-sm`, then the form: rectangular `--cd-radius-md` inputs, full-width primary pill submit,
provider buttons as secondary. The current pill-shaped inputs and 2rem headings are removed.

Errors render inline under the offending field via `FormMessage`, never as a page-level banner.
