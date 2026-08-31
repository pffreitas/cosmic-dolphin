# Accessibility audit — D20

The last deliverable of the Signal revamp. Its job was not to add a surface; it was to make the
sentence at the foot of [README.md](./README.md) true:

> **Accessibility is build-breaking, not polish.** 4.5:1 on all text in both modes, a visible focus
> ring on every interactive element, 32px targets (44px on touch), and `prefers-reduced-motion`
> honoured everywhere.

Before D20 nothing in the repository checked any of that, and nothing in `.github/` ran a lint or a
test at all. This document records what the gate is, what the audit found, and the one deviation
that was accepted rather than fixed.

Audited on **2026-08-29**, against `signal-revamp` at D19.

## The gate

| Check | Where | Runs in |
| --- | --- | --- |
| Contrast, 4.5:1 text / 3:1 meaningful non-text, both modes | `apps/web/__tests__/accessibility/contrast.test.ts` | `bun run --cwd apps/web test` |
| `<article>`, `aria-current`, `aria-pressed`, `aria-live`, 44px touch targets | `apps/web/__tests__/accessibility/semantics.test.tsx` | same |
| The two named reduced-motion still states, and the global net | `apps/web/__tests__/accessibility/reduced-motion.test.tsx` | same |
| Focus ring on every interactive element; 32px pointer targets; a `motion-reduce:` answer for every animation | `apps/web/scripts/lint-a11y.mjs` | `bun run --cwd apps/web lint` |
| No raw colour or radius (rule zero) | `apps/web/scripts/lint-tokens.mjs` | same |
| Both generated clients match `tokens.json` | `scripts/generate-tokens.mjs --check` | same |

`.github/workflows/accessibility.yml` runs all six on **every pull request**, unfiltered.
`deploy-web.yml` runs the lint and the test suite before it builds, so the same gate stands on the
way to production.

Two design choices in the checks are worth knowing before changing them:

- **The contrast test reads `tokens.json`, not `tokens.css`.** The CSS and the mobile theme are
  generated; auditing an output would let a generator bug through. The JSON is where a human edits.
- **The a11y lint parses TypeScript rather than grepping.** `<Button asChild>` hands its classes —
  ring included — to its child, and almost every ring arrives through a `cva()` or a shared constant
  well away from the element. A regex gets both wrong, in opposite directions.

### Proof the gate is load-bearing

Both regressions were introduced deliberately, observed to fail, and reverted.

```
# light --cd-accent  #0B6F9C → #3B9CC9   ("brighten the brand")
$ npx vitest run __tests__/accessibility/contrast.test.ts
AssertionError: accent (#3B9CC9) on bg (#FFFFFF) in light is 3.10:1, below the 4.5:1 floor.
…
Tests  9 failed | 150 passed (159)

# focusRing removed from the header capsule's nav pill
$ bun run --cwd apps/web lint
components/app-header.tsx:172  [focus-ring] <Link> is interactive with no visible focus ring
1 violation(s) in 1 file(s).
error: script "lint" exited with code 1
```

## What the audit found

Thirteen violations in shipped code. Eleven were fixed in this deliverable; the numbers below are
the measured ones, not estimates.

### Contrast — 8 failures, all fixed

Six token values moved. Every one is a hue- and saturation-preserving lightness nudge — the smallest
step that clears the floor — so the palette reads identically and now measures correctly.

| Token | Mode | Was | Now | Worst ground | Was | Now |
| --- | --- | --- | --- | --- | --- | --- |
| `--cd-fg-tertiary` | light | `#657485` | `#617080` | `--cd-bg-inset` | 4.25 | **4.51** |
| `--cd-fg-tertiary` | dark | `#6E8394` | `#768A9A` | `--cd-bg-inset` | 4.10 | **4.51** |
| `--cd-like` | light | `#D6336C` | `#CE2963` | `--cd-bg-inset` | 4.10 | **4.53** |
| `--cd-danger` | light | `#DC2626` | `#D62323` | `--cd-bg-inset` | 4.29 | **4.53** |
| `--cd-success` | light | `#15803D` | `#157F3D` | `--cd-bg-inset` | 4.46 | **4.51** |
| `--cd-warning` | light | `#B45309` | `#B35209` | `--cd-bg-inset` | 4.46 | **4.52** |

The two that mattered most in practice were **`--cd-fg-tertiary` on `--cd-bg-panel` in dark mode**
(4.47:1 — every timestamp, domain and reading time inside a feed item) and **`--cd-danger` on
`--cd-bg-inset` in light** (4.29:1 — the `danger` variant of `Tag`).

`tokens.json` was edited and `bun run tokens` regenerated both clients; `docs/design-system/tokens.css`,
the values quoted in `foundations.md`, and the Signal palette in `prototypes/index.html` were brought
along, and the Ember and Graphite blocks in the prototype were deliberately not touched.

