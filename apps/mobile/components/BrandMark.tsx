import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { space } from "@/constants/theme";
import { textStyle } from "@/constants/fonts";
import { useTheme } from "@/hooks/useTheme";

const artwork = require("@/assets/images/brand-mark.png");

/** The transparent v0 symbol for compact placements. */
export function BrandMark({
  size = 36,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <Image
      source={artwork}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={Boolean(title)}
      accessibilityLabel={title}
    />
  );
}

/** A single accessible signature with a scalable wordmark. */
export function BrandSignature({
  size = 36,
  heading = false,
  appearance,
}: {
  size?: number;
  heading?: boolean;
  appearance?: "home";
}) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.signature}
      accessible
      accessibilityRole={heading ? "header" : "image"}
      accessibilityLabel="Cosmic Dolphin"
    >
      <Image
        source={artwork}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessible={false}
      />
      <Text
        style={[textStyle("bodySm"), styles.name, { color: appearance === "home" ? colors.homeHeaderFg : colors.fg }]}
        numberOfLines={appearance === "home" ? undefined : 1}
        maxFontSizeMultiplier={appearance === "home" ? 1.3 : undefined}
        accessible={false}
      >
        Cosmic Dolphin
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  signature: {
    alignSelf: "flex-start",
    flexShrink: 1,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.s1,
    paddingVertical: space.s1,
  },
  name: {
    flexShrink: 1,
    fontFamily: "InterSemibold",
  },
});
