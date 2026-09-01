import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Rule ten, first half: **contrast is build-breaking, not polish.**
 *
 * docs/design-system/foundations.md § Accessibility:
 *
 *   > Contrast. 4.5:1 for all text including `meta` and `label`; 3:1 for icons
 *   > and control borders that carry meaning. The palette is verified at these
 *   > ratios in both modes — do not introduce intermediate tints.
 *
 * "Verified" used to mean a person squinting at a table. This file is what
 * makes it mean something: it reads `docs/design-system/tokens.json` — the
 * source of truth both clients are generated from — and computes WCAG 2.1
 * relative-luminance ratios for every pair the product actually composes, in
 * both modes. Darken a foreground token or lighten a ground and this fails
 * before anybody opens a browser.
 *
 * Two design choices worth defending:
 *
 *   1. **It reads the JSON, not the CSS.** `tokens.css` and the mobile theme
 *      are generated; auditing an output would let a generator bug pass. The
 *      JSON is where a human edits, so the JSON is where the gate belongs.
 *
 *   2. **The pair list is explicit, not a cross product.** A cross product
 *      would flag `--cd-fg-tertiary` on `--cd-accent` — a combination nothing
 *      renders — and the cure for a false failure is always to weaken the
 *      test. Every pair below is annotated with the surface that composes it,
 *      and `COVERAGE` (bottom of the file) makes sure a token cannot be added
 *      to the palette without someone deciding which list it belongs in.
 */

const TOKENS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../docs/design-system/tokens.json", import.meta.url)),
    "utf8",
  ),
) as { color: Record<Mode, Record<string, string>> };

type Mode = "light" | "dark";
const MODES: Mode[] = ["light", "dark"];

// ---------------------------------------------------------------------------
// WCAG 2.1 relative luminance and contrast ratio.
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 §relative luminance. Input must be an opaque 6-digit hex. */
export function luminance(hex: string): number {
  if (!HEX.test(hex)) {
    throw new Error(`not an opaque hex colour: ${hex}`);
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 §contrast ratio, 1 – 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// The pairs. Foreground token → the grounds it is rendered on.
// ---------------------------------------------------------------------------

type Pairs = Record<string, string[]>;

/**
 * Text, at 4.5:1. Every entry is a composition that ships today; the comment
 * names where, so a pair can be removed when its surface is.
 */
const TEXT: Pairs = {
  // Titles and primary body. `hl-bg` is reader highlight, `ai-bg*` the callout.
  fg: ["bg", "bg-subtle", "bg-panel", "bg-inset", "accent-soft", "hl-bg", "ai-bg", "ai-bg-top"],
  // Summaries, comment bodies, inactive nav, neutral Tag label (`bg-inset`),
  // AI callout body copy (`ai-bg`, `ai-bg-top`).
  "fg-secondary": ["bg", "bg-subtle", "bg-panel", "bg-inset", "ai-bg", "ai-bg-top"],
  // Metadata, timestamps, counts, section labels, placeholders. Library rows
  // sit on `bg`, feed items on `bg-panel`, row hover is `bg-subtle`.
  "fg-tertiary": ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  // Links, active nav, accent Tag label (`accent-soft`), AI badge (`ai-chip`).
  accent: ["bg", "bg-subtle", "bg-panel", "bg-inset", "accent-soft", "ai-chip"],
  // The AI voice. Identical hue to accent by design, different meaning.
  ai: ["bg", "bg-panel", "ai-bg", "ai-bg-top", "ai-chip"],
  // The label on a filled accent button, at rest and on hover.
  "accent-fg": ["accent", "accent-hover"],
  // Like count, beside the heart.
  like: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  // Pipeline phase text, private-link notice, form errors, danger Tag
  // (`bg-inset`, components/ui/badge.tsx).
  success: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  warning: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  danger: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
};

/**
 * Non-text that carries meaning, at 3:1 (WCAG 2.1 SC 1.4.11).
 *
 * These are the graphics where colour alone does the identifying: the focus
 * ring, a filled CTA, the AI dot, the heart, the pipeline phase markers.
 */
const NON_TEXT: Pairs = {
  // The focus ring must be visible against every ground a control can sit on.
  // This is the pair that fails loudest if anyone "tones down" the accent.
  focus: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  // Filled primary button, unread dot, selected tree row marker.
  accent: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  // AI key-point dot and the badge glyph.
  ai: ["bg", "bg-panel", "ai-bg", "ai-bg-top", "ai-chip"],
  // Heart glyph, filled when liked.
  like: ["bg", "bg-subtle", "bg-panel", "bg-inset"],
  // ProcessingSteps markers: a filled disc per phase.
  success: ["bg", "bg-panel", "bg-inset", "ai-bg"],
  warning: ["bg", "bg-panel", "bg-inset", "ai-bg"],
  danger: ["bg", "bg-panel", "bg-inset", "ai-bg"],
};

/**
 * Tokens that are deliberately not held to a ratio, each with the reason.
 *
 * This is not an amnesty list — it is the other half of the coverage check
 * below. A token here has been looked at and found not to carry information;
 * a token in neither list fails the suite.
 */
const NOT_CONTRAST_BEARING: Record<string, string> = {
  // Grounds. They are the second half of every pair above.
  bg: "ground",
  "bg-subtle": "ground",
  "bg-panel": "ground",
  "bg-inset": "ground",
  "accent-hover": "ground — hover fill under accent-fg",
  "accent-soft": "ground — Tag fill, highlight, selected tree row",
  "hl-bg": "ground — reader highlight",
  "ai-bg": "ground — AI callout gradient stop",
  "ai-bg-top": "ground — AI callout gradient stop",
  "ai-chip": "ground — AI badge fill",

  // Hairlines. SC 1.4.11 asks for 3:1 on information *required to identify* a
  // component or its state. These separate and decorate; nothing is identified
  // by them alone, and every surface they outline is also named by its text.
  border: "decorative hairline — list separators, panel and feed-item outlines",
  "border-strong":
    "control outline — see docs/design-system/audit.md § Accepted deviation. " +
    "Every control it outlines is identified by its own label or glyph at 4.5:1.",
  "accent-border": "decorative hairline on accent-soft, pull-quote rule",
  "ai-border": "decorative hairline on the AI callout",
  "hl-line": "decorative rule under a reader highlight",

  // Not solid colours at all: gradients, shadows and translucent washes. There
  // is no single pair to measure, and none of them carries information.
  overlay: "translucent scrim — dims the page, states nothing",
  "ai-glow": "translucent corner aura",
  "ai-sheen": "translucent 1px inset highlight",
  "nav-glass": "gradient",
  "nav-edge": "translucent capsule edge",
  "nav-sheen": "translucent capsule highlight",
  "nav-pill": "translucent nav-pill fill",
  "nav-shadow": "shadow",
};

// ---------------------------------------------------------------------------

function check(pairs: Pairs, min: number, kind: string) {
  for (const mode of MODES) {
    describe(`${kind} · ${mode}`, () => {
      const palette = TOKENS.color[mode];
      for (const [fg, grounds] of Object.entries(pairs)) {
        for (const ground of grounds) {
          it(`--cd-${fg} on --cd-${ground} clears ${min}:1`, () => {
            const a = palette[fg];
            const b = palette[ground];
            expect(a, `color.${mode}.${fg} is missing`).toBeTruthy();
            expect(b, `color.${mode}.${ground} is missing`).toBeTruthy();

            const ratio = contrast(a, b);
            expect(
              Number(ratio.toFixed(2)),
              `${fg} (${a}) on ${ground} (${b}) in ${mode} is ${ratio.toFixed(2)}:1, ` +
                `below the ${min}:1 floor. Fix the value in docs/design-system/tokens.json ` +
                `and run \`bun run tokens\` — never loosen this number.`,
            ).toBeGreaterThanOrEqual(min);
          });
        }
      }
    });
  }
}

describe("the maths", () => {
  // A ratio function that is quietly wrong would pass everything below it.
  it("is anchored at the two ends of the scale", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrast("#0B6F9C", "#FFFFFF")).toBeCloseTo(
      contrast("#FFFFFF", "#0B6F9C"),
      10,
    );
  });

  it("refuses a colour it cannot measure", () => {
    expect(() => luminance("rgba(9,15,22,.45)")).toThrow();
  });
});

