# Cosmic Dolphin — Design System

**Adopted direction: Signal.** This directory is the specification for the UI revamp. It is written
to be read by coding agents as well as people: when implementing or refactoring any Cosmic Dolphin
interface, read these documents first and treat them as binding.

Product behaviour lives next door in [`docs/functional-spec/`](../functional-spec/). The revamp
touches both; neither document alone is enough to build a screen.

## Read in this order

| Document | What it settles |
| --- | --- |
| [decisions.md](./decisions.md) | The 20 product decisions everything else derives from. Read first; it explains *why*. |
| [foundations.md](./foundations.md) | Colour, type, shape, space, elevation, motion, accessibility, icons, imagery, voice. |
| [components.md](./components.md) | Primitives — button, input, tag, avatar, segmented control, skeleton, dialog, palette. |
| [patterns.md](./patterns.md) | The seven composite patterns that carry the product's identity. |
| [pages.md](./pages.md) | Route-by-route composition and required states. |
| [implementation.md](./implementation.md) | How to land it in `apps/web` and `apps/mobile`, phase by phase. |
| [audit.md](./audit.md) | The accessibility gate: what enforces rule ten, what the D20 audit found, and the one accepted deviation. |

| Artifact | What it is |
| --- | --- |
| [tokens.json](./tokens.json) | Canonical Signal tokens. The source of truth for every value. |
| [tokens.css](./tokens.css) | Generated from the JSON. Drop into `apps/web/app/`, import from `globals.css`. |
| `scripts/generate-tokens.mjs` | Compiles the JSON into `apps/web/app/tokens.css` and `apps/mobile/constants/theme.ts`. `bun run tokens` writes both; `bun run tokens:check` fails when either is stale. |
| [prototypes/index.html](./prototypes/index.html) | The visual reference. Open it beside the code. |

## Signal in one paragraph

Deep blue-cyan on cool neutrals. Inter for everything the user operates, Source Serif 4 for
everything the user evaluates. Feed items are bordered panels; the Library is separator rows; the
header is a content-sized opaque glass capsule on an unpainted surface. AI is a quiet editorial layer — a soft gradient
ground with one hairline and one corner aura — that always names its sources. Social is present but
secondary: one compact action row, conversation on demand. Light mode defines the brand; dark is a
first-class translation, not an inversion.

## The rules that do not bend

Everything else in this directory elaborates on these.

1. **Two voices.** Serif for content being evaluated — bookmark titles, feed titles, detail titles,
   headings inside saved content, pull quotes. Sans for everything operable. Never a serif button,
   never a sans bookmark title.
2. **Semantic tokens only.** No hex, no `rgb()`, no px radius, no font stack in a component. Need a
   value that doesn't exist? Add it to `tokens.json`, run `bun run tokens` to regenerate both
   clients, document it in `foundations.md` — in that order.
3. **Borders, not elevation.** Shadows are for surfaces that genuinely float: the header capsule,
   dialogs, popovers, the command palette. Nothing in a feed or list may float.
4. **Shape is meaning.** 6px controls, 8px content surfaces, 12px on the app frame and AI callout.
   Pills mark identity or a single decisive action: the header capsule and its nav pills, tags,
   avatars, segmented filters, the primary CTA.
5. **Restyle primitives, never fork them.** Radix plus `components/ui` is the single source. A screen
   does not get its own button.
6. **Four states, always.** Every list and every async surface ships loading, empty, error, and
   AI-processing. A pattern with fewer is incomplete.
7. **A pasted link gets a real row immediately**, with staged progress inside it. Never a full-screen
   spinner, never a blocking modal, never a fake percentage.
8. **Provenance is mandatory.** No AI output ships without naming its sources. `metadata.openGraph`
   and `sourceUrl` supply them, `cosmicBriefSummary` the summary, `cosmicTags` the tags,
   `collectionPath` the filing.
9. **AI filing is a suggestion.** Show the collection as a breadcrumb the user can change, and never
   auto-move a link the user has filed by hand.
10. **Accessibility is build-breaking, not polish.** 4.5:1 on all text in both modes, a visible focus
    ring on every interactive element, 32px targets (44px on touch), and `prefers-reduced-motion`
    honoured everywhere. Enforced, not asserted: `apps/web/__tests__/accessibility/` and
    `apps/web/scripts/lint-a11y.mjs`, both wired into CI. [audit.md](./audit.md) records what they
    check, what the audit found, and the one deviation that was accepted.

## Not the spec

`prototypes/alternates/` holds the token files for Ember and Graphite, the two directions that were
explored and not adopted. They are kept as a record of the exploration and are reachable through the
switcher in the prototype. Do not import them, and do not treat anything in the prototype's Ember or
Graphite modes as guidance.
