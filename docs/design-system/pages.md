# Pages

Route-by-route composition observed in web at `4c8d362`. Replication preserves these arrangements
and the reusable [patterns](./patterns.md), including caller overrides. State requirements are not
proof of state coverage: [inventory](./inventory.md) and the historical audit distinguish implemented
states from gaps. Native product scope remains in its approved feature spec.

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
   October"), a 34px serif greeting (28px at ≤640px) by time of day ("Good morning, Paulo"), and one `body-sm` line saying how the
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
   first ranked bookmark renders as the feed item's `lead` variant; digests stay callouts; every
   other bookmark is a `row`. Infinite scroll with a skeleton row as the sentinel; no pagination
   controls. At ≤900px the rail drops entirely; nothing in it is unique.

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
2. **Cosmic brief** — an AI callout: summary paragraph, sentence-case `Key points` label, dotted key points, and a
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

1100px outer column, PageHeader with 24px bottom padding; below, flex layout gap 40 with feed
max-width 680 and rail (hidden at ≤900). Topic control is inside the feed column. Everything plus
four leading topics; append an outside selected topic. Feed uses article/video panels with 12px
gaps; no personalized feedback menu, no cached-ranking updated time, no first-save hero. Discovery
rail is `components/explore/explore-rail.tsx`; its content is not a generic “trending” promise.
Initial/next-page error panel keeps the feed, with Retry; empty topic and empty public graph have
distinct copy; infinite-scroll sentinel uses FeedItemSkeleton. Comment drawer mounts on demand.

---

## Search · `/search`

A full route as well as a command-palette surface. A page header ("Search"), then the query field
pinned under the top bar (`sticky top-14`); results as
library rows with the matched span in `--cd-hl-bg`; filters for collection, tag, read status, and
date as a segmented control plus popovers. Semantic hits carry a `Related` neutral tag to explain
why a row without a literal match is present. Outer width 960. Filter controls are read-status
segments plus collection/tag/date Selects (not generic popovers). Query input is 48px tall/15px,
left padding 40 for icon; filter Selects are 32px. The sticky filter area wraps and preserves URL
state. Result rows are the shared SearchRow composite, including provenance and matched snippets.

An Answer callout appears above results: independent skeleton/streaming lifecycle, all sources
linked, no answer rendered without sources. The answer uses the whole library while result filters
narrow rows. Answer failure does not discard results. See patterns.md § Search result and sourced
answer for its exact typography, cursor and suppression rules.

---

## Profile · `/my/profile`

Same ProfileView for `/my/profile` and `/u/[handle]`, public data only. Centered width 720,
section gap 32, bottom padding 32. Header gap 24; 72px avatar, name serif 30px/600 at 1.15 with
-.022em tracking; metadata 13.5px/1.4. Identity gap 20. Counts: public saves, collections, followers,
following (15px/600 value, 13px label; gap 6; count-group gap 20).
Tabs are border-underlined links for public Saves, Collections, Likes, **not** pill segments.
Saves/Likes reuse LibraryRow; collection rows use 16px serif titles and 14px vertical padding.
Own profile slots Edit profile/Sign out; another profile slots Follow. Empty copy varies by owner,
tab and blocked state; do not insert private fields or private saved content into the public model.

---

## Landing · `/`

Signed out only. Signed-in readers go straight to Home. Landing is forced light by ThemeProvider; changing its theme does not overwrite the stored preference for other routes.

“Close the tabs. Keep the ideas.” leads into three chapters built around the same source.
A Meshy reinterpretation of Earthrise opens the page, with a wide desktop composition and a tighter
mobile crop below the copy. The sample article uses the historical NASA imagery. Large sans-serif display type handles the marketing promise,
while Source Serif distinguishes the saved article and its adaptations. The header and footer use the
continuous dark treatment. On mobile and desktop the header shows the brand, Sign in and Sign up.
The footer links to all three chapters.

- **Understand.** Save the sample NASA article, open its sourced Cosmic brief, and mark it read.
- **Retrieve.** Search a one-item sample library using the detail you remember. The Library row shows the matching article, its source and its suggested collection. The sample uses local keyword matching.
- **Adapt.** Switch between a visual comparison, a narrated audio brief with transcript, a captioned short film and an infographic. These are locally prepared samples. The signed-in product generates written briefs.

