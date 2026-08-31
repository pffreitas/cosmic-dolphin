#!/usr/bin/env node
/**
 * One source of truth, two clients.
 *
 * `docs/design-system/tokens.json` is the canonical Signal palette. This script
 * compiles it into the two things that actually get imported:
 *
 *   apps/web/app/tokens.css       CSS custom properties + the shadcn HSL bridge
 *   apps/mobile/constants/theme.ts  a typed theme object for React Native
 *
 * Neither output may be hand-edited. Change the JSON, run the generator, and
 * both clients move together — which is the whole point: a transcribed palette
 * drifts, a generated one cannot.
 *
 *   bun run tokens          rewrite both outputs
 *   bun run tokens:check    fail if either output is stale (wired into lint)
 *
 * Adding a token: put it in tokens.json, give it a home in COLOR_SECTIONS
 * below (the generator refuses to run if a token has no section), regenerate,
 * and document it in docs/design-system/foundations.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..");

export const TOKENS = resolve(REPO_ROOT, "docs/design-system/tokens.json");
export const WEB_OUT = resolve(REPO_ROOT, "apps/web/app/tokens.css");
export const MOBILE_OUT = resolve(REPO_ROOT, "apps/mobile/constants/theme.ts");

/**
 * Colour tokens, grouped and ordered for output. Every key under
 * `color.light` must appear exactly once; an unplaced token is an error, so a
 * token added to the JSON cannot silently miss both clients.
 */
const COLOR_SECTIONS = [
  ["Surfaces", ["bg", "bg-subtle", "bg-panel", "bg-inset"]],
  ["Text", ["fg", "fg-secondary", "fg-tertiary"]],
  ["Lines", ["border", "border-strong"]],
  ["Accent", ["accent", "accent-hover", "accent-fg", "accent-soft", "accent-border"]],
  ["AI layer", ["ai", "ai-bg", "ai-bg-top", "ai-border", "ai-chip", "ai-glow", "ai-sheen"]],
  ["State", ["like", "success", "warning", "danger", "hl-bg", "hl-line", "focus", "overlay"]],
  [
    "Header capsule",
    ["nav-band-top", "nav-band-bot", "nav-glass", "nav-edge", "nav-sheen", "nav-pill", "nav-shadow"],
  ],
];

/**
 * shadcn's primitives read unprefixed HSL-triplet variables that mean
 * something different from ours (`--accent` is a muted hover surface, not the
 * brand). The bridge is derived from Signal rather than typed out, so it moves
 * with the palette too.
 */
const SHADCN_BRIDGE = [
  ["background", "bg"],
  ["foreground", "fg"],
  ["card", "bg-panel"],
  ["card-foreground", "fg"],
  ["popover", "bg-panel"],
  ["popover-foreground", "fg"],
  ["primary", "accent"],
  ["primary-foreground", "accent-fg"],
  ["secondary", "bg-inset"],
  ["secondary-foreground", "fg"],
  ["muted", "bg-subtle"],
  ["muted-foreground", "fg-secondary"],
  ["accent", "bg-inset"],
  ["accent-foreground", "fg"],
  ["destructive", "danger"],
  ["destructive-foreground", "accent-fg"],
  ["border", "border"],
  ["input", "border-strong"],
  ["ring", "accent"],
];

/** shadcn's own `--radius`. Cards and dialogs, so it tracks r-md. */
const SHADCN_RADIUS = "r-md";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const ALIAS = /^\{([a-z0-9-]+)\}$/;
const IS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;

/** `#RRGGBB` → shadcn's space-separated `H S% L%` triplet. */
export function hexToHslTriplet(hex) {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) (h = (b - r) / d), (h += 2);
    else (h = (r - g) / d), (h += 4);
    h *= 60;
    if (h < 0) h += 360;
  }

  return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

