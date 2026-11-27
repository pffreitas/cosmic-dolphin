# Implementation and reuse

Current web defines the reference; this is a maintenance workflow, not the original revamp plan.
Historical phases remain in `docs/plans/signal-revamp-plan.md` and must not be rerun to reconstruct
current web. In particular, never copy historical CSS or HTML prototypes into an application.

## Ownership

| Layer | Owner | Sharing boundary |
| --- | --- | --- |
| Semantic colors, radii, spacing, fonts, motion, web type roles | `docs/design-system/tokens.json` | Machine-readable common source; generated CSS/native exports |
| Primitive defaults and visual states | `components.md`, `apps/web/components/ui/*` | Same variant/slot/state contract; platform renderer handles DOM or native views |
| Product patterns | `patterns.md`, source inventory | Same anatomy/order/data fallbacks; platform layout/gesture adapter |
| Screen assembly | `pages.md`, current routes | Compose patterns; preserve screen-specific overrides |
| Product behavior and API shapes | functional spec, approved mobile spec, generated API client | Do not infer new endpoints or offline behavior from a visual contract |
| Visual proof | `parity.md` | Matched fixtures and rendered comparisons, separately recorded by platform |

Do not import `packages/shared` into any client; it is backend-only. Web React/Radix components
cannot be imported into React Native. Reuse the semantic source, portable formatting and component
contracts; implement platform renderers behind the same conceptual slots. If executable UI-neutral
helpers are extracted in a future implementation, use a dedicated client-safe package with no
Next, DOM, React Native or backend dependency. Do not create duplicate helper copies per screen.

## Generation

`bun run tokens` writes three artifacts:

- `apps/web/app/tokens.css` — used by `globals.css` and Tailwind.
- `docs/design-system/tokens.css` — byte-identical reference copy, now checked too.
- `apps/mobile/constants/theme.ts` — typed native values.

`bun run tokens:check` checks all three. Never hand-edit a generated file. The JSON's canonical
`typography.scale` describes current web; `typography.compact.scale` records compact overrides.
The generator exports `webType` and `webTypeCompact` with numeric line heights/tracking; `webColors`
holds canonical web colors. Existing `type` and `colors` retain native compatibility typography and
Plum overrides. A future parity component must opt into web exports explicitly. See parity.md for
font loading and exact breakpoint boundaries. Token checks do not read rendered component styles.

Native gradients/shadows need an explicit adapter: the theme omits CSS-valued gradients and
elevation strings. Use the canonical JSON for those effects; do not conclude they are absent from
web or unnecessary to reproduce it. Current native components and extensions remain unchanged.

## Adapting a component

1. Find the production component in inventory; inspect rendered class values, not only comments.
2. Apply its variants, geometry, slots, accessibility state and fallback precedence from components/patterns.
3. Share data/formatting rules (identity, counts, capture parsing, provenance). Inject platform navigation,
   clipboard, image loading, focus, native accessibility and persistence through adapters.
4. Document each native difference: hit slop, Dynamic Type, safe area, keyboard avoidance, modal gesture.
   Do not silently change visible padding or colors under the name of adaptation.
5. Reuse the new primitive in all consuming patterns; don't recreate its styling inline on each screen.
6. Exercise the same fixture matrix on each renderer, then compare captures as described in parity.md.

## Definition of done

- Source and documentation agree, including caller overrides, image failure and absent data.
- Shared token generation is fresh; generator tests pass after pipeline changes.
- State/route coverage is recorded in inventory; known missing web states are labelled as such.
- Matched visual evidence exists before claiming pixel parity; font, viewport, theme and data are fixed.
- Accessibility is preserved; invisible target expansion does not change the reference geometry.
- No app behavior is changed just to satisfy an old prototype or aspirational guideline.

Relevant checks: `bun run tokens:check`, `node --test scripts/__tests__/generate-tokens.test.mjs`,
web `lint:tokens`, `lint:a11y`, and the three web accessibility test files. The existing historical
[audit](./audit.md) explains their coverage limits. Native testing is required when native runtime
behavior changes; a generated export alone is not a native screenshot proof.
