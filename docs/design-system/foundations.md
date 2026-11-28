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

The generated native theme omits CSS-valued gradients and the `elevation` set. This is a
serialization boundary, not a claim that native cannot draw them: web parity needs native gradient
and shadow adapters. Canonical web colors/type are exported separately from shipped mobile overrides
(see [parity.md](./parity.md)).

This document explains what each token *means*, which is the part a hex value can't carry.

> **Rule zero.** No component may reference a raw hex, px radius, font stack, or shadow. If a value
> you need isn't a token, add it to `tokens.json`, run `bun run tokens`, and document it here —
> in that order. `apps/web/scripts/lint-tokens.mjs` and `apps/mobile/scripts/lint-tokens.mjs` make
> the first half build-breaking in each client.

## Colour

**Revision R6 — ink on stone.** The neutrals are warm stone greys: one lightness ramp at OKLCH hue
72 with a whisper of chroma (≈0.005), so the ground reads as paper rather than as blue-tinted slate.
The accent is warm ink — near-black in light mode, warm off-white in dark — so action is carried by
contrast and weight, not by a hue. There is no blue and no violet anywhere in the palette, and no
colour exists to mark machine-made content (see *AI layer — retired*). Colour is kept for meaning:
an earthy identity hue per person and source, pink for a like, green for done, amber for warning,
red for failure, an ochre marker for highlights. All values were derived in OKLCH and are stored as
hex.

Tokens are semantic, not descriptive. `--cd-accent` is "the brand action colour", not "ink"; if the
brand ever moves to a hue, nothing but the token file changes.

### Surfaces

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--cd-bg` | `#FFFFFF` | `#12100E` | Page ground. The default background of every route. |
| `--cd-bg-subtle` | `#F8F6F3` | `#171513` | Recessed areas: row hover, the frame chrome, empty-state grounds. |
| `--cd-bg-panel` | `#FFFFFF` | `#1A1816` | Anything with a border around it: cards, feed items, dialogs, popovers. In light mode it equals `--cd-bg` by design — the border does the separating, not a fill. |
| `--cd-bg-inset` | `#F2EFEC` | `#252220` | Inset controls: segmented-control troughs, neutral chips, ghost-button hover, skeleton base. |

### Text

| Token | Light | Dark | Use | Min contrast |
| --- | --- | --- | --- | --- |
| `--cd-fg` | `#191714` | `#F2F0ED` | Titles, primary body, active nav. | 16:1 |
| `--cd-fg-secondary` | `#53514E` | `#BDBAB6` | Summaries, descriptions, comment bodies, inactive nav. | 7:1 |
| `--cd-fg-tertiary` | `#6A6764` | `#9B9894` | Metadata, timestamps, counts, section labels, placeholders. | 4.5:1 |

The `Min contrast` column is not aspirational. `apps/web/__tests__/accessibility/contrast.test.ts`
computes every one of these ratios out of `tokens.json` on each run, in both modes, against every
ground the token lands on — including `--cd-bg-inset`, which is the tightest of the four and the one
that moved `--cd-fg-tertiary` in D20.

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
| `--cd-accent` `#25221F` | Primary CTA fill, active nav text, links, selected state, unread dot, focus ring, reading progress. |
| `--cd-accent-hover` | Hover/active on filled accent surfaces only. |
| `--cd-accent-fg` | Text and icons on top of `--cd-accent`. |
| `--cd-accent-soft` | Tag fill, highlight ground, selected tree row. |
| `--cd-accent-border` | Hairline on soft accent surfaces, pull-quote rule. |

Accent is a budget, not a palette. Because ink sits close to `--cd-fg`, an ink link is never
identified by colour alone: links carry an underline (at rest or on hover, per component), selected
controls carry a fill or a weight change. The accent tells you where to act, not where to look.

### AI layer — retired (R6)

The `--cd-ai*` tokens are gone. Machine-authored content — a Cosmic brief, a digest, a ranking
reason, the pipeline's staged progress, a suggested collection — is drawn in the same neutral
material as everything else: a bordered `--cd-bg-panel` panel, `--cd-fg-secondary` labels, the
accent for an active step. No sparkle icons, no tinted gradients, no glow, and no "AI filed" badge.
Trust comes from provenance (rule 8 — every such surface still names its sources), not from a
costume announcing that a machine made it.

