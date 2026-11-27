# Reusable components

Source baseline: current web at `4c8d362`. Paths below are relative to
`apps/web/components/`. These are **observed defaults**, including exceptions to earlier guidance.
Caller overrides are part of a pattern's contract and take precedence over a primitive default.
Read [patterns](./patterns.md), [inventory](./inventory.md) and [parity](./parity.md) with this file.

All dimensions are CSS px at a 16px root; native adapters start with the same logical dimensions
at default text scale. Border widths count inside the box (`border-box` on web). Token names refer
to `tokens.json`; color assignments apply separately in each theme. No primitive owns API traffic.

## Button

Source: `ui/button.tsx`. Shared slots: leading icon/spinner, label; 8px gap; sans 500;
16px icons, stroke 1.7; fast color transition. Outset focus ring. Default variant is `secondary`.

| Variant | Fill / text / border | Shape |
| --- | --- | --- |
| primary | accent / accent-fg / transparent 1px border; hover accent-hover | pill |
| secondary | bg-panel / fg / border-strong; hover bg-subtle | sm |
| ghost | transparent / fg-secondary / transparent border; hover bg-inset and fg | sm |
| danger | transparent / danger / border-strong; hover bg-inset | sm |
| dangerSolid | danger / bg / transparent border; hover opacity .9 | sm |
| link | transparent / accent / transparent border; hover underline, offset 4px | sm |

Compatibility aliases `default`, `outline`, `destructive` mean primary, secondary, danger.

| Size | Geometry | Label |
| --- | --- | --- |
| sm | height 32, horizontal padding 10 | 12.5px, line 1 |
| default | min-height 36; vertical padding 9, horizontal 14 (18 for primary/default) | 13.5px, line 1 |
| lg | min-height 40; vertical padding 11, horizontal 24 | 13.5px, line 1 |
| icon | 34×34, zero padding | accessible name required |

Height is not always the minimum: text + vertical padding + borders can make the box taller.
Disabled: opacity .45, not-allowed cursor. Loading keeps the label, substitutes a 14px spinner,
sets busy semantics, and disables a real button by default. Reduced motion: still spinner at .6
opacity. `asChild` delegates icon/label composition to its child; it is a web adapter, not a
cross-platform public API. One primary action per surface remains the composition rule.

## Input, Textarea, Select

Sources: `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`. Shared `fieldSurface`: radius md,
1px border-strong, bg-panel, sans 14px, fg, tertiary placeholder; disabled opacity .45;
invalid border danger; inset focus ring. Error helper text and accessible description belong to
the field wrapper/caller, not to these bare controls.

- Input: height 40, padding 10 vertical / 12 horizontal. `shape=pill` uses pill radius and 16px horizontal padding (capture).
- Textarea: min-height 60, same padding, line 1.55, vertically resizable on web.
- Select trigger: height 40, same padding, one-line value, 16px down chevron. Caller may choose a compact 32px trigger.
- Select popup: radius md, border, panel, popover shadow; minimum width 128, viewport padding 4, trigger-width minimum, available-height scrolling. Items: sans 14, padding 6 vertical / 8 left / 32 right, selected check at right, inset hover/focus background. Group labels: 11.5px/600 tertiary, sentence case.

Do not assume native OS pickers reproduce this popup's pixels. A parity adapter must deliberately
render the same material and item layout while preserving selection and accessibility semantics.

## Tag

Source: `ui/badge.tsx`; `Tag` is canonical, `Badge` is a compatibility alias. Pill, sans 12px/500,
line 1, 4px internal gap. Topic default: transparent, border, secondary text, padding 4 vertical /
9 horizontal. Neutral: inset/secondary, no border, padding 5/10. Accent: accent-soft/accent,
same padding as neutral. Danger: inset/danger. AI and user topics are visually identical.

`onRemove` adds a 12px X inside a 16px visual button, with a transparent 32px effective target;
name it “Remove {tag}”. Default alias maps to accent; secondary/outline aliases map to neutral;
destructive maps to danger. Native uses hit slop without changing visible geometry.

## Page header

Source: `ui/page-header.tsx`. Optional eyebrow (12.5px/500 tertiary, line 1), title, description;
6px vertical gap. Title: serif 600, 28px/1.15, tracking -.018em; below 640: 24px. Description:
sans 13.5px/1.5, secondary, tabular numerals. Controls bottom-aligned to the title block; header
wraps with horizontal gap 32 and vertical gap 16; controls wrap with gap 8. Optional divider:
bottom border and 20px bottom padding. Heading defaults to h1, configurable h2 in a gallery.