function assertSectionsCover(tokens) {
  const placed = COLOR_SECTIONS.flatMap(([, names]) => names);
  const declared = Object.keys(tokens.color.light);

  const orphan = declared.filter((name) => !placed.includes(name));
  if (orphan.length > 0) {
    throw new Error(
      `tokens.json declares colour token(s) with no section in the generator: ${orphan.join(", ")}.\n` +
        "Add them to COLOR_SECTIONS in scripts/generate-tokens.mjs so both clients pick them up.",
    );
  }

  const ghost = placed.filter((name) => !declared.includes(name));
  if (ghost.length > 0) {
    throw new Error(
      `COLOR_SECTIONS references token(s) that tokens.json no longer declares: ${ghost.join(", ")}.`,
    );
  }

  for (const mode of ["light", "dark"]) {
    const missing = declared.filter((name) => !(name in tokens.color[mode]));
    if (missing.length > 0) {
      throw new Error(`color.${mode} is missing: ${missing.join(", ")}.`);
    }
  }
}

/** Resolve `{other-token}` aliases against a mode's colour set. */
function resolveAlias(value, mode, tokens) {
  const match = typeof value === "string" && value.match(ALIAS);
  if (!match) return { value, aliasOf: null };
  const target = match[1];
  const resolved = tokens.color[mode][target];
  if (resolved === undefined) {
    throw new Error(`Alias {${target}} does not resolve in color.${mode}.`);
  }
  return { value: resolved, aliasOf: target };
}

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// apps/web/app/tokens.css
// ---------------------------------------------------------------------------

export function renderCss(tokens) {
  assertSectionsCover(tokens);

  const out = [];
  const push = (line = "") => out.push(line);
  const decl = (name, value) => push(`  --cd-${name}: ${value};`);

  push("/* ============================================================================");
  push("   Cosmic Dolphin — design tokens (direction: Signal)");
  push("");
  push("   Generated from docs/design-system/tokens.json. Do not hand-edit: change the");
  push("   JSON and regenerate, so the spec and the stylesheet cannot drift apart.");
  push("");
  push("   Import at the top of apps/web/app/globals.css, before the Tailwind layers.");
  push("   Every token is prefixed --cd-* because several unprefixed shadcn variables");
  push("   (--accent, --border, --ring) mean something different from ours; the");
  push("   compatibility layer at the bottom of this file bridges the two.");
  push("   ============================================================================ */");
  push("");
  push(":root {");

  push("  /* -------- Type -------- */");
  for (const [role, stack] of Object.entries(tokens.typography.families)) {
    decl(`font-${role}`, stack);
  }
  push("");

  push("  /* -------- Shape -------- */");
  for (const [name, value] of Object.entries(tokens.shape.radius)) {
    decl(name.replace(/^r-/, "radius-"), value);
  }
  push("");

  push("  /* -------- Space (4px base) -------- */");
  for (const [name, value] of Object.entries(tokens.space.scale)) {
    decl(name.replace(/^s-/, "space-"), value);
  }
  decl("measure", tokens.space.measure);
  push("");

  push("  /* -------- Motion -------- */");
  for (const [name, value] of Object.entries(tokens.motion)) {
    decl(name, value);
  }
  push("");

  push("  /* -------- Colour · light -------- */");
  renderCssColorSections(tokens, "light", push, decl);

  push("");
  push("  /* -------- Elevation -------- */");
  renderCssElevation(tokens, "light", decl);
  push("}");

  push("");
  push(".dark {");
  push("  /* -------- Colour · dark -------- */");
  renderCssColorSections(tokens, "dark", push, decl);
  push("");
  renderCssElevation(tokens, "dark", decl);
  push("}");

  push("");
  push("/* ----------------------------------------------------------------------------");
  push("   shadcn / Radix compatibility layer");
  push("");
  push("   components/ui/* consume shadcn's HSL-triplet variables. These map them onto");
  push("   Signal so existing primitives inherit the new palette before any of them are");
  push("   rewritten. Note --accent: shadcn uses it for a muted hover surface, so it");
  push("   maps to our --cd-bg-inset, NOT to our brand accent. Reach for the brand");
  push("   accent through Tailwind's `accent` key or var(--cd-accent).");
  push("");
  push("   Delete this block once no component reads the unprefixed variables.");
  push("   ---------------------------------------------------------------------------- */");
  push(":root {");
  renderShadcn(tokens, "light", push);
  push("}");
  push("");
  push(".dark {");
  renderShadcn(tokens, "dark", push);
  push("}");

  return out.join("\n") + "\n";
}

