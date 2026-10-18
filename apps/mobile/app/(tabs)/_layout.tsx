import { Tabs, useRouter } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
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
        tabBarLabelStyle: { ...textStyle("meta"), fontSize: 11 },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
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
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "library" : "library-outline"}
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
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
