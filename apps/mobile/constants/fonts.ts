import { Platform, type TextStyle } from 'react-native';

import { fontStacks, type, type FontRole, type TypeRole } from '@/constants/theme';

/**
 * Signal's two voices on React Native.
 *
 * `fontStacks` in the generated theme is the CSS stack — a comma-separated list
 * a browser resolves at paint time. React Native takes one family name, so each
 * role resolves here to the first entry in its own stack that the platform
 * actually ships. Neither Inter nor Source Serif 4 is bundled with the app, so
 * sans falls through to the platform UI face and serif to Georgia / the Android
 * serif alias — both are already in the token stack, so this narrows the stack,
 * it does not invent a value. React Native Web gets the stack verbatim.
 *
 * If the app ever bundles the real faces through `expo-font`, the loaded family
 * name goes in here and nothing else changes.
 */
export const fontFamily: Record<FontRole, string | undefined> = {
  sans: Platform.select({ web: fontStacks.sans, default: undefined }),
  serif: Platform.select({
    web: fontStacks.serif,
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
  mono: Platform.select({
    web: fontStacks.mono,
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

/**
 * A row of the type scale as a React Native style.
 *
 *   <Text style={[textStyle('title3'), { color: colors.fg }]}>
 *
 * Serif for content the user evaluates, sans for everything they operate. The
 * roles carry that split already — pick the role, not the family.
 */
export function textStyle(role: TypeRole): TextStyle {
  const { family, ...rest } = type[role];
  return { ...rest, fontFamily: fontFamily[family] };
}
