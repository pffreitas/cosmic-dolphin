# Patterns

The composite patterns that carry Cosmic Dolphin's identity, reconciled to web `4c8d362`. Each ships as a shared component
in `apps/web/components/` and is reused verbatim — a page never re-implements one of these inline.

A page composes the existing patterns; do not rebuild them from historical prototypes. Component contracts live in [components.md](./components.md); platform boundaries in [parity.md](./parity.md).

---

## App shell

`components/shell/app-shell.tsx` · `components/shell/sidebar.tsx` · `components/app-chrome.tsx`

The signed-in frame. It replaced the header capsule (revision R1 in [decisions.md](./decisions.md)):
a floating, content-sized capsule gave the product no persistent sense of place, and kept the
AI-filed collections — the product's argument — inside one page.

```
┌───────────┬──────────────────────────────────────┐
│ sidebar   │ top bar · omnibox (on the centre axis)│
│ 256px     ├──────────────────────────────────────┤
│ sticky,   │ <main> — the page owns its width     │
│ full      │                                      │
│ height    │                                      │
└───────────┴──────────────────────────────────────┘
```

**Sidebar** — `--cd-bg-subtle`, 1px `--cd-border` on its right edge, full viewport height, sticky.
Three groups, top to bottom:

| Group | Contents |
| --- | --- |
| Brand | The brandmark (see [foundations.md § Brand](./foundations.md#brand)), 56px row. |
| Destinations | Home, Explore, Search. `nav[aria-label=Primary]`. |
| Library | All saves, Inbox, Read later, Archive — each with a tabular count. `nav[aria-label=Library]`. |
| Collections | The filed tree, one level of nesting shown with a hairline guide. No "AI filed" marker (R6). `nav[aria-label=Collections]`. |
| Account | Pinned to the bottom: avatar, name, email, and a menu holding Your profile, Theme (Light / Dark / Match system) and Sign out. |

Rows are 32px links: 16px glyph at stroke 1.7, 13.5px label, count right-aligned at 11.5px
`--cd-fg-tertiary` with `tabular-nums`. Inactive rows are `--cd-fg-secondary`, `--cd-bg-inset` on
hover. The **one** current row is `--cd-bg-panel` with a 1px inset `--cd-border` ring, `--cd-fg` at
500, its glyph in `--cd-accent`, and `aria-current="page"`. Library is a group, never also a
destination, so no route can mark two rows current.

Collection and Inbox rows are drop targets while the Library list is dragging (the seam is
`components/shell/library-dnd.tsx`). A drop refiles and pins the placement. `Read later` is a query,
not a folder, and never takes a drop.

Counts and collections are read on the server in `app/layout.tsx` and fail soft — dashes and an
empty tree, never a broken page. `router.refresh()` after a Library write re-reads them.

**Top bar** — 56px, `--cd-bg`, 1px `--cd-border` below, sticky. It carries exactly one thing: the
omnibox, on the content's centre axis (`grid-cols-[1fr_minmax(0,600px)_1fr]`). Page-level controls
belong to the page's own header, never here.

**The omnibox** — `components/header-omnibox.tsx`. A real text input, full width of its 600px
slot, 36px tall, `--cd-radius-md`, `--cd-bg-subtle` with a 1px `--cd-border` hairline; on focus it
takes `--cd-bg-panel`, an `--cd-accent` border and the focus ring.

- **A URL saves.** When the value parses as a capture URL (`lib/capture.ts`), the leading glyph
  becomes a link, the `⌘K` hint is replaced by a small primary **Save** button, and Enter hands the
  URL to `saveCapture`. The field clears at once and the optimistic row appears under Home's
  *Saving now* (or above the page on any other route). Saving never blocks.
- **Words search.** Anything else goes to `/search?q=` on Enter.
- **It says what Enter will do before you press it.** A popover under the field, open while it has
  focus, carries one sentence: the default instruction, "Press Enter to save every.to", or "Press
  Enter to search your library for …". A rate-limit answer lands here too, with the URL left in the
  field.
- **Behind a login** — for a URL, the popover offers the private-link save, which opens the Save a
  link dialog with the URL already in it.
- **`⌘K` focuses the omnibox.** Pressing it again while the omnibox has focus opens the command
  palette with the typed text carried over.

**Responsive** — below 1024px the sidebar becomes a left sheet (288px, capped at 85vw below 640px) behind a menu button at the
top bar's left edge; any navigation closes it. Below 768px the menu trigger moves to a floating
hamburger button at the bottom left. The same sheet holds destinations, Library, collections,
account and Save a link; there is no bottom tab bar (November 27 navigation revision).

**Frames** — `components/app-chrome.tsx` picks the frame by route. Signed in: the app shell.
Signed out on a public route (`/s/[slug]`, `/u/[handle]`): `components/shell/public-header.tsx`, a
full-width 64px bar with the brandmark and **Sign in** / **Get started**. Bare: `/`, the auth pages
and `/dev/*` draw their own frame. Every frame owns the document's single `<main id="main">`, and a
skip link to it is the first tab stop. Pages never render a `<main>`.

**Don't:** put page actions in the top bar. Add a second text field beside the omnibox. Mark two
sidebar rows current. Give the sidebar a shadow — it is separated by its hairline.

---

## Feed item

`components/feed/feed-item.tsx`

A bordered panel — `--cd-bg-panel`, 1px `--cd-border`, `--cd-radius-md`, 16px padding, 12px between
siblings. Article/video/digest/pending plus Home lead/row variants share reusable parts.

**Anatomy, in fixed order — four lines, not six:**

1. **Provenance row** — who and where, before anything else. Trust precedes attention. *Why this
   appeared* rides at the end of this line as a `<details>` disclosure; opened, it takes a full line
   of its own beneath (`open:basis-full open:order-last`), so the overflow menu never moves.
2. **Title** — `title-2`, serif, clamp 2, wrapped in the link to the detail route.
3. **Summary** — `body` at 14px in `--cd-fg-secondary`, clamp 3. Source: `cosmicBriefSummary`,
   falling back to `metadata.openGraph.description`.
4. **Footer** — the social action row on the left; on the right, up to 3 topic tags and the reading
   time as plain `meta` text.

Thumbnail (132×88, `--cd-radius-md`) sits right of blocks 2–3, in the same flex row; at ≤900px article panels use 96×70. Missing/failed images retain the Thumbnail fallback.

**Variants**

| Variant | Difference |
| --- | --- |
| `article` | The base described above. |
| `video` | Thumbnail leads at full width × 210 above the title, with the shared sans/tabular panel duration badge bottom-right. A **Watch with summary** secondary button joins the action row. |
| `digest` | The panel border and padding are dropped (`.feed-item--ai`); the AI callout *is* the frame. See below. |
| `pending` | Title plus staged AI progress in place of the summary, and a skeleton thumbnail. Appears the instant a link is saved. |
| `lead` | Home's top-ranked item. No panel: the thumbnail leads at full width × 300 (`--cd-radius-md`), then the provenance row, a 36px `display`-scale serif title (clamp 3), the summary at `body` 15px within 62ch, clamp 4, and the footer. At ≤640px the image is 180px tall and the title 28px; if no image URL is provided the lead omits the image. One per page, never a digest or a pending save. |
| `row` | The rest of Home's feed, as `divide-y` separator rows rather than panels: provenance line, a 19px serif title (clamp 2) and `body-sm` summary (clamp 2) beside a 108×72 thumbnail, then the footer with at most 2 tags. Row thumbnails hide at ≤640px. Same anatomy order as the base; only the scale drops. |

**Don't:** render a comment thread inline. Show a "trending" badge. Animate items in. Stack two
digests within one screenful. Render more than one `lead`.

---

## Library row

`components/bookmark/library-row.tsx` — replaces the current `bookmark-list-card.tsx`.

Separator rows, not cards: `divide-y` with `--cd-border`, 16px vertical padding, `--cd-bg-subtle` on
hover. This surface is private, so it carries **no social counts**.

**Anatomy — three lines:** unread dot (7px `--cd-accent`, or a transparent spacer when read, so
titles stay aligned) · `title-3` title, clamp 2 · summary in `body-sm`, clamp 2 · one footer line
holding the collection breadcrumb, a `meta` run of `domain · relative time · reading time`, up to 3
topic tags, and the row's overflow menu (revealed on hover or focus from 768px) · 96×64 thumbnail, sm radius (72×56 below 640px). The row has 12px horizontal padding and 16px gaps; its title-to-summary gap is 4px, footer top padding 4px and minimum height 32px.
There is no "Read" tag: the absent dot already says it.

The breadcrumb comes from `collectionPath` and is clickable at every level. When the pipeline is
still filing, it reads `Inbox` followed by an AI *Filing…* marker.

**In the Library** the dot's gutter is shared with the selection checkbox (`leading` slot): the
dot shows at rest, the box on row hover or keyboard focus, and every box shows while anything is
selected. The gutter hangs into the page margin (`md:-ml-[52px]`) so row titles align with the page
title above them.

**Don't:** auto-move a row the user has manually filed. Hide the chronological order behind the
tree. Use a badge for unread.

---

## Provenance row

`components/provenance-row.tsx`

The compact, always-visible answer to "where did this come from". Every AI output and every feed
item carries one.

`favicon chip · source (500 weight, --cd-fg) · dot · attribution · dot · relative time · dot · duration`, at 12.5px
in `--cd-fg-secondary`, wrapping gracefully.

Implementation slots: optional lead; actor (avatar/name/link) and action; ordered sources;
moreCount; attribution; action without actor; timestamp; duration; optional right-aligned trailing.
The row wraps with 7px gaps; each dot travels with the segment after it, so it never dangles at
end of line. Actor/source names are 500/fg; timestamps/duration don't wrap internally. Disclosure
panel: 8px top margin, md/subtle/border, padding 11 vertical / 13 horizontal, sans 13px/1.55.
Absent ranking reason → no disclosure. Reason text comes from API, never fabricated locally.

Content by context:

| Context | Row |
| --- | --- |
| Own save | `domain · you saved this · 2d` |
| Shared by someone | `avatar · Name · shared · domain · 2d` |
| Social signal | `domain · Author · liked by 3 people you follow` |
| AI digest | `Built from · domain · domain · +n more` |
| AI summary | `domain · summarised from the full article` |

**"Why this appeared"** is a sibling `<details>`: a dotted-underline `--cd-fg-tertiary` summary that
expands into a `--cd-bg-subtle` panel giving the actual ranking reason in one sentence, in plain language and in
the second person. It is a disclosure, not a tooltip, and it is never hidden behind a hover.

---

## Callout

`components/ai/ai-callout.tsx` (`AiCallout`; the name predates R6)

The panel for a Cosmic brief, a feed digest, or a collection suggestion. Since R6 it is not dressed as
AI: it is the same material as any other panel.

**Surface**

```
border-radius:  --cd-radius-md
background:     --cd-bg-panel
border:         1px solid --cd-border
padding:        20px   (14px when compact; web p-5 is NOT --cd-space-5=24px)
```

**Slots:** label, optional meta, optional trailing action, body, optional footer.
**Anatomy:** a sentence-case label in 12.5px/600 `--cd-fg-secondary` — optional right-aligned meta
— content — a footer: 16px top margin and a 14px-padded `--cd-border` divider above the provenance row.

The label-to-body gap is 10px (8 compact), header gap 10px. Standard body/footer placement
is shared; Library suggestion banner intentionally puts provenance inline and omits the footer.
The TypeScript footer prop is optional, so provenance is a composition requirement, not a type guarantee.

**Key points** use a 5px `--cd-fg-tertiary` dot, 9px top offset, 11px marker-to-text and item gaps;
body sans 14px/1.55 secondary with optional 500/fg lead-in term. Never `01 / 02 / 03`: findings are not a sequence,
and numbering claims an order the content doesn't have.

**Don't:** a sparkle, a tinted or gradient ground, a glow, an "AI" badge or label. An accent rail
down the left edge. A chat bubble. The word "magic". Any callout without a footer naming its
sources.

---

## Social action row

`components/social/action-row.tsx`

`like · comment · save · share`, left-aligned, ghost buttons at 12.5px/500 in `--cd-fg-secondary`
with 15px icons, 8px padding (32px effective target), 2px apart.

- **Like** — `aria-pressed`; active state fills the heart `--cd-like`. Optimistic, reconciled
  against `bookmark_likes`.
- **Comment** — count only; opens the thread (inline on detail, drawer in the feed).
- **Save** — reshares into the current user's library; active state is `--cd-accent` and the label
  becomes **Saved**.
- **Share** — copies the `share_slug` URL and toasts.

Counts stay muted until the user acts and abbreviate from 1000 (`1k`, `2.1k`); below 100 scaled units use one decimal with trailing .0 removed, then rounded whole scaled units; use m from 1,000,000. Zero counts show
no number at all.

**Don't:** put this row on a Library row. Show a like count before the first like. Reorder the
actions between contexts — muscle memory is the point.

---

## Staged AI progress

`components/ai/processing-steps.tsx`

Reads `bookmark_processing_events` and shows one line per phase.

`done` — filled `--cd-success` circle with a check, `--cd-fg-secondary` label.
`active` — spinning `--cd-accent` ring, `--cd-fg` label, ellipsis.
`pending` — hollow `--cd-border-strong` circle, `--cd-fg-tertiary` label.
`failed` — `--cd-danger` circle, label plus an inline **Retry** ghost button.

Markers are 14px with a 1.5px border; success/failure contain a 10px glyph at stroke 3.
Stack: gap 9, text 13px/1.4 and marker gap 9. Inline: 12.5px/1.4, marker gap 7,
horizontal step gap 16 and row gap 6. At ≤640px with multiple inline steps, only active/failed
steps remain visible. Reduced-motion active marker is a complete still ring at .6 opacity.
Retry exists only for failed steps with a callback.

Phase labels are user-facing and past/present tense, never internal names: *Fetched page*,
*Extracted content*, *Summarising…*, *Tagging*, *Filing into a collection*. Embed is not shown.

The row exists the instant a URL is submitted, inside a real feed or library item — never a
full-screen spinner, never a blocking modal, never a progress bar with a fake percentage. Phase
changes announce once through `aria-live="polite"`.


## Compact navigation and page insets

Source: `components/shell/app-shell.tsx` and native `components/web-home/FloatingNavigation.tsx`.
Below 768px on web, and on native Home, Library, Explore and saved detail, a 48 × 48 circular
hamburger control floats 16px from the left and bottom safe-area edges. It uses the previous
navigation bar's `nav-surface` (panel at 95% opacity), 10px web backdrop blur / native BlurView,
20px icon at stroke 1.8, secondary foreground and `shadow-floating-nav`. The focus ring stays
outside the circular clip. Content remains scrollable behind it; existing trailing padding keeps
last-row actions reachable. Tablets retain the top menu and desktop retains the sidebar.

The button opens the existing left navigation sheet. Home, Library filters/collections, Search,
Explore and the account menu retain their destinations. Save a link opens the existing capture
dialog/sheet after closing navigation; it does not create a second capture controller.

Main shell: padding 16 horizontal / 24 top; from 640 horizontal 24; from 768 top 32; from 1024
horizontal 40. Bottom padding 112 below 768, 80 above. Topbar height 56; desktop sidebar 256;
compact toolbar logo 32. Preserve caller padding on top of these values (Home adds its own inset).

## Reader prose and highlights

Source: `components/bookmark/detail/reader-prose.tsx` (`readerProseClass`), `reader.tsx`,
`selection-popover.tsx`. Serif 17px below 640, 18px above, line 1.72, inherited -.006em tracking.
680px page column; no second narrower prose column. Markdown/GFM renderer, not the streaming
answer renderer. Copy the hierarchy as one shared rich-content renderer, not per-screen styles.

| Element | Web rule |
| --- | --- |
| Paragraph | vertical margin 1.1em |
| h2 | 26px/600, line 1.25, tracking -.015em; top 1.8em, bottom .5em |
| h3 | 20px/600, line 1.35, tracking -.01em; top 1.6em, bottom .45em |
| h4 | sans 14px/600; top 1.5em, bottom .4em |
| Lists | vertical margin 1.15em, indent 1.4em; items .4em vertical; tertiary markers |
| Quote | left 2px accent-border, left padding 1.1em; vertical margin 1.6em; serif 21px/1.55 italic secondary; inner paragraphs .6em |
| Link | accent, underline, offset 2px, accent-border decoration; external target, noopener/noreferrer |
| Strong | 600 fg |
| Inline code | mono .86em, inset, xs radius, padding 2 vertical / 4 horizontal |
| Code block | vertical margin 1.5em, padding 16, md radius/inset; horizontal scrolling, code 13px |
| Image | vertical margin 1.6em, natural aspect, max width 100%, md radius |
| Table | sans 14px; vertical margin 1.5em; independent horizontal scroll; cells padding 6 vertical / 8 horizontal, bottom border; header left/600 |
| Horizontal rule | vertical margin 2.2em, border |
| Highlight | hl-bg/fg, xs radius; padding 1px vertical / .5px horizontal, no extra border/weight |

First/last child outer margins zero. Selection tools and progress persistence are interaction
adapters; keep highlight anchoring tied to the same content. Native text selection/rasterization
must be tested explicitly, not inferred from color tokens.

## Search result and sourced answer

Sources: `components/search/search-row.tsx`, `search-answer.tsx`, `search-view.tsx`.
SearchRow composes ProvenanceRow (22px left inset, 16px top), then LibraryRow (6px top, no internal
bottom border); wrapper owns separator. Omit duplicated domain/time in the LibraryRow footer.
Literal matches use hl-bg/fg, xs radius and cloned decoration; semantic-only matches add neutral
Related. Same SearchRow is used by the route and desktop palette.

Answer composes AiCallout labelled “Answer” with linked source provenance (“Built from”). No
sources → render nothing; empty nonstreaming answer → render nothing. Show its own skeleton while
sources are pending. Text: sans 14px/1.6 secondary, preserve line breaks; streaming cursor 2px×1em,
tertiary, offset down 2px. Every source remains named and linked; no +n hiding citations. Result
filters affect the result list; answer uses the whole library. Answer failure does not discard
successful rows. Sources arrive before text. These are separate lifecycles, not a full-page spinner.

## Comments and drawer

Sources: `components/social/comment-thread.tsx`, `comment-drawer.tsx`. Feed opens thread on demand;
no thread mounted/fetched while drawer is closed. From 640: full-height right drawer width 420,
max 92vw, square corners, own vertical scroll, edge slide rather than centered zoom. Below 640:
shared bottom-sheet geometry. Heading is Comments or singular/plural count; optional item title
clamps to 2 lines. Detail mounts thread inline instead.

Thread: gap 16, separator list; each row padding 14 vertical; replies indent 44. Avatar 36, row gap
12; text column gap 6. Name 13px/500, timestamp/status 12px, body 13.5px/1.55 secondary with
preserved whitespace and word wrapping. Actions reuse ghost sm buttons with 15px icons. Composer
uses shared textarea with min-height 72; submission/error/count state belongs to the thread.
Deleted tombstones, loading, empty, error, signed-out, offline, reply/edit/report/block states
must be captured using the current component and permission props; do not leak owner controls.

## Data and interaction boundary

Patterns accept display data and event callbacks; navigation, API mutation, clipboard and image
loading belong to platform adapters. Preserve domain fallbacks, collection-path ordering, relative
time/count formatting and public-slug routing. Own/private and public models are not interchangeable.
State owners must fence account switches and stale requests. A visual contract does not authorize
new offline queues, ranker behavior or exposing private cache data. See functional and mobile specs.


## Collection suggestion, private notice and brief

`bookmark/library/suggestion-callout.tsx`: Library uses `layout=banner`, overriding compact callout
padding to 12 vertical / 16 horizontal. Label Suggestion, then wrapping row with horizontal gap
24 / vertical 12; text 13.5px/1.55 secondary, collection name 500/fg, inline provenance link to
Inbox. Buttons sm primary Create collection and ghost Not now, gap 8. Both disabled while either
request is pending; chosen button keeps label and loading spinner. Success removes the banner and
refreshes; failure toasts and retains it. Stacked variant uses compact default padding, 13px/1.55
body, buttons 12px below, and 12px/1.5 footer. Do not require a footer divider on the banner.

`bookmark/private-link-note.tsx`: shared warning notice, not processing failure. Md/subtle/border,
padding 10 vertical / 12 horizontal, wrap gap 8, sans 13px/1.5 secondary. Warning lock 14px with
1px top offset; “Private link.” 500/fg; optional trailing action. No Retry.

`bookmark/detail/cosmic-brief.tsx`: regular callout label Cosmic brief; summary sans 14.5px/1.6,
16px below when key points exist. Sentence-case Key points label 12.5px/600 fg, 10px below;
AiKeyPoints body as above. Footer provenance with source link and owner-only Regenerate ghost sm,
14px icon and 6px gap. No summary and no points → no brief. Empty source domain is not a separate
render guard in this component (unlike SearchAnswer); do not assume provenance is type-enforced.

## Continue reading

`feed/home-rail.tsx` exports the continue-reading strip and 4px pill ProgressMeter (inset/accent).
Cards: md/panel/border, padding 14 vertical / 16 horizontal, column gap 14, title 17px/600 clamp 2;
meter/time row gap 10, metadata 12.5px line 1. Desktop auto-fit columns min(min(240px,100%),1fr),
12px gap. At ≤640: 78%-width snap columns, margin -16, padding/scroll padding 16, scrollbar hidden.
Meter uses direct percentage width, no transition; don't substitute the generic Progress primitive.
