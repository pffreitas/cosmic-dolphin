import React, { useEffect } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./ui/Signal";
import { textStyle } from "@/constants/fonts";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export function Toast({ message, undo, close }: { message?: string; undo?: () => void; close?: () => void }) {
  const { colors } = useTheme();
  useEffect(() => { if (message) AccessibilityInfo.announceForAccessibility(message); }, [message]);
  if (!message) return null;
  return <SafeAreaView edges={["bottom"]} style={{ padding: space.s4 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s2, padding: space.s3, borderWidth: 1, borderRadius: radius.md, borderColor: colors.border, backgroundColor: colors.bgPanel }}>
      <Text accessibilityLiveRegion="polite" style={[textStyle("bodySm"), { color: colors.fg, width: "100%" }]}>{message}</Text>
      {undo ? <Button title="Undo" onPress={undo} /> : null}
      {close ? <Button title="Close status" icon="close" onPress={close} /> : null}
    </View>
  </SafeAreaView>;
}
