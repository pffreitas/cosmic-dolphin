/**
 * One token from the Signal palette, with a per-call override.
 *
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from 'react-native';

import { colors, type ColorSchemeName, type ColorToken } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ColorToken
) {
  const theme = (useColorScheme() ?? 'light') as ColorSchemeName;
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[theme][colorName];
  }
}
