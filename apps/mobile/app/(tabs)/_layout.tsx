import { Tabs } from "expo-router";
import React from "react";
import { FloatingNavigation } from "@/components/web-home/FloatingNavigation";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => props.state.routes[props.state.index].name === "index" ? null : <FloatingNavigation homeActive={false} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="capture" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