### Focus — 3 failures, all fixed

| Where | What | Fix |
| --- | --- | --- |
| `components/bookmark/capture-toast.tsx` | the "Open" link — the save toast's only control | `focusRing` |
| `components/bookmark/library/suggestion-callout.tsx` | the "N unfiled saves" link | `focusRing` |
| `components/ui/command.tsx` | the palette's search field was `outline-none` with nothing in its place | new `focusRingWithin` on the field's row |

`focusRingWithin` was added to `components/ui/focus-ring.ts` for the third: the palette's search row
is an icon and a borderless input sharing one bordered box, and ringing the bare input would draw a
rectangle inside a rectangle.

### Targets — 2 failures, both fixed

| Where | Was | Fix |
| --- | --- | --- |
| `components/ui/badge.tsx` | the Tag's remove ✕ was a **16px** target | transparent `::after` hit area at 32px |
| `components/ui/toast.tsx` | the toast's dismiss ✕ was a **24px** target | same |

Both keep their visual size. A tag is 22px tall and a toast 40px, so a literal 32px box would have
changed the layout; a pseudo-element grows the target without touching the geometry.

### Reduced motion — 8 animations with no still state, all fixed

`components/ui/dropdown-menu.tsx` (×2), `components/ui/select.tsx`, `components/ui/sheet.tsx` (×2),
`components/ui/hover-card.tsx`, `components/social/handle-claim-prompt.tsx`, and
`components/realtime/ConnectionStatus.tsx` all animated straight through
`prefers-reduced-motion: reduce`. Each now carries its own `motion-reduce:` answer, and the two
spinners that were stopping without dimming (`search-view.tsx`, `global-command-dialog.tsx`) now
land on the specified 60%.

Belt and braces: `app/globals.css` gained a global `prefers-reduced-motion` block. It is the net for
motion nobody wrote — a keyframe from a dependency, a transition nobody thought of. The lint decides
what the still state *looks* like; the net decides that there is one. It shortens animations to
0.01ms rather than removing them, because an animation that never starts never fires `animationend`
and anything waiting on that event hangs.

## Accepted deviation — `--cd-border-strong`

One measured failure was **not** fixed, and the reasoning is recorded here rather than lost in a
review thread.

| Pair | Light | Dark |
| --- | --- | --- |
| `--cd-border-strong` on `--cd-bg` | 1.50:1 | 1.72:1 |
| `--cd-border-strong` on `--cd-bg-panel` | 1.50:1 | 1.59:1 |

`foundations.md` asks for 3:1 on "control borders that carry meaning", and `--cd-border-strong` is
defined as the outline of controls that "must read as interactive before hover". Read strictly, it
fails, in both modes, by a wide margin.

It stays, because of what WCAG 2.1 SC 1.4.11 actually requires: 3:1 on visual information *required
to identify* a component. Every control this token outlines is identified by its own contents at
4.5:1 or better — the secondary `Button` by its label, `Kbd` by its glyph, `Input` by its placeholder
and its associated `<label>`. The border is reinforcement, not the identification.

Bringing it to 3:1 means roughly `#728FA9` in light and `#4E6E8A` in dark — a jump from a hairline to
a mid grey on every button, field and keycap in the product. That is a visual-direction decision
about how loud Signal's controls should be, not an accessibility fix that can be landed inside an
audit, and D20 is not the deliverable that should make it unreviewed.

`NOT_CONTRAST_BEARING` in the contrast test carries the same reasoning at the point where somebody
would otherwise have to rediscover it. **An input with no visible label and no placeholder would
break the argument** — that is the case to watch for.

## The per-surface checklist

