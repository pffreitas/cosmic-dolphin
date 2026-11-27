# Cross-platform web parity

## Authority and scope

Current web is the reference, not the historical HTML prototypes, an old task brief or a native
redesign. This reconciliation records source at `4c8d362` on 2026-11-26. Preserve web appearance;
when a future web component changes, update its contract and matched fixtures in the same change.
Existing native Save + Today’s 5 behavior remains approved; this document supplies the visual
reference for a subsequent native implementation, not authorization to replace its product flows.

“Pixel perfect” means matched visible geometry, colors, content, imagery and typography at a
specified viewport, theme, font and text scale. A shared token file is necessary but insufficient.
The original 2026-11-26 reconciliation was source-only. Subsequent native implementations and
matched evidence are tracked per feature in [Home parity](home-parity/tasks.md) and
[Save-form parity](save-parity/tasks.md) and [saved-detail parity](bookmark-detail-parity/tasks.md), with their remaining gates and proof limits. Start at
[the native continuation guide](native-parity-handoff.md) when building on those implementations;
the reconciliation itself is not blanket native or physical-device certification.

## Reuse boundaries

| Shared contract | Reusable material | Platform adapter |
| --- | --- | --- |
| Theme | canonical JSON, generated colors/radii/spacing/motion/type | CSS custom properties vs numeric native styles; dark-mode selection |
| Typography | family, exact weight, line height, tracking, wrapping/clamp policy | bundled font faces/optical axis, font features, native baseline/rasterization |
| Primitive | variant names, slots, visible geometry and state colors | button/link semantics, focus, touch hit slop, native controls |
| Pattern | ordered anatomy, image/data fallback, formatting, state model | flex/grid/list renderer, scrolling, selection, navigation |
| Interaction | intent callbacks, owner boundary, async lifecycle | clipboard/share, keyboard, modal presentation, native accessibility |

Do not import backend `packages/shared` in clients. Do not import DOM/Radix components into Expo.
Avoid a single boolean-heavy universal component: use a shared contract with web/native renderers
and compose the same primitives into FeedItem, LibraryRow, ProvenanceRow, Callout and SearchRow.
No separate ad-hoc row per feed, search or profile screen. Platform-specific changes belong in a
named adapter, not a duplicate visual system.

## Theme exports and deliberate differences

`tokens.json` canonical color.light/dark and typography.scale describe web. Native generation exposes:

| Export | Meaning |
| --- | --- |
| `webColors` | Canonical web palette; excludes CSS-valued effects |
| `webType` | Desktop web type roles, numeric line heights and tracking |
| `webTypeCompact` | Same roles with compact overrides; caller chooses exact breakpoint |
| `colors` | Existing shipped native palette, including Plum overrides |
| `type` | Existing shipped native compatibility type scale |
| `radius`, `space`, `motion` | Common generated values |

Do not change an existing screen from `type`/`colors` by accident. New parity renderers opt into
web exports; migrating the current native screen set and retiring compatibility values is separate
work. The compact type set is not a global font-size mode: web title/page/reader switch below 640,
while Home edition/lead/display use ≤640. Preserve these distinctions in layout adapters.

Native generation leaves CSS gradients and shadows out; reproduce them deliberately from canonical
JSON/source with native effects or shared assets. Brand gradient, thumbnail fallback, translucent
navigation blur, popup shadows and segmented selection shadow are part of web appearance.
Existing native Home's black header and Plum palette are intentional differences, not web parity.

## Font fidelity

Web loads Inter 400/500/600/700 and variable Source Serif 4 with optical sizing, normal/italic via
next/font. HTML enables `cv02`, `cv03`, `cv04`, `cv11`; serif gets optical sizing and default
-.006em tracking; counts use tabular numerals. Mono CSS requests IBM Plex Mono but the root does
not load a matching face; browser fallback is environment-dependent. Establish the actual computed
font in the reference capture rather than assuming the first family name rendered.