## Avatar

Source: `ui/avatar.tsx`. Circular image, cover crop. Sizes: inline 22 (9px initials), default 26
(10px initials), lg 36 (13px initials). Fallback: sans 600 uppercase initials on the stable
identity foreground/background pair, **not** accent. `seed` is preferred; otherwise string initials.
Fallback slot is a presentation prop, not an account lookup.

Identity algorithm in `lib/identity.ts`: trim → lowercase → strip leading `www.`; FNV-1a starting
at `0x811c9dc5`, XOR each Unicode code point, multiply by `0x01000193` with 32-bit overflow;
unsigned result modulo 5 maps to `id-1` through `id-5`. Use exactly the same normalization,
code-point iteration and unsigned arithmetic on each platform.

## Favicon chip

Source: `ui/favicon-chip.tsx`. 16×16, radius xs, sans 9px/600. Image uses contain fitting, inset
background, empty alt. Missing/failed image: domain's first letter (strip leading `www.`, uppercase)
on its identity pair. Changing source resets image failure. Always pair with visible domain text.

## Brandmark and LogoMark

Sources: `brand/logo.tsx`, `brand/logo.module.css`. Both use approved mark-128.webp, permanent
brand-gradient/brand-edge/brand-fg in either theme, 1px boundary. Full Brandmark is a home link:
pill, padding 4 top/bottom/left and 12 right, 8px gap, 40px artwork, live Inter 15px/600 line 1,
tracking -.015em. Compact mode is a 44px tile with 25% radius and 92%-size artwork; responsive
public placement becomes that tile at max-width 639px. LogoMark default 40px, caller may override
(e.g. 32px compact toolbar); artwork 92%, tile radius 25%. Decorative unless a title is supplied.
Native uses the same artwork, gradient stops/angle and text treatment, not a screenshot wordmark.
The current native Home black-header exception remains separate from this web contract.

## Thumbnail

Source: `bookmark/thumbnail.tsx`. Decorative, border, overflow clipped, cover crop. Parent supplies
size and radius. Missing **or failed** image retains the box with bg-inset and two radial washes:
110%×85% at 16%/10%, border-strong at 90% mixed with transparent, fading at 58%; 95%×95% at 86%/90%,
fg at 14%, fading at 56%. These are sRGB mixes. Native should use an equivalent gradient adapter
or the same rasterized fallback asset; a flat placeholder is a declared difference, not parity.
Changing `src` resets failure. Parent may omit the entire component (Home lead does so without a URL).

Optional duration badge: bottom/right 6px, xs radius, panel/border, padding 2 vertical / 6 horizontal,
sans 11px/500 at 1.4, tabular numerals. It is **not** the old prototype's mono/dark-scrim badge.

## Segmented control

Source: `ui/segmented.tsx`. Pill trough bg-inset, padding 3, gap 2. Segments: height 32, min-width
64, horizontal padding 12; sans 12.5px/500 line 1. Secondary text → fg on hover. Selected:
panel/fg, small Tailwind shadow in light; dark uses inset 1px border-strong. Disabled opacity .45.
Radiogroup semantics, selected state, roving tab stop; arrows wrap and select, Home/End select ends.

Default guidance is 2–4 mutually exclusive choices. **Existing Explore exception:** Everything +
up to four leading topics, with an out-of-window selected topic appended (up to six segments).
Do not silently replace this with a Select while replicating web.

## Kbd

Source: `ui/kbd.tsx`. Mono 11px/400 line 1.3, panel, secondary text, radius xs; border-strong,
2px bottom border; min-width 18, horizontal padding 4 and bottom padding 1. Keyboard hints are web/platform-specific
content; substitute platform shortcuts, not font or pill styling.

## Skeleton

Source: `ui/skeleton.tsx`. Base inset; panel-colored transparent→panel→transparent linear sweep,
1.6s linear infinite. Reduced motion removes the sweep and leaves the base. Shapes: line 11px tall;
title 17px tall / 72% width; thumb/block inherit geometry, md radius. Bars use xs radius. Decorative,
hidden from accessibility tree. Composite skeletons must reuse the matching pattern's dimensions.

