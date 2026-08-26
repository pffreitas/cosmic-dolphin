# Patterns

The seven composite patterns that carry Cosmic Dolphin's identity. Each ships as a shared component
in `apps/web/components/` and is reused verbatim — a page never re-implements one of these inline.

Build all seven **before** refactoring any page.

---

## Header capsule

`components/app-header.tsx`

A glass capsule floating on a tinted band. The band is what carries brand colour into the app;
the capsule stays translucent so the page reads through it.

**Anatomy** — a three-column grid, `1fr auto 1fr`:

| Column | Contents |
| --- | --- |
| Left | Brandmark: 20px accent square with an offset dot, then "Cosmic Dolphin" at 14px/600. |
| Centre | Destinations: Home, Library, Explore. |
| Right | Search chip, **Save a link** (primary pill), avatar. |

The grid — not flexbox with a spacer — is the load-bearing detail: it keeps the centre column
optically centred in the capsule even when the left and right columns are different widths, which is
what makes the header feel stable as counts and names change.

**Surface**

```
padding:        8px 8px 8px 18px
border-radius:  --cd-radius-pill
background:     --cd-nav-glass          /* vertical white gradient, translucent */
border:         1px solid --cd-nav-edge
box-shadow:     --cd-nav-shadow, inset 0 1px 0 --cd-nav-sheen
backdrop-filter: saturate(170%) blur(10px)
```

The band behind it is `linear-gradient(180deg, --cd-nav-band-top, --cd-nav-band-bot)` with 16px of
bleed below the capsule.

**States** — active destination gets `--cd-nav-pill` fill and `--cd-fg` text, with
`aria-current="page"`. Inactive links are `--cd-fg-secondary`, going `--cd-fg` on hover. The search
chip is a button that opens the command palette, not a real input.

**Responsive** — below 900px the grid collapses to a single column, the capsule squares off to
`--cd-radius-lg`, and destinations move into a bottom tab bar on mobile (Home, Library, Save,
Search, You).

**Don't:** put page-level actions in the capsule. Grow it past 56px. Let it become opaque — the
translucency is the point.

---

## Feed item

`components/feed/feed-item.tsx`

A bordered panel — `--cd-bg-panel`, 1px `--cd-border`, `--cd-radius-md`, 16px padding, 12px between
siblings. Four shapes share one skeleton.

**Anatomy, in fixed order:**

1. **Provenance row** — who and where, before anything else. Trust precedes attention.
2. **Title** — `title-2`, serif, clamp 2, wrapped in the link to the detail route.
3. **Summary** — `body` at 14px in `--cd-fg-secondary`, clamp 3. Source: `cosmicBriefSummary`,
   falling back to `metadata.openGraph.description`.
4. **Tags** — max 3, plus reading time as a neutral tag.
5. **"Why this appeared"** — a `<details>` disclosure.
6. **Social action row.**

Thumbnail (132×88, `--cd-radius-md`) sits right of blocks 2–6, in the same flex row.

**Variants**

| Variant | Difference |
| --- | --- |
| `article` | The base described above. |
| `video` | Thumbnail leads at full width × 210 above the title, with a mono duration badge bottom-right. A **Watch with summary** secondary button joins the action row. |
| `digest` | The panel border and padding are dropped (`.feed-item--ai`); the AI callout *is* the frame. See below. |
| `pending` | Title plus staged AI progress in place of the summary, and a skeleton thumbnail. Appears the instant a link is saved. |

**Don't:** render a comment thread inline. Show a "trending" badge. Animate items in. Stack two
digests within one screenful.

---

## Library row

`components/bookmark/library-row.tsx` — replaces the current `bookmark-list-card.tsx`.

Separator rows, not cards: `divide-y` with `--cd-border`, 16px vertical padding, `--cd-bg-subtle` on
hover. This surface is private, so it carries **no social counts**.

**Anatomy:** unread dot (6px `--cd-accent`, or a transparent spacer when read, so titles stay
aligned) · collection breadcrumb · `title-3` title, clamp 2 · summary in `body-sm`, clamp 2 · tags
plus a `meta` line of `domain · relative time · reading time` · 88×64 thumbnail.

The breadcrumb comes from `collectionPath` and is clickable at every level. When the pipeline is
still filing, it reads `Inbox` followed by an AI *filing…* marker.

**Don't:** auto-move a row the user has manually filed. Hide the chronological order behind the
tree. Use a badge for unread.

---

## Provenance row

`components/provenance-row.tsx`

The compact, always-visible answer to "where did this come from". Every AI output and every feed
item carries one.

`favicon chip · source (500 weight, --cd-fg) · dot · attribution · dot · relative time`, at 12.5px
in `--cd-fg-secondary`, wrapping gracefully.

Content by context:

| Context | Row |
| --- | --- |
| Own save | `domain · you saved this · 2d` |
| Shared by someone | `avatar · Name · shared · domain · 2d` |
| Social signal | `domain · Author · liked by 3 people you follow` |
| AI digest | `Built from · domain · domain · +n more` |
| AI summary | `domain · summarised from the full article` |

**"Why this appeared"** is a sibling `<details>`: a dotted-underline `--cd-ai` summary that expands
into a `--cd-ai-bg` panel giving the actual ranking reason in one sentence, in plain language and in
the second person. It is a disclosure, not a tooltip, and it is never hidden behind a hover.

---

## AI callout

`components/ai/ai-callout.tsx`

The quiet editorial layer. Used for the Cosmic brief, feed digests, and collection suggestions.

**Surface**

```
border-radius:  --cd-radius-lg
background:     linear-gradient(180deg, --cd-ai-bg-top, --cd-ai-bg)
border:         1px solid --cd-ai-border
box-shadow:     inset 0 1px 0 --cd-ai-sheen
padding:        --cd-space-5
::before        radial-gradient(110% 130% at 100% 0%, --cd-ai-glow, transparent 58%)
```

That corner aura is the only decorative gradient in the product. One per callout, always top-right,
always behind the content (`z-index: -1` with `isolation: isolate` on the parent).

**Anatomy:** badge chip (12px sparkle + label, `--cd-ai-chip` fill, pill) — optional right-aligned
meta — content — `.ai-foot`: a 14px-padded divider above the provenance row.

**Key points** use a 6px `--cd-ai` dot with a 3px `--cd-ai-chip` halo. Never `01 / 02 / 03`:
findings are not a sequence, and numbering claims an order the content doesn't have.

**Don't:** an accent rail down the left edge. A second gradient. Purple. A chat bubble. The word
"magic". Any AI output without a `.ai-foot` naming its sources.

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
