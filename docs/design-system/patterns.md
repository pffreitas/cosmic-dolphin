# Patterns

The composite patterns that carry Cosmic Dolphin's identity. Each ships as a shared component
in `apps/web/components/` and is reused verbatim — a page never re-implements one of these inline.

Build them **before** refactoring any page. A page composes them; it never re-implements one.

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

**Responsive** — below 1024px the sidebar becomes a left sheet (288px) behind a menu button at the
top bar's left edge; any navigation closes it. Below 768px the bottom tab bar (Home, Library, Save,
Search, You) takes over primary navigation, and the sheet remains the way into collections.

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
siblings. Four shapes share one skeleton.

**Anatomy, in fixed order — four lines, not six:**

1. **Provenance row** — who and where, before anything else. Trust precedes attention. *Why this
   appeared* rides at the end of this line as a `<details>` disclosure; opened, it takes a full line
   of its own beneath (`open:basis-full open:order-last`), so the overflow menu never moves.
2. **Title** — `title-2`, serif, clamp 2, wrapped in the link to the detail route.
3. **Summary** — `body` at 14px in `--cd-fg-secondary`, clamp 3. Source: `cosmicBriefSummary`,
   falling back to `metadata.openGraph.description`.
4. **Footer** — the social action row on the left; on the right, up to 3 topic tags and the reading
   time as plain `meta` text.

Thumbnail (132×88, `--cd-radius-md`) sits right of blocks 2–3, in the same flex row.

**Variants**

| Variant | Difference |
| --- | --- |
| `article` | The base described above. |
| `video` | Thumbnail leads at full width × 210 above the title, with a mono duration badge bottom-right. A **Watch with summary** secondary button joins the action row. |
| `digest` | The panel border and padding are dropped (`.feed-item--ai`); the AI callout *is* the frame. See below. |
| `pending` | Title plus staged AI progress in place of the summary, and a skeleton thumbnail. Appears the instant a link is saved. |
| `lead` | Home's top-ranked item. No panel: the thumbnail leads at full width × 300 (`--cd-radius-md`), then the provenance row, a 36px `display`-scale serif title (clamp 3), the summary at `body` 15px within 62ch, and the footer. One per page, never a digest or a pending save. |
| `row` | The rest of Home's feed, as `divide-y` separator rows rather than panels: provenance line, a 19px serif title (clamp 2) and `body-sm` summary (clamp 2) beside a 108×72 thumbnail, then the footer with at most 2 tags. Same anatomy order as the base; only the scale drops. |

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
topic tags, and the row's overflow menu (revealed on hover or focus from 768px) · 96×64 thumbnail.
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
padding:        --cd-space-5   (14px when compact)
```

**Anatomy:** a sentence-case label in 12.5px/600 `--cd-fg-secondary` — optional right-aligned meta
— content — a footer: a 14px-padded `--cd-border` divider above the provenance row.

**Key points** use a 5px `--cd-fg-tertiary` dot. Never `01 / 02 / 03`: findings are not a sequence,
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

Counts stay muted until the user acts and are abbreviated above 4 digits (`2.1k`). Zero counts show
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

Phase labels are user-facing and past/present tense, never internal names: *Fetched page*,
*Extracted content*, *Summarising…*, *Filing into a collection*.

The row exists the instant a URL is submitted, inside a real feed or library item — never a
full-screen spinner, never a blocking modal, never a progress bar with a fake percentage. Phase
changes announce once through `aria-live="polite"`.