[implementation.md § Definition of done](./implementation.md#definition-of-done), walked route by
route. `✓` means checked and passing; `—` means not applicable to that surface.

| Surface | Route | No raw values | Two voices | Four states | Contrast | Focus ring | Reduced motion | Predecessor deleted |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Library | `/my/library` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ `bookmark-list-card.tsx` |
| Bookmark detail | `/bookmarks/[id]` | ✓ | ✓ | ⚠ no route-level loading | ✓ | ✓ | ✓ | ✓ |
| Shared | `/s/[slug]` | ✓ | ✓ | ⚠ no route-level loading | ✓ | ✓ | ✓ | — new surface |
| Home | `/my/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Search | `/search` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — new surface |
| Explore | `/explore` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ placeholder card |
| Profile | `/my/profile`, `/u/[handle]` | ✓ | ✓ | ⚠ no route-level loading | ✓ | ✓ | ✓ | ✓ `ProfileForm` |
| Auth | `/sign-in`, `/sign-up`, `/forgot-password` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ `smtp-message`, `submit-button` |
| Landing | `/` | ✓ | ✓ | — static | ✓ | ✓ | ✓ | ✓ `hero.tsx` |
| Chrome | header capsule, tab bar, palette | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ `cosmic-menu`, `header-auth`, `desktop-site-header`, `mobile-header`, `command-dialog-trigger` |

Column by column, what "checked" means:

- **No raw values** — `lint-tokens.mjs`, 153 files, build-breaking.
- **Two voices** — read, not automated. Serif appears only on titles being evaluated
  (`feed-item`, `library-row`, `bookmark-detail`, `reader-prose`, `profile-view`, `comment-thread`,
  `empty-state`, `dialog`) and nowhere operable. See the open findings.
- **Four states** — loading / empty / error / AI-processing.
- **Contrast** — every token pair these surfaces compose is in `contrast.test.ts`, both modes.
- **Focus ring** — `lint-a11y.mjs`, build-breaking. Keyboard *reachability* beyond the ring (no
  traps, sensible order) was read, not automated.
- **Reduced motion** — `lint-a11y.mjs` plus the global net plus the two still-state tests.
- **Predecessor deleted** — confirmed absent from the tree, not merely unimported.

## Open findings — not fixed by D20

Each is real, none is in this deliverable's scope, and none is a regression introduced by it.

1. **No route-level loading state on four server-rendered routes.** `/bookmarks/[id]`, `/s/[slug]`,
   `/my/profile` and `/u/[handle]` `await` their data in the server component with no `Suspense`
   boundary and no `loading.tsx`, so navigation holds the previous page until the data lands.
   `/my/library`, `/my/dashboard` and `/explore` all do it correctly with a `Suspense` fallback —
   these four are the exception, not the pattern. Rule six, and a `loading.tsx` per route with the
   skeletons that already exist would close it.
2. **No `error.tsx` anywhere in `app/`.** A throw in any server component renders Next's default
   error page rather than a Signal one. Rule six again.
3. **`components/realtime/ConnectionStatus.tsx` is dead pre-revamp code** — nothing imports it — and
   it is painted in raw Tailwind palette classes (`bg-yellow-500`, `text-red-700`,
   `border-gray-200`). Its reduced-motion bug was fixed because the lint reaches it; its colours were
   left, because deleting a component is not this deliverable's call.
4. **`lint-tokens.mjs` does not reject Tailwind palette classes.** It catches `#F59E0B` and
   `rgb(…)` but not `bg-yellow-500`, which is exactly as non-semantic. Live instances are the
   `.tiptap` block in `app/globals.css` (`border-gray-200`, `bg-gray-200`, `text-purple-950`,
   `text-blue-500`) and finding 3. Extending rule zero to cover them is a small change to that script
   plus the cleanup it uncovers.
5. **`components/ai-elements/` is vendored and unreferenced** — 17 files, no product surface imports
   any of them, and they are excluded from both lints for that reason. They should be deleted or
   restyled; holding them to Signal's rules while nothing renders them would only teach people to
   write exemptions.
6. **Eight `components/ui` primitives are unused**: `sheet`, `hover-card`, `carousel`, `collapsible`,
   `checkbox`, `card`, `breadcrumb`, `progress`. Their accessibility bugs were fixed where the lint
   found them, so they are safe to keep — but they are safe to delete too.
7. **The two voices are not enforced by anything.** A serif button or a sans bookmark title would
   pass every check in this repository. A lint could plausibly assert that `font-serif` never appears
   on a `<button>` and that the title slot of `feed-item` / `library-row` always carries it.

## Not covered

Said plainly, so nobody reads more into the gate than it gives:

- **No browser runs in CI.** Everything here is arithmetic over `tokens.json`, a static pass over the
  source, or `renderToStaticMarkup`. A headless-browser harness would add computed-style contrast and
  real hit-testing; it would also add a class of flake this repository currently has none of, and it
  is not what the four `/dev/*` routes exist for. Those routes remain the place a human looks at
  every state, and they are the reason the static pass is sufficient: each pattern's states are
  rendered somewhere a person can reach them.
- **Target size is checked where it is declared.** An element that says `size-4` fails; an element
  sized by its padding and its text is left to the eye. That is a deliberate floor, not an oversight
  — a static checker that guessed at box sizes would be wrong often enough to be ignored.
- **Screen-reader behaviour is asserted through markup, not through a screen reader.** `aria-live`
  being present is not the same as an announcement being useful; the announcement strings are
  asserted, the announcing is not.
- **`apps/mobile` gets the token half only.** Its rule-zero lint and the shared `tokens:check` run in
  CI, so a contrast regression reaches it through `tokens.json` — but React Native has no focus ring
  and no `prefers-reduced-motion` media query, and the equivalents (`AccessibilityInfo
  .isReduceMotionEnabled`, `accessibilityRole`) are not audited here.
