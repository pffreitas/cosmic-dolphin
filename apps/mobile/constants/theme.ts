/**
 * Cosmic Dolphin — Signal theme for React Native.
 *
 * GENERATED FILE — do not edit. Every value here comes from
 * docs/design-system/tokens.json, the same source apps/web/app/tokens.css is
 * built from. Platform differences are explicit overrides, not implicit parity.
 *
 *   bun run tokens          regenerate
 *   bun run tokens:check    fail if this file is stale
 *
 * Left out on purpose: brand-gradient, nav-glass, nav-shadow and the elevation tokens are CSS
 * gradients and box-shadows; native adapters must translate them explicitly.
 * webColors/webType/webTypeCompact describe web parity; colors/type retain
 * the shipped mobile palette and compatibility type scale.
 */

export const colors = {
  light: {
    /* Mobile Home header (opt-in) */
    homeHeaderBg: '#000000',
    homeHeaderFg: '#FFFFFF',
    homeHeaderFocus: '#FFFFFF',
    homeHeaderBorder: '#8A8A8A',
    homeHeaderPressed: '#242424',
    /* Plum shadow brand */
    brandPlum: '#34162F',
    brandMid: '#160D1B',
    brandBlack: '#050509',
    brandEdge: '#49273E',
    brandFg: '#F4F3FC',
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
    accent: '#5A2950',
    accentHover: '#6E3563',
    accentFg: '#FCF7FB',
    accentSoft: '#F4E8F1',
    accentBorder: '#D9BCD2',
    /* State */
    like: '#C4255E',
    success: '#13793A',
    warning: '#AA4D08',
    danger: '#CC2121',
    hlBg: '#FAECC4',
    hlLine: '#DEB866',
    focus: '#5A2950',
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
    /* Brand artwork */
    brandGround: '#010317',
  },
  dark: {
    /* Mobile Home header (opt-in) */
    homeHeaderBg: '#000000',
    homeHeaderFg: '#FFFFFF',
    homeHeaderFocus: '#FFFFFF',
    homeHeaderBorder: '#8A8A8A',
    homeHeaderPressed: '#242424',
    /* Plum shadow brand */
    brandPlum: '#34162F',
    brandMid: '#160D1B',
    brandBlack: '#050509',
    brandEdge: '#49273E',
    brandFg: '#F4F3FC',
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
    accent: '#E3B9DA',
    accentHover: '#D4A5CB',
    accentFg: '#2A1026',
    accentSoft: '#36202F',
    accentBorder: '#6B4462',
    /* State */
    like: '#F472A0',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    hlBg: '#413315',
    hlLine: '#9C7B31',
    focus: '#E3B9DA',
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
    /* Brand artwork */
    brandGround: '#010317',
  },
} as const;

/** Web CSS effects, resolved to literal colors for native boxShadow adapters. */
export const webEffects = {
  light: {
    shadowCapsule: "0 10px 26px -14px rgba(28,22,16,.32), 0 2px 6px -3px rgba(28,22,16,.12)",
    shadowPopover: "0 12px 32px -12px rgba(28, 22, 16, 0.2), 0 2px 6px -3px rgba(28, 22, 16, 0.1)",
    shadowDialog: "0 24px 60px -20px rgba(28, 22, 16, 0.32)",
    shadowSegment: "0 1px 2px 0 rgba(0,0,0,.05)",
  },
  dark: {
    shadowCapsule: "0 12px 30px -16px rgba(0,0,0,.85)",
    shadowPopover: "0 12px 32px -12px rgba(0, 0, 0, 0.7), 0 2px 6px -3px rgba(0, 0, 0, 0.5)",
    shadowDialog: "0 24px 60px -20px rgba(0, 0, 0, 0.8)",
    shadowSegment: "inset 0 0 0 1px #423F3C",
  },
} as const;

export type ColorSchemeName = keyof typeof colors;
export type ThemeColors = (typeof colors)[ColorSchemeName];
export type ColorToken = keyof ThemeColors;

