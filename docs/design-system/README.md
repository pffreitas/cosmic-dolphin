# Cosmic Dolphin — Design System

**Current web is the visual source of truth.** This directory records its reusable design system
as of `4c8d362` (2026-11-26), so native clients can reproduce the same surfaces. If a recorded
measurement disagrees with the current web component's rendered styles, preserve web and reconcile
the record. Do not “fix” web to match a historical prototype.

Start with [cross-platform parity](./parity.md), then foundations, components and patterns.
[The source inventory](./inventory.md) identifies the reusable implementation behind every family.
[The reconciliation record](./reconciliation/tasks.md) records scope and verification.

For continued native implementation, start with [the native parity handoff](native-parity-handoff.md).
It maps reusable components, build/fixture commands and the separate Home, Save-form and [saved-detail](bookmark-detail-parity/tasks.md) proof and release gates.

Product behaviour lives next door in [`docs/functional-spec/`](../functional-spec/) and the approved mobile feature spec. Visual contracts do not replace behavioral and permission requirements.

The [Cosmic Dolphin identity standards](./logo-study/surface-guide.pdf) specify the approved flat Gargantua v0 mark. The [HTML edition](./logo-study/surface-guide.html) includes actual-size specimens. The [client kit](./logo-study/Cosmic-Dolphin-v0-Identity-Kit.zip) includes the guide and production artwork.

## Mobile scope and token overrides

For shipped mobile behavior and the approved Plum direction, read [Save + Today's 5](../specs/mobile-reading-app/2026-11-09-save-and-todays-5.md) before older mobile prototypes. Its scope supersedes their exploratory screen/ranking/capture behavior. This directory's Signal guidance is the web reference and the shared semantic-token foundation.

Mobile colors come from `tokens.json` → `color.mobile.light/dark` overrides; the generator merges them into the native theme. Change the JSON and regenerate, never hand-edit either client's theme. Mobile work should preserve web colors unless its task explicitly changes the web direction. Serif-for-content, sans-for-controls and accessibility requirements remain shared.
For web parity use the generated `webColors`, `webType`, and `webTypeCompact`, not the
existing native `colors`/`type` exports. Those retain shipped Plum and compatibility typography.
This makes the difference explicit without silently restyling the current native app.

## Read in this order

| Document | What it settles |
| --- | --- |
| [decisions.md](./decisions.md) | Historical product decisions and subsequent revisions; explains *why*. Current web wins on measurements. |
| [foundations.md](./foundations.md) | Colour, type, shape, space, elevation, motion, accessibility, icons, imagery, voice. |
| [components.md](./components.md) | Primitives — button, input, tag, avatar, segmented control, skeleton, dialog, palette. |
| [patterns.md](./patterns.md) | The reusable composite patterns that carry the product's identity. |
| [pages.md](./pages.md) | Route-by-route composition and required states. |
| [implementation.md](./implementation.md) | Ownership, generation, reuse and verification workflow. |
| [audit.md](./audit.md) | The accessibility gate: what enforces rule ten, what the D20 audit found, and the one accepted deviation. |

| Artifact | What it is |
| --- | --- |
| [tokens.json](./tokens.json) | Shared semantic tokens and web type roles, with explicit native compatibility overrides. Component geometry is recorded in components/patterns. |
| [tokens.css](./tokens.css) | Generated reference copy, byte-identical to `apps/web/app/tokens.css`. Do not copy historical CSS into the app. |
| `scripts/generate-tokens.mjs` | Compiles the JSON into `apps/web/app/tokens.css` and `apps/mobile/constants/theme.ts`. `bun run tokens` writes both clients and the reference CSS; `bun run tokens:check` checks all three. |
| [prototypes/index.html](./prototypes/index.html) | Historical exploration, not a parity reference. Use the current `/dev/*` component fixtures and actual routes. |

## Signal in one paragraph

Warm ink on stone greys (revision R6) — no blue, no violet; muted earth hues for people and sources. Inter for everything the user operates, Source Serif 4 — on its
optical-size axis — for everything the user evaluates. The signed-in app is a sidebar shell: a
256px sidebar holding the destinations, the Library and its collections, and a top bar
carrying one omnibox. Feed items are bordered panels and four-line rows; the Library is separator
rows. Machine-made content is not dressed as AI — it sits in plain bordered panels and always names its
sources. Social is present but secondary: one compact action row,
conversation on demand. Labels are sentence case; the accent is spent on action and selection, not
on topics. Light mode defines the brand; dark is a first-class translation, not an inversion.

## The rules that do not bend

Everything else in this directory elaborates on these.

1. **Two voices.** Serif for content being evaluated — bookmark titles, feed titles, detail titles,
   headings inside saved content, pull quotes. Sans for everything operable. Never a serif button,
   never a sans bookmark title.
2. **Semantic tokens only.** No new hex, `rgb()`, px radius or font stack in a component. Existing web geometry is the baseline. Need a
   value that doesn't exist? Add it to `tokens.json`, run `bun run tokens` to regenerate both
   clients, document it in `foundations.md` — in that order.
3. **Borders, not elevation.** Shadows are for surfaces that genuinely float: dialogs, sheets,
   popovers, the command palette. The sidebar and top bar are separated by hairlines. Nothing in a feed or list may float.
4. **Shape is meaning.** 6px compact controls and Library thumbnails; 8px fields, panels and callouts; 12px compact dialog top corners and grouped panels.
   Pills mark identity or a single decisive action: tags,
   avatars, segmented filters, the primary CTA.
5. **Restyle primitives, never fork them.** Radix plus `components/ui` is the single source. A screen
   does not get its own button.
6. **State coverage.** Reproduce the states applicable to each surface: loading, empty, error, and processing where content is being processed. See inventory and the historical audit for existing gaps; requirements are not evidence that every state ships.
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

Native rendered work and its current gates: [Home parity](home-parity/tasks.md),
[Save parity](save-parity/tasks.md), [Save fixture/resume recipe](save-parity/README.md).
