# Cosmic Dolphin — Design System Prototypes

Three visual directions for the same design system, built from the product interview in
`docs/design-system/decisions.md`. **Nothing here is adopted yet.** Pick one direction; it
becomes the token spec that `apps/web` and `apps/mobile` are refactored onto.

## What's here

| File | What it is |
| --- | --- |
| `prototypes/index.html` | The prototype. Open it in a browser. Switch direction (A/B/C) and light/dark in the header. |
| `tokens/signal.json` | Direction A tokens — machine-readable, ready to compile into CSS vars / Tailwind theme. |
| `tokens/ember.json` | Direction B tokens. |
| `tokens/graphite.json` | Direction C tokens. |
| `decisions.md` | The 20 product decisions the system is derived from. Read this before proposing a change. |

The prototype is a single self-contained file — no build step, no dependencies. Open it directly:

```bash
open docs/design-system/prototypes/index.html
```

## The three directions

All three share the same tokens, components, layouts, density and interaction rules. They differ
in palette, type pairing, and how a feed item is framed.

**A · Signal** — Deep blue-cyan on cool neutrals. Inter + Source Serif 4. Feed items are bordered
panels; the header capsule floats on a cyan band. The most explicitly *product* of the three,
closest to Linear. Reads as trustworthy infrastructure.

**B · Ember** — Amber on warm paper. Instrument Sans + Newsreader. Feed items are separator rows on
a warm ground; the AI chip is set in italic serif. The most *reading-room* of the three, closest to
Craft. Reads as a place you sit down with.

**C · Graphite** — Near-monochrome, colour reserved for state (unread, like, success, error,
highlight). Geist + Instrument Serif, mono metadata, hairline separators, visible keyboard hints,
an ink CTA in the header capsule. The most *precise* of the three, closest to Vercel. Reads as a
tool for people who move fast.

## Fixed across all three

These are not per-direction choices. They hold whichever palette wins.

- **Two voices.** Serif for content the user is *evaluating* — bookmark titles, feed post titles,
  detail titles, headings inside saved content, pull quotes. Sans for everything the user
  *operates* — nav, buttons, metadata, tags, comments, forms, every count. Never a serif button,
  never a sans bookmark title.
- **Borders, not elevation.** Separators and 1px borders frame surfaces. Shadows are reserved for
  things that genuinely float: the header capsule, dialogs, popovers, the command palette.
- **Shape.** 8px on content surfaces, 6px on compact controls, 12px on the app frame and the AI
  callout. Pills for the header capsule and its nav pills, tags, avatars, segmented filters, and
  the primary CTA.
- **The header is a capsule on a band.** A tinted band carries the direction's colour; a glass
  capsule floats on it, laid out as a three-column grid — brand left, destinations centred, actions
  right — so the centre column never shifts when the side columns change width. The `--nav-*` tokens
  own the band, glass, edge, sheen, pill and shadow.
- **The AI surface is a gradient ground, not a rail.** A soft vertical gradient, one hairline
  border, a single corner aura, an inset top sheen, and a chip that names the author. Findings get a
  dot marker — never `01 / 02 / 03`, which would claim an order the content doesn't have.
- **Medium density.** Scannable like YouTube, calmer than a dashboard. One title, one summary, one
  action row per feed item.
- **AI is a quiet editorial layer.** Never a mascot, never a chat bubble in the feed. Every AI
  output shows its sources and offers "why this appeared".
- **Social is visible but secondary.** One compact action row per item. Conversation expands on
  demand; comment threads never run inline in the feed.
- **Two organising modes.** Home is an algorithmically ranked social feed. Library is saved-link
  first, chronological by default, AI-filed into an editable tree.
- **Light leads, dark is first-class.** The brand is defined in light mode and translated to dark —
  not the reverse, and dark is never an afterthought.

## Adopting a direction

1. Copy the chosen `tokens/*.json` into the app token pipeline.
2. Replace the shadcn defaults in `apps/web/app/globals.css` with the semantic tokens, and map
   Tailwind theme keys onto them (`bg`, `bg-subtle`, `fg`, `fg-secondary`, `border`, `accent`,
   `ai`, `like`, …). The current `--primary`/`--secondary`/`--muted` set is generic shadcn scaffolding
   and should not survive.
3. Wire the type pairing into `tailwind.config.ts` `fontFamily` (`sans`, `serif`, `mono`), replacing
   the current `karla`/`noto` entries.
4. Build the seven shared patterns as components before refactoring any page: header capsule, feed
   item, library row, provenance row, AI callout, social action row, staged AI progress.
5. Refactor pages in this order — Library (`/my/library`), Bookmark detail (`/bookmarks/[id]`),
   Home (`/my/dashboard`), then auth and the rest of the chrome.
6. Re-export the token JSON for `apps/mobile` so the two clients stay in sync.

## Rules for coding agents

Read this section before implementing or refactoring any Cosmic Dolphin UI.

- **Tokens are strict; composition is not.** Never inline a hex value, a font stack, or a radius.
  If you need a value that isn't in the token file, add it to the token file first.
- **Restyle primitives, don't fork them.** Radix + `components/ui` stay the single source. A screen
  never gets its own button.
- **Every list ships four states**: loading skeleton, empty, error, and AI-processing. A pattern
  with fewer is incomplete.
- **Skeletons mirror real geometry** so nothing reflows when content lands.
- **A just-saved link gets a real row immediately**, with staged progress inside it — never a
  full-screen spinner, never a blocking modal.
- **Provenance is mandatory.** Any AI output renders with its source; `metadata.openGraph` +
  `sourceUrl` supply it, `cosmicBriefSummary` the summary, `cosmicTags` the tags, `collectionPath`
  the filing.
- **AI filing is a suggestion.** Show the collection as a breadcrumb the user can change, and never
  auto-move a link the user has filed by hand.
- **Accessibility is not optional**: 4.5:1 on text, a visible focus ring on every interactive
  element, and `prefers-reduced-motion` honoured by all progress and shimmer.
