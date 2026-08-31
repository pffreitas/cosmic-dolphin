/**
 * Cosmic Dolphin — Signal theme for React Native.
 *
 * GENERATED FILE — do not edit. Every value here comes from
 * docs/design-system/tokens.json, the same source apps/web/app/tokens.css is
 * built from, so the two clients cannot drift.
 *
 *   bun run tokens          regenerate
 *   bun run tokens:check    fail if this file is stale
 *
 * Left out on purpose: nav-glass, nav-shadow and the elevation tokens are CSS
 * gradients and box-shadows, which React Native has no equivalent for. Signal
 * frames with borders rather than elevation, so mobile does not need them.
 */

export const colors = {
  light: {
    /* Surfaces */
    bg: '#FFFFFF',
    bgSubtle: '#F7F9FB',
    bgPanel: '#FFFFFF',
    bgInset: '#EEF2F6',
    /* Text */
    fg: '#0C1622',
    fgSecondary: '#4C5A68',
    fgTertiary: '#617080',
    /* Lines */
    border: '#E2E8EE',
    borderStrong: '#C9D4DE',
    /* Accent */
    accent: '#0B6F9C',
    accentHover: '#0A5C82',
    accentFg: '#FFFFFF',
    accentSoft: '#EAF4FA',
    accentBorder: '#BEDDEC',
    /* AI layer */
    ai: '#0B6F9C',
    aiBg: '#F2F8FC',
    aiBgTop: '#FFFFFF',
    aiBorder: '#D3E7F1',
    aiChip: '#E2F0F8',
    aiGlow: 'rgba(11,111,156,.11)',
    aiSheen: 'rgba(255,255,255,.9)',
    /* State */
    like: '#CE2963',
    success: '#157F3D',
    warning: '#B35209',
    danger: '#D62323',
    hlBg: '#EAF4FA',
    hlLine: '#BEDDEC',
    focus: '#0B6F9C',
    overlay: 'rgba(9,15,22,.45)',
    /* Header capsule */
    navBandTop: '#CFE6F3',
    navBandBot: '#E9F3F9',
    navEdge: 'rgba(255,255,255,.9)',
    navSheen: 'rgba(255,255,255,.85)',
    navPill: 'rgba(255,255,255,.96)',
  },
  dark: {
    /* Surfaces */
    bg: '#0A1119',
    bgSubtle: '#0E1720',
    bgPanel: '#101A24',
    bgInset: '#16222E',
    /* Text */
    fg: '#E9F0F6',
    fgSecondary: '#9FB1C0',
    fgTertiary: '#768A9A',
    /* Lines */
    border: '#1E2C39',
    borderStrong: '#2C3E4E',
    /* Accent */
    accent: '#5CC2E8',
    accentHover: '#8AD5F0',
    accentFg: '#04222F',
    accentSoft: '#0E2634',
    accentBorder: '#1C4256',
    /* AI layer */
    ai: '#5CC2E8',
    aiBg: '#0C202C',
    aiBgTop: '#12222E',
    aiBorder: '#193A4B',
    aiChip: '#12303F',
    aiGlow: 'rgba(92,194,232,.14)',
    aiSheen: 'rgba(255,255,255,.07)',
    /* State */
    like: '#F472A0',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    hlBg: '#0E2634',
    hlLine: '#2B6E8C',
    focus: '#5CC2E8',
    overlay: 'rgba(9,15,22,.45)',
    /* Header capsule */
    navBandTop: '#0C1E2B',
    navBandBot: '#0A1119',
    navEdge: 'rgba(255,255,255,.13)',
    navSheen: 'rgba(255,255,255,.15)',
    navPill: 'rgba(255,255,255,.11)',
  },
} as const;

export type ColorSchemeName = keyof typeof colors;
export type ThemeColors = (typeof colors)[ColorSchemeName];
export type ColorToken = keyof ThemeColors;

/** Shape is meaning: 6 controls, 8 content surfaces, 12 the app frame. */
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

/** 4px base scale. Lay groups out with `gap`, never stacked margins. */
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
} as const;

/** The raw CSS stacks. `constants/fonts.ts` maps them to platform families. */
export const fontStacks = {
  sans: "\"Inter\",system-ui,-apple-system,\"Segoe UI\",sans-serif",
  serif: "\"Source Serif 4\",Georgia,\"Times New Roman\",serif",
  mono: "\"IBM Plex Mono\",ui-monospace,SFMono-Regular,monospace",
} as const;

export type FontRole = keyof typeof fontStacks;

/**
 * The type scale. `family` is the role, not a font name — resolve it through
 * `fonts.family[role]`. Serif is content the user evaluates, sans is
 * everything the user operates; never a serif button, never a sans title.
 */
export const type = {
  display: { family: 'serif' as FontRole, fontSize: 40, lineHeight: 44, fontWeight: '600' as const },
  title1: { family: 'serif' as FontRole, fontSize: 29, lineHeight: 34.8, fontWeight: '600' as const },
  title2: { family: 'serif' as FontRole, fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  title3: { family: 'serif' as FontRole, fontSize: 17, lineHeight: 22.95, fontWeight: '600' as const },
  body: { family: 'sans' as FontRole, fontSize: 15, lineHeight: 24.75, fontWeight: '400' as const },
  bodySm: { family: 'sans' as FontRole, fontSize: 13.5, lineHeight: 20.93, fontWeight: '400' as const },
  meta: { family: 'sans' as FontRole, fontSize: 12.5, lineHeight: 17.5, fontWeight: '400' as const },
  label: { family: 'sans' as FontRole, fontSize: 11, lineHeight: 14.3, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.99 },
  quote: { family: 'serif' as FontRole, fontSize: 19, lineHeight: 28.5, fontWeight: '400' as const, fontStyle: 'italic' as const },
} as const;

export type TypeRole = keyof typeof type;

/** Motion is for continuity, not delight. Durations in ms. */
export const motion = {
  duration: 220,
  durationFast: 150,
  easing: [0.2, 0.6, 0.3, 1] as const,
} as const;

export const theme = { colors, radius, space, type, fontStacks, motion } as const;