## Empty state

Source: `ui/empty-state.tsx`. Centered, padding 48 vertical / 24 horizontal, gap 12; 20px tertiary icon,
max text width 42ch; serif 17px/600 at 1.35 heading, 13.5px/1.55 explanatory text,
6px copy gap, optional primary action with 4px extra top padding. Preserve
the actual per-screen copy, rather than inventing a generic empty state. `ground` uses subtle fill.

## Toast

Source: `ui/toast.tsx`. Global stack, gap 8, edge padding 16; bottom-center below 640 and bottom-right
above. Width min(92vw,380px); md radius, panel/border/popover shadow, padding 12 (left 14), gap 12.
Title sans 13.5px/500 at 1.4; description 12.5px/1.4 secondary. Optional 16px state icon uses success,
warning or danger; ground stays panel. Default 4s, Undo 8s; explicit duration or persistent null
supported. Hover/focus pauses; leaving restarts the full timer. Dismiss and Undo stay keyboard
reachable. Polite live stack announces additions. Entrance fade/slide 8px; no motion when reduced.
Current web uses bottom 0, **no safe-area padding or tab-bar offset**; don't document a nonexistent
clearance. Native safe-area placement must be recorded as an adapter difference.

## Dialog & Sheet

Sources: `ui/dialog.tsx`, `ui/sheet.tsx`. Shared scrim is the `overlay` token: light
rgba(24,20,16,.45), dark rgba(0,0,0,.55). Dialog: z50, panel/border/dialog shadow, padding 24,
gap 16; max-height 90dvh with internal vertical scroll. Below 640: full-width bottom sheet, top
corners lg. From 640: centered panel, md radius, default max-width 520; editor callers use 720.
Close: 32px visual button, top/right 16, 16px X. Title serif 20px/600 at 1.3; description sans
13.5px/1.55 secondary. Footer stacks in reverse below 640 and aligns right in a row above.
Focus trap, labelled title, Escape/outside dismissal and focus restoration come from Radix.

Generic Sheet is a separate side-based primitive, not the responsive Dialog: top/bottom/left/right,
24px padding; side sheets default to 75vw, max 384px from 640. Open duration 300ms, close 200ms
(existing exception to shared 220ms); reduced motion still. Sidebar and comments override geometry.
See patterns for their exact dimensions. Native modal adapters reproduce material and slots;
keyboard avoidance, gesture dismissal and safe areas are explicit platform behavior.

## Command palette

Sources: `ui/command.tsx`, `global-command-dialog.tsx`. Dialog overlay but custom content:
width min(100vw−32px,560px), horizontally centered, top 15vh, radius md, border/panel/dialog shadow.
No close X. Escape, outside press and result selection dismiss. Input wrapper owns inset focus ring.
Sections: Actions, Your saves, Collections, People. Search results reuse SearchRow, not a new card.
⌘K/Ctrl-K focuses omnibox; second invocation there opens palette with text carried across. Compact
navigation focuses omnibox instead of opening this desktop palette.

## Tooltip

Source: `ui/tooltip.tsx`. 400ms delay, 6px side offset, sm radius, panel/border/popover shadow,
padding 6 vertical / 10 horizontal, sans 12px line 1. For icon controls/truncated text; never the
only label. Native cannot rely on hover; accessible names remain available without the tooltip.

## Dropdown menu

Source: `ui/dropdown-menu.tsx`. Content/subcontent min-width 128, padding 4, md/panel/border,
popover shadow, z50; default side offset 4. Normal items min-height 32, sm radius, padding 6
vertical / 8 horizontal, gap 10; sans 13.5px; icon 16/stroke 1.7. Focus uses inset ground,
disabled opacity .45. Inset items pad left 32. Radio/checkbox items reserve 32px left and use
14px indicator slot at left 8 with 16px accent check. Caller owns destructive item text and menu
alignment/width. Native adapter preserves check/disabled/submenu states and keyboard semantics.

## Remaining primitives

Dropdown menu, checkbox, separator, label, scroll area, breadcrumb, card, progress, collapsible,
hover card and carousel are indexed in [inventory](./inventory.md). Use their source for adapter
semantics and uncommon variants; do not manufacture a second primitive on each screen. The inventory
also distinguishes production components from historical/vendored experiments.