describe("header material", () => {
  it.each(MODES)("uses an opaque glass base in %s mode", (mode) => {
    const glass = TOKENS.color[mode]["nav-glass"];

    expect(glass).toBeTruthy();
    expect(glass).not.toMatch(/rgba|hsla|transparent|#[0-9a-f]{8}\b|\//i);
  });
});

check(TEXT, 4.5, "text");
check(NON_TEXT, 3, "meaningful non-text");

describe("coverage", () => {
  const audited = new Set([
    ...Object.keys(TEXT),
    ...Object.keys(NON_TEXT),
    ...Object.values(TEXT).flat(),
    ...Object.values(NON_TEXT).flat(),
    ...Object.keys(NOT_CONTRAST_BEARING),
  ]);

  it.each(MODES)("every %s colour token is either measured or excused", (mode) => {
    const unclassified = Object.keys(TOKENS.color[mode]).filter(
      (token) => !audited.has(token),
    );
    expect(
      unclassified,
      "a new colour token needs a decision: add it to TEXT or NON_TEXT with the " +
        "surface that composes it, or to NOT_CONTRAST_BEARING with the reason.",
    ).toEqual([]);
  });

  it("keeps light and dark on the same token set", () => {
    // A token present in one mode and not the other is a hole the ratio checks
    // would skip in silence.
    expect(Object.keys(TOKENS.color.light).sort()).toEqual(
      Object.keys(TOKENS.color.dark).sort(),
    );
  });

  it("only excuses tokens that exist", () => {
    const live = new Set(Object.keys(TOKENS.color.light));
    const stale = Object.keys(NOT_CONTRAST_BEARING).filter((t) => !live.has(t));
    expect(stale, "drop these from NOT_CONTRAST_BEARING").toEqual([]);
  });
});