function renderCssColorSections(tokens, mode, push, decl) {
  COLOR_SECTIONS.forEach(([label, names], index) => {
    if (index > 0) push("");
    push(`  /* ${label} */`);
    for (const name of names) decl(name, tokens.color[mode][name]);
  });
}

function renderCssElevation(tokens, mode, decl) {
  for (const [name, value] of Object.entries(tokens.elevation[mode])) {
    const match = typeof value === "string" && value.match(ALIAS);
    decl(name, match ? `var(--cd-${match[1]})` : value);
  }
}

function renderShadcn(tokens, mode, push) {
  for (const [shadcn, signal] of SHADCN_BRIDGE) {
    push(`  --${shadcn}: ${hexToHslTriplet(tokens.color[mode][signal])};`);
  }
  push(`  --radius: ${tokens.shape.radius[SHADCN_RADIUS]};`);
}

// ---------------------------------------------------------------------------
// apps/mobile/constants/theme.ts
// ---------------------------------------------------------------------------

const px = (value) => Number.parseFloat(String(value).replace("px", ""));

/**
 * React Native has no gradients or CSS shadows, so the two tokens whose values
 * are CSS-only (`nav-glass`, `nav-shadow`) and the whole elevation set are left
 * out of the mobile theme rather than translated into something that isn't the
 * same value. Signal's third rule — borders, not elevation — means mobile does
 * not miss them.
 */
function mobileColorTokens(tokens) {
  return COLOR_SECTIONS.flatMap(([, names]) => names).filter((name) =>
    IS_COLOR.test(tokens.color.light[name]),
  );
}

