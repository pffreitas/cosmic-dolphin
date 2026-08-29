import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { textStyle } from '@/constants/fonts';
import { radius, space } from '@/constants/theme';
import { PRESSED_OPACITY, useTheme } from '@/hooks/useTheme';

export const TOP_BAR_HEIGHT = 52;

/**
 * Signal's header capsule does not translate to a phone: a floating pill that
 * carries navigation belongs on a pointer. On mobile the navigation moves to
 * the bottom tab bar and what stays up top is this — a compact bar that names
 * the surface and holds at most two actions, separated from the content by a
 * hairline rather than by elevation.
 */
export function TopBar({
  title,
  subtitle,
  onBack,
  actions,
  bordered = true,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  bordered?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg,
          borderBottomColor: bordered ? colors.border : 'transparent',
          borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <View style={styles.leading}>
        {onBack ? (
          <TopBarAction icon="chevron-back" label="Go back" onPress={onBack} />
        ) : null}
        <View style={styles.titles}>
          <Text
            style={[textStyle('body'), styles.title, { color: colors.fg }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[textStyle('meta'), { color: colors.fgTertiary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/**
 * A 44px touch target around a 20px icon — the touch minimum from
 * foundations.md, which is larger than the pointer minimum for a reason.
 */
export function TopBarAction({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.s2}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? colors.bgInset : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={20} color={tint ?? colors.fgSecondary} />
    </Pressable>
  );
}

/** The same pressed treatment for a filled control: dim, don't move. */
export function pressedOpacity(pressed: boolean) {
  return pressed ? PRESSED_OPACITY : 1;
}

const styles = StyleSheet.create({
  bar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s3,
    gap: space.s2,
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
  },
  titles: {
    flex: 1,
    paddingHorizontal: space.s1,
  },
  title: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