/** Canonical web palette, without mobile Plum overrides. CSS effects need adapters. */
export const webColors = {
  light: {
    homeHeaderBg: '#000000',
    homeHeaderFg: '#FFFFFF',
    homeHeaderFocus: '#FFFFFF',
    homeHeaderBorder: '#8A8A8A',
    homeHeaderPressed: '#242424',
    brandPlum: '#34162F',
    brandMid: '#160D1B',
    brandBlack: '#050509',
    brandEdge: '#49273E',
    brandFg: '#F4F3FC',
    bg: '#FFFFFF',
    bgSubtle: '#F8F6F3',
    bgPanel: '#FFFFFF',
    bgInset: '#F2EFEC',
    fg: '#191714',
    fgSecondary: '#53514E',
    fgTertiary: '#6A6764',
    border: '#E6E3E0',
    borderStrong: '#D3D0CC',
    accent: '#25221F',
    accentHover: '#3E3B37',
    accentFg: '#FDFBFA',
    accentSoft: '#EEEAE6',
    accentBorder: '#CBC6C1',
    like: '#C4255E',
    success: '#13793A',
    warning: '#AA4D08',
    danger: '#CC2121',
    hlBg: '#FAECC4',
    hlLine: '#DEB866',
    focus: '#25221F',
    overlay: 'rgba(24,20,16,.45)',
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
    navEdge: 'rgba(255,255,255,.9)',
    navSheen: 'rgba(255,255,255,.85)',
    navPill: 'rgba(255,255,255,.96)',
    brandGround: '#010317',
  },
  dark: {
    homeHeaderBg: '#000000',
    homeHeaderFg: '#FFFFFF',
    homeHeaderFocus: '#FFFFFF',
    homeHeaderBorder: '#8A8A8A',
    homeHeaderPressed: '#242424',
    brandPlum: '#34162F',
    brandMid: '#160D1B',
    brandBlack: '#050509',
    brandEdge: '#49273E',
    brandFg: '#F4F3FC',
    bg: '#12100E',
    bgSubtle: '#171513',
    bgPanel: '#1A1816',
    bgInset: '#252220',
    fg: '#F2F0ED',
    fgSecondary: '#BDBAB6',
    fgTertiary: '#9B9894',
    border: '#2E2B29',
    borderStrong: '#423F3C',
    accent: '#EAE7E4',
    accentHover: '#D4D0CC',
    accentFg: '#181613',
    accentSoft: '#302D29',
    accentBorder: '#514C47',
    like: '#F472A0',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    hlBg: '#413315',
    hlLine: '#9C7B31',
    focus: '#EAE7E4',
    overlay: 'rgba(0,0,0,.55)',
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
    navEdge: 'rgba(255,255,255,.13)',
    navSheen: 'rgba(255,255,255,.15)',
    navPill: 'rgba(255,255,255,.11)',
    brandGround: '#010317',
  },
} as const;

/** Shape: 6 compact controls, 8 fields/panels, 12 sheet top corners. */
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  brand: 7,
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

