import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { textStyle } from '@/constants/fonts';
import { useTheme } from '@/hooks/useTheme';

/**
 * The header capsule's nav pills, moved to where a thumb can reach them. Same
 * palette, same active-accent rule; the pill shape belongs to the pointer
 * design and does not come along, because a tab bar already reads as nav.
 */
export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.fgTertiary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: textStyle('label'),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'library' : 'library-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'compass' : 'compass-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