The examples require no account or API calls. Audio and video start on request. The film pairs
a time-compressed excerpt of Ernie Wright’s spacecraft visualization with the original photograph and a narrated brief.
[Original article and image comparison](https://science.nasa.gov/earth/earth-observatory/earthrise-revisited-82693/) · [Bill Anders photograph](https://science.nasa.gov/resource/apollo-8s-iconic-earthrise/) · [NASA Scientific Visualization Studio footage](https://svs.gsfc.nasa.gov/4129/)

### Landing analytics

The production Google tag sends page views. For landing-page analysis, filter GA4 Explorations
to the homepage and break down sessions by source / medium or campaign. Use these events to see
which interactions lead visitors to the signup form.

| Event | Trigger | Parameter |
| --- | --- | --- |
| `landing_signup_click` | Click through to signup | `cta_placement` = header, hero, closing or footer |
| `landing_sample_open` | Save the sample and open its brief | — |
| `landing_sample_read` | Mark the brief read | — |
| `landing_library_search` | Leave the sample search after editing a nonempty query | `result_count` = 0 or 1 |
| `landing_format_select` | Switch sample formats | `sample_format` = visual, audio, short_video or infographic |
| `landing_media_play` | Start or resume audio or video | `sample_format` = audio or short_video |

To report on the parameters, register `cta_placement` and `sample_format` as event-scoped
custom dimensions in the GA4 property. Signup clicks measure intent. Count completed
registrations separately. The custom events omit search text, saved URLs and account identifiers.

### Positioning evidence

The product model treats marking a save read as success. Home ranks candidates using topic affinity,
source affinity, effort and other signals. The bookmark detail exposes a brief and its source, while
the Library keeps the collection editable. Together these support a promise about choosing a next read.

| Competitor | What its landing page leads with | Implication for this page |
| --- | --- | --- |
| [Raindrop.io](https://raindrop.io/) | Bookmark management, collections and retrieval | Filing supports the story after the visitor saves something. |
| [Readwise Reader](https://readwise.io/read) | A unified reading and annotation environment for power readers | Show the decision immediately before reading an original. |
| [mymind](https://mymind.com/) | Private recall and automatic organization | Make the content of a brief inspectable before signup. |

These are observations about public positioning. The visual alternatives considered were a
photo-led editorial spread, a capture-to-reading walkthrough and a library tour. The walkthrough
lets visitors test the product promise in a few actions, while the editorial photograph gives the
example a recognizable subject.

---

## Auth · `/(auth-pages)/sign-in`, `/sign-up`, `/forgot-password`

A split screen. The form column on the left: brandmark top-left, the form centred at 380px with a
30px serif heading and one line of `body-sm`, rectangular `--cd-radius-md` inputs, a full-width
primary pill submit, provider buttons as secondary; a quiet copyright at the foot. From 1024px, a
showcase panel on the right on `--cd-bg-subtle` with one aura, holding a Cosmic brief vignette and
one sentence on what the account is for. `/protected/reset-password` uses the form column alone.

Errors use the current FormMessage placement in each form. Routes use the shared AuthShell,
brand and field/button primitives; provider and password-reset behavior remain platform adapters.
Marketing/auth are not covered by the four `/dev/*` fixtures: validate their actual routes.

## Frame and route state boundaries

`components/app-chrome.tsx` picks signed-in AppShell, signed-out PublicHeader, or bare framing.
PublicHeader: sticky top/z30, 64px row, max-width 1200, padding 16 horizontal (24 from 640),
brand left, account buttons right with 8px gap. Brand collapses to a 44px tile below 640.
Landing owns a separate marketing frame; do not apply app page typography to its sans hero.

The historical audit records no route-level loading boundary on detail/shared/profile and no
`error.tsx`; verify the current route before promising one. In-component skeletons and errors are
not equivalent to route bootstrap handling. See inventory for source owners and parity.md for
matched captures and known limits.
