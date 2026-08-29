import { Text, type TextProps, StyleSheet } from 'react-native';

import { textStyle } from '@/constants/fonts';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'fg');
  const link = useThemeColor({}, 'accent');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? [styles.link, { color: link }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

// Serif for content the user evaluates (title, subtitle), sans for the rest.
const styles = StyleSheet.create({
  default: textStyle('body'),
  defaultSemiBold: { ...textStyle('body'), fontWeight: '600' },
  title: textStyle('title1'),
  subtitle: textStyle('title2'),
  link: textStyle('body'),
});
