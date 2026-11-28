import React from "react";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWebTheme } from "./theme";
import { radius } from "@/constants/theme";

/** Clip the decorative plate, leaving toolbar controls and hints free to escape. */
export function StarfieldHeaderBackground() {
  const insets = useSafeAreaInsets();
  const { colors } = useWebTheme();
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: "absolute", top: -insets.top, left: 0, right: 0, height: insets.top + 72, backgroundColor: colors.skyBg, borderBottomLeftRadius: radius.masthead, borderBottomRightRadius: radius.masthead, overflow: "hidden" }}>
    <Image source={require("@/assets/images/header-starfield.webp")} resizeMode="cover" fadeDuration={0} style={{ width: "100%", height: "100%" }} />
  </View>;
}
