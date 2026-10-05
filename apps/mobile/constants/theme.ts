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
    bgSubtle: '#F8F6F3',
    bgPanel: '#FFFFFF',
    bgInset: '#F2EFEC',
    /* Text */
    fg: '#191714',
    fgSecondary: '#53514E',
    fgTertiary: '#6A6764',
    /* Lines */
    border: '#E6E3E0',
    borderStrong: '#D3D0CC',
    /* Accent */
    accent: '#25221F',
    accentHover: '#3E3B37',
    accentFg: '#FDFBFA',
    accentSoft: '#EEEAE6',
    accentBorder: '#CBC6C1',
    /* State */
    like: '#C4255E',
    success: '#13793A',
    warning: '#AA4D08',
    danger: '#CC2121',
    hlBg: '#FAECC4',
    hlLine: '#DEB866',
    focus: '#25221F',
    overlay: 'rgba(24,20,16,.45)',
    /* Identity */
    id1: '#88452A',
    id1Bg: '#FFE3D8',
    id2: '#785307',
    id2Bg: '#F6E7D1',
    id3: '#5D600A',
    id3Bg: '#EAECD3',
    id4: '#296A3B',
    id4Bg: '#DAF0DE',
    id5: '#0D6866',
    id5Bg: '#D1F1EF',
    /* Header capsule */
    navEdge: 'rgba(255,255,255,.9)',
    navSheen: 'rgba(255,255,255,.85)',
    navPill: 'rgba(255,255,255,.96)',
  },
  dark: {
    /* Surfaces */
    bg: '#12100E',
    bgSubtle: '#171513',
    bgPanel: '#1A1816',
    bgInset: '#252220',
    /* Text */
    fg: '#F2F0ED',
    fgSecondary: '#BDBAB6',
    fgTertiary: '#9B9894',
    /* Lines */
    border: '#2E2B29',
    borderStrong: '#423F3C',
    /* Accent */
    accent: '#EAE7E4',
    accentHover: '#D4D0CC',
    accentFg: '#181613',
    accentSoft: '#302D29',
    accentBorder: '#514C47',
    /* State */
    like: '#F472A0',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    hlBg: '#413315',
    hlLine: '#9C7B31',
    focus: '#EAE7E4',
    overlay: 'rgba(0,0,0,.55)',
    /* Identity */
    id1: '#F8B69C',
    id1Bg: '#462B20',
    id2: '#E6C188',
    id2Bg: '#3F3017',
    id3: '#C8CD8D',
    id3Bg: '#333519',
    id4: '#A0D7AA',
    id4Bg: '#213926',
    id5: '#82D9D5',
    id5Bg: '#113A39',
    /* Header capsule */
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