/** Web desktop roles. Compact overrides follow; no native screen opts in implicitly. */
export const webType = {
  display: { family: 'serif' as FontRole, fontSize: 44, lineHeight: 46.64, fontWeight: '600' as const, letterSpacing: -1.232 },
  lead: { family: 'serif' as FontRole, fontSize: 36, lineHeight: 40.32, fontWeight: '600' as const, letterSpacing: -0.792 },
  edition: { family: 'serif' as FontRole, fontSize: 34, lineHeight: 38.08, fontWeight: '600' as const, letterSpacing: -0.748 },
  title1: { family: 'serif' as FontRole, fontSize: 44, lineHeight: 48.4, fontWeight: '600' as const, letterSpacing: -0.968 },
  page: { family: 'serif' as FontRole, fontSize: 28, lineHeight: 32.2, fontWeight: '600' as const, letterSpacing: -0.504 },
  title2: { family: 'serif' as FontRole, fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  feedRow: { family: 'serif' as FontRole, fontSize: 19, lineHeight: 24.7, fontWeight: '600' as const, letterSpacing: -0.152 },
  title3: { family: 'serif' as FontRole, fontSize: 17, lineHeight: 22.95, fontWeight: '600' as const, letterSpacing: -0.102 },
  reader: { family: 'serif' as FontRole, fontSize: 18, lineHeight: 30.96, fontWeight: '400' as const, letterSpacing: -0.108 },
  body: { family: 'sans' as FontRole, fontSize: 15, lineHeight: 24.75, fontWeight: '400' as const },
  bodySm: { family: 'sans' as FontRole, fontSize: 13.5, lineHeight: 20.925, fontWeight: '400' as const },
  meta: { family: 'sans' as FontRole, fontSize: 12.5, lineHeight: 17.5, fontWeight: '400' as const },
  section: { family: 'sans' as FontRole, fontSize: 13, lineHeight: 13, fontWeight: '600' as const },
  label: { family: 'sans' as FontRole, fontSize: 11.5, lineHeight: 14.95, fontWeight: '600' as const },
  quote: { family: 'serif' as FontRole, fontSize: 21, lineHeight: 32.55, fontWeight: '400' as const, letterSpacing: -0.126, fontStyle: 'italic' as const },
} as const;

export const webTypeCompact = {
  display: { family: 'serif' as FontRole, fontSize: 34, lineHeight: 36.04, fontWeight: '600' as const, letterSpacing: -0.952 },
  lead: { family: 'serif' as FontRole, fontSize: 28, lineHeight: 31.36, fontWeight: '600' as const, letterSpacing: -0.616 },
  edition: { family: 'serif' as FontRole, fontSize: 28, lineHeight: 31.36, fontWeight: '600' as const, letterSpacing: -0.616 },
  title1: { family: 'serif' as FontRole, fontSize: 32, lineHeight: 35.2, fontWeight: '600' as const, letterSpacing: -0.704 },
  page: { family: 'serif' as FontRole, fontSize: 24, lineHeight: 27.6, fontWeight: '600' as const, letterSpacing: -0.432 },
  title2: { family: 'serif' as FontRole, fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  feedRow: { family: 'serif' as FontRole, fontSize: 19, lineHeight: 24.7, fontWeight: '600' as const, letterSpacing: -0.152 },
  title3: { family: 'serif' as FontRole, fontSize: 17, lineHeight: 22.95, fontWeight: '600' as const, letterSpacing: -0.102 },
  reader: { family: 'serif' as FontRole, fontSize: 17, lineHeight: 29.24, fontWeight: '400' as const, letterSpacing: -0.102 },
  body: { family: 'sans' as FontRole, fontSize: 15, lineHeight: 24.75, fontWeight: '400' as const },
  bodySm: { family: 'sans' as FontRole, fontSize: 13.5, lineHeight: 20.925, fontWeight: '400' as const },
  meta: { family: 'sans' as FontRole, fontSize: 12.5, lineHeight: 17.5, fontWeight: '400' as const },
  section: { family: 'sans' as FontRole, fontSize: 13, lineHeight: 13, fontWeight: '600' as const },
  label: { family: 'sans' as FontRole, fontSize: 11.5, lineHeight: 14.95, fontWeight: '600' as const },
  quote: { family: 'serif' as FontRole, fontSize: 21, lineHeight: 32.55, fontWeight: '400' as const, letterSpacing: -0.126, fontStyle: 'italic' as const },
} as const;

export type WebTypeRole = keyof typeof webType;
export type TypeRole = keyof typeof type;

/** Motion is for continuity, not delight. Durations in ms. */
export const motion = {
  duration: 220,
  durationFast: 150,
  easing: [0.2, 0.6, 0.3, 1] as const,
} as const;

export const theme = { colors, radius, space, type, fontStacks, motion } as const;
