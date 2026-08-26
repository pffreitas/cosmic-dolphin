# Components

Primitives. Each one is built once in `apps/web/components/ui/` and restyled from there — a screen
never gets its own button. Composite patterns built *out* of these live in
[patterns.md](./patterns.md).

Every spec below lists anatomy, variants, states, and the mistakes that have to be avoided. Where a
shadcn primitive already exists, restyle it; do not fork it.

---

## Button

`components/ui/button.tsx` — restyle the existing `cva` variants.

| Variant | Fill | Border | Radius | Use |
| --- | --- | --- | --- | --- |
| `primary` | `--cd-accent` | none | **pill** | The single most important action on a surface. |
| `secondary` (default) | `--cd-bg-panel` | `--cd-border-strong` | `sm` | Everything else. |
| `ghost` | transparent | none | `sm` | Tertiary actions, icon buttons in dense rows. |
| `danger` | transparent, `--cd-danger` text | `--cd-border-strong` | `sm` | Destructive. Fills red only inside a confirmation dialog. |

Sizes: `sm` 12.5px/6×10px, `default` 13.5px/9×14px (primary 9×18px), `icon` 34×34px.

States: hover shifts fill one step (`--cd-accent-hover`, or `--cd-bg-subtle` for secondary);
`:focus-visible` shows the ring; `disabled` drops to 45% opacity and `cursor: not-allowed`;
`loading` swaps the leading icon for a 14px spinner and keeps the label — never replaces the label
with a spinner, because the button changes width and the layout jumps.

**Don't:** more than one primary per surface. A pill on a secondary button. An icon-only button
without `aria-label`.

---

## Input, Textarea, Select

Radius `md`, border `--cd-border-strong`, background `--cd-bg-panel`, 14px text, 10×12px padding.
Placeholder is `--cd-fg-tertiary`. Focus shows a `2px` ring inset by 1px so the field doesn't grow.

Errors: border and helper text go `--cd-danger`, and the helper text is bound via
`aria-describedby`. Never signal an error with colour alone.

The URL-capture field is the one input that gets `--cd-radius-pill` and a `primary` button attached
— it is a single decisive action. Every other field is a rectangle.

---

## Tag

Pill, `--cd-accent-soft` fill, `--cd-accent` text, 12px/500, 5×10px, no border.

- `neutral` variant (`--cd-bg-inset` fill, `--cd-fg-secondary` text) for non-topical facts: read
  state, reading time, counts.
- `removable` adds a 12px × at the trailing edge with its own `aria-label`.

AI-suggested tags and user tags render **identically**. The user cannot be asked to care which is
which, and both are editable.

**Don't:** more than 3 tags in a feed item or library row (`+n` beyond that). Tags as navigation
chrome — they filter, they are not a menu.

---

## Avatar

Pill, 26px default / 36px in comment threads / 22px inline in a provenance row. Falls back to
initials on `--cd-accent` with `--cd-accent-fg` text. `profiles.picture_url` when present.

## Favicon chip

16px, `--cd-radius-xs`, the site's favicon from `metadata.openGraph.favicon`, falling back to the
domain's first letter on `--cd-fg-secondary`. Always paired with the domain in text — the chip alone
is not identification.

---

## Segmented control

The one place a pill *container* is allowed. Trough `--cd-bg-inset`, 3px padding; the selected
segment gets `--cd-bg-panel` and a 1px shadow (in dark mode, `--cd-border-strong` and no shadow).
12.5px/500 labels.

Used for: feed scope (For you / Following / Unread), library read status (All / Unread / Read).
Two to four options, always mutually exclusive, always with a default selected. More than four
options is a `Select`, not a segmented control.

Implemented as a radiogroup: `role="radiogroup"` on the trough, `aria-checked` on the segments.

---

## Kbd

`--cd-font-mono`, 11px, `--cd-border-strong` with a 2px bottom border, `--cd-radius-xs`. Used in the
header search chip and the command palette. Shortcuts are shown, not hidden — this product is for
people who will learn them.

---

## Skeleton

Base `--cd-bg-inset` with a 1.6s shimmer sweep, flattened under `prefers-reduced-motion`.

Skeletons mirror the **real geometry** of what is loading — same line heights, same thumbnail box,
same gaps — so nothing reflows when content lands. A generic grey rectangle is a bug: it guarantees
a jump.

Provided shapes: `line` (11px), `title` (17px, 72% width), `thumb` (matches the context's thumbnail
dimensions).

---

## Empty state

Centred, max 42ch, in `--cd-bg-subtle` or on the bare page. 20px Lucide icon in `--cd-fg-tertiary`,
`title-3` heading, `body-sm` explanation in `--cd-fg-secondary`, and — when there is one — a single
`primary` action.

Empty states name the specific emptiness. "No unread links in Research" beats "Nothing here".

---

## Toast

`--cd-bg-panel`, `--cd-radius-md`, `--cd-shadow-popover`, bottom-right on desktop, bottom-centre on
mobile. 4s auto-dismiss; anything undoable carries an **Undo** action and stays 8s.

Success toasts use `--cd-success` for the icon only, never for the ground.

---

## Dialog & Sheet

Radix Dialog. `--cd-radius-md`, `--cd-shadow-dialog`, overlay `rgba(9,15,22,.45)`. Max width 520px
for confirmations, 720px for editors. Below 640px a dialog becomes a bottom sheet with
`--cd-radius-lg` on the top corners only.

Every dialog has a title, an explicit primary action, and a cancel that is a `ghost` button. The
destructive action is the primary in a destructive dialog, filled `--cd-danger`.

---

## Command palette

`cmdk`, already a dependency. Opens on `⌘K` / `Ctrl-K`. `--cd-bg-panel`, `--cd-radius-md`,
`--cd-shadow-dialog`, 560px wide, anchored 15vh from the top.

Sections in fixed order: **Actions** (Save a link, Go to Library), **Your saves** (title match, with
favicon + domain), **Collections**, **People**. Results show the same provenance line the feed uses,
so the palette teaches the same vocabulary as the rest of the product.

---

## Tooltip

Only for icon-only controls and truncated text. 12px, `--cd-bg-panel`, `--cd-border`,
`--cd-shadow-popover`, 400ms delay. A tooltip is never the only place information exists — if a
control needs explaining beyond its label, the label is wrong.
