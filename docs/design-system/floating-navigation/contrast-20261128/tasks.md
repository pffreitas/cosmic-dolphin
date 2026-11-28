# Floating navigation contrast · 2026-11-28

**Current outcome:** contrasting floating button implemented on native and mobile web.
**Active gate:** final production web build, then source push/web deployment and signed iOS release.
**Next gate / owner:** production delivery under the existing user grant / release agent.
**Blocker:** none; EAS cloud credits remain exhausted, use the tested local signing path.

## Approved refinement

User: “We need to bring more contrast to the floating button.” Keep the 48px circular hamburger,
16px safe-area offsets, 95% opacity and gentle shadow. Change only the floating control to an
ink fill/light glyph in light mode and light stone/dark glyph in dark mode. The menu retains its
existing destinations, focus behavior and touch target. Tablet and desktop retain their chrome.

## Source and proof

Starts at pushed `0837ab7c74ee101dc526fb085707343cdcbade35` on `main`; fresh fetch finds no incoming
commits. Preserve the prior header release task record and final receipt. Source JSON owns both
clients' nav-surface; regenerate all outputs. Floating glyph uses accent-fg; hover/press uses
accent-hover. The existing contrast gate now checks the actual glyph/fill combination across
black/white content extremes and additionally requires 3:1 for the button against all page grounds.
The offset focus ring remains tested against the page. Historical bar-label/focus-on-fill
compositions are superseded; none of those inks render on the floating fill now. Floors remain 4.5/3.

Native 340 tests, web 421 tests, generator 11 tests pass. Both typechecks and lint gates pass.
The first native lint invocation used the wrong cwd and did not execute; corrected and passed.
The first web fixture returned 500 because this checkout has no public Supabase environment;
restarted with fictional loopback config, without changing environment files or production auth.
Native and web light/dark render captures are in this directory. They show strong contrasting
fills, retained soft shadow and the existing hamburger. Native uses current JS/assets in the
existing Debug simulator host; this is distinct from a new signed binary or physical/session QA.
