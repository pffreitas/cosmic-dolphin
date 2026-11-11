import { Tabs, useRouter } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useControlFocus } from "@/hooks/useControlFocus";
import { Ionicons } from "@expo/vector-icons";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
function TabButton(props: BottomTabBarButtonProps) {
  const { focusStyle, ...focusEvents } = useControlFocus();
  return <PlatformPressable {...props} {...focusEvents} style={[props.style, focusStyle]} />;
}

export default function TabLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.fg,
        tabBarInactiveTintColor: colors.fgTertiary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          height: space.s8 + insets.bottom,
          paddingTop: space.s1,
          paddingBottom: Math.max(insets.bottom, space.s2),
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarButton: props => <TabButton {...props} />,
        tabBarLabel: ({ children, color }) => <Text maxFontSizeMultiplier={1.3} style={[textStyle("meta"), { color }]}>{children}</Text>,
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home, tab, 1 of 3",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/save");
          },
        }}
        options={{
          title: "Save",
          tabBarAccessibilityLabel: "Save, tab, 2 of 3",
          tabBarIcon: () => (
            <View
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingHorizontal: space.s3,
                paddingVertical: space.s1,
              }}
            >
              <Ionicons name="add" size={22} color={colors.accentFg} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarAccessibilityLabel: "Library, tab, 3 of 3",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "library" : "library-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
