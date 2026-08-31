# Implementation

How Signal lands in `apps/web` and `apps/mobile`. Follow the phases in order — each one leaves the
app in a shippable state.

## Phase 1 · Tokens

1. Copy [`tokens.css`](./tokens.css) to `apps/web/app/tokens.css` and import it at the top of
   `app/globals.css`, above the `@tailwind` directives.
2. Delete the `:root` and `.dark` blocks currently in `globals.css`. `tokens.css` supplies both,
   including the shadcn compatibility layer that keeps `components/ui/*` working untouched.
3. Load the typefaces in `app/layout.tsx` with `next/font/google` — `Inter` (400/500/600/700) and
   `Source_Serif_4` (400/600, with italic) — exposing them as `--cd-font-sans` and `--cd-font-serif`
   so the token file stays authoritative. Drop the `geist` dependency and the `karla` / `noto`
   entries.
4. Extend `tailwind.config.ts`:

```ts
fontFamily: {
  sans:  ["var(--cd-font-sans)", ...defaultTheme.fontFamily.sans],
  serif: ["var(--cd-font-serif)", ...defaultTheme.fontFamily.serif],
  mono:  ["var(--cd-font-mono)", ...defaultTheme.fontFamily.mono],
},
colors: {
  // Signal tokens. The shadcn keys already present stay until every primitive
  // has been migrated off them; then delete both them and the bridge in tokens.css.
  bg:      { DEFAULT: "var(--cd-bg)", subtle: "var(--cd-bg-subtle)", panel: "var(--cd-bg-panel)", inset: "var(--cd-bg-inset)" },
  fg:      { DEFAULT: "var(--cd-fg)", secondary: "var(--cd-fg-secondary)", tertiary: "var(--cd-fg-tertiary)" },
  line:    { DEFAULT: "var(--cd-border)", strong: "var(--cd-border-strong)" },
  accent:  { DEFAULT: "var(--cd-accent)", hover: "var(--cd-accent-hover)", fg: "var(--cd-accent-fg)", soft: "var(--cd-accent-soft)", border: "var(--cd-accent-border)" },
  ai:      { DEFAULT: "var(--cd-ai)", bg: "var(--cd-ai-bg)", border: "var(--cd-ai-border)", chip: "var(--cd-ai-chip)" },
  like:    "var(--cd-like)",
},
borderRadius: {
  xs: "var(--cd-radius-xs)", sm: "var(--cd-radius-sm)",
  md: "var(--cd-radius-md)", lg: "var(--cd-radius-lg)", pill: "var(--cd-radius-pill)",
},
```

> `accent` deliberately shadows shadcn's `accent`, which meant "muted hover surface". Any component
> using `bg-accent` for hover must move to `bg-bg-inset` in the same commit — grep for it first.

5. Add a lint rule (or a CI grep) rejecting hex literals, `rgb(`, and `px` radii in
   `apps/web/{app,components}`. Rule zero is only real if it's enforced.

## Phase 2 · Primitives

Restyle in place, in `components/ui/`: `button`, `input`, `textarea`, `select`, `badge` (→ Tag),
`avatar`, `separator`, `dialog`, `tooltip`, `dropdown-menu`, `scroll-area`, plus new `segmented`,
`kbd`, `skeleton`, `empty-state`, and `toast`. Specs in [components.md](./components.md).

Do not touch pages in this phase. When it lands, the app should look mostly the same but be running
entirely on Signal tokens.

## Phase 3 · Patterns

Build the seven shared patterns from [patterns.md](./patterns.md) in this order — later ones consume
earlier ones:

1. `components/provenance-row.tsx`
2. `components/ai/ai-callout.tsx`
3. `components/ai/processing-steps.tsx`
4. `components/social/action-row.tsx`
5. `components/app-header.tsx` (header capsule)
6. `components/bookmark/library-row.tsx`
7. `components/feed/feed-item.tsx`

Each ships with a story or a fixture route covering all of its states, including the failed and
empty ones. A pattern without its states rendered somewhere is not done.

## Phase 4 · Pages

In this order, so the highest-traffic and lowest-risk surface moves first:

1. **Library** (`/my/library`) — the pattern with the fewest dependencies. Replaces
   `bookmark-list-card.tsx`.
2. **Bookmark detail** (`/bookmarks/[bookmarkId]`) and **shared** (`/s/[slug]`).
3. **Home** (`/my/dashboard`) — depends on feed ranking; see
   [functional-spec/05-feed.md](../functional-spec/05-feed.md).
4. **Search**, **Explore**, **Profile**.
5. **Auth pages** and remaining chrome. Remove `cosmic-menu.tsx`, `hero.tsx`, and the `.shimmer`
   block in `globals.css`.

Delete the old component as part of the commit that replaces it. A migration that leaves both
versions in the tree stops being a migration.

## Phase 5 · Mobile

`apps/mobile` consumes the same `tokens.json`. `scripts/generate-tokens.mjs` compiles it into
`apps/mobile/constants/theme.ts` alongside the web stylesheet, so the two clients cannot drift —
`bun run tokens` writes both, `bun run tokens:check` fails when either is stale, and both apps' lint
runs that check. Patterns translate directly; the header capsule becomes a bottom tab bar plus the
compact `components/TopBar.tsx`, and hover states become pressed states (a row's `--cd-bg-subtle`
hover becomes its pressed ground). Parity beyond token adoption is out of scope.

## Definition of done

A surface is migrated when all of the following hold:

- [ ] No hex, `rgb()`, or px radius literal anywhere in its files.
- [ ] Serif on content titles, sans on everything operable.
- [ ] Loading, empty, error, and AI-processing states all render.
- [ ] Contrast verified at 4.5:1 in **both** light and dark.
- [ ] Keyboard-reachable, with a visible focus ring on every control.
- [ ] `prefers-reduced-motion` honoured.
- [ ] The component it replaces has been deleted.

Four of the seven are machine-checked and break the build: raw values
(`apps/web/scripts/lint-tokens.mjs`), contrast
(`apps/web/__tests__/accessibility/contrast.test.ts`), the focus ring and the 32px target
(`apps/web/scripts/lint-a11y.mjs`), and reduced motion (both of those plus the global block in
`app/globals.css`). `.github/workflows/accessibility.yml` runs them on every pull request. The other
three — the two voices, the four states, and deleting the predecessor — are still read rather than
run. [audit.md](./audit.md) records this checklist walked route by route, every violation the D20
audit found, and what remains open.

## Reference

[`prototypes/index.html`](./prototypes/index.html) is the visual source of truth for Signal — open
it beside the code. It also carries the two directions that were not adopted (Ember, Graphite),
behind the header switcher, as a record of the exploration. **They are not the spec.** Only Signal
is; their tokens sit in `prototypes/alternates/` and must not be imported.
