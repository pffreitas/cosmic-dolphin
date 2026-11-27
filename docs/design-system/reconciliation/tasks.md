# Web-reference reconciliation · 2026-11-26

- **Outcome:** source reconciliation complete — current web is documented as the parity reference; web appearance and shipped native defaults are unchanged. Rendered native parity is not claimed.
- **Next gate:** subsequent native implementation uses the parity contracts and supplies matched screenshot evidence. No code/release action is pending for this reconciliation.
- **Owner:** Codex, requested by Paulo.
- **Blocker:** none for source reconciliation. Matched web/native screenshot verification belongs to the subsequent native implementation; this change does not claim rendered parity.
- **Baseline:** `main` at `4c8d362f18b8e495a6ffe33d103f77c32554dda6`.
- **Starting state:** no tracked edits. Existing untracked logo-study, mobile-concept, and six header/footer screenshots are user work and remain untouched.
- **Authority:** user's 2026-11-26 instruction makes current web the reference for replication. Existing Save + Today's 5 product behavior is not replaced by this documentation task.

## Scope and decisions

Reconcile existing documentation, stale reference artifacts and reusable token exports. Document primitives, composite patterns, source ownership, responsive rules, state coverage, native adapters and the visual parity acceptance process. No app redesign, backend changes, native screen migration, release, or PR requested.

Canonical typography describes current web roles. Preserve existing native `type` under an explicit compatibility scale; expose web parity typography and colors separately. Generation checks must include the reference CSS so it cannot silently diverge again. Historical prototypes remain available but cannot be mistaken for the current visual reference.

## Evidence and history

- Read the Signal revamp delivery plan, functional-spec index, current design-system documentation and approved Save + Today's 5 spec.
- Audited root fonts/CSS/Tailwind; primitives; shell and compact navigation; feed; Library rows; reader; Search; Explore; profiles; comments; brand assets; generator and existing generator tests.
- Before changes `bun run tokens:check` passed for two outputs while the reference CSS was stale. Default HTML prototype used the retired blue accent and 29px detail title.

## Delivered

- Reconciled foundations, components, patterns, page composition and implementation workflow.
- Added parity/reuse boundaries, native adapter/font differences, matched fixture acceptance matrix and source/coverage inventory.
- Marked old prototype and D20 audit as historical; generated reference CSS now matches current web and is checked.
- Corrected canonical web typography; generated webColors/webType/webTypeCompact opt-in exports. Preserved shipped native colors/type and every existing theme export byte-for-byte.
- Added tokens:test and CI execution; generator handles canonical aliases independently of native overrides and preserves fractional web tracking/line boxes.

## Verification · completed

- `bun run tokens:test`: 11/11 passing, including compatibility isolation, aliases, compact overrides, fractional metrics and reference CSS equality.
- `bun run tokens:check`: 3/3 fresh outputs. Runtime `apps/web/app/tokens.css` has no diff.
- Web `lint:tokens`: 180 files pass; `lint:a11y`: 124 files pass.
- Web contrast/semantics/reduced-motion suites: 197 tests pass across 3 files. Browserslist printed an existing age notice; no dependency updates made.
- Mobile `lint:tokens`: 80 files pass.
- TypeScript check of generated native theme via installed web compiler: pass (`tsc --noEmit --skipLibCheck --types node apps/mobile/constants/theme.ts`). This is a generated-file check, not a full native app build.
- All local Markdown file links in reconciled documents resolve; `git diff --check` passes.
- Scripted comparison to HEAD confirms existing native colors/radius/space/fontStacks/type/motion/theme export declarations unchanged. No production component styling changed.
- No rendered browser/native comparison was performed; parity.md makes that acceptance gate explicit. Existing web loading/error and fixture-coverage gaps remain labelled, not silently “fixed”.
- Additional untracked `docs/specs/ai-pipeline/` appeared during the session; left untouched along with starting user work.
