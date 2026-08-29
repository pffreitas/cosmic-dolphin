# Foundations

Adopted direction: **Signal**. Canonical values live in [`tokens.json`](./tokens.json) and are
compiled by `scripts/generate-tokens.mjs` into both clients at once:

| Output | Consumed by |
| --- | --- |
| `apps/web/app/tokens.css` | `apps/web`, as `--cd-*` custom properties plus the shadcn HSL bridge |
| `apps/mobile/constants/theme.ts` | `apps/mobile`, as a typed theme object for React Native |

Run `bun run tokens` from the repo root after any change to `tokens.json`; `bun run tokens:check`
fails when either output is stale and is wired into both apps' `lint`. Neither output may be
hand-edited — a transcribed palette drifts, a generated one cannot.

React Native has no gradients or box-shadows, so `nav-glass`, `nav-shadow` and the whole `elevation`
set are absent from the mobile theme rather than approximated. Signal frames with borders, so mobile
loses nothing by it.

This document explains what each token *means*, which is the part a hex value can't carry.

> **Rule zero.** No component may reference a raw hex, px radius, font stack, or shadow. If a value
> you need isn't a token, add it to `tokens.json`, run `bun run tokens`, and document it here —
> in that order. `apps/web/scripts/lint-tokens.mjs` and `apps/mobile/scripts/lint-tokens.mjs` make
> the first half build-breaking in each client.

## Colour

Tokens are semantic, not descriptive. `--cd-accent` is "the brand action colour", not "blue"; if the
brand ever moves to green, nothing but the token file changes.

### Surfaces

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--cd-bg` | `#FFFFFF` | `#0A1119` | Page ground. The default background of every route. |
| `--cd-bg-subtle` | `#F7F9FB` | `#0E1720` | Recessed areas: row hover, the frame chrome, empty-state grounds. |
| `--cd-bg-panel` | `#FFFFFF` | `#101A24` | Anything with a border around it: cards, feed items, dialogs, popovers. In light mode it equals `--cd-bg` by design — the border does the separating, not a fill. |
| `--cd-bg-inset` | `#EEF2F6` | `#16222E` | Inset controls: segmented-control troughs, neutral chips, ghost-button hover, skeleton base. |

### Text

| Token | Light | Dark | Use | Min contrast |
| --- | --- | --- | --- | --- |
| `--cd-fg` | `#0C1622` | `#E9F0F6` | Titles, primary body, active nav. | 16:1 |
| `--cd-fg-secondary` | `#4C5A68` | `#9FB1C0` | Summaries, descriptions, comment bodies, inactive nav. | 7:1 |
| `--cd-fg-tertiary` | `#657485` | `#6E8394` | Metadata, timestamps, counts, section labels, placeholders. | 4.5:1 |

There is no fourth, lighter text token. If text needs to be quieter than `--cd-fg-tertiary`, it
should not be on screen.

### Lines

| Token | Use |
| --- | --- |
| `--cd-border` | Default 1px hairline: feed items, list separators, panels, table rules. |
| `--cd-border-strong` | Controls that must read as interactive before hover: button outlines, input borders, `kbd`. |

### Accent

| Token | Use |
| --- | --- |
| `--cd-accent` `#0B6F9C` | Primary CTA fill, active nav text, links, selected state, unread dot, focus ring. |
| `--cd-accent-hover` | Hover/active on filled accent surfaces only. |
| `--cd-accent-fg` | Text and icons on top of `--cd-accent`. |
| `--cd-accent-soft` | Tag fill, highlight ground, selected tree row. |
| `--cd-accent-border` | Hairline on soft accent surfaces, pull-quote rule. |

Accent is a budget, not a palette. A screen should be legible in greyscale; the accent tells you
where to act, not where to look.

### AI layer

The AI tokens exist so the machine-authored layer reads as its own material without becoming a
second brand.

| Token | Use |
| --- | --- |
| `--cd-ai` | AI chip text, "why this appeared" affordance, key-point markers. |
| `--cd-ai-bg` / `--cd-ai-bg-top` | The two stops of the AI callout's vertical gradient (top → bottom). |
| `--cd-ai-border` | The callout hairline and its internal divider. |
| `--cd-ai-chip` | Fill behind the AI badge. |
| `--cd-ai-glow` | The single corner aura. Never used anywhere else. |
| `--cd-ai-sheen` | 1px inset top highlight, shared with the header capsule. |