Current native `constants/fonts.ts` maps sans/serif/mono to Inter/SourceSerif/SpaceMono and chooses
bundled semibold at weights ≥600, otherwise regular; it forces native fontWeight 400. That adapter
does not reproduce every Inter weight or Source Serif optical cut. A parity renderer needs matching
font files, italic, weight mapping and feature support, plus baseline verification. Do not treat
SpaceMono as IBM Plex Mono. Native font padding, line boxes, fractional dimensions and ellipsis can
change wrapping; measure with the same text before adjusting spacing to compensate.

## Viewport and interaction rules

- Use logical CSS pixels/native points at default text scale for the initial match, then test
  Dynamic Type independently. Raster pixels/device scale must be recorded with each capture.
- Default Tailwind thresholds: sm 640, md 768, lg 1024; arbitrary Home/feed thresholds include
  inclusive max 640 and 900. Test 639/640/641, 767/768, 899/900/901 and 1023/1024, not just one phone.
- Reproduce the **compact web** composition on phone widths; do not shrink the desktop sidebar grid.
  Preserve shell padding plus caller padding, scroll ownership, clipping and sticky positioning.
- Use invisible hit slop for 44px native targets where web visible controls are smaller. Accessible
  text scaling, safe areas and keyboard avoidance may require explicit recorded departures.
- Hover → pressed feedback is a native adapter. Keep selected/disabled/loading/invalid states distinct.
  Restore focus after modal dismissal where available; preserve accessible names and state announcements.
- Native share sheet, keyboard and system bars cannot be screenshot-identical to browser UI. Compare
  product content separately and record those surfaces as platform-specific.

## Fixture and acceptance matrix

Use the **production components**, not HTML re-creations. Current web fixtures:
`/dev/patterns`, `/dev/library`, `/dev/bookmark`, `/dev/home`; see inventory for gaps. These are
sample data, not product usage evidence. Add matched native fixtures as part of native implementation.

| Family | Required comparison states |
| --- | --- |
| Primitive controls | every used variant/size; idle, focus, pressed/hover, disabled, loading, invalid |
| Identity/media | long name/domain; initials; missing/failed image; source replacement; portrait/landscape crop |
| Feed | article/video/digest/pending/lead/row; long title/summary; 0/3/overflow tags; ranking disclosure open |
| Library/SearchRow | unread/read; selected/multiselect; nested/Inbox/filing; private link; semantic Related; highlights |
| Callout/progress | regular/compact; footer wrapping; each phase state; inline/stack; retry; reduced motion |
| Reader | headings/paragraphs/lists/quotes/code/tables/images; highlights/selection; processing/private/failed |
| Social/comments | 0/999/1000 counts; liked/saved/save-once; inline/drawer; signed-out/offline/deleted/edit/reply/report |
| Screens | loading/empty/error/ready where implemented; pagination; offline; account/ownership changes |
| Overlays | dialog/sheet/palette/menu; long scroll; keyboard present; dismissal and focus restoration |

For each screenshot pair record source SHA, route/fixture, exact data, viewport, device scale,
OS/browser/runtime, loaded font files, theme, text scale, safe-area insets and interaction state.
Freeze dates/greetings/relative time and image assets; wait for fonts, images and layout; disable
animations identically. Compare element bounds, line breaks, baseline, clamps, border/radius,
color and crop before the full image diff. Review text antialiasing separately; do not hide layout
errors behind a generous global diff tolerance. Store captures and results with the implementing
task, with explicit reviewed exceptions. Tests/token checks do not replace this gate.

## Coverage limits

The historical accessibility audit is not a current all-screen screenshot suite. It records known
web missing route loading/error boundaries and static-check limitations. No automatic claim that
all four async states exist on every route; no claim that native shadows/fonts already match.
Source contracts and inventory are implementation-ready references; rendered parity remains an
acceptance gate on the native implementation.