### State

| Token | Meaning |
| --- | --- |
| `--cd-like` `#C4255E` | Liked. The only place this hue appears. |
| `--cd-success` | Completed pipeline phase, "Read" confirmation, saved toast. |
| `--cd-warning` | Degraded processing, private-link notice, quota warning. |
| `--cd-danger` | Failed processing, destructive confirmation, form error. |
| `--cd-hl-bg` / `--cd-hl-line` | User highlights inside reader content, and text selection. A soft ochre marker — the one warm hue on the reading surface. |
| `--cd-focus` | Focus ring. Identical to accent by design — focus is an action affordance. |
| `--cd-overlay` | The scrim behind a dialog or bottom sheet. Dark in both modes — it dims the page, it does not restate the theme. |
| `--cd-brand-ground` | The night-sky ground of the dolphin artwork, sampled from the icon. The landing header and footer are this colour, and the closing logo lockup carries it as a badge. Identical in both modes — it belongs to the artwork, not the theme — and anything on it uses the dark set. Never a surface inside the app. |

### Identity

| Token | Use |
| --- | --- |
| `--cd-id-1` … `--cd-id-5` | Initials on an avatar fallback, the letter on a favicon chip. |
| `--cd-id-1-bg` … `--cd-id-5-bg` | The soft ground behind them. Always paired with its own number. |

