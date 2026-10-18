import React from "react";
import { View } from "react-native";
import { radius, space } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
/** Signal's arc over a point of light, drawn with native geometry. */
export function BrandMark() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Cosmic Dolphin"
      style={{ width: space.s6, height: space.s6, alignItems: "center" }}
    >
      <View style={{ height: space.s4, width: space.s6, overflow: "hidden" }}>
        <View
          style={{
            width: space.s6,
            height: space.s6,
            borderWidth: 2,
            borderRadius: radius.pill,
            borderColor: colors.fg,
          }}
        />
      </View>
      <View
        style={{
          width: space.s1,
          height: space.s1,
          borderRadius: radius.pill,
          backgroundColor: colors.fg,
          marginTop: space.s2,
        }}
      />
    </View>
  );
}
