/**
 * The one focus ring.
 *
 * foundations.md: "A visible `2px solid var(--cd-focus)` ring with `2px` offset
 * on every interactive element. Never `outline: none` without a replacement."
 *
 * `focusRing` is the default — the ring sits *outside* the control, so it reads
 * against the page ground. `focusRingInset` is for fields, where components.md
 * asks for a 2px ring inset by 1px so the field does not grow on focus.
 *
 * The `[color:…]` type hints are load-bearing: `ring-[var(--x)]` is ambiguous
 * between a width and a colour, so Tailwind needs to be told which it is.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cd-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--cd-bg)]";

/** Same ring, drawn inside the control. For inputs, textareas, select triggers. */
export const focusRingInset =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--cd-focus)]";

/**
 * For Radix parts that expose focus through `data-[state]`/`:focus` rather than
 * `:focus-visible` (menu items, select items) — same ring, no `-visible`.
 */
export const focusRingAlways =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cd-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--cd-bg)]";
