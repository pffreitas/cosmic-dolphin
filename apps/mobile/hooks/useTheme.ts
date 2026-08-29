import { useColorScheme } from '@/hooks/useColorScheme';
import { colors, type ColorSchemeName, type ThemeColors } from '@/constants/theme';

/**
 * The Signal palette for the active colour scheme.
 *
 * Dark is a first-class translation, not an inversion, so every surface reads
 * its colours from the same mode — never mix a light literal into a dark
 * surface.
 */
export function useTheme(): { scheme: ColorSchemeName; colors: ThemeColors } {
  const scheme = (useColorScheme() ?? 'light') as ColorSchemeName;
  return { scheme, colors: colors[scheme] };
}

/**
 * Hover does not exist on touch. Signal's row hover (`--cd-bg-subtle`) becomes
 * the pressed background, and filled controls dim instead.
 */
export const PRESSED_OPACITY = 0.7;