Five muted earth hues — clay, ochre, olive, green, teal — chosen to sit clear of the like's pink and
of any blue or violet. `lib/identity.ts` hashes a seed (a person's name, a domain) to a
slot, so a person or a source is the same colour on every row and every visit. Identity only:
never a topic, a state or a rank, and never a fill for anything the user operates.

### Header capsule (retired on web)

`--cd-nav-glass`, `--cd-nav-edge`, `--cd-nav-sheen`, `--cd-nav-pill`, `--cd-nav-shadow` are legacy capsule tokens, not the current shell specification.


The capsule was replaced by the app shell (revision R1). Nothing in `apps/web` reads these tokens
any more; they stay in `tokens.json` because the mobile theme still exports `navEdge`, `navSheen`
and `navPill`, and are removed with the mobile pass.

### Dark mode

Dark is a first-class translation, not an inversion. Three rules:

1. Surfaces get *lighter* as they come forward (`--cd-bg` → `--cd-bg-panel` → `--cd-bg-inset`);
   borders stay visible rather than being replaced by elevation.
2. The accent flips to warm off-white `#EAE7E4` so it clears 4.5:1 on the dark ground, and `--cd-accent-fg`
   flips to a near-black so filled buttons stay legible.
3. Never carry a light-mode literal into a dark surface. Every colour on a surface comes from the
   same token set as that surface.

### Mobile plum override

The Save and Today’s 5 mobile shell uses `color.mobile.light` and
`color.mobile.dark` in `tokens.json`. The generator validates every override name
against the canonical color keys, merges each mode, then resolves aliases. The
native iOS share panel consumes the same effective palette. Web CSS and every
other Signal token keep their canonical values.

| Token | Light | Dark |
| --- | --- | --- |
| accent | `#5A2950` | `#E3B9DA` |
| accent-hover | `#6E3563` | `#D4A5CB` |
| accent-fg | `#FCF7FB` | `#2A1026` |
| accent-soft | `#F4E8F1` | `#36202F` |
| accent-border | `#D9BCD2` | `#6B4462` |
| focus | `{accent}` | `{accent}` |

Text remains at least 4.5:1 and meaningful icons/focus outlines at least 3:1.
Accent borders and `border-strong` reinforce labelled controls; they do not
identify controls on their own (see the existing exception in `audit.md`).
Content follows uncapped Dynamic Type. Tab and control labels cap at 1.3×,
with growing touch targets and wrapping rows. Keyboard focus uses a 2px outline
with a 2px offset; reduced motion keeps sheets and progress indicators still.

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
| `display` | serif | 44px (34px ≤ 640px) | 1.06 | 600 | Home first-save hero, -.028em. Landing has separate sans marketing typography; do not apply this role to it. |
| `lead` | serif | 36px (28px ≤ 640px) | 1.12 | 600 | Home lead title, -.022em, clamp 3. |
| `edition` | serif | 34px (28px ≤ 640px) | 1.12 | 600 | Home greeting, -.022em. |
| `title-1` | serif | 44px (32px < 640px) | 1.1 | 600 | Bookmark detail title. One per page. -0.022em. |
| `page` | serif | 28px (24px < 640px) | 1.15 | 600 | Page header title (`components/ui/page-header.tsx`). -0.018em. |
| `title-2` | serif | 20px | 1.3 | 600 | Feed post title, digest titles, -.01em. |
| `title-3` | serif | 17px | 1.35 | 600 | Library row, -.006em inherited. |
| `feed-row` | serif | 19px | 1.3 | 600 | Home feed row, -.008em. |
| `reader` | serif | 18px (17px < 640px) | 1.72 | 400 | Extracted article body on the detail page; h2 26px, h3 20px. |
| `body` | sans | 15px | 1.65 | 400 | AI summaries, descriptions. |
| `body-sm` | sans | 13.5px | 1.55 | 400 | Comments, secondary copy, help text, sidebar rows. |
| `meta` | sans | 12.5px | 1.4 | 400 | Domain, timestamp, reading time, counts. `--cd-fg-tertiary`. |
| `section` | sans | 13px | 1 | 600 | In-page section headings ("Pick up where you left off", rail headings). Sentence case, `--cd-fg`. |
| `label` | sans | 11.5px | 1.3 | 600 | Group labels in the sidebar and menus. Sentence case, `--cd-fg-tertiary`. |
| `quote` | serif | 21px | 1.55 | 400 italic | Pull quotes inside reader content. |

**Sentence case everywhere** (revision R4). The uppercase, letter-spaced micro-label is gone from
the product: it shouted at the smallest size on screen and made every rail look like a dashboard.
Hierarchy comes from weight and colour instead.

**Character.** Inter runs with `cv02 cv03 cv04 cv11` (open 4, open 6/9, single-storey a), set once
on `<html>`. Source Serif 4 loads as a variable font with its `opsz` axis, so display sizes get the
tighter, higher-contrast cut and 17px rows the sturdier one; serif text tracks at -0.006em by
default and tighter at display sizes. Anything that ticks — counts, timestamps, reading times —
takes the `.nums` utility (`tabular-nums`).

The canonical JSON now records these web roles, including numeric native exports `webType` and
`webTypeCompact`. `type` remains the shipped native compatibility scale. `title-1`, `page` and
`reader` switch strictly below 640px; Home display/lead/edition use inclusive `max-[640px]`.
`webTypeCompact` is the compact value set, not a runtime breakpoint engine: callers must apply
those boundaries per role. Browser zoom and native Dynamic Type are not equivalent to viewport width.

Primitive and pattern overrides still apply: feed summaries are 14px/1.6 (not base body 15),
page descriptions 13.5px/1.5 (not base body-sm 1.55), buttons line 1. The JSON scale is not proof
that every component uses one role without overrides. Marketing typography is in landing CSS/modules.

The reading column is 680px, which at the 18px `reader` size is the same ~70 characters
`--cd-measure` (68ch) asks for. Feed summaries clamp to 3 lines, library summaries to 2, titles to 2
— always with `-webkit-line-clamp`, never by truncating server-side.

## Shape

| Token | Value | Applies to |
| --- | --- | --- |
| `--cd-radius-xs` | 4px | Skeleton bars, `kbd`, inline code. |
| `--cd-radius-sm` | 6px | Secondary/ghost buttons, tooltip, Library thumbnails. |
| `--cd-radius-md` | 8px | Fields, cards, feed panels/thumbnails, callouts, dialogs, popovers. |
| `--cd-radius-lg` | 12px | Compact dialog top corners, grouped first-save panel. Callouts use md, not lg. |
| `--cd-radius-masthead` | 24px | Bottom corners of the compact star-field header. |
| `--cd-radius-brand` | 7px | The landing logo lockup. Nothing else. |
| `--cd-radius-pill` | 999px | Tags, avatars, segmented filters, the primary CTA. |

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
| `--cd-shadow-capsule` | Retired with the header capsule; unused on web. |
| `--cd-shadow-segment` | Selected segmented control: web small shadow in light, inset border-strong in dark; exported as `webEffects[scheme].shadowSegment` for native. |
| `--cd-shadow-popover` | Popovers, dropdowns, the command palette, toasts. |
| `--cd-shadow-dialog` | Modal dialogs and sheets. |
| `--cd-shadow-floating-nav` | Bottom-left mobile menu: gentle offset/blur shadow in both themes, also exported through native `webEffects`. |

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
flat `--cd-bg-inset`, the spinner becomes a static ring at 60% opacity. Two things enforce it:
`apps/web/app/globals.css` carries a global `prefers-reduced-motion` block that neutralises any
animation or transition the author forgot, and `apps/web/scripts/lint-a11y.mjs` fails the build on an
`animate-*` class that ships without its own `motion-reduce:` answer — the safety net stops motion,
the lint makes sure the *specified* still state is the one that renders.

## Accessibility

Non-negotiable, and treated as build-breaking rather than as polish:

- **Contrast.** 4.5:1 for all text including `meta` and `label`; 3:1 for icons and control borders
  that carry meaning. The palette is verified at these ratios in both modes — do not introduce
  intermediate tints. Verified by `apps/web/__tests__/accessibility/contrast.test.ts`, which reads
  `tokens.json` directly; `--cd-border-strong` is the one documented exception, recorded with its
  numbers in [audit.md](./audit.md).
- **Focus.** A visible `2px solid var(--cd-focus)` ring with `2px` offset on every interactive
  element. Never `outline: none` without a replacement. Use `focusRing` / `focusRingInset` /
  `focusRingAlways` from `components/ui/focus-ring`; `scripts/lint-a11y.mjs` fails the build on an
  interactive element that carries none of them.
- **Targets.** 32px minimum on pointer, 44px on touch. Social action buttons pad to 32px even though
  the icon is 15px. `scripts/lint-a11y.mjs` rejects an interactive element that declares a height or
  square size below 32px, and the mobile tab bar's 44px floor is asserted in
  `__tests__/accessibility/semantics.test.tsx`.
- **Semantics.** Feed and library items are `<article>`; nav is `<nav>` with `aria-current="page"`;
  the like button is a `<button>` with `aria-pressed`; disclosures are `<details>` or a button with
  `aria-expanded`. Rendered and asserted in `__tests__/accessibility/semantics.test.tsx`.
- **Live regions.** AI processing status updates announce through `aria-live="polite"`, once per
  phase change — not per token streamed.
- **Motion.** See above.

## Brand

The approved identity is the teal dolphin, luminous violet orbit, and guiding star
on a **Plum shadow** background. The October 24, 2026 selection supersedes the
light recoloring and flat navy experiments. The artwork itself stays unchanged.

The background is identical in both themes: a 125-degree gradient from
`brand-plum` through `brand-mid` at 48% to `brand-black`, with `brand-edge` as
its fine boundary and `brand-fg` for the wordmark. Values live in `tokens.json`
and are generated into both clients. No per-theme recoloring or white backing.

- Web `Brandmark`: an accessible home link containing a complete gradient
  capsule and live Inter lettering. Public headers use a compact tile below
  640px so account actions remain reachable. The same component covers the
  sidebar, sign-in, sign-up, password reset, and footer.
- Web `LogoMark`: a gradient tile for compact toolbars, navigation, and inline
  marketing marks. It is decorative unless given a title.
- Mobile `BrandSignature`: one accessible capsule in the home top bar and auth
  screens. The top bar retains heading semantics. `BrandMark` supplies the
  compact tile. Both use bundled artwork and a generated gradient surface.
- Launcher icons, favicon, and Apple touch icon always use Plum shadow. Android
  adaptive icons use a transparent foreground inside the safe zone and a
  separate full-size gradient background, never a flat fallback as the artwork.
- Native splash uses a larger gradient plaque on the current system surface;
  the plaque's artwork, white lettering, and gradient are the same in both
  appearances. Full-screen artwork uses contain scaling to avoid cropping.

`assets/branding/cosmic-dolphin-master.png` is the source artwork. Run
`bun run brand:generate` to derive all platform assets, and `bun run tokens`
after token changes. Placement dimensions and native rebuild requirements are
in `assets/branding/README.md`. Keep the illustration in these brand placements.

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
| Library row | 96×64; below 640px 72×56 | `--cd-radius-sm` |
| Rail item | none | — |

Source is `metadata.openGraph.image`. The shared Thumbnail **retains its box** when absent or
failed, with the token-based radial fallback specified in components.md. Home's lead omits the
whole box when no URL is provided; row thumbnails hide at ≤640px; article panels shrink from
132×88 to 96×70 at ≤900px. Never replace the fallback with a favicon/letter tile. See patterns.md
for each caller's exact responsive rules.

## Voice

Copy is design material.

- Name things the way the user does: *saved links*, *collections*, *summary* — not *entities*,
  *nodes*, *inference output*.
- Buttons say what happens: **Save a link** → toast **Saved**. **Mark as read** → **Read**.
- Errors say what broke and what to do: "We couldn't reach every.to. The link is saved — retry the
  summary?" Not "An error occurred."
- AI copy is declarative and sourced. "Summarised from the full article", not "AI-powered insights".
- Never anthropomorphise the pipeline. It *summarised*; it did not *think about* or *love* anything.

## Mobile Home header

Home alone opts into the `home-header-*` roles in both themes. `bg` is solid black
across the safe area, brand/action bar and persistent topic strip; `fg` is white
for the live wordmark and controls. Selected topics invert `fg`/`bg`. `border`
defines unselected controls, `pressed` gives their touch feedback, and `focus`
is the visible white outline against the black strip. The brand has no gradient
capsule here. The body retains normal theme surfaces. Other screens and all
default primitives retain their existing appearance. Home's focus-scoped status
bar override is removed on blur, even when its tab stays mounted.

These additive semantic roles are generated for both clients by the shared
schema, but are consumed only by mobile Home. Existing web roles are unchanged.

### Native Home navigation surface

`nav-surface` records web's compact navigation ground (`bg-panel` at 95% opacity)
for the native BlurView adapter. The bar overlays scrolling content; its bottom
safe-area padding is a platform addition. Web retains its existing CSS treatment.

`typography.scale.saving` records the current web SavingRow title: Source Serif 4
600, 16px, 1.35 line height and -.006em tracking. It is separate from the 17px
continue-reading title. Native bundles its optical cut as well as larger cuts.

### Saved-detail typography exports

The saved-detail adaptation exports production web roles through canonical tokens: `readerHeading` (26/32.5, serif 600, −0.015em), `readerSubheading` (20/27, serif 600, −0.01em), `briefSummary` (14.5/23.2, sans 400) and `briefKeyPoint` (14/21.7, sans 400). The native reader uses frozen regular/italic/bold-italic optical instances; its code uses the current Apple monospace fallback. See [saved-detail tasks](bookmark-detail-parity/tasks.md) for source and remaining device proof. These exports preserve current web appearance.

## Star-field compact masthead · November 27, 2026

The compact header is a 72px dark masthead using the existing Meshy-generated photographic
plate (`nano-banana-pro`, task `01a22004-10f2-719d-9e6f-563cd5d93fe2`). The masthead has
24px bottom corners (`radius.masthead` / `--cd-radius-masthead`). The reading surface has a
straight top edge and is fully opaque white in light mode or the normal page ground in dark. No shadow or feathered
fade separates navigation from reading. The star field remains restrained behind the controls.

`color.*.sky-*` defines semantic inks, input ground and boundaries in both themes.
`sky-fg` and `sky-muted` clear 4.5:1 on the sky/focused input; the translucent resting input
is measured composited over black/white extremes. Focus uses `sky-fg`. Only the decorative sky plate is clipped; header hints escape
the masthead; the floating navigation control keeps the page theme.

Native Home, Library and saved detail use the same masthead/reading-surface composition.
The sky includes the top safe area, with light status-bar symbols. Web uses this below 768px;
tablet/desktop chrome retains its current composition.

Source, prompt and paid-generation receipt live in `assets/header-starfield`. Regenerate the
byte-identical native/web plate with `python3 scripts/generate-header-starfield.py` (Pillow).
The earlier alpha-mask proposal was rejected by the user for its muddy light-theme boundary;
its screenshots remain under `docs/design-system/starfield-header/history` as diagnostics.