### State

| Token | Meaning |
| --- | --- |
| `--cd-like` `#D6336C` | Liked. The only place this hue appears. |
| `--cd-success` | Completed pipeline phase, "Read" confirmation, saved toast. |
| `--cd-warning` | Degraded processing, private-link notice, quota warning. |
| `--cd-danger` | Failed processing, destructive confirmation, form error. |
| `--cd-hl-bg` / `--cd-hl-line` | User highlights inside reader content. |
| `--cd-focus` | Focus ring. Identical to accent by design — focus is an action affordance. |
| `--cd-overlay` | The scrim behind a dialog or bottom sheet. Dark in both modes — it dims the page, it does not restate the theme. |

### Header capsule

`--cd-nav-band-top`, `--cd-nav-band-bot`, `--cd-nav-glass`, `--cd-nav-edge`, `--cd-nav-sheen`,
`--cd-nav-pill`, `--cd-nav-shadow`. Specified in [patterns.md](./patterns.md#header-capsule); they
belong to that one component and must not be borrowed.

### Dark mode

Dark is a first-class translation, not an inversion. Three rules:

1. Surfaces get *lighter* as they come forward (`--cd-bg` → `--cd-bg-panel` → `--cd-bg-inset`);
   borders stay visible rather than being replaced by elevation.
2. The accent lightens to `#5CC2E8` so it clears 4.5:1 on the dark ground, and `--cd-accent-fg`
   flips to a near-black so filled buttons stay legible.
3. Never carry a light-mode literal into a dark surface. Every colour on a surface comes from the
   same token set as that surface.

## Typography

Two voices, and the split is the single most load-bearing rule in the system.

- **Serif — `--cd-font-serif` (Source Serif 4).** Content the user is *evaluating*: bookmark titles,
  feed post titles, detail titles, headings inside saved content, pull quotes.
- **Sans — `--cd-font-sans` (Inter).** Everything the user *operates*: nav, buttons, metadata, tags,
  comments, forms, empty states, every count.
- **Mono — `--cd-font-mono` (IBM Plex Mono).** Machine facts only: ids, keyboard shortcuts, token
  names in docs. Not for metadata in Signal.

Never a serif button. Never a sans bookmark title.

| Role | Family | Size | Line | Weight | Notes |
| --- | --- | --- | --- | --- | --- |
| `display` | serif | 40px | 1.1 | 600 | Marketing and empty-state hero only. `text-wrap: balance`. |
| `title-1` | serif | 29px | 1.2 | 600 | Bookmark detail title. One per page. |
| `title-2` | serif | 20px | 1.3 | 600 | Feed post title, section headings in app chrome. |
| `title-3` | serif | 17px | 1.35 | 600 | Library row title, rail item title. |
| `body` | sans | 15px | 1.65 | 400 | AI summaries, article body, descriptions. |
| `body-sm` | sans | 13.5px | 1.55 | 400 | Comments, secondary copy, help text. |
| `meta` | sans | 12.5px | 1.4 | 400 | Domain, timestamp, reading time, counts. `--cd-fg-tertiary`. |
| `label` | sans | 11px | 1.3 | 600 | Uppercase, `0.09em` tracking. Rail and section labels. |
| `quote` | serif | 19px | 1.5 | 400 italic | Pull quotes inside reader content. |

Reading measure caps at `--cd-measure` (68ch). Feed summaries clamp to 3 lines, library summaries to
2, titles to 2 — always with `-webkit-line-clamp`, never by truncating server-side.

## Shape

| Token | Value | Applies to |
| --- | --- | --- |
| `--cd-radius-xs` | 4px | Skeleton bars, `kbd`, inline code. |
| `--cd-radius-sm` | 6px | Buttons, inputs, chips, ghost hit areas, small thumbnails. |
| `--cd-radius-md` | 8px | Cards, feed items, panels, dialogs, thumbnails, popovers. |
| `--cd-radius-lg` | 12px | The app frame and the AI callout. Nothing else. |
| `--cd-radius-pill` | 999px | Header capsule and its nav pills, tags, avatars, segmented filters, primary CTA. |

Pills are a signal that something is a *token of identity or a single decisive action*. A pill on an
ordinary secondary button dilutes the primary CTA and is a bug.

## Space

4px base: `--cd-space-1` … `--cd-space-8` (4, 8, 12, 16, 24, 32, 48, 64).

- Inside a card or panel: 16px (20px for the AI callout, which uses `--cd-space-5`).
- Between sibling cards: 12px.
- Between a feed item's internal blocks: 8px.
- Between page sections: 32px, or 48px at the top of a route.
- Lay groups out with flex/grid `gap`. Do not stack per-element margins — they collapse
  inconsistently and are the usual cause of drifting rhythm.

## Elevation

Borders do the work. Shadows are reserved for surfaces that genuinely float:

| Token | Applies to |
| --- | --- |
| `--cd-shadow-capsule` | The header capsule. |
| `--cd-shadow-popover` | Popovers, dropdowns, the command palette, toasts. |
| `--cd-shadow-dialog` | Modal dialogs and sheets. |

Nothing in a feed, list, or rail may cast a shadow, on hover or otherwise. These live under
`elevation` in `tokens.json`; `shadow-capsule` is written as the alias `{nav-shadow}`, which the
generator emits as `var(--cd-nav-shadow)`.

## Motion

`--cd-ease` `cubic-bezier(.2,.6,.3,1)`; `--cd-duration-fast` 150ms for colour and background,
`--cd-duration` 220ms for size and position. They live under `motion` in `tokens.json`; the mobile
theme exports them as plain numbers plus `motion.easing`, the bezier's four control points.

Motion is for continuity, not delight. Permitted: hover/active colour transitions, disclosure
expansion, skeleton shimmer, the AI progress spinner, toast entry. Not permitted: entrance
animations on feed items, parallax, staggered reveals, anything that moves while the user reads.

Every animation must be neutralised under `prefers-reduced-motion: reduce` — the shimmer becomes a
flat `--cd-bg-inset`, the spinner becomes a static ring at 60% opacity.

## Accessibility

Non-negotiable, and treated as build-breaking rather than as polish:

- **Contrast.** 4.5:1 for all text including `meta` and `label`; 3:1 for icons and control borders
  that carry meaning. The palette is verified at these ratios in both modes — do not introduce
  intermediate tints.
- **Focus.** A visible `2px solid var(--cd-focus)` ring with `2px` offset on every interactive
  element. Never `outline: none` without a replacement.
- **Targets.** 32px minimum on pointer, 44px on touch. Social action buttons pad to 32px even though
  the icon is 15px.
- **Semantics.** Feed and library items are `<article>`; nav is `<nav>` with `aria-current="page"`;
  the like button is a `<button>` with `aria-pressed`; disclosures are `<details>` or a button with
  `aria-expanded`.
- **Live regions.** AI processing status updates announce through `aria-live="polite"`, once per
  phase change — not per token streamed.
- **Motion.** See above.

## Icons

`lucide-react`, already a dependency. 15px inside dense rows (social actions, provenance), 16px in
buttons and nav, 20px in empty states. Stroke width 1.7 — Lucide's 2 is too heavy beside Inter at
these sizes. Icons take `currentColor`; never colour an icon independently of its label.

## Imagery

Thumbnails are recognition aids, not decoration.

| Context | Size | Radius |
| --- | --- | --- |
| Feed article | 132×88, right of the text | `--cd-radius-md` |
| Feed video | full width × 210, above the text | `--cd-radius-md` |
| Library row | 88×64, right of the text | `--cd-radius-sm` |
| Rail item | none | — |

Source is `metadata.openGraph.image`. When it's missing, render nothing — never a placeholder
graphic, never a letter tile in the thumbnail slot. The favicon chip beside the domain already
carries identity.

## Voice

Copy is design material.

- Name things the way the user does: *saved links*, *collections*, *summary* — not *entities*,
  *nodes*, *inference output*.
- Buttons say what happens: **Save a link** → toast **Saved**. **Mark as read** → **Read**.
- Errors say what broke and what to do: "We couldn't reach every.to. The link is saved — retry the
  summary?" Not "An error occurred."
- AI copy is declarative and sourced. "Summarised from the full article", not "AI-powered insights".
- Never anthropomorphise the pipeline. It *summarised*; it did not *think about* or *love* anything.