export function renderMobileTheme(tokens) {
  assertSectionsCover(tokens);

  const names = mobileColorTokens(tokens);
  const skipped = COLOR_SECTIONS.flatMap(([, n]) => n).filter((n) => !names.includes(n));

  const out = [];
  const push = (line = "") => out.push(line);

  push("/**");
  push(" * Cosmic Dolphin — Signal theme for React Native.");
  push(" *");
  push(" * GENERATED FILE — do not edit. Every value here comes from");
  push(" * docs/design-system/tokens.json, the same source apps/web/app/tokens.css is");
  push(" * built from, so the two clients cannot drift.");
  push(" *");
  push(" *   bun run tokens          regenerate");
  push(" *   bun run tokens:check    fail if this file is stale");
  push(" *");
  push(` * Left out on purpose: ${skipped.join(", ")} and the elevation tokens are CSS`);
  push(" * gradients and box-shadows, which React Native has no equivalent for. Signal");
  push(" * frames with borders rather than elevation, so mobile does not need them.");
  push(" */");
  push("");

  push("export const colors = {");
  for (const mode of ["light", "dark"]) {
    push(`  ${mode}: {`);
    for (const [label, sectionNames] of COLOR_SECTIONS) {
      const usable = sectionNames.filter((name) => names.includes(name));
      if (usable.length === 0) continue;
      push(`    /* ${label} */`);
      for (const name of usable) {
        push(`    ${camel(name)}: '${tokens.color[mode][name]}',`);
      }
    }
    push("  },");
  }
  push("} as const;");
  push("");

  push("export type ColorSchemeName = keyof typeof colors;");
  push("export type ThemeColors = (typeof colors)[ColorSchemeName];");
  push("export type ColorToken = keyof ThemeColors;");
  push("");

  push("/** Shape is meaning: 6 controls, 8 content surfaces, 12 the app frame. */");
  push("export const radius = {");
  for (const [name, value] of Object.entries(tokens.shape.radius)) {
    push(`  ${camel(name.replace(/^r-/, ""))}: ${px(value)},`);
  }
  push("} as const;");
  push("");

  push("/** 4px base scale. Lay groups out with `gap`, never stacked margins. */");
  push("export const space = {");
  for (const [name, value] of Object.entries(tokens.space.scale)) {
    push(`  ${camel(name.replace("-", ""))}: ${px(value)},`);
  }
  push("} as const;");
  push("");

  push("/** The raw CSS stacks. `constants/fonts.ts` maps them to platform families. */");
  push("export const fontStacks = {");
  for (const [role, stack] of Object.entries(tokens.typography.families)) {
    push(`  ${role}: ${JSON.stringify(stack)},`);
  }
  push("} as const;");
  push("");
  push("export type FontRole = keyof typeof fontStacks;");
  push("");

  push("/**");
  push(" * The type scale. `family` is the role, not a font name — resolve it through");
  push(" * `fonts.family[role]`. Serif is content the user evaluates, sans is");
  push(" * everything the user operates; never a serif button, never a sans title.");
  push(" */");
  push("export const type = {");
  for (const [role, spec] of Object.entries(tokens.typography.scale)) {
    const size = px(spec.size);
    const parts = [
      `family: '${spec.family}' as FontRole`,
      `fontSize: ${size}`,
      `lineHeight: ${Math.round(size * Number(spec.line) * 100) / 100}`,
      `fontWeight: '${spec.weight}' as const`,
    ];
    if (spec.transform) parts.push(`textTransform: '${spec.transform}' as const`);
    if (spec.tracking) {
      const em = Number.parseFloat(spec.tracking);
      parts.push(`letterSpacing: ${Math.round(size * em * 100) / 100}`);
    }
    if (spec.style) parts.push(`fontStyle: '${spec.style}' as const`);
    push(`  ${camel(role)}: { ${parts.join(", ")} },`);
  }
  push("} as const;");
  push("");

  push("export type TypeRole = keyof typeof type;");
  push("");

  push("/** Motion is for continuity, not delight. Durations in ms. */");
  push("export const motion = {");
  push(`  duration: ${px(tokens.motion.duration.replace("ms", ""))},`);
  push(`  durationFast: ${px(tokens.motion["duration-fast"].replace("ms", ""))},`);
  const bezier = tokens.motion.ease.match(/cubic-bezier\(([^)]+)\)/);
  push(`  easing: [${bezier[1].split(",").map((n) => Number.parseFloat(n)).join(", ")}] as const,`);
  push("} as const;");
  push("");

  push("export const theme = { colors, radius, space, type, fontStacks, motion } as const;");

  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export function build() {
  const tokens = JSON.parse(readFileSync(TOKENS, "utf8"));
  // Aliases are resolved per output; validate them once here so a broken alias
  // fails loudly instead of shipping a `var()` that resolves to nothing.
  for (const mode of ["light", "dark"]) {
    for (const value of Object.values(tokens.elevation[mode])) {
      resolveAlias(value, mode, tokens);
    }
  }
  return [
    [WEB_OUT, renderCss(tokens)],
    [MOBILE_OUT, renderMobileTheme(tokens)],
  ];
}

function main(check) {
  const outputs = build();
  const stale = [];

  for (const [path, content] of outputs) {
    let current = null;
    try {
      current = readFileSync(path, "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current === content) continue;
    if (check) {
      stale.push(relative(REPO_ROOT, path));
    } else {
      writeFileSync(path, content);
      console.log(`tokens — wrote ${relative(REPO_ROOT, path)}`);
    }
  }

  if (check && stale.length > 0) {
    console.error("\ntokens:check — generated output is stale:\n");
    for (const path of stale) console.error(`  ${path}`);
    console.error("\nRun `bun run tokens` from the repo root and commit the result.\n");
    process.exit(1);
  }

  console.log(
    check
      ? `tokens:check — ${outputs.length} generated file(s) match docs/design-system/tokens.json.`
      : "tokens — both clients regenerated from docs/design-system/tokens.json.",
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.includes("--check"));
}
